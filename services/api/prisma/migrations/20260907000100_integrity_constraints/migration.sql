-- ============================================================================
--  Integrity constraints the Prisma schema cannot express.
--
--  §14: "Use relational foreign keys, unique constraints and checks for
--  same-event relationships… Use transaction-level protections for overlapping
--  active assignments, entry caps, stock issues and primary scorecard ownership."
--
--  Everything here is a rule the specification states in prose. Enforcing it in
--  the database means it also holds for imports, background jobs and any future
--  client — not only the code paths that remember to check.
-- ============================================================================

-- Required for the exclusion constraint on resource double-booking.
CREATE EXTENSION IF NOT EXISTS btree_gist;

-- ---------------------------------------------------------------------------
-- 1. Audit columns reference a real user.
--
--  These are deliberately NOT Prisma relations (130 back-relations on User would
--  make the client unusable), so the foreign keys are declared here instead. The
--  constraint is what actually matters: §13 requires every change to be traceable
--  to an actor, which a dangling uuid would not be.
-- ---------------------------------------------------------------------------
DO $$
DECLARE t record;
BEGIN
  FOR t IN
    SELECT c.table_name, c.column_name
    FROM information_schema.columns c
    JOIN information_schema.tables tb
      ON tb.table_name = c.table_name AND tb.table_schema = c.table_schema
    WHERE c.table_schema = 'public'
      AND tb.table_type = 'BASE TABLE'
      AND c.column_name IN ('created_by', 'updated_by')
      AND c.table_name <> 'users'
  LOOP
    EXECUTE format(
      'ALTER TABLE %I ADD CONSTRAINT %I FOREIGN KEY (%I) '
      'REFERENCES users(id) ON DELETE RESTRICT ON UPDATE CASCADE',
      t.table_name, t.table_name || '_' || t.column_name || '_fkey', t.column_name);
  END LOOP;
END $$;

-- ---------------------------------------------------------------------------
-- 2. Interval sanity
-- ---------------------------------------------------------------------------
ALTER TABLE events
  ADD CONSTRAINT events_date_range_ck CHECK (start_date <= end_date);

-- §7: "Check … end > start."
ALTER TABLE fixtures
  ADD CONSTRAINT fixtures_schedule_ck CHECK (scheduled_end > scheduled_start),
  ADD CONSTRAINT fixtures_actual_ck
    CHECK (actual_end IS NULL OR actual_start IS NULL OR actual_end >= actual_start);

ALTER TABLE resource_availabilities
  ADD CONSTRAINT resource_availabilities_range_ck CHECK (ends_at > starts_at);

ALTER TABLE duty_sessions
  ADD CONSTRAINT duty_sessions_range_ck CHECK (ends_at > starts_at);

-- §1: "Effective assignment intervals use inclusive start and exclusive end."
ALTER TABLE school_c_h_assignments
  ADD CONSTRAINT school_ch_interval_ck
    CHECK (effective_to IS NULL OR effective_to > effective_from);
ALTER TABLE volunteer_pool_assignments
  ADD CONSTRAINT volunteer_pool_interval_ck
    CHECK (effective_to IS NULL OR effective_to > effective_from);
ALTER TABLE volunteer_school_assignments
  ADD CONSTRAINT volunteer_school_interval_ck
    CHECK (effective_to IS NULL OR effective_to > effective_from);
ALTER TABLE fixture_assignments
  ADD CONSTRAINT fixture_assignment_interval_ck CHECK (ends_at > starts_at);

-- §8: "cannot precede check-in. Missing checkout is incomplete, not zero hours."
ALTER TABLE attendances
  ADD CONSTRAINT attendance_checkout_ck
    CHECK (check_out_at IS NULL OR check_in_at IS NULL OR check_out_at >= check_in_at);

-- ---------------------------------------------------------------------------
-- 3. A participant is exactly one of an individual entry or a team
--
--  §14: "Store a participant as exactly one of individual entry or team."
--  §7:  "FixtureParticipant contains either an individual competition entry or a
--        team, never both."
-- ---------------------------------------------------------------------------
ALTER TABLE fixture_participants
  ADD CONSTRAINT fixture_participant_exactly_one_ck
    CHECK ((entry_id IS NOT NULL)::int + (team_id IS NOT NULL)::int = 1);

-- ---------------------------------------------------------------------------
-- 4. A non-Completed status can never hold a rank
--
--  §15 / GT-005: "A DNF/DNS/DQ/NM cannot accidentally receive rank 1 through a
--  zero or null numeric value." The calculators already guarantee this; the
--  constraint makes it true of any write, including a repair script.
-- ---------------------------------------------------------------------------
ALTER TABLE result_snapshots
  ADD CONSTRAINT result_rank_requires_completed_ck
    CHECK (rank IS NULL OR status = 'Completed');

ALTER TABLE result_snapshots
  ADD CONSTRAINT result_rank_positive_ck CHECK (rank IS NULL OR rank >= 1);

-- A unit-bearing measurement must carry its unit (§14).
ALTER TABLE result_snapshots
  ADD CONSTRAINT result_value_has_unit_ck
    CHECK (primary_value IS NULL OR unit IS NOT NULL);

-- ---------------------------------------------------------------------------
-- 5. Quantities
-- ---------------------------------------------------------------------------
ALTER TABLE kit_issues        ADD CONSTRAINT kit_issue_quantity_ck   CHECK (quantity > 0);
ALTER TABLE kit_entitlements  ADD CONSTRAINT kit_entitlement_qty_ck  CHECK (required_quantity > 0);
-- §9: an adjustment is appended, never an edit; a zero-delta movement is meaningless.
ALTER TABLE stock_movements   ADD CONSTRAINT stock_delta_nonzero_ck  CHECK (quantity_delta <> 0);

-- Optimistic concurrency tokens are monotonic and start at 1 (§1).
DO $$
DECLARE t record;
BEGIN
  FOR t IN
    SELECT table_name FROM information_schema.columns
    WHERE table_schema = 'public' AND column_name = 'row_version'
  LOOP
    EXECUTE format('ALTER TABLE %I ADD CONSTRAINT %I CHECK (row_version >= 1)',
                   t.table_name, t.table_name || '_row_version_ck');
  END LOOP;
END $$;

-- ---------------------------------------------------------------------------
-- 6. "Exactly one active X" rules — partial unique indexes
--
--  §4: "Default: one active responsible CH per school", "Default exactly one
--  active pool", "Exactly one primary scorer and one accountable reviewer at a
--  time". AT-007 requires two concurrent pool transfers cannot both succeed —
--  a unique index makes that a database guarantee rather than a race.
-- ---------------------------------------------------------------------------
CREATE UNIQUE INDEX school_one_active_ch_uq
  ON school_c_h_assignments (event_school_id)
  WHERE effective_to IS NULL;

CREATE UNIQUE INDEX volunteer_one_active_pool_uq
  ON volunteer_pool_assignments (volunteer_membership_id)
  WHERE effective_to IS NULL;

CREATE UNIQUE INDEX fixture_one_primary_scorer_uq
  ON fixture_assignments (fixture_id)
  WHERE duty_role = 'PrimaryScorer' AND status = 'Assigned';

CREATE UNIQUE INDEX fixture_one_reviewer_uq
  ON fixture_assignments (fixture_id)
  WHERE duty_role = 'Reviewer' AND status = 'Assigned';

-- §10: "One primary editable scorecard revision per fixture."
CREATE UNIQUE INDEX scorecard_one_editable_revision_uq
  ON scorecard_revisions (scorecard_id)
  WHERE status IN ('Draft', 'Returned');

-- At most one primary guardian per athlete (docs/INDIA_DATA_MODEL.md).
CREATE UNIQUE INDEX guardian_one_primary_uq
  ON guardians (athlete_id)
  WHERE is_primary AND active;

-- At most one live consent per athlete per purpose. DPDP Act 2023 §9: consent is
-- current or it is not; a stack of overlapping "Granted" rows is not auditable.
CREATE UNIQUE INDEX consent_one_active_per_purpose_uq
  ON consent_records (athlete_id, purpose)
  WHERE status = 'Granted';

-- ---------------------------------------------------------------------------
-- 7. Resource double-booking
--
--  §7: "Two intervals conflict if startA < endB and startB < endA." An exclusion
--  constraint enforces exactly that for PUBLISHED, non-cancelled fixtures.
--  Setup and turnover buffers widen the interval and stay in application logic,
--  because they are organiser-configurable; this backstop catches the plain
--  overlap that no configuration should ever allow.
-- ---------------------------------------------------------------------------
ALTER TABLE fixtures
  ADD CONSTRAINT fixture_resource_no_overlap_excl
  EXCLUDE USING gist (
    resource_id WITH =,
    tstzrange(scheduled_start, scheduled_end, '[)') WITH &&
  )
  WHERE (publication = 'Published' AND lifecycle NOT IN ('Cancelled', 'Abandoned'));

-- ---------------------------------------------------------------------------
-- 8. Audit history is append-only
--
--  §13: "Business admins cannot edit/delete audit history."
--  A trigger enforces it for every connection, including psql.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION reject_audit_mutation() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION
    'audit_events is append-only: % is not permitted (specification §13)', TG_OP
    USING ERRCODE = 'insufficient_privilege';
END $$ LANGUAGE plpgsql;

CREATE TRIGGER audit_events_append_only
  BEFORE UPDATE OR DELETE ON audit_events
  FOR EACH ROW EXECUTE FUNCTION reject_audit_mutation();

-- ---------------------------------------------------------------------------
-- 9. India-specific format guards
--
--  The full identity number is never stored — only the last four digits, and only
--  where an auditor must reconcile one record. See docs/INDIA_DATA_MODEL.md.
-- ---------------------------------------------------------------------------
ALTER TABLE documents
  ADD CONSTRAINT document_sighted_last_four_ck
    CHECK (sighted_last_four IS NULL OR sighted_last_four ~ '^[0-9]{4}$');

-- 11-digit UDISE+ code (Ministry of Education school identifier).
ALTER TABLE schools
  ADD CONSTRAINT school_udise_format_ck
    CHECK (udise_code IS NULL OR udise_code ~ '^[0-9]{11}$');

-- Indian PIN code: six digits, first digit 1-8 (9 is Army Post Office).
ALTER TABLE schools
  ADD CONSTRAINT school_pincode_format_ck
    CHECK (pincode IS NULL OR pincode ~ '^[1-8][0-9]{5}$');

-- Normalised E.164 Indian mobile numbers.
ALTER TABLE guardians
  ADD CONSTRAINT guardian_mobile_format_ck
    CHECK (mobile_e164 IS NULL OR mobile_e164 ~ '^\+91[6-9][0-9]{9}$');
ALTER TABLE volunteer_profiles
  ADD CONSTRAINT volunteer_mobile_format_ck
    CHECK (mobile_e164 IS NULL OR mobile_e164 ~ '^\+91[6-9][0-9]{9}$');

-- A withdrawn consent must record when it was withdrawn, and vice versa.
ALTER TABLE consent_records
  ADD CONSTRAINT consent_withdrawal_consistent_ck
    CHECK ((status = 'Withdrawn') = (withdrawn_at IS NOT NULL));
