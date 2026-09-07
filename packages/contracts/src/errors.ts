/**
 * Standard error taxonomy.
 * Source: Functional Specification §1 "Common command and data contract".
 *
 * Every failure returned by a command MUST map to exactly one of these codes.
 * Responses carry request_id, field/row context and a next action.
 * Hidden records must never leak through error detail — see OUT_OF_SCOPE.
 */
export const ERROR_CODES = [
  'VALIDATION_FAILED',
  'OUT_OF_SCOPE',
  'INACTIVE_ENTITY',
  'DUPLICATE_KEY',
  'VERSION_CONFLICT',
  'INVALID_STATE',
  'RULES_NOT_APPROVED',
  'CAPACITY_CONFLICT',
  'DEPENDENCY_BLOCKED',
  // --- Additions (GAP-E01..E04); see docs/GAP_REGISTER.md ---
  'IDEMPOTENCY_PAYLOAD_MISMATCH',
  'CONSENT_REQUIRED',
  'RETENTION_EXPIRED',
  'RATE_LIMITED',
] as const;

export type ErrorCode = (typeof ERROR_CODES)[number];

/** HTTP status mapping. Kept explicit so transport and business failure stay distinct. */
export const ERROR_HTTP_STATUS: Record<ErrorCode, number> = {
  VALIDATION_FAILED: 422,
  OUT_OF_SCOPE: 403,
  INACTIVE_ENTITY: 409,
  DUPLICATE_KEY: 409,
  VERSION_CONFLICT: 409,
  INVALID_STATE: 409,
  RULES_NOT_APPROVED: 409,
  CAPACITY_CONFLICT: 409,
  DEPENDENCY_BLOCKED: 409,
  IDEMPOTENCY_PAYLOAD_MISMATCH: 409,
  CONSENT_REQUIRED: 451,
  RETENTION_EXPIRED: 410,
  RATE_LIMITED: 429,
};

/** Per-field or per-row context attached to a failure. */
export interface ErrorDetail {
  /** Field path (`athlete.date_of_birth`) or import column name. */
  field?: string;
  /** Original spreadsheet row number for import failures — never the internal index. */
  row?: number;
  /** Business key of the offending record (school_code, event_athlete_code). */
  key?: string;
  /** Value as supplied, already redacted if the field is Restricted/Sensitive. */
  supplied?: unknown;
  message: string;
}

export interface ApiErrorBody {
  code: ErrorCode;
  message: string;
  request_id: string;
  details?: ErrorDetail[];
  /** What the caller should do next — required by §1 ("Errors identify the field or row and a remedy"). */
  next_action?: string;
  /** Present only on VERSION_CONFLICT: the version the server currently holds. */
  current_version?: number;
}

export class DomainError extends Error {
  readonly code: ErrorCode;
  readonly details: ErrorDetail[];
  readonly nextAction: string | undefined;
  readonly currentVersion: number | undefined;

  constructor(
    code: ErrorCode,
    message: string,
    opts: { details?: ErrorDetail[]; nextAction?: string; currentVersion?: number } = {},
  ) {
    super(message);
    this.name = 'DomainError';
    this.code = code;
    this.details = opts.details ?? [];
    this.nextAction = opts.nextAction;
    this.currentVersion = opts.currentVersion;
  }

  get httpStatus(): number {
    return ERROR_HTTP_STATUS[this.code];
  }

  toBody(requestId: string): ApiErrorBody {
    const body: ApiErrorBody = { code: this.code, message: this.message, request_id: requestId };
    if (this.details.length) body.details = this.details;
    if (this.nextAction) body.next_action = this.nextAction;
    if (this.currentVersion !== undefined) body.current_version = this.currentVersion;
    return body;
  }
}

/* ------------------------------------------------------------------ *
 * Constructors — used everywhere so the taxonomy stays closed.
 * ------------------------------------------------------------------ */

export const validationFailed = (message: string, details: ErrorDetail[] = []) =>
  new DomainError('VALIDATION_FAILED', message, { details });

/**
 * Out of scope. The message must be generic: an out-of-scope record's name,
 * counts and attachments must not be inferable (§3 Flexibility, AT-029).
 */
export const outOfScope = (action: string) =>
  new DomainError('OUT_OF_SCOPE', `Not permitted: ${action}`, {
    nextAction: 'Request an explicit, expiring scope grant from the Event Director.',
  });

export const inactiveEntity = (entity: string) =>
  new DomainError('INACTIVE_ENTITY', `${entity} is not active for this event.`);

export const duplicateKey = (key: string, details: ErrorDetail[] = []) =>
  new DomainError('DUPLICATE_KEY', `Duplicate key: ${key}`, { details });

export const versionConflict = (currentVersion: number) =>
  new DomainError('VERSION_CONFLICT', 'This record changed since you loaded it.', {
    currentVersion,
    nextAction: 'Reload the record, re-apply your change and submit again. Your draft is preserved.',
  });

export const invalidState = (from: string, command: string) =>
  new DomainError('INVALID_STATE', `Cannot ${command} from state ${from}.`);

export const rulesNotApproved = (competition: string) =>
  new DomainError('RULES_NOT_APPROVED', `Rule version for ${competition} is not approved.`, {
    nextAction: 'Complete the required rule settings and approve the rule version before publishing.',
  });

export const capacityConflict = (message: string, details: ErrorDetail[] = []) =>
  new DomainError('CAPACITY_CONFLICT', message, { details });

export const dependencyBlocked = (message: string, details: ErrorDetail[] = []) =>
  new DomainError('DEPENDENCY_BLOCKED', message, { details });

export const idempotencyPayloadMismatch = () =>
  new DomainError(
    'IDEMPOTENCY_PAYLOAD_MISMATCH',
    'This idempotency key was already used with a different payload.',
    { nextAction: 'Use a new idempotency key, or resend the original payload to read the original result.' },
  );

/**
 * GAP-E02. Consent gate for children's personal data.
 * DPDP Act 2023 §9 requires verifiable parental consent before processing a child's
 * personal data. Blocking here — rather than at the UI — keeps the rule enforceable
 * through the API, imports and background jobs alike.
 */
export const consentRequired = (subject: string) =>
  new DomainError('CONSENT_REQUIRED', `Verifiable guardian consent is not on record for ${subject}.`, {
    nextAction: 'Record guardian consent (purpose and version) before processing this personal data.',
  });
