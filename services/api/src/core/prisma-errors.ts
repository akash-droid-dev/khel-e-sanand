/**
 * Translate database constraint violations into the specification's error taxonomy.
 *
 * The constraints in `prisma/migrations/*_integrity_constraints` are the last line of
 * defence for rules the modules also check. When one fires it usually means a race
 * the application layer could not see — two people issuing the last kit, two pool
 * transfers landing together. §1 requires those to surface as named business errors
 * with a remedy, not as an opaque 500.
 *
 * Anything genuinely unexpected is deliberately NOT translated: it stays a 500 with
 * a request id, because inventing a business meaning for an unknown failure is worse
 * than admitting the request could not be completed.
 */
import { Prisma } from '@prisma/client';
import {
  DomainError, duplicateKey, capacityConflict, dependencyBlocked, validationFailed,
} from '@khel/contracts';

/** Named constraints whose violation has a specific, user-facing meaning. */
const CONSTRAINT_MEANINGS: Record<string, () => DomainError> = {
  school_one_active_ch_uq: () => capacityConflict(
    'This school already has an active responsible Cluster Head. End that assignment ' +
    'before creating another.'),
  volunteer_one_active_pool_uq: () => capacityConflict(
    'This volunteer already has an active pool. A transfer must end the current pool ' +
    'in the same operation.'),
  fixture_one_primary_scorer_uq: () => capacityConflict(
    'This fixture already has an assigned primary scorer. Replace the incumbent rather ' +
    'than adding a second.'),
  fixture_one_reviewer_uq: () => capacityConflict(
    'This fixture already has an accountable reviewer.'),
  scorecard_one_editable_revision_uq: () => capacityConflict(
    'This scorecard already has an editable revision. Submit or discard it first.'),
  consent_one_active_per_purpose_uq: () => duplicateKey(
    'An active consent already exists for this athlete and purpose. Withdraw it before ' +
    'recording a new one.'),
  guardian_one_primary_uq: () => duplicateKey(
    'This athlete already has a primary guardian.'),
  fixture_resource_no_overlap_excl: () => capacityConflict(
    'Another published fixture already occupies this resource for an overlapping period.'),
  result_rank_requires_completed_ck: () => validationFailed(
    'A rank can only be recorded against a Completed result. DNS, DNF, DQ and NM carry ' +
    'a status and no rank.'),
  fixture_participant_exactly_one_ck: () => validationFailed(
    'A fixture participant must be exactly one of an individual entry or a team.'),
  attendance_checkout_ck: () => validationFailed(
    'A check-out cannot precede its check-in.'),
  consent_withdrawal_consistent_ck: () => validationFailed(
    'A withdrawn consent must record when it was withdrawn, and a live consent must not.'),
  school_udise_format_ck: () => validationFailed(
    'A UDISE+ code is exactly 11 digits.'),
  school_pincode_format_ck: () => validationFailed(
    'An Indian PIN code is six digits beginning 1–8.'),
  document_sighted_last_four_ck: () => validationFailed(
    'Only the last four digits of a sighted identity document may be stored.'),
  guardian_mobile_format_ck: () => validationFailed(
    'Enter a valid Indian mobile number (10 digits beginning 6–9).'),
  volunteer_mobile_format_ck: () => validationFailed(
    'Enter a valid Indian mobile number (10 digits beginning 6–9).'),
};

/** Pull a constraint or index name out of a Postgres error message. */
function constraintNameFrom(message: string): string | undefined {
  const named = /constraint "([^"]+)"/.exec(message) ?? /"([a-z0-9_]+)"/.exec(message);
  return named?.[1];
}

/**
 * Returns a DomainError when the failure has a defined business meaning,
 * otherwise undefined so the caller reports an internal error.
 */
export function translatePrismaError(error: unknown): DomainError | undefined {
  if (error instanceof DomainError) return error;

  const message =
    error instanceof Prisma.PrismaClientKnownRequestError ||
    error instanceof Prisma.PrismaClientUnknownRequestError
      ? error.message : '';

  const constraint = constraintNameFrom(message);
  if (constraint) {
    const known = CONSTRAINT_MEANINGS[constraint];
    if (known) return known();
  }

  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    switch (error.code) {
      case 'P2002':  // unique constraint
        return duplicateKey(
          String((error.meta as { target?: string[] } | undefined)?.target?.join(', ') ?? 'record'));
      case 'P2003':  // foreign key
        return dependencyBlocked(
          'A referenced record does not exist or is still in use.');
      case 'P2025':  // record not found
        return validationFailed('The record was not found.');
      default:
        break;
    }
  }

  // A CHECK violation we have not named: still a business validation failure, but
  // report it generically rather than guessing which rule the user broke.
  if (message.includes('violates check constraint')) {
    return validationFailed(
      `The change breaks a data integrity rule${constraint ? ` (${constraint})` : ''}.`,
    );
  }
  if (message.includes('violates exclusion constraint')) {
    return capacityConflict('The change conflicts with an existing booking.');
  }
  return undefined;
}
