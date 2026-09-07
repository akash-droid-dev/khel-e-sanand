# Architecture

```
┌──────────────────────────────────────────────────────────────────────┐
│  apps/web            React PWA · Gujarati / Hindi / English          │
│                      three workspaces (ED · CH · VOL)                │
│                      IndexedDB draft cache, quarantine on conflict   │
└───────────────────────────────┬──────────────────────────────────────┘
                                │  /api/v1/events/{eventId}/…
┌───────────────────────────────▼──────────────────────────────────────┐
│  services/api        Fastify                                         │
│                                                                      │
│    http/app.ts       routes only — no authorisation lives here       │
│    core/actor.ts     ActorContext, rebuilt from live intervals       │
│    core/access.ts    identity → membership → action → scope →        │
│                      fields → state                                  │
│    core/command.ts   ONE transaction: idempotency + business write   │
│                      + audit + outbox                                │
│    modules/m0*.ts    domain services; each calls assertAccess itself │
└───────────────────────────────┬──────────────────────────────────────┘
                    ┌───────────┴───────────┐
        ┌───────────▼──────────┐  ┌─────────▼──────────────────────────┐
        │ packages/rules       │  │ PostgreSQL 16                      │
        │ 13 pure calculators  │  │ 69 tables · 287 FKs · 82 CHECKs    │
        │ no I/O, no clock,    │  │ 7 partial unique · 1 GiST exclusion│
        │ no randomness        │  │ append-only audit trigger          │
        └──────────────────────┘  └────────────────────────────────────┘
```

`packages/contracts` sits under everything: error taxonomy, closed vocabularies,
command envelope, India-specific validators. Shared by API and web, so a status enum
cannot drift between them.

---

## Three decisions that shape everything else

### 1. The schema is generated, not written

`services/api/scripts/generate-schema.py` reads
`spec/specification_catalogue.json` — 65 entities, 823 typed field contracts — and
emits `prisma/schema.prisma`. Regenerate with `npm run db:generate-schema`.

Fidelity was the goal: a reviewer can diff the generated section against the
specification's data dictionary line by line, because field names stay snake_case
exactly as the spec writes them.

Additions are **explicit and separate**:
- `prisma/overlay.json` — extra fields, indexes and back-relations, each with a `why`
- `prisma/overlay-models.prisma` — the four added models

Hand edits to the generated section are overwritten. That is the point.

### 2. Calculators are pure

Every one of the 13 disciplines is `(rule profile, observations) → CalculationOutput`
with no database, no clock and no randomness. Three consequences the specification
depends on:

- recomputing a locked result from its stored revision reproduces it **exactly**;
- a tie can never be broken by insertion order or record id, because the calculator
  cannot see either unless the tie policy names it;
- the web app runs the **same calculator** the server will, so a volunteer sees the
  real result as they type — §6's "Render the same form and calculator used by VOL".

### 3. Authorisation is not middleware

§1 requires the same policy for "searches, counts, exports, attachments, background
jobs and notifications". A route guard cannot deliver that, so `evaluateAccess` takes
a resolved `ActorContext` and a target record — not a request. Route handlers call
domain functions; domain functions call `assertAccess` themselves. A background export
job uses the identical call.

`ActorContext` is rebuilt from live assignment intervals on **every** request rather
than carried in a token. That costs one query and is the only way to satisfy AT-004:
an inactive membership is denied immediately, even on a session issued minutes ago.

---

## The command transaction

`runCommand` opens one transaction and, inside it:

1. claims the idempotency key (§1: "The key and the business write commit together");
2. runs the handler;
3. appends audit events (§13: every change traceable to a request and an actor);
4. enqueues outbox messages (§1: outbound work joins the business transaction);
5. stores the response body for replay.

Isolation defaults to **Serializable**, because §14 requires transaction-level
protection for overlapping assignments, entry caps, stock issues and primary scorecard
ownership.

A retry with the same key replays the stored response without re-running the handler.
A different payload under the same key is rejected — `IDEMPOTENCY_PAYLOAD_MISMATCH`.

---

## Where each rule is enforced

Deliberately layered, because the specification requires several rules to hold for
imports and background jobs, not only for the UI.

| Rule | Web | Service | Database |
|---|---|---|---|
| A DNS cannot rank 1 | greyed | calculator | `result_rank_requires_completed_ck` |
| One active pool per volunteer | — | `assignVolunteerPool` | `volunteer_one_active_pool_uq` |
| One primary scorer per fixture | — | `assignFixtureDuty` | `fixture_one_primary_scorer_uq` |
| Participant is entry XOR team | form shape | module | `fixture_participant_exactly_one_ck` |
| Audit is append-only | — | no write path | trigger raises on UPDATE/DELETE |
| No Aadhaar number stored | no field | vocabulary | `document_sighted_last_four_ck` |
| One live consent per purpose | — | consent service | `consent_one_active_per_purpose_uq` |
| No double-booked resource | conflict preview | `detectConflicts` | GiST exclusion constraint |

The database column is the one that survives a repair script.

---

## Data lineage

§14: *"Every derived output keeps the exact source revision and rule version used."*

```
import / manual entry
  → AthleteRegistration → CompetitionEntry (+ EligibilityDecision, ConsentRecord)
  → FixtureParticipant  (participation_snapshot freezes display identity)
  → ScoreObservation
  → ScorecardRevision   (pins rule_version_id + template_id + checksum)
  → ReviewAction        (Submit → Return → Approve → Lock)
  → ResultSnapshot      (identity_snapshot freezes name and school)
  → progression / report / publication
```

A school rename or an athlete transfer after the fact cannot rewrite a locked result,
because the snapshot holds the identity as it stood.

---

## What is not built

Named plainly rather than left to be discovered:

- **Screens.** The interface catalogue defines 43. The shell, three workspace landings,
  shared list states and the score-entry frame with all 13 discipline bodies are built.
  The remaining list and detail screens are routed placeholders that say so.
- **Import wizard.** The contract is specified (§5) and the entities exist
  (`ImportJob`, `ImportRow` with original row numbers); the wizard UI is not built.
- **Outbox worker.** Messages are enqueued transactionally and are queryable; the
  delivery process is not written. Per AT-028 this does not block operations — the
  review queue reads the database directly.
- **Identity provider.** Sign-in is a demo picker over seeded users, refused when
  `NODE_ENV=production`. §3's login is a provider-enforced flow (OTP, expiry, retry
  limits, generic errors) that a local build must not fake.
- **Optional scope**, per §14: automated bracket generation, Swiss pairing engine,
  public results, awards and certificates, external messaging, QR attendance,
  procurement and full stock accounting. Manual fixtures with validation work.

---

## Test strategy

| Layer | Count | What it proves |
|---|---|---|
| `packages/rules` | 142 | All 38 workbook game vectors, plus programme coverage: 13 disciplines, 8 calculation families, no discipline dropped |
| `services/api` constraints | 20 | The integrity migration actually enforces its rules against real PostgreSQL |
| `services/api` acceptance | 28 | AT-* scenarios end-to-end through the real command layer |
| **Total** | **190** | |

The rules tests need no database and run in ~350 ms, so the calculators stay cheap to
iterate on. The API tests use a dedicated `khel_sanand_test` database, truncated per
run, and apply the real migrations rather than `db push` — the integrity constraints
are usually the thing under test.
