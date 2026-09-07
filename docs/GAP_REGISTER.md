# Gap register

Every gap found between the planning specification and a buildable system, and what
was done about it. Grouped by the kind of gap, because they need different scrutiny:
a **structural** gap is a design judgement you can overrule cheaply; a **compliance**
gap is not.

Each entry states the gap, the decision, and — where relevant — the test that pins it.
Nothing here silently changes the specification's meaning; where the spec is explicit,
the spec wins.

---

## A. Compliance gaps — the ones that would have bitten in production

### GAP-C01 · No consent model for children's data
**Gap.** The specification has 65 entities and none of them records consent. Every
athlete in a BalOlympiad is a child, and India's Digital Personal Data Protection Act
2023 §9 requires a data fiduciary to obtain **verifiable consent of a parent or lawful
guardian** before processing a child's personal data. It further prohibits tracking or
behavioural monitoring of children.

**Decision.** Added `Guardian` and `ConsentRecord` as first-class entities.
- Consent is **purpose-scoped**: `EventParticipation`, `MedicalEmergency`,
  `PhotographyMedia`, `PublicResults`. "May we run the event" and "may this child's
  name appear on a public leaderboard" are separate questions, so they are separately
  consented.
- Consent is **versioned and language-aware**: `notice_version` and `notice_locale`.
  Consent to a notice nobody could read is not consent.
- Withdrawal is **recorded, never deleted** (`withdrawn_at`, `withdrawal_reason`), so
  the audit trail survives — §13 requires that.
- A partial unique index enforces at most one live consent per athlete per purpose.
- New error code `CONSENT_REQUIRED` (HTTP 451).
- No analytics, trackers or third-party scripts anywhere in the web app.

**Tests.** `services/api/src/db/constraints.test.ts` → "DPDP §9 consent invariants".

---

### GAP-C02 · Aadhaar would have been collected by default
**Gap.** `Document.document_type` is free text. An Indian deployment will be asked for
Aadhaar as age proof, and a free-text type invites storing the number.

**Decision.** The platform **never stores an Aadhaar number**, by construction rather
than by policy.
- The vocabulary offers `AadhaarSighted` — a *sighting record* (who checked, when),
  not a number.
- `Document.sighted_last_four` accepts at most four digits, enforced by a database
  CHECK: `sighted_last_four ~ '^[0-9]{4}$'`. A 12-digit value cannot be written.
- `containsAadhaarLikeNumber()` guards free-text fields.
- `NO_RETENTION_DOCUMENT_TYPES` marks types whose file contents are not retained after
  verification.

**Why removal rather than protection.** Aadhaar Act 2016 §29 restricts sharing of
identity information, and a school sports entry does not need it — a birth certificate
or transfer certificate is the ordinary age proof. A capability that does not exist
cannot leak.

**Tests.** `constraints.test.ts` → "stores at most four sighted digits, never a full
identity number".

---

### GAP-C03 · No retention boundary on personal documents
**Gap.** §13 says retention policy must "distinguish operational results from personal
documents" and warns against silently keeping private documents forever — but no field
expresses it.

**Decision.** `Document.retention_expires_at`, indexed, so a purge job is possible and
auditable. Results are unaffected: §13 also forbids deleting auditable results along
with documents.

**Still open.** The retention *periods* are an organiser decision — DEC-016.

---

## B. Correctness gaps — where the obvious implementation is wrong

### GAP-K01 · Float arithmetic breaks measurement equality
**Gap.** §6 requires "exact decimal or integer base units, not binary floating-point
equality", and GT-026 requires 132 cm and 1.32 m to be the same mark. A naive
`metres * 1000` fails: `1.005 * 1000 === 1004.9999999999999`, which truncates to
1004 mm — a silent millimetre that can reorder a podium.

**Decision.** `packages/rules/src/units/measure.ts` parses the **decimal string** and
shifts the point by integer arithmetic. No float multiplication ever touches a stored
mark. Distances normalise to integer millimetres, times to integer microseconds.
Over-precise input is rejected rather than rounded, because §6 forbids inventing
accuracy the instrument did not capture.

**Tests.** `measure.test.ts`, `attempts.test.ts` → GT-026.

---

### GAP-K02 · An instant is not a duration
**Gap.** Found while building cycling. §17 says "A completed run cannot have
zero/negative duration", which is true of a *duration* — but a cycling start gun at
`t = 0` on the event timing reference is a legitimate *instant*, and a zero time
penalty is a legitimate quantity. One parser cannot serve both.

**Decision.** Split into `toMicroseconds` (non-negative — instants and penalties) and
`toDurationMicroseconds` (strictly positive — a completed run). The sprint calculator
uses the strict one; cycling uses both, and validates elapsed time separately.

---

### GAP-K03 · A tie policy that runs out must not be finished by sort order
**Gap.** §15 forbids breaking ties "using database IDs, names, school names,
data-entry time or hidden randomness". A stable sort over equal keys silently does
exactly that — it preserves insertion order and decides a medal.

**Decision.** `packages/rules/src/tie.ts` takes candidates as an **unordered set**,
groups by exact value, and applies only the comparators the published policy names.
When the policy is exhausted the group stays explicitly tied: either a shared place
(only where the profile permits it) or `TIE_REQUIRES_DECISION`, leaving those
participants unranked.

The load-bearing consequence is GT-014: A goes ahead of B *only if* a `NextBestMark`
rule was adopted. With an empty policy the software must refuse to separate them.

**Tests.** `attempts.test.ts` → GT-014 asserts all three branches.

---

### GAP-K04 · A score can imply play continued after the game ended
**Gap.** §25 requires rejecting "results that imply play continued after the game
should already have ended". A validator that only checks whether the *final* score is
terminal accepts 25–20 under T=21/L=2 — impossible, because play stops at 22–20.

**Decision.** A final score is legal only when it is terminal **and** the score one
rally earlier was not. `packages/rules/src/games/rally.ts`.

**Tests.** `matchplay.test.ts` → "rejects a score that implies play continued".

---

### GAP-K05 · Kabaddi's score is state, not a sum
**Gap.** GT-004 requires that correcting an earlier raid "replays subsequent state and
exposes dependent contradictions". A `sum(points)` implementation passes GT-001 and
GT-003 but produces a wrong-but-plausible total for GT-004 — precisely the failure
§16 warns about.

**Decision.** `calculateKabaddi` is a deterministic **replay** from the opening court
state, tracking active players and the revival queue. `replayWithCorrection` diffs the
issue sets before and after a correction to surface newly impossible raids. The all-out
is computed from replayed state *and* cross-checked against the official's confirmation
flag — neither is trusted alone.

**Tests.** `kabaddi.test.ts` → GT-004.

---

### GAP-K06 · "Optional" was encoded as a zero quantity
**Gap.** My own first cut modelled an optional kit item as `required_quantity = 0`,
which collided with the positive-quantity CHECK. It is also the antipattern §1 names:
"A missing value is not equivalent to zero, absent, invalid or not applicable."

**Decision.** `KitEntitlement.is_required` — an explicit flag. Optionality is a
property of the entitlement, not a magic quantity, and an optional item can still
carry a real quantity ("up to 2 caps on request").
Migration `20260907000200_kit_optional_items`.

**Tests.** `acceptance.test.ts` → AT-023.

---

### GAP-K07 · An interval cannot be closed before it opened
**Gap.** Found by the database, in a live request. `reassignSchool` closed the
incumbent interval at "now", but the seeded assignment *starts in the future*
(1 November). The result was a negative interval and an HTTP 500.

**Decision.** `assignSchoolsToCH` checks `current.effective_from < effectiveFrom` and
returns a per-school `Blocked` outcome with a remedy, matching §4's "return per-school
outcomes" and "require explicit disposition".

---

### GAP-K08 · A discipline code is an identity
**Gap.** `Sport.code` and `Discipline.code` had no unique constraint, but the code
(`KAB`, `SP30`) is what the rules registry, score templates and calculators key on.
Two rows sharing one code would route scoring ambiguously.

**Decision.** Unique indexes, migration `20260907000300_discipline_code_unique`.

---

## C. Structural gaps — expressible only outside the field list

### GAP-S01 · Rules stated in prose, not enforceable by a field list
**Gap.** §14 mandates transaction-level protection for "overlapping active
assignments, entry caps, stock issues and primary scorecard ownership", and §13
requires audit history to be append-only. None of that is a column.

**Decision.** Migration `20260907000100_integrity_constraints` adds, against the live
database: 82 CHECK constraints, 287 foreign keys (including the 130 `created_by` /
`updated_by` keys Prisma cannot model without ruining the client), 7 partial unique
indexes, 1 GiST exclusion constraint for resource double-booking, and a trigger making
`audit_events` append-only.

The one worth singling out:
```sql
ALTER TABLE result_snapshots
  ADD CONSTRAINT result_rank_requires_completed_ck
    CHECK (rank IS NULL OR status = 'Completed');
```
GT-005 and §15 require that a DNF/DNS/DQ/NM can never receive rank 1. The calculators
guarantee it; this makes it true of **any** write, including a repair script.

**Tests.** `constraints.test.ts` — 20 tests against real PostgreSQL 16.

---

### GAP-S02 · Idempotency needs a table, not a cache
**Gap.** §1: "The key and the business write commit together." A Redis cache or an
in-memory map cannot satisfy that — a crash between the two loses the guarantee.

**Decision.** `IdempotencyKey` is a table, written inside the same transaction as the
business change. `runCommand` claims the key, runs the handler, appends the audit
event, enqueues outbox messages and stores the response — all or nothing. A retry
replays the stored response without re-running the handler.

**Tests.** `acceptance.test.ts` → AT-022.

---

### GAP-S03 · The outbox is load-bearing, not an optimisation
**Gap.** §1 describes an outbox and AT-028 requires that a delivery failure never
hides a saved result, but no entity exists for it.

**Decision.** `OutboxMessage`, with a unique `dedupe_key` implementing §11's
"event type + target version + recipient + channel". Enqueued in the business
transaction; a worker delivers. The CH review queue reads the database directly, so a
degraded notification channel cannot hide a submitted scorecard.

---

### GAP-S04 · Permission evaluation must work outside a request
**Gap.** §1 requires the same policy for "searches, counts, exports, attachments,
background jobs and notifications". Route middleware cannot deliver that.

**Decision.** `evaluateAccess(ActorContext, action, target)` is a pure function taking
a resolved actor, not a request. Route handlers call the module functions, which call
`assertAccess` themselves. A background export uses the identical call.

`ActorContext` is rebuilt from live assignment intervals on every request rather than
carried in a token — the only way to satisfy AT-004 ("inactive membership uses old
session → denied immediately").

`describeEffectiveAccess` implements §3's support view: it names *which* assignment or
grant produced access, never a bare yes/no.

---

### GAP-S05 · Errors need a remedy, including from the database
**Gap.** §1 requires errors that "identify the field or row and a remedy". A raw
constraint violation is neither.

**Decision.** `core/prisma-errors.ts` maps named constraints to the specification's
error taxonomy with a usable message. Unrecognised failures deliberately stay
generic 500s: inventing a business meaning for an unknown failure is worse than
admitting the request could not be completed.

---

### GAP-S06 · A participant snapshot must freeze display identity
**Gap.** §2 and §5 require that a school rename or an athlete transfer never rewrites
a historical result — but only a `participation_snapshot` JSON field expresses it.

**Decision.** `FixtureParticipant.participation_snapshot` and
`ResultSnapshot.identity_snapshot` are populated at freeze time with the display name
and school as they stood. `lockScorecard` requires them.

---

## D. Interface gaps

### GAP-U01 · Local and server saves are different facts
**Gap.** §10: "Autosave displays locally saved and server saved separately." On a
phone with no signal, "Saved" must not imply the server has the result.

**Decision.** Two separate chips in the score-entry frame, each with its own timestamp
and its own tone.

### GAP-U02 · A stale offline draft must be quarantined, not merged
**Gap.** §10: "If someone else submitted, approved or locked the result, quarantine
the stale local draft for review; never overwrite the server."

**Decision.** `quarantineDraft()` marks the local draft `Quarantined` on
`INVALID_STATE` or `VERSION_CONFLICT`. It is surfaced on the volunteer's Today screen
and is never retried automatically. No reliance on the Background Synchronization API
(source S12): sync runs when the app is open, and manual retry always works.

### GAP-U03 · An unavailable control must say why
**Gap.** §16: "Show unavailable bonus/variant buttons with a rule explanation."
Hiding a control makes a rule profile invisible.

**Decision.** Variant controls (Kabaddi bonus, super tackle; place-only sprint timing)
render **disabled with the reason** as a tooltip, never hidden.

### GAP-U04 · State components must survive having no session
**Gap.** Found in the browser: `SignInPicker` rendered `<Loading />`, which required
the session context that does not yet exist before sign-in. A recoverable state became
a blank page.

**Decision.** `useTranslate()` — a non-throwing accessor falling back to the stored
locale. Plus an `ErrorBoundary` that shows a quotable reference and confirms local
drafts are untouched, rather than a stack trace.

---

## E. Deliberately *not* filled

Four things the specification leaves open that this build does **not** decide, because
deciding them would fabricate an approval:

1. **Rule profile values.** Every seeded `RuleVersion` is `Draft` with empty settings.
   `missingProfileFields()` reports what is unset; publication is blocked until an ED
   approves. §6: "Required settings have no silent default."
2. **Age categories.** SGFI-style U-9…U-19 templates are seeded as **Draft templates**
   with a `TEMPLATE — requires organiser approval` note. The demo category stays Draft.
3. **Eligibility outcomes.** All 92 seeded entries are `Pending`. §5: "Missing proof is
   pending, not automatically eligible."
4. **Fixture publication.** All 13 seeded fixtures are `Draft` / `Unpublished` — the
   spec's own README says they "remain Draft deliberately".

See `DECISIONS.md` for the full open list with owners.
