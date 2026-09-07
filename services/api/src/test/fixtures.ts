/**
 * Test fixture builder.
 *
 * Creates a small but genuine event: two clusters, four schools, an ED, two CHs,
 * two volunteers, one competition with an approved rule version, and one fixture.
 * Real rows, real foreign keys — the acceptance tests are checking behaviour that
 * only appears when the constraints are live.
 */
import { randomUUID } from 'node:crypto';
import type { PrismaClient } from '@prisma/client';
import type { ActorContext } from '@khel/contracts';
import { resolveActor } from '../core/actor.js';

export interface Fixtures {
  event_id: string;
  ed_user_id: string;
  ch1_user_id: string;
  ch2_user_id: string;
  vol1_user_id: string;
  vol2_user_id: string;
  ch1_membership_id: string;
  ch2_membership_id: string;
  vol1_membership_id: string;
  vol2_membership_id: string;
  cluster_a_id: string;
  cluster_b_id: string;
  school_ids: string[];        // EventSchool ids
  competition_id: string;
  rule_version_id: string;
  template_id: string;
  stage_id: string;
  resource_id: string;
  fixture_id: string;
  athlete_id: string;
  registration_id: string;
  entry_id: string;
  /** FixtureParticipant id — what a ResultSnapshot actually points at. */
  participant_id: string;
  kit_item_id: string;
  stock_location_id: string;
}

/**
 * Times are relative to NOW, not fixed calendar dates.
 *
 * Assignment and duty scope is resolved from live intervals (§4), so a fixture set
 * pinned to a future date would produce an actor with no duties and tests that fail
 * for the wrong reason. `TODAY` is the event's local date; duty windows straddle
 * the current instant so the scope the tests exercise is genuinely active.
 */
export const NOW = new Date();
export const TODAY = new Date(NOW.getFullYear(), NOW.getMonth(), NOW.getDate());
export const HOURS = (n: number) => new Date(NOW.getTime() + n * 3_600_000);

export async function buildFixtures(prisma: PrismaClient): Promise<Fixtures> {
  const root = randomUUID();
  const audit = { created_by: root, updated_by: root };

  await prisma.user.create({
    data: { id: root, ...audit, user_code: `ROOT-${root.slice(0, 8)}`,
            display_name: 'Seed Root', provider_subject: `root-${root}`, active: true },
  });

  const event = await prisma.event.create({
    data: {
      ...audit, event_code: `EVT-${root.slice(0, 8)}`, name: 'Test BalOlympiad',
      timezone: 'Asia/Kolkata',
      start_date: TODAY, end_date: TODAY,
      status: 'Live', configuration_version: 1, academic_year: '2026-27',
    },
  });

  const mkUser = async (code: string, role: 'ED' | 'CH' | 'VOL') => {
    const user = await prisma.user.create({
      data: { ...audit, user_code: `${code}-${root.slice(0, 6)}`, display_name: code,
              provider_subject: `${code}-${root}`, active: true },
    });
    const membership = await prisma.eventMembership.create({
      data: { event_id: event.id, ...audit, user_id: user.id, role,
              status: 'Active', permissions_version: 1 },
    });
    return { user_id: user.id, membership_id: membership.id };
  };

  const ed = await mkUser('ED', 'ED');
  const ch1 = await mkUser('CH1', 'CH');
  const ch2 = await mkUser('CH2', 'CH');
  const vol1 = await mkUser('VOL1', 'VOL');
  const vol2 = await mkUser('VOL2', 'VOL');

  const clusterA = await prisma.cluster.create({
    data: { event_id: event.id, ...audit, cluster_code: 'CA', name: 'Cluster A', active: true },
  });
  const clusterB = await prisma.cluster.create({
    data: { event_id: event.id, ...audit, cluster_code: 'CB', name: 'Cluster B', active: true },
  });

  const schoolIds: string[] = [];
  for (let i = 1; i <= 4; i += 1) {
    const school = await prisma.school.create({
      data: {
        ...audit, school_code: `S${i}-${root.slice(0, 6)}`, name: `Demo School ${i}`,
        address: 'Synthetic address', district: 'Ahmedabad', city: 'Sanand',
        contact_name: `Contact ${i}`, active: true,
        state_code: 'GJ', taluka: 'Sanand', pincode: '382110',
        board: 'GSEB', management_type: 'GovernmentAided', medium_of_instruction: 'Gujarati',
      },
    });
    const eventSchool = await prisma.eventSchool.create({
      data: { event_id: event.id, ...audit, school_id: school.id, participation_status: 'Active' },
    });
    schoolIds.push(eventSchool.id);
  }

  // --- Competition structure ---
  const sport = await prisma.sport.create({
    data: { ...audit, code: `ATH-${root.slice(0, 6)}`, name: 'Athletics', active: true },
  });
  const discipline = await prisma.discipline.create({
    data: { ...audit, sport_id: sport.id, code: `SP30-${root.slice(0, 6)}`, name: 'Sprint 30 m',
            calculation_family: 'Time', participant_mode: 'Individual' },
  });
  const category = await prisma.category.create({
    data: { event_id: event.id, ...audit, category_code: 'U11', label: 'Under 11',
            criteria: {}, approval_status: 'Approved',
            participation_category: 'Mixed', under_age_years: 11 },
  });
  const ruleVersion = await prisma.ruleVersion.create({
    data: {
      event_id: event.id, ...audit, discipline_id: discipline.id, version_no: 1,
      approval_status: 'Approved',
      settings: { lane_count: 6, timing_method: 'Manual', capture_resolution: 10000,
                  display_precision: 2, place_qualifiers: 2, time_qualifiers: 2,
                  final_capacity: 8, tie_procedure: [] },
      source_reference: 'Synthetic test profile', checksum: 'test-checksum',
    },
  });
  const competition = await prisma.competition.create({
    data: { event_id: event.id, ...audit, competition_code: 'C-SP30',
            discipline_id: discipline.id, category_id: category.id,
            format: 'DirectFinal', rule_version_id: ruleVersion.id, status: 'Published' },
  });
  const template = await prisma.scoreTemplate.create({
    data: { event_id: event.id, ...audit, rule_version_id: ruleVersion.id,
            template_version: 1, fields_schema: {}, calculator_version: 'sprint@1',
            preview_cases: [] },
  });
  const stage = await prisma.competitionStage.create({
    data: { event_id: event.id, ...audit, competition_id: competition.id,
            stage_code: 'FINAL', stage_type: 'Final', sequence: 1,
            progression_rule: {}, status: 'Published' },
  });

  const venue = await prisma.venue.create({
    data: { event_id: event.id, ...audit, venue_code: 'V1', name: 'Demo Venue',
            address: 'Synthetic', active: true },
  });
  const resource = await prisma.venueResource.create({
    data: { event_id: event.id, ...audit, venue_id: venue.id, resource_code: 'TRACK-1',
            resource_type: 'Track', capacity: 6, compatible_disciplines: [discipline.code],
            active: true },
  });

  const fixture = await prisma.fixture.create({
    data: {
      event_id: event.id, ...audit, fixture_code: 'F001',
      competition_id: competition.id, stage_id: stage.id, resource_id: resource.id,
      scheduled_start: HOURS(1),
      scheduled_end: HOURS(2),
      reporting_at: HOURS(0.5),
      lifecycle: 'Ready', publication: 'Published',
      owner_ch_id: ch1.membership_id, rule_version_id: ruleVersion.id,
    },
  });

  // --- An athlete, entered and placed in the fixture ---
  // A ResultSnapshot references a FixtureParticipant, so the full chain has to exist
  // for the locking tests to be meaningful: athlete → registration → entry → participant.
  const athlete = await prisma.athlete.create({
    data: {
      ...audit, athlete_code: `A1-${root.slice(0, 6)}`, display_name: 'Demo Athlete 1',
      display_name_local: 'ડેમો ખેલાડી ૧',
      date_of_birth: new Date('2016-06-15'), active: true,
    },
  });
  const registration = await prisma.athleteRegistration.create({
    data: {
      event_id: event.id, ...audit, athlete_id: athlete.id,
      event_school_id: schoolIds[0]!, event_athlete_code: `R1-${root.slice(0, 6)}`,
      status: 'Active', standard: 'Std5', section: 'A',
    },
  });
  const entry = await prisma.competitionEntry.create({
    data: {
      event_id: event.id, ...audit, registration_id: registration.id,
      competition_id: competition.id, eligibility_status: 'Eligible',
      eligibility_rule_id: ruleVersion.id, entry_status: 'Active', bib: '101',
    },
  });
  const participant = await prisma.fixtureParticipant.create({
    data: {
      event_id: event.id, ...audit, fixture_id: fixture.id,
      entry_id: entry.id, slot: 'L1',
      // §7: the snapshot freezes display identity before play, so a later rename
      // cannot rewrite a published result.
      participation_snapshot: {
        display_name: 'Demo Athlete 1', school: 'Demo School 1', bib: '101',
      },
      status: 'Confirmed',
    },
  });

  // --- Kits ---
  const kitItem = await prisma.kitItem.create({
    data: { event_id: event.id, ...audit, item_code: 'TSHIRT', name: 'Volunteer T-shirt',
            unit: 'each', variants: ['S', 'M', 'L'], active: true },
  });
  const stockLocation = await prisma.stockLocation.create({
    data: { event_id: event.id, ...audit, code: 'MAIN', name: 'Main store' },
  });

  return {
    event_id: event.id,
    ed_user_id: ed.user_id, ch1_user_id: ch1.user_id, ch2_user_id: ch2.user_id,
    vol1_user_id: vol1.user_id, vol2_user_id: vol2.user_id,
    ch1_membership_id: ch1.membership_id, ch2_membership_id: ch2.membership_id,
    vol1_membership_id: vol1.membership_id, vol2_membership_id: vol2.membership_id,
    cluster_a_id: clusterA.id, cluster_b_id: clusterB.id,
    school_ids: schoolIds,
    competition_id: competition.id, rule_version_id: ruleVersion.id,
    template_id: template.id, stage_id: stage.id, resource_id: resource.id,
    fixture_id: fixture.id,
    athlete_id: athlete.id, registration_id: registration.id,
    entry_id: entry.id, participant_id: participant.id,
    kit_item_id: kitItem.id, stock_location_id: stockLocation.id,
  };
}

/** Resolve a live ActorContext, exactly as a request would. */
export async function actorFor(
  prisma: PrismaClient, userId: string, eventId: string,
): Promise<ActorContext> {
  return resolveActor({ prisma, user_id: userId, event_id: eventId, request_id: randomUUID() });
}
