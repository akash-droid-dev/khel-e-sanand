# Khelo Sanand BalOlympiad
## Functional, data and interface specification

Version 1.0 | Prepared 7 September 2026 | Planning specification; proposed decisions require organiser confirmation

This specification expands Sanan.pdf into a buildable product definition. It describes functions and their behaviour; it is not a deployed application or an approved sports rulebook. The accompanying workbook provides a field-level data dictionary, function catalogue, configuration register, permission matrix, interface catalogue, acceptance scenarios and synthetic data. All sample names, dates, schools, athletes and results are invented for testing.

### Reading guide and scope provenance

- BASELINE: stated in Sanan.pdf and retained here.
- RECOMMENDED: a proposed implementation rule or addition that makes the baseline operationally precise.
- OPTIONAL: additional scope, enabled only if selected.
- DECISION: information the execution plan leaves unspecified. A suggested default is not an approved event policy.

The PDF names football and athletics only as examples on page 11. The user's subsequent clarification supplies the authoritative programme for this specification: Kabaddi; Athletics—30 m, 50 m and 60 m sprints; Kho Kho; Softball Throw; Kids Javelin Throw; Cycling; Chess; Standing Broad Jump; Tug of War; Badminton; Volleyball. Football is outside the confirmed scope. Age groups, event dates and local rule variants are still decisions. Every game below has a detailed software contract; proposed competition settings are not an approved rulebook.

| Module | Baseline source | Main expansion in this specification |
| --- | --- | --- |
| M01 School and event setup | pp. 2–3, 9–10 | Event editions, venues and participation records |
| M02 Users and access | pp. 1–4, 9, 11 | Server permissions, sessions and field visibility |
| M03 Assignments | pp. 4–5, 6–7 | Time-bound assignments, fixture ownership and conflict handling |
| M04 Athletes and imports | pp. 5–6 | Eligibility decisions, entries, rosters and import contracts |
| M05 Sports and templates | pp. 2, 6, 9, 11 | Versioned competition and scoring configuration |
| M06 Fixtures and schedules | pp. 6–7, 9 | Venue resources, dependencies and clash detection |
| M07 Volunteer attendance | pp. 8–9 | Duty denominators, offline claims and correction history |
| M08 Kit distribution | pp. 7–8 | Item entitlements and optional stock ledger |
| M09 Scorecards and review | pp. 8–10 | Revision checks, cross-cluster review and amendments |
| M10 Notifications | p. 6 | Reliable delivery, deduplication and read states |
| M11 Dashboards and reports | pp. 10–11 | Metric definitions, drill-downs and export rules |
| M12 Audit and administration | pp. 4, 11 | Overrides, change impact, recovery and support tools |

## 1. Product structure and operating principles

Use one application with three workspaces. ED means Event Director; CH means Cluster Head; VOL means Volunteer. All three use the same authoritative records. The event selector scopes every operational page. Historical event records remain accessible according to role even after the event closes.

| Workspace | Main navigation | Landing priorities |
| --- | --- | --- |
| Event Director | Overview; Schools & Clusters; People; Assignments; Athletes; Sports & Rules; Fixtures; Attendance; Kits; Scorecards; Reports; Administration | Unassigned schools, unstaffed fixtures, eligibility blockers, late submissions, pending approvals and sync/import failures |
| Cluster Head | My Cluster; Schools; Volunteer Pool; Deployment; Athletes; Schedule; Attendance; Kits; Review Queue; Reports | Today's duties, absences, schools needing support, kits pending and scorecards to review |
| Volunteer | Today; Matches; Schools; Attendance; Kit; Notifications; Profile | Check-in, next fixture, unfinished draft, returned scorecard and sync state |

RECOMMENDED universal interface rules:

- Show the selected event, user's role, accessible scope, connection state and last refresh time. Use the event timezone (proposed Asia/Kolkata) in every schedule and attendance view.
- Every list has search, filters, pagination, clear empty/error/loading states and a filter reset. Preserve filters when returning from a record.
- Every save shows saved time or a specific failure; submitting a scorecard has a separate confirmation showing fixture, participants and final values.
- Errors identify the field or row and a remedy. A missing value is not equivalent to zero, absent, invalid or not applicable.
- Bulk actions preview selected records, blockers and consequences. Each record receives a success/failure outcome; never report blanket success for a partial operation.
- On phones, use short forms, large labelled actions, numeric keyboards for scores and a persistent save status. Support keyboard operation, readable contrast, text plus colour statuses, and screen-reader labels.
- OPTIONAL Gujarati, Hindi and English labels use translation keys. Names retain their original script; timestamps, units and category rules remain consistent across languages.
- Activity deactivation preserves history. Records with operational references cannot be hard-deleted through normal administration.

### Permission evaluation

Every server request evaluates: active identity → active event membership → permitted action → assigned record scope → allowed fields → valid workflow state. A hidden button alone is never access control. Apply the same policy to searches, counts, exports, attachments, background jobs and notifications.

ED administers the selected event. CH acts within current school and volunteer assignments. VOL has school context, but scoring access defaults to explicit fixture assignment. An explicit cross-cluster exception contains scope, allowed action, approver, reason and expiry. It does not grant permanent cluster-wide access.

RECOMMENDED field visibility: VOL sees athlete name, operational identifier/bib, school, category, entry and eligibility outcome. Detailed birth dates, supporting documents and family contacts require a separately authorised purpose. CH receives the minimum fields needed for eligibility review. This narrows the PDF's broad athlete-view permission and should be confirmed in the access matrix.

### Common command and data contract

- Operational records carry an immutable ID and event reference. Global school/user/athlete identities link to separate event memberships. Common mutable fields are created_at, created_by, updated_at, updated_by and row_version.
- Times are stored as timezone-aware timestamps; event_local_date is derived for daily operations. Birth dates are dates, not timestamps. Effective assignment intervals use inclusive start and exclusive end.
- A change request includes expected_version. A stale request returns VERSION_CONFLICT and the current version; it cannot silently overwrite another person's work.
- Retryable create/submit/import/issue commands carry an idempotency key. Reusing the key with the same payload returns the original result; a different payload is rejected. The key and business write commit together.
- Standard errors: VALIDATION_FAILED, OUT_OF_SCOPE, INACTIVE_ENTITY, DUPLICATE_KEY, VERSION_CONFLICT, INVALID_STATE, RULES_NOT_APPROVED, CAPACITY_CONFLICT and DEPENDENCY_BLOCKED. Responses include request_id, field/row context and next action; hidden records do not leak through error detail.
- Outbound notification work is written with the business transaction to an outbox. A worker retries delivery. Repeated delivery cannot duplicate the business action.

## 2. M01 — School, cluster, venue and event setup

BASELINE school operations are required. Formal clusters, event editions and venue resources are RECOMMENDED supporting entities.

### Dataset

Event: code, display name, edition/year label, timezone, start/end dates, operational status, registration dates and configuration version. School: unique school_code, name, address, district, city, contact name, phone/email and global active status. EventSchool: event, school, participation status and operational notes. Cluster: event, code, name and active status. Venue: event, name, address and operational contact. VenueResource: venue, resource code, type, compatible sports, capacity and availability windows. SchoolSportParticipation: event school, competition and participation state.

Keep school, cluster and venue distinct: a school belongs to a management cluster but may compete at several venues. A venue can serve several clusters. One physical venue may have a volleyball court, a track and a throwing area that can operate simultaneously.

### Functions and logic

| Function | Inputs and actor | Behaviour and validations |
| --- | --- | --- |
| createEvent / updateEvent | ED; identity, dates, timezone | Require start ≤ end. Timezone change after scheduling previews affected dates; never reinterpret stored instants silently. |
| setEventStatus | ED; next state, expected version | Setup → Registration → Ready → Live → Closed → Archived. Proposed states; readiness blockers checked before Live. Closed event permits audited amendments through M09. |
| createSchool / updateSchool | ED; school fields | Trim school code; canonical comparison rejects duplicates. Validate contact formats when supplied. Address/district required as selected in template. |
| importSchools / exportSchools | ED; mapped CSV/XLSX | Preview, validate and import using M04 import service. Export only current authorised scope. |
| activateEventSchool / deactivateEventSchool | ED; school, reason | Deactivation blocks new assignments/entries. Preview future fixtures and duties; require ED to resolve or explicitly retain allowed existing activity. History stays intact. |
| createCluster / updateCluster | ED; code, name | Unique code within event. Cluster deactivation blocked while active school or pool assignments remain. |
| manageVenueResource | ED; sport compatibility, capacity, windows | Resource code unique per venue. Scheduled use prevents destructive removal; availability edits invoke conflict preview. |
| mapSchoolParticipation | ED; schools, competitions | Require active event school and enabled competition. Removing a mapping is blocked by active entries unless withdrawn through M04. |
| cloneEventSetup | ED; source event and selected masters | OPTIONAL copy configuration/school selections only. Create new IDs; exclude results, attendance, grants, imports and personal documents. |

### Frontend and admin panel

School list columns: code, name, district, cluster, responsible CH, athlete count, volunteer count and status. Filters: cluster, district, status and sport. Row opens tabs for Profile, Participation, Athletes, Volunteers, Fixtures and History. ED gets Add, Import, Edit, Activate/Deactivate and Assign CH; CH sees read-only configuration and scoped quick links; VOL sees operational school details and CH contact.

Event setup uses a stepper: identity/dates → schools/clusters → sports/categories → venues → people → readiness. Each step shows completion and blockers. Venue administration includes a resource calendar and a list of affected fixtures before any availability change.

### Flexibility and edge cases

Event date range, cluster labels, optional school notes and contact requirements are configurable. Codes remain stable after first use; correcting a code uses a controlled ED action with aliases for import matching. A renamed school keeps historical display snapshots on final results. Deactivating a school cannot erase historical scores or retrospectively mark its volunteers absent.

### Acceptance examples

- Add a school and assign a CH without recreating the school record.
- The same canonical school code in two imported rows is flagged before commit.
- A deactivated school disappears from new assignment pickers while its historical fixtures remain readable.
- A venue availability change lists every overlapping fixture and cannot publish unnoticed conflicts.

## 3. M02 — Users, authentication and permissions

### Dataset

User: user_code, display_name, canonical verified mobile/email, identity-provider subject, global active status and last-login time. EventMembership: event, user, primary role, membership status and permissions version. VolunteerProfile: skills, preferred language, address, emergency contact and clothing size if needed. Session: identity, issued/expiry times, revoked time and safe device label. ScopeGrant: event, user, action, target scope, expiry, reason and granting ED.

Mobile is not assumed to be a universally unique identifier for children; athlete identities never depend on guardian mobile uniqueness. For staff, configure the login identifier policy and validate it consistently across imports and manual entry. Do not store plain OTPs or passwords in operational tables or exports.

### Functions and logic

| Function | Actor and inputs | Behaviour |
| --- | --- | --- |
| createUser / inviteUser | ED; user identity, role, event | Reuse an existing verified identity through explicit event membership; reject accidental duplicate login identity. Invitation status is distinct from activation. |
| updateUser | ED; editable fields, version | Changes to verified login channels require reverification. CH can view their pool but cannot create identities. |
| setMembershipStatus | ED; active/inactive, reason | Inactive membership immediately blocks event access. Preview unresolved assignments and review duties; preserve historical author references. |
| requestLogin / verifyLogin | User; approved identifier, verification | Provider-enforced expiry, retry limits and rate limits; generic errors avoid account discovery. Record successful login and issue revocable session. |
| resetAccess / revokeSessions | ED; user, reason | Reset uses provider workflow; no display of credentials. Password/identity changes invalidate affected sessions. |
| updateOwnProfile | VOL; approved profile fields | Allow preferred language/address/emergency contact per policy. Identity and role fields cannot be self-edited. |
| grantScopedException / revokeGrant | ED; target, actions, expiry | Validate narrower scope and finite expiry; audit grant and subsequent use. Default cross-pool access remains denied. |
| previewEffectiveAccess | ED; user, event, sample action | Show derived school/pool/fixture scope and the assignment/grant producing it. Read-only support view; no silent impersonation. |
| listUsers / exportUsers | ED or scoped CH | Return only visible fields. VOL can retrieve their own profile and permitted operational contacts. |

### Frontend and admin panel

Login shows event branding, supported identifier entry, verification state and resend countdown. Session expiry preserves a local draft securely and requires sign-in before upload. People administration has separate CH and VOL tabs, searchable status badges, bulk activation previews, pool/school counts and invitation progress. User detail tabs: Profile, Assignments, Access, Activity. CH sees pool workload; VOL sees My Profile with clear editable fields.

### Flexibility, safeguards and acceptance

Login channel, session duration, language and allowed self-profile fields are settings. Proposed defaults appear in the workbook and remain organiser decisions. Prevent deactivation of the last active ED until another ED is appointed. Removing a role must invalidate cached authorisation and queued commands; the worker rechecks permissions when executing an export. Returning a 403 or safe 404 on an out-of-scope record must not expose its name, counts or attachments.

Accept when a deactivated volunteer cannot submit an old offline draft; their earlier scorecards still identify them correctly. A CH cannot create a volunteer through either UI or direct API. Two accounts with the same configured canonical login identity are rejected.

## 4. M03 — Assignments and volunteer deployment

### Dataset

SchoolCHAssignment: event school, cluster, CH membership, effective_from/to and assigning actor. VolunteerPoolAssignment: volunteer membership, cluster, CH membership and interval. VolunteerSchoolAssignment: volunteer, event school, responsibility label and interval. FixtureAssignment: fixture, user membership, duty role (primary scorer/support/reviewer), interval and assignment status. A cross-cluster ScopeGrant is explicit, separate and expiring.

### Functions and logic

| Function | Actor and inputs | Behaviour |
| --- | --- | --- |
| assignSchoolsToCH | ED; CH, schools, start time | Active ED/CH/schools required. Default: one active responsible CH per school. Return per-school outcomes. |
| reassignSchool | ED; school, new CH, effective time | End old interval and create new interval atomically. Preview volunteer, review-queue and future-fixture consequences; require explicit disposition. |
| assignVolunteerPool | ED; volunteer, CH/cluster | Default exactly one active pool. Transfer ends old membership and resolves incompatible school duties before activation. |
| assignVolunteerSchools | ED/CH; volunteer, schools, responsibility | CH must control both the school and volunteer pool, or hold a specific ED grant. Check multi-school flag, count limit and active intervals. |
| unassignVolunteerSchool | ED/scoped CH; assignment, end time | Preserve history; review dependent future fixture duties. No silent loss of a live primary scorer. |
| assignFixtureDuty | ED; fixture, scorer/reviewer | RECOMMENDED explicit scoring access. CH may allocate primary scorers only if delegated for owned fixtures. Exactly one primary scorer and one accountable reviewer at a time. |
| replaceFixtureDuty | ED or authorised CH; replacement, reason | Revoke old edit permission; transfer draft responsibility without rewriting its author history. New scorer reviews the inherited draft. |
| calculateWorkload | ED/scoped CH; date range | Return schools count, fixture count, duty duration, overlap flags and availability gaps; counts alone do not imply workload equivalence. |
| previewAssignmentBatch | ED/scoped CH; proposed mappings | Return valid/blocking/warning rows and impact summary before commit. |

### Frontend and admin panel

Deployment board shows CH pools and schools side by side. A volunteer card includes skills, available times, assigned schools and next fixture. An assignment drawer displays selected scope, responsibility, effective time and conflicts. Provide a table-based alternative to drag-and-drop. Bulk selection supports preview and per-row feedback. Fixture detail has a Duties tab naming scorer, backup support and responsible reviewer.

### Flexibility and edge handling

Multi-school assignment is configurable; multi-pool remains disabled by default. Cross-cluster help is a temporary grant, not a hidden pool move. Limits apply to concurrently active assignments. Reassignment should update current CH visibility on next refresh, as the PDF requires. Historical reports evaluate assignment scope at the relevant operation time; former CHs do not retain live access automatically.

For a match involving two clusters, designate a fixture owner and reviewer explicitly. Other permitted CHs may see the published fixture and result, but only the owner/reviewer approves. If reassigning a school affects an already submitted scorecard, ED explicitly keeps or transfers review responsibility. A schedule change rechecks scorer availability.

### Acceptance examples

- CH-A cannot allocate CH-B's volunteer without an action-specific ED grant.
- Two simultaneous pool-transfer requests cannot create two active default pools.
- Replacing a scorer revokes the former scorer's next save while retaining their draft history.
- Assigning multiple schools shows separate responsibilities and alerts on overlapping fixtures.

## 5. M04 — Athletes, entries, teams and bulk data

### Dataset

Athlete stores stable identity and optional restricted personal fields. AthleteRegistration links athlete, event school, event athlete code and registration status. CompetitionEntry links registration to one competition and eligibility decision. Team links an event school to one competition. TeamMember links an eligible entry to a team with jersey/relay leg where relevant. Document stores a private object reference, document type, owner, checksum and verification metadata. ImportJob and ImportRow preserve input lineage and outcomes.

### Functions and logic

| Function | Inputs and actor | Behaviour |
| --- | --- | --- |
| createAthlete / updateAthlete | ED; identity and registration | Require unique event athlete code; suggested duplicate matches are reviewed, never auto-merged by name. DOB is required only for DOB-based categories. |
| updateAthleteAllowedFields | CH; registration, field patch | Proposed CH edits: operational notes and correction requests; additional editable fields require explicit field policy. VOL has no athlete-write permission. |
| registerSportEntry / withdrawEntry | ED or expressly permitted CH | Check school participation, age/category eligibility, entry caps and registration deadline. Withdrawn entries remain in history. |
| evaluateEligibility | Service; entry and rule version | Evaluate each required criterion; return eligible, ineligible or pending with reason codes. Missing proof is pending, not automatically eligible. |
| reviewEligibility / overrideEligibility | Authorised ED; outcome, evidence/reason | Record reviewer and rule version. Overrides require reason and affected-entry preview; do not rewrite DOB to achieve eligibility. |
| createTeam / manageRoster / lockRoster | ED or delegated CH | One competition per team. Unique eligible athlete per restricted roster scope; enforce team size and jersey/leg rules. Lock snapshot before first participation. |
| transferAthleteSchool | ED; registration, target school, reason | OPTIONAL. Validate rules and effective date; retain old competition result affiliation. Block incompatible active rosters; explicitly withdraw/rebuild future entries. |
| uploadDocument / reviewDocument | Authorised user | Restrict formats/size; validate content type; store privately; grant expiring download access after server authorisation. |
| downloadImportTemplate / previewImport | ED; entity/template version | Return required columns, reference codes and examples. Preview normalised values, errors and possible duplicates. |
| commitImport / retryFailedRows | ED; validated job, mode | Revalidate mutable dependencies. Commit independent good records; fail atomic team/roster groups together. Never duplicate previous successes on retry. |

### Eligibility logic

Category eligibility is configuration, not a hard-coded age label. Store inclusive DOB bounds or a documented age-at-cutoff rule and category participation criteria. Calculate age in completed calendar years at the configured cutoff, including birthday boundary tests. Keep class/grade separate from age. Do not infer gender/category, disability, age or eligibility from names or photos. Explicit rules determine whether an athlete may enter multiple age groups or sports.

Eligibility output includes criterion_code, expected_value/range, supplied_value, outcome and reviewed_at. Entry caps can apply per athlete, school, category and competition. Capacity checks are transactional. Ineligible and pending entries cannot enter a published start list unless an authorised exception exists.

### Import contract

Accept documented CSV/XLSX templates; legacy XLS conversion is an explicit compatibility decision. Each template has a version, required headers and code reference sheet. Dates use YYYY-MM-DD; codes remain text to preserve leading zeros. Empty cells mean no update in update/upsert mode; a documented __CLEAR__ token clears nullable fields. Create-only rejects existing keys; update-only rejects unknown keys; upsert applies both with a field diff preview.

Validate file shape → headers → field types → duplicate keys within file → reference codes → business rules → permission and deadline. Good independent rows may commit even when other rows fail. A team with an invalid required roster member is one failed logical group. Do not split its roster into a deceptively valid partial team.

The error file includes original spreadsheet row number, entity key, column, safe supplied value, error code, message and suggested fix. Summaries separate created, updated, skipped, failed and pending-review counts. Import identity is derived from job ID plus source row/group and immutable match key; a filename is not a deduplication key. Retried jobs preserve original row outcomes.

### Frontend and admin panel

Athlete list shows code, name, school, category, sports, eligibility and registration status. Filters include school, sport, category and missing/invalid data. Profile tabs: Summary, Entries, Teams, Eligibility, Documents and History. Restricted fields are omitted for VOL. The import wizard is Upload → Map columns → Validate → Preview changes → Import → Results; the user can download only failed rows for correction. Team editor shows roster eligibility and size blockers before Lock.

### Acceptance examples

- 98 independent valid rows and 2 invalid rows produce 98 successes and an error file identifying the original two row numbers.
- Re-uploading a completed import with the same idempotency key adds no duplicate athletes.
- A DOB on each side of the category cutoff produces the expected eligibility result.
- A post-match school transfer does not change the school credited in the historical result snapshot.
- A volunteer cannot obtain restricted athlete documents by modifying a download URL.

## 6. M05 — Sports, competition formats and scoring templates

### Dataset and configuration hierarchy

Sport defines the game family. Discipline defines a particular event such as Sprint 30 m. Category defines participation/eligibility. Competition combines event edition + discipline + category + format. RuleVersion holds a typed configuration, source reference, effective date, approval status, approver and content checksum. ScoreTemplate defines visible fields, units, validation and calculation-family version. CompetitionStage defines a league/group, knockout round, heat, final or chess round.

Hierarchy: system-supported capabilities → event defaults → competition rule version → permitted fixture settings. A fixture override cannot alter an eligibility, scoring or tie rule after play starts. Operational settings such as a venue may change through M06; result-affecting changes require a new rule version and impact review.

### Functions

| Function | Inputs and actor | Behaviour |
| --- | --- | --- |
| configureSport / configureDiscipline | ED; sport family, discipline parameters | Enable only supported calculation families. Sprint distances are separate disciplines. Softball Throw is an individual throw event. |
| createCategory | ED; name, eligibility bounds, criteria | Validate non-contradictory bounds; overlapping categories require explicit participation policy. |
| createCompetition | ED; discipline, category, format | Validate individual/team format, resource needs and a complete rule profile. |
| configureRuleVersion | ED; typed settings and source | Save Draft. Required settings have no silent default; record whether each value is baseline reference, proposed local setting or approved local setting. |
| previewScoreTemplate | ED; test participants/sample values | Render the same form and calculator used by VOL. Show calculated totals, invalid cases and missing-rule blockers. |
| approveRuleVersion | ED; reviewer confirmation and version | Validate rules, examples and tie path. Approval is recorded once; published fixtures pin the immutable version. |
| createStages / previewDraw | ED; entrant list, seeding, format | Manual bracket/heat setup is required. Automated generation is RECOMMENDED with review before publishing. Store the input snapshot and seed. |
| computeProvisionalResult | Service; score revision, rule version | Deterministic calculation returns standings, unresolved ties, invalid observations and explanation. It does not approve the scorecard. |
| qualifyParticipants | ED/reviewer; final prior-stage results | Generate a preview from locked source revisions. Block on unresolved ties, protests or missing results; create next-stage entries only after approval. |

### Frontend and admin panel

Sports & Rules lists all 13 disciplines (three sprint distances plus ten other games/events), with rule approval and readiness badges. Competition setup tabs: Eligibility, Entries/Rosters, Format & Stages, Scoring, Tie Rules, Equipment/Venue, Review, Publication. The preview uses synthetic data, clearly marked. Admins can compare rule versions field by field and see all fixtures using a version.

Scoring templates are controlled configurations, not arbitrary executable expressions. A safe catalogue of calculation families covers cumulative points, sets/games, ordered attempts, timed races, chess results and pull outcomes. Every field has type, allowed range, unit, null semantics and edit rights. Decimal measurements use exact decimal or integer base units, not binary floating-point equality.

### Flexibility and acceptance

Support knockout, round-robin, groups then knockout, heats then final, direct final, and chess rounds where selected. Each format defines its own standings and progression; no universal winner algorithm applies to every sport. Byes are administrative progression, not played matches or athlete attendance. Round generation must never create a second fixture for the same entrant and stage slot.

Accept when changing a future template leaves a locked older result unchanged; all 13 discipline templates render appropriate fields; publication fails if a required tie rule is absent; a recreated draw with the same stored inputs/seed produces the same preview.

## 7. M06 — Fixtures, schedules and competition progression

### Dataset

Fixture: competition/stage, code, fixture type, venue resource, scheduled start/end, reporting time, lifecycle state, publication state, owner cluster/CH and pinned rule version. FixtureParticipant contains either an individual competition entry or a team, never both. FixtureDependency references a source fixture/result position and target slot. ResourceAvailability and DutyAvailability define allowed windows. StartList stores lane, bib, board, heat, attempt order or cycling start slot as appropriate.

### Functions and validations

| Function | Actor/input | Behaviour |
| --- | --- | --- |
| createFixture / editFixture | ED; competition, participants, resource, times | Check same competition/category, eligible participants, active resource and end > start. Future bracket placeholders are explicit unresolved dependencies. |
| createStartList | ED/delegated official; entrants and lane/board/order | Unique slot per fixture, sufficient capacity, no duplicate entrant. Freeze participant/roster snapshot before play. |
| detectConflicts | Service; proposed schedule | Check resource overlap, volunteer duties, individual athletes across sports/teams, travel/rest buffers and source-round completion. |
| publishSchedule / unpublishSchedule | ED; selection, version | Publish only validated fixtures. Unpublishing future fixtures notifies viewers and preserves history. Started fixtures use cancellation/suspension workflow instead. |
| rescheduleFixture | ED; new time/resource, reason | Preview affected participants, duties and dependencies; commit revised schedule and notification outbox together. |
| startFixture / pauseFixture / resumeFixture | Assigned operator; official confirmation | Track actual times and reason. Pause has no automatic winner. Device display clock is advisory; official clock/judge decision governs. |
| completePlay / cancelFixture | Assigned operator or ED; outcome/reason | Play completion opens result submission. Cancellation is separate from completed results and excluded from ordinary completion denominators. |
| advanceStage | ED; approved progression preview | Consume locked results once; prevent duplicate qualification; block if any source result is under amendment. |
| printSchedule / exportStartLists | ED/scoped CH | Generate role-appropriate participant lists without restricted personal data. |

### Conflict logic

Model occupied interval as scheduled start minus setup buffer through scheduled end plus turnover buffer. Two intervals conflict if startA < endB and startB < endA. Back-to-back fixtures can coexist only when buffers permit. For an athlete on a team, expand locked/expected roster participation to detect clashes with their individual events. Placeholders generate potential-conflict warnings until participants are resolved; recheck before publishing the resolved start list.

Resource conflicts and confirmed athlete overlaps are blocking by default. Rest/travel constraints are organiser-defined hard rules or warnings; record overrides. A school appearing in two different sports is not inherently a clash if different athletes and staff participate. Flag delay propagation, but require ED review before shifting an entire programme.

### Frontend and admin panel

Calendar/list toggle with day, sport, resource, school and cluster filters. Fixture cards display time, venue, status, participants, scorer, reviewer and unresolved blockers. Detail tabs: Overview, Participants, Duties, Scorecard and History. Volunteer Today sorts assigned duties by reporting time and highlights schedule changes since last acknowledgement. School fixture views contain all authorised published fixtures even when the VOL is not their scorer.

### Acceptance examples

- An athlete in Kabaddi and a sprint cannot be scheduled simultaneously without a visible blocking conflict.
- Two fixtures on separate resources at one venue are permitted when no shared resource/person conflict exists.
- Published changes become visible on next refresh and alert impacted users.
- An amended semifinal winner cannot silently replace a finalist once the final has begun; ED receives a dependency exception.

## 8. M07 — Volunteer attendance and duty confirmation

### Dataset

DutySession defines event, local date, start/end, optional venue and attendance mode. ExpectedDuty links volunteer to the session and expected status. Attendance stores one volunteer/session record, check-in/out, effective status, source, recorded server time, optional offline claimed time, review state and correction version. AttendanceCorrection stores old/new values, actor and reason.

### Functions

| Function | Actor/input | Behaviour |
| --- | --- | --- |
| createDutySession / assignExpectedDuty | ED/scoped CH; dates and volunteers | Required to calculate absence meaningfully. Daily mode uses one event-date session; shift mode uses explicit sessions. |
| selfCheckIn | VOL; session, idempotency key | Validate expected/allowed duty and time window. Set server-accepted record; repeated taps return the existing check-in. |
| selfCheckOut | VOL; session, time | OPTIONAL; cannot precede check-in. Missing checkout is incomplete, not zero hours. |
| submitOfflineAttendanceClaim | VOL; client time and session | OPTIONAL; preserve client claim and server receipt separately. CH reviews backdated/out-of-window claims. |
| markAttendanceForVolunteer | CH/ED; session, status | Require scope and reason for manual changes; source = CH or ED. ED can supersede CH determination. |
| correctAttendance | CH/ED; patch, reason, version | Preserve correction history. CH cannot reverse an ED final override without explicit policy. |
| closeDutySession | CH/ED; session | Unmarked expected duties become missing/absent according to policy after cutoff; leave/excused is separate. |
| calculateAttendance / exportAttendance | Authorised user; scope/date range | Provide count and denominator; display provisional claims separately. |

### Frontend and admin panel

VOL sees today's duty, venue, check-in action, status, receipt time and optional checkout; a history view explains corrections. CH has a roster table with Expected, Present, Late, Absent, Excused, Missing and Pending Review filters. Bulk marking shows a preview and requires a correction reason. ED sees clusters with unresolved attendance and final-override controls.

### Flexibility and calculations

Settings: daily/shift mode, early/late window, grace period, checkout requirement, self-check-in eligibility, offline claims and who closes a session. Suggested attendance rate = confirmed present or late duties / expected non-excused duties. For daily reporting, count distinct volunteer-date pairs; for shifts, count duties. Never combine the two denominators. Attendance duration is checkout minus check-in only when both are valid; edited times recalculate totals with history.

OPTIONAL QR check-in confirms an event session code; it is not proof of physical presence by itself. GPS/biometric attendance is additional scope and is not required in this specification. An unscheduled volunteer is not automatically absent. Deactivation or reassignment today must not alter yesterday's expected-duty snapshot.

Accept when repeated check-in creates one record; an offline timestamp remains identifiable as a claim; CH corrections remain visible after ED override; a zero expected-duty denominator displays N/A.

## 9. M08 — Volunteer kits and stock

### Dataset

KitItem: code, label, unit and optional size variants. KitEntitlement: event, volunteer, item/variant, required quantity. KitIssue: volunteer, item, quantity, issuer, issue time, acknowledgement and reissue reference. OPTIONAL StockLocation and StockMovement hold receipts, transfers, issues, returns and adjustments. Stock is quantity-ledger based; item issuance tracking is baseline, procurement and purchasing are excluded.

### Functions

| Function | Actor/input | Behaviour |
| --- | --- | --- |
| configureKitItems / assignEntitlements | ED; item list, quantities, volunteers | Version entitlement definition; preview impact of adding required items after distribution starts. |
| receiveStock / transferStock | ED/delegated CH; location, variant, quantity | OPTIONAL inventory controls. Positive quantity and valid location required; transfer debit/credit commit together. |
| issueKitItem | CH/ED; volunteer, item, quantity | Scope, entitlement and reissue rules checked. If stock tracking is on, check and decrement atomically. |
| bulkIssueKits | CH/ED; volunteer-item rows | Preview; report per-volunteer/item outcomes. Mark an entire kit issued only when all required items are issued. |
| acknowledgeKit | VOL; own issue | Confirm receipt only; cannot alter issue quantity, issuer or date. |
| returnKitItem / reissueKitItem | CH/ED; original issue, reason | OPTIONAL; reference original issue. Returned damaged stock is not automatically available stock. |
| adjustStock | ED; quantity delta, reason | OPTIONAL; append adjustment instead of editing old movement. Negative balance blocked unless explicitly authorised policy. |
| getKitStatus / exportKitStatus | ED/scoped CH; filter | Pending = no required quantity issued; partial = some; issued = all. Track acknowledged separately. |

### Frontend and admin panel

CH sees volunteer rows with one column per required item and size where relevant. An issuance drawer displays remaining entitlement, available stock and earlier issues. VOL sees issued items and Acknowledge actions. ED configures entitlement packs and, if selected, sees stock by location and variant. Reissue always prompts for a reason and original reference.

### Edge cases and acceptance

Duplicate retry must not issue a second kit or decrement stock twice. Two users issuing the final available item cannot both succeed. Optional items do not make a kit partial. Adding a new required item creates a new entitlement version and clearly explains status changes. Stock transfer and volunteer reassignment are independent: moving a volunteer to another cluster does not move physical stock. Export shows issue and acknowledgement dates separately.

## 10. M09 — Scorecards, review, finalisation and amendments

### Dataset and state model

Scorecard identifies a fixture's logical result sheet. ScorecardRevision stores template/rule versions, author, raw payload, calculated result, checksum and workflow state. ScoreObservation stores typed observations such as a raid, set, attempt or finish. ReviewAction stores submit/return/approve/lock actions and comments. ResultSnapshot captures final classification and school/participant display identity. Amendment links the old and proposed replacement revisions, reason, reviewer and downstream impact.

Draft → Submitted → Approved → Locked. Submitted → Returned → Draft is RECOMMENDED. Returned retains the review comments and previous submission. Revision state is separate from fixture lifecycle: a match can be completed while its scorecard awaits review. Result publication is a separate permission and state; approval does not automatically make children's records public.

### Function contracts

| Function | Actor/input | Preconditions and outcome |
| --- | --- | --- |
| openScorecard | Explicit scorer; fixture | Return pinned template, participants, latest editable revision and permission reason. |
| saveScorecardDraft | Scorer; changed fields, version, idempotency key | Draft/Returned only. Validate field types immediately; permit incomplete drafts. Return new version and saved time. |
| recordObservation / correctObservation | Scorer; sport-specific observation | Validate ordered sequence and referenced participant. Corrections supersede prior observation; never erase its history. |
| validateForSubmission | Scorer; revision | Check completeness, match consistency, result status for every participant and unresolved official decisions. Return actionable blockers. |
| submitScorecard | Scorer; revision/version and attestation | Atomically freeze submitted revision, calculate preview, record action and enqueue review notification. Editing blocked until return. |
| returnForCorrection | Assigned reviewer; comments/fields | Submitted only; comments required. Scorer receives returned state and fields needing attention. |
| approveScorecard | Assigned reviewer; exact revision/checksum | Review complete values and warnings. Reject stale revision and missing tie decisions. Record reviewer identity. |
| lockScorecard | CH reviewer/ED; approved version | Create final ResultSnapshot and immutable source references. Separate lock is baseline; combined Approve & Lock is configurable. |
| amendLockedResult | ED; reason and proposed correction | Create amendment revision; retain old final record. Preview progression/standings impact and require named approval. |
| publishResults / withdrawPublication | ED; locked snapshots and audience | OPTIONAL public publication; internal final result availability is baseline. Publish only selected fields; record revision and publish time. |

### Frontend and admin panel

Volunteer score-entry header: sport/category, fixture, venue, participants, rule version and sync status. Main body is sport-specific. Footer: Save Draft, Review Summary, Submit. Review Summary shows all entered values, calculated winner/rank, exceptions and confirmation. Exiting an unsaved form warns only if unsaved data remains.

CH review queue filters by school, sport, submission age and exception. Review screen shows the submitted sheet, source observations, attached evidence where authorised, calculator explanation and version diff. Actions: Return with Comments, Approve, Lock. ED gets a late/missing submission view and an amendment screen with downstream effects.

### Integrity rules

One primary editable scorecard revision per fixture; the scorecard may contain many athlete result lines or team sets. The same person should not approve their own submission by default; ED override is allowed only with a recorded reason and visible exception flag. A technical official can attest decisions without receiving global administrative permissions.

Autosave displays locally saved and server saved separately. Local drafts belong to the authenticated user and event; minimise stored personal data and expire/clear caches on logout according to policy. Offline commands revalidate assignment, revision and workflow on reconnect. If someone else submitted, approved or locked the result, quarantine the stale local draft for review; never overwrite the server.

Amendments invalidate affected derived standings and unstarted next-stage previews. Once a downstream fixture starts, the system opens an ED exception instead of replacing competitors automatically. Official decisions, disqualifications and protests have reason codes and a responsible person; raw data never guesses a foul from a numeric score.

### Acceptance examples

- VOL submission appears in CH's Submitted queue on the next refresh.
- Concurrent edits cause a version conflict and preserve both recoverable drafts.
- Approving revision 3 cannot inadvertently approve revision 4.
- A corrected final remains linked to the superseded result and updates derived standings once, after approval.
- A DNF/DNS/DQ/NM cannot accidentally receive rank 1 through a zero or null numeric value.

## 11. M10 — Notifications and operational communication

### Dataset and functions

NotificationEvent records domain event type, target record/version, event scope and minimal payload. NotificationRecipient records recipient, visible summary, read_at and action link. DeliveryAttempt records channel, attempt, outcome and next retry. SubscriptionPreference contains optional digest/channel preferences; required operational alerts remain available in-app.

Functions: createNotificationEvent, resolveRecipients, dispatchInApp, markRead, markAllRead, retryDelivery, listNotifications and administerTemplates. Events include assignment created/changed, published fixture changed/cancelled, scorecard submitted/returned/approved, import completed/failed and pending-duty exceptions. Schedule-change notifications are BASELINE; the other triggers are RECOMMENDED.

### Logic

Resolve recipients from current assignments and specific fixture duties. Record the intended recipient snapshot, but recheck access when showing content or opening the link. Deduplicate by event type + target version + recipient + channel. If the same fixture changes several times, a digest may group updates but must preserve the latest action and a link to history. Notification read status does not prove attendance or acceptance of an assignment; acknowledgement is a separate explicit action where needed.

Failed delivery retries with bounded backoff and surfaces to ED after exhaustion. Score submission succeeds when saved even if alert delivery is delayed; the CH queue reads the database directly. Avoid athlete documents, family contacts or full DOB in notification payloads. SMS, email and WhatsApp are OPTIONAL provider integrations, disabled until channel, templates, recipients and costs are approved for the event.

### Frontend, flexibility and acceptance

Bell icon with unread count; notification centre filters Action Needed, Updates and Read. Each item names event, fixture/school where authorised, change and time. ED sees a delivery health view, template preview and failure retry. Configurable triggers, reminder intervals and escalation targets must not notify every ED repeatedly for the same unresolved event.

Accept when a fixture move creates one alert per impacted person despite retries; an old alert cannot reveal a school after scope revocation; returning a scorecard links directly to the correct revision and comments.

## 12. M11 — Dashboards, reports and result presentation

### Dataset and functions

DashboardFilter stores authorised event/date/cluster/school/sport selection. ReportJob stores requested columns, filter snapshot, requester, status, generated time and expiring file reference. Optional aggregate snapshots carry calculated_at and source revision watermark. Metric definitions are versioned product definitions, never individually editable spreadsheet formulas in production.

Functions: getEventOverview, getClusterOverview, getVolunteerToday, calculateMetric, getExceptionQueue, drillDownMetric, requestReport, downloadReport, refreshAggregate and reconcileReport. Filters are applied before aggregation. A CH's counts cannot include inaccessible schools; the full event total is not exposed by subtracting filtered values.

### Exact proposed metric definitions

| Metric | Numerator / denominator or calculation | Important distinction |
| --- | --- | --- |
| School coverage | Active participating schools with an active responsible CH / active participating schools | Unassigned schools are actionable; historical inactive schools excluded from current readiness |
| Volunteer deployment | Active volunteer memberships with at least one active school or fixture duty / active volunteer memberships | Also report fixture staffing separately; school allocation alone does not staff a match |
| Fixture staffing | Published non-cancelled upcoming fixtures with primary scorer and reviewer / all such fixtures | Owner and reviewer gaps are separate filters |
| Athlete readiness | Active entries with eligible outcome and required documents verified / active entries | Also show distinct athletes; one athlete with three entries counts once in athlete totals |
| Attendance rate | Confirmed present/late expected duties / expected non-excused duties | Daily and shift rates are separate; pending offline claims do not count as confirmed |
| Score submission coverage | Completed-play fixtures with a submitted-or-later current revision / completed-play fixtures requiring a scorecard | Missing sheets count; cancelled fixtures and byes do not |
| Approval backlog | Submitted current revisions awaiting approval | Returned drafts shown separately; do not count every revision as a new scorecard |
| Finalisation rate | Locked current scorecards / completed-play fixtures requiring a scorecard | Approved is distinct from Locked |
| Kit fulfilment | Volunteers whose required entitlements are fulfilled / volunteers with required kit entitlements | Acknowledgement is a separate count |
| Schedule delay | Actual start minus scheduled start for started fixtures | Exclude unstarted fixtures from average; show currently overdue fixtures separately |
| Import success | Created + updated + skipped-success rows / processed rows | Group failures and pending-review rows identified separately |

All percentages show their counts and use N/A for a zero denominator. Each card drills into the exact records that produced it. Historical views use effective assignment and participation snapshots. Reports display timezone, active filters, generation time and whether results are provisional or locked.

### Frontend and admin panel

ED overview: top readiness cards, today's fixture timeline, cluster comparison, overdue submissions, unstaffed fixtures and import issues. CH overview: today's roster, school coverage, kit gaps and review queue. VOL Today: duty check-in, next match, returned draft and notifications. Use status tables for operational exceptions; charts answer trends or comparisons.

Report builder offers approved templates: school master, deployment, athlete entries/eligibility, fixtures/start lists, attendance, kit issues and scorecard status. Select permitted columns, filters and CSV/XLSX/PDF. Large reports queue in the background; download requires current authorisation. CSV/XLSX exports must neutralise formula-like user text and preserve codes as text.

### Optional results and awards

Internal final results are supported by M09. Public leaderboards, medal tally, school championship points and certificates are OPTIONAL. If selected, count a team medal once for school totals; participant certificate recipients are a different count. Use only approved result versions and an explicit tie/medal-sharing policy. Never add seconds, metres and match points together. School points require a published placement-to-points mapping and team/individual weighting.

Accept when a dashboard card and its export agree under identical filters; superseded revisions do not inflate counts; roster membership does not duplicate athlete totals; access revocation blocks an existing export link.

## 13. M12 — Audit, exceptions and system administration

### Dataset and functions

AuditEvent stores actor, effective role, event, action, entity, safe before/after diff, reason, request_id and timestamp. ExceptionCase stores type, owner, priority, affected records, state and resolution. ConfigurationVersion stores typed settings and approvals. RecoveryRun stores backup/restore test references and outcome; JobRun records operational work and failures without raw personal payloads.

Functions: appendAuditEvent (service only), searchAudit, exportAudit, createException, assignExceptionOwner, resolveException, previewConfigurationChange, applyConfigurationVersion, inspectJob, retryJob and viewServiceHealth. Business admins cannot edit/delete audit history. Sensitive values are redacted from general logs; authorised record-level histories may show necessary values.

### Admin screens

- Event Readiness: missing rules, unassigned schools, missing scorer/reviewer duties, pending entries, fixture clashes and unverified recovery setup.
- Audit Explorer: time, actor, action, entity, cluster and request filters; open a safe diff and linked operational record.
- Exceptions: cross-cluster disputes, abandoned fixtures, locked-result amendments, unresolved ties, job failures and stale sync conflicts, with a named owner and deadline.
- Configuration: setting name, current value, proposed value, scope, effective time, approver and affected records. Permission changes invalidate authorisation immediately.
- Operations: application availability, background-job lag, failed imports/exports, notification failures, database health and backup status. This view excludes credentials and raw secret values.

### Logic and flexibility

Every override is a named action, not a generic edit-anything button. Required fields: original rule/constraint, proposed exception, reason, affected records and actor. Changes affecting scoring produce a new rule/result revision. Optional access to health screens can be narrower than ED business administration.

Event closure prevents ordinary new registrations, assignments and draft submissions unless ED explicitly reopens the relevant function with a reason. Emergency access follows existing ED privileges and is logged. Export and retention policies distinguish operational results from personal documents. Exact retention periods are organiser decisions; do not silently keep private documents forever or delete auditable results with them.

Accept when every assignment/review/override can be traced to a request and actor; retrying a job cannot reapply a successful business command; an archived event displays its own rules and school names; a restore rehearsal recovers both database records and referenced files.

## 14. Application architecture and development contracts

### Components and ownership

Proposed architecture: responsive web/PWA interface → shared API → modular application services → PostgreSQL. Private object storage holds documents and exports. A background worker processes imports, reports and an outbox of notifications. Start as one modular backend with clear service boundaries; split deployments only when demonstrated load or team ownership requires it.

M01 owns schools/events/resources; M02 identities and permissions; M03 assignments; M04 registrations/entries/rosters/imports; M05 rules and competition structure; M06 fixtures/start lists; M07 attendance; M08 kits; M09 scoring/results; M10 notifications; M11 derived reporting; M12 audit/configuration/exception administration. Modules call owned commands rather than editing one another's records directly.

Data lineage: source import/manual entry → eligible entry/roster → fixture participant snapshot → raw score observation → submitted revision → approval → locked result snapshot → progression/report/publication. Every derived output keeps the exact source revision and rule version used.

### API conventions and function catalogue

The workbook enumerates commands and queries. Suggested paths are contracts to implement, not existing endpoints. Scope operational paths under /api/v1/events/{eventId}. GET queries support cursor pagination, safe sort fields and validated filters. POST commands describe meaningful actions such as /scorecards/{id}/submit; PATCH is for ordinary editable fields. Avoid a generic status PATCH that bypasses workflow checks.

Commands receive request_id, idempotency_key where relevant and expected_version for mutable records. Return entity ID, version, state, warnings and next permitted actions. A failed bulk import uses a successful job response with explicit row errors; transport errors and business validation are distinct. Background jobs expose queued/running/completed/partial/failed/cancelled statuses and durable progress.

### Storage and consistency

Use relational foreign keys, unique constraints and checks for same-event relationships. A unique field ID alone cannot protect event boundaries; use composite event-key relationships or equivalent verified constraints. Store a participant as exactly one of individual entry or team. Unit-bearing measurements carry raw value, normalised value, unit and precision; status codes are separate columns.

Index frequent event-scoped filters: school/cluster/status, competition/stage, resource/time, scorer/status, scorecard workflow and volunteer/session. Use transaction-level protections for overlapping active assignments, entry caps, stock issues and primary scorecard ownership. Reporting begins with indexed queries; add cached aggregates only with freshness indicators and reconciliation checks.

### Operational and non-functional acceptance

The PDF targets typical school/athlete lists loading in 2–3 seconds. RECOMMENDED acceptance definition: p95 within 3 seconds at the agreed dataset size, peak active-user load and representative mobile network; document those inputs before testing. Set separate budgets for draft save, submission and import throughput after expected counts are known.

Use HTTPS, encrypted managed storage, private attachment access, secure session cookies/token handling, secret management, dependency maintenance and least-privilege service accounts. Test authorisation through direct API requests and background jobs. Log safe request IDs and failures; never log OTPs, passwords or complete athlete documents. Monitor error rate, save failures, job age and database saturation.

Back up records and files, define recovery point/time targets, and practise restore before the event. Deploy through a staging environment and rehearsed rollback. Schema migrations preserve locked result history. Mobile offline storage is a limited draft cache, not the authoritative event database. Web background sync is not universally available; reopen/manual retry must work (MDN source S12).

### Delivery order

Increment A: event setup, identity/scope rules, schools, assignments, athlete imports, competition definitions and manual fixtures. Increment B: all confirmed sport score-entry forms/calculators, attendance, kits and approval/locking. Increment C: complete reporting, notifications, offline behaviour where selected, operational tools and full event rehearsal. These are sequencing increments, not permission to omit a confirmed game from the launch scope.

Automated bracket generation, Swiss pairing integration, public results, awards/certificates, external messaging, QR attendance, procurement and full stock accounting are separately selectable enhancements. Manual fixtures/pairings with validation remain available. Infrastructure sizing and delivery estimates require actual volumes, event date, team capacity and selected enhancements.

## 15. Shared game engine and confirmed programme

The user confirmed 11 game/event groups, represented as 13 discipline codes because each sprint distance is separate. The following contracts are RECOMMENDED software designs. Reference sporting principles are explicitly attributed; settings labelled local/example must be approved by organisers and their technical officials. Software records the official's decisions and calculates from them; it does not independently judge contact, fouls, safe conditions or a chess position without an explicitly selected adjudication system.

| Code | Confirmed discipline | Participant model | Calculation family |
| --- | --- | --- | --- |
| KAB | Kabaddi | School team | Ordered raid and penalty events |
| SP30 | Sprint 30 m | Individual | Official finish/time classification |
| SP50 | Sprint 50 m | Individual | Official finish/time classification |
| SP60 | Sprint 60 m | Individual | Official finish/time classification |
| KHO | Kho Kho | School team | Turn and defender-out events |
| SBT | Softball Throw | Individual | Best valid measured attempt |
| KJT | Kids Javelin Throw | Individual | Distance attempts; optional separate target-points profile |
| CYC | Cycling | Individual | Time trial or mass-start classification |
| CHE | Chess | Individual | Board result and tournament points |
| SBJ | Standing Broad Jump | Individual | Best valid measured attempt |
| TOW | Tug of War | School team | Pull outcomes and match wins |
| BAD | Badminton | Individual or two-person team | Rally points → games → match |
| VOL | Volleyball | School team | Rally points → sets → match |

All score-entry screens share fixture identity, pinned rules, participant list, official attestation, observation history, Save Draft, Review, Submit and sync status. All admin screens share category, entry caps, resource requirements, format, tie policy, reviewer and publish controls. The game sections list the additional fields and behaviours.

### Common game functions

loadRuleProfile(competition); validateStartList(fixture); recordObservation(revision, typedPayload); validateSportState(revision); calculateResult(revision); explainResult(result); resolveOfficialDecision(case); submitResult(revision); classifyStage(stage); previewNextStage(stage); amendResult(lockedRevision).

Calculation output: participant ID, completion status, primary result, secondary tie values, proposed rank/winner, reason trace, unresolved decisions and source observation IDs. Completed, DNS (did not start), DNF (did not finish), DQ (disqualified), NM (no valid mark), retired, walkover, bye, abandoned and cancelled are typed states where applicable. Invalid/foul attempts belong to an attempt; they do not automatically disqualify the athlete from the competition.

Tie resolution is an ordered, versioned policy. Exhausting that policy yields TIE_REQUIRES_DECISION or an explicitly permitted shared place. Never break ties using database IDs, names, school names, data-entry time or hidden randomness. Where drawing lots is approved, an official records the witnessed decision. A decision made after play cannot masquerade as a pre-approved rule.

## 16. G01 — Kabaddi

### Rule profile and inputs

Confirm the selected school Kabaddi variant, age category, on-court players, roster size, half duration, interval, raid-clock policy, substitutions, timeout limits, bonus availability, all-out handling, revival policy, tie method and league points. Do-or-die raids and super-tackle bonuses are variant-specific switches, disabled until expressly adopted. Do not import a professional league profile automatically.

Reference principle: IKF v2.1.0 awards a point per opponent out, two additional points for an all-out, and describes bonus eligibility with at least six defenders. These are reference values, not automatic adoption for younger/smaller teams. Source S01.

KabaddiRaid fields: half, raid_no, raiding_team, raider_id, defenders_before, start/end or official elapsed duration, defender IDs out, raider_out, bonus_awarded, all_out_awarded, technical_points_by_side, official_reason and state_version. CourtPlayerState holds active/out/suspended status and revival order. A penalty can exist outside a raid and must not require a fictional raider.

### Calculation and validations

- Sum each side's approved scoring components: opponent-out points + bonus points + all-out extras + adopted variant bonuses + technical/penalty awards. Persist components separately from total.
- Apply opponent-out transitions before revival/reset according to the selected rule profile. Bonus-only awards do not revive players under the referenced conventional profile; revival and all-out reset are separate operations. Officials confirm exceptional cases.
- A defender cannot be counted twice in one raid, an out player cannot be tagged again before revival, and the raider must be active for the raiding side. Validate pre-raid court state against the previous accepted event.
- Both sides may receive points in the same raid when the official's decision permits it. Do not model every raid as a simple win/loss toggle.
- All-out extras are added once per confirmed all-out event. Record the reset so a later save cannot add the bonus again.
- A correction to an earlier raid replays subsequent state and exposes dependent contradictions for review. It cannot merely change the displayed total while leaving player state unchanged.
- At full time compare totals. A league draw follows configured standings points. A knockout tie activates the approved tie stage; no winner is fabricated from first scorer or number of raids.

### Frontend and administration

VOL screen: two team totals; half/raid indicator; active raider; defender roster chips; Out, Raider Out, Bonus, Technical Point and official All-Out confirmation; running history. Show unavailable bonus/variant buttons with a rule explanation. Quick correction opens the selected event and its downstream impact. Allow a simpler half-total entry mode only when event-level player-state automation is disabled; require signed official score evidence and component totals.

ED panel: rule switches, score component values, player counts and tie-stage configuration. CH review: half totals, raid totals, penalty reasons, all-out count and any state exceptions. Output: final points, margin, half summaries, result reason and qualification if applicable.

### Acceptance vectors

With reference all-out extra = 2, one final opponent out plus one all-out awards 3 points, not 2 or 5. Repeating the same raid command changes nothing. A bonus-only raid leaves the out/revival queue unchanged. A tie in a knockout remains unresolved until its tie-stage result is approved.

## 17. G02 — Athletics: Sprint 30 m, 50 m and 60 m

### Rule profile and dataset

Create three independent discipline records; do not infer ages from distance. Confirm categories, available lanes, start procedure, false-start policy, timing method, capture/reporting precision, heats, number qualifying by place/time, final capacity, tie handling and rest interval. These are local school-event rules. World Athletics references provide a rulebook framework, but the exact school profiles are not established by the PDF (S03).

SprintResult fields: fixture/heat, entry, lane, bib, official_finish_position, raw_time_value, raw_unit, normalised_time_us, capture_resolution_us, official_display_time, timing_method, status, official_decision and evidence reference. Keep place and recorded time distinct because rounded displayed times can match while the finish judge records a definite order.

### Functions and logic

- prepareSprintHeat validates active eligible entries, lane uniqueness and lane capacity. The same athlete may enter several sprint distances only if entry limits and schedule permit.
- recordSprintResult requires either valid timing data or an expressly approved place-only mode. A completed run cannot have zero/negative duration. DNS/DNF/DQ have a reason and no ordinary numeric rank.
- classifySprintHeat uses official finish order for place-based qualification; comparable accepted timing values support time-based comparisons. A conflict between official order and timing opens a review case. Never resolve it silently.
- qualifySprintFinal first selects the configured number by place from each heat, then selects remaining time qualifiers from eligible non-qualifiers across comparable heats. Deduplicate entries. Stop on a cutoff tie requiring an official decision or extra capacity.
- Final capacity must equal or exceed accepted qualifiers. A single school dominating qualifiers does not justify excluding athletes unless a school quota was published in advance.
- A recalled start creates no result. A rerun links and voids/supersedes the earlier heat according to the official decision; a missing time is not converted into a false start.

### Screens and controls

VOL heat sheet: lane-ordered rows, bib/name/school, time keypad, status dropdown and finish-order column. At review show time unit/precision and every missing lane outcome. Admin: heat builder, category and distance filter, qualification preview with Q-by-place/q-by-time explanation, lane assignment and next-round blockers. CH reviews raw timing evidence where available and unresolved order conflicts.

### Acceptance vectors

5.21 s ranks before 5.35 s for comparable timed results; a DNS row never ranks first. Identical displayed times require official ordering or the configured tie process. With two heats, top two per heat plus next two times produces six distinct qualifiers. SP30 records cannot enter an SP50 final. These numbers are synthetic examples.

## 18. G03 — Kho Kho

### Rule profile and dataset

Confirm conventional school Kho Kho or another explicit variant; team/squad sizes, defending batch size, number of innings/turns, duration, points per out, substitutions, penalties, tie method and league scoring. Conventional federation/association references describe one point per defender out (S02). Modern variants may differ, so all profile-dependent fields must remain versioned and visible.

KhoTurn: inning_no, turn_no, chasing_team, defending_team, planned/actual duration and close_reason. KhoBatch: turn, batch_sequence, ordered defender IDs, entry/exit times. KhoOutEvent: turn, batch, defender, official_time, out_reason, points_awarded and official confirmation. KhoPenalty: side, points, reason and reference. Optional minimum-chase tie records store official elapsed time independently.

### Calculation and validations

- createKhoTurn alternates chasing/defending roles according to the approved sequence and validates the previous turn is closed.
- recordDefenderOut accepts an active defender in the current batch; one defender's departure is counted once per batch appearance. Re-entry in a later valid batch is a new appearance.
- computeTurnScore sums confirmed out-event points and authorised adjustments. Match total sums the team's chasing turns and permitted awards, not defender survival time by default.
- advanceBatch requires all current defenders to have resolved status, or an explicit official transition reason. A disabled dream-run/powerplay variant contributes no points.
- closeKhoMatch requires the approved innings/turn structure or a documented early-completion decision. Missing turns must not be treated as zero-scoring completed turns.
- Equal final totals in a knockout create the selected tie procedure, such as an approved extra-turn or minimum-chase profile. Exact timing and stopping conditions are mandatory profile values; the official confirms the tie result.

### Screens and acceptance

VOL sees current chasing team, turn clock, defender batch cards, Out/Correction controls, turn totals and previous-turn timeline. Admin configures variant and tie procedure; CH reviews turn completeness, repeated outs, penalties and tie evidence. Export includes inning/turn breakdown and final points.

For a local profile with one point per out, eight accepted outs produce eight base points. A duplicate out for the same active appearance is rejected. Reversing an out recalculates totals and warns if the next batch depended on that dismissal. A missing second turn blocks finalisation unless an official early-finish reason is recorded.

## 19. G04 — Softball Throw

### Rule profile and dataset

This is an individual throwing-distance event, not a softball team match. Confirm implement specification, throwing technique/start area, sector/foul rules, attempts, measurement method, precision, tie policy and category. Proposed local format for review: three attempts and best valid distance, with next-best valid attempts for ties if adopted. Special Olympics publishes a softball-throw example, but its participant classification and full regulations are not presumed to apply to this event (S04).

MeasuredAttempt: entry, fixture, attempt_no, implement_profile_id, outcome (valid/foul/pass/not_taken), raw distance/unit, normalised distance_mm, measurement resolution, landing/line decision, judge and reason. Store a valid distance only for a valid attempt. A practice throw is tagged separately and excluded from results.

### Logic and functions

openAttemptRound checks the resource is released for the next athlete according to the official's control. recordThrow captures the judge's validity decision and measurement. validateAttempt checks sequential numbering, attempt cap, permitted unit and implement/category match. computeBestThrow selects the largest valid mark; no valid attempts yields NM. rankThrows compares best values, then the agreed next-best sequence; if still equal use shared place or official tie resolution, never an arbitrary order.

No additional attempt is created automatically after a foul. An official replacement attempt explicitly references the void attempt and the reason; valid-attempt quotas and total-attempt quotas are different settings. Re-measurement preserves original and revised marks. The administrator cannot change attempt count after some athletes finish without an impact/exception workflow.

### Frontend and acceptance

VOL table: athlete rows, attempt columns, Valid/Foul/Pass controls, distance keypad, best mark and provisional rank. Display metres while storing exact normalised units. ED sets implement profile, attempt limit and tie chain; CH sees attempt history and judge notes. Output: attempts, best distance, rank/status and tie explanation.

Synthetic marks 12.40 m, foul, 13.10 m yield 13.10 m. Three fouls yield NM. Two best marks of 13.10 m can be separated by next-best marks only if that tie method was approved. A fourth attempt under a three-attempt profile needs a recorded replacement/exception.

## 20. G05 — Kids Javelin Throw

### Rule profile and dataset

Use a dedicated child-event implement profile with confirmed material/type, mass, length, permitted start/run-up, throwing area, landing-validity rules and age category. Do not inherit adult javelin specifications. Decide distance scoring versus a target/zone-points activity. World Athletics Kids' Athletics includes a target-based javelin activity, illustrating why the game name alone does not identify its scoring method (S05).

Fields extend MeasuredAttempt with javelin_profile, start_mode, landing_validity, and, for a separately approved target profile, zone_id and awarded_points. The competition uses exactly one scoring mode. A zone score cannot be added to a distance, and different implement profiles do not share one classification.

### Logic and functions

validateJavelinProfile blocks publishing without the implement and scoring mode. recordJavelinAttempt captures official validity and distance or zone. Distance mode follows the best-valid-attempt pipeline with its approved tie chain. Target mode maps each valid zone to a configured point value and combines attempts using an approved sum/best rule. A boundary landing is an official decision using the published zone-boundary policy.

The system records the judge's landing decision; it cannot assume every child-safe implement must land tip-first or infer validity from its measured length. Official suspension of the throwing area pauses entry of new attempts until resume; administrative reopening is recorded. Attempt replacement and corrections follow G04 with their own rule version.

### Frontend and acceptance

Distance-mode screen has attempt columns and best mark. Target-mode screen has labelled zone buttons, attempt points and total. The selected mode and implement name are prominent. ED configures and previews both templates but enables only the agreed one per competition. CH review shows validity reasons, raw values and best/total calculation.

Synthetic distance marks 8.20 m, 9.00 m, foul yield 9.00 m. In a separately configured sum-points profile with zones worth 1/3/5, valid zones worth 3, 5 and 1 total 9 points. Attempting to enter 9 m in that points field fails type validation. These examples do not prescribe event distances or equipment.

## 21. G06 — Cycling

### Rule profile and dataset

Confirm course type, distance/laps, category, cycle/equipment class, start mode, timing method, start intervals where relevant, penalties, overtaking/course rules, neutralisation/restart procedure and classification of lapped riders. The proposed software supports a closed-course time trial or a mass-start race as different profiles. The UCI regulation library is a reference framework, not automatic adoption of elite road-race rules (S06).

CyclingStart: entrant, bib, scheduled_start, official_start, starting_order and equipment-check outcome. CyclingPassage: entrant, checkpoint/lap, official crossing time, sequence and source. CyclingResult: completed_laps, official_finish_position, elapsed_us, penalty_us, final_time_us, status and official classification decision. Clock source and measurement precision are recorded.

### Calculation and validations

- Time trial: official elapsed = official finish minus the profile's applicable start reference; final time = elapsed + approved time penalties. If late-start rules use scheduled rather than actual start, pin that policy explicitly. Rank eligible completed riders by final time and approved tie procedure.
- Mass start: classify riders by official finishing order after required distance. Lapped-rider classification follows its separate approved rule; do not rank all riders by their personal elapsed/net time. Lap counts and finish order can reveal a missing lap for review.
- Validate ordered checkpoint passages and lap numbers; duplicates from a timing import do not add laps. All combined timestamps must share a valid timing reference, not unrelated phones' wall clocks.
- DNS, DNF, DQ and equipment-not-cleared are separate states. A mechanical problem does not automatically earn a restart or time credit; record the official decision.
- Neutralisation suspends the race's normal calculation. Restart creates a linked run and explicit carry-over/void policy. A course change requires an official profile and affected-result review.

### Frontend and acceptance

VOL screens differ: time-trial start queue with individual start/finish entries, or lap grid with bib search and finish-order capture. Show unresolved missing laps and timer-source warnings. ED configures course/lap resources, start mode, equipment checks and staffing; CH reviews penalties and incomplete classifications. Output includes mode, distance, laps, official position, time and status.

A time trial of 120.50 s plus 5.00 s penalty yields 125.50 s. Two identical imported crossings count once. In a three-lap mass start, a two-lap rider cannot be declared the distance-complete winner. A restarted race preserves the superseded run's evidence.

## 22. G07 — Chess

### Rule profile and dataset

Confirm individual tournament format (round-robin, Swiss or knockout), rounds, time control/increment, default time, bye policy, permitted draws, tie-break order and arbiter. FIDE's Laws provide the reference result framework: win/loss and draw outcomes, with arbiter decisions required for relevant claims. Tournament tie-break regulations are separately versioned (S07 and S08). This dashboard initially records over-the-board results; an online chessboard, move engine and automatic cheating analysis are outside scope.

ChessPairing: stage/round, board, white_entry, black_entry or bye, pairing source/version and publication state. ChessBoardResult: result_code, white_score_units, black_score_units, played_flag, termination_reason, arbiter, evidence, submission status. Store half-point units as integers (win 2, draw 1, loss 0) for the proposed conventional 1/0.5/0 profile. Bye and forfeit types are distinct from played games even if they award the same points.

### Logic and functions

- importOrCreatePairings validates one assignment per player per round, no self-pairing, board uniqueness and eligible active participants. Manual approved pairings are supported. Automated Swiss pairing requires a selected validated engine/rule version; do not approximate Swiss pairing by sorting scores and pairing adjacent players.
- recordChessOutcome offers White Win, Black Win, Draw, white/black forfeit, double forfeit, postponed and cancelled as allowed. It derives scores from the selected result code; users cannot submit inconsistent points for the two sides.
- A reported flag fall, repetition, illegal move or stalemate becomes an arbiter decision; the result-entry form does not infer a winner from a claim or device timer alone.
- computeChessStandings sums awarded points and retains played/unplayed distinctions. Apply the exact published tie-break list and handling of byes/forfeits. Basic Buchholz is the sum of opponents' scores for fully played games; special cases require the adopted regulation, not a zero-value placeholder. Show each contribution for review.
- lockChessRound requires all board results resolved or expressly excluded by an arbiter decision. Generate the next round from a recorded standings snapshot; later amendments warn that published pairings may be affected.

### Frontend, admin and tests

VOL board list shows round, board, White/Black and large result buttons. Confirmation repeats both players and scores. CH/arbiter review shows disputed claims and changed outcomes. ED configures format, rounds, time control, tie-break order and pairing import. Optional PGN attachments are evidence, not a requirement to enter every move.

Synthetic Win + Draw + Loss produces 1.5 points. A bye may award 1 point if configured but does not count as a played win. Two players cannot occupy two boards in the same round. Changing a prior round's result recalculates standings and flags dependent pairings. Exhausted tie-breaks follow the published final resolution policy.

## 23. G08 — Standing Broad Jump

### Rule profile and dataset

Standing broad jump is stored as SBJ, separate from a run-up long jump. Confirm attempt count, permitted preparatory movement, take-off validity, landing-area measurement, precision and tie policy. A relevant reference describes a two-foot take-off from behind the line and measurement to the nearest landing impression (S04); organisers must adopt the exact local technique and foul rules.

Fields: entry, attempt_no, takeoff_validity, landing_validity, official_mark_mm, raw_value/unit, outcome, foul_reason, judge and replacement_reference. Proposed local format: three attempts, maximum valid distance, then next-best marks if adopted.

### Logic and screens

recordBroadJumpAttempt captures the judge's validity decision before the distance. computeBroadJumpResult excludes foul/pass/not-taken attempts, takes the greatest valid mark and retains all attempts for the approved tie chain. A hand/backward landing can affect the official measured mark; the software records the judge's measurement rather than estimating a heel-to-line distance. No valid marks yields NM. A skipped attempt is not a zero-distance valid jump.

VOL sees an athlete-by-attempt grid, large Valid/Foul/Pass actions, distance keypad and best mark. ED configures measurement units, attempt policy and tie chain. CH review shows validity comments and corrections. A round-completion panel identifies missing outcomes and distinguishes intentional pass from unfinished entry.

Tests: 1.20 m, 1.32 m and foul produce 1.32 m; 132 cm normalises to the same mark as 1.32 m. An equal best mark follows the configured next-best sequence or shared-place policy. A run-up long-jump template is rejected for SBJ. Editing a final mark triggers the normal amendment process.

## 24. G09 — Tug of War

### Rule profile and dataset

Confirm team size, category, any team-weight/class criteria, approved rope and ground profile, pull format, end changes, rest, warnings, no-pull/re-pull handling, defaults and tournament points. The TWIF rules library is the reference for an adopted federation profile (S09); this specification does not assert that adult weight categories or every TWIF rule applies to children.

TugPull: fixture, pull_no, replay_sequence, side/end allocation, active roster snapshot, start/end, outcome (team A/team B/no_pull/abandoned), warning log, official reason and judge. TeamCheck records required composition/weight checks if the organiser adopts them. Pull outcomes and match standings points are separate records.

### Logic and functions

- validateTugRoster verifies the approved team-size/composition policy and any required check; weights, if collected, are restricted and not public result fields.
- recordPullResult accepts only an official declared outcome. Distance crossed, warnings or a video are not independently adjudicated by the software.
- In a proposed best-of-three knockout profile, first to two valid pull wins wins the match. A no-pull counts as no win and creates an explicit replay linked to the same logical pull. Never increment both pull count and win count for a no-pull.
- Alternative league profiles may use two pulls and configured table points. The profile must distinguish this from a best-of-three match and define ties; the UI cannot blend both formats.
- endChange and rest requirements derive from the approved profile and valid pull sequence. An abandoned pull/match awaits an official disposition. Walkover has a result reason and does not fabricate measured pulling performance.

### Frontend and tests

VOL displays current pull, sides, previous outcomes, roster confirmation and A Wins/B Wins/No Pull/Abandoned. A no-pull reason is mandatory. ED configures pull format and team checks; CH reviews warnings, replays and match outcome. Output includes valid pulls won, no-pull history, match winner and reason.

In the example best-of-three profile, A wins, no-pull, A wins produces a 2–0 match, with one replay record. A 1–1 score requires another valid pull. A repeated save of a pull does not award an extra win. A two-pull league draw is valid only in the selected league profile.

## 25. G10 — Badminton

### Rule profile and dataset

Confirm singles/doubles/mixed categories, match format, games to win, target points, winning margin, cap, interval/end-change rules, retirement/walkover handling and tournament tie-breaks. Rule versions must be effective-date aware: national federation notices confirm BWF's adoption of 3×15 from 4 January 2027 (S10). The event date is not yet known; the organiser must choose the applicable profile rather than use a permanently hard-coded 21-point setting.

GameScore: fixture, game_no, points_a/b, state, winner and entry_mode. RallyEvent: game, sequence, awarded_side, server/receiver if tracked, reason and correction reference. DoublesSide has two distinct eligible players, with initial service/receive order if detailed tracking is selected.

### Calculator and validations

Use configured target T, required lead L, optional cap C, and games-to-win W. A side wins a game when its score is at least T and its lead is at least L, or when it reaches the adopted cap. C must be absent or at least T. Reject scores above C, tied terminal scores, and results that imply play continued after the game should already have ended. For final-score-only entry, require a reachable terminal score; for live scoring, prevent rallies after closure unless correcting an earlier event.

The first side with W game wins wins the match. Disable extra games beyond that point. Retirement/walkover uses a distinct result reason and retains completed games; do not invent unplayed rally scores. Detailed service-order assistance is OPTIONAL and requires its own validated doubles state logic; score-only mode must not pretend to know who should serve.

### Frontend and admin

VOL sees match identity, singles/pair names, game tabs, A/B point buttons, correction history and match summary. In final-score mode show one row per game and validation as values are entered. ED previews profiles using deuce/cap examples and records rule effective date; CH reviews terminal-score validity, pair eligibility and exceptional endings.

### Synthetic tests

For an explicitly selected T=21, L=2, C=30, W=2 profile: 21–19 closes a game; 21–20 does not; 30–29 closes it; 31–29 is invalid. Game wins of 2–0 end the match. For a separately selected T=15, L=2, C=21 profile, 15–14 continues and 21–20 closes. These are calculator fixtures; only the organiser-approved applicable rules govern the event.

## 26. G11 — Volleyball

### Rule profile and dataset

Confirm team/roster size, sets to win, ordinary-set target, deciding-set target, margin, optional local cap, rotation/substitution/timeout rules, net/equipment category and table-points policy. FIVB's 2025–2028 reference uses three sets to win, ordinary sets to 25, a deciding fifth to 15, and a two-point margin (S11). A shorter school format is a separate local profile requiring approval.

VolleyballSet: fixture, set_no, target, points_a/b, state, winner, first_server and optional lineup snapshot. VolleyballRally: sequence, awarded_side, reason and correction reference. Optional RotationState and SubstitutionLog support detailed officiating; final-set-score entry is the baseline operational mode. Record timeouts and sanctions if selected, without treating every sanction as a point penalty automatically.

### Calculator and validations

- Determine target from the set number and match format; the deciding-set target applies only to the actual deciding set. With W sets needed, a possible deciding set is number 2W−1.
- Validate each completed set using target and lead; an ordinary reference profile has no cap. In that profile 25–24 remains open and 26–24 closes. Do not apply badminton's 30-point cap.
- Sum valid set wins; stop once a team reaches W. A team winning fewer total rally points can still win the match by winning more sets.
- Forfeit/incomplete-team outcomes require official handling and the chosen profile. Keep played scores and any awarded score separately so reports explain the result.
- If rotation tracking is enabled, initialise lineups, validate substitutions against the selected profile, and update serving/rotation state after the referee-confirmed rally. A rule error opens an official decision rather than silently rewriting past points.

### Frontend and acceptance

VOL set grid shows points, target, winner and match sets won. Optional live scoring adds point buttons, serving-side indicator and lineup panel. ED configures match length, deciding target and whether detailed rotation is in scope. CH sees incomplete sets, illegal extra sets and sanction reasons.

Under W=3 with a 15-point decider, 15–14 in the fifth set continues; 16–14 closes. A 3–0 match cannot contain a fourth completed set. Under a local W=2 profile, the third set is the deciding set and uses its configured target. Total rally points are never substituted for set wins.

## 27. Rule approval checklist and unresolved decisions

The confirmed game list is complete for this specification. The remaining decisions concern event policy, not missing generic modules. Track each in the workbook with owner, proposed value, confirmed value and status.

| Decision | Applies to | Required before |
| --- | --- | --- |
| Event dates, schools, athlete/volunteer counts and concurrent usage | Whole platform | Infrastructure sizing and delivery estimate |
| Age groups, eligibility cutoff, participation categories and entry caps | Every discipline | Athlete eligibility and registration publishing |
| School versus cluster competition stages; progression quotas | Every competition | Draw and schedule publishing |
| Team/squad sizes and substitution policies | Kabaddi, Kho Kho, Tug of War, Volleyball, doubles Badminton | Roster validation |
| Half/turn duration, bonus variants and tie stages | Kabaddi/Kho Kho | Rule approval |
| Lanes, timing method, precision, false-start and heat qualification rules | SP30/SP50/SP60 | Start-list publishing |
| Attempt count, implements, measurement/foul rules and ties | SBT/KJT/SBJ | Rule approval |
| Distance or target mode and child-safe implement profile | Kids Javelin Throw | Rule approval |
| Course, distance/laps, start mode, equipment checks and restart policy | Cycling | Scheduling and start clearance |
| Format, rounds, time control, pairing source, byes and tie-breaks | Chess | Pairing publishing |
| Pull format, team checks and no-pull rules | Tug of War | Rule approval |
| Rule effective date, points, lead, cap and games to win | Badminton | Rule approval |
| Match length, set targets, rotation detail and local modifications | Volleyball | Rule approval |
| CH athlete-edit fields, cross-cluster review owner and override policy | Access/review | Permission configuration |
| Daily/shift attendance; offline support; required kit items | Event operations | Operations rehearsal |
| Public results, medals, school points, certificates and messaging | Optional extensions | Extension scope sign-off |

## 28. Acceptance and rehearsal plan

Run shared permission/workflow scenarios and one complete competition per confirmed discipline. Fixtures must include individual entries and team rosters across multiple schools and clusters. The workbook contains explicit expected outcomes and negative tests. The synthetic seed dataset is for demonstration only; it is not the real registration data and does not establish event rules.

Rehearsal flow: ED configures an event and approved sample rules → imports schools/users/athletes → assigns CHs and volunteers → validates entries/rosters → publishes schedules/start lists → records attendance and kits → records game observations → submits/returns/corrects → approves/locks → reviews dashboard totals → amends a result and checks progression impact.

Failure rehearsal: duplicate school/athlete codes, cross-cluster access, simultaneous last-stock issuance, participant schedule clash, invalid time/mark, unresolved game tie, browser closed with local draft, expired session during sync, stale score revision, failed alert delivery, partial import, unavailable venue and restored backup. Acceptance is demonstrated behaviour against agreed policies; the written tests are not a claim that an application has already passed them.

## 29. Reference sources and limits

S00. Sanan.pdf, supplied by the user: operational roles, modules, baseline permissions and workflows, pp. 1–11. The user's later message supplies the confirmed sports list and takes precedence over the PDF's illustrative examples.

S01. [International Kabaddi Federation rules v2.1.0](https://www.kabaddiikf.com/images/new-IKF_Rules.pdf). Scoring/bonus excerpts were available in official search results; full-file retrieval was unavailable. Confirm the event's adopted edition and all local variants with its technical official.

S02. [Kho Kho Federation of India rules library](https://khokhofederation.in/rules-regulations/) and [Rajasthan Kho Kho Association match rules](https://www.khokho.co.in/kho-kho-match-rules). The library was accessible; complete current linked rulebook text was not. The conventional points reference is supported by the association's indexed text. Durations and tie mechanics remain explicit local decisions.

S03. [World Athletics technical information](https://worldathletics.org/about-iaaf/documents/technical-information). The indexed library lists 2026 rules/amendments. Full current consolidation was not retrievable; no claim of full federation compliance is made for school sprint distances.

S04. [Special Olympics Athletics Rules, September 2024](https://media.specialolympics.org/resources/sports-essentials/sport-rules/Sports-Essentials-Athletics-Rules-2024.pdf), field-event/standing-jump/throw references. Used as a concrete example of adapted measured events. No inference about participant disability or adoption of Special Olympics classifications is made.

S05. [World Athletics Kids' Athletics — Javelin Target Throw](https://worldathletics.org/en/kids-athletics/teaching-athletics/javelin-target-throw). Supports the existence of a target-based child activity; equipment and scoring selection remain local.

S06. [UCI regulations library](https://www.uci.org/regulations/3MyLDDrwJCJJ0BGGOFzOat?mdrv=www.uci.org). Reference destination for the organiser's selected cycling discipline; proposed school-course calculation modes are not an assertion of UCI certification.

S07. [FIDE Laws of Chess](https://handbook.fide.com/chapter/e012023). Reference result and arbiter framework.

S08. [FIDE Play-Off and Tie-Break Regulations, effective 1 March 2026](https://handbook.fide.com/chapter/TieBreakRegulations032026). Reference for published tie-break order and special handling of unplayed games.

S09. [TWIF rules library](https://tugofwar-twif.org/2016/08/05/rules/). Lists August 2026 manual; full manual retrieval was unavailable. Pull-count examples are proposed local software profiles, not asserted current TWIF competition regulations.

S10. [USA Badminton notice of BWF scoring change](https://usabadminton.org/bwf-approves-3x15-scoring-system/) and [BWF change infographic hosted by USA Badminton](https://usabadminton.org/wp-content/uploads/2026/04/The-New-Way-Forward-with-the-3x15-Scoring-System.pdf). Establishes the announced 4 January 2027 transition. Exact event profile still requires selection.

S11. [FIVB Official Volleyball Rules 2025–2028](https://www.fivb.com/wp-content/uploads/2025/01/FIVB-Volleyball_Rules2025_2028-EN-v05.pdf), rules 6.2–6.3. Supports reference set/match scoring; local school modifications are separate.

S12. [MDN Background Synchronization API](https://developer.mozilla.org/en-US/docs/Web/API/Background_Synchronization_API). Browser support limitations justify explicit reopen/manual retry behaviour.

S13. [PostgreSQL transactions](https://www.postgresql.org/docs/current/tutorial-transactions.html) and [row security](https://www.postgresql.org/docs/current/ddl-rowsecurity.html). Technical basis for atomic writes and optional database scope enforcement.

Reference access date: 7 September 2026. This is an application specification, not a complete officiating manual. Technical officials approve local profiles; the application preserves those approved versions and their decisions.
