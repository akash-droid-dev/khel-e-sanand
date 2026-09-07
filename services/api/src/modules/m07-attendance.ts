/**
 * M07 — Volunteer attendance and duty confirmation. §8.
 *
 * The specification is unusually precise about what attendance is NOT:
 *   - AT-018: "Check-in double tap → One attendance record."
 *   - AT-019: an offline claim keeps the client's claimed time and the server's
 *     receipt time as separate facts. The claim is evidence, not attendance.
 *   - AT-020: a zero expected-duty denominator displays N/A, never 0% or 100%.
 *   - §8: "An unscheduled volunteer is not automatically absent", and
 *     "Missing checkout is incomplete, not zero hours."
 *
 * Each of those is a case where the naive implementation produces a plausible
 * number that is wrong, which is exactly the failure mode the spec is guarding.
 */
import type { Prisma } from '@prisma/client';
import { validationFailed, invalidState, outOfScope } from '@khel/contracts';
import type { CommandContext } from '../core/command.js';
import { assertAccess } from '../core/access.js';

/* ------------------------------------------------------------------ *
 * selfCheckIn
 * ------------------------------------------------------------------ */

export interface SelfCheckInPayload {
  session_id: string;
  /** Optional client-observed instant, kept separate from the server receipt. */
  client_time?: string | null;
}

export async function selfCheckIn(
  ctx: CommandContext, payload: SelfCheckInPayload,
): Promise<{ attendance_id: string; status: string; received_at: string; already_checked_in: boolean }> {
  assertAccess({
    actor: ctx.actor, action: 'attendance.selfMark',
    target: { event_id: ctx.actor.event_id, owner_membership_id: ctx.actor.membership_id },
  });

  const session = await ctx.tx.dutySession.findFirst({
    where: { id: payload.session_id, event_id: ctx.actor.event_id },
  });
  if (!session) throw validationFailed('Duty session not found.');
  if (session.status !== 'Open') throw invalidState(session.status, 'check in');

  // §8: "Validate expected/allowed duty." An unscheduled volunteer has nothing to
  // check in against — and is NOT thereby absent; they simply have no duty.
  const duty = await ctx.tx.expectedDuty.findUnique({
    where: {
      session_id_volunteer_id: {
        session_id: payload.session_id, volunteer_id: ctx.actor.membership_id,
      },
    },
  });
  if (!duty) {
    throw outOfScope('check in to a duty session you are not scheduled for');
  }
  if (duty.expectation !== 'Expected') {
    throw invalidState(duty.expectation, 'check in');
  }

  // AT-018: repeated taps return the existing record rather than creating a second.
  // The unique index on expected_duty_id makes this true even under a race.
  const existing = await ctx.tx.attendance.findUnique({
    where: { expected_duty_id: duty.id },
  });
  if (existing) {
    return {
      attendance_id: existing.id,
      status: existing.status,
      received_at: existing.received_at.toISOString(),
      already_checked_in: true,
    };
  }

  const now = new Date();
  // Late is a status derived from the session window, not a separate action.
  const status = now > session.starts_at ? 'Late' : 'Present';

  const created = await ctx.tx.attendance.create({
    data: {
      event_id: ctx.actor.event_id,
      created_by: ctx.actor.user_id, updated_by: ctx.actor.user_id,
      expected_duty_id: duty.id,
      check_in_at: now,
      claimed_client_at: payload.client_time ? new Date(payload.client_time) : null,
      received_at: now,
      status,
      source: 'Self',
    },
  });

  ctx.audit({
    action: 'selfCheckIn', entity_type: 'Attendance', entity_id: created.id,
    safe_diff: { session_id: payload.session_id, status, source: 'Self' },
  });

  return { attendance_id: created.id, status, received_at: now.toISOString(),
           already_checked_in: false };
}

/* ------------------------------------------------------------------ *
 * submitOfflineAttendanceClaim
 * ------------------------------------------------------------------ */

/**
 * AT-019 / §8: "preserve client claim and server receipt separately. CH reviews
 * backdated/out-of-window claims."
 *
 * The claim lands as PendingReview — never as Present. A device clock is not
 * evidence of presence, and §8 says as much of QR codes too.
 */
export async function submitOfflineAttendanceClaim(
  ctx: CommandContext,
  payload: { session_id: string; claimed_client_at: string },
): Promise<{ attendance_id: string; status: string; claimed_client_at: string; received_at: string }> {
  assertAccess({
    actor: ctx.actor, action: 'attendance.selfMark',
    target: { event_id: ctx.actor.event_id, owner_membership_id: ctx.actor.membership_id },
  });

  const duty = await ctx.tx.expectedDuty.findFirst({
    where: { session_id: payload.session_id, volunteer_id: ctx.actor.membership_id,
             event_id: ctx.actor.event_id },
  });
  if (!duty) throw outOfScope('claim attendance for a duty you are not scheduled for');

  const claimed = new Date(payload.claimed_client_at);
  if (Number.isNaN(claimed.getTime())) {
    throw validationFailed('claimed_client_at is not a valid instant.');
  }

  const existing = await ctx.tx.attendance.findUnique({ where: { expected_duty_id: duty.id } });
  if (existing) {
    return { attendance_id: existing.id, status: existing.status,
             claimed_client_at: existing.claimed_client_at?.toISOString() ?? '',
             received_at: existing.received_at.toISOString() };
  }

  const now = new Date();
  const created = await ctx.tx.attendance.create({
    data: {
      event_id: ctx.actor.event_id,
      created_by: ctx.actor.user_id, updated_by: ctx.actor.user_id,
      expected_duty_id: duty.id,
      // The claimed instant is retained as the volunteer stated it…
      claimed_client_at: claimed,
      // …and the server's own receipt is recorded independently.
      received_at: now,
      check_in_at: null,
      status: 'PendingReview',
      source: 'OfflineClaim',
    },
  });

  ctx.audit({
    action: 'submitOfflineAttendanceClaim', entity_type: 'Attendance', entity_id: created.id,
    safe_diff: { claimed_client_at: claimed.toISOString(), received_at: now.toISOString(),
                 status: 'PendingReview' },
  });

  return { attendance_id: created.id, status: 'PendingReview',
           claimed_client_at: claimed.toISOString(), received_at: now.toISOString() };
}

/* ------------------------------------------------------------------ *
 * correctAttendance
 * ------------------------------------------------------------------ */

/**
 * §8: "Preserve correction history. CH cannot reverse an ED final override without
 * explicit policy." The correction row is the history; the attendance row is only
 * the current value.
 */
export async function correctAttendance(
  ctx: CommandContext,
  payload: {
    attendance_id: string; expected_version: number;
    status: 'Present' | 'Late' | 'Absent' | 'Excused'; reason: string;
    final_override?: boolean;
  },
): Promise<{ attendance_id: string; status: string; version: number }> {
  if (!payload.reason?.trim()) {
    throw validationFailed('A correction requires a reason.', [
      { field: 'reason', message: 'Manual attendance changes must be explained (§8).' },
    ]);
  }

  const attendance = await ctx.tx.attendance.findFirst({
    where: { id: payload.attendance_id, event_id: ctx.actor.event_id },
    include: { expected_duty: true },
  });
  if (!attendance) throw validationFailed('Attendance record not found.');

  assertAccess({
    actor: ctx.actor, action: 'attendance.correct',
    target: { event_id: ctx.actor.event_id,
              cluster_id: attendance.expected_duty.snapshot_cluster_id },
  });

  // §8: a CH cannot reverse an ED final override.
  if (attendance.final_override_by && ctx.actor.role !== 'ED') {
    throw outOfScope('reverse an Event Director final override');
  }
  if (payload.final_override && ctx.actor.role !== 'ED') {
    throw outOfScope('record a final override');
  }

  const before = {
    status: attendance.status, source: attendance.source,
    check_in_at: attendance.check_in_at?.toISOString() ?? null,
  };

  const { count } = await ctx.tx.attendance.updateMany({
    where: { id: payload.attendance_id, row_version: payload.expected_version },
    data: {
      status: payload.status,
      source: ctx.actor.role === 'ED' ? 'ED' : 'CH',
      final_override_by: payload.final_override ? ctx.actor.user_id : attendance.final_override_by,
      updated_by: ctx.actor.user_id,
      row_version: { increment: 1 },
    },
  });
  if (count === 0) {
    const current = await ctx.tx.attendance.findUnique({ where: { id: payload.attendance_id } });
    throw validationFailed(
      `This attendance record changed since you loaded it (version ${current?.row_version}).`,
    );
  }

  // The correction row is what makes the earlier CH determination still visible
  // after an ED override — §8's acceptance criterion.
  await ctx.tx.attendanceCorrection.create({
    data: {
      event_id: ctx.actor.event_id,
      created_by: ctx.actor.user_id,
      attendance_id: payload.attendance_id,
      before_values: before as Prisma.InputJsonValue,
      after_values: { status: payload.status,
                      source: ctx.actor.role === 'ED' ? 'ED' : 'CH' } as Prisma.InputJsonValue,
      reason: payload.reason,
      actor_id: ctx.actor.user_id,
    },
  });

  ctx.audit({
    action: 'correctAttendance', entity_type: 'Attendance', entity_id: payload.attendance_id,
    safe_diff: { before, after: { status: payload.status } },
    reason: payload.reason,
  });

  return { attendance_id: payload.attendance_id, status: payload.status,
           version: payload.expected_version + 1 };
}

/* ------------------------------------------------------------------ *
 * calculateAttendance
 * ------------------------------------------------------------------ */

export interface AttendanceRate {
  /** null when the denominator is zero — AT-020 requires N/A, not 0% or 100%. */
  rate: number | null;
  display: string;
  numerator: number;
  denominator: number;
  /** §8: provisional claims are shown separately and never counted as confirmed. */
  pending_claims: number;
  mode: 'Daily' | 'Shift';
  note: string;
}

/**
 * §8: "Suggested attendance rate = confirmed present or late duties / expected
 * non-excused duties. For daily reporting, count distinct volunteer-date pairs; for
 * shifts, count duties. Never combine the two denominators."
 *
 * The mode is therefore a parameter, and mixing sessions of different modes is
 * refused rather than silently summed.
 */
export async function calculateAttendance(
  ctx: CommandContext,
  payload: { from: string; to: string; cluster_id?: string | null },
): Promise<AttendanceRate> {
  const from = new Date(payload.from);
  const to = new Date(payload.to);

  const sessions = await ctx.tx.dutySession.findMany({
    where: { event_id: ctx.actor.event_id, local_date: { gte: from, lte: to } },
    select: { id: true, mode: true, local_date: true },
  });

  const modes = new Set(sessions.map((s) => s.mode));
  if (modes.size > 1) {
    throw validationFailed(
      'This range mixes Daily and Shift duty sessions. Their denominators are different ' +
      'units and must not be combined (§8). Report them separately.',
    );
  }
  const mode = (sessions[0]?.mode ?? 'Daily') as 'Daily' | 'Shift';
  const sessionIds = sessions.map((s) => s.id);

  const duties = await ctx.tx.expectedDuty.findMany({
    where: {
      event_id: ctx.actor.event_id,
      session_id: { in: sessionIds },
      ...(payload.cluster_id ? { snapshot_cluster_id: payload.cluster_id } : {}),
    },
    include: { attendances: true, session: { select: { local_date: true } } },
  });

  // Excused duties leave the denominator entirely; they are not failures to attend.
  const counted = duties.filter((d) => d.expectation === 'Expected');

  const confirmedKeys = new Set<string>();
  const denominatorKeys = new Set<string>();
  let pending = 0;

  for (const d of counted) {
    // Daily mode counts distinct volunteer-date pairs; shift mode counts duties.
    const key = mode === 'Daily'
      ? `${d.volunteer_id}#${d.session.local_date.toISOString().slice(0, 10)}`
      : d.id;
    denominatorKeys.add(key);

    const attendance = d.attendances[0];
    if (!attendance) continue;
    if (attendance.status === 'PendingReview') { pending += 1; continue; }
    if (attendance.status === 'Present' || attendance.status === 'Late') {
      confirmedKeys.add(key);
    }
  }

  const denominator = denominatorKeys.size;
  const numerator = confirmedKeys.size;

  // AT-020: a zero denominator is N/A. A rate of 0 would claim nobody turned up.
  if (denominator === 0) {
    return {
      rate: null, display: 'N/A', numerator: 0, denominator: 0,
      pending_claims: pending, mode,
      note: 'No expected duties in this range, so an attendance rate is not defined.',
    };
  }

  const rate = numerator / denominator;
  return {
    rate,
    display: `${Math.round(rate * 1000) / 10}% (${numerator}/${denominator})`,
    numerator, denominator, pending_claims: pending, mode,
    note: mode === 'Daily'
      ? 'Denominator counts distinct volunteer-date pairs.'
      : 'Denominator counts individual shift duties.',
  };
}

/* ------------------------------------------------------------------ *
 * closeDutySession
 * ------------------------------------------------------------------ */

/**
 * §8: "Unmarked expected duties become missing/absent according to policy after
 * cutoff; leave/excused is separate."
 * Note what is NOT done: excused duties are untouched, and volunteers with no
 * expected duty are not created as absentees.
 */
export async function closeDutySession(
  ctx: CommandContext,
  payload: { session_id: string; unmarked_becomes: 'Missing' | 'Absent' },
): Promise<{ session_id: string; marked: number; left_excused: number }> {
  assertAccess({ actor: ctx.actor, action: 'attendance.correct' });

  const session = await ctx.tx.dutySession.findFirst({
    where: { id: payload.session_id, event_id: ctx.actor.event_id },
  });
  if (!session) throw validationFailed('Duty session not found.');
  if (session.status === 'Closed') throw invalidState('Closed', 'close');

  const duties = await ctx.tx.expectedDuty.findMany({
    where: { session_id: payload.session_id },
    include: { attendances: true },
  });

  let marked = 0;
  let excused = 0;
  const now = new Date();

  for (const d of duties) {
    if (d.expectation === 'Excused') { excused += 1; continue; }
    if (d.expectation !== 'Expected') continue;
    if (d.attendances.length > 0) continue;

    await ctx.tx.attendance.create({
      data: {
        event_id: ctx.actor.event_id,
        created_by: ctx.actor.user_id, updated_by: ctx.actor.user_id,
        expected_duty_id: d.id,
        received_at: now,
        status: payload.unmarked_becomes,
        source: ctx.actor.role === 'ED' ? 'ED' : 'CH',
      },
    });
    marked += 1;
  }

  await ctx.tx.dutySession.update({
    where: { id: payload.session_id },
    data: { status: 'Closed', updated_by: ctx.actor.user_id, row_version: { increment: 1 } },
  });

  ctx.audit({
    action: 'closeDutySession', entity_type: 'DutySession', entity_id: payload.session_id,
    safe_diff: { marked, unmarked_becomes: payload.unmarked_becomes, left_excused: excused },
  });

  return { session_id: payload.session_id, marked, left_excused: excused };
}
