/**
 * Closed vocabularies.
 * Values transcribed verbatim from Khelo_Sanand_Data_and_Functions.xlsx → Data_Dictionary.
 * Anything marked GAP-* is an addition; see docs/GAP_REGISTER.md for the reason.
 */

/* ---------------------------------------------------------------- *
 * M01 — Event, school, venue
 * ---------------------------------------------------------------- */
export const EVENT_STATUS = ['Setup', 'Registration', 'Ready', 'Live', 'Closed', 'Archived'] as const;
export type EventStatus = (typeof EVENT_STATUS)[number];

/** Legal forward transitions. Status_Flows sheet; nothing else is permitted. */
export const EVENT_STATUS_TRANSITIONS: Record<EventStatus, readonly EventStatus[]> = {
  Setup: ['Registration'],
  Registration: ['Ready'],
  Ready: ['Live', 'Registration'],
  Live: ['Closed'],
  Closed: ['Archived', 'Live'], // reopening Live is an audited ED action (§13)
  Archived: [],
};

export const PARTICIPATION_STATUS = ['Invited', 'Active', 'Inactive', 'Withdrawn'] as const;
export type ParticipationStatus = (typeof PARTICIPATION_STATUS)[number];

export const RESOURCE_TYPE = [
  'Court', 'Track', 'ThrowArea', 'JumpArea', 'CyclingCourse', 'ChessArea', 'TugArea',
] as const;
export type ResourceType = (typeof RESOURCE_TYPE)[number];

export const AVAILABILITY_KIND = ['Available', 'Blocked'] as const;
export type AvailabilityKind = (typeof AVAILABILITY_KIND)[number];

export const SPORT_PARTICIPATION_STATUS = ['Active', 'Withdrawn'] as const;
export type SportParticipationStatus = (typeof SPORT_PARTICIPATION_STATUS)[number];

/* ---------------------------------------------------------------- *
 * M02 — Users and access
 * ---------------------------------------------------------------- */
export const ROLE = ['ED', 'CH', 'VOL'] as const;
export type Role = (typeof ROLE)[number];

export const MEMBERSHIP_STATUS = ['Invited', 'Active', 'Inactive'] as const;
export type MembershipStatus = (typeof MEMBERSHIP_STATUS)[number];

export const SCOPE_TYPE = ['School', 'Pool', 'Fixture', 'Cluster'] as const;
export type ScopeType = (typeof SCOPE_TYPE)[number];

/* ---------------------------------------------------------------- *
 * M03 — Assignments
 * ---------------------------------------------------------------- */
export const DUTY_ROLE = ['PrimaryScorer', 'Support', 'Reviewer'] as const;
export type DutyRole = (typeof DUTY_ROLE)[number];

export const ASSIGNMENT_STATUS = ['Assigned', 'Replaced', 'Cancelled'] as const;
export type AssignmentStatus = (typeof ASSIGNMENT_STATUS)[number];

/* ---------------------------------------------------------------- *
 * M04 — Athletes, entries, imports
 * ---------------------------------------------------------------- */
export const REGISTRATION_STATUS = ['Draft', 'Active', 'Withdrawn', 'Inactive'] as const;
export type RegistrationStatus = (typeof REGISTRATION_STATUS)[number];

export const ELIGIBILITY_STATUS = ['Pending', 'Eligible', 'Ineligible', 'Exception'] as const;
export type EligibilityStatus = (typeof ELIGIBILITY_STATUS)[number];

export const ENTRY_STATUS = ['Draft', 'Active', 'Withdrawn'] as const;
export type EntryStatus = (typeof ENTRY_STATUS)[number];

export const ELIGIBILITY_OUTCOME = ['Pass', 'Fail', 'Pending', 'Override'] as const;
export type EligibilityOutcome = (typeof ELIGIBILITY_OUTCOME)[number];

export const ROSTER_STATUS = ['Draft', 'Locked'] as const;
export type RosterStatus = (typeof ROSTER_STATUS)[number];

export const DOCUMENT_OWNER_TYPE = ['Athlete', 'Entry', 'Scorecard', 'Import'] as const;
export type DocumentOwnerType = (typeof DOCUMENT_OWNER_TYPE)[number];

export const VERIFICATION_STATUS = ['Pending', 'Verified', 'Rejected'] as const;
export type VerificationStatus = (typeof VERIFICATION_STATUS)[number];

export const IMPORT_MODE = ['Create', 'Update', 'Upsert'] as const;
export type ImportMode = (typeof IMPORT_MODE)[number];

export const IMPORT_STATUS = [
  'Queued', 'Validating', 'Preview', 'Running', 'Completed', 'Partial', 'Failed', 'Cancelled',
] as const;
export type ImportStatus = (typeof IMPORT_STATUS)[number];

export const IMPORT_ROW_OUTCOME = ['Created', 'Updated', 'Skipped', 'Failed', 'Pending'] as const;
export type ImportRowOutcome = (typeof IMPORT_ROW_OUTCOME)[number];

/* ---------------------------------------------------------------- *
 * M05 — Sports, competitions, rules
 * ---------------------------------------------------------------- */
export const CALCULATION_FAMILY = [
  'Raid', 'Turn', 'Time', 'Attempts', 'Chess', 'Pulls', 'Games', 'Sets',
] as const;
export type CalculationFamily = (typeof CALCULATION_FAMILY)[number];

export const PARTICIPANT_MODE = ['Individual', 'Team', 'Selectable'] as const;
export type ParticipantMode = (typeof PARTICIPANT_MODE)[number];

export const APPROVAL_STATUS = ['Draft', 'Approved'] as const;
export type ApprovalStatus = (typeof APPROVAL_STATUS)[number];

export const RULE_APPROVAL_STATUS = ['Draft', 'Approved', 'Retired'] as const;
export type RuleApprovalStatus = (typeof RULE_APPROVAL_STATUS)[number];

export const COMPETITION_FORMAT = [
  'Knockout', 'RoundRobin', 'GroupsKnockout', 'HeatsFinal', 'DirectFinal', 'Swiss',
] as const;
export type CompetitionFormat = (typeof COMPETITION_FORMAT)[number];

export const COMPETITION_STATUS = ['Draft', 'Published', 'Live', 'Closed'] as const;
export type CompetitionStatus = (typeof COMPETITION_STATUS)[number];

export const STAGE_TYPE = ['Group', 'Heat', 'Final', 'KnockoutRound', 'ChessRound'] as const;
export type StageType = (typeof STAGE_TYPE)[number];

export const STAGE_STATUS = ['Draft', 'Published', 'Completed'] as const;
export type StageStatus = (typeof STAGE_STATUS)[number];

/* ---------------------------------------------------------------- *
 * M06 — Fixtures
 * ---------------------------------------------------------------- */
export const FIXTURE_LIFECYCLE = [
  'Draft', 'Ready', 'InProgress', 'Paused', 'Completed', 'Abandoned', 'Cancelled',
] as const;
export type FixtureLifecycle = (typeof FIXTURE_LIFECYCLE)[number];

/** Status_Flows sheet. Cancelled/Abandoned are reachable from Ready and InProgress. */
export const FIXTURE_TRANSITIONS: Record<FixtureLifecycle, readonly FixtureLifecycle[]> = {
  Draft: ['Ready', 'Cancelled'],
  Ready: ['InProgress', 'Cancelled', 'Draft'],
  InProgress: ['Paused', 'Completed', 'Abandoned'],
  Paused: ['InProgress', 'Abandoned'],
  Completed: [],
  Abandoned: [],
  Cancelled: [],
};

export const PUBLICATION = ['Unpublished', 'Published'] as const;
export type Publication = (typeof PUBLICATION)[number];

export const FIXTURE_PARTICIPANT_STATUS = ['Expected', 'Confirmed', 'Withdrawn'] as const;
export type FixtureParticipantStatus = (typeof FIXTURE_PARTICIPANT_STATUS)[number];

export const DEPENDENCY_STATUS = ['Pending', 'Resolved', 'Invalidated'] as const;
export type DependencyStatus = (typeof DEPENDENCY_STATUS)[number];

/* ---------------------------------------------------------------- *
 * M07 — Attendance
 * ---------------------------------------------------------------- */
export const DUTY_SESSION_MODE = ['Daily', 'Shift'] as const;
export type DutySessionMode = (typeof DUTY_SESSION_MODE)[number];

export const DUTY_SESSION_STATUS = ['Open', 'Closed'] as const;
export type DutySessionStatus = (typeof DUTY_SESSION_STATUS)[number];

export const EXPECTATION = ['Expected', 'Excused', 'Cancelled'] as const;
export type Expectation = (typeof EXPECTATION)[number];

export const ATTENDANCE_STATUS = [
  'Missing', 'Present', 'Late', 'Absent', 'Excused', 'PendingReview',
] as const;
export type AttendanceStatus = (typeof ATTENDANCE_STATUS)[number];

export const ATTENDANCE_SOURCE = ['Self', 'CH', 'ED', 'OfflineClaim'] as const;
export type AttendanceSource = (typeof ATTENDANCE_SOURCE)[number];

/* ---------------------------------------------------------------- *
 * M08 — Kits and stock
 * ---------------------------------------------------------------- */
export const MOVEMENT_TYPE = ['Receipt', 'Issue', 'Transfer', 'Return', 'Adjustment'] as const;
export type MovementType = (typeof MOVEMENT_TYPE)[number];

/** getKitStatus output. Optional unissued items never make a kit Partial (AT-023). */
export const KIT_FULFILMENT = ['Pending', 'Partial', 'Issued'] as const;
export type KitFulfilment = (typeof KIT_FULFILMENT)[number];

/* ---------------------------------------------------------------- *
 * M09 — Scorecards and results
 * ---------------------------------------------------------------- */
export const REVISION_STATUS = [
  'Draft', 'Submitted', 'Returned', 'Approved', 'Locked', 'Superseded',
] as const;
export type RevisionStatus = (typeof REVISION_STATUS)[number];

export const REVISION_TRANSITIONS: Record<RevisionStatus, readonly RevisionStatus[]> = {
  Draft: ['Submitted'],
  Submitted: ['Approved', 'Returned'],
  Returned: ['Draft'],
  Approved: ['Locked'],
  Locked: ['Superseded'], // only via amendLockedResult, which creates a new revision
  Superseded: [],
};

export const REVIEW_ACTION = ['Submit', 'Return', 'Approve', 'Lock', 'Override'] as const;
export type ReviewAction = (typeof REVIEW_ACTION)[number];

/**
 * Participant completion status.
 * A non-Completed status must never receive an ordinary numeric rank (GT-005, AT/§15).
 */
export const RESULT_STATUS = [
  'Completed', 'DNS', 'DNF', 'DQ', 'NM', 'Retired', 'Walkover', 'Bye',
] as const;
export type ResultStatus = (typeof RESULT_STATUS)[number];

/** Statuses that may hold a numeric rank. Everything else is unranked by construction. */
export const RANKABLE_STATUSES: readonly ResultStatus[] = ['Completed'];

export const AMENDMENT_STATUS = ['Requested', 'Review', 'Approved', 'Rejected', 'Applied'] as const;
export type AmendmentStatus = (typeof AMENDMENT_STATUS)[number];

export const PUBLICATION_ACTION = ['Publish', 'Withdraw'] as const;
export type PublicationAction = (typeof PUBLICATION_ACTION)[number];

export const PUBLICATION_AUDIENCE = ['Internal', 'Public'] as const;
export type PublicationAudience = (typeof PUBLICATION_AUDIENCE)[number];

/* ---------------------------------------------------------------- *
 * M10 — Notifications
 * ---------------------------------------------------------------- */
export const CHANNEL = ['InApp', 'Email', 'SMS', 'WhatsApp'] as const;
export type Channel = (typeof CHANNEL)[number];

export const DELIVERY_STATUS = ['Pending', 'Delivered', 'Failed'] as const;
export type DeliveryStatus = (typeof DELIVERY_STATUS)[number];

export const ATTEMPT_OUTCOME = ['Success', 'RetryableFailure', 'PermanentFailure'] as const;
export type AttemptOutcome = (typeof ATTEMPT_OUTCOME)[number];

/* ---------------------------------------------------------------- *
 * M11 / M12 — Reports, audit, administration
 * ---------------------------------------------------------------- */
export const REPORT_STATUS = ['Queued', 'Running', 'Completed', 'Failed', 'Expired'] as const;
export type ReportStatus = (typeof REPORT_STATUS)[number];

export const EXCEPTION_STATUS = ['Open', 'InReview', 'Resolved', 'Rejected'] as const;
export type ExceptionStatus = (typeof EXCEPTION_STATUS)[number];

export const EXCEPTION_PRIORITY = ['Low', 'Normal', 'Urgent'] as const;
export type ExceptionPriority = (typeof EXCEPTION_PRIORITY)[number];

export const CONFIG_STATUS = ['Draft', 'Approved', 'Active', 'Retired'] as const;
export type ConfigStatus = (typeof CONFIG_STATUS)[number];

export const RECOVERY_OUTCOME = ['Running', 'Passed', 'Failed'] as const;
export type RecoveryOutcome = (typeof RECOVERY_OUTCOME)[number];

export const JOB_STATUS = [
  'Queued', 'Running', 'Completed', 'Partial', 'Failed', 'Cancelled',
] as const;
export type JobStatus = (typeof JOB_STATUS)[number];

/**
 * Data classification. Drives field-level visibility (§1 "allowed fields")
 * and redaction in logs, exports and notification payloads.
 */
export const DATA_CLASS = ['Operational', 'Restricted', 'Sensitive'] as const;
export type DataClass = (typeof DATA_CLASS)[number];

/* ---------------------------------------------------------------- *
 * Discipline codes — the confirmed programme (§15).
 * 11 game groups, 13 discipline codes (each sprint distance is separate).
 * ---------------------------------------------------------------- */
export const DISCIPLINE_CODE = [
  'KAB', 'SP30', 'SP50', 'SP60', 'KHO', 'SBT', 'KJT', 'CYC', 'CHE', 'SBJ', 'TOW', 'BAD', 'VOL',
] as const;
export type DisciplineCode = (typeof DISCIPLINE_CODE)[number];

export const DISCIPLINE_CALCULATOR: Record<DisciplineCode, CalculationFamily> = {
  KAB: 'Raid',
  SP30: 'Time', SP50: 'Time', SP60: 'Time',
  KHO: 'Turn',
  SBT: 'Attempts', KJT: 'Attempts', SBJ: 'Attempts',
  CYC: 'Time',
  CHE: 'Chess',
  TOW: 'Pulls',
  BAD: 'Games',
  VOL: 'Sets',
};

export const DISCIPLINE_PARTICIPANT_MODE: Record<DisciplineCode, ParticipantMode> = {
  KAB: 'Team', KHO: 'Team', TOW: 'Team', VOL: 'Team',
  SP30: 'Individual', SP50: 'Individual', SP60: 'Individual',
  SBT: 'Individual', KJT: 'Individual', SBJ: 'Individual',
  CYC: 'Individual', CHE: 'Individual',
  BAD: 'Selectable', // singles or two-person pair (§25)
};

export const DISCIPLINE_LABEL: Record<DisciplineCode, string> = {
  KAB: 'Kabaddi',
  SP30: 'Sprint 30 m', SP50: 'Sprint 50 m', SP60: 'Sprint 60 m',
  KHO: 'Kho Kho',
  SBT: 'Softball Throw',
  KJT: 'Kids Javelin Throw',
  CYC: 'Cycling',
  CHE: 'Chess',
  SBJ: 'Standing Broad Jump',
  TOW: 'Tug of War',
  BAD: 'Badminton',
  VOL: 'Volleyball',
};
