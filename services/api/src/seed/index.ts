/**
 * Demo seed.
 *
 * Loads the specification's synthetic dataset from `spec/synthetic_data/` in
 * dependency order, resolving the readable business codes to UUIDs exactly as an
 * importer would. The spec's README is explicit about what this is and is not:
 *
 *   "Demo CSVs use readable business codes that an importer resolves to UUIDs …
 *    They are not a ready-to-run production database seed … complete typed draft
 *    rule profiles before any publication. The example fixtures remain Draft
 *    deliberately."
 *
 * So this seed loads Draft records and does NOT approve rule versions, publish
 * fixtures or mark entries eligible. Doing so would fabricate approvals the
 * organiser has not given — see docs/DECISIONS.md.
 *
 * Every name, date, school and result below is invented. No real child, school,
 * contact or fixture is represented.
 */
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PrismaClient } from '@prisma/client';
import { DISCIPLINE_CODE, DISCIPLINE_CALCULATOR, DISCIPLINE_LABEL,
         DISCIPLINE_PARTICIPANT_MODE, SGFI_STYLE_CATEGORY_TEMPLATES } from '@khel/contracts';

/**
 * `--today` rebases every demo date so the event is happening now.
 *
 * The synthetic dataset describes a future event (1 December 2026, assignments from
 * 1 November). That is correct data, but it makes the demo unexplorable: assignment
 * scope is resolved from LIVE intervals (§4), so before November nobody holds any
 * scope and every screen is legitimately empty. The flag shifts the whole dataset by
 * a constant offset, preserving the relative timeline, and says so in the log.
 */
const REBASE_TO_TODAY = process.argv.includes('--today');

const HERE = dirname(fileURLToPath(import.meta.url));
const SPEC_DIR = join(HERE, '..', '..', '..', '..', 'spec', 'synthetic_data');

const prisma = new PrismaClient();

/** Offset applied to every demo instant when --today is set. Computed once. */
let dateShiftMs = 0;

/** Apply the rebase offset. Identity when the flag is absent. */
function shift(d: Date): Date {
  return dateShiftMs === 0 ? d : new Date(d.getTime() + dateShiftMs);
}

/** Minimal CSV reader. The demo files are plain, quoted-comma CSV with a BOM. */
function readCsv(name: string): Record<string, string>[] {
  const path = join(SPEC_DIR, name);
  if (!existsSync(path)) {
    throw new Error(`Missing synthetic data file: ${path}`);
  }
  const text = readFileSync(path, 'utf8').replace(/^﻿/, '').trim();
  const lines = splitRows(text);
  const header = lines[0] ?? [];
  return lines.slice(1).map((cells) =>
    Object.fromEntries(header.map((h, i) => [h.trim(), (cells[i] ?? '').trim()])));
}

function splitRows(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i]!;
    if (quoted) {
      if (ch === '"') {
        if (text[i + 1] === '"') { cell += '"'; i += 1; } else quoted = false;
      } else cell += ch;
      continue;
    }
    if (ch === '"') { quoted = true; continue; }
    if (ch === ',') { row.push(cell); cell = ''; continue; }
    if (ch === '\n') { row.push(cell); rows.push(row); row = []; cell = ''; continue; }
    if (ch === '\r') continue;
    cell += ch;
  }
  if (cell !== '' || row.length) { row.push(cell); rows.push(row); }
  return rows;
}

async function main(): Promise<void> {
  console.log('Seeding synthetic demonstration data.');
  console.log('No real children, schools, contacts, event dates or results are represented.\n');

  if (REBASE_TO_TODAY) {
    const [row] = readCsv('events.csv');
    // `start_date` is a DATE column, so both ends of the shift must be UTC midnight.
    // Using local midnight here lands the event a day early for any timezone east of
    // UTC — including Asia/Kolkata, which is the whole point of this deployment.
    const originalStart = new Date(`${row!['start_date']!}T00:00:00Z`);
    const now = new Date();
    const todayUtc = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
    // Shift by whole days so every time-of-day in the dataset is preserved exactly.
    const wholeDays = Math.round((todayUtc - originalStart.getTime()) / 86_400_000);
    dateShiftMs = wholeDays * 86_400_000;
    console.log(`  --today: shifting every demo date by ${Math.round(dateShiftMs / 86_400_000)} ` +
                `day(s) so the event runs today. Relative timing is preserved.`);
    console.log('  The underlying dataset still describes a synthetic future event.\n');
  }

  // The seed writes as a named service identity, so audit rows attribute correctly.
  const service = await prisma.user.upsert({
    where: { user_code: 'SYSTEM-SEED' },
    update: {},
    create: {
      user_code: 'SYSTEM-SEED', display_name: 'Seed service',
      provider_subject: 'system:seed', active: true,
      created_by: '00000000-0000-4000-8000-000000000000',
      updated_by: '00000000-0000-4000-8000-000000000000',
    },
  }).catch(async () => {
    // First run: the self-referencing audit columns need a bootstrap row.
    const id = '00000000-0000-4000-8000-000000000000';
    await prisma.$executeRawUnsafe(
      `INSERT INTO users (id, created_by, updated_at, updated_by, user_code, display_name,
                          provider_subject, active)
       VALUES ('${id}','${id}',now(),'${id}','SYSTEM-SEED','Seed service','system:seed',true)
       ON CONFLICT (id) DO NOTHING`);
    return prisma.user.findUniqueOrThrow({ where: { id } });
  });
  const audit = { created_by: service.id, updated_by: service.id };

  /* --- 1. Bootstrap masters: sports and disciplines ------------------ */
  // The confirmed programme (§15). These are global, not event-scoped.
  const sportsByFamily: Record<string, string> = {};
  for (const [code, label] of Object.entries(DISCIPLINE_LABEL)) {
    const disciplineCode = code as (typeof DISCIPLINE_CODE)[number];
    const sportName =
      disciplineCode.startsWith('SP') ? 'Athletics'
      : ['SBT', 'KJT', 'SBJ'].includes(disciplineCode) ? 'Athletics'
      : label;
    // Resolved without relying on control-flow narrowing of a mutable binding:
    // the type of `sportsByFamily[...]` is `string | undefined` under
    // noUncheckedIndexedAccess, and narrowing it through a reassignment is exactly
    // the kind of inference that breaks when a dependency's types are unavailable.
    const existingSportId = sportsByFamily[sportName];
    const sportId: string = existingSportId ?? (await prisma.sport.upsert({
      where: { code: sportName.toUpperCase().slice(0, 12) },
      update: {},
      create: { ...audit, code: sportName.toUpperCase().slice(0, 12),
                name: sportName, active: true },
    })).id;
    sportsByFamily[sportName] = sportId;
    await prisma.discipline.upsert({
      where: { code: disciplineCode },
      update: {},
      create: {
        ...audit, sport_id: sportId, code: disciplineCode, name: label,
        calculation_family: DISCIPLINE_CALCULATOR[disciplineCode],
        participant_mode: DISCIPLINE_PARTICIPANT_MODE[disciplineCode],
        distance_m: disciplineCode === 'SP30' ? 30
                  : disciplineCode === 'SP50' ? 50
                  : disciplineCode === 'SP60' ? 60 : null,
      },
    });
  }
  console.log(`  disciplines: ${DISCIPLINE_CODE.length} (the confirmed programme)`);

  /* --- 2. Event ----------------------------------------------------- */
  const [eventRow] = readCsv('events.csv');
  if (!eventRow) throw new Error('events.csv is empty');
  const event = await prisma.event.upsert({
    where: { event_code: eventRow['event_code']! },
    update: {},
    create: {
      ...audit,
      event_code: eventRow['event_code']!,
      name: eventRow['name']!,
      timezone: eventRow['timezone'] || 'Asia/Kolkata',
      start_date: shift(new Date(eventRow['start_date']!)),
      end_date: shift(new Date(eventRow['end_date']!)),
      // Deliberately Setup, not Live: the demo rules are Draft and unapproved.
      status: 'Setup',
      configuration_version: 1,
      academic_year: '2026-27',
      default_locale: 'gu',
    },
  });
  const ev = { event_id: event.id, ...audit };
  console.log(`  event: ${event.event_code} (status ${event.status})`);

  /* --- 3. Clusters --------------------------------------------------- */
  const clusterIds = new Map<string, string>();
  for (const row of readCsv('clusters.csv')) {
    const c = await prisma.cluster.create({
      data: { ...ev, cluster_code: row['cluster_code']!, name: row['name']!, active: true },
    });
    clusterIds.set(row['cluster_code']!, c.id);
  }

  /* --- 4. Users and memberships -------------------------------------- */
  const membershipIds = new Map<string, string>();
  for (const row of readCsv('users.csv')) {
    const user = await prisma.user.create({
      data: {
        ...audit, user_code: row['user_code']!, display_name: row['display_name']!,
        // example.invalid is reserved by RFC 2606 and can never route.
        email: row['email'] || null,
        provider_subject: `demo:${row['user_code']}`,
        active: row['status'] === 'Active',
      },
    });
    const membership = await prisma.eventMembership.create({
      data: {
        ...ev, user_id: user.id, role: row['role'] as 'ED' | 'CH' | 'VOL',
        status: 'Active', permissions_version: 1,
      },
    });
    membershipIds.set(row['user_code']!, membership.id);

    if (row['role'] === 'VOL') {
      await prisma.volunteerProfile.create({
        data: { ...ev, membership_id: membership.id, language: 'gu', preferred_locale: 'gu' },
      });
    }
  }
  console.log(`  users: ${membershipIds.size}`);

  /* --- 5. Schools and event participation ----------------------------- */
  const eventSchoolIds = new Map<string, string>();
  for (const row of readCsv('schools.csv')) {
    const school = await prisma.school.create({
      data: {
        ...audit, school_code: row['school_code']!, name: row['name']!,
        address: row['address']!, district: row['district']!, city: row['city']!,
        contact_name: row['contact_name']!, email: row['email'] || null,
        active: row['status'] === 'Active',
        // India-specific fields the demo CSV does not carry; left null rather than
        // invented, because a fabricated UDISE code would be worse than a missing one.
        state_code: 'GJ', taluka: 'Sanand', pincode: null, udise_code: null,
      },
    });
    const eventSchool = await prisma.eventSchool.create({
      data: { ...ev, school_id: school.id, participation_status: 'Active' },
    });
    eventSchoolIds.set(row['school_code']!, eventSchool.id);
  }

  for (const row of readCsv('schoolch.csv')) {
    await prisma.schoolCHAssignment.create({
      data: {
        ...ev,
        event_school_id: eventSchoolIds.get(row['school_code']!)!,
        cluster_id: clusterIds.get(row['cluster_code']!)!,
        ch_membership_id: membershipIds.get(row['ch_code']!)!,
        effective_from: shift(new Date(row['effective_from']!)),
      },
    });
  }
  for (const row of readCsv('volunteerschools.csv')) {
    await prisma.volunteerSchoolAssignment.create({
      data: {
        ...ev,
        volunteer_membership_id: membershipIds.get(row['volunteer_code']!)!,
        event_school_id: eventSchoolIds.get(row['school_code']!)!,
        responsibility: row['responsibility'] || 'Support',
        effective_from: shift(new Date(row['effective_from']!)),
      },
    });
  }
  console.log(`  schools: ${eventSchoolIds.size}`);

  /* --- 6. Venue and resources ---------------------------------------- */
  const [venueRow] = readCsv('venues.csv');
  const venue = await prisma.venue.create({
    data: {
      ...ev, venue_code: venueRow!['venue_code']!, name: venueRow!['name']!,
      address: venueRow!['address']!, active: true,
    },
  });
  const resourceIds = new Map<string, string>();
  for (const row of readCsv('resources.csv')) {
    const disciplineCode = row['discipline_code']!;
    const r = await prisma.venueResource.create({
      data: {
        ...ev, venue_id: venue.id, resource_code: row['resource_code']!,
        resource_type: resourceTypeFor(disciplineCode),
        capacity: Number(row['capacity'] || 1),
        compatible_disciplines: [disciplineCode],
        active: row['status'] === 'Active',
      },
    });
    resourceIds.set(row['resource_code']!, r.id);
  }

  /* --- 7. Categories -------------------------------------------------- */
  const categoryIds = new Map<string, string>();
  for (const row of readCsv('categories.csv')) {
    const c = await prisma.category.create({
      data: {
        ...ev, category_code: row['category_code']!, label: row['name']!,
        dob_min: row['dob_min'] ? new Date(row['dob_min']) : null,
        dob_max: row['dob_max'] ? new Date(row['dob_max']) : null,
        criteria: { note: row['note'] ?? '' },
        // The demo category is explicitly Draft: age policy is DEC-002, still open.
        approval_status: 'Draft',
        participation_category: 'Open',
      },
    });
    categoryIds.set(row['category_code']!, c.id);
  }

  // India-specific templates, seeded as Draft for the organiser to adopt or replace.
  for (const t of SGFI_STYLE_CATEGORY_TEMPLATES) {
    await prisma.category.create({
      data: {
        ...ev, category_code: `TPL-${t.code}`, label: `${t.label} (template)`,
        criteria: { under_age_years: t.under_age_years, cutoff: `${t.cutoff_day}/${t.cutoff_month}`,
                    note: t.note, status: 'TEMPLATE — requires organiser approval (DEC-002)' },
        approval_status: 'Draft',
        under_age_years: t.under_age_years,
        participation_category: 'Open',
      },
    });
  }
  console.log(`  categories: ${categoryIds.size} demo + ${SGFI_STYLE_CATEGORY_TEMPLATES.length} draft templates`);

  /* --- 8. Competitions, rule versions, stages -------------------------- */
  const competitionIds = new Map<string, string>();
  const ruleVersionIds = new Map<string, string>();

  for (const row of readCsv('competitions.csv')) {
    const disciplineCode = row['discipline_code']!;
    const discipline = await prisma.discipline.findUniqueOrThrow({
      where: { code: disciplineCode },
    });

    // §6: a Draft rule version has no approval and cannot be published. The demo
    // deliberately leaves settings empty — they are DECISIONs, not defaults.
    const ruleVersion = await prisma.ruleVersion.create({
      data: {
        ...ev, discipline_id: discipline.id, version_no: 1,
        approval_status: 'Draft',
        settings: { status: 'DRAFT — required settings not supplied',
                    note: row['approval_status'] ?? 'Draft' },
        source_reference: 'Synthetic demonstration profile; not an approved rulebook',
        checksum: `draft-${disciplineCode}`,
      },
    });
    ruleVersionIds.set(row['competition_code']!, ruleVersion.id);

    const competition = await prisma.competition.create({
      data: {
        ...ev, competition_code: row['competition_code']!,
        discipline_id: discipline.id,
        category_id: categoryIds.get(row['category_code']!)!,
        format: normaliseFormat(row['format']!),
        rule_version_id: ruleVersion.id,
        status: 'Draft',
      },
    });
    competitionIds.set(row['competition_code']!, competition.id);

    await prisma.scoreTemplate.create({
      data: {
        ...ev, rule_version_id: ruleVersion.id, template_version: 1,
        fields_schema: { discipline: disciplineCode,
                         calculator: DISCIPLINE_CALCULATOR[disciplineCode as never] },
        calculator_version: `${disciplineCode.toLowerCase()}@1`,
        preview_cases: [],
      },
    });
  }

  const stageIds = new Map<string, string>();
  for (const row of readCsv('stages.csv')) {
    const s = await prisma.competitionStage.create({
      data: {
        ...ev, competition_id: competitionIds.get(row['competition_code']!)!,
        stage_code: row['stage_code']!,
        stage_type: normaliseStageType(row['stage_type']!),
        sequence: Number(row['sequence'] || 1),
        progression_rule: {},
        status: 'Draft',
      },
    });
    stageIds.set(row['stage_code']!, s.id);
  }
  console.log(`  competitions: ${competitionIds.size} (all Draft, rules unapproved)`);

  /* --- 9. Athletes, registrations, entries ----------------------------- */
  const registrationIds = new Map<string, string>();
  for (const row of readCsv('athletes.csv')) {
    const athlete = await prisma.athlete.create({
      data: {
        ...audit, athlete_code: row['event_athlete_code']!,
        display_name: row['display_name']!,
        date_of_birth: row['date_of_birth'] ? new Date(row['date_of_birth']) : null,
        active: true,
      },
    });
    const registration = await prisma.athleteRegistration.create({
      data: {
        ...ev, athlete_id: athlete.id,
        event_school_id: eventSchoolIds.get(row['school_code']!)!,
        event_athlete_code: row['event_athlete_code']!,
        // Draft: no entry is eligible until rules are approved and consent recorded.
        status: 'Draft',
        notes: 'Synthetic demonstration record',
      },
    });
    registrationIds.set(row['event_athlete_code']!, registration.id);
  }

  const entryIds = new Map<string, string>();
  for (const row of readCsv('entries.csv')) {
    const competitionCode = row['competition_code']!;
    const entry = await prisma.competitionEntry.create({
      data: {
        ...ev,
        registration_id: registrationIds.get(row['event_athlete_code']!)!,
        competition_id: competitionIds.get(competitionCode)!,
        // §5: "Missing proof is pending, not automatically eligible."
        eligibility_status: 'Pending',
        eligibility_rule_id: ruleVersionIds.get(competitionCode)!,
        entry_status: 'Draft',
      },
    });
    entryIds.set(`${row['event_athlete_code']}#${competitionCode}`, entry.id);
  }
  console.log(`  athletes: ${registrationIds.size}, entries: ${entryIds.size} (all Pending eligibility)`);

  /* --- 10. Teams and rosters ------------------------------------------ */
  const teamIds = new Map<string, string>();
  for (const row of readCsv('teams.csv')) {
    const t = await prisma.team.create({
      data: {
        ...ev, team_code: row['team_code']!,
        event_school_id: eventSchoolIds.get(row['school_code']!)!,
        competition_id: competitionIds.get(row['competition_code']!)!,
        name: row['name']!,
        roster_status: 'Draft',   // §5: lock a roster only before first participation
      },
    });
    teamIds.set(row['team_code']!, t.id);
  }
  let rosterRows = 0;
  for (const row of readCsv('rosters.csv')) {
    const entryId = entryIds.get(`${row['event_athlete_code']}#${row['competition_code']}`);
    if (!entryId) continue;
    await prisma.teamMember.create({
      data: {
        ...ev, team_id: teamIds.get(row['team_code']!)!, entry_id: entryId,
        jersey_number: row['jersey_number'] || null, active: true,
      },
    });
    rosterRows += 1;
  }
  console.log(`  teams: ${teamIds.size}, roster members: ${rosterRows}`);

  /* --- 11. Fixtures and participants ----------------------------------- */
  const fixtureIds = new Map<string, string>();
  for (const row of readCsv('fixtures.csv')) {
    const competitionCode = row['competition_code']!;
    const f = await prisma.fixture.create({
      data: {
        ...ev, fixture_code: row['fixture_code']!,
        competition_id: competitionIds.get(competitionCode)!,
        stage_id: stageIds.get(row['stage_code']!)!,
        resource_id: resourceIds.get(row['resource_code']!)!,
        scheduled_start: shift(new Date(row['scheduled_start']!)),
        scheduled_end: shift(new Date(row['scheduled_end']!)),
        reporting_at: shift(new Date(new Date(row['scheduled_start']!).getTime() - 30 * 60_000)),
        // "The example fixtures remain Draft deliberately" — spec README.
        lifecycle: 'Draft',
        publication: 'Unpublished',
        owner_ch_id: membershipIds.get(row['reviewer_code']!)!,
        rule_version_id: ruleVersionIds.get(competitionCode)!,
      },
    });
    fixtureIds.set(row['fixture_code']!, f.id);
  }

  let participantRows = 0;
  for (const row of readCsv('participants.csv')) {
    const fixtureId = fixtureIds.get(row['fixture_code']!);
    if (!fixtureId) continue;
    const teamCode = row['team_code'];
    const athleteCode = row['event_athlete_code'];

    // §14: exactly one of entry or team — the database enforces it too.
    let entryId: string | null = null;
    let teamId: string | null = null;
    if (teamCode) teamId = teamIds.get(teamCode) ?? null;
    else if (athleteCode) {
      const fixtureRow = readCsv('fixtures.csv').find((f) => f['fixture_code'] === row['fixture_code']);
      entryId = entryIds.get(`${athleteCode}#${fixtureRow?.['competition_code']}`) ?? null;
    }
    if (!entryId && !teamId) continue;

    await prisma.fixtureParticipant.create({
      data: {
        ...ev, fixture_id: fixtureId, entry_id: entryId, team_id: teamId,
        slot: row['slot'] || 'A',
        participation_snapshot: { source: 'synthetic demonstration data' },
        status: 'Expected',
      },
    });
    participantRows += 1;
  }
  console.log(`  fixtures: ${fixtureIds.size} (Draft/Unpublished), participants: ${participantRows}`);

  console.log('\nSeed complete.');
  console.log('Everything is Draft by design: rule versions are unapproved, entries are');
  console.log('Pending and fixtures are Unpublished. Approving them is an organiser');
  console.log('decision (docs/DECISIONS.md), not something the seed may fabricate.');
}

function resourceTypeFor(disciplineCode: string) {
  if (disciplineCode.startsWith('SP')) return 'Track' as const;
  if (['SBT', 'KJT'].includes(disciplineCode)) return 'ThrowArea' as const;
  if (disciplineCode === 'SBJ') return 'JumpArea' as const;
  if (disciplineCode === 'CYC') return 'CyclingCourse' as const;
  if (disciplineCode === 'CHE') return 'ChessArea' as const;
  if (disciplineCode === 'TOW') return 'TugArea' as const;
  return 'Court' as const;
}

function normaliseFormat(v: string) {
  const map: Record<string, 'Knockout' | 'RoundRobin' | 'GroupsKnockout' | 'HeatsFinal' | 'DirectFinal' | 'Swiss'> = {
    Knockout: 'Knockout', RoundRobin: 'RoundRobin', GroupsKnockout: 'GroupsKnockout',
    HeatsFinal: 'HeatsFinal', DirectFinal: 'DirectFinal', Swiss: 'Swiss',
  };
  return map[v] ?? 'DirectFinal';
}

function normaliseStageType(v: string) {
  const map: Record<string, 'Group' | 'Heat' | 'Final' | 'KnockoutRound' | 'ChessRound'> = {
    Group: 'Group', Heat: 'Heat', Final: 'Final',
    KnockoutRound: 'KnockoutRound', ChessRound: 'ChessRound',
  };
  return map[v] ?? 'Final';
}

main()
  .catch((err) => { console.error('Seed failed:', err); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
