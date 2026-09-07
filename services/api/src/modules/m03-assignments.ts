/**
 * M03 — Assignments and volunteer deployment. §4.
 *
 * The subtle requirements here are all about INTERVALS rather than flags:
 *   - "End old interval and create new interval atomically" (reassignSchool);
 *   - "Default exactly one active pool" — enforced by a partial unique index, so
 *     AT-007's two concurrent transfers cannot both win;
 *   - "Replacing a scorer revokes the former scorer's next save while retaining
 *     their draft history" (AT-008) — the assignment is superseded, the authored
 *     revision is not rewritten.
 */
import type { Prisma } from '@prisma/client';
import { type Warning, validationFailed, dependencyBlocked, capacityConflict } from '@khel/contracts';
import type { CommandContext } from '../core/command.js';
import { assertAccess } from '../core/access.js';

/* ------------------------------------------------------------------ *
 * assignSchoolsToCH
 * ------------------------------------------------------------------ */

export interface AssignSchoolsPayload {
  ch_membership_id: string;
  cluster_id: string;
  event_school_ids: string[];
  effective_from: string;
  reason?: string | null;
}

/** §4: "Return per-school outcomes." A partial batch must never report blanket success. */
export interface PerRecordOutcome {
  event_school_id: string;
  outcome: 'Assigned' | 'Blocked';
  detail: string;
}

export async function assignSchoolsToCH(
  ctx: CommandContext, payload: AssignSchoolsPayload,
): Promise<{ outcomes: PerRecordOutcome[]; assigned: number; blocked: number }> {
  assertAccess({ actor: ctx.actor, action: 'assignment.schoolToCH' });

  const effectiveFrom = new Date(payload.effective_from);
  if (Number.isNaN(effectiveFrom.getTime())) {
    throw validationFailed('effective_from is not a valid instant.', [
      { field: 'effective_from', message: 'Expected an ISO-8601 timestamp.' },
    ]);
  }

  // §4: "Active ED/CH/schools required."
  const ch = await ctx.tx.eventMembership.findFirst({
    where: { id: payload.ch_membership_id, event_id: ctx.actor.event_id, role: 'CH', status: 'Active' },
  });
  if (!ch) {
    throw validationFailed('The nominated Cluster Head is not an active CH on this event.', [
      { field: 'ch_membership_id', message: 'No active CH membership with this id.' },
    ]);
  }

  const cluster = await ctx.tx.cluster.findFirst({
    where: { id: payload.cluster_id, event_id: ctx.actor.event_id, active: true },
  });
  if (!cluster) throw validationFailed('Cluster is not active on this event.');

  const outcomes: PerRecordOutcome[] = [];

  for (const schoolId of payload.event_school_ids) {
    const school = await ctx.tx.eventSchool.findFirst({
      where: { id: schoolId, event_id: ctx.actor.event_id },
      include: { school: true },
    });

    if (!school) {
      outcomes.push({ event_school_id: schoolId, outcome: 'Blocked',
        detail: 'School is not part of this event.' });
      continue;
    }
    // §2: "Deactivation blocks new assignments."
    if (school.participation_status !== 'Active') {
      outcomes.push({ event_school_id: schoolId, outcome: 'Blocked',
        detail: `School participation is ${school.participation_status}; new assignments are blocked.` });
      continue;
    }

    const current = await ctx.tx.schoolCHAssignment.findFirst({
      where: { event_id: ctx.actor.event_id, event_school_id: schoolId, effective_to: null },
    });

    if (current) {
      if (current.ch_membership_id === payload.ch_membership_id) {
        outcomes.push({ event_school_id: schoolId, outcome: 'Assigned',
          detail: 'Already managed by this CH; no change made.' });
        continue;
      }

      // An interval cannot be closed before it opened. This is not a hypothetical:
      // a school may already carry an assignment that STARTS in the future, and
      // reassigning "from now" would silently produce a negative interval. §4 asks
      // for an explicit disposition, so the row is blocked with a usable message
      // rather than the database rejecting it as an internal error.
      if (current.effective_from >= effectiveFrom) {
        outcomes.push({
          event_school_id: schoolId, outcome: 'Blocked',
          detail:
            `An assignment for this school already begins at ` +
            `${current.effective_from.toISOString()}, which is not before the requested ` +
            `effective time. Choose a later effective time, or cancel the future ` +
            `assignment first.`,
        });
        continue;
      }

      // §4: "End old interval and create new interval atomically."
      // The partial unique index means this ordering is not merely tidy — without
      // closing the old interval first the insert below is rejected by the database.
      await ctx.tx.schoolCHAssignment.update({
        where: { id: current.id },
        data: { effective_to: effectiveFrom, updated_by: ctx.actor.user_id,
                row_version: { increment: 1 } },
      });
    }

    const created = await ctx.tx.schoolCHAssignment.create({
      data: {
        event_id: ctx.actor.event_id,
        created_by: ctx.actor.user_id,
        updated_by: ctx.actor.user_id,
        event_school_id: schoolId,
        cluster_id: payload.cluster_id,
        ch_membership_id: payload.ch_membership_id,
        effective_from: effectiveFrom,
        reason: payload.reason ?? null,
      },
    });

    ctx.audit({
      action: 'assignSchoolsToCH',
      entity_type: 'SchoolCHAssignment',
      entity_id: created.id,
      safe_diff: {
        event_school_id: schoolId,
        previous_ch_membership_id: current?.ch_membership_id ?? null,
        new_ch_membership_id: payload.ch_membership_id,
        effective_from: effectiveFrom.toISOString(),
      },
      reason: payload.reason ?? null,
    });

    // §11: schedule and assignment changes notify the people affected.
    ctx.emit({
      topic: 'AssignmentChanged',
      dedupe_key: `AssignmentChanged:${created.id}:${payload.ch_membership_id}:InApp`,
      payload: { event_school_id: schoolId, ch_membership_id: payload.ch_membership_id,
                 school_name: school.school.name },
    });

    outcomes.push({ event_school_id: schoolId, outcome: 'Assigned',
      detail: current ? 'Reassigned; previous interval closed.' : 'Assigned.' });
  }

  const assigned = outcomes.filter((o) => o.outcome === 'Assigned').length;
  return { outcomes, assigned, blocked: outcomes.length - assigned };
}

/* ------------------------------------------------------------------ *
 * assignVolunteerPool
 * ------------------------------------------------------------------ */

export interface AssignPoolPayload {
  volunteer_membership_id: string;
  cluster_id: string;
  ch_membership_id: string;
  effective_from: string;
  /** §4: a transfer must resolve incompatible school duties before activation. */
  resolve_incompatible_school_duties?: boolean;
}

export async function assignVolunteerPool(
  ctx: CommandContext, payload: AssignPoolPayload,
): Promise<{ pool_assignment_id: string; ended_previous: boolean; ended_school_duties: number }> {
  assertAccess({ actor: ctx.actor, action: 'assignment.volunteerToPool' });
  const effectiveFrom = new Date(payload.effective_from);

  const volunteer = await ctx.tx.eventMembership.findFirst({
    where: { id: payload.volunteer_membership_id, event_id: ctx.actor.event_id,
             role: 'VOL', status: 'Active' },
  });
  if (!volunteer) throw validationFailed('Volunteer membership is not active on this event.');

  const current = await ctx.tx.volunteerPoolAssignment.findFirst({
    where: { event_id: ctx.actor.event_id,
             volunteer_membership_id: payload.volunteer_membership_id, effective_to: null },
  });

  let endedSchoolDuties = 0;

  if (current) {
    if (current.cluster_id === payload.cluster_id) {
      return { pool_assignment_id: current.id, ended_previous: false, ended_school_duties: 0 };
    }

    // §4: "Transfer ends old membership and resolves incompatible school duties
    // before activation." A volunteer cannot serve a school outside their new pool.
    const incompatible = await ctx.tx.volunteerSchoolAssignment.findMany({
      where: {
        event_id: ctx.actor.event_id,
        volunteer_membership_id: payload.volunteer_membership_id,
        effective_to: null,
        event_school: {
          school_c_h_assignments: {
            none: { effective_to: null, cluster_id: payload.cluster_id },
          },
        },
      },
    });

    if (incompatible.length > 0 && !payload.resolve_incompatible_school_duties) {
      throw dependencyBlocked(
        `This volunteer currently serves ${incompatible.length} school(s) outside the ` +
        `target cluster. Confirm that those duties should end before the transfer.`,
        incompatible.map((a) => ({ key: a.event_school_id,
          message: 'School duty is incompatible with the target pool.' })),
      );
    }

    for (const a of incompatible) {
      await ctx.tx.volunteerSchoolAssignment.update({
        where: { id: a.id },
        data: { effective_to: effectiveFrom, updated_by: ctx.actor.user_id,
                row_version: { increment: 1 } },
      });
      endedSchoolDuties += 1;
    }

    await ctx.tx.volunteerPoolAssignment.update({
      where: { id: current.id },
      data: { effective_to: effectiveFrom, updated_by: ctx.actor.user_id,
              row_version: { increment: 1 } },
    });
  }

  const created = await ctx.tx.volunteerPoolAssignment.create({
    data: {
      event_id: ctx.actor.event_id,
      created_by: ctx.actor.user_id,
      updated_by: ctx.actor.user_id,
      volunteer_membership_id: payload.volunteer_membership_id,
      cluster_id: payload.cluster_id,
      ch_membership_id: payload.ch_membership_id,
      effective_from: effectiveFrom,
    },
  });

  ctx.audit({
    action: 'assignVolunteerPool',
    entity_type: 'VolunteerPoolAssignment',
    entity_id: created.id,
    safe_diff: {
      volunteer_membership_id: payload.volunteer_membership_id,
      previous_cluster_id: current?.cluster_id ?? null,
      new_cluster_id: payload.cluster_id,
      ended_school_duties: endedSchoolDuties,
    },
  });

  return { pool_assignment_id: created.id, ended_previous: !!current,
           ended_school_duties: endedSchoolDuties };
}

/* ------------------------------------------------------------------ *
 * assignFixtureDuty / replaceFixtureDuty
 * ------------------------------------------------------------------ */

export interface FixtureDutyPayload {
  fixture_id: string;
  membership_id: string;
  duty_role: 'PrimaryScorer' | 'Support' | 'Reviewer';
  starts_at: string;
  ends_at: string;
  reason?: string | null;
}

export async function assignFixtureDuty(
  ctx: CommandContext, payload: FixtureDutyPayload,
): Promise<{ assignment_id: string; replaced_assignment_id: string | null }> {
  const fixture = await ctx.tx.fixture.findFirst({
    where: { id: payload.fixture_id, event_id: ctx.actor.event_id },
    include: { competition: true },
  });
  if (!fixture) throw validationFailed('Fixture not found in this event.');

  assertAccess({
    actor: ctx.actor,
    action: 'assignment.fixtureDuty',
    target: { event_id: ctx.actor.event_id, fixture_id: payload.fixture_id,
              cluster_id: fixture.owner_ch_id },
  });

  const starts = new Date(payload.starts_at);
  const ends = new Date(payload.ends_at);
  if (ends <= starts) {
    throw validationFailed('A duty must end after it begins.', [
      { field: 'ends_at', message: 'ends_at must be after starts_at.' },
    ]);
  }

  // §4: "Exactly one primary scorer and one accountable reviewer at a time."
  let replacedId: string | null = null;
  if (payload.duty_role === 'PrimaryScorer' || payload.duty_role === 'Reviewer') {
    const incumbent = await ctx.tx.fixtureAssignment.findFirst({
      where: { event_id: ctx.actor.event_id, fixture_id: payload.fixture_id,
               duty_role: payload.duty_role, status: 'Assigned' },
    });
    if (incumbent) {
      if (incumbent.membership_id === payload.membership_id) {
        return { assignment_id: incumbent.id, replaced_assignment_id: null };
      }
      // AT-008: revoke the former holder's write access. Their authored revisions
      // keep their authorship — the assignment is superseded, the history is not.
      await ctx.tx.fixtureAssignment.update({
        where: { id: incumbent.id },
        data: { status: 'Replaced', updated_by: ctx.actor.user_id, row_version: { increment: 1 } },
      });
      replacedId = incumbent.id;

      ctx.emit({
        topic: 'FixtureDutyRevoked',
        dedupe_key: `FixtureDutyRevoked:${incumbent.id}:${incumbent.membership_id}:InApp`,
        payload: { fixture_id: payload.fixture_id, duty_role: payload.duty_role },
      });
    }
  }

  const created = await ctx.tx.fixtureAssignment.create({
    data: {
      event_id: ctx.actor.event_id,
      created_by: ctx.actor.user_id,
      updated_by: ctx.actor.user_id,
      fixture_id: payload.fixture_id,
      membership_id: payload.membership_id,
      duty_role: payload.duty_role,
      starts_at: starts,
      ends_at: ends,
      status: 'Assigned',
    },
  });

  ctx.audit({
    action: 'assignFixtureDuty',
    entity_type: 'FixtureAssignment',
    entity_id: created.id,
    safe_diff: { fixture_id: payload.fixture_id, duty_role: payload.duty_role,
                 membership_id: payload.membership_id, replaced: replacedId },
    reason: payload.reason ?? null,
  });

  ctx.emit({
    topic: 'FixtureDutyAssigned',
    dedupe_key: `FixtureDutyAssigned:${created.id}:${payload.membership_id}:InApp`,
    payload: { fixture_id: payload.fixture_id, duty_role: payload.duty_role,
               scheduled_start: fixture.scheduled_start.toISOString() },
  });

  return { assignment_id: created.id, replaced_assignment_id: replacedId };
}

/* ------------------------------------------------------------------ *
 * calculateWorkload
 * ------------------------------------------------------------------ */

/**
 * §4: "Return schools count, fixture count, duty duration, overlap flags and
 * availability gaps; counts alone do not imply workload equivalence." The last
 * clause is why this returns durations and overlaps rather than a single score.
 */
export async function calculateWorkload(
  ctx: CommandContext,
  payload: { membership_ids: string[]; from: string; to: string },
): Promise<{
  membership_id: string; school_count: number; fixture_count: number;
  duty_minutes: number; overlapping_duties: number; warnings: Warning[];
}[]> {
  const from = new Date(payload.from);
  const to = new Date(payload.to);
  const out = [];

  for (const membershipId of payload.membership_ids) {
    const [schools, duties] = await Promise.all([
      ctx.tx.volunteerSchoolAssignment.count({
        where: { event_id: ctx.actor.event_id, volunteer_membership_id: membershipId,
                 effective_from: { lte: to },
                 OR: [{ effective_to: null }, { effective_to: { gt: from } }] },
      }),
      ctx.tx.fixtureAssignment.findMany({
        where: { event_id: ctx.actor.event_id, membership_id: membershipId,
                 status: 'Assigned', starts_at: { lt: to }, ends_at: { gt: from } },
        orderBy: { starts_at: 'asc' },
        select: { starts_at: true, ends_at: true },
      }),
    ]);

    let minutes = 0;
    let overlaps = 0;
    for (let i = 0; i < duties.length; i += 1) {
      const d = duties[i]!;
      minutes += Math.round((d.ends_at.getTime() - d.starts_at.getTime()) / 60_000);
      const next = duties[i + 1];
      // §7's interval rule: startA < endB and startB < endA.
      if (next && next.starts_at < d.ends_at) overlaps += 1;
    }

    const warnings: Warning[] = [];
    if (overlaps > 0) {
      warnings.push({
        code: 'OVERLAPPING_DUTIES',
        message: `${overlaps} duty pair(s) overlap in time for this volunteer.`,
      });
    }
    out.push({ membership_id: membershipId, school_count: schools,
               fixture_count: duties.length, duty_minutes: minutes,
               overlapping_duties: overlaps, warnings });
  }
  return out;
}
