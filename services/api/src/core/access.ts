/**
 * Permission evaluation.
 *
 * §1: "Every server request evaluates: active identity → active event membership →
 * permitted action → assigned record scope → allowed fields → valid workflow state.
 * A hidden button alone is never access control. Apply the same policy to searches,
 * counts, exports, attachments, background jobs and notifications."
 *
 * Two consequences shape this module:
 *
 *  1. The chain is ORDERED and every step is explicit, so `previewEffectiveAccess`
 *     can tell an ED *which* assignment or grant produced access (§3) rather than
 *     returning a bare yes/no.
 *
 *  2. It takes an ActorContext, not a request. That is what lets the identical
 *     policy run inside a background export job or an outbox worker — which §1
 *     requires and which is where hand-rolled middleware checks usually stop.
 */
import {
  type AccessDecision, type ActorContext, type Role,
  outOfScope, inactiveEntity,
} from '@khel/contracts';

/* ------------------------------------------------------------------ *
 * Action catalogue
 *
 * Transcribed from Khelo_Sanand_Data_and_Functions.xlsx → Permissions.
 * A role that is absent from `roles` can never perform the action, whatever
 * scope or grant it holds — grants widen SCOPE, never the action set.
 * ------------------------------------------------------------------ */

export type ScopeKind = 'Event' | 'Cluster' | 'School' | 'Pool' | 'Fixture' | 'Self' | 'None';

export interface ActionPolicy {
  action: string;
  /** Roles permitted at all. */
  roles: Role[];
  /** What the actor must hold the record within, per role. */
  scope: Partial<Record<Role, ScopeKind>>;
  /** The constraint column from the workbook, surfaced verbatim in denials. */
  constraint: string;
  /** True when an ED ScopeGrant can extend this action beyond its ordinary scope. */
  grantable: boolean;
}

const P = (
  action: string, roles: Role[], scope: Partial<Record<Role, ScopeKind>>,
  constraint: string, grantable = false,
): ActionPolicy => ({ action, roles, scope, constraint, grantable });

export const ACTION_POLICIES: Record<string, ActionPolicy> = Object.fromEntries(
  [
    // --- M01/M02 masters -------------------------------------------------
    P('event.manage', ['ED'], { ED: 'Event' }, 'ED owns master changes'),
    P('school.read', ['ED', 'CH', 'VOL'], { ED: 'Event', CH: 'School', VOL: 'School' },
      'CH reads assigned schools; VOL reads operational school detail'),
    P('school.manage', ['ED'], { ED: 'Event' }, 'ED owns master changes'),
    P('cluster.manage', ['ED'], { ED: 'Event' }, 'ED owns master changes'),
    P('venue.manage', ['ED'], { ED: 'Event' }, 'ED owns master changes'),

    P('staff.create', ['ED'], { ED: 'Event' }, 'Last active ED protected'),
    P('staff.deactivate', ['ED'], { ED: 'Event' }, 'Last active ED protected'),
    P('staff.resetAccess', ['ED'], { ED: 'Event' }, 'No plain credential display'),
    P('profile.editOwn', ['ED', 'CH', 'VOL'], { ED: 'Self', CH: 'Self', VOL: 'Self' },
      'Role and identity fields excluded'),

    // --- M03 assignments -------------------------------------------------
    P('assignment.schoolToCH', ['ED'], { ED: 'Event' },
      'Exactly one current default manager'),
    P('assignment.volunteerToPool', ['ED'], { ED: 'Event' },
      'CH may allocate inside own pool; cross-pool transfer needs an explicit ED grant'),
    P('assignment.volunteerToSchool', ['ED', 'CH'], { ED: 'Event', CH: 'Pool' },
      'CH must control both the school and the volunteer pool', true),
    P('assignment.fixtureDuty', ['ED', 'CH'], { ED: 'Event', CH: 'Fixture' },
      'CH may allocate primary scorers only if explicitly delegated for owned fixtures', true),

    // --- M04 athletes ----------------------------------------------------
    P('athlete.readOperational', ['ED', 'CH', 'VOL'],
      { ED: 'Event', CH: 'School', VOL: 'School' }, 'Minimise fields for VOL'),
    P('athlete.readRestricted', ['ED'], { ED: 'Event' },
      'Detailed birth dates, documents and family contacts need a separately authorised purpose', true),
    P('athlete.editIdentity', ['ED'], { ED: 'Event' },
      'CH limited to the exact approved field policy'),
    P('athlete.editAllowedFields', ['ED', 'CH'], { ED: 'Event', CH: 'School' },
      'Proposed CH notes and correction requests only'),
    P('athlete.bulkUpload', ['ED'], { ED: 'Event' }, 'Source baseline: ED only'),
    P('eligibility.review', ['ED'], { ED: 'Event' },
      'Override requires a reason and the rule snapshot', true),
    P('roster.manage', ['ED', 'CH'], { ED: 'Event', CH: 'School' },
      'No conflicting competition roster', true),

    // --- M05/M06 rules and fixtures -------------------------------------
    P('rules.configure', ['ED'], { ED: 'Event' }, 'Approval required before publish'),
    P('rules.read', ['ED', 'CH', 'VOL'], { ED: 'Event', CH: 'Cluster', VOL: 'Fixture' },
      'CH reads approved rules; VOL reads the pinned fixture rules'),
    P('fixture.manage', ['ED'], { ED: 'Event' },
      'CH schedule mutation requires separate delegation', true),
    P('fixture.read', ['ED', 'CH', 'VOL'], { ED: 'Event', CH: 'Cluster', VOL: 'School' },
      'VOL reads the accessible published scope'),

    // --- M07 attendance --------------------------------------------------
    P('attendance.selfMark', ['ED', 'CH', 'VOL'], { ED: 'Self', CH: 'Self', VOL: 'Self' },
      'Own assigned duty; client claims are distinct'),
    P('attendance.correct', ['ED', 'CH'], { ED: 'Event', CH: 'Pool' },
      'CH cannot reverse an ED final override; reason and history required'),

    // --- M08 kits --------------------------------------------------------
    P('kit.issue', ['ED', 'CH'], { ED: 'Event', CH: 'Pool' },
      'Quantity and duplicate checks'),
    P('kit.acknowledge', ['ED', 'CH', 'VOL'], { ED: 'Self', CH: 'Self', VOL: 'Self' },
      'Cannot change issue quantities'),

    // --- M09 scorecards --------------------------------------------------
    P('scorecard.edit', ['ED', 'CH', 'VOL'],
      { ED: 'Event', CH: 'Fixture', VOL: 'Fixture' },
      'School context alone is not a default edit right; requires explicit fixture assignment'),
    P('scorecard.submit', ['ED', 'CH', 'VOL'],
      { ED: 'Event', CH: 'Fixture', VOL: 'Fixture' }, 'Freezes the exact revision'),
    P('scorecard.review', ['ED', 'CH'], { ED: 'Event', CH: 'Fixture' },
      'No self-review by default'),
    P('scorecard.amendLocked', ['ED'], { ED: 'Event' },
      'Preserve the original and review downstream impact'),
    P('results.publishPublic', ['ED'], { ED: 'Event' },
      'Approved fields and locked snapshots only'),

    // --- M10/M11/M12 -----------------------------------------------------
    P('notification.read', ['ED', 'CH', 'VOL'], { ED: 'Self', CH: 'Self', VOL: 'Self' },
      'Recheck content access when opening'),
    P('report.export', ['ED', 'CH', 'VOL'], { ED: 'Event', CH: 'Cluster', VOL: 'Self' },
      'No scope bypass in background jobs or downloads'),
    P('audit.read', ['ED', 'CH', 'VOL'], { ED: 'Event', CH: 'Cluster', VOL: 'Self' },
      'Append-only; scoped history where enabled'),
    P('config.manage', ['ED'], { ED: 'Event' }, 'Permission changes invalidate authorisation immediately'),
  ].map((p) => [p.action, p]),
);

/* ------------------------------------------------------------------ *
 * The record being reached for
 * ------------------------------------------------------------------ */

export interface TargetRecord {
  /** Event the record belongs to. Compared against the actor's active event. */
  event_id: string;
  school_id?: string | null;
  cluster_id?: string | null;
  fixture_id?: string | null;
  /** Membership that owns the record, for Self-scoped actions. */
  owner_membership_id?: string | null;
  /** Workflow state, when the action is state-gated. */
  state?: string | null;
}

export interface AccessRequest {
  actor: ActorContext;
  action: string;
  target?: TargetRecord;
  /** States in which the action is legal. Omit when the action is not state-gated. */
  allowedStates?: readonly string[];
}

/**
 * Evaluate the full chain. Returns a decision with its derivation; never throws.
 * Use `assertAccess` when a denial should abort the request.
 */
export function evaluateAccess(req: AccessRequest): AccessDecision {
  const { actor, action, target } = req;

  // 1. Active identity and active event membership.
  if (actor.membership_status !== 'Active') {
    // AT-004: an inactive membership is denied immediately, even on a live session.
    return deny(`Event membership is ${actor.membership_status}.`);
  }

  // 2. Permitted action.
  const policy = ACTION_POLICIES[action];
  if (!policy) return deny(`Unknown action "${action}".`);
  if (!policy.roles.includes(actor.role)) {
    // AT-003: a CH cannot create a user through the UI or the API.
    return deny(`Role ${actor.role} may not perform ${action}. ${policy.constraint}`);
  }

  // 3. Assigned record scope.
  const requiredScope = policy.scope[actor.role] ?? 'None';
  if (target) {
    if (target.event_id !== actor.event_id) {
      return deny('Record belongs to a different event.');
    }
    const scoped = withinScope(actor, requiredScope, target);
    if (!scoped.ok) {
      // A grant may widen scope — never the action set.
      const grant = policy.grantable ? findGrant(actor, action, target) : undefined;
      if (!grant) return deny(scoped.reason);
      return {
        allowed: true,
        reason:
          `${action} permitted via scope grant ${grant.grant_id} ` +
          `(${grant.scope_type} ${grant.scope_id}), expiring ${grant.expires_at.toISOString()}. ` +
          `Reason on record: ${grant.reason}`,
        via_grant_id: grant.grant_id,
      };
    }

    // 4. Valid workflow state.
    if (req.allowedStates && target.state && !req.allowedStates.includes(target.state)) {
      return deny(
        `Record is in state ${target.state}; ${action} requires one of ` +
        `${req.allowedStates.join(', ')}.`,
      );
    }
    return { allowed: true, reason: scoped.reason };
  }

  // No specific record: an event-wide action such as listing.
  return { allowed: true, reason: `${action} permitted for role ${actor.role} at event scope.` };
}

/** Throws OUT_OF_SCOPE when access is refused. The message stays generic (AT-029). */
export function assertAccess(req: AccessRequest): AccessDecision {
  const decision = evaluateAccess(req);
  if (!decision.allowed) throw outOfScope(req.action);
  return decision;
}

/** Membership-level guard used before any event work. */
export function assertActiveMembership(actor: ActorContext): void {
  if (actor.membership_status !== 'Active') throw inactiveEntity('Event membership');
}

/* ------------------------------------------------------------------ */

function deny(reason: string): AccessDecision {
  return { allowed: false, reason };
}

function withinScope(
  actor: ActorContext, scope: ScopeKind, target: TargetRecord,
): { ok: boolean; reason: string } {
  switch (scope) {
    case 'Event':
      return { ok: true, reason: `Event-wide scope for role ${actor.role}.` };

    case 'Cluster': {
      if (!target.cluster_id) return { ok: false, reason: 'Record has no cluster to check against.' };
      const ok = actor.cluster_ids.includes(target.cluster_id);
      return { ok, reason: ok
        ? `Cluster scope via active cluster assignment (${target.cluster_id}).`
        : 'Record is outside the actor’s clusters.' };
    }

    case 'School':
    case 'Pool': {
      if (!target.school_id) return { ok: false, reason: 'Record has no school to check against.' };
      const ok = actor.school_ids.includes(target.school_id);
      return { ok, reason: ok
        ? `School scope via active assignment interval (${target.school_id}).`
        : 'Record is outside the actor’s assigned schools.' };
    }

    case 'Fixture': {
      // §1: "scoring access defaults to explicit fixture assignment".
      if (!target.fixture_id) return { ok: false, reason: 'Record has no fixture to check against.' };
      const duty = actor.fixture_duties.find((d) => d.fixture_id === target.fixture_id);
      return { ok: !!duty, reason: duty
        ? `Fixture scope via explicit ${duty.duty_role} duty on ${target.fixture_id}.`
        : 'No explicit duty on this fixture. School context alone is not an edit right.' };
    }

    case 'Self': {
      const ok = target.owner_membership_id === actor.membership_id;
      return { ok, reason: ok ? 'Own record.' : 'Record belongs to another person.' };
    }

    case 'None':
    default:
      return { ok: false, reason: 'No scope permits this action for this role.' };
  }
}

/**
 * A live, unexpired grant matching this action and record.
 * §1: "An explicit cross-cluster exception contains scope, allowed action, approver,
 * reason and expiry. It does not grant permanent cluster-wide access."
 */
function findGrant(actor: ActorContext, action: string, target: TargetRecord) {
  const now = Date.now();
  return actor.grants.find((g) => {
    if (g.action !== action) return false;
    if (g.expires_at.getTime() <= now) return false;
    switch (g.scope_type) {
      case 'School':  return g.scope_id === target.school_id;
      case 'Cluster': return g.scope_id === target.cluster_id;
      case 'Fixture': return g.scope_id === target.fixture_id;
      case 'Pool':    return g.scope_id === target.school_id || g.scope_id === target.cluster_id;
      default:        return false;
    }
  });
}

/* ------------------------------------------------------------------ *
 * Field-level visibility
 *
 * §1: "RECOMMENDED field visibility: VOL sees athlete name, operational
 * identifier/bib, school, category, entry and eligibility outcome. Detailed birth
 * dates, supporting documents and family contacts require a separately authorised
 * purpose." §12 adds that the same policy applies to exports.
 * ------------------------------------------------------------------ */

/** Fields a VOL may see on an athlete record. Anything else is stripped server-side. */
export const ATHLETE_FIELDS_VOL = [
  'id', 'event_athlete_code', 'display_name', 'display_name_local',
  'school_display', 'category_label', 'bib', 'entry_status', 'eligibility_status',
] as const;

/** Additional fields a CH may see for eligibility review — the minimum needed. */
export const ATHLETE_FIELDS_CH = [
  ...ATHLETE_FIELDS_VOL, 'standard', 'section', 'registration_status', 'notes',
] as const;

/** Restricted fields. Reachable only with athlete.readRestricted AND an active consent. */
export const ATHLETE_FIELDS_RESTRICTED = [
  'date_of_birth', 'guardian_name', 'guardian_mobile', 'address', 'documents',
] as const;

export function athleteFieldsFor(role: Role, hasRestrictedAccess: boolean): string[] {
  if (role === 'VOL') return [...ATHLETE_FIELDS_VOL];
  if (role === 'CH') return [...ATHLETE_FIELDS_CH];
  return hasRestrictedAccess
    ? [...ATHLETE_FIELDS_CH, ...ATHLETE_FIELDS_RESTRICTED]
    : [...ATHLETE_FIELDS_CH];
}

/** Strip a record to the fields this actor may read. Applied before serialisation. */
export function projectFields<T extends Record<string, unknown>>(
  record: T, allowed: readonly string[],
): Partial<T> {
  const out: Partial<T> = {};
  for (const key of allowed) {
    if (key in record) (out as Record<string, unknown>)[key] = record[key];
  }
  return out;
}
