/**
 * Command / query envelope.
 * Source: Functional Specification §1 "Common command and data contract" and
 * §14 "API conventions".
 */
import type { Role } from './enums.js';

/** Fields every operational record carries (§1). */
export interface AuditableRecord {
  id: string;
  created_at: Date;
  created_by: string;
  updated_at: Date;
  updated_by: string;
  /** Optimistic concurrency token. A stale expected_version returns VERSION_CONFLICT. */
  row_version: number;
}

/**
 * Every mutating request carries this.
 * - request_id: correlates the API call, audit event and any background job it spawns.
 * - idempotency_key: required on retryable create/submit/import/issue commands.
 *   Reusing it with the same payload replays the original result; a different payload
 *   is rejected with IDEMPOTENCY_PAYLOAD_MISMATCH. The key and the business write
 *   commit in one transaction — §1.
 * - expected_version: required when mutating an existing record.
 */
export interface CommandEnvelope<TPayload> {
  request_id: string;
  idempotency_key?: string;
  expected_version?: number;
  payload: TPayload;
}

/** Uniform success shape (§14: "Return entity ID, version, state, warnings and next permitted actions"). */
export interface CommandResult<TData = unknown> {
  id?: string;
  version?: number;
  state?: string;
  data: TData;
  /** Non-blocking advisories. A warning never silently changes what was written. */
  warnings: Warning[];
  /** What this actor may legally do next, given state and scope. Drives UI affordances. */
  next_actions: string[];
  /** True when an idempotency key replayed a previously committed result. */
  replayed?: boolean;
}

export interface Warning {
  code: string;
  message: string;
  field?: string;
}

/** Cursor pagination (§14: GET queries support cursor pagination and validated filters). */
export interface PageRequest {
  cursor?: string;
  limit?: number;
  sort?: string;
  order?: 'asc' | 'desc';
}

export interface Page<T> {
  items: T[];
  next_cursor: string | null;
  /** Total within the caller's authorised scope only — never the event-wide total (§12). */
  total_in_scope: number;
}

/* ------------------------------------------------------------------ *
 * Actor and scope
 * ------------------------------------------------------------------ */

/**
 * The resolved caller. Built server-side per request from the session; never
 * accepted from the client.
 */
export interface ActorContext {
  user_id: string;
  event_id: string;
  membership_id: string;
  role: Role;
  membership_status: 'Invited' | 'Active' | 'Inactive';
  /** Bumped when permissions change, so cached authorisation and queued commands re-check (§3). */
  permissions_version: number;
  /** Schools this actor currently manages or serves, resolved from active assignment intervals. */
  school_ids: string[];
  /** Clusters this actor heads (CH) — empty for VOL. */
  cluster_ids: string[];
  /** Fixtures where this actor holds an explicit duty. Scoring access defaults to this (§1). */
  fixture_duties: FixtureDuty[];
  /** Live, unexpired cross-scope exceptions. Never a permanent widening (§1). */
  grants: ActiveGrant[];
  request_id: string;
  locale: string;
}

export interface FixtureDuty {
  fixture_id: string;
  duty_role: 'PrimaryScorer' | 'Support' | 'Reviewer';
}

export interface ActiveGrant {
  grant_id: string;
  action: string;
  scope_type: 'School' | 'Pool' | 'Fixture' | 'Cluster';
  scope_id: string;
  expires_at: Date;
  reason: string;
}

/**
 * Outcome of the permission chain.
 * §1: identity → active membership → permitted action → assigned record scope →
 *     allowed fields → valid workflow state.
 * `reason` is surfaced in the support view (previewEffectiveAccess) so an ED can
 * see WHICH assignment or grant produced access — never a bare yes/no.
 */
export interface AccessDecision {
  allowed: boolean;
  /** Human-readable derivation, e.g. "school scope via SchoolCHAssignment a3f…". */
  reason: string;
  /** Set when access came from an expiring exception rather than an ordinary assignment. */
  via_grant_id?: string;
  /** Fields the actor may read for this record. Empty array = all Operational fields. */
  allowed_fields?: string[];
}
