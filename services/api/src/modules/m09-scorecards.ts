/**
 * M09 — Scorecards, review, finalisation and amendments. §10.
 *
 * State model: Draft → Submitted → Approved → Locked, with Submitted → Returned → Draft.
 *
 * The requirements that shape the code:
 *   - "Atomically freeze submitted revision, calculate preview, record action and
 *      enqueue review notification" — one transaction, which is what runCommand gives.
 *   - AT-024: a stale save after submission must not touch the submitted result.
 *   - AT-025: "Approving revision 3 cannot inadvertently approve revision 4" — the
 *      reviewer approves an exact revision AND its checksum.
 *   - §10: "The same person should not approve their own submission by default."
 *   - AT-027: an amendment retains the old final and previews downstream impact.
 */
import { createHash } from 'node:crypto';
import type { Prisma } from '@prisma/client';
import {
  validationFailed, invalidState, outOfScope, versionConflict,
  dependencyBlocked, rulesNotApproved,
} from '@khel/contracts';
import type { CommandContext } from '../core/command.js';
import { assertAccess } from '../core/access.js';

/** Content hash of a revision. The reviewer approves this exact bytes-on-record. */
export function revisionChecksum(payload: unknown, calculated: unknown): string {
  return createHash('sha256')
    .update(JSON.stringify({ payload, calculated }))
    .digest('hex');
}

/* ------------------------------------------------------------------ *
 * openScorecard
 * ------------------------------------------------------------------ */

/**
 * §10: "Return pinned template, participants, latest editable revision and
 * permission reason." The permission reason is not decoration — a volunteer who
 * cannot score needs to know whether they lack a duty or the fixture is locked.
 */
export async function openScorecard(
  ctx: CommandContext, payload: { fixture_id: string },
) {
  const fixture = await ctx.tx.fixture.findFirst({
    where: { id: payload.fixture_id, event_id: ctx.actor.event_id },
    include: { rule_version: true, competition: { include: { discipline: true } } },
  });
  if (!fixture) throw validationFailed('Fixture not found in this event.');

  // §1: scoring access defaults to an explicit fixture duty.
  const decision = assertAccess({
    actor: ctx.actor,
    action: 'scorecard.edit',
    target: { event_id: ctx.actor.event_id, fixture_id: payload.fixture_id },
  });

  // §6: a fixture pins an immutable approved rule version. No approval, no scoring.
  if (fixture.rule_version.approval_status !== 'Approved') {
    throw rulesNotApproved(fixture.competition.competition_code);
  }

  const scorecard = await ctx.tx.scorecard.findUnique({
    where: { fixture_id: payload.fixture_id },
    include: {
      scorecard_revisions: { orderBy: { revision_no: 'desc' }, take: 5 },
    },
  });

  const editable = scorecard?.scorecard_revisions.find(
    (r) => r.status === 'Draft' || r.status === 'Returned',
  );

  return {
    fixture_id: fixture.id,
    discipline: fixture.competition.discipline.code,
    rule_version_id: fixture.rule_version_id,
    template_pinned: true,
    permission_reason: decision.reason,
    editable_revision: editable
      ? { id: editable.id, revision_no: editable.revision_no,
          status: editable.status, row_version: editable.row_version }
      : null,
    recent_revisions: scorecard?.scorecard_revisions.map((r) => ({
      id: r.id, revision_no: r.revision_no, status: r.status,
    })) ?? [],
  };
}

/* ------------------------------------------------------------------ *
 * saveScorecardDraft
 * ------------------------------------------------------------------ */

export interface SaveDraftPayload {
  fixture_id: string;
  /** Omit to create the first revision. */
  revision_id?: string;
  expected_version?: number;
  raw_payload: Record<string, unknown>;
  calculated_result: Record<string, unknown>;
}

export async function saveScorecardDraft(
  ctx: CommandContext, payload: SaveDraftPayload,
): Promise<{ revision_id: string; revision_no: number; version: number; saved_at: string }> {
  const fixture = await ctx.tx.fixture.findFirst({
    where: { id: payload.fixture_id, event_id: ctx.actor.event_id },
  });
  if (!fixture) throw validationFailed('Fixture not found in this event.');

  assertAccess({
    actor: ctx.actor, action: 'scorecard.edit',
    target: { event_id: ctx.actor.event_id, fixture_id: payload.fixture_id },
  });

  const template = await ctx.tx.scoreTemplate.findFirst({
    where: { event_id: ctx.actor.event_id, rule_version_id: fixture.rule_version_id },
    orderBy: { template_version: 'desc' },
  });
  if (!template) throw rulesNotApproved('this competition (no score template)');

  const scorecard = await ctx.tx.scorecard.upsert({
    where: { fixture_id: payload.fixture_id },
    update: {},
    create: {
      event_id: ctx.actor.event_id,
      created_by: ctx.actor.user_id, updated_by: ctx.actor.user_id,
      fixture_id: payload.fixture_id, current_revision_no: 0,
    },
  });

  const checksum = revisionChecksum(payload.raw_payload, payload.calculated_result);

  // --- update an existing editable revision ---
  if (payload.revision_id) {
    const existing = await ctx.tx.scorecardRevision.findFirst({
      where: { id: payload.revision_id, event_id: ctx.actor.event_id },
    });
    if (!existing) throw validationFailed('Revision not found.');

    // AT-024: once submitted, a late save from a stale client must not land.
    if (existing.status !== 'Draft' && existing.status !== 'Returned') {
      throw invalidState(existing.status, 'save a draft');
    }
    if (payload.expected_version === undefined) {
      throw validationFailed('expected_version is required when updating a revision.');
    }

    const { count } = await ctx.tx.scorecardRevision.updateMany({
      where: { id: payload.revision_id, row_version: payload.expected_version,
               status: { in: ['Draft', 'Returned'] } },
      data: {
        raw_payload: payload.raw_payload as Prisma.InputJsonValue,
        calculated_result: payload.calculated_result as Prisma.InputJsonValue,
        checksum,
        status: 'Draft',
        updated_by: ctx.actor.user_id,
        row_version: { increment: 1 },
      },
    });
    if (count === 0) {
      // AT-024/AT-025: report the current version so the client can reconcile
      // rather than retry blindly and clobber someone else's work.
      const current = await ctx.tx.scorecardRevision.findUnique({
        where: { id: payload.revision_id },
      });
      throw versionConflict(current?.row_version ?? 0);
    }

    return {
      revision_id: payload.revision_id,
      revision_no: existing.revision_no,
      version: payload.expected_version + 1,
      saved_at: new Date().toISOString(),
    };
  }

  // --- create the first editable revision ---
  const nextNo = scorecard.current_revision_no + 1;
  const created = await ctx.tx.scorecardRevision.create({
    data: {
      event_id: ctx.actor.event_id,
      created_by: ctx.actor.user_id, updated_by: ctx.actor.user_id,
      scorecard_id: scorecard.id,
      revision_no: nextNo,
      rule_version_id: fixture.rule_version_id,
      template_id: template.id,
      status: 'Draft',
      raw_payload: payload.raw_payload as Prisma.InputJsonValue,
      calculated_result: payload.calculated_result as Prisma.InputJsonValue,
      checksum,
    },
  });
  await ctx.tx.scorecard.update({
    where: { id: scorecard.id },
    data: { current_revision_no: nextNo, updated_by: ctx.actor.user_id,
            row_version: { increment: 1 } },
  });

  return { revision_id: created.id, revision_no: nextNo, version: created.row_version,
           saved_at: created.updated_at.toISOString() };
}

/* ------------------------------------------------------------------ *
 * submitScorecard
 * ------------------------------------------------------------------ */

export interface SubmitPayload {
  revision_id: string;
  expected_version: number;
  /** §10: submission carries an explicit attestation, not an implicit one. */
  attestation: string;
}

export async function submitScorecard(
  ctx: CommandContext, payload: SubmitPayload,
): Promise<{ revision_id: string; status: string; version: number; checksum: string }> {
  const revision = await ctx.tx.scorecardRevision.findFirst({
    where: { id: payload.revision_id, event_id: ctx.actor.event_id },
    include: { scorecard: true },
  });
  if (!revision) throw validationFailed('Revision not found.');

  assertAccess({
    actor: ctx.actor, action: 'scorecard.submit',
    target: { event_id: ctx.actor.event_id, fixture_id: revision.scorecard.fixture_id },
    allowedStates: ['Draft', 'Returned'],
  });
  if (revision.status !== 'Draft' && revision.status !== 'Returned') {
    throw invalidState(revision.status, 'submit');
  }
  if (!payload.attestation?.trim()) {
    throw validationFailed('An attestation is required to submit a scorecard.', [
      { field: 'attestation', message: 'Confirm the values match the official record.' },
    ]);
  }

  // §10: "Check completeness … and unresolved official decisions."
  const calculated = revision.calculated_result as Record<string, unknown> | null;
  const unresolved = Array.isArray(calculated?.['unresolved']) ? calculated['unresolved'] : [];
  const issues = Array.isArray(calculated?.['issues']) ? calculated['issues'] : [];
  if (issues.length > 0) {
    throw validationFailed(
      `This scorecard has ${issues.length} unresolved validation issue(s) and cannot be submitted.`,
      (issues as { code?: string; message?: string }[]).map((i) => ({
        field: i.code ?? 'calculation', message: i.message ?? 'Validation issue.',
      })),
    );
  }
  if (unresolved.length > 0) {
    // A tie or an arbiter claim blocks submission until an official decides (§15).
    throw dependencyBlocked(
      `This result needs ${unresolved.length} official decision(s) before it can be submitted.`,
      (unresolved as { code?: string; message?: string }[]).map((u) => ({
        field: u.code ?? 'decision', message: u.message ?? 'Official decision required.',
      })),
    );
  }

  const { count } = await ctx.tx.scorecardRevision.updateMany({
    where: { id: payload.revision_id, row_version: payload.expected_version,
             status: { in: ['Draft', 'Returned'] } },
    data: { status: 'Submitted', updated_by: ctx.actor.user_id, row_version: { increment: 1 } },
  });
  if (count === 0) {
    const current = await ctx.tx.scorecardRevision.findUnique({ where: { id: payload.revision_id } });
    throw versionConflict(current?.row_version ?? 0);
  }

  await ctx.tx.reviewAction.create({
    data: {
      event_id: ctx.actor.event_id, created_by: ctx.actor.user_id,
      revision_id: payload.revision_id, action: 'Submit',
      actor_id: ctx.actor.user_id, comment: payload.attestation,
      reviewed_checksum: revision.checksum,
    },
  });

  ctx.audit({
    action: 'submitScorecard', entity_type: 'ScorecardRevision',
    entity_id: payload.revision_id,
    safe_diff: { from: revision.status, to: 'Submitted', checksum: revision.checksum },
  });

  // AT-028: the queue reads the database directly, so a delayed alert never hides
  // a submitted result. The outbox exists for the alert, not for the state change.
  ctx.emit({
    topic: 'ScorecardSubmitted',
    dedupe_key: `ScorecardSubmitted:${payload.revision_id}:${payload.expected_version + 1}:InApp`,
    payload: { fixture_id: revision.scorecard.fixture_id, revision_id: payload.revision_id },
  });

  return { revision_id: payload.revision_id, status: 'Submitted',
           version: payload.expected_version + 1, checksum: revision.checksum };
}

/* ------------------------------------------------------------------ *
 * returnForCorrection / approveScorecard / lockScorecard
 * ------------------------------------------------------------------ */

export async function returnForCorrection(
  ctx: CommandContext,
  payload: { revision_id: string; expected_version: number; comments: string; fields?: string[] },
): Promise<{ revision_id: string; status: string; version: number }> {
  const revision = await requireReviewableRevision(ctx, payload.revision_id);

  if (!payload.comments?.trim()) {
    // §10: "Submitted only; comments required."
    throw validationFailed('Comments are required when returning a scorecard.', [
      { field: 'comments', message: 'Tell the scorer what needs attention.' },
    ]);
  }

  const { count } = await ctx.tx.scorecardRevision.updateMany({
    where: { id: payload.revision_id, row_version: payload.expected_version, status: 'Submitted' },
    data: { status: 'Returned', updated_by: ctx.actor.user_id, row_version: { increment: 1 } },
  });
  if (count === 0) throw versionConflict(revision.row_version);

  await ctx.tx.reviewAction.create({
    data: {
      event_id: ctx.actor.event_id, created_by: ctx.actor.user_id,
      revision_id: payload.revision_id, action: 'Return', actor_id: ctx.actor.user_id,
      comment: payload.comments, reviewed_checksum: revision.checksum,
    },
  });
  ctx.audit({
    action: 'returnForCorrection', entity_type: 'ScorecardRevision',
    entity_id: payload.revision_id,
    safe_diff: { from: 'Submitted', to: 'Returned', fields: payload.fields ?? [] },
    reason: payload.comments,
  });
  // AT-026: the alert links to the exact revision and its comments.
  ctx.emit({
    topic: 'ScorecardReturned',
    dedupe_key: `ScorecardReturned:${payload.revision_id}:${payload.expected_version + 1}:InApp`,
    payload: { revision_id: payload.revision_id, comments: payload.comments,
               fields: payload.fields ?? [] },
  });

  return { revision_id: payload.revision_id, status: 'Returned',
           version: payload.expected_version + 1 };
}

export interface ApprovePayload {
  revision_id: string;
  expected_version: number;
  /** AT-025: the reviewer approves the exact bytes they read. */
  reviewed_checksum: string;
  /** §10: self-approval needs an explicit, recorded override. */
  self_review_override_reason?: string | null;
}

export async function approveScorecard(
  ctx: CommandContext, payload: ApprovePayload,
): Promise<{ revision_id: string; status: string; version: number; self_review_flagged: boolean }> {
  const revision = await requireReviewableRevision(ctx, payload.revision_id);

  // AT-025: "Approving revision 3 cannot inadvertently approve revision 4."
  // Matching only on id would approve whatever the row now holds; matching the
  // checksum means approval attaches to content, not to a row.
  if (payload.reviewed_checksum !== revision.checksum) {
    throw versionConflict(revision.row_version);
  }

  const calculated = revision.calculated_result as Record<string, unknown> | null;
  const unresolved = Array.isArray(calculated?.['unresolved']) ? calculated['unresolved'] : [];
  if (unresolved.length > 0) {
    throw dependencyBlocked(
      'This result still has unresolved official decisions and cannot be approved.',
      (unresolved as { code?: string; message?: string }[]).map((u) => ({
        field: u.code ?? 'decision', message: u.message ?? 'Official decision required.',
      })),
    );
  }

  // §10: "The same person should not approve their own submission by default."
  const submission = await ctx.tx.reviewAction.findFirst({
    where: { revision_id: payload.revision_id, action: 'Submit' },
    orderBy: { created_at: 'desc' },
  });
  const selfReview = submission?.actor_id === ctx.actor.user_id;
  if (selfReview && !payload.self_review_override_reason) {
    throw outOfScope('approve a scorecard you submitted yourself');
  }

  const { count } = await ctx.tx.scorecardRevision.updateMany({
    where: { id: payload.revision_id, row_version: payload.expected_version, status: 'Submitted' },
    data: { status: 'Approved', updated_by: ctx.actor.user_id, row_version: { increment: 1 } },
  });
  if (count === 0) throw versionConflict(revision.row_version);

  await ctx.tx.reviewAction.create({
    data: {
      event_id: ctx.actor.event_id, created_by: ctx.actor.user_id,
      revision_id: payload.revision_id, action: 'Approve', actor_id: ctx.actor.user_id,
      comment: payload.self_review_override_reason ?? null,
      reviewed_checksum: payload.reviewed_checksum,
    },
  });
  ctx.audit({
    action: 'approveScorecard', entity_type: 'ScorecardRevision',
    entity_id: payload.revision_id,
    safe_diff: { from: 'Submitted', to: 'Approved', checksum: payload.reviewed_checksum,
                 self_review: selfReview },
    reason: payload.self_review_override_reason ?? null,
  });

  return { revision_id: payload.revision_id, status: 'Approved',
           version: payload.expected_version + 1, self_review_flagged: selfReview };
}

/**
 * §10: "Create final ResultSnapshot and immutable source references."
 * The snapshot freezes the DISPLAY identity too, so a later school rename or athlete
 * transfer cannot rewrite a published result (§2, §5 acceptance).
 */
export async function lockScorecard(
  ctx: CommandContext,
  payload: {
    revision_id: string; expected_version: number;
    snapshots: {
      participant_id: string; status: string; rank?: number | null;
      primary_value?: string | null; unit?: string | null;
      tie_values?: unknown; identity_snapshot: Record<string, unknown>;
    }[];
  },
): Promise<{ revision_id: string; status: string; version: number; snapshot_count: number }> {
  const revision = await ctx.tx.scorecardRevision.findFirst({
    where: { id: payload.revision_id, event_id: ctx.actor.event_id },
    include: { scorecard: true },
  });
  if (!revision) throw validationFailed('Revision not found.');
  if (revision.status !== 'Approved') throw invalidState(revision.status, 'lock');

  assertAccess({
    actor: ctx.actor, action: 'scorecard.review',
    target: { event_id: ctx.actor.event_id, fixture_id: revision.scorecard.fixture_id },
  });

  const { count } = await ctx.tx.scorecardRevision.updateMany({
    where: { id: payload.revision_id, row_version: payload.expected_version, status: 'Approved' },
    data: { status: 'Locked', updated_by: ctx.actor.user_id, row_version: { increment: 1 } },
  });
  if (count === 0) throw versionConflict(revision.row_version);

  for (const s of payload.snapshots) {
    // The database CHECK refuses a rank on a non-Completed status, so a bad
    // snapshot fails here rather than becoming a wrong published result.
    await ctx.tx.resultSnapshot.create({
      data: {
        event_id: ctx.actor.event_id, created_by: ctx.actor.user_id,
        revision_id: payload.revision_id,
        participant_id: s.participant_id,
        status: s.status as Prisma.ResultSnapshotCreateInput['status'],
        rank: s.rank ?? null,
        primary_value: s.primary_value ?? null,
        unit: s.unit ?? null,
        tie_values: (s.tie_values ?? null) as Prisma.InputJsonValue,
        identity_snapshot: s.identity_snapshot as Prisma.InputJsonValue,
      },
    });
  }

  await ctx.tx.reviewAction.create({
    data: {
      event_id: ctx.actor.event_id, created_by: ctx.actor.user_id,
      revision_id: payload.revision_id, action: 'Lock', actor_id: ctx.actor.user_id,
      reviewed_checksum: revision.checksum,
    },
  });
  ctx.audit({
    action: 'lockScorecard', entity_type: 'ScorecardRevision', entity_id: payload.revision_id,
    safe_diff: { from: 'Approved', to: 'Locked', snapshots: payload.snapshots.length },
  });
  ctx.emit({
    topic: 'ResultLocked',
    dedupe_key: `ResultLocked:${payload.revision_id}:${payload.expected_version + 1}:InApp`,
    payload: { fixture_id: revision.scorecard.fixture_id, revision_id: payload.revision_id },
  });

  return { revision_id: payload.revision_id, status: 'Locked',
           version: payload.expected_version + 1, snapshot_count: payload.snapshots.length };
}

/* ------------------------------------------------------------------ *
 * amendLockedResult
 * ------------------------------------------------------------------ */

/**
 * AT-027 / §10: "Create amendment revision; retain old final record. Preview
 * progression/standings impact and require named approval."
 * AT-017 / §7: "Once a downstream fixture starts, the system opens an ED exception
 * instead of replacing competitors automatically."
 */
export async function amendLockedResult(
  ctx: CommandContext,
  payload: {
    locked_revision_id: string; reason: string;
    raw_payload: Record<string, unknown>; calculated_result: Record<string, unknown>;
  },
): Promise<{
  amendment_id: string; new_revision_id: string;
  downstream_started: number; exception_case_id: string | null;
}> {
  assertAccess({ actor: ctx.actor, action: 'scorecard.amendLocked' });

  if (!payload.reason?.trim()) {
    throw validationFailed('An amendment requires a recorded reason.', [
      { field: 'reason', message: 'State why the locked result is being changed.' },
    ]);
  }

  const locked = await ctx.tx.scorecardRevision.findFirst({
    where: { id: payload.locked_revision_id, event_id: ctx.actor.event_id, status: 'Locked' },
    include: { scorecard: { include: { fixture: true } } },
  });
  if (!locked) throw invalidState('not Locked', 'amend');

  // Downstream fixtures that consumed this result and have already started.
  const dependencies = await ctx.tx.fixtureDependency.findMany({
    where: { event_id: ctx.actor.event_id, source_fixture_id: locked.scorecard.fixture_id },
    include: { target_fixture: true },
  });
  const started = dependencies.filter(
    (d) => d.target_fixture.lifecycle !== 'Draft' && d.target_fixture.lifecycle !== 'Ready',
  );

  const nextNo = locked.scorecard.current_revision_no + 1;
  const checksum = revisionChecksum(payload.raw_payload, payload.calculated_result);

  const newRevision = await ctx.tx.scorecardRevision.create({
    data: {
      event_id: ctx.actor.event_id,
      created_by: ctx.actor.user_id, updated_by: ctx.actor.user_id,
      scorecard_id: locked.scorecard_id,
      revision_no: nextNo,
      rule_version_id: locked.rule_version_id,
      template_id: locked.template_id,
      status: 'Draft',
      raw_payload: payload.raw_payload as Prisma.InputJsonValue,
      calculated_result: payload.calculated_result as Prisma.InputJsonValue,
      checksum,
    },
  });
  await ctx.tx.scorecard.update({
    where: { id: locked.scorecard_id },
    data: { current_revision_no: nextNo, updated_by: ctx.actor.user_id,
            row_version: { increment: 1 } },
  });

  const amendment = await ctx.tx.amendment.create({
    data: {
      event_id: ctx.actor.event_id,
      created_by: ctx.actor.user_id, updated_by: ctx.actor.user_id,
      // The old final is retained and linked, never overwritten (§10, AT-027).
      original_revision_id: locked.id,
      replacement_revision_id: newRevision.id,
      reason: payload.reason,
      status: 'Requested',
      impact: {
        downstream_dependencies: dependencies.length,
        downstream_started: started.length,
        started_fixture_ids: started.map((d) => d.target_fixture_id),
      } as Prisma.InputJsonValue,
    },
  });

  // AT-017: a started downstream fixture is never silently re-seeded.
  let exceptionId: string | null = null;
  if (started.length > 0) {
    const exception = await ctx.tx.exceptionCase.create({
      data: {
        event_id: ctx.actor.event_id,
        created_by: ctx.actor.user_id, updated_by: ctx.actor.user_id,
        case_type: 'AmendmentAffectsStartedFixture',
        entity_type: 'Amendment',
        entity_id: amendment.id,
        // §13: every exception has a named owner. The amending ED owns it until reassigned.
        owner_id: ctx.actor.membership_id,
        priority: 'Urgent',
        status: 'Open',
        reason:
          `A locked result was amended after ${started.length} dependent fixture(s) had ` +
          `already started. Competitors are not replaced automatically; the Event Director ` +
          `must decide. Affected fixtures: ${started.map((d) => d.target_fixture_id).join(', ')}`,
      },
    });
    exceptionId = exception.id;
  }

  ctx.audit({
    action: 'amendLockedResult', entity_type: 'Amendment', entity_id: amendment.id,
    safe_diff: { original_revision_id: locked.id, replacement_revision_id: newRevision.id,
                 downstream_started: started.length },
    reason: payload.reason,
  });

  return {
    amendment_id: amendment.id, new_revision_id: newRevision.id,
    downstream_started: started.length, exception_case_id: exceptionId,
  };
}

/* ------------------------------------------------------------------ */

async function requireReviewableRevision(ctx: CommandContext, revisionId: string) {
  const revision = await ctx.tx.scorecardRevision.findFirst({
    where: { id: revisionId, event_id: ctx.actor.event_id },
    include: { scorecard: true },
  });
  if (!revision) throw validationFailed('Revision not found.');
  if (revision.status !== 'Submitted') throw invalidState(revision.status, 'review');

  assertAccess({
    actor: ctx.actor, action: 'scorecard.review',
    target: { event_id: ctx.actor.event_id, fixture_id: revision.scorecard.fixture_id },
  });
  return revision;
}
