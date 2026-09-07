-- CreateEnum
CREATE TYPE "AmendmentStatus" AS ENUM ('Requested', 'Review', 'Approved', 'Rejected', 'Applied');

-- CreateEnum
CREATE TYPE "ApprovalStatus" AS ENUM ('Draft', 'Approved');

-- CreateEnum
CREATE TYPE "AssignmentStatus" AS ENUM ('Assigned', 'Replaced', 'Cancelled');

-- CreateEnum
CREATE TYPE "AttemptOutcome" AS ENUM ('Success', 'RetryableFailure', 'PermanentFailure');

-- CreateEnum
CREATE TYPE "AttendanceSource" AS ENUM ('Self', 'CH', 'ED', 'OfflineClaim');

-- CreateEnum
CREATE TYPE "AttendanceStatus" AS ENUM ('Missing', 'Present', 'Late', 'Absent', 'Excused', 'PendingReview');

-- CreateEnum
CREATE TYPE "AvailabilityKind" AS ENUM ('Available', 'Blocked');

-- CreateEnum
CREATE TYPE "CalculationFamily" AS ENUM ('Raid', 'Turn', 'Time', 'Attempts', 'Chess', 'Pulls', 'Games', 'Sets');

-- CreateEnum
CREATE TYPE "Channel" AS ENUM ('InApp', 'Email', 'SMS', 'WhatsApp');

-- CreateEnum
CREATE TYPE "CompetitionFormat" AS ENUM ('Knockout', 'RoundRobin', 'GroupsKnockout', 'HeatsFinal', 'DirectFinal', 'Swiss');

-- CreateEnum
CREATE TYPE "CompetitionStatus" AS ENUM ('Draft', 'Published', 'Live', 'Closed');

-- CreateEnum
CREATE TYPE "ConfigStatus" AS ENUM ('Draft', 'Approved', 'Active', 'Retired');

-- CreateEnum
CREATE TYPE "DeliveryStatus" AS ENUM ('Pending', 'Delivered', 'Failed');

-- CreateEnum
CREATE TYPE "DependencyStatus" AS ENUM ('Pending', 'Resolved', 'Invalidated');

-- CreateEnum
CREATE TYPE "DocumentOwnerType" AS ENUM ('Athlete', 'Entry', 'Scorecard', 'Import');

-- CreateEnum
CREATE TYPE "DutyRole" AS ENUM ('PrimaryScorer', 'Support', 'Reviewer');

-- CreateEnum
CREATE TYPE "DutySessionMode" AS ENUM ('Daily', 'Shift');

-- CreateEnum
CREATE TYPE "DutySessionStatus" AS ENUM ('Open', 'Closed');

-- CreateEnum
CREATE TYPE "EligibilityOutcome" AS ENUM ('Pass', 'Fail', 'Pending', 'Override');

-- CreateEnum
CREATE TYPE "EligibilityStatus" AS ENUM ('Pending', 'Eligible', 'Ineligible', 'Exception');

-- CreateEnum
CREATE TYPE "EntryStatus" AS ENUM ('Draft', 'Active', 'Withdrawn');

-- CreateEnum
CREATE TYPE "EventStatus" AS ENUM ('Setup', 'Registration', 'Ready', 'Live', 'Closed', 'Archived');

-- CreateEnum
CREATE TYPE "ExceptionPriority" AS ENUM ('Low', 'Normal', 'Urgent');

-- CreateEnum
CREATE TYPE "ExceptionStatus" AS ENUM ('Open', 'InReview', 'Resolved', 'Rejected');

-- CreateEnum
CREATE TYPE "Expectation" AS ENUM ('Expected', 'Excused', 'Cancelled');

-- CreateEnum
CREATE TYPE "FixtureLifecycle" AS ENUM ('Draft', 'Ready', 'InProgress', 'Paused', 'Completed', 'Abandoned', 'Cancelled');

-- CreateEnum
CREATE TYPE "FixtureParticipantStatus" AS ENUM ('Expected', 'Confirmed', 'Withdrawn');

-- CreateEnum
CREATE TYPE "ImportMode" AS ENUM ('Create', 'Update', 'Upsert');

-- CreateEnum
CREATE TYPE "ImportRowOutcome" AS ENUM ('Created', 'Updated', 'Skipped', 'Failed', 'Pending');

-- CreateEnum
CREATE TYPE "ImportStatus" AS ENUM ('Queued', 'Validating', 'Preview', 'Running', 'Completed', 'Partial', 'Failed', 'Cancelled');

-- CreateEnum
CREATE TYPE "JobStatus" AS ENUM ('Queued', 'Running', 'Completed', 'Partial', 'Failed', 'Cancelled');

-- CreateEnum
CREATE TYPE "MembershipStatus" AS ENUM ('Invited', 'Active', 'Inactive');

-- CreateEnum
CREATE TYPE "MovementType" AS ENUM ('Receipt', 'Issue', 'Transfer', 'Return', 'Adjustment');

-- CreateEnum
CREATE TYPE "ParticipantMode" AS ENUM ('Individual', 'Team', 'Selectable');

-- CreateEnum
CREATE TYPE "ParticipationStatus" AS ENUM ('Invited', 'Active', 'Inactive', 'Withdrawn');

-- CreateEnum
CREATE TYPE "Publication" AS ENUM ('Unpublished', 'Published');

-- CreateEnum
CREATE TYPE "PublicationAction" AS ENUM ('Publish', 'Withdraw');

-- CreateEnum
CREATE TYPE "PublicationAudience" AS ENUM ('Internal', 'Public');

-- CreateEnum
CREATE TYPE "RecoveryOutcome" AS ENUM ('Running', 'Passed', 'Failed');

-- CreateEnum
CREATE TYPE "RegistrationStatus" AS ENUM ('Draft', 'Active', 'Withdrawn', 'Inactive');

-- CreateEnum
CREATE TYPE "ReportStatus" AS ENUM ('Queued', 'Running', 'Completed', 'Failed', 'Expired');

-- CreateEnum
CREATE TYPE "ResourceType" AS ENUM ('Court', 'Track', 'ThrowArea', 'JumpArea', 'CyclingCourse', 'ChessArea', 'TugArea');

-- CreateEnum
CREATE TYPE "ResultStatus" AS ENUM ('Completed', 'DNS', 'DNF', 'DQ', 'NM', 'Retired', 'Walkover', 'Bye');

-- CreateEnum
CREATE TYPE "ReviewActionType" AS ENUM ('Submit', 'Return', 'Approve', 'Lock', 'Override');

-- CreateEnum
CREATE TYPE "RevisionStatus" AS ENUM ('Draft', 'Submitted', 'Returned', 'Approved', 'Locked', 'Superseded');

-- CreateEnum
CREATE TYPE "Role" AS ENUM ('ED', 'CH', 'VOL');

-- CreateEnum
CREATE TYPE "RosterStatus" AS ENUM ('Draft', 'Locked');

-- CreateEnum
CREATE TYPE "RuleApprovalStatus" AS ENUM ('Draft', 'Approved', 'Retired');

-- CreateEnum
CREATE TYPE "ScopeType" AS ENUM ('School', 'Pool', 'Fixture', 'Cluster');

-- CreateEnum
CREATE TYPE "SportParticipationStatus" AS ENUM ('Active', 'Withdrawn');

-- CreateEnum
CREATE TYPE "StageStatus" AS ENUM ('Draft', 'Published', 'Completed');

-- CreateEnum
CREATE TYPE "StageType" AS ENUM ('Group', 'Heat', 'Final', 'KnockoutRound', 'ChessRound');

-- CreateEnum
CREATE TYPE "VerificationStatus" AS ENUM ('Pending', 'Verified', 'Rejected');

-- CreateEnum
CREATE TYPE "SchoolBoard" AS ENUM ('GSEB', 'CBSE', 'ICSE', 'NIOS', 'IB', 'IGCSE', 'Other');

-- CreateEnum
CREATE TYPE "SchoolManagement" AS ENUM ('Government', 'LocalBody', 'GovernmentAided', 'PrivateUnaided', 'CentralGovernment', 'Other');

-- CreateEnum
CREATE TYPE "MediumOfInstruction" AS ENUM ('Gujarati', 'Hindi', 'English', 'Marathi', 'Other');

-- CreateEnum
CREATE TYPE "Standard" AS ENUM ('Balvatika', 'Std1', 'Std2', 'Std3', 'Std4', 'Std5', 'Std6', 'Std7', 'Std8', 'Std9', 'Std10', 'Std11', 'Std12');

-- CreateEnum
CREATE TYPE "ParticipationCategory" AS ENUM ('Boys', 'Girls', 'Mixed', 'Open');

-- CreateEnum
CREATE TYPE "GuardianRelation" AS ENUM ('Father', 'Mother', 'LegalGuardian', 'Other');

-- CreateEnum
CREATE TYPE "ConsentPurpose" AS ENUM ('EventParticipation', 'MedicalEmergency', 'PhotographyMedia', 'PublicResults');

-- CreateEnum
CREATE TYPE "ConsentStatus" AS ENUM ('Granted', 'Withdrawn', 'Expired');

-- CreateEnum
CREATE TYPE "ConsentMethod" AS ENUM ('SignedPaperForm', 'SchoolAttested', 'DigitalOtpVerified');

-- CreateEnum
CREATE TYPE "DocumentType" AS ENUM ('BirthCertificate', 'SchoolBonafide', 'TransferCertificate', 'SchoolIdCard', 'AadhaarSighted', 'MedicalFitness', 'GuardianConsent', 'Photograph', 'Other');

-- CreateEnum
CREATE TYPE "Locale" AS ENUM ('gu', 'hi', 'en');

-- CreateTable
CREATE TABLE "events" (
    "id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" UUID NOT NULL,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "updated_by" UUID NOT NULL,
    "row_version" INTEGER NOT NULL DEFAULT 1,
    "event_code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "timezone" TEXT NOT NULL,
    "start_date" DATE NOT NULL,
    "end_date" DATE NOT NULL,
    "status" "EventStatus" NOT NULL,
    "registration_opens_at" TIMESTAMPTZ(3),
    "registration_closes_at" TIMESTAMPTZ(3),
    "configuration_version" INTEGER NOT NULL,
    "academic_year" TEXT,
    "default_locale" "Locale" NOT NULL DEFAULT 'gu',

    CONSTRAINT "events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "schools" (
    "id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" UUID NOT NULL,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "updated_by" UUID NOT NULL,
    "row_version" INTEGER NOT NULL DEFAULT 1,
    "school_code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "district" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "contact_name" TEXT NOT NULL,
    "phone" TEXT,
    "email" TEXT,
    "active" BOOLEAN NOT NULL,
    "name_local" TEXT,
    "udise_code" TEXT,
    "state_code" TEXT,
    "taluka" TEXT,
    "pincode" TEXT,
    "board" "SchoolBoard",
    "management_type" "SchoolManagement",
    "medium_of_instruction" "MediumOfInstruction",

    CONSTRAINT "schools_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "event_schools" (
    "id" UUID NOT NULL,
    "event_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" UUID NOT NULL,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "updated_by" UUID NOT NULL,
    "row_version" INTEGER NOT NULL DEFAULT 1,
    "school_id" UUID NOT NULL,
    "participation_status" "ParticipationStatus" NOT NULL,
    "notes" TEXT,

    CONSTRAINT "event_schools_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "clusters" (
    "id" UUID NOT NULL,
    "event_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" UUID NOT NULL,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "updated_by" UUID NOT NULL,
    "row_version" INTEGER NOT NULL DEFAULT 1,
    "cluster_code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL,

    CONSTRAINT "clusters_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "venues" (
    "id" UUID NOT NULL,
    "event_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" UUID NOT NULL,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "updated_by" UUID NOT NULL,
    "row_version" INTEGER NOT NULL DEFAULT 1,
    "venue_code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "contact_name" TEXT,
    "contact_phone" TEXT,
    "active" BOOLEAN NOT NULL,

    CONSTRAINT "venues_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "venue_resources" (
    "id" UUID NOT NULL,
    "event_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" UUID NOT NULL,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "updated_by" UUID NOT NULL,
    "row_version" INTEGER NOT NULL DEFAULT 1,
    "venue_id" UUID NOT NULL,
    "resource_code" TEXT NOT NULL,
    "resource_type" "ResourceType" NOT NULL,
    "capacity" INTEGER NOT NULL,
    "compatible_disciplines" JSONB NOT NULL,
    "active" BOOLEAN NOT NULL,

    CONSTRAINT "venue_resources_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "resource_availabilities" (
    "id" UUID NOT NULL,
    "event_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" UUID NOT NULL,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "updated_by" UUID NOT NULL,
    "row_version" INTEGER NOT NULL DEFAULT 1,
    "resource_id" UUID NOT NULL,
    "starts_at" TIMESTAMPTZ(3) NOT NULL,
    "ends_at" TIMESTAMPTZ(3) NOT NULL,
    "kind" "AvailabilityKind" NOT NULL,
    "reason" TEXT,

    CONSTRAINT "resource_availabilities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "school_sport_participations" (
    "id" UUID NOT NULL,
    "event_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" UUID NOT NULL,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "updated_by" UUID NOT NULL,
    "row_version" INTEGER NOT NULL DEFAULT 1,
    "event_school_id" UUID NOT NULL,
    "competition_id" UUID NOT NULL,
    "status" "SportParticipationStatus" NOT NULL,

    CONSTRAINT "school_sport_participations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" UUID NOT NULL,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "updated_by" UUID NOT NULL,
    "row_version" INTEGER NOT NULL DEFAULT 1,
    "user_code" TEXT NOT NULL,
    "display_name" TEXT NOT NULL,
    "mobile" TEXT,
    "email" TEXT,
    "provider_subject" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL,
    "last_login_at" TIMESTAMPTZ(3),

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "event_memberships" (
    "id" UUID NOT NULL,
    "event_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" UUID NOT NULL,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "updated_by" UUID NOT NULL,
    "row_version" INTEGER NOT NULL DEFAULT 1,
    "user_id" UUID NOT NULL,
    "role" "Role" NOT NULL,
    "status" "MembershipStatus" NOT NULL,
    "permissions_version" INTEGER NOT NULL,

    CONSTRAINT "event_memberships_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "volunteer_profiles" (
    "id" UUID NOT NULL,
    "event_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" UUID NOT NULL,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "updated_by" UUID NOT NULL,
    "row_version" INTEGER NOT NULL DEFAULT 1,
    "membership_id" UUID NOT NULL,
    "skills" JSONB,
    "language" TEXT NOT NULL,
    "address" TEXT,
    "emergency_name" TEXT,
    "emergency_phone" TEXT,
    "kit_size" TEXT,
    "preferred_locale" "Locale",
    "mobile_e164" TEXT,

    CONSTRAINT "volunteer_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessions" (
    "id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" UUID NOT NULL,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "updated_by" UUID NOT NULL,
    "row_version" INTEGER NOT NULL DEFAULT 1,
    "user_id" UUID NOT NULL,
    "issued_at" TIMESTAMPTZ(3) NOT NULL,
    "expires_at" TIMESTAMPTZ(3) NOT NULL,
    "revoked_at" TIMESTAMPTZ(3),
    "device_label" TEXT,
    "token_hash" TEXT NOT NULL,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scope_grants" (
    "id" UUID NOT NULL,
    "event_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" UUID NOT NULL,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "updated_by" UUID NOT NULL,
    "row_version" INTEGER NOT NULL DEFAULT 1,
    "membership_id" UUID NOT NULL,
    "action" TEXT NOT NULL,
    "scope_type" "ScopeType" NOT NULL,
    "scope_id" UUID NOT NULL,
    "expires_at" TIMESTAMPTZ(3) NOT NULL,
    "reason" TEXT NOT NULL,
    "granted_by" UUID NOT NULL,
    "revoked_at" TIMESTAMPTZ(3),

    CONSTRAINT "scope_grants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "school_c_h_assignments" (
    "id" UUID NOT NULL,
    "event_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" UUID NOT NULL,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "updated_by" UUID NOT NULL,
    "row_version" INTEGER NOT NULL DEFAULT 1,
    "event_school_id" UUID NOT NULL,
    "cluster_id" UUID NOT NULL,
    "ch_membership_id" UUID NOT NULL,
    "effective_from" TIMESTAMPTZ(3) NOT NULL,
    "effective_to" TIMESTAMPTZ(3),
    "reason" TEXT,

    CONSTRAINT "school_c_h_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "volunteer_pool_assignments" (
    "id" UUID NOT NULL,
    "event_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" UUID NOT NULL,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "updated_by" UUID NOT NULL,
    "row_version" INTEGER NOT NULL DEFAULT 1,
    "volunteer_membership_id" UUID NOT NULL,
    "cluster_id" UUID NOT NULL,
    "ch_membership_id" UUID NOT NULL,
    "effective_from" TIMESTAMPTZ(3) NOT NULL,
    "effective_to" TIMESTAMPTZ(3),

    CONSTRAINT "volunteer_pool_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "volunteer_school_assignments" (
    "id" UUID NOT NULL,
    "event_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" UUID NOT NULL,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "updated_by" UUID NOT NULL,
    "row_version" INTEGER NOT NULL DEFAULT 1,
    "volunteer_membership_id" UUID NOT NULL,
    "event_school_id" UUID NOT NULL,
    "responsibility" TEXT NOT NULL,
    "effective_from" TIMESTAMPTZ(3) NOT NULL,
    "effective_to" TIMESTAMPTZ(3),

    CONSTRAINT "volunteer_school_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fixture_assignments" (
    "id" UUID NOT NULL,
    "event_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" UUID NOT NULL,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "updated_by" UUID NOT NULL,
    "row_version" INTEGER NOT NULL DEFAULT 1,
    "fixture_id" UUID NOT NULL,
    "membership_id" UUID NOT NULL,
    "duty_role" "DutyRole" NOT NULL,
    "starts_at" TIMESTAMPTZ(3) NOT NULL,
    "ends_at" TIMESTAMPTZ(3) NOT NULL,
    "status" "AssignmentStatus" NOT NULL,

    CONSTRAINT "fixture_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "duty_availabilities" (
    "id" UUID NOT NULL,
    "event_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" UUID NOT NULL,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "updated_by" UUID NOT NULL,
    "row_version" INTEGER NOT NULL DEFAULT 1,
    "membership_id" UUID NOT NULL,
    "starts_at" TIMESTAMPTZ(3) NOT NULL,
    "ends_at" TIMESTAMPTZ(3) NOT NULL,
    "available" BOOLEAN NOT NULL,
    "note" TEXT,

    CONSTRAINT "duty_availabilities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "athletes" (
    "id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" UUID NOT NULL,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "updated_by" UUID NOT NULL,
    "row_version" INTEGER NOT NULL DEFAULT 1,
    "athlete_code" TEXT NOT NULL,
    "display_name" TEXT NOT NULL,
    "date_of_birth" DATE,
    "category_attributes" JSONB,
    "active" BOOLEAN NOT NULL,
    "display_name_local" TEXT,
    "given_name" TEXT,
    "family_name" TEXT,

    CONSTRAINT "athletes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "athlete_registrations" (
    "id" UUID NOT NULL,
    "event_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" UUID NOT NULL,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "updated_by" UUID NOT NULL,
    "row_version" INTEGER NOT NULL DEFAULT 1,
    "athlete_id" UUID NOT NULL,
    "event_school_id" UUID NOT NULL,
    "event_athlete_code" TEXT NOT NULL,
    "status" "RegistrationStatus" NOT NULL,
    "grade" TEXT,
    "notes" TEXT,
    "standard" "Standard",
    "section" TEXT,

    CONSTRAINT "athlete_registrations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "competition_entries" (
    "id" UUID NOT NULL,
    "event_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" UUID NOT NULL,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "updated_by" UUID NOT NULL,
    "row_version" INTEGER NOT NULL DEFAULT 1,
    "registration_id" UUID NOT NULL,
    "competition_id" UUID NOT NULL,
    "eligibility_status" "EligibilityStatus" NOT NULL,
    "eligibility_rule_id" UUID NOT NULL,
    "entry_status" "EntryStatus" NOT NULL,
    "bib" TEXT,
    "seed_value" DECIMAL(18,6),

    CONSTRAINT "competition_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "eligibility_decisions" (
    "id" UUID NOT NULL,
    "event_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" UUID NOT NULL,
    "entry_id" UUID NOT NULL,
    "criterion_code" TEXT NOT NULL,
    "supplied_value" JSONB,
    "outcome" "EligibilityOutcome" NOT NULL,
    "reason" TEXT NOT NULL,
    "reviewer_id" UUID,
    "reviewed_at" TIMESTAMPTZ(3),
    "rule_version_id" UUID NOT NULL,

    CONSTRAINT "eligibility_decisions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "teams" (
    "id" UUID NOT NULL,
    "event_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" UUID NOT NULL,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "updated_by" UUID NOT NULL,
    "row_version" INTEGER NOT NULL DEFAULT 1,
    "team_code" TEXT NOT NULL,
    "event_school_id" UUID NOT NULL,
    "competition_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "roster_status" "RosterStatus" NOT NULL,
    "locked_at" TIMESTAMPTZ(3),

    CONSTRAINT "teams_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "team_members" (
    "id" UUID NOT NULL,
    "event_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" UUID NOT NULL,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "updated_by" UUID NOT NULL,
    "row_version" INTEGER NOT NULL DEFAULT 1,
    "team_id" UUID NOT NULL,
    "entry_id" UUID NOT NULL,
    "jersey_number" TEXT,
    "position_label" TEXT,
    "active" BOOLEAN NOT NULL,

    CONSTRAINT "team_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "documents" (
    "id" UUID NOT NULL,
    "event_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" UUID NOT NULL,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "updated_by" UUID NOT NULL,
    "row_version" INTEGER NOT NULL DEFAULT 1,
    "owner_type" "DocumentOwnerType" NOT NULL,
    "owner_id" UUID NOT NULL,
    "document_type" TEXT NOT NULL,
    "object_key" TEXT NOT NULL,
    "mime_type" TEXT NOT NULL,
    "size_bytes" INTEGER NOT NULL,
    "checksum" TEXT NOT NULL,
    "verification_status" "VerificationStatus" NOT NULL,
    "verified_by" UUID,
    "verified_at" TIMESTAMPTZ(3),
    "document_type_code" "DocumentType",
    "retention_expires_at" TIMESTAMPTZ(3),
    "sighted_last_four" TEXT,

    CONSTRAINT "documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "import_jobs" (
    "id" UUID NOT NULL,
    "event_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" UUID NOT NULL,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "updated_by" UUID NOT NULL,
    "row_version" INTEGER NOT NULL DEFAULT 1,
    "entity_type" TEXT NOT NULL,
    "template_version" TEXT NOT NULL,
    "mode" "ImportMode" NOT NULL,
    "source_document_id" UUID NOT NULL,
    "idempotency_key" TEXT NOT NULL,
    "status" "ImportStatus" NOT NULL,
    "row_counts" JSONB NOT NULL,
    "error_document_id" UUID,

    CONSTRAINT "import_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "import_rows" (
    "id" UUID NOT NULL,
    "event_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" UUID NOT NULL,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "updated_by" UUID NOT NULL,
    "row_version" INTEGER NOT NULL DEFAULT 1,
    "job_id" UUID NOT NULL,
    "source_row_number" INTEGER NOT NULL,
    "group_key" TEXT,
    "match_key" TEXT NOT NULL,
    "outcome" "ImportRowOutcome" NOT NULL,
    "errors" JSONB,
    "target_id" UUID,
    "safe_input" JSONB,

    CONSTRAINT "import_rows_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sports" (
    "id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" UUID NOT NULL,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "updated_by" UUID NOT NULL,
    "row_version" INTEGER NOT NULL DEFAULT 1,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL,

    CONSTRAINT "sports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "disciplines" (
    "id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" UUID NOT NULL,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "updated_by" UUID NOT NULL,
    "row_version" INTEGER NOT NULL DEFAULT 1,
    "sport_id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "distance_m" DECIMAL(18,6),
    "calculation_family" "CalculationFamily" NOT NULL,
    "participant_mode" "ParticipantMode" NOT NULL,

    CONSTRAINT "disciplines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "categories" (
    "id" UUID NOT NULL,
    "event_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" UUID NOT NULL,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "updated_by" UUID NOT NULL,
    "row_version" INTEGER NOT NULL DEFAULT 1,
    "category_code" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "dob_min" DATE,
    "dob_max" DATE,
    "cutoff_date" DATE,
    "criteria" JSONB NOT NULL,
    "approval_status" "ApprovalStatus" NOT NULL,
    "participation_category" "ParticipationCategory" NOT NULL DEFAULT 'Open',
    "under_age_years" INTEGER,

    CONSTRAINT "categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rule_versions" (
    "id" UUID NOT NULL,
    "event_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" UUID NOT NULL,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "updated_by" UUID NOT NULL,
    "row_version" INTEGER NOT NULL DEFAULT 1,
    "discipline_id" UUID NOT NULL,
    "version_no" INTEGER NOT NULL,
    "approval_status" "RuleApprovalStatus" NOT NULL,
    "settings" JSONB NOT NULL,
    "source_reference" TEXT NOT NULL,
    "effective_from" DATE,
    "approved_by" UUID,
    "approved_at" TIMESTAMPTZ(3),
    "checksum" TEXT NOT NULL,

    CONSTRAINT "rule_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "score_templates" (
    "id" UUID NOT NULL,
    "event_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" UUID NOT NULL,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "updated_by" UUID NOT NULL,
    "row_version" INTEGER NOT NULL DEFAULT 1,
    "rule_version_id" UUID NOT NULL,
    "template_version" INTEGER NOT NULL,
    "fields_schema" JSONB NOT NULL,
    "calculator_version" TEXT NOT NULL,
    "preview_cases" JSONB NOT NULL,

    CONSTRAINT "score_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "competitions" (
    "id" UUID NOT NULL,
    "event_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" UUID NOT NULL,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "updated_by" UUID NOT NULL,
    "row_version" INTEGER NOT NULL DEFAULT 1,
    "competition_code" TEXT NOT NULL,
    "discipline_id" UUID NOT NULL,
    "category_id" UUID NOT NULL,
    "format" "CompetitionFormat" NOT NULL,
    "rule_version_id" UUID NOT NULL,
    "entry_limit" INTEGER,
    "status" "CompetitionStatus" NOT NULL,

    CONSTRAINT "competitions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "competition_stages" (
    "id" UUID NOT NULL,
    "event_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" UUID NOT NULL,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "updated_by" UUID NOT NULL,
    "row_version" INTEGER NOT NULL DEFAULT 1,
    "competition_id" UUID NOT NULL,
    "stage_code" TEXT NOT NULL,
    "stage_type" "StageType" NOT NULL,
    "sequence" INTEGER NOT NULL,
    "progression_rule" JSONB NOT NULL,
    "status" "StageStatus" NOT NULL,

    CONSTRAINT "competition_stages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fixtures" (
    "id" UUID NOT NULL,
    "event_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" UUID NOT NULL,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "updated_by" UUID NOT NULL,
    "row_version" INTEGER NOT NULL DEFAULT 1,
    "fixture_code" TEXT NOT NULL,
    "competition_id" UUID NOT NULL,
    "stage_id" UUID NOT NULL,
    "resource_id" UUID NOT NULL,
    "scheduled_start" TIMESTAMPTZ(3) NOT NULL,
    "scheduled_end" TIMESTAMPTZ(3) NOT NULL,
    "reporting_at" TIMESTAMPTZ(3) NOT NULL,
    "actual_start" TIMESTAMPTZ(3),
    "actual_end" TIMESTAMPTZ(3),
    "lifecycle" "FixtureLifecycle" NOT NULL,
    "publication" "Publication" NOT NULL,
    "owner_ch_id" UUID NOT NULL,
    "rule_version_id" UUID NOT NULL,

    CONSTRAINT "fixtures_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fixture_participants" (
    "id" UUID NOT NULL,
    "event_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" UUID NOT NULL,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "updated_by" UUID NOT NULL,
    "row_version" INTEGER NOT NULL DEFAULT 1,
    "fixture_id" UUID NOT NULL,
    "entry_id" UUID,
    "team_id" UUID,
    "slot" TEXT NOT NULL,
    "participation_snapshot" JSONB NOT NULL,
    "status" "FixtureParticipantStatus" NOT NULL,

    CONSTRAINT "fixture_participants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fixture_dependencies" (
    "id" UUID NOT NULL,
    "event_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" UUID NOT NULL,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "updated_by" UUID NOT NULL,
    "row_version" INTEGER NOT NULL DEFAULT 1,
    "source_fixture_id" UUID NOT NULL,
    "target_fixture_id" UUID NOT NULL,
    "source_position" TEXT NOT NULL,
    "target_slot" TEXT NOT NULL,
    "result_snapshot_id" UUID,
    "status" "DependencyStatus" NOT NULL,

    CONSTRAINT "fixture_dependencies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "start_lists" (
    "id" UUID NOT NULL,
    "event_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" UUID NOT NULL,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "updated_by" UUID NOT NULL,
    "row_version" INTEGER NOT NULL DEFAULT 1,
    "participant_id" UUID NOT NULL,
    "lane_or_board" TEXT,
    "bib" TEXT,
    "starting_order" INTEGER,
    "official_start_at" TIMESTAMPTZ(3),
    "locked_at" TIMESTAMPTZ(3),

    CONSTRAINT "start_lists_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "duty_sessions" (
    "id" UUID NOT NULL,
    "event_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" UUID NOT NULL,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "updated_by" UUID NOT NULL,
    "row_version" INTEGER NOT NULL DEFAULT 1,
    "session_code" TEXT NOT NULL,
    "local_date" DATE NOT NULL,
    "mode" "DutySessionMode" NOT NULL,
    "starts_at" TIMESTAMPTZ(3) NOT NULL,
    "ends_at" TIMESTAMPTZ(3) NOT NULL,
    "venue_id" UUID,
    "status" "DutySessionStatus" NOT NULL,

    CONSTRAINT "duty_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "expected_duties" (
    "id" UUID NOT NULL,
    "event_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" UUID NOT NULL,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "updated_by" UUID NOT NULL,
    "row_version" INTEGER NOT NULL DEFAULT 1,
    "session_id" UUID NOT NULL,
    "volunteer_id" UUID NOT NULL,
    "expectation" "Expectation" NOT NULL,
    "snapshot_cluster_id" UUID NOT NULL,

    CONSTRAINT "expected_duties_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "attendances" (
    "id" UUID NOT NULL,
    "event_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" UUID NOT NULL,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "updated_by" UUID NOT NULL,
    "row_version" INTEGER NOT NULL DEFAULT 1,
    "expected_duty_id" UUID NOT NULL,
    "check_in_at" TIMESTAMPTZ(3),
    "check_out_at" TIMESTAMPTZ(3),
    "claimed_client_at" TIMESTAMPTZ(3),
    "received_at" TIMESTAMPTZ(3) NOT NULL,
    "status" "AttendanceStatus" NOT NULL,
    "source" "AttendanceSource" NOT NULL,
    "final_override_by" UUID,

    CONSTRAINT "attendances_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "attendance_corrections" (
    "id" UUID NOT NULL,
    "event_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" UUID NOT NULL,
    "attendance_id" UUID NOT NULL,
    "before_values" JSONB NOT NULL,
    "after_values" JSONB NOT NULL,
    "reason" TEXT NOT NULL,
    "actor_id" UUID NOT NULL,

    CONSTRAINT "attendance_corrections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "kit_items" (
    "id" UUID NOT NULL,
    "event_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" UUID NOT NULL,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "updated_by" UUID NOT NULL,
    "row_version" INTEGER NOT NULL DEFAULT 1,
    "item_code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "unit" TEXT NOT NULL,
    "variants" JSONB,
    "active" BOOLEAN NOT NULL,

    CONSTRAINT "kit_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "kit_entitlements" (
    "id" UUID NOT NULL,
    "event_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" UUID NOT NULL,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "updated_by" UUID NOT NULL,
    "row_version" INTEGER NOT NULL DEFAULT 1,
    "volunteer_id" UUID NOT NULL,
    "item_id" UUID NOT NULL,
    "variant" TEXT,
    "required_quantity" INTEGER NOT NULL,
    "entitlement_version" INTEGER NOT NULL,

    CONSTRAINT "kit_entitlements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stock_locations" (
    "id" UUID NOT NULL,
    "event_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" UUID NOT NULL,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "updated_by" UUID NOT NULL,
    "row_version" INTEGER NOT NULL DEFAULT 1,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "cluster_id" UUID,

    CONSTRAINT "stock_locations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "kit_issues" (
    "id" UUID NOT NULL,
    "event_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" UUID NOT NULL,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "updated_by" UUID NOT NULL,
    "row_version" INTEGER NOT NULL DEFAULT 1,
    "entitlement_id" UUID NOT NULL,
    "quantity" INTEGER NOT NULL,
    "stock_location_id" UUID,
    "issued_at" TIMESTAMPTZ(3) NOT NULL,
    "issued_by" UUID NOT NULL,
    "acknowledged_at" TIMESTAMPTZ(3),
    "reissue_of_id" UUID,
    "reason" TEXT,
    "idempotency_key" TEXT NOT NULL,

    CONSTRAINT "kit_issues_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stock_movements" (
    "id" UUID NOT NULL,
    "event_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" UUID NOT NULL,
    "location_id" UUID NOT NULL,
    "item_id" UUID NOT NULL,
    "variant" TEXT,
    "quantity_delta" INTEGER NOT NULL,
    "movement_type" "MovementType" NOT NULL,
    "issue_id" UUID,
    "transfer_group" UUID,
    "reason" TEXT NOT NULL,

    CONSTRAINT "stock_movements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scorecards" (
    "id" UUID NOT NULL,
    "event_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" UUID NOT NULL,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "updated_by" UUID NOT NULL,
    "row_version" INTEGER NOT NULL DEFAULT 1,
    "fixture_id" UUID NOT NULL,
    "current_revision_no" INTEGER NOT NULL,

    CONSTRAINT "scorecards_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scorecard_revisions" (
    "id" UUID NOT NULL,
    "event_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" UUID NOT NULL,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "updated_by" UUID NOT NULL,
    "row_version" INTEGER NOT NULL DEFAULT 1,
    "scorecard_id" UUID NOT NULL,
    "revision_no" INTEGER NOT NULL,
    "rule_version_id" UUID NOT NULL,
    "template_id" UUID NOT NULL,
    "status" "RevisionStatus" NOT NULL,
    "raw_payload" JSONB NOT NULL,
    "calculated_result" JSONB NOT NULL,
    "checksum" TEXT NOT NULL,
    "submitted_at" TIMESTAMPTZ(3),
    "locked_at" TIMESTAMPTZ(3),

    CONSTRAINT "scorecard_revisions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "score_observations" (
    "id" UUID NOT NULL,
    "event_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" UUID NOT NULL,
    "revision_id" UUID NOT NULL,
    "observation_type" TEXT NOT NULL,
    "sequence" INTEGER NOT NULL,
    "participant_id" UUID,
    "payload" JSONB NOT NULL,
    "supersedes_id" UUID,
    "idempotency_key" TEXT NOT NULL,

    CONSTRAINT "score_observations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "review_actions" (
    "id" UUID NOT NULL,
    "event_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" UUID NOT NULL,
    "revision_id" UUID NOT NULL,
    "action" "ReviewActionType" NOT NULL,
    "actor_id" UUID NOT NULL,
    "comment" TEXT,
    "reviewed_checksum" TEXT NOT NULL,

    CONSTRAINT "review_actions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "result_snapshots" (
    "id" UUID NOT NULL,
    "event_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" UUID NOT NULL,
    "revision_id" UUID NOT NULL,
    "participant_id" UUID NOT NULL,
    "status" "ResultStatus" NOT NULL,
    "rank" INTEGER,
    "primary_value" DECIMAL(18,6),
    "unit" TEXT,
    "tie_values" JSONB,
    "identity_snapshot" JSONB NOT NULL,

    CONSTRAINT "result_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "amendments" (
    "id" UUID NOT NULL,
    "event_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" UUID NOT NULL,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "updated_by" UUID NOT NULL,
    "row_version" INTEGER NOT NULL DEFAULT 1,
    "original_revision_id" UUID NOT NULL,
    "replacement_revision_id" UUID NOT NULL,
    "reason" TEXT NOT NULL,
    "impact" JSONB NOT NULL,
    "status" "AmendmentStatus" NOT NULL,
    "approved_by" UUID,

    CONSTRAINT "amendments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification_events" (
    "id" UUID NOT NULL,
    "event_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" UUID NOT NULL,
    "event_type" TEXT NOT NULL,
    "target_type" TEXT NOT NULL,
    "target_id" UUID NOT NULL,
    "target_version" INTEGER NOT NULL,
    "safe_payload" JSONB NOT NULL,

    CONSTRAINT "notification_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification_recipients" (
    "id" UUID NOT NULL,
    "event_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" UUID NOT NULL,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "updated_by" UUID NOT NULL,
    "row_version" INTEGER NOT NULL DEFAULT 1,
    "notification_event_id" UUID NOT NULL,
    "membership_id" UUID NOT NULL,
    "channel" "Channel" NOT NULL,
    "read_at" TIMESTAMPTZ(3),
    "delivery_status" "DeliveryStatus" NOT NULL,
    "action_target" TEXT NOT NULL,

    CONSTRAINT "notification_recipients_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "delivery_attempts" (
    "id" UUID NOT NULL,
    "event_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" UUID NOT NULL,
    "recipient_id" UUID NOT NULL,
    "attempt_no" INTEGER NOT NULL,
    "outcome" "AttemptOutcome" NOT NULL,
    "next_retry_at" TIMESTAMPTZ(3),
    "safe_error" TEXT,

    CONSTRAINT "delivery_attempts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "report_jobs" (
    "id" UUID NOT NULL,
    "event_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" UUID NOT NULL,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "updated_by" UUID NOT NULL,
    "row_version" INTEGER NOT NULL DEFAULT 1,
    "requester_id" UUID NOT NULL,
    "report_type" TEXT NOT NULL,
    "filters" JSONB NOT NULL,
    "columns" JSONB NOT NULL,
    "status" "ReportStatus" NOT NULL,
    "generated_at" TIMESTAMPTZ(3),
    "document_id" UUID,
    "expires_at" TIMESTAMPTZ(3),

    CONSTRAINT "report_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "aggregate_snapshots" (
    "id" UUID NOT NULL,
    "event_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" UUID NOT NULL,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "updated_by" UUID NOT NULL,
    "row_version" INTEGER NOT NULL DEFAULT 1,
    "metric_code" TEXT NOT NULL,
    "scope_filter" JSONB NOT NULL,
    "values" JSONB NOT NULL,
    "calculated_at" TIMESTAMPTZ(3) NOT NULL,
    "source_watermark" TEXT NOT NULL,

    CONSTRAINT "aggregate_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_events" (
    "id" UUID NOT NULL,
    "event_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" UUID NOT NULL,
    "actor_id" UUID NOT NULL,
    "effective_role" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "entity_type" TEXT NOT NULL,
    "entity_id" UUID NOT NULL,
    "safe_diff" JSONB NOT NULL,
    "reason" TEXT,
    "request_id" TEXT NOT NULL,

    CONSTRAINT "audit_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "exception_cases" (
    "id" UUID NOT NULL,
    "event_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" UUID NOT NULL,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "updated_by" UUID NOT NULL,
    "row_version" INTEGER NOT NULL DEFAULT 1,
    "case_type" TEXT NOT NULL,
    "entity_type" TEXT NOT NULL,
    "entity_id" UUID NOT NULL,
    "owner_id" UUID NOT NULL,
    "status" "ExceptionStatus" NOT NULL,
    "priority" "ExceptionPriority" NOT NULL,
    "reason" TEXT NOT NULL,
    "resolution" TEXT,

    CONSTRAINT "exception_cases_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "configuration_versions" (
    "id" UUID NOT NULL,
    "event_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" UUID NOT NULL,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "updated_by" UUID NOT NULL,
    "row_version" INTEGER NOT NULL DEFAULT 1,
    "version_no" INTEGER NOT NULL,
    "settings" JSONB NOT NULL,
    "status" "ConfigStatus" NOT NULL,
    "approved_by" UUID,
    "effective_at" TIMESTAMPTZ(3),
    "impact_preview" JSONB NOT NULL,

    CONSTRAINT "configuration_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recovery_runs" (
    "id" UUID NOT NULL,
    "event_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" UUID NOT NULL,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "updated_by" UUID NOT NULL,
    "row_version" INTEGER NOT NULL DEFAULT 1,
    "backup_reference" TEXT NOT NULL,
    "initiated_at" TIMESTAMPTZ(3) NOT NULL,
    "completed_at" TIMESTAMPTZ(3),
    "outcome" "RecoveryOutcome" NOT NULL,
    "evidence_reference" TEXT,
    "notes" TEXT,

    CONSTRAINT "recovery_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "job_runs" (
    "id" UUID NOT NULL,
    "event_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" UUID NOT NULL,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "updated_by" UUID NOT NULL,
    "row_version" INTEGER NOT NULL DEFAULT 1,
    "job_type" TEXT NOT NULL,
    "target_id" UUID NOT NULL,
    "status" "JobStatus" NOT NULL,
    "attempts" INTEGER NOT NULL,
    "progress" JSONB NOT NULL,
    "safe_error" TEXT,
    "request_id" TEXT NOT NULL,

    CONSTRAINT "job_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "result_publications" (
    "id" UUID NOT NULL,
    "event_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" UUID NOT NULL,
    "result_snapshot_id" UUID NOT NULL,
    "action" "PublicationAction" NOT NULL,
    "audience" "PublicationAudience" NOT NULL,
    "published_fields" JSONB NOT NULL,
    "reason" TEXT,

    CONSTRAINT "result_publications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subscription_preferences" (
    "id" UUID NOT NULL,
    "event_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" UUID NOT NULL,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "updated_by" UUID NOT NULL,
    "row_version" INTEGER NOT NULL DEFAULT 1,
    "membership_id" UUID NOT NULL,
    "channels" JSONB NOT NULL,
    "digest_interval_minutes" INTEGER,
    "optional_triggers" JSONB NOT NULL,

    CONSTRAINT "subscription_preferences_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "guardians" (
    "id" UUID NOT NULL,
    "event_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" UUID NOT NULL,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "updated_by" UUID NOT NULL,
    "row_version" INTEGER NOT NULL DEFAULT 1,
    "athlete_id" UUID NOT NULL,
    "relation" "GuardianRelation" NOT NULL,
    "full_name" TEXT NOT NULL,
    "full_name_local" TEXT,
    "mobile_e164" TEXT,
    "email" TEXT,
    "is_primary" BOOLEAN NOT NULL DEFAULT false,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "guardians_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "consent_records" (
    "id" UUID NOT NULL,
    "event_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" UUID NOT NULL,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "updated_by" UUID NOT NULL,
    "row_version" INTEGER NOT NULL DEFAULT 1,
    "athlete_id" UUID NOT NULL,
    "guardian_id" UUID NOT NULL,
    "purpose" "ConsentPurpose" NOT NULL,
    "status" "ConsentStatus" NOT NULL DEFAULT 'Granted',
    "method" "ConsentMethod" NOT NULL,
    "notice_version" TEXT NOT NULL,
    "notice_locale" "Locale" NOT NULL,
    "granted_at" TIMESTAMPTZ(3) NOT NULL,
    "withdrawn_at" TIMESTAMPTZ(3),
    "withdrawal_reason" TEXT,
    "expires_at" TIMESTAMPTZ(3),
    "evidence_document_id" UUID,
    "recorded_by_membership_id" UUID NOT NULL,

    CONSTRAINT "consent_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "idempotency_keys" (
    "id" UUID NOT NULL,
    "event_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "idempotency_key" TEXT NOT NULL,
    "membership_id" UUID NOT NULL,
    "command" TEXT NOT NULL,
    "payload_hash" TEXT NOT NULL,
    "response_body" JSONB NOT NULL,
    "response_status" INTEGER NOT NULL,
    "request_id" TEXT NOT NULL,

    CONSTRAINT "idempotency_keys_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "outbox_messages" (
    "id" UUID NOT NULL,
    "event_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "topic" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "dedupe_key" TEXT NOT NULL,
    "available_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "last_error" TEXT,
    "processed_at" TIMESTAMPTZ(3),
    "dead_lettered_at" TIMESTAMPTZ(3),

    CONSTRAINT "outbox_messages_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "events_event_code_key" ON "events"("event_code");

-- CreateIndex
CREATE INDEX "schools_district_taluka_idx" ON "schools"("district", "taluka");

-- CreateIndex
CREATE UNIQUE INDEX "schools_school_code_key" ON "schools"("school_code");

-- CreateIndex
CREATE UNIQUE INDEX "schools_udise_code_key" ON "schools"("udise_code");

-- CreateIndex
CREATE INDEX "event_schools_event_id_participation_status_idx" ON "event_schools"("event_id", "participation_status");

-- CreateIndex
CREATE UNIQUE INDEX "event_schools_event_id_school_id_key" ON "event_schools"("event_id", "school_id");

-- CreateIndex
CREATE UNIQUE INDEX "clusters_event_id_cluster_code_key" ON "clusters"("event_id", "cluster_code");

-- CreateIndex
CREATE UNIQUE INDEX "venues_event_id_name_key" ON "venues"("event_id", "name");

-- CreateIndex
CREATE INDEX "venue_resources_event_id_resource_type_idx" ON "venue_resources"("event_id", "resource_type");

-- CreateIndex
CREATE UNIQUE INDEX "venue_resources_venue_id_resource_code_key" ON "venue_resources"("venue_id", "resource_code");

-- CreateIndex
CREATE INDEX "resource_availabilities_resource_id_starts_at_ends_at_idx" ON "resource_availabilities"("resource_id", "starts_at", "ends_at");

-- CreateIndex
CREATE UNIQUE INDEX "users_user_code_key" ON "users"("user_code");

-- CreateIndex
CREATE INDEX "event_memberships_event_id_role_status_idx" ON "event_memberships"("event_id", "role", "status");

-- CreateIndex
CREATE UNIQUE INDEX "event_memberships_event_id_user_id_key" ON "event_memberships"("event_id", "user_id");

-- CreateIndex
CREATE INDEX "scope_grants_event_id_membership_id_expires_at_idx" ON "scope_grants"("event_id", "membership_id", "expires_at");

-- CreateIndex
CREATE INDEX "school_c_h_assignments_event_id_event_school_id_effective_f_idx" ON "school_c_h_assignments"("event_id", "event_school_id", "effective_from");

-- CreateIndex
CREATE INDEX "school_c_h_assignments_event_id_ch_membership_id_idx" ON "school_c_h_assignments"("event_id", "ch_membership_id");

-- CreateIndex
CREATE INDEX "volunteer_pool_assignments_event_id_volunteer_membership_id_idx" ON "volunteer_pool_assignments"("event_id", "volunteer_membership_id", "effective_from");

-- CreateIndex
CREATE INDEX "volunteer_school_assignments_event_id_volunteer_membership__idx" ON "volunteer_school_assignments"("event_id", "volunteer_membership_id");

-- CreateIndex
CREATE INDEX "volunteer_school_assignments_event_id_event_school_id_idx" ON "volunteer_school_assignments"("event_id", "event_school_id");

-- CreateIndex
CREATE INDEX "fixture_assignments_event_id_fixture_id_duty_role_status_idx" ON "fixture_assignments"("event_id", "fixture_id", "duty_role", "status");

-- CreateIndex
CREATE INDEX "fixture_assignments_event_id_membership_id_starts_at_idx" ON "fixture_assignments"("event_id", "membership_id", "starts_at");

-- CreateIndex
CREATE UNIQUE INDEX "athletes_athlete_code_key" ON "athletes"("athlete_code");

-- CreateIndex
CREATE INDEX "athlete_registrations_event_id_event_school_id_status_idx" ON "athlete_registrations"("event_id", "event_school_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "athlete_registrations_event_id_event_athlete_code_key" ON "athlete_registrations"("event_id", "event_athlete_code");

-- CreateIndex
CREATE INDEX "competition_entries_event_id_competition_id_entry_status_el_idx" ON "competition_entries"("event_id", "competition_id", "entry_status", "eligibility_status");

-- CreateIndex
CREATE UNIQUE INDEX "competition_entries_registration_id_competition_id_key" ON "competition_entries"("registration_id", "competition_id");

-- CreateIndex
CREATE INDEX "teams_event_id_competition_id_roster_status_idx" ON "teams"("event_id", "competition_id", "roster_status");

-- CreateIndex
CREATE UNIQUE INDEX "teams_event_id_team_code_key" ON "teams"("event_id", "team_code");

-- CreateIndex
CREATE INDEX "team_members_event_id_entry_id_idx" ON "team_members"("event_id", "entry_id");

-- CreateIndex
CREATE UNIQUE INDEX "team_members_team_id_entry_id_key" ON "team_members"("team_id", "entry_id");

-- CreateIndex
CREATE INDEX "documents_event_id_owner_type_owner_id_idx" ON "documents"("event_id", "owner_type", "owner_id");

-- CreateIndex
CREATE INDEX "documents_retention_expires_at_idx" ON "documents"("retention_expires_at");

-- CreateIndex
CREATE INDEX "import_rows_job_id_source_row_number_idx" ON "import_rows"("job_id", "source_row_number");

-- CreateIndex
CREATE UNIQUE INDEX "categories_event_id_category_code_key" ON "categories"("event_id", "category_code");

-- CreateIndex
CREATE INDEX "rule_versions_event_id_discipline_id_approval_status_idx" ON "rule_versions"("event_id", "discipline_id", "approval_status");

-- CreateIndex
CREATE INDEX "competitions_event_id_discipline_id_category_id_idx" ON "competitions"("event_id", "discipline_id", "category_id");

-- CreateIndex
CREATE UNIQUE INDEX "competitions_event_id_competition_code_key" ON "competitions"("event_id", "competition_code");

-- CreateIndex
CREATE INDEX "competition_stages_event_id_competition_id_sequence_idx" ON "competition_stages"("event_id", "competition_id", "sequence");

-- CreateIndex
CREATE UNIQUE INDEX "competition_stages_competition_id_stage_code_key" ON "competition_stages"("competition_id", "stage_code");

-- CreateIndex
CREATE INDEX "fixtures_event_id_resource_id_scheduled_start_scheduled_end_idx" ON "fixtures"("event_id", "resource_id", "scheduled_start", "scheduled_end");

-- CreateIndex
CREATE INDEX "fixtures_event_id_competition_id_stage_id_idx" ON "fixtures"("event_id", "competition_id", "stage_id");

-- CreateIndex
CREATE INDEX "fixtures_event_id_lifecycle_publication_idx" ON "fixtures"("event_id", "lifecycle", "publication");

-- CreateIndex
CREATE UNIQUE INDEX "fixtures_event_id_fixture_code_key" ON "fixtures"("event_id", "fixture_code");

-- CreateIndex
CREATE INDEX "fixture_participants_event_id_fixture_id_idx" ON "fixture_participants"("event_id", "fixture_id");

-- CreateIndex
CREATE INDEX "fixture_participants_event_id_entry_id_idx" ON "fixture_participants"("event_id", "entry_id");

-- CreateIndex
CREATE INDEX "fixture_participants_event_id_team_id_idx" ON "fixture_participants"("event_id", "team_id");

-- CreateIndex
CREATE INDEX "start_lists_event_id_starting_order_idx" ON "start_lists"("event_id", "starting_order");

-- CreateIndex
CREATE UNIQUE INDEX "start_lists_participant_id_key" ON "start_lists"("participant_id");

-- CreateIndex
CREATE UNIQUE INDEX "duty_sessions_event_id_local_date_venue_id_key" ON "duty_sessions"("event_id", "local_date", "venue_id");

-- CreateIndex
CREATE UNIQUE INDEX "expected_duties_session_id_volunteer_id_key" ON "expected_duties"("session_id", "volunteer_id");

-- CreateIndex
CREATE INDEX "attendances_event_id_status_idx" ON "attendances"("event_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "attendances_expected_duty_id_key" ON "attendances"("expected_duty_id");

-- CreateIndex
CREATE UNIQUE INDEX "kit_entitlements_event_id_volunteer_id_item_id_variant_key" ON "kit_entitlements"("event_id", "volunteer_id", "item_id", "variant");

-- CreateIndex
CREATE INDEX "kit_issues_event_id_entitlement_id_issued_at_idx" ON "kit_issues"("event_id", "entitlement_id", "issued_at");

-- CreateIndex
CREATE INDEX "stock_movements_event_id_location_id_item_id_created_at_idx" ON "stock_movements"("event_id", "location_id", "item_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "scorecards_fixture_id_key" ON "scorecards"("fixture_id");

-- CreateIndex
CREATE INDEX "scorecard_revisions_event_id_status_idx" ON "scorecard_revisions"("event_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "scorecard_revisions_scorecard_id_revision_no_key" ON "scorecard_revisions"("scorecard_id", "revision_no");

-- CreateIndex
CREATE INDEX "score_observations_revision_id_sequence_idx" ON "score_observations"("revision_id", "sequence");

-- CreateIndex
CREATE INDEX "review_actions_event_id_revision_id_created_at_idx" ON "review_actions"("event_id", "revision_id", "created_at");

-- CreateIndex
CREATE INDEX "result_snapshots_event_id_revision_id_idx" ON "result_snapshots"("event_id", "revision_id");

-- CreateIndex
CREATE INDEX "result_snapshots_event_id_participant_id_idx" ON "result_snapshots"("event_id", "participant_id");

-- CreateIndex
CREATE INDEX "notification_recipients_event_id_membership_id_read_at_idx" ON "notification_recipients"("event_id", "membership_id", "read_at");

-- CreateIndex
CREATE INDEX "audit_events_event_id_created_at_idx" ON "audit_events"("event_id", "created_at");

-- CreateIndex
CREATE INDEX "audit_events_event_id_actor_id_idx" ON "audit_events"("event_id", "actor_id");

-- CreateIndex
CREATE INDEX "audit_events_event_id_entity_type_entity_id_idx" ON "audit_events"("event_id", "entity_type", "entity_id");

-- CreateIndex
CREATE INDEX "exception_cases_event_id_status_priority_idx" ON "exception_cases"("event_id", "status", "priority");

-- CreateIndex
CREATE INDEX "job_runs_event_id_status_created_at_idx" ON "job_runs"("event_id", "status", "created_at");

-- CreateIndex
CREATE INDEX "guardians_event_id_athlete_id_idx" ON "guardians"("event_id", "athlete_id");

-- CreateIndex
CREATE INDEX "guardians_event_id_mobile_e164_idx" ON "guardians"("event_id", "mobile_e164");

-- CreateIndex
CREATE INDEX "consent_records_event_id_athlete_id_purpose_status_idx" ON "consent_records"("event_id", "athlete_id", "purpose", "status");

-- CreateIndex
CREATE INDEX "consent_records_event_id_status_expires_at_idx" ON "consent_records"("event_id", "status", "expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "consent_records_athlete_id_purpose_granted_at_key" ON "consent_records"("athlete_id", "purpose", "granted_at");

-- CreateIndex
CREATE INDEX "idempotency_keys_created_at_idx" ON "idempotency_keys"("created_at");

-- CreateIndex
CREATE UNIQUE INDEX "idempotency_keys_event_id_membership_id_command_idempotency_key" ON "idempotency_keys"("event_id", "membership_id", "command", "idempotency_key");

-- CreateIndex
CREATE INDEX "outbox_messages_processed_at_available_at_idx" ON "outbox_messages"("processed_at", "available_at");

-- CreateIndex
CREATE UNIQUE INDEX "outbox_messages_event_id_dedupe_key_key" ON "outbox_messages"("event_id", "dedupe_key");

-- AddForeignKey
ALTER TABLE "event_schools" ADD CONSTRAINT "event_schools_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_schools" ADD CONSTRAINT "event_schools_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clusters" ADD CONSTRAINT "clusters_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "venues" ADD CONSTRAINT "venues_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "venue_resources" ADD CONSTRAINT "venue_resources_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "venue_resources" ADD CONSTRAINT "venue_resources_venue_id_fkey" FOREIGN KEY ("venue_id") REFERENCES "venues"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "resource_availabilities" ADD CONSTRAINT "resource_availabilities_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "resource_availabilities" ADD CONSTRAINT "resource_availabilities_resource_id_fkey" FOREIGN KEY ("resource_id") REFERENCES "venue_resources"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "school_sport_participations" ADD CONSTRAINT "school_sport_participations_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "school_sport_participations" ADD CONSTRAINT "school_sport_participations_event_school_id_fkey" FOREIGN KEY ("event_school_id") REFERENCES "event_schools"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "school_sport_participations" ADD CONSTRAINT "school_sport_participations_competition_id_fkey" FOREIGN KEY ("competition_id") REFERENCES "competitions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_memberships" ADD CONSTRAINT "event_memberships_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_memberships" ADD CONSTRAINT "event_memberships_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "volunteer_profiles" ADD CONSTRAINT "volunteer_profiles_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "volunteer_profiles" ADD CONSTRAINT "volunteer_profiles_membership_id_fkey" FOREIGN KEY ("membership_id") REFERENCES "event_memberships"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scope_grants" ADD CONSTRAINT "scope_grants_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scope_grants" ADD CONSTRAINT "scope_grants_membership_id_fkey" FOREIGN KEY ("membership_id") REFERENCES "event_memberships"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scope_grants" ADD CONSTRAINT "scope_grants_granted_by_fkey" FOREIGN KEY ("granted_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "school_c_h_assignments" ADD CONSTRAINT "school_c_h_assignments_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "school_c_h_assignments" ADD CONSTRAINT "school_c_h_assignments_event_school_id_fkey" FOREIGN KEY ("event_school_id") REFERENCES "event_schools"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "school_c_h_assignments" ADD CONSTRAINT "school_c_h_assignments_cluster_id_fkey" FOREIGN KEY ("cluster_id") REFERENCES "clusters"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "school_c_h_assignments" ADD CONSTRAINT "school_c_h_assignments_ch_membership_id_fkey" FOREIGN KEY ("ch_membership_id") REFERENCES "event_memberships"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "volunteer_pool_assignments" ADD CONSTRAINT "volunteer_pool_assignments_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "volunteer_pool_assignments" ADD CONSTRAINT "volunteer_pool_assignments_volunteer_membership_id_fkey" FOREIGN KEY ("volunteer_membership_id") REFERENCES "event_memberships"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "volunteer_pool_assignments" ADD CONSTRAINT "volunteer_pool_assignments_cluster_id_fkey" FOREIGN KEY ("cluster_id") REFERENCES "clusters"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "volunteer_pool_assignments" ADD CONSTRAINT "volunteer_pool_assignments_ch_membership_id_fkey" FOREIGN KEY ("ch_membership_id") REFERENCES "event_memberships"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "volunteer_school_assignments" ADD CONSTRAINT "volunteer_school_assignments_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "volunteer_school_assignments" ADD CONSTRAINT "volunteer_school_assignments_volunteer_membership_id_fkey" FOREIGN KEY ("volunteer_membership_id") REFERENCES "event_memberships"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "volunteer_school_assignments" ADD CONSTRAINT "volunteer_school_assignments_event_school_id_fkey" FOREIGN KEY ("event_school_id") REFERENCES "event_schools"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fixture_assignments" ADD CONSTRAINT "fixture_assignments_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fixture_assignments" ADD CONSTRAINT "fixture_assignments_fixture_id_fkey" FOREIGN KEY ("fixture_id") REFERENCES "fixtures"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fixture_assignments" ADD CONSTRAINT "fixture_assignments_membership_id_fkey" FOREIGN KEY ("membership_id") REFERENCES "event_memberships"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "duty_availabilities" ADD CONSTRAINT "duty_availabilities_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "duty_availabilities" ADD CONSTRAINT "duty_availabilities_membership_id_fkey" FOREIGN KEY ("membership_id") REFERENCES "event_memberships"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "athlete_registrations" ADD CONSTRAINT "athlete_registrations_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "athlete_registrations" ADD CONSTRAINT "athlete_registrations_athlete_id_fkey" FOREIGN KEY ("athlete_id") REFERENCES "athletes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "athlete_registrations" ADD CONSTRAINT "athlete_registrations_event_school_id_fkey" FOREIGN KEY ("event_school_id") REFERENCES "event_schools"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "competition_entries" ADD CONSTRAINT "competition_entries_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "competition_entries" ADD CONSTRAINT "competition_entries_registration_id_fkey" FOREIGN KEY ("registration_id") REFERENCES "athlete_registrations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "competition_entries" ADD CONSTRAINT "competition_entries_competition_id_fkey" FOREIGN KEY ("competition_id") REFERENCES "competitions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "competition_entries" ADD CONSTRAINT "competition_entries_eligibility_rule_id_fkey" FOREIGN KEY ("eligibility_rule_id") REFERENCES "rule_versions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "eligibility_decisions" ADD CONSTRAINT "eligibility_decisions_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "eligibility_decisions" ADD CONSTRAINT "eligibility_decisions_entry_id_fkey" FOREIGN KEY ("entry_id") REFERENCES "competition_entries"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "eligibility_decisions" ADD CONSTRAINT "eligibility_decisions_reviewer_id_fkey" FOREIGN KEY ("reviewer_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "eligibility_decisions" ADD CONSTRAINT "eligibility_decisions_rule_version_id_fkey" FOREIGN KEY ("rule_version_id") REFERENCES "rule_versions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "teams" ADD CONSTRAINT "teams_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "teams" ADD CONSTRAINT "teams_event_school_id_fkey" FOREIGN KEY ("event_school_id") REFERENCES "event_schools"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "teams" ADD CONSTRAINT "teams_competition_id_fkey" FOREIGN KEY ("competition_id") REFERENCES "competitions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "team_members" ADD CONSTRAINT "team_members_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "team_members" ADD CONSTRAINT "team_members_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "teams"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "team_members" ADD CONSTRAINT "team_members_entry_id_fkey" FOREIGN KEY ("entry_id") REFERENCES "competition_entries"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_verified_by_fkey" FOREIGN KEY ("verified_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "import_jobs" ADD CONSTRAINT "import_jobs_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "import_jobs" ADD CONSTRAINT "import_jobs_source_document_id_fkey" FOREIGN KEY ("source_document_id") REFERENCES "documents"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "import_jobs" ADD CONSTRAINT "import_jobs_error_document_id_fkey" FOREIGN KEY ("error_document_id") REFERENCES "documents"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "import_rows" ADD CONSTRAINT "import_rows_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "import_rows" ADD CONSTRAINT "import_rows_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "import_jobs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "disciplines" ADD CONSTRAINT "disciplines_sport_id_fkey" FOREIGN KEY ("sport_id") REFERENCES "sports"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "categories" ADD CONSTRAINT "categories_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rule_versions" ADD CONSTRAINT "rule_versions_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rule_versions" ADD CONSTRAINT "rule_versions_discipline_id_fkey" FOREIGN KEY ("discipline_id") REFERENCES "disciplines"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rule_versions" ADD CONSTRAINT "rule_versions_approved_by_fkey" FOREIGN KEY ("approved_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "score_templates" ADD CONSTRAINT "score_templates_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "score_templates" ADD CONSTRAINT "score_templates_rule_version_id_fkey" FOREIGN KEY ("rule_version_id") REFERENCES "rule_versions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "competitions" ADD CONSTRAINT "competitions_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "competitions" ADD CONSTRAINT "competitions_discipline_id_fkey" FOREIGN KEY ("discipline_id") REFERENCES "disciplines"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "competitions" ADD CONSTRAINT "competitions_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "competitions" ADD CONSTRAINT "competitions_rule_version_id_fkey" FOREIGN KEY ("rule_version_id") REFERENCES "rule_versions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "competition_stages" ADD CONSTRAINT "competition_stages_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "competition_stages" ADD CONSTRAINT "competition_stages_competition_id_fkey" FOREIGN KEY ("competition_id") REFERENCES "competitions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fixtures" ADD CONSTRAINT "fixtures_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fixtures" ADD CONSTRAINT "fixtures_competition_id_fkey" FOREIGN KEY ("competition_id") REFERENCES "competitions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fixtures" ADD CONSTRAINT "fixtures_stage_id_fkey" FOREIGN KEY ("stage_id") REFERENCES "competition_stages"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fixtures" ADD CONSTRAINT "fixtures_resource_id_fkey" FOREIGN KEY ("resource_id") REFERENCES "venue_resources"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fixtures" ADD CONSTRAINT "fixtures_owner_ch_id_fkey" FOREIGN KEY ("owner_ch_id") REFERENCES "event_memberships"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fixtures" ADD CONSTRAINT "fixtures_rule_version_id_fkey" FOREIGN KEY ("rule_version_id") REFERENCES "rule_versions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fixture_participants" ADD CONSTRAINT "fixture_participants_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fixture_participants" ADD CONSTRAINT "fixture_participants_fixture_id_fkey" FOREIGN KEY ("fixture_id") REFERENCES "fixtures"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fixture_participants" ADD CONSTRAINT "fixture_participants_entry_id_fkey" FOREIGN KEY ("entry_id") REFERENCES "competition_entries"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fixture_participants" ADD CONSTRAINT "fixture_participants_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "teams"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fixture_dependencies" ADD CONSTRAINT "fixture_dependencies_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fixture_dependencies" ADD CONSTRAINT "fixture_dependencies_source_fixture_id_fkey" FOREIGN KEY ("source_fixture_id") REFERENCES "fixtures"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fixture_dependencies" ADD CONSTRAINT "fixture_dependencies_target_fixture_id_fkey" FOREIGN KEY ("target_fixture_id") REFERENCES "fixtures"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fixture_dependencies" ADD CONSTRAINT "fixture_dependencies_result_snapshot_id_fkey" FOREIGN KEY ("result_snapshot_id") REFERENCES "result_snapshots"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "start_lists" ADD CONSTRAINT "start_lists_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "start_lists" ADD CONSTRAINT "start_lists_participant_id_fkey" FOREIGN KEY ("participant_id") REFERENCES "fixture_participants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "duty_sessions" ADD CONSTRAINT "duty_sessions_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "duty_sessions" ADD CONSTRAINT "duty_sessions_venue_id_fkey" FOREIGN KEY ("venue_id") REFERENCES "venues"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expected_duties" ADD CONSTRAINT "expected_duties_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expected_duties" ADD CONSTRAINT "expected_duties_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "duty_sessions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expected_duties" ADD CONSTRAINT "expected_duties_volunteer_id_fkey" FOREIGN KEY ("volunteer_id") REFERENCES "event_memberships"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expected_duties" ADD CONSTRAINT "expected_duties_snapshot_cluster_id_fkey" FOREIGN KEY ("snapshot_cluster_id") REFERENCES "clusters"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendances" ADD CONSTRAINT "attendances_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendances" ADD CONSTRAINT "attendances_expected_duty_id_fkey" FOREIGN KEY ("expected_duty_id") REFERENCES "expected_duties"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendances" ADD CONSTRAINT "attendances_final_override_by_fkey" FOREIGN KEY ("final_override_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_corrections" ADD CONSTRAINT "attendance_corrections_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_corrections" ADD CONSTRAINT "attendance_corrections_attendance_id_fkey" FOREIGN KEY ("attendance_id") REFERENCES "attendances"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_corrections" ADD CONSTRAINT "attendance_corrections_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kit_items" ADD CONSTRAINT "kit_items_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kit_entitlements" ADD CONSTRAINT "kit_entitlements_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kit_entitlements" ADD CONSTRAINT "kit_entitlements_volunteer_id_fkey" FOREIGN KEY ("volunteer_id") REFERENCES "event_memberships"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kit_entitlements" ADD CONSTRAINT "kit_entitlements_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "kit_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_locations" ADD CONSTRAINT "stock_locations_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_locations" ADD CONSTRAINT "stock_locations_cluster_id_fkey" FOREIGN KEY ("cluster_id") REFERENCES "clusters"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kit_issues" ADD CONSTRAINT "kit_issues_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kit_issues" ADD CONSTRAINT "kit_issues_entitlement_id_fkey" FOREIGN KEY ("entitlement_id") REFERENCES "kit_entitlements"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kit_issues" ADD CONSTRAINT "kit_issues_stock_location_id_fkey" FOREIGN KEY ("stock_location_id") REFERENCES "stock_locations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kit_issues" ADD CONSTRAINT "kit_issues_issued_by_fkey" FOREIGN KEY ("issued_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kit_issues" ADD CONSTRAINT "kit_issues_reissue_of_id_fkey" FOREIGN KEY ("reissue_of_id") REFERENCES "kit_issues"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "stock_locations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "kit_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_issue_id_fkey" FOREIGN KEY ("issue_id") REFERENCES "kit_issues"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scorecards" ADD CONSTRAINT "scorecards_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scorecards" ADD CONSTRAINT "scorecards_fixture_id_fkey" FOREIGN KEY ("fixture_id") REFERENCES "fixtures"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scorecard_revisions" ADD CONSTRAINT "scorecard_revisions_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scorecard_revisions" ADD CONSTRAINT "scorecard_revisions_scorecard_id_fkey" FOREIGN KEY ("scorecard_id") REFERENCES "scorecards"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scorecard_revisions" ADD CONSTRAINT "scorecard_revisions_rule_version_id_fkey" FOREIGN KEY ("rule_version_id") REFERENCES "rule_versions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scorecard_revisions" ADD CONSTRAINT "scorecard_revisions_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "score_templates"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "score_observations" ADD CONSTRAINT "score_observations_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "score_observations" ADD CONSTRAINT "score_observations_revision_id_fkey" FOREIGN KEY ("revision_id") REFERENCES "scorecard_revisions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "score_observations" ADD CONSTRAINT "score_observations_participant_id_fkey" FOREIGN KEY ("participant_id") REFERENCES "fixture_participants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "score_observations" ADD CONSTRAINT "score_observations_supersedes_id_fkey" FOREIGN KEY ("supersedes_id") REFERENCES "score_observations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "review_actions" ADD CONSTRAINT "review_actions_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "review_actions" ADD CONSTRAINT "review_actions_revision_id_fkey" FOREIGN KEY ("revision_id") REFERENCES "scorecard_revisions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "review_actions" ADD CONSTRAINT "review_actions_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "result_snapshots" ADD CONSTRAINT "result_snapshots_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "result_snapshots" ADD CONSTRAINT "result_snapshots_revision_id_fkey" FOREIGN KEY ("revision_id") REFERENCES "scorecard_revisions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "result_snapshots" ADD CONSTRAINT "result_snapshots_participant_id_fkey" FOREIGN KEY ("participant_id") REFERENCES "fixture_participants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "amendments" ADD CONSTRAINT "amendments_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "amendments" ADD CONSTRAINT "amendments_original_revision_id_fkey" FOREIGN KEY ("original_revision_id") REFERENCES "scorecard_revisions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "amendments" ADD CONSTRAINT "amendments_replacement_revision_id_fkey" FOREIGN KEY ("replacement_revision_id") REFERENCES "scorecard_revisions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "amendments" ADD CONSTRAINT "amendments_approved_by_fkey" FOREIGN KEY ("approved_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_events" ADD CONSTRAINT "notification_events_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_recipients" ADD CONSTRAINT "notification_recipients_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_recipients" ADD CONSTRAINT "notification_recipients_notification_event_id_fkey" FOREIGN KEY ("notification_event_id") REFERENCES "notification_events"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_recipients" ADD CONSTRAINT "notification_recipients_membership_id_fkey" FOREIGN KEY ("membership_id") REFERENCES "event_memberships"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "delivery_attempts" ADD CONSTRAINT "delivery_attempts_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "delivery_attempts" ADD CONSTRAINT "delivery_attempts_recipient_id_fkey" FOREIGN KEY ("recipient_id") REFERENCES "notification_recipients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "report_jobs" ADD CONSTRAINT "report_jobs_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "report_jobs" ADD CONSTRAINT "report_jobs_requester_id_fkey" FOREIGN KEY ("requester_id") REFERENCES "event_memberships"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "report_jobs" ADD CONSTRAINT "report_jobs_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "documents"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "aggregate_snapshots" ADD CONSTRAINT "aggregate_snapshots_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_events" ADD CONSTRAINT "audit_events_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_events" ADD CONSTRAINT "audit_events_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exception_cases" ADD CONSTRAINT "exception_cases_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exception_cases" ADD CONSTRAINT "exception_cases_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "event_memberships"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "configuration_versions" ADD CONSTRAINT "configuration_versions_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "configuration_versions" ADD CONSTRAINT "configuration_versions_approved_by_fkey" FOREIGN KEY ("approved_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recovery_runs" ADD CONSTRAINT "recovery_runs_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_runs" ADD CONSTRAINT "job_runs_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "result_publications" ADD CONSTRAINT "result_publications_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "result_publications" ADD CONSTRAINT "result_publications_result_snapshot_id_fkey" FOREIGN KEY ("result_snapshot_id") REFERENCES "result_snapshots"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscription_preferences" ADD CONSTRAINT "subscription_preferences_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscription_preferences" ADD CONSTRAINT "subscription_preferences_membership_id_fkey" FOREIGN KEY ("membership_id") REFERENCES "event_memberships"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "guardians" ADD CONSTRAINT "guardians_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "guardians" ADD CONSTRAINT "guardians_athlete_id_fkey" FOREIGN KEY ("athlete_id") REFERENCES "athletes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consent_records" ADD CONSTRAINT "consent_records_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consent_records" ADD CONSTRAINT "consent_records_athlete_id_fkey" FOREIGN KEY ("athlete_id") REFERENCES "athletes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consent_records" ADD CONSTRAINT "consent_records_guardian_id_fkey" FOREIGN KEY ("guardian_id") REFERENCES "guardians"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consent_records" ADD CONSTRAINT "consent_records_evidence_document_id_fkey" FOREIGN KEY ("evidence_document_id") REFERENCES "documents"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "idempotency_keys" ADD CONSTRAINT "idempotency_keys_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "outbox_messages" ADD CONSTRAINT "outbox_messages_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

