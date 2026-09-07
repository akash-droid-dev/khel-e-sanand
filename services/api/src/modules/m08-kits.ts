/**
 * M08 — Volunteer kits and stock. §9.
 *
 * Three acceptance criteria drive the design:
 *   - AT-021: "Two users issuing the final available item cannot both succeed."
 *     Stock is a ledger, and the check-and-decrement happens inside the command's
 *     Serializable transaction with a row lock, not as a read-then-write.
 *   - AT-022: "Retry same issue → No second decrement." Handled by the idempotency
 *     key, which commits with the ledger movement.
 *   - AT-023: "Optional unissued item does not make required kit partial."
 *     Fulfilment is computed over REQUIRED entitlements only.
 */
import type { Prisma } from '@prisma/client';
import { validationFailed, capacityConflict, outOfScope } from '@khel/contracts';
import type { KitFulfilment } from '@khel/contracts';
import type { CommandContext } from '../core/command.js';
import { assertAccess } from '../core/access.js';

/* ------------------------------------------------------------------ *
 * issueKitItem
 * ------------------------------------------------------------------ */

export interface IssueKitPayload {
  entitlement_id: string;
  quantity: number;
  /** Required when stock tracking is enabled for this event. */
  stock_location_id?: string | null;
  reason?: string | null;
  /** Set when replacing a lost or damaged item; references the original issue. */
  reissue_of_id?: string | null;
  /** §1: retryable commands carry a key. Stored on the row for traceability. */
  idempotency_key: string;
}

export async function issueKitItem(
  ctx: CommandContext, payload: IssueKitPayload,
): Promise<{
  issue_id: string; issued_quantity: number;
  remaining_entitlement: number; stock_after: number | null;
}> {
  if (payload.quantity <= 0) {
    throw validationFailed('Issue quantity must be positive.', [
      { field: 'quantity', message: 'A kit issue records items handed over, so it is at least 1.' },
    ]);
  }

  const entitlement = await ctx.tx.kitEntitlement.findFirst({
    where: { id: payload.entitlement_id, event_id: ctx.actor.event_id },
    include: { kit_issues: true, item: true },
  });
  if (!entitlement) throw validationFailed('Kit entitlement not found.');

  // A CH may issue only within their own pool (§9 permission matrix).
  const pool = await ctx.tx.volunteerPoolAssignment.findFirst({
    where: { event_id: ctx.actor.event_id, volunteer_membership_id: entitlement.volunteer_id,
             effective_to: null },
  });
  assertAccess({
    actor: ctx.actor, action: 'kit.issue',
    target: { event_id: ctx.actor.event_id, cluster_id: pool?.cluster_id ?? null,
              school_id: null },
  });

  // §9: "Scope, entitlement and reissue rules checked."
  const alreadyIssued = entitlement.kit_issues
    .filter((i) => !i.reissue_of_id)          // a reissue replaces, it does not add
    .reduce((sum, i) => sum + i.quantity, 0);
  const remaining = entitlement.required_quantity - alreadyIssued;

  if (!payload.reissue_of_id && payload.quantity > remaining) {
    throw capacityConflict(
      `This volunteer is entitled to ${entitlement.required_quantity} of ` +
      `${entitlement.item.name}; ${alreadyIssued} already issued, so at most ` +
      `${Math.max(0, remaining)} may be issued now.`,
      [{ field: 'quantity', message: `Remaining entitlement is ${Math.max(0, remaining)}.` }],
    );
  }

  // --- Stock, when tracking is enabled ---
  let stockAfter: number | null = null;
  if (payload.stock_location_id) {
    // AT-021: lock the ledger rows for this (location, item, variant) before summing,
    // so two concurrent issues of the last item serialise instead of both reading 1.
    await ctx.tx.$queryRaw`
      SELECT 1 FROM stock_movements
      WHERE location_id = ${payload.stock_location_id}::uuid
        AND item_id = ${entitlement.item_id}::uuid
      FOR UPDATE`;

    const balance = await ctx.tx.stockMovement.aggregate({
      where: {
        event_id: ctx.actor.event_id,
        location_id: payload.stock_location_id,
        item_id: entitlement.item_id,
        variant: entitlement.variant,
      },
      _sum: { quantity_delta: true },
    });
    const available = balance._sum.quantity_delta ?? 0;

    if (available < payload.quantity) {
      // §9: "Negative balance blocked unless explicitly authorised policy."
      throw capacityConflict(
        `Only ${available} of ${entitlement.item.name} remain at this location; ` +
        `${payload.quantity} requested.`,
        [{ field: 'quantity', message: `Available: ${available}.` }],
      );
    }
    stockAfter = available - payload.quantity;
  }

  const issue = await ctx.tx.kitIssue.create({
    data: {
      event_id: ctx.actor.event_id,
      created_by: ctx.actor.user_id, updated_by: ctx.actor.user_id,
      entitlement_id: payload.entitlement_id,
      quantity: payload.quantity,
      stock_location_id: payload.stock_location_id ?? null,
      issued_at: new Date(),
      issued_by: ctx.actor.user_id,
      reissue_of_id: payload.reissue_of_id ?? null,
      reason: payload.reason ?? null,
      idempotency_key: payload.idempotency_key,
    },
  });

  if (payload.stock_location_id) {
    // §9: stock is an append-only ledger; an issue is a negative movement, never
    // an edit to a running total.
    await ctx.tx.stockMovement.create({
      data: {
        event_id: ctx.actor.event_id,
        created_by: ctx.actor.user_id,
        location_id: payload.stock_location_id,
        item_id: entitlement.item_id,
        variant: entitlement.variant,
        quantity_delta: -payload.quantity,
        movement_type: 'Issue',
        issue_id: issue.id,
        reason: payload.reason ?? `Issued to volunteer ${entitlement.volunteer_id}`,
      },
    });
  }

  ctx.audit({
    action: 'issueKitItem', entity_type: 'KitIssue', entity_id: issue.id,
    safe_diff: { entitlement_id: payload.entitlement_id, quantity: payload.quantity,
                 reissue_of_id: payload.reissue_of_id ?? null, stock_after: stockAfter },
    reason: payload.reason ?? null,
  });

  return {
    issue_id: issue.id,
    issued_quantity: payload.quantity,
    remaining_entitlement: Math.max(0, remaining - payload.quantity),
    stock_after: stockAfter,
  };
}

/* ------------------------------------------------------------------ *
 * acknowledgeKit
 * ------------------------------------------------------------------ */

/** §9: "Confirm receipt only; cannot alter issue quantity, issuer or date." */
export async function acknowledgeKit(
  ctx: CommandContext, payload: { issue_id: string },
): Promise<{ issue_id: string; acknowledged_at: string }> {
  const issue = await ctx.tx.kitIssue.findFirst({
    where: { id: payload.issue_id, event_id: ctx.actor.event_id },
    include: { entitlement: true },
  });
  if (!issue) throw validationFailed('Kit issue not found.');

  // A volunteer acknowledges their OWN receipt and nothing else.
  if (issue.entitlement.volunteer_id !== ctx.actor.membership_id && ctx.actor.role === 'VOL') {
    throw outOfScope('acknowledge a kit issued to someone else');
  }

  if (issue.acknowledged_at) {
    return { issue_id: issue.id, acknowledged_at: issue.acknowledged_at.toISOString() };
  }

  const now = new Date();
  await ctx.tx.kitIssue.update({
    where: { id: payload.issue_id },
    // Only the acknowledgement is written; quantity, issuer and issue date are untouched.
    data: { acknowledged_at: now, updated_by: ctx.actor.user_id, row_version: { increment: 1 } },
  });

  ctx.audit({
    action: 'acknowledgeKit', entity_type: 'KitIssue', entity_id: payload.issue_id,
    safe_diff: { acknowledged_at: now.toISOString() },
  });

  return { issue_id: payload.issue_id, acknowledged_at: now.toISOString() };
}

/* ------------------------------------------------------------------ *
 * getKitStatus
 * ------------------------------------------------------------------ */

export interface VolunteerKitStatus {
  volunteer_id: string;
  fulfilment: KitFulfilment;
  required_items: number;
  required_fulfilled: number;
  /** Tracked, but never able to make a kit Partial (AT-023). */
  optional_items: number;
  optional_fulfilled: number;
  /** §9: "Track acknowledged separately." */
  acknowledged_issues: number;
  total_issues: number;
}

/**
 * §9: "Pending = no required quantity issued; partial = some; issued = all.
 * Track acknowledged separately." And AT-023: an optional item left unissued does
 * not downgrade a complete kit — so optional entitlements are excluded from the
 * fulfilment calculation entirely and reported alongside.
 */
export async function getKitStatus(
  ctx: CommandContext, payload: { volunteer_ids?: string[]; cluster_id?: string | null },
): Promise<VolunteerKitStatus[]> {
  assertAccess({ actor: ctx.actor, action: 'kit.issue',
                 target: { event_id: ctx.actor.event_id, cluster_id: payload.cluster_id ?? null } });

  const entitlements = await ctx.tx.kitEntitlement.findMany({
    where: {
      event_id: ctx.actor.event_id,
      ...(payload.volunteer_ids ? { volunteer_id: { in: payload.volunteer_ids } } : {}),
    },
    include: { kit_issues: true, item: true },
  });

  const byVolunteer = new Map<string, typeof entitlements>();
  for (const e of entitlements) {
    const list = byVolunteer.get(e.volunteer_id) ?? [];
    list.push(e);
    byVolunteer.set(e.volunteer_id, list);
  }

  const out: VolunteerKitStatus[] = [];
  for (const [volunteerId, list] of byVolunteer) {
    // AT-023: fulfilment is computed over REQUIRED entitlements only. An optional
    // item left unissued is reported, but never downgrades a complete kit.
    const required = list.filter((e) => e.is_required);
    const optional = list.filter((e) => !e.is_required);

    const fulfilled = (e: (typeof list)[number]) => {
      const issued = e.kit_issues
        .filter((i) => !i.reissue_of_id)
        .reduce((s, i) => s + i.quantity, 0);
      return issued >= e.required_quantity;
    };

    const requiredFulfilled = required.filter(fulfilled).length;
    const optionalFulfilled = optional.filter((e) => e.kit_issues.length > 0).length;

    const fulfilment: KitFulfilment =
      required.length === 0 ? 'Issued'
      : requiredFulfilled === 0 ? 'Pending'
      : requiredFulfilled === required.length ? 'Issued'
      : 'Partial';

    const allIssues = list.flatMap((e) => e.kit_issues);
    out.push({
      volunteer_id: volunteerId,
      fulfilment,
      required_items: required.length,
      required_fulfilled: requiredFulfilled,
      optional_items: optional.length,
      optional_fulfilled: optionalFulfilled,
      acknowledged_issues: allIssues.filter((i) => i.acknowledged_at).length,
      total_issues: allIssues.length,
    });
  }
  return out;
}

/* ------------------------------------------------------------------ *
 * receiveStock / adjustStock
 * ------------------------------------------------------------------ */

export async function receiveStock(
  ctx: CommandContext,
  payload: { location_id: string; item_id: string; variant?: string | null;
             quantity: number; reason: string },
): Promise<{ movement_id: string; balance_after: number }> {
  assertAccess({ actor: ctx.actor, action: 'kit.issue' });
  if (payload.quantity <= 0) {
    throw validationFailed('A stock receipt must be a positive quantity.');
  }

  const movement = await ctx.tx.stockMovement.create({
    data: {
      event_id: ctx.actor.event_id,
      created_by: ctx.actor.user_id,
      location_id: payload.location_id,
      item_id: payload.item_id,
      variant: payload.variant ?? null,
      quantity_delta: payload.quantity,
      movement_type: 'Receipt',
      reason: payload.reason,
    },
  });

  const balance = await ctx.tx.stockMovement.aggregate({
    where: { event_id: ctx.actor.event_id, location_id: payload.location_id,
             item_id: payload.item_id, variant: payload.variant ?? null },
    _sum: { quantity_delta: true },
  });

  ctx.audit({
    action: 'receiveStock', entity_type: 'StockMovement', entity_id: movement.id,
    safe_diff: { quantity_delta: payload.quantity,
                 balance_after: balance._sum.quantity_delta ?? 0 },
    reason: payload.reason,
  });

  return { movement_id: movement.id, balance_after: balance._sum.quantity_delta ?? 0 };
}

/**
 * §9: "append adjustment instead of editing old movement."
 * A correction to yesterday's count is a new row with a reason, so the ledger keeps
 * showing what was believed at the time.
 */
export async function adjustStock(
  ctx: CommandContext,
  payload: { location_id: string; item_id: string; variant?: string | null;
             quantity_delta: number; reason: string },
): Promise<{ movement_id: string; balance_after: number }> {
  assertAccess({ actor: ctx.actor, action: 'kit.issue' });
  if (payload.quantity_delta === 0) {
    throw validationFailed('A stock adjustment must change the balance.');
  }
  if (!payload.reason?.trim()) {
    throw validationFailed('A stock adjustment requires a reason.');
  }

  const movement = await ctx.tx.stockMovement.create({
    data: {
      event_id: ctx.actor.event_id,
      created_by: ctx.actor.user_id,
      location_id: payload.location_id, item_id: payload.item_id,
      variant: payload.variant ?? null,
      quantity_delta: payload.quantity_delta,
      movement_type: 'Adjustment',
      reason: payload.reason,
    },
  });

  const balance = await ctx.tx.stockMovement.aggregate({
    where: { event_id: ctx.actor.event_id, location_id: payload.location_id,
             item_id: payload.item_id, variant: payload.variant ?? null },
    _sum: { quantity_delta: true },
  });
  const after = balance._sum.quantity_delta ?? 0;

  if (after < 0) {
    throw capacityConflict(
      `This adjustment would leave a negative balance (${after}), which is blocked ` +
      `unless an authorised policy permits it (§9).`,
    );
  }

  ctx.audit({
    action: 'adjustStock', entity_type: 'StockMovement', entity_id: movement.id,
    safe_diff: { quantity_delta: payload.quantity_delta, balance_after: after },
    reason: payload.reason,
  });

  return { movement_id: movement.id, balance_after: after };
}
