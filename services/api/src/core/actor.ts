/**
 * Actor resolution.
 *
 * Builds the ActorContext from the database on every request. Nothing here is ever
 * taken from the client: §3 requires that "Removing a role must invalidate cached
 * authorisation and queued commands; the worker rechecks permissions when executing
 * an export", so scope is derived fresh from live assignment intervals rather than
 * being carried in a token.
 *
 * The cost is one query per request. The alternative — trusting a signed claim —
 * cannot satisfy AT-004 ("inactive membership uses old session → denied immediately").
 */
import type { PrismaClient } from '@prisma/client';
import type { ActorContext, Role } from '@khel/contracts';
import { inactiveEntity, outOfScope } from '@khel/contracts';

export interface ResolveActorArgs {
  prisma: PrismaClient;
  user_id: string;
  event_id: string;
  request_id: string;
  locale?: string;
  /** Evaluate intervals at this instant. Defaults to now; set for historical reports (§4). */
  asOf?: Date;
}

/**
 * §4: "Historical reports evaluate assignment scope at the relevant operation time;
 * former CHs do not retain live access automatically." Passing `asOf` is how a
 * report reconstructs who could see what at the time, without granting it now.
 */
export async function resolveActor(args: ResolveActorArgs): Promise<ActorContext> {
  const { prisma, user_id, event_id, request_id } = args;
  const asOf = args.asOf ?? new Date();

  const membership = await prisma.eventMembership.findUnique({
    where: { event_id_user_id: { event_id, user_id } },
    include: { user: true },
  });

  if (!membership) throw outOfScope('access this event');
  if (!membership.user.active) throw inactiveEntity('User account');
  if (membership.status !== 'Active') throw inactiveEntity('Event membership');

  const role = membership.role as Role;

  // An interval is live when it started at or before `asOf` and has not ended.
  const live = {
    effective_from: { lte: asOf },
    OR: [{ effective_to: null }, { effective_to: { gt: asOf } }],
  };

  const [chSchools, poolAssignment, volunteerSchools, duties, grants] = await Promise.all([
    // CH: schools this membership currently manages.
    role === 'CH'
      ? prisma.schoolCHAssignment.findMany({
          where: { event_id, ch_membership_id: membership.id, ...live },
          select: { event_school_id: true, cluster_id: true },
        })
      : Promise.resolve([]),

    // VOL: the single active pool, which fixes the cluster.
    role === 'VOL'
      ? prisma.volunteerPoolAssignment.findFirst({
          where: { event_id, volunteer_membership_id: membership.id, ...live },
          select: { cluster_id: true },
        })
      : Promise.resolve(null),

    // VOL: schools this volunteer currently serves.
    role === 'VOL'
      ? prisma.volunteerSchoolAssignment.findMany({
          where: { event_id, volunteer_membership_id: membership.id, ...live },
          select: { event_school_id: true },
        })
      : Promise.resolve([]),

    // §1: scoring access defaults to explicit fixture assignment, for every role.
    prisma.fixtureAssignment.findMany({
      where: {
        event_id, membership_id: membership.id, status: 'Assigned',
        starts_at: { lte: asOf }, ends_at: { gt: asOf },
      },
      select: { fixture_id: true, duty_role: true },
    }),

    // Live, unexpired exceptions only. An expired grant is not a grant.
    prisma.scopeGrant.findMany({
      where: { event_id, membership_id: membership.id, expires_at: { gt: asOf } },
      select: { id: true, action: true, scope_type: true, scope_id: true, expires_at: true, reason: true },
    }),
  ]);

  const school_ids = role === 'CH'
    ? chSchools.map((s) => s.event_school_id)
    : volunteerSchools.map((s) => s.event_school_id);

  const cluster_ids = role === 'ED'
    ? []                                   // ED is event-wide; cluster scope is not the gate
    : role === 'CH'
      ? [...new Set(chSchools.map((s) => s.cluster_id))]
      : poolAssignment ? [poolAssignment.cluster_id] : [];

  return {
    user_id,
    event_id,
    membership_id: membership.id,
    role,
    membership_status: membership.status as ActorContext['membership_status'],
    permissions_version: membership.permissions_version,
    school_ids,
    cluster_ids,
    fixture_duties: duties.map((d) => ({
      fixture_id: d.fixture_id,
      duty_role: d.duty_role as 'PrimaryScorer' | 'Support' | 'Reviewer',
    })),
    grants: grants.map((g) => ({
      grant_id: g.id,
      action: g.action,
      scope_type: g.scope_type as 'School' | 'Pool' | 'Fixture' | 'Cluster',
      scope_id: g.scope_id,
      expires_at: g.expires_at,
      reason: g.reason,
    })),
    request_id,
    locale: args.locale ?? 'gu',
  };
}

/**
 * §3 support view: show the derived scope and what produced it.
 * "Read-only support view; no silent impersonation" — this returns a description,
 * never a session.
 */
export interface EffectiveAccessPreview {
  user_id: string;
  role: Role;
  membership_status: string;
  school_count: number;
  cluster_count: number;
  fixture_duty_count: number;
  grants: { action: string; scope: string; expires_at: string; reason: string }[];
  derivation: string[];
}

export function describeEffectiveAccess(actor: ActorContext): EffectiveAccessPreview {
  const derivation: string[] = [
    `Identity ${actor.user_id} with ${actor.membership_status} ${actor.role} membership ` +
    `on event ${actor.event_id} (permissions version ${actor.permissions_version}).`,
  ];
  if (actor.school_ids.length) {
    derivation.push(
      `${actor.school_ids.length} school(s) in scope from live assignment intervals.`,
    );
  } else {
    derivation.push('No school assignments are currently in effect.');
  }
  if (actor.cluster_ids.length) {
    derivation.push(`${actor.cluster_ids.length} cluster(s) in scope.`);
  }
  derivation.push(
    actor.fixture_duties.length
      ? `${actor.fixture_duties.length} explicit fixture dut(y/ies): ` +
        actor.fixture_duties.map((d) => `${d.duty_role}@${d.fixture_id}`).join(', ')
      : 'No explicit fixture duties — no scoring access by default.',
  );
  if (actor.grants.length) {
    derivation.push(
      `${actor.grants.length} live scope grant(s); each expires and is audited on use.`,
    );
  }

  return {
    user_id: actor.user_id,
    role: actor.role,
    membership_status: actor.membership_status,
    school_count: actor.school_ids.length,
    cluster_count: actor.cluster_ids.length,
    fixture_duty_count: actor.fixture_duties.length,
    grants: actor.grants.map((g) => ({
      action: g.action,
      scope: `${g.scope_type} ${g.scope_id}`,
      expires_at: g.expires_at.toISOString(),
      reason: g.reason,
    })),
    derivation,
  };
}
