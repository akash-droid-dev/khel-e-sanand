/**
 * Illustrative rule profiles for the static demo.
 *
 * ⚠️ NONE of these are approved competition rules. They exist so the calculators have
 * something to calculate with in a browser, and they carry the same status the seeded
 * data does: Draft, unapproved, organiser decision outstanding (docs/DECISIONS.md).
 *
 * Where the specification quotes a reference value — the Kabaddi all-out extra of 2
 * (§16, source S01), volleyball's 25/15/2 (§26, source S11) — it is used here because
 * the workbook's own test vectors use it. §16 is explicit that a reference value is
 * "not automatic adoption for younger/smaller teams".
 */
import type { DisciplineCode } from '@khel/contracts';
import type {
  AttemptsRuleProfile, SprintRuleProfile, MatchRuleProfile,
  KabaddiRuleProfile, KhoRuleProfile, ChessRuleProfile,
  TugRuleProfile, CyclingRuleProfile, ParticipantRef,
} from '@khel/rules';
import { nextBestTieChain } from '@khel/rules';

/** Demo athletes. Invented; no real child is represented. */
export function individuals(n: number, prefix = 'A'): ParticipantRef[] {
  return Array.from({ length: n }, (_, i) => ({
    participant_id: `${prefix}${i + 1}`,
    kind: 'Entry' as const,
    display_name: `Demo Athlete ${String(i + 1).padStart(3, '0')}`,
    school_display: `Demo School ${(i % 4) + 1}`,
  }));
}

export function teams(): [ParticipantRef, ParticipantRef] {
  return [
    { participant_id: 'TA', kind: 'Team', display_name: 'Demo School 1',
      school_display: 'Demo School 1' },
    { participant_id: 'TB', kind: 'Team', display_name: 'Demo School 2',
      school_display: 'Demo School 2' },
  ];
}

const RV = 'RV-DEMO-DRAFT-1';

export const attemptsProfile = (discipline: 'SBT' | 'KJT' | 'SBJ'): AttemptsRuleProfile => ({
  rule_version_id: RV, discipline,
  scoring_mode: 'Distance',
  attempts: 3,                       // §19 proposes 3; explicitly "not approved"
  measurement_unit: 'm',
  tie_procedure: nextBestTieChain(3),
  allow_shared_place: false,
});

export const javelinTargetProfile = (): AttemptsRuleProfile => ({
  ...attemptsProfile('KJT'),
  // §20: a competition uses exactly ONE mode. This is the separate target profile.
  scoring_mode: 'TargetPoints',
  zone_mapping: { Z1: 1, Z3: 3, Z5: 5 },
  aggregation: 'Sum',
});

export const sprintProfile = (discipline: 'SP30' | 'SP50' | 'SP60'): SprintRuleProfile => ({
  rule_version_id: RV, discipline,
  lane_count: 6,
  timing_method: 'Manual',
  capture_resolution_us: 10_000,     // hand timing to hundredths
  display_precision: 2,              // cannot exceed what capture supports
  place_qualifiers: 2, time_qualifiers: 2, final_capacity: 8,
  tie_procedure: [], allow_shared_place: false,
});

export const badmintonProfile = (): MatchRuleProfile => ({
  rule_version_id: RV, discipline: 'BAD',
  units_to_win: 2, ordinary_target: 21, deciding_target: 21,
  winning_margin: 2, cap: 30,
  // §25: a badminton profile MUST carry the date its scoring applies from —
  // BWF's 3x15 system takes effect 4 January 2027.
  rule_effective_date: '2026-12-01',
  tie_procedure: [], allow_shared_place: false,
});

export const badminton3x15Profile = (): MatchRuleProfile => ({
  ...badmintonProfile(),
  ordinary_target: 15, deciding_target: 15, cap: 21,
  rule_effective_date: '2027-01-04',
});

export const volleyballProfile = (): MatchRuleProfile => ({
  rule_version_id: RV, discipline: 'VOL',
  units_to_win: 3, ordinary_target: 25, deciding_target: 15,
  winning_margin: 2,
  cap: null,                         // §26: no cap. Do not apply badminton's 30.
  tie_procedure: [], allow_shared_place: false,
});

export const kabaddiProfile = (): KabaddiRuleProfile => ({
  rule_version_id: RV, discipline: 'KAB',
  on_court_players: 7, points_per_out: 1,
  bonus_enabled: true, bonus_defender_threshold: 6, bonus_points: 1,
  all_out_extra: 2,                  // the reference value quoted in §16
  revival_policy: 'OnePerOpponentOut',
  super_tackle_enabled: false,       // §16: disabled unless expressly adopted
  do_or_die_enabled: false,
  halves: 2,
  tie_procedure: [], allow_shared_place: false,
});

export const kabaddiRoster = (): Record<'A' | 'B', string[]> => ({
  A: Array.from({ length: 7 }, (_, i) => `A${i + 1}`),
  B: Array.from({ length: 7 }, (_, i) => `B${i + 1}`),
});

export const khoProfile = (): KhoRuleProfile => ({
  rule_version_id: RV, discipline: 'KHO',
  variant: 'Conventional school profile (illustrative)',
  on_court_players: 9, batch_size: 3,
  innings: 1, turns_per_inning: 2, turn_minutes: 7,
  points_per_out: 1,                 // the conventional reference in §18
  dream_run_enabled: false,
  tie_procedure: [], allow_shared_place: false,
});

export const chessProfile = (): ChessRuleProfile => ({
  rule_version_id: RV, discipline: 'CHE',
  format: 'RoundRobin', rounds: 3,
  pairing_source: 'ManualApproved',
  bye_half_units: 2,                 // a bye awards 1 point under this policy
  forfeit_win_half_units: 2,
  tie_break_order: [
    { comparator: 'Buchholz', direction: 'HigherWins', label: 'Buchholz' },
  ],
  unplayed_game_policy: 'ExcludeFromBuchholz',
  tie_procedure: [], allow_shared_place: false,
});

export const tugProfile = (): TugRuleProfile => ({
  rule_version_id: RV, discipline: 'TOW',
  team_size: 8, pull_format: 'BestOfThree', pulls_to_win: 2,
  end_change_required: true,
  tie_procedure: [], allow_shared_place: false,
});

export const cyclingProfile = (): CyclingRuleProfile => ({
  rule_version_id: RV, discipline: 'CYC',
  start_mode: 'TimeTrial', start_reference: 'OfficialActualStart',
  required_laps: 3, timing_reference_id: 'demo-chip-timer',
  lapped_classification: 'NotClassified',
  tie_procedure: [], allow_shared_place: false,
});

/** What the demo offers, in programme order. */
export interface DemoDiscipline {
  code: DisciplineCode | 'KJT-TARGET' | 'BAD-3X15';
  label: string;
  family: string;
  /** One line on what this form is demonstrating that is not obvious. */
  note: string;
}

export const DEMO_DISCIPLINES: DemoDiscipline[] = [
  { code: 'SBT', label: 'Softball Throw', family: 'Attempts',
    note: 'Best valid mark. Three fouls give NM — a status, never a zero.' },
  { code: 'SBJ', label: 'Standing Broad Jump', family: 'Attempts',
    note: '132 cm and 1.32 m normalise to the same 1320 mm, exactly.' },
  { code: 'KJT', label: 'Kids Javelin (distance)', family: 'Attempts',
    note: 'Distance mode. The same game has a separate target-points profile.' },
  { code: 'KJT-TARGET', label: 'Kids Javelin (target points)', family: 'Attempts',
    note: 'Zone points. Entering metres here is a type failure, not a conversion.' },
  { code: 'SP30', label: 'Sprint 30 m', family: 'Time',
    note: 'Place and time are separate facts. Equal times with distinct places is fine.' },
  { code: 'SP50', label: 'Sprint 50 m', family: 'Time',
    note: 'An independent discipline — an SP30 result cannot seed an SP50 final.' },
  { code: 'SP60', label: 'Sprint 60 m', family: 'Time',
    note: 'A completed run cannot have a zero duration.' },
  { code: 'BAD', label: 'Badminton (21-point)', family: 'Games',
    note: '21–20 stays open; 30–29 closes at the cap; 31–29 is impossible.' },
  { code: 'BAD-3X15', label: 'Badminton (3×15, from Jan 2027)', family: 'Games',
    note: 'The profile carries its effective date, per §25.' },
  { code: 'VOL', label: 'Volleyball', family: 'Sets',
    note: 'No cap: 25–24 stays open. The fifth set uses its own target.' },
  { code: 'KAB', label: 'Kabaddi', family: 'Raid',
    note: 'A replay of court state — correcting a raid exposes what it breaks.' },
  { code: 'KHO', label: 'Kho Kho', family: 'Turn',
    note: 'A missing turn blocks finalisation; it is not a turn that scored nothing.' },
  { code: 'CHE', label: 'Chess', family: 'Chess',
    note: 'Half points as integers. An unruled claim never becomes a win.' },
  { code: 'TOW', label: 'Tug of War', family: 'Pulls',
    note: 'A no-pull is a replay, never a win. 1–1 is unfinished, not a draw.' },
  { code: 'CYC', label: 'Cycling', family: 'Time',
    note: 'A re-imported timing passage does not add a lap.' },
];
