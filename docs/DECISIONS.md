# Open decisions

The specification's §27 lists sixteen decisions that are **event policy, not missing
software**. This build treats every one of them as unset configuration: the platform
refuses to publish, approve or rank until the organiser supplies a value.

That refusal is deliberate. §6: *"Required settings have no silent default."* A
plausible default here is worse than a blocker, because it produces a result that looks
official and is not.

Status key — **OPEN**: no value supplied. **TEMPLATE**: a draft is seeded for the
organiser to adopt, amend or replace; it is not in force.

---

## Blocking decisions — nothing can be published without these

| ID | Decision | Applies to | Blocks | Status |
|---|---|---|---|---|
| DEC-001 | Event dates, school / athlete / volunteer counts, concurrent usage | Whole platform | Infrastructure sizing; the performance budget in §14 | OPEN |
| DEC-002 | Age groups, eligibility cutoff, participation categories, entry caps | Every discipline | Athlete eligibility; registration publishing | TEMPLATE — SGFI-style U-9…U-19 bands seeded as Draft |
| DEC-003 | School vs cluster competition stages; progression quotas | Every competition | Draw and schedule publishing | OPEN |
| DEC-004 | Team / squad sizes and substitution policy | KAB, KHO, TOW, VOL, doubles BAD | Roster validation and locking | OPEN |
| DEC-005 | Half / turn duration, bonus variants, tie stages | KAB, KHO | Rule approval | OPEN |
| DEC-006 | Lanes, timing method, precision, false-start policy, heat qualification | SP30, SP50, SP60 | Start-list publishing | OPEN |
| DEC-007 | Attempt count, implements, measurement and foul rules, ties | SBT, KJT, SBJ | Rule approval | OPEN — the spec proposes 3 attempts, explicitly "not approved" |
| DEC-008 | Distance or target mode; child-safe implement profile | KJT | Rule approval | OPEN — §20 notes the game's name does not determine its scoring method |
| DEC-009 | Course, distance / laps, start mode, equipment checks, restart policy | CYC | Scheduling and start clearance | OPEN |
| DEC-010 | Format, rounds, time control, pairing source, byes, tie-breaks | CHE | Pairing publishing | OPEN |
| DEC-011 | Pull format, team checks, no-pull rules | TOW | Rule approval | OPEN |
| DEC-012 | Rule effective date, points, lead, cap, games to win | BAD | Rule approval | OPEN — **see the note below** |
| DEC-013 | Match length, set targets, rotation detail, local modifications | VOL | Rule approval | OPEN |

### DEC-012 has a deadline attached

§25 records that BWF's 3×15 scoring system takes effect **4 January 2027**, and warns
against a permanently hard-coded 21-point setting. The event date (DEC-001) therefore
determines which profile applies.

The platform handles this by making `rule_effective_date` a **required** field on any
badminton rule profile — a profile without one fails validation
(`RULE_EFFECTIVE_DATE_MISSING`). Both calculators are implemented and tested:
T=21/L=2/C=30 and T=15/L=2/C=21 (`matchplay.test.ts`, GT-031…GT-034).

---

## Operational decisions

| ID | Decision | Applies to | Status |
|---|---|---|---|
| DEC-014 | CH athlete-edit fields; cross-cluster review owner; override policy | Access and review | OPEN — the permission matrix ships as specified; the CH editable-field list is narrowed to notes and correction requests pending confirmation |
| DEC-015 | Daily vs shift attendance; offline claims; required kit items | Operations rehearsal | OPEN — both attendance modes implemented; mixing them in one report is refused, per §8 |
| DEC-016 | Public results, medals, school points, certificates, messaging | Optional extensions | OPEN — internal results are baseline and work; public publication requires its own consent purpose |

---

## Decisions this build added

Surfaced by the Indian deployment context; not in §27.

| ID | Decision | Why it is needed | Status |
|---|---|---|---|
| DEC-IN-01 | Consent notice text, per purpose, in Gujarati / Hindi / English | DPDP Act 2023 §9 requires *verifiable* consent to an intelligible notice. `notice_version` and `notice_locale` are recorded against every consent | OPEN — counsel to approve |
| DEC-IN-02 | Retention periods: personal documents vs operational results | §13 requires the two be distinguished. `Document.retention_expires_at` exists; the period does not | OPEN — counsel to approve |
| DEC-IN-03 | Which document types are accepted as DOB proof | Defaults to birth certificate → transfer certificate → school bonafide. Aadhaar is **not** an option by design (see `INDIA_DATA_MODEL.md` §6) | TEMPLATE |
| DEC-IN-04 | Whether UDISE+ code is mandatory at registration | Currently optional: some private unaided schools cannot supply it, and blocking registration is worse than a null | TEMPLATE — optional |
| DEC-IN-05 | Guardian verification method per school | `SignedPaperForm` / `SchoolAttested` / `DigitalOtpVerified`. Which is acceptable is an organiser policy | OPEN |
| DEC-IN-06 | Event working language and printed-material language | Defaults to Gujarati (`gu`); school medium of instruction is recorded per school | TEMPLATE — `gu` |

---

## How the platform behaves while these are open

Not as a warning banner — as refusal:

1. **Rule versions seed as `Draft` with empty settings.** `missingProfileFields()`
   lists exactly what is unset for a discipline; `approveRuleVersion` will not pass
   until each has a value. A fixture pinned to an unapproved rule version returns
   `RULES_NOT_APPROVED` when a scorer opens it.

2. **All 92 seeded entries are `Pending` eligibility.** §5: *"Missing proof is pending,
   not automatically eligible."*

3. **All 13 seeded fixtures are `Draft` / `Unpublished`.** The spec's own README says
   they *"remain Draft deliberately"*.

4. **Age category templates carry an explicit marker** —
   `TEMPLATE — requires organiser approval (DEC-002)` — and `approval_status: Draft`.

5. **A tie policy that is empty produces `TIE_REQUIRES_DECISION`**, not a winner
   chosen by insertion order.

6. **No athlete can be entered without an active `EventParticipation` consent**
   (`CONSENT_REQUIRED`, HTTP 451).

The Event Director's readiness screen counts these as blockers. On the seeded data it
shows: 13 competitions with unapproved rules, 92 entries awaiting eligibility, 64
athletes without guardian consent.

---

## Recommended order of resolution

1. **DEC-001** (event date and volumes) — it gates infrastructure sizing *and*
   determines DEC-012's applicable badminton profile.
2. **DEC-002** (age groups and cutoff) — nothing about eligibility can be settled
   without it, and it is the commonest source of disputes.
3. **DEC-IN-01 / DEC-IN-02** (consent notice and retention) — needed before any real
   child's data is collected, so before registration opens rather than before the event.
4. **DEC-004 … DEC-013** (per-discipline rule profiles) — parallelisable, one technical
   official per discipline.
5. **DEC-003** (stages and quotas) — needed before draws.
6. **DEC-014 … DEC-016** (operational and optional scope) — before the rehearsal.
