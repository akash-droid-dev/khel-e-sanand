/**
 * Command execution.
 *
 * §1 states four things that must hold together, and the only way to hold them
 * together is one database transaction:
 *
 *   - "A change request includes expected_version. A stale request returns
 *      VERSION_CONFLICT … it cannot silently overwrite another person's work."
 *   - "Reusing the key with the same payload returns the original result; a
 *      different payload is rejected. The key and the business write commit together."
 *   - "Outbound notification work is written with the business transaction to an
 *      outbox."
 *   - §13: "every assignment/review/override can be traced to a request and actor."
 *
 * So `runCommand` opens one transaction and inside it: claims the idempotency key,
 * runs the handler, appends the audit event, enqueues outbox messages, and stores
 * the response. A retry replays the stored response without re-running the handler.
 */
import { createHash, randomUUID } from 'node:crypto';
import type { Prisma, PrismaClient } from '@prisma/client';
import {
  type ActorContext, type CommandResult, type Warning,
  DomainError, versionConflict, idempotencyPayloadMismatch,
} from '@khel/contracts';

/** The transaction handle handlers receive. Never the root client. */
export type Tx = Prisma.TransactionClient;

export interface CommandContext {
  actor: ActorContext;
  tx: Tx;
  /** Collected during the handler and appended to the response. */
  warn: (w: Warning) => void;
  /**
   * Enqueue outbound work. Written in the same transaction as the business change,
   * so a delivery failure can never lose the change and a retry can never repeat it.
   */
  emit: (message: OutboxDraft) => void;
  /** Record a business change for the audit trail. */
  audit: (entry: AuditDraft) => void;
}

export interface OutboxDraft {
  topic: string;
  /** §11: no athlete documents, family contacts or full DOB in a payload. */
  payload: Record<string, unknown>;
  /** §11: event type + target version + recipient + channel. */
  dedupe_key: string;
  available_at?: Date;
}

export interface AuditDraft {
  action: string;
  entity_type: string;
  entity_id: string;
  /** Before/after diff with Restricted values already redacted (§13). */
  safe_diff: Record<string, unknown>;
  /** Required for every override (§13). */
  reason?: string | null;
}

export interface RunCommandOptions<TPayload, TData> {
  prisma: PrismaClient;
  actor: ActorContext;
  /** Command name, e.g. 'assignSchoolsToCH'. Used for idempotency and audit. */
  command: string;
  payload: TPayload;
  /** Required for retryable create/submit/import/issue commands (§1). */
  idempotencyKey?: string | undefined;
  handler: (ctx: CommandContext, payload: TPayload) => Promise<HandlerResult<TData>>;
  /** Serializable is the default: entry caps and stock issues need it (§14). */
  isolation?: Prisma.TransactionIsolationLevel;
}

export interface HandlerResult<TData> {
  id?: string;
  version?: number;
  state?: string;
  data: TData;
  /** Actions this actor may legally take next, given the new state (§14). */
  next_actions?: string[];
}

/** Canonical JSON so key-order differences do not read as a different payload. */
export function hashPayload(payload: unknown): string {
  return createHash('sha256').update(canonicalise(payload)).digest('hex');
}

function canonicalise(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value) ?? 'null';
  if (Array.isArray(value)) return `[${value.map(canonicalise).join(',')}]`;
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj).sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${canonicalise(obj[k])}`).join(',')}}`;
}

export async function runCommand<TPayload, TData>(
  opts: RunCommandOptions<TPayload, TData>,
): Promise<CommandResult<TData>> {
  const { prisma, actor, command, payload, idempotencyKey, handler } = opts;
  const payloadHash = hashPayload(payload);

  // --- Fast path: a completed retry replays without re-running the handler ---
  if (idempotencyKey) {
    const existing = await prisma.idempotencyKey.findUnique({
      where: {
        event_id_membership_id_command_idempotency_key: {
          event_id: actor.event_id,
          membership_id: actor.membership_id,
          command,
          idempotency_key: idempotencyKey,
        },
      },
    });
    if (existing) {
      if (existing.payload_hash !== payloadHash) throw idempotencyPayloadMismatch();
      return { ...(existing.response_body as unknown as CommandResult<TData>), replayed: true };
    }
  }

  const warnings: Warning[] = [];
  const outbox: OutboxDraft[] = [];
  const audits: AuditDraft[] = [];

  const result = await prisma.$transaction(
    async (tx) => {
      const ctx: CommandContext = {
        actor, tx,
        warn: (w) => warnings.push(w),
        emit: (m) => outbox.push(m),
        audit: (a) => audits.push(a),
      };

      const handlerResult = await handler(ctx, payload);

      const body: CommandResult<TData> = {
        data: handlerResult.data,
        warnings,
        next_actions: handlerResult.next_actions ?? [],
        ...(handlerResult.id !== undefined ? { id: handlerResult.id } : {}),
        ...(handlerResult.version !== undefined ? { version: handlerResult.version } : {}),
        ...(handlerResult.state !== undefined ? { state: handlerResult.state } : {}),
      };

      // §13: append-only audit, in the same transaction as the change it describes.
      for (const a of audits) {
        await tx.auditEvent.create({
          data: {
            event_id: actor.event_id,
            created_by: actor.user_id,
            actor_id: actor.user_id,
            effective_role: actor.role,
            action: a.action,
            entity_type: a.entity_type,
            entity_id: a.entity_id,
            safe_diff: a.safe_diff as Prisma.InputJsonValue,
            reason: a.reason ?? null,
            request_id: actor.request_id,
          },
        });
      }

      // §1: outbound work joins the business transaction.
      for (const m of outbox) {
        await tx.outboxMessage.upsert({
          where: { event_id_dedupe_key: { event_id: actor.event_id, dedupe_key: m.dedupe_key } },
          // §11: "Deduplicate by event type + target version + recipient + channel."
          // A second identical enqueue is not a second notification.
          update: {},
          create: {
            event_id: actor.event_id,
            topic: m.topic,
            payload: m.payload as Prisma.InputJsonValue,
            dedupe_key: m.dedupe_key,
            available_at: m.available_at ?? new Date(),
          },
        });
      }

      // §1: "The key and the business write commit together."
      if (idempotencyKey) {
        await tx.idempotencyKey.create({
          data: {
            event_id: actor.event_id,
            idempotency_key: idempotencyKey,
            membership_id: actor.membership_id,
            command,
            payload_hash: payloadHash,
            response_body: body as unknown as Prisma.InputJsonValue,
            response_status: 200,
            request_id: actor.request_id,
          },
        });
      }

      return body;
    },
    {
      // §14: "Use transaction-level protections for overlapping active assignments,
      // entry caps, stock issues and primary scorecard ownership."
      isolationLevel: opts.isolation ?? 'Serializable',
      maxWait: 5_000,
      timeout: 15_000,
    },
  );

  return result;
}

/* ------------------------------------------------------------------ *
 * Optimistic concurrency
 * ------------------------------------------------------------------ */

/**
 * Guarded update. Bumps row_version only when the caller's expected_version still
 * matches, so two people editing the same record cannot silently overwrite one
 * another (§1, AT-024, AT-025).
 *
 * Returns the new version. Throws VERSION_CONFLICT carrying the CURRENT version, so
 * the client can show what changed rather than a bare failure.
 */
export async function updateWithVersion<T extends { row_version: number }>(
  tx: Tx,
  model: {
    updateMany: (args: {
      where: Record<string, unknown>;
      data: Record<string, unknown>;
    }) => Promise<{ count: number }>;
    findUnique: (args: { where: { id: string } }) => Promise<T | null>;
  },
  id: string,
  expectedVersion: number,
  data: Record<string, unknown>,
): Promise<number> {
  const nextVersion = expectedVersion + 1;
  const { count } = await model.updateMany({
    where: { id, row_version: expectedVersion },
    data: { ...data, row_version: nextVersion },
  });

  if (count === 0) {
    const current = await model.findUnique({ where: { id } });
    if (!current) {
      throw new DomainError('VALIDATION_FAILED', 'Record not found.', {
        nextAction: 'Reload the list; the record may have been removed.',
      });
    }
    throw versionConflict(current.row_version);
  }
  return nextVersion;
}

/** Fresh request id for an inbound call or a background job. */
export const newRequestId = (): string => randomUUID();
