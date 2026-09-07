# Khelo Sanand BalOlympiad

Event operations for a school BalOlympiad: three workspaces (Event Director, Cluster
Head, Volunteer), thirteen sports, built from the planning specification in `spec/`.

Gujarati / Hindi / English. Offline-capable score entry. Built for the Indian school
sports ecosystem — see [`docs/INDIA_DATA_MODEL.md`](docs/INDIA_DATA_MODEL.md).

```
190 tests passing  ·  69 tables  ·  287 foreign keys  ·  82 check constraints
13 discipline calculators  ·  all 38 workbook game vectors covered
```

---

## Quick start

```bash
npm install
docker compose up -d postgres        # or a local PostgreSQL 16
cp .env.example .env
npm run db:migrate -w @khel/api
npm run db:seed -w @khel/api -- --today
npm run dev:api                       # :4000
npm run dev:web                       # :5173
```

Open http://localhost:5173 and pick a demo user. `--today` rebases the synthetic
dataset so the event is happening now — without it the demo describes a future event
and every screen is legitimately empty, because scope resolves from *live* assignment
intervals.

No Docker? See [`docs/RUNBOOK.md`](docs/RUNBOOK.md) for a local PostgreSQL setup.

```bash
npm test           # 190 tests
npm run typecheck  # all four packages
```

---

## What this is

The input was a **planning specification, not code**: 65 entities, 823 typed field
contracts, 194 function contracts, 43 screens, 38 game test vectors and 35 acceptance
scenarios, plus a synthetic demonstration dataset.

The specification is unusually well-formed, so the data model is a transcription job
rather than a design exercise — `prisma/schema.prisma` is **generated** from
`spec/specification_catalogue.json`. The real engineering is in three places the
catalogue describes but cannot encode:

**1. Thirteen game calculators.** Pure functions with published test vectors, so
correctness is provable. All 38 vectors pass. The hard ones are not the arithmetic:

- *GT-014* — A beats B on next-best mark **only if** that tie rule was adopted. With an
  empty policy the software must refuse to separate them.
- *GT-004* — correcting an earlier Kabaddi raid must replay court state and expose
  contradictions, not just adjust a total.
- *GT-027* — an attempt not yet taken is **incomplete**, not "no valid mark".
- *§25* — 25–20 cannot occur under T=21/L=2, because play stops at 22–20.

**2. Permission evaluation.** `identity → membership → action → scope → fields → state`,
running server-side on every request *and* every background job. Not middleware — see
[`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).

**3. Indian data reality.** The spec is jurisdiction-neutral; a Gujarat deployment is
not. Guardian consent under DPDP Act 2023 §9, Aadhaar designed out entirely, UDISE+
school codes, taluka-level geography, Standard rather than grade.

---

## Layout

```
packages/contracts   error taxonomy, closed vocabularies, India validators
packages/rules       13 pure calculators + tie engine   (142 tests, no DB)
services/api         Fastify + Prisma + PostgreSQL       (48 tests, real DB)
apps/web             React PWA, three workspaces, gu/hi/en
spec/                the source specification (read-only input)
docs/                gap register, India model, open decisions, architecture
```

---

## Documentation

| | |
|---|---|
| [`docs/GAP_REGISTER.md`](docs/GAP_REGISTER.md) | **Every gap found and what was done about it.** Start here |
| [`docs/INDIA_DATA_MODEL.md`](docs/INDIA_DATA_MODEL.md) | Eleven India-specific changes; three are compliance-critical |
| [`docs/DECISIONS.md`](docs/DECISIONS.md) | The 16 open organiser decisions and how the platform behaves meanwhile |
| [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) | How it fits together, and what is not built |
| [`docs/SCREENS.md`](docs/SCREENS.md) | All 43 specified screens, and which are built |
| [`docs/RUNBOOK.md`](docs/RUNBOOK.md) | Local setup, migrations, seeding, troubleshooting |

---

## Two things worth knowing before you read the code

### The platform refuses to invent approvals

Sixteen decisions in the specification are **event policy, not missing software** — age
groups, cutoff dates, team sizes, tie procedures, the event date itself. This build
treats every one as unset configuration and blocks on it:

- all 13 seeded competitions have **Draft, unapproved** rule versions with empty settings
- all 92 seeded entries are **Pending** eligibility — §5: *"Missing proof is pending,
  not automatically eligible"*
- all 13 seeded fixtures are **Draft / Unpublished**
- an empty tie policy yields `TIE_REQUIRES_DECISION`, never a winner by insertion order

The Event Director's readiness screen counts these as blockers, which is what they are.
A plausible default would be worse than a blocker: it produces a result that looks
official and is not.

### Rules are enforced in the database, not only in code

Several requirements must hold for imports, background jobs and repair scripts — not
just the paths that remember to check. So they are constraints:

```sql
-- §15 / GT-005: a DNF/DNS/DQ/NM can never receive rank 1
ALTER TABLE result_snapshots
  ADD CONSTRAINT result_rank_requires_completed_ck
    CHECK (rank IS NULL OR status = 'Completed');

-- The full identity number is never stored — four digits at most
ALTER TABLE documents
  ADD CONSTRAINT document_sighted_last_four_ck
    CHECK (sighted_last_four IS NULL OR sighted_last_four ~ '^[0-9]{4}$');
```

Plus a GiST exclusion constraint against double-booked resources, seven partial unique
indexes for the "exactly one active X" rules, and a trigger making `audit_events`
append-only. Twenty tests verify these fire against real PostgreSQL.

---

## The confirmed programme

Eleven game groups as thirteen discipline codes — each sprint distance is separate.
**Football is explicitly out of scope.**

| | | |
|---|---|---|
| `KAB` Kabaddi | `KHO` Kho Kho | `TOW` Tug of War |
| `SP30` `SP50` `SP60` Sprints | `SBT` Softball Throw | `KJT` Kids Javelin |
| `SBJ` Standing Broad Jump | `CYC` Cycling | `CHE` Chess |
| `BAD` Badminton | `VOL` Volleyball | |

A test asserts none can be dropped: `packages/rules/src/registry.test.ts`.

---

## Status

Increment A and most of B are built and tested: event setup, identity and scope rules,
assignments, all thirteen score calculators, attendance, kits, and the approval /
locking workflow.

Not built, and named plainly in [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md): most
list and detail screens (routed placeholders), the import wizard UI, the outbox
delivery worker, and a real identity provider. The optional scope in §14 — public
results, awards, external messaging, QR attendance, procurement — is untouched by
design.

---

*All names, dates, schools, athletes and results in `spec/synthetic_data/` are
invented. No real child, school, contact or fixture is represented.*
