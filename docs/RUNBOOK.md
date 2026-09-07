# Runbook

## Prerequisites

- Node 20.10+ (built on 22)
- PostgreSQL 16 — via Docker, or locally
- Python 3 (only to regenerate the schema from the specification catalogue)

---

## With Docker

```bash
npm install
docker compose up -d postgres
cp .env.example .env
npm run db:migrate -w @khel/api
npm run db:seed   -w @khel/api -- --today
npm run dev:api    # :4000
npm run dev:web    # :5173
```

`docker-compose.yml` also defines MinIO for private document storage (§14). It is not
required for the API to run.

---

## Without Docker (macOS / Homebrew)

```bash
brew install postgresql@16
export PATH="/opt/homebrew/opt/postgresql@16/bin:$PATH"
export LC_ALL="en_US.UTF-8"        # required — see troubleshooting below
pg_ctl -D /opt/homebrew/var/postgresql@16 -l /tmp/khel-pg.log start

psql -d postgres -c "CREATE ROLE khel LOGIN PASSWORD 'khel_dev_only' SUPERUSER;"
psql -d postgres -c "CREATE DATABASE khel_sanand      OWNER khel;"
psql -d postgres -c "CREATE DATABASE khel_sanand_test OWNER khel;"
```

Started with `pg_ctl` rather than `brew services` on purpose: no login item is
registered. Stop it with
`pg_ctl -D /opt/homebrew/var/postgresql@16 stop`.

---

## Everyday commands

| Command | Effect |
|---|---|
| `npm test` | 190 tests across both test packages |
| `npm run test:rules` | 142 calculator tests, no database, ~350 ms |
| `npm run typecheck` | All four packages |
| `npm run db:migrate -w @khel/api` | Apply migrations (dev) |
| `npm run db:reset -w @khel/api` | Drop, recreate, re-apply |
| `npm run db:seed -w @khel/api -- --today` | Load the synthetic demo dataset |
| `npm run db:studio -w @khel/api` | Prisma Studio |

---

## Regenerating the schema

`prisma/schema.prisma` is generated from the specification catalogue. Do not hand-edit
the generated section.

```bash
cd services/api
python3 scripts/generate-schema.py ../../spec/specification_catalogue.json prisma/schema.prisma
npx prisma migrate dev --name your_change
```

Additions go in:
- `prisma/overlay.json` — extra fields, indexes, back-relations (each with a `why`)
- `prisma/overlay-models.prisma` — the four added models

---

## The `--today` seed flag

The synthetic dataset describes a **future** event: 1 December 2026, with assignments
effective from 1 November. That is correct data, but assignment scope resolves from
**live** intervals (§4), so before November nobody holds any scope and every screen is
legitimately empty.

`--today` shifts the whole dataset by a whole number of days so the event runs today.
Relative timing is preserved exactly — fixtures still start at 08:00 IST. The shift is
logged, and the underlying dataset is unchanged.

---

## Troubleshooting

**`postmaster became multithreaded during startup`** — a macOS Homebrew quirk. Set
`LC_ALL` before starting Postgres:
```bash
export LC_ALL="en_US.UTF-8"
```

**`Environment variable not found: DATABASE_URL`** — Prisma reads `services/api/.env`.
Copy `.env.example` there as well as at the repo root.

**Every screen is empty after seeding** — you seeded without `--today`. The demo event
is in the future, so no assignment interval is live. Reseed with the flag.

**A command returns `RULES_NOT_APPROVED`** — working as intended. Seeded rule versions
are `Draft` with empty settings; approving them is an organiser decision. See
[`DECISIONS.md`](DECISIONS.md).

**A command returns `CONSENT_REQUIRED`** — also intended. No athlete may be entered
without an active `EventParticipation` guardian consent (DPDP Act 2023 §9). See
[`INDIA_DATA_MODEL.md`](INDIA_DATA_MODEL.md) §7.

**Tests fail with unique-constraint errors on a second run** — the API suite truncates
`khel_sanand_test` per run. Check `TEST_DATABASE_URL` points at the *test* database,
not the development one.

---

## Production notes

Not deployment-ready as shipped. Before an event:

1. **Replace the demo sign-in.** `/api/v1/demo/users` is refused when
   `NODE_ENV=production`, but the `x-user-id` header in `apps/web/src/lib/api.ts` must
   be replaced with the identity provider's verified session (§3).
2. **Set a real `SESSION_SECRET`** and rotate the seeded database credentials.
3. **Configure private object storage** for documents; downloads must be short-lived
   signed URLs issued after a server-side authorisation check (§5, AT-012).
4. **Run the outbox worker** — messages are enqueued transactionally but nothing
   delivers them yet.
5. **Rehearse a restore** (§14): recover both database records and referenced files.
6. **Resolve the blocking decisions** in [`DECISIONS.md`](DECISIONS.md), particularly
   DEC-001 (event date and volumes) and DEC-002 (age groups and cutoff).
