/**
 * Database-level integrity tests.
 *
 * These run against a real PostgreSQL instance and prove that the invariants the
 * specification states in prose actually hold at the storage layer — so they also
 * hold for imports, background jobs, repair scripts and any future client, not only
 * the code paths that remember to check.
 *
 * Run: npm run db:up && npm run db:deploy && npm test -w @khel/api
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { truncateAll } from '../test/truncate.js';

const prisma = new PrismaClient();

/** Deterministic uuids so a failed run leaves recognisable rows behind. */
const ID = {
  user: '00000000-0000-4000-8000-000000000001',
  ch: '00000000-0000-4000-8000-000000000002',
  vol: '00000000-0000-4000-8000-000000000003',
  event: '00000000-0000-4000-8000-000000000010',
  school: '00000000-0000-4000-8000-000000000020',
  eventSchool: '00000000-0000-4000-8000-000000000021',
  cluster: '00000000-0000-4000-8000-000000000030',
  chMembership: '00000000-0000-4000-8000-000000000040',
  volMembership: '00000000-0000-4000-8000-000000000041',
  athlete: '00000000-0000-4000-8000-000000000050',
};

/**
 * Raw execute. Values are inlined rather than parameterised because Prisma sends
 * bind parameters as text, which Postgres will not implicitly cast to uuid or to a
 * named enum type. Every value here is a constant defined in this file, so there is
 * no untrusted input to inject.
 */
const q = (sql: string) => prisma.$executeRawUnsafe(sql);

/** Quote a value for inlining, or emit NULL. */
const v = (x: string | null) => (x === null ? 'NULL' : `'${x.replace(/'/g, "''")}'`);

beforeAll(async () => {
  await truncateAll(prisma);

  // A minimal but genuine object graph: the constraints under test are FK-bearing.
  await q(`INSERT INTO users (id, created_by, updated_at, updated_by, user_code, display_name, provider_subject, active)
           VALUES (${v(ID.user)},${v(ID.user)},now(),${v(ID.user)},'ROOT','Test Root','root-subject',true)
           ON CONFLICT (id) DO NOTHING`);
  await q(`INSERT INTO events (id, created_by, updated_at, updated_by, event_code, name, timezone,
                               start_date, end_date, status, configuration_version)
           VALUES (${v(ID.event)},${v(ID.user)},now(),${v(ID.user)},'TEST-EVT','Constraint Test Event','Asia/Kolkata',
                   '2026-12-01','2026-12-01','Setup',1)
           ON CONFLICT (id) DO NOTHING`);
  await q(`INSERT INTO schools (id, created_by, updated_at, updated_by, school_code, name, address,
                                district, city, contact_name, active)
           VALUES (${v(ID.school)},${v(ID.user)},now(),${v(ID.user)},'TEST-S1','Test School','Addr','Ahmedabad','Sanand','Contact',true)
           ON CONFLICT (id) DO NOTHING`);
  await q(`INSERT INTO event_schools (id, event_id, created_by, updated_at, updated_by, school_id, participation_status)
           VALUES (${v(ID.eventSchool)},${v(ID.event)},${v(ID.user)},now(),${v(ID.user)},${v(ID.school)},'Active') ON CONFLICT (id) DO NOTHING`);
  await q(`INSERT INTO clusters (id, event_id, created_by, updated_at, updated_by, cluster_code, name, active)
           VALUES (${v(ID.cluster)},${v(ID.event)},${v(ID.user)},now(),${v(ID.user)},'TEST-C1','Test Cluster',true) ON CONFLICT (id) DO NOTHING`);
  for (const [uid, code, mid, role] of [
    [ID.ch, 'TEST-CH', ID.chMembership, 'CH'],
    [ID.vol, 'TEST-VOL', ID.volMembership, 'VOL'],
  ] as const) {
    await q(`INSERT INTO users (id, created_by, updated_at, updated_by, user_code, display_name, provider_subject, active)
             VALUES (${v(uid)},${v(ID.user)},now(),${v(ID.user)},${v(code)},${v(code)},${v(code)},true) ON CONFLICT (id) DO NOTHING`);
    await q(`INSERT INTO event_memberships (id, event_id, created_by, updated_at, updated_by, user_id, role, status, permissions_version)
             VALUES (${v(mid)},${v(ID.event)},${v(ID.user)},now(),${v(ID.user)},${v(uid)},${v(role)}::"Role",'Active',1) ON CONFLICT (id) DO NOTHING`);
  }
  await q(`INSERT INTO athletes (id, created_by, updated_at, updated_by, athlete_code, display_name, active)
           VALUES (${v(ID.athlete)},${v(ID.user)},now(),${v(ID.user)},'TEST-A1','Test Athlete',true) ON CONFLICT (id) DO NOTHING`);
});

afterAll(async () => { await prisma.$disconnect(); });

/* ------------------------------------------------------------------ */

describe('AT-007 — exactly one active pool per volunteer', () => {
  it('rejects a second open-ended pool assignment', async () => {
    const insert = (id: string) => q(`INSERT INTO volunteer_pool_assignments
         (id, event_id, created_by, updated_at, updated_by, volunteer_membership_id, cluster_id,
          ch_membership_id, effective_from, effective_to)
       VALUES (${v(id)},${v(ID.event)},${v(ID.user)},now(),${v(ID.user)},${v(ID.volMembership)},${v(ID.cluster)},${v(ID.chMembership)},now(),NULL)`);

    await insert('00000000-0000-4000-8000-0000000000a1');
    // "Two simultaneous pool-transfer requests cannot create two active default pools."
    await expect(insert('00000000-0000-4000-8000-0000000000a2'))
      .rejects.toThrow(/volunteer_one_active_pool_uq|Key \(volunteer_membership_id\)/);

    // Closing the first interval frees the slot — a transfer is legal, a duplicate is not.
    await q(`UPDATE volunteer_pool_assignments SET effective_to = now() + interval '1 hour'
             WHERE id = '00000000-0000-4000-8000-0000000000a1'`);
    await expect(insert('00000000-0000-4000-8000-0000000000a3')).resolves.toBeDefined();
  });
});

describe('§4 — one active responsible CH per school', () => {
  it('rejects a second open-ended school assignment', async () => {
    const insert = (id: string) => q(
      `INSERT INTO school_c_h_assignments
         (id, event_id, created_by, updated_at, updated_by, event_school_id, cluster_id,
          ch_membership_id, effective_from, effective_to)
       VALUES (${v(id)},${v(ID.event)},${v(ID.user)},now(),${v(ID.user)},${v(ID.eventSchool)},${v(ID.cluster)},${v(ID.chMembership)},now(),NULL)`);

    await insert('00000000-0000-4000-8000-0000000000b1');
    await expect(insert('00000000-0000-4000-8000-0000000000b2'))
      .rejects.toThrow(/school_one_active_ch_uq|Key \(event_school_id\)/);
  });
});

describe('GT-005 / §15 — a non-Completed status can never hold a rank', () => {
  it('rejects a DNS row carrying rank 1', async () => {
    await expect(q(`INSERT INTO result_snapshots (id, event_id, created_by, revision_id, participant_id,
                                     status, rank, identity_snapshot)
       VALUES (${v('00000000-0000-4000-8000-0000000000c1')},${v(ID.event)},${v(ID.user)},${v('00000000-0000-4000-8000-0000000000cc')},${v('00000000-0000-4000-8000-0000000000cd')},'DNS',1,'{}'::jsonb)`)).rejects.toThrow(/result_rank_requires_completed_ck/);
  });

  it('rejects rank zero', async () => {
    await expect(q(`INSERT INTO result_snapshots (id, event_id, created_by, revision_id, participant_id,
                                     status, rank, identity_snapshot)
       VALUES (${v('00000000-0000-4000-8000-0000000000c2')},${v(ID.event)},${v(ID.user)},${v('00000000-0000-4000-8000-0000000000cc')},${v('00000000-0000-4000-8000-0000000000cd')},'Completed',0,'{}'::jsonb)`)).rejects.toThrow(/result_rank_positive_ck/);
  });

  it('rejects a measurement with no unit (§14)', async () => {
    await expect(q(`INSERT INTO result_snapshots (id, event_id, created_by, revision_id, participant_id,
                                     status, primary_value, unit, identity_snapshot)
       VALUES (${v('00000000-0000-4000-8000-0000000000c3')},${v(ID.event)},${v(ID.user)},${v('00000000-0000-4000-8000-0000000000cc')},${v('00000000-0000-4000-8000-0000000000cd')},'Completed',13.1,NULL,'{}'::jsonb)`)).rejects.toThrow(/result_value_has_unit_ck/);
  });
});

describe('§14 — a participant is exactly one of an entry or a team', () => {
  const base = (id: string, entry: string | null, team: string | null) => q(`INSERT INTO fixture_participants (id, event_id, created_by, updated_at, updated_by,
                                       fixture_id, entry_id, team_id, slot, participation_snapshot, status)
     VALUES (${v(id)},${v(ID.event)},${v(ID.user)},now(),${v(ID.user)},${v('00000000-0000-4000-8000-0000000000dd')},${v(entry)},${v(team)},'A','{}'::jsonb,'Expected')`);

  it('rejects neither', async () => {
    await expect(base('00000000-0000-4000-8000-0000000000d1', null, null))
      .rejects.toThrow(/fixture_participant_exactly_one_ck/);
  });

  it('rejects both', async () => {
    await expect(base('00000000-0000-4000-8000-0000000000d2',
      '00000000-0000-4000-8000-0000000000de', '00000000-0000-4000-8000-0000000000df'))
      .rejects.toThrow(/fixture_participant_exactly_one_ck/);
  });
});

describe('§13 — audit history is append-only', () => {
  const auditId = '00000000-0000-4000-8000-0000000000e1';

  it('accepts an insert', async () => {
    await expect(q(`INSERT INTO audit_events (id, event_id, created_by, actor_id, effective_role, action,
                                 entity_type, entity_id, safe_diff, request_id)
       VALUES (${v(auditId)},${v(ID.event)},${v(ID.user)},${v(ID.user)},'ED','assignSchoolsToCH','EventSchool',${v(ID.eventSchool)},'{}'::jsonb,'req-1')`)).resolves.toBeDefined();
  });

  it('rejects an update', async () => {
    await expect(q(`UPDATE audit_events SET action = 'tampered' WHERE id = ${v(auditId)}`))
      .rejects.toThrow(/append-only/);
  });

  it('rejects a delete', async () => {
    await expect(q(`DELETE FROM audit_events WHERE id = ${v(auditId)}`))
      .rejects.toThrow(/append-only/);
  });
});

describe('India-specific format guards', () => {
  it('rejects a UDISE code that is not 11 digits', async () => {
    await expect(q(`UPDATE schools SET udise_code = '12345' WHERE id = ${v(ID.school)}`))
      .rejects.toThrow(/school_udise_format_ck/);
    await expect(q(`UPDATE schools SET udise_code = '24070100101' WHERE id = ${v(ID.school)}`))
      .resolves.toBeDefined();
  });

  it('rejects a PIN code outside the valid range', async () => {
    await expect(q(`UPDATE schools SET pincode = '912345' WHERE id = ${v(ID.school)}`))
      .rejects.toThrow(/school_pincode_format_ck/);   // 9 is Army Post Office
    await expect(q(`UPDATE schools SET pincode = '382110' WHERE id = ${v(ID.school)}`))
      .resolves.toBeDefined();                        // Sanand, Gujarat
  });

  it('stores at most four sighted digits, never a full identity number', async () => {
    const doc = (id: string, lastFour: string | null) => q(`INSERT INTO documents (id, event_id, created_by, updated_at, updated_by, owner_type, owner_id,
                              document_type, object_key, mime_type, size_bytes, checksum,
                              verification_status, sighted_last_four)
       VALUES (${v(id)},${v(ID.event)},${v(ID.user)},now(),${v(ID.user)},'Athlete',${v(ID.athlete)},'AadhaarSighted','k','image/jpeg',1,'c','Pending',${v(lastFour)})`);

    // A full 12-digit Aadhaar number cannot even be written into this column.
    await expect(doc('00000000-0000-4000-8000-0000000000f1', '123456789012'))
      .rejects.toThrow(/document_sighted_last_four_ck/);
    await expect(doc('00000000-0000-4000-8000-0000000000f2', '9012')).resolves.toBeDefined();
  });

  it('rejects a mobile number that is not a normalised Indian mobile', async () => {
    const g = (id: string, mobile: string) => q(`INSERT INTO guardians (id, event_id, created_by, updated_at, updated_by, athlete_id,
                              relation, full_name, mobile_e164)
       VALUES (${v(id)},${v(ID.event)},${v(ID.user)},now(),${v(ID.user)},${v(ID.athlete)},'Mother','Test Guardian',${v(mobile)})`);

    await expect(g('00000000-0000-4000-8000-0000000000f3', '9876543210'))
      .rejects.toThrow(/guardian_mobile_format_ck/);   // not E.164
    await expect(g('00000000-0000-4000-8000-0000000000f4', '+91512345678'))
      .rejects.toThrow(/guardian_mobile_format_ck/);   // Indian mobiles start 6-9
    await expect(g('00000000-0000-4000-8000-0000000000f5', '+919876543210'))
      .resolves.toBeDefined();
  });
});

describe('DPDP §9 consent invariants', () => {
  // This block creates its own guardian rather than relying on one made by an
  // earlier test. A test that only passes in file order is a test that will fail
  // the first time someone runs it with -t.
  const guardianId = '00000000-0000-4000-8000-000000000100';

  beforeAll(async () => {
    await q(`INSERT INTO guardians (id, event_id, created_by, updated_at, updated_by, athlete_id,
                                    relation, full_name, mobile_e164, is_primary)
             VALUES (${v(guardianId)},${v(ID.event)},${v(ID.user)},now(),${v(ID.user)},
                     ${v(ID.athlete)},'Father','Consent Test Guardian','+919812345670',false)
             ON CONFLICT (id) DO NOTHING`);
    // Start from a clean slate so the partial unique index is what decides the outcome.
    await q(`DELETE FROM consent_records WHERE athlete_id = ${v(ID.athlete)}`);
  });

  const consent = (id: string, status: string, withdrawnAt: string | null) => q(`INSERT INTO consent_records (id, event_id, created_by, updated_at, updated_by, athlete_id,
                                  guardian_id, purpose, status, method, notice_version, notice_locale,
                                  granted_at, withdrawn_at, recorded_by_membership_id)
     VALUES (${v(id)},${v(ID.event)},${v(ID.user)},now(),${v(ID.user)},${v(ID.athlete)},${v(guardianId)},'EventParticipation',${v(status)}::"ConsentStatus",'SignedPaperForm',
             'v1','gu',now(),${v(withdrawnAt)}::timestamptz,${v(ID.chMembership)})`);

  it('allows one live consent per athlete per purpose', async () => {
    await expect(consent('00000000-0000-4000-8000-000000000101', 'Granted', null))
      .resolves.toBeDefined();
    await expect(consent('00000000-0000-4000-8000-000000000102', 'Granted', null))
      .rejects.toThrow(/Key \(athlete_id, purpose\)/);
  });

  it('requires a withdrawal timestamp on a withdrawn consent', async () => {
    await expect(consent('00000000-0000-4000-8000-000000000103', 'Withdrawn', null))
      .rejects.toThrow(/consent_withdrawal_consistent_ck/);
  });

  it('forbids a withdrawal timestamp on a live consent', async () => {
    await expect(consent('00000000-0000-4000-8000-000000000104', 'Granted', new Date().toISOString()))
      .rejects.toThrow(/consent_withdrawal_consistent_ck/);
  });
});

describe('§7 — interval sanity', () => {
  it('rejects an event whose end precedes its start', async () => {
    await expect(q(`UPDATE events SET end_date = start_date - 1 WHERE id = ${v(ID.event)}`))
      .rejects.toThrow(/events_date_range_ck/);
  });

  it('rejects an assignment interval that ends before it begins', async () => {
    await expect(q(`INSERT INTO school_c_h_assignments (id, event_id, created_by, updated_at, updated_by,
              event_school_id, cluster_id, ch_membership_id, effective_from, effective_to)
       VALUES (${v('00000000-0000-4000-8000-000000000201')},${v(ID.event)},${v(ID.user)},now(),${v(ID.user)},${v(ID.eventSchool)},${v(ID.cluster)},${v(ID.chMembership)}, now(), now() - interval '1 day')`)).rejects.toThrow(/school_ch_interval_ck/);
  });

  it('rejects a checkout before its check-in (§8)', async () => {
    await expect(q(`INSERT INTO attendances (id, event_id, created_by, updated_at, updated_by, expected_duty_id,
                                check_in_at, check_out_at, received_at, status, source)
       VALUES (${v('00000000-0000-4000-8000-000000000202')},${v(ID.event)},${v(ID.user)},now(),${v(ID.user)},${v('00000000-0000-4000-8000-0000000002ee')}, now(), now() - interval '1 hour', now(), 'Present','Self')`)).rejects.toThrow(/attendance_checkout_ck/);
  });
});
