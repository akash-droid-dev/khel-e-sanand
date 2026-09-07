/**
 * Shared acceptance scenarios AT-001 … AT-035.
 * Transcribed from Khelo_Sanand_Data_and_Functions.xlsx → Acceptance.
 *
 * These run the real command layer against a real PostgreSQL, so they exercise the
 * permission chain, optimistic concurrency, idempotency, audit and outbox together —
 * which is the only way several of these criteria can actually be checked.
 */
import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { randomUUID } from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import { runCommand } from '../core/command.js';
import { evaluateAccess } from '../core/access.js';
import { resolveActor, describeEffectiveAccess } from '../core/actor.js';
import { truncateAll } from '../test/truncate.js';
import { buildFixtures, actorFor, TODAY, HOURS, type Fixtures } from '../test/fixtures.js';
import { assignSchoolsToCH, assignVolunteerPool, assignFixtureDuty } from './m03-assignments.js';
import {
  saveScorecardDraft, submitScorecard, approveScorecard, returnForCorrection,
  lockScorecard, amendLockedResult,
} from './m09-scorecards.js';
import { selfCheckIn, submitOfflineAttendanceClaim, calculateAttendance } from './m07-attendance.js';
import { issueKitItem, acknowledgeKit, getKitStatus, receiveStock } from './m08-kits.js';

const prisma = new PrismaClient();
let F: Fixtures;

beforeAll(async () => { await truncateAll(prisma); });
beforeEach(async () => { await truncateAll(prisma); F = await buildFixtures(prisma); });

/** Run a command as a given user, resolving their live scope first. */
async function as<TPayload, TData>(
  userId: string, command: string, payload: TPayload,
  handler: Parameters<typeof runCommand<TPayload, TData>>[0]['handler'],
  idempotencyKey?: string,
) {
  const actor = await actorFor(prisma, userId, F.event_id);
  return runCommand<TPayload, TData>({
    prisma, actor, command, payload, handler,
    ...(idempotencyKey ? { idempotencyKey } : {}),
  });
}

/* ================================================================== *
 * M02 — access
 * ================================================================== */

describe('AT-003 — a CH cannot create a user through the API', () => {
  it('denies staff.create to a CH regardless of scope', async () => {
    const ch = await actorFor(prisma, F.ch1_user_id, F.event_id);
    const decision = evaluateAccess({ actor: ch, action: 'staff.create' });
    expect(decision.allowed).toBe(false);
    expect(decision.reason).toContain('Role CH may not perform staff.create');
  });
});

describe('AT-004 — an inactive membership is denied immediately', () => {
  it('refuses to resolve an actor whose membership was deactivated', async () => {
    await prisma.eventMembership.update({
      where: { id: F.ch1_membership_id }, data: { status: 'Inactive' },
    });
    // The session may still be valid; the membership check is what stops it.
    await expect(actorFor(prisma, F.ch1_user_id, F.event_id))
      .rejects.toThrow(/Event membership is not active/);
  });
});

/* ================================================================== *
 * M03 — assignments
 * ================================================================== */

describe('AT-006 — a CH cannot act outside their own pool', () => {
  it('denies volunteer-to-school assignment for a school the CH does not manage', async () => {
    const ch = await actorFor(prisma, F.ch1_user_id, F.event_id);
    const decision = evaluateAccess({
      actor: ch, action: 'assignment.volunteerToSchool',
      target: { event_id: F.event_id, school_id: F.school_ids[3]! },
    });
    expect(decision.allowed).toBe(false);
    expect(decision.reason).toContain('outside the actor’s assigned schools');
  });

  it('allows it once an explicit, expiring ED grant exists', async () => {
    await prisma.scopeGrant.create({
      data: {
        event_id: F.event_id, created_by: F.ed_user_id, updated_by: F.ed_user_id,
        membership_id: F.ch1_membership_id,
        action: 'assignment.volunteerToSchool',
        scope_type: 'School', scope_id: F.school_ids[3]!,
        expires_at: new Date(Date.now() + 3_600_000),
        reason: 'Covering for CH2 during the morning session',
        granted_by: F.ed_user_id,
      },
    });
    const ch = await actorFor(prisma, F.ch1_user_id, F.event_id);
    const decision = evaluateAccess({
      actor: ch, action: 'assignment.volunteerToSchool',
      target: { event_id: F.event_id, school_id: F.school_ids[3]! },
    });
    expect(decision.allowed).toBe(true);
    expect(decision.via_grant_id).toBeDefined();
    expect(decision.reason).toContain('Covering for CH2');
  });

  it('refuses an expired grant', async () => {
    await prisma.scopeGrant.create({
      data: {
        event_id: F.event_id, created_by: F.ed_user_id, updated_by: F.ed_user_id,
        membership_id: F.ch1_membership_id, action: 'assignment.volunteerToSchool',
        scope_type: 'School', scope_id: F.school_ids[3]!,
        expires_at: new Date(Date.now() - 1_000),
        reason: 'Yesterday’s cover', granted_by: F.ed_user_id,
      },
    });
    const ch = await actorFor(prisma, F.ch1_user_id, F.event_id);
    // An expired grant is not loaded at all — it cannot widen anything.
    expect(ch.grants).toHaveLength(0);
    expect(evaluateAccess({
      actor: ch, action: 'assignment.volunteerToSchool',
      target: { event_id: F.event_id, school_id: F.school_ids[3]! },
    }).allowed).toBe(false);
  });
});

describe('AT-007 — concurrent pool transfers', () => {
  it('leaves at most one active default pool', async () => {
    await as(F.ed_user_id, 'assignVolunteerPool', {
      volunteer_membership_id: F.vol1_membership_id, cluster_id: F.cluster_a_id,
      ch_membership_id: F.ch1_membership_id, effective_from: new Date().toISOString(),
    }, (ctx, p) => assignVolunteerPool(ctx, p as never).then((data) => ({ data })));

    // Two transfers racing to cluster B.
    const transfer = () => as(F.ed_user_id, 'assignVolunteerPool', {
      volunteer_membership_id: F.vol1_membership_id, cluster_id: F.cluster_b_id,
      ch_membership_id: F.ch2_membership_id, effective_from: new Date().toISOString(),
    }, (ctx, p) => assignVolunteerPool(ctx, p as never).then((data) => ({ data })));

    const results = await Promise.allSettled([transfer(), transfer()]);
    const active = await prisma.volunteerPoolAssignment.count({
      where: { volunteer_membership_id: F.vol1_membership_id, effective_to: null },
    });
    expect(active).toBe(1);                                   // the invariant
    expect(results.some((r) => r.status === 'fulfilled')).toBe(true);
  });
});

describe('AT-008 — replacing a live scorer', () => {
  it('revokes the former scorer’s write access and preserves their draft authorship', async () => {
    const window = {
      starts_at: HOURS(-1).toISOString(),
      ends_at: HOURS(6).toISOString(),
    };
    await as(F.ed_user_id, 'assignFixtureDuty', {
      fixture_id: F.fixture_id, membership_id: F.vol1_membership_id,
      duty_role: 'PrimaryScorer', ...window,
    }, (ctx, p) => assignFixtureDuty(ctx, p as never).then((data) => ({ data })));

    // VOL1 drafts a scorecard.
    const draft = await as(F.vol1_user_id, 'saveScorecardDraft', {
      fixture_id: F.fixture_id,
      raw_payload: { note: 'lane 1 in progress' }, calculated_result: { issues: [], unresolved: [] },
    }, (ctx, p) => saveScorecardDraft(ctx, p as never).then((data) => ({ data })));
    const revisionId = (draft.data as { revision_id: string }).revision_id;

    // ED replaces the scorer.
    const replacement = await as(F.ed_user_id, 'assignFixtureDuty', {
      fixture_id: F.fixture_id, membership_id: F.vol2_membership_id,
      duty_role: 'PrimaryScorer', ...window, reason: 'VOL1 reassigned to another venue',
    }, (ctx, p) => assignFixtureDuty(ctx, p as never).then((data) => ({ data })));
    expect((replacement.data as { replaced_assignment_id: string | null })
      .replaced_assignment_id).not.toBeNull();

    // VOL1's next save is refused…
    const vol1 = await actorFor(prisma, F.vol1_user_id, F.event_id);
    expect(vol1.fixture_duties).toHaveLength(0);
    await expect(as(F.vol1_user_id, 'saveScorecardDraft', {
      fixture_id: F.fixture_id, revision_id: revisionId, expected_version: 1,
      raw_payload: { note: 'sneaky edit' }, calculated_result: {},
    }, (ctx, p) => saveScorecardDraft(ctx, p as never).then((data) => ({ data }))))
      .rejects.toThrow(/Not permitted/);

    // …but the draft, and its authorship, remain.
    const kept = await prisma.scorecardRevision.findUnique({ where: { id: revisionId } });
    expect(kept).not.toBeNull();
    expect(kept!.created_by).toBe(F.vol1_user_id);
    expect(kept!.raw_payload).toEqual({ note: 'lane 1 in progress' });
  });
});

/* ================================================================== *
 * M09 — scorecards
 * ================================================================== */

async function withScorer(): Promise<string> {
  await as(F.ed_user_id, 'assignFixtureDuty', {
    fixture_id: F.fixture_id, membership_id: F.vol1_membership_id, duty_role: 'PrimaryScorer',
    starts_at: HOURS(-1).toISOString(),
    ends_at: HOURS(6).toISOString(),
  }, (ctx, p) => assignFixtureDuty(ctx, p as never).then((data) => ({ data })));
  await as(F.ed_user_id, 'assignFixtureDuty', {
    fixture_id: F.fixture_id, membership_id: F.ch1_membership_id, duty_role: 'Reviewer',
    starts_at: HOURS(-1).toISOString(),
    ends_at: HOURS(8).toISOString(),
  }, (ctx, p) => assignFixtureDuty(ctx, p as never).then((data) => ({ data })));

  const draft = await as(F.vol1_user_id, 'saveScorecardDraft', {
    fixture_id: F.fixture_id,
    raw_payload: { lane1: '5.21' },
    calculated_result: { issues: [], unresolved: [], participants: [] },
  }, (ctx, p) => saveScorecardDraft(ctx, p as never).then((data) => ({ data })));
  return (draft.data as { revision_id: string }).revision_id;
}

describe('AT-024 — a stale save cannot touch a submitted result', () => {
  it('rejects the late save and leaves the submission intact', async () => {
    const revisionId = await withScorer();

    await as(F.vol1_user_id, 'submitScorecard', {
      revision_id: revisionId, expected_version: 1, attestation: 'Values match the official sheet',
    }, (ctx, p) => submitScorecard(ctx, p as never).then((data) => ({ data })));

    // A second device still holds version 1 and tries to save.
    await expect(as(F.vol1_user_id, 'saveScorecardDraft', {
      fixture_id: F.fixture_id, revision_id: revisionId, expected_version: 1,
      raw_payload: { lane1: '9.99' }, calculated_result: {},
    }, (ctx, p) => saveScorecardDraft(ctx, p as never).then((data) => ({ data }))))
      .rejects.toThrow(/Cannot save a draft from state Submitted/);

    const after = await prisma.scorecardRevision.findUnique({ where: { id: revisionId } });
    expect(after!.status).toBe('Submitted');
    expect(after!.raw_payload).toEqual({ lane1: '5.21' });   // untouched
  });
});

describe('AT-025 — approving an exact revision', () => {
  it('rejects approval carrying a stale checksum', async () => {
    const revisionId = await withScorer();
    await as(F.vol1_user_id, 'submitScorecard', {
      revision_id: revisionId, expected_version: 1, attestation: 'ok',
    }, (ctx, p) => submitScorecard(ctx, p as never).then((data) => ({ data })));

    await expect(as(F.ch1_user_id, 'approveScorecard', {
      revision_id: revisionId, expected_version: 2,
      reviewed_checksum: 'a-checksum-from-an-older-read',
    }, (ctx, p) => approveScorecard(ctx, p as never).then((data) => ({ data }))))
      .rejects.toThrow(/changed since you loaded it/);

    const after = await prisma.scorecardRevision.findUnique({ where: { id: revisionId } });
    expect(after!.status).toBe('Submitted');   // not approved
  });

  it('approves when the checksum matches what the reviewer read', async () => {
    const revisionId = await withScorer();
    await as(F.vol1_user_id, 'submitScorecard', {
      revision_id: revisionId, expected_version: 1, attestation: 'ok',
    }, (ctx, p) => submitScorecard(ctx, p as never).then((data) => ({ data })));

    const read = await prisma.scorecardRevision.findUnique({ where: { id: revisionId } });
    const result = await as(F.ch1_user_id, 'approveScorecard', {
      revision_id: revisionId, expected_version: 2, reviewed_checksum: read!.checksum,
    }, (ctx, p) => approveScorecard(ctx, p as never).then((data) => ({ data })));

    expect((result.data as { status: string }).status).toBe('Approved');
  });
});

describe('§10 — no self-review by default', () => {
  it('refuses to let the submitter approve their own scorecard', async () => {
    // A VOL can never review at all (permission matrix: "Return/approve/lock — VOL: No"),
    // so the self-review rule only bites for a CH who is BOTH the assigned scorer and
    // the accountable reviewer — which is exactly the situation §10 is guarding.
    const window = { starts_at: HOURS(-1).toISOString(), ends_at: HOURS(8).toISOString() };
    await as(F.ed_user_id, 'assignFixtureDuty', {
      fixture_id: F.fixture_id, membership_id: F.ch1_membership_id,
      duty_role: 'PrimaryScorer', ...window,
    }, (ctx, p) => assignFixtureDuty(ctx, p as never).then((data) => ({ data })));
    await as(F.ed_user_id, 'assignFixtureDuty', {
      fixture_id: F.fixture_id, membership_id: F.ch1_membership_id,
      duty_role: 'Reviewer', ...window,
    }, (ctx, p) => assignFixtureDuty(ctx, p as never).then((data) => ({ data })));

    const draft = await as(F.ch1_user_id, 'saveScorecardDraft', {
      fixture_id: F.fixture_id, raw_payload: { lane1: '5.21' },
      calculated_result: { issues: [], unresolved: [] },
    }, (ctx, p) => saveScorecardDraft(ctx, p as never).then((data) => ({ data })));
    const revisionId = (draft.data as { revision_id: string }).revision_id;

    await as(F.ch1_user_id, 'submitScorecard', {
      revision_id: revisionId, expected_version: 1, attestation: 'ok',
    }, (ctx, p) => submitScorecard(ctx, p as never).then((data) => ({ data })));

    const read = await prisma.scorecardRevision.findUnique({ where: { id: revisionId } });
    await expect(as(F.ch1_user_id, 'approveScorecard', {
      revision_id: revisionId, expected_version: 2, reviewed_checksum: read!.checksum,
    }, (ctx, p) => approveScorecard(ctx, p as never).then((data) => ({ data }))))
      .rejects.toThrow(/approve a scorecard you submitted yourself/);

    // §10 permits an ED override, but only with a recorded reason and a visible flag.
    const approved = await as(F.ch1_user_id, 'approveScorecard', {
      revision_id: revisionId, expected_version: 2, reviewed_checksum: read!.checksum,
      self_review_override_reason: 'Sole official present; ED authorised by phone',
    }, (ctx, p) => approveScorecard(ctx, p as never).then((data) => ({ data })));
    expect((approved.data as { self_review_flagged: boolean }).self_review_flagged).toBe(true);

    const audit = await prisma.auditEvent.findFirst({ where: { action: 'approveScorecard' } });
    expect(audit!.reason).toContain('ED authorised by phone');
    expect((audit!.safe_diff as { self_review: boolean }).self_review).toBe(true);
  });

  it('denies review to a volunteer regardless of duties held', async () => {
    const window = { starts_at: HOURS(-1).toISOString(), ends_at: HOURS(8).toISOString() };
    await as(F.ed_user_id, 'assignFixtureDuty', {
      fixture_id: F.fixture_id, membership_id: F.vol1_membership_id,
      duty_role: 'Reviewer', ...window,
    }, (ctx, p) => assignFixtureDuty(ctx, p as never).then((data) => ({ data })));

    const vol = await actorFor(prisma, F.vol1_user_id, F.event_id);
    const decision = evaluateAccess({
      actor: vol, action: 'scorecard.review',
      target: { event_id: F.event_id, fixture_id: F.fixture_id },
    });
    expect(decision.allowed).toBe(false);
    expect(decision.reason).toContain('Role VOL may not perform scorecard.review');
  });
});

describe('AT-026 — returning a scorecard', () => {
  it('requires comments and links them to the exact revision', async () => {
    const revisionId = await withScorer();
    await as(F.vol1_user_id, 'submitScorecard', {
      revision_id: revisionId, expected_version: 1, attestation: 'ok',
    }, (ctx, p) => submitScorecard(ctx, p as never).then((data) => ({ data })));

    await expect(as(F.ch1_user_id, 'returnForCorrection', {
      revision_id: revisionId, expected_version: 2, comments: '   ',
    }, (ctx, p) => returnForCorrection(ctx, p as never).then((data) => ({ data }))))
      .rejects.toThrow(/Comments are required/);

    await as(F.ch1_user_id, 'returnForCorrection', {
      revision_id: revisionId, expected_version: 2,
      comments: 'Lane 3 time is missing', fields: ['lane3'],
    }, (ctx, p) => returnForCorrection(ctx, p as never).then((data) => ({ data })));

    const actions = await prisma.reviewAction.findMany({
      where: { revision_id: revisionId }, orderBy: { created_at: 'asc' },
    });
    expect(actions.map((a) => a.action)).toEqual(['Submit', 'Return']);
    expect(actions[1]!.comment).toBe('Lane 3 time is missing');

    const revision = await prisma.scorecardRevision.findUnique({ where: { id: revisionId } });
    expect(revision!.status).toBe('Returned');
  });
});

describe('AT-027 — amending a locked result', () => {
  it('retains the old final, links the replacement, and reviews downstream impact', async () => {
    const revisionId = await withScorer();
    await as(F.vol1_user_id, 'submitScorecard', {
      revision_id: revisionId, expected_version: 1, attestation: 'ok',
    }, (ctx, p) => submitScorecard(ctx, p as never).then((data) => ({ data })));
    const read = await prisma.scorecardRevision.findUnique({ where: { id: revisionId } });
    await as(F.ch1_user_id, 'approveScorecard', {
      revision_id: revisionId, expected_version: 2, reviewed_checksum: read!.checksum,
    }, (ctx, p) => approveScorecard(ctx, p as never).then((data) => ({ data })));

    await as(F.ch1_user_id, 'lockScorecard', {
      revision_id: revisionId, expected_version: 3,
      snapshots: [{ participant_id: F.participant_id, status: 'Completed', rank: 1,
                    primary_value: '5.21', unit: 's',
                    identity_snapshot: { display_name: 'Athlete 1', school: 'Demo School 1' } }],
    }, (ctx, p) => lockScorecard(ctx, p as never).then((data) => ({ data })));

    const amendment = await as(F.ed_user_id, 'amendLockedResult', {
      locked_revision_id: revisionId,
      reason: 'Timing device reread: lane 1 was 5.19 s',
      raw_payload: { lane1: '5.19' }, calculated_result: { issues: [], unresolved: [] },
    }, (ctx, p) => amendLockedResult(ctx, p as never).then((data) => ({ data })));

    const data = amendment.data as { amendment_id: string; new_revision_id: string };
    const old = await prisma.scorecardRevision.findUnique({ where: { id: revisionId } });
    expect(old!.status).toBe('Locked');                    // the old final is retained
    expect(old!.raw_payload).toEqual({ lane1: '5.21' });

    const record = await prisma.amendment.findUnique({ where: { id: data.amendment_id } });
    expect(record!.original_revision_id).toBe(revisionId);  // and linked
    expect(record!.replacement_revision_id).toBe(data.new_revision_id);

    // The original locked snapshot survives the amendment.
    const snapshots = await prisma.resultSnapshot.findMany({ where: { revision_id: revisionId } });
    expect(snapshots).toHaveLength(1);
    expect(snapshots[0]!.rank).toBe(1);
  });
});

/* ================================================================== *
 * M07 — attendance
 * ================================================================== */

async function makeDuty(volunteerMembershipId: string, clusterId: string) {
  const session = await prisma.dutySession.create({
    data: {
      event_id: F.event_id, created_by: F.ed_user_id, updated_by: F.ed_user_id,
      session_code: `D-${randomUUID().slice(0, 6)}`, local_date: TODAY,
      mode: 'Daily',
      starts_at: HOURS(-1),
      ends_at: HOURS(8),
      status: 'Open',
    },
  });
  const duty = await prisma.expectedDuty.create({
    data: {
      event_id: F.event_id, created_by: F.ed_user_id, updated_by: F.ed_user_id,
      session_id: session.id, volunteer_id: volunteerMembershipId,
      expectation: 'Expected', snapshot_cluster_id: clusterId,
    },
  });
  return { session, duty };
}

describe('AT-018 — a double tap creates one attendance record', () => {
  it('returns the existing check-in on the second call', async () => {
    const { session } = await makeDuty(F.vol1_membership_id, F.cluster_a_id);

    const first = await as(F.vol1_user_id, 'selfCheckIn', { session_id: session.id },
      (ctx, p) => selfCheckIn(ctx, p as never).then((data) => ({ data })));
    const second = await as(F.vol1_user_id, 'selfCheckIn', { session_id: session.id },
      (ctx, p) => selfCheckIn(ctx, p as never).then((data) => ({ data })));

    const a = first.data as { attendance_id: string; already_checked_in: boolean };
    const b = second.data as { attendance_id: string; already_checked_in: boolean };
    expect(b.attendance_id).toBe(a.attendance_id);
    expect(a.already_checked_in).toBe(false);
    expect(b.already_checked_in).toBe(true);
    expect(await prisma.attendance.count()).toBe(1);
  });

  it('refuses a check-in from a volunteer with no expected duty (§8)', async () => {
    const { session } = await makeDuty(F.vol1_membership_id, F.cluster_a_id);
    // VOL2 is not scheduled — and is therefore NOT absent either.
    await expect(as(F.vol2_user_id, 'selfCheckIn', { session_id: session.id },
      (ctx, p) => selfCheckIn(ctx, p as never).then((data) => ({ data }))))
      .rejects.toThrow(/not scheduled for/);
    expect(await prisma.attendance.count()).toBe(0);
  });
});

describe('AT-019 — an offline claim stays identifiable as a claim', () => {
  it('records the client time and the server receipt separately, as PendingReview', async () => {
    const { session } = await makeDuty(F.vol1_membership_id, F.cluster_a_id);
    const claimed = HOURS(-0.5).toISOString();

    const result = await as(F.vol1_user_id, 'submitOfflineAttendanceClaim',
      { session_id: session.id, claimed_client_at: claimed },
      (ctx, p) => submitOfflineAttendanceClaim(ctx, p as never).then((data) => ({ data })));

    const data = result.data as { status: string };
    expect(data.status).toBe('PendingReview');       // never Present

    const row = await prisma.attendance.findFirst();
    expect(row!.claimed_client_at?.toISOString()).toBe(new Date(claimed).toISOString());
    expect(row!.check_in_at).toBeNull();             // a claim is not a check-in
    expect(row!.received_at).not.toBeNull();
    expect(row!.source).toBe('OfflineClaim');
  });
});

describe('AT-020 — a zero denominator is N/A', () => {
  it('does not report 0% or 100% when nobody was expected', async () => {
    const rate = await as(F.ed_user_id, 'calculateAttendance',
      { from: TODAY.toISOString(), to: TODAY.toISOString() },
      (ctx, p) => calculateAttendance(ctx, p as never).then((data) => ({ data })));

    const data = rate.data as { rate: number | null; display: string; denominator: number };
    expect(data.denominator).toBe(0);
    expect(data.rate).toBeNull();
    expect(data.display).toBe('N/A');
  });

  it('reports a real rate once duties exist, excluding pending claims from the numerator', async () => {
    const { session } = await makeDuty(F.vol1_membership_id, F.cluster_a_id);
    await prisma.expectedDuty.create({
      data: {
        event_id: F.event_id, created_by: F.ed_user_id, updated_by: F.ed_user_id,
        session_id: session.id, volunteer_id: F.vol2_membership_id,
        expectation: 'Expected', snapshot_cluster_id: F.cluster_a_id,
      },
    });
    await as(F.vol1_user_id, 'selfCheckIn', { session_id: session.id },
      (ctx, p) => selfCheckIn(ctx, p as never).then((data) => ({ data })));
    await as(F.vol2_user_id, 'submitOfflineAttendanceClaim',
      { session_id: session.id, claimed_client_at: HOURS(-0.5).toISOString() },
      (ctx, p) => submitOfflineAttendanceClaim(ctx, p as never).then((data) => ({ data })));

    const rate = await as(F.ed_user_id, 'calculateAttendance',
      { from: TODAY.toISOString(), to: TODAY.toISOString() },
      (ctx, p) => calculateAttendance(ctx, p as never).then((data) => ({ data })));
    const data = rate.data as {
      numerator: number; denominator: number; pending_claims: number; mode: string;
    };
    expect(data.denominator).toBe(2);
    expect(data.numerator).toBe(1);        // the claim is not confirmed attendance
    expect(data.pending_claims).toBe(1);
    expect(data.mode).toBe('Daily');
  });
});

/* ================================================================== *
 * M08 — kits
 * ================================================================== */

async function entitle(
  volunteerMembershipId: string, requiredQty: number, variant = 'M', isRequired = true,
) {
  return prisma.kitEntitlement.create({
    data: {
      event_id: F.event_id, created_by: F.ed_user_id, updated_by: F.ed_user_id,
      volunteer_id: volunteerMembershipId, item_id: F.kit_item_id,
      variant, required_quantity: requiredQty, entitlement_version: 1,
      is_required: isRequired,
    },
  });
}

describe('AT-021 — two users issuing the final item', () => {
  it('lets only one succeed', async () => {
    const e1 = await entitle(F.vol1_membership_id, 1);
    const e2 = await entitle(F.vol2_membership_id, 1);
    await as(F.ed_user_id, 'receiveStock', {
      location_id: F.stock_location_id, item_id: F.kit_item_id, variant: 'M',
      quantity: 1, reason: 'Opening stock',
    }, (ctx, p) => receiveStock(ctx, p as never).then((data) => ({ data })));

    const issue = (entitlementId: string) => as(F.ed_user_id, 'issueKitItem', {
      entitlement_id: entitlementId, quantity: 1,
      stock_location_id: F.stock_location_id, idempotency_key: randomUUID(),
    }, (ctx, p) => issueKitItem(ctx, p as never).then((data) => ({ data })));

    const results = await Promise.allSettled([issue(e1.id), issue(e2.id)]);
    const succeeded = results.filter((r) => r.status === 'fulfilled').length;
    expect(succeeded).toBe(1);

    const balance = await prisma.stockMovement.aggregate({
      where: { item_id: F.kit_item_id, variant: 'M' }, _sum: { quantity_delta: true },
    });
    expect(balance._sum.quantity_delta).toBe(0);   // never negative
  });
});

describe('AT-022 — retrying the same issue', () => {
  it('does not decrement stock twice', async () => {
    const e = await entitle(F.vol1_membership_id, 2);
    await as(F.ed_user_id, 'receiveStock', {
      location_id: F.stock_location_id, item_id: F.kit_item_id, variant: 'M',
      quantity: 5, reason: 'Opening stock',
    }, (ctx, p) => receiveStock(ctx, p as never).then((data) => ({ data })));

    const key = randomUUID();
    const payload = {
      entitlement_id: e.id, quantity: 1,
      stock_location_id: F.stock_location_id, idempotency_key: key,
    };
    const first = await as(F.ed_user_id, 'issueKitItem', payload,
      (ctx, p) => issueKitItem(ctx, p as never).then((data) => ({ data })), key);
    const retry = await as(F.ed_user_id, 'issueKitItem', payload,
      (ctx, p) => issueKitItem(ctx, p as never).then((data) => ({ data })), key);

    expect(retry.replayed).toBe(true);
    expect((retry.data as { issue_id: string }).issue_id)
      .toBe((first.data as { issue_id: string }).issue_id);
    expect(await prisma.kitIssue.count()).toBe(1);

    const balance = await prisma.stockMovement.aggregate({
      where: { item_id: F.kit_item_id, variant: 'M' }, _sum: { quantity_delta: true },
    });
    expect(balance._sum.quantity_delta).toBe(4);  // 5 received, exactly 1 issued
  });

  it('rejects the same key carrying a different payload', async () => {
    const e = await entitle(F.vol1_membership_id, 2);
    const key = randomUUID();
    await as(F.ed_user_id, 'issueKitItem',
      { entitlement_id: e.id, quantity: 1, idempotency_key: key },
      (ctx, p) => issueKitItem(ctx, p as never).then((data) => ({ data })), key);

    await expect(as(F.ed_user_id, 'issueKitItem',
      { entitlement_id: e.id, quantity: 2, idempotency_key: key },
      (ctx, p) => issueKitItem(ctx, p as never).then((data) => ({ data })), key))
      .rejects.toThrow(/already used with a different payload/);
  });
});

describe('AT-023 — an optional unissued item', () => {
  it('does not make a fulfilled required kit Partial', async () => {
    const required = await entitle(F.vol1_membership_id, 1, 'M');
    // An optional cap, with a real quantity — optionality is a flag, not a zero.
    await entitle(F.vol1_membership_id, 1, 'CAP', false);

    await as(F.ed_user_id, 'issueKitItem',
      { entitlement_id: required.id, quantity: 1, idempotency_key: randomUUID() },
      (ctx, p) => issueKitItem(ctx, p as never).then((data) => ({ data })));

    const status = await as(F.ed_user_id, 'getKitStatus',
      { volunteer_ids: [F.vol1_membership_id] },
      (ctx, p) => getKitStatus(ctx, p as never).then((data) => ({ data })));

    const row = (status.data as { fulfilment: string; optional_items: number;
                                 optional_fulfilled: number }[])[0]!;
    expect(row.fulfilment).toBe('Issued');      // not Partial
    expect(row.optional_items).toBe(1);
    expect(row.optional_fulfilled).toBe(0);
  });

  it('reports Partial only when a REQUIRED entitlement is outstanding', async () => {
    const a = await entitle(F.vol1_membership_id, 1, 'M');
    await entitle(F.vol1_membership_id, 1, 'L');
    await as(F.ed_user_id, 'issueKitItem',
      { entitlement_id: a.id, quantity: 1, idempotency_key: randomUUID() },
      (ctx, p) => issueKitItem(ctx, p as never).then((data) => ({ data })));

    const status = await as(F.ed_user_id, 'getKitStatus',
      { volunteer_ids: [F.vol1_membership_id] },
      (ctx, p) => getKitStatus(ctx, p as never).then((data) => ({ data })));
    expect((status.data as { fulfilment: string }[])[0]!.fulfilment).toBe('Partial');
  });

  it('tracks acknowledgement separately from issue', async () => {
    const e = await entitle(F.vol1_membership_id, 1);
    const issued = await as(F.ed_user_id, 'issueKitItem',
      { entitlement_id: e.id, quantity: 1, idempotency_key: randomUUID() },
      (ctx, p) => issueKitItem(ctx, p as never).then((data) => ({ data })));

    let status = await as(F.ed_user_id, 'getKitStatus', { volunteer_ids: [F.vol1_membership_id] },
      (ctx, p) => getKitStatus(ctx, p as never).then((data) => ({ data })));
    expect((status.data as { acknowledged_issues: number }[])[0]!.acknowledged_issues).toBe(0);

    await as(F.vol1_user_id, 'acknowledgeKit',
      { issue_id: (issued.data as { issue_id: string }).issue_id },
      (ctx, p) => acknowledgeKit(ctx, p as never).then((data) => ({ data })));

    status = await as(F.ed_user_id, 'getKitStatus', { volunteer_ids: [F.vol1_membership_id] },
      (ctx, p) => getKitStatus(ctx, p as never).then((data) => ({ data })));
    expect((status.data as { acknowledged_issues: number }[])[0]!.acknowledged_issues).toBe(1);
  });
});

/* ================================================================== *
 * M12 — audit and the outbox
 * ================================================================== */

describe('AT-028 — a delivery failure never hides a saved result', () => {
  it('commits the submission and queues the alert in the same transaction', async () => {
    const revisionId = await withScorer();
    await as(F.vol1_user_id, 'submitScorecard', {
      revision_id: revisionId, expected_version: 1, attestation: 'ok',
    }, (ctx, p) => submitScorecard(ctx, p as never).then((data) => ({ data })));

    // The state change is in the database, readable by the review queue directly.
    const revision = await prisma.scorecardRevision.findUnique({ where: { id: revisionId } });
    expect(revision!.status).toBe('Submitted');

    // The alert is queued, unprocessed, and deduplicated by design.
    const outbox = await prisma.outboxMessage.findMany({ where: { topic: 'ScorecardSubmitted' } });
    expect(outbox).toHaveLength(1);
    expect(outbox[0]!.processed_at).toBeNull();
    expect(outbox[0]!.attempts).toBe(0);
  });
});

describe('§13 — every change is traceable to a request and an actor', () => {
  it('writes an audit event carrying the request id and effective role', async () => {
    await as(F.ed_user_id, 'assignSchoolsToCH', {
      ch_membership_id: F.ch1_membership_id, cluster_id: F.cluster_a_id,
      event_school_ids: [F.school_ids[0]!], effective_from: new Date().toISOString(),
      reason: 'Initial deployment',
    }, (ctx, p) => assignSchoolsToCH(ctx, p as never).then((data) => ({ data })));

    const events = await prisma.auditEvent.findMany({ where: { action: 'assignSchoolsToCH' } });
    expect(events).toHaveLength(1);
    expect(events[0]!.effective_role).toBe('ED');
    expect(events[0]!.actor_id).toBe(F.ed_user_id);
    expect(events[0]!.request_id).toBeTruthy();
    expect(events[0]!.reason).toBe('Initial deployment');
  });
});

describe('§3 — previewEffectiveAccess explains where scope comes from', () => {
  it('names the assignments and grants that produced access', async () => {
    await as(F.ed_user_id, 'assignSchoolsToCH', {
      ch_membership_id: F.ch1_membership_id, cluster_id: F.cluster_a_id,
      event_school_ids: [F.school_ids[0]!, F.school_ids[1]!],
      effective_from: new Date().toISOString(),
    }, (ctx, p) => assignSchoolsToCH(ctx, p as never).then((data) => ({ data })));

    const ch = await actorFor(prisma, F.ch1_user_id, F.event_id);
    const preview = describeEffectiveAccess(ch);
    expect(preview.school_count).toBe(2);
    expect(preview.role).toBe('CH');
    expect(preview.derivation.join(' ')).toContain('live assignment intervals');
    expect(preview.fixture_duty_count).toBe(0);
    expect(preview.derivation.join(' ')).toContain('no scoring access by default');
  });
});
