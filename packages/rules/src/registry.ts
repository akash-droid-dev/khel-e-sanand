/**
 * Discipline → calculator registry.
 *
 * §15 confirms 11 game groups represented as 13 discipline codes, because each
 * sprint distance is a separate discipline. This registry is the single place that
 * mapping lives, so a competition can never be published against a calculator that
 * does not exist, and no discipline can be silently forgotten.
 */
import type { CalculationFamily, DisciplineCode } from '@khel/contracts';
import { DISCIPLINE_CODE, DISCIPLINE_CALCULATOR, DISCIPLINE_LABEL } from '@khel/contracts';

export type CalculatorId =
  | 'attempts' | 'matchplay' | 'sprint' | 'cycling' | 'kabaddi' | 'khokho' | 'chess' | 'tugofwar';

export interface DisciplineRegistration {
  code: DisciplineCode;
  label: string;
  family: CalculationFamily;
  calculator: CalculatorId;
  /** Specification section describing this discipline's contract. */
  spec_section: string;
  /** Game test vector ids from the workbook that exercise this discipline. */
  test_vectors: string[];
  /** Rule-profile keys that must be set before a rule version can be approved. */
  required_profile_fields: string[];
}

export const DISCIPLINE_REGISTRY: Record<DisciplineCode, DisciplineRegistration> = {
  KAB: {
    code: 'KAB', label: DISCIPLINE_LABEL.KAB, family: 'Raid', calculator: 'kabaddi',
    spec_section: '§16', test_vectors: ['GT-001', 'GT-002', 'GT-003', 'GT-004'],
    required_profile_fields: [
      'on_court_players', 'roster_limit', 'half_minutes', 'raid_seconds', 'bonus_enabled',
      'bonus_defender_threshold', 'all_out_extra', 'revival_policy', 'super_tackle_enabled',
      'do_or_die_enabled', 'tie_procedure',
    ],
  },
  SP30: sprintRegistration('SP30'),
  SP50: sprintRegistration('SP50'),
  SP60: sprintRegistration('SP60'),
  KHO: {
    code: 'KHO', label: DISCIPLINE_LABEL.KHO, family: 'Turn', calculator: 'khokho',
    spec_section: '§18', test_vectors: ['GT-009', 'GT-010', 'GT-011'],
    required_profile_fields: [
      'variant', 'on_court_players', 'roster_limit', 'batch_size', 'innings',
      'turn_minutes', 'points_per_out', 'penalties', 'tie_procedure',
    ],
  },
  SBT: {
    code: 'SBT', label: DISCIPLINE_LABEL.SBT, family: 'Attempts', calculator: 'attempts',
    spec_section: '§19', test_vectors: ['GT-012', 'GT-013', 'GT-014'],
    required_profile_fields: [
      'implement_profile', 'attempts', 'start_area', 'throw_technique', 'foul_policy',
      'measurement_unit', 'measurement_resolution', 'tie_procedure',
    ],
  },
  KJT: {
    code: 'KJT', label: DISCIPLINE_LABEL.KJT, family: 'Attempts', calculator: 'attempts',
    spec_section: '§20', test_vectors: ['GT-015', 'GT-016', 'GT-017'],
    required_profile_fields: [
      'implement_profile', 'scoring_mode', 'attempts', 'start_mode', 'landing_validity',
      'measurement_resolution', 'zone_mapping', 'aggregation', 'tie_procedure',
    ],
  },
  CYC: {
    code: 'CYC', label: DISCIPLINE_LABEL.CYC, family: 'Time', calculator: 'cycling',
    spec_section: '§21', test_vectors: ['GT-018', 'GT-019', 'GT-020'],
    required_profile_fields: [
      'course_profile', 'distance_or_laps', 'start_mode', 'start_reference', 'timing_method',
      'equipment_checks', 'penalty_rules', 'restart_policy', 'lapped_classification', 'tie_procedure',
    ],
  },
  CHE: {
    code: 'CHE', label: DISCIPLINE_LABEL.CHE, family: 'Chess', calculator: 'chess',
    spec_section: '§22', test_vectors: ['GT-021', 'GT-022', 'GT-023', 'GT-024'],
    required_profile_fields: [
      'format', 'rounds', 'time_control', 'increment', 'default_time', 'pairing_source',
      'bye_policy', 'result_points', 'tie_break_order', 'unplayed_game_policy',
    ],
  },
  SBJ: {
    code: 'SBJ', label: DISCIPLINE_LABEL.SBJ, family: 'Attempts', calculator: 'attempts',
    spec_section: '§23', test_vectors: ['GT-025', 'GT-026', 'GT-027'],
    required_profile_fields: [
      'attempts', 'takeoff_policy', 'landing_measurement', 'measurement_unit',
      'measurement_resolution', 'foul_policy', 'tie_procedure',
    ],
  },
  TOW: {
    code: 'TOW', label: DISCIPLINE_LABEL.TOW, family: 'Pulls', calculator: 'tugofwar',
    spec_section: '§24', test_vectors: ['GT-028', 'GT-029', 'GT-030'],
    required_profile_fields: [
      'team_size', 'roster_limit', 'category_checks', 'rope_ground_profile', 'pull_format',
      'pulls_to_win', 'end_changes', 'rest_minutes', 'no_pull_policy', 'league_points',
    ],
  },
  BAD: {
    code: 'BAD', label: DISCIPLINE_LABEL.BAD, family: 'Games', calculator: 'matchplay',
    spec_section: '§25', test_vectors: ['GT-031', 'GT-032', 'GT-033', 'GT-034'],
    required_profile_fields: [
      'singles_doubles', 'rule_effective_date', 'games_to_win', 'target_points',
      'winning_margin', 'cap', 'intervals', 'end_changes', 'retirement_policy', 'tie_procedure',
    ],
  },
  VOL: {
    code: 'VOL', label: DISCIPLINE_LABEL.VOL, family: 'Sets', calculator: 'matchplay',
    spec_section: '§26', test_vectors: ['GT-035', 'GT-036', 'GT-037', 'GT-038'],
    required_profile_fields: [
      'team_size', 'roster_limit', 'sets_to_win', 'ordinary_target', 'deciding_target',
      'winning_margin', 'cap', 'rotation_tracking', 'substitution_policy', 'timeout_policy',
      'forfeit_policy',
    ],
  },
};

function sprintRegistration(code: 'SP30' | 'SP50' | 'SP60'): DisciplineRegistration {
  return {
    code, label: DISCIPLINE_LABEL[code], family: 'Time', calculator: 'sprint',
    spec_section: '§17',
    test_vectors: ['GT-005', 'GT-006', 'GT-007', 'GT-008'],
    required_profile_fields: [
      'age_category', 'lane_count', 'timing_method', 'capture_resolution', 'display_precision',
      'false_start_policy', 'place_qualifiers', 'time_qualifiers', 'final_capacity', 'tie_procedure',
    ],
  };
}

/**
 * Rule-version readiness gate.
 * §6: "Required settings have no silent default"; a competition cannot be published
 * until every required field for its discipline carries an approved value.
 */
export function missingProfileFields(
  discipline: DisciplineCode,
  profile: Record<string, unknown>,
): string[] {
  return DISCIPLINE_REGISTRY[discipline].required_profile_fields.filter((key) => {
    const v = profile[key];
    return v === undefined || v === null || v === '';
  });
}

/** Every discipline code the platform supports, in programme order. */
export const ALL_DISCIPLINES: readonly DisciplineCode[] = DISCIPLINE_CODE;

/** Cross-check that the registry agrees with the contracts package. */
export function registryIsConsistent(): { ok: boolean; problems: string[] } {
  const problems: string[] = [];
  for (const code of DISCIPLINE_CODE) {
    const reg: DisciplineRegistration | undefined = DISCIPLINE_REGISTRY[code];
    if (!reg) { problems.push(`No registration for discipline ${code}.`); continue; }
    if (reg.family !== DISCIPLINE_CALCULATOR[code]) {
      problems.push(
        `${code}: registry family ${reg.family} disagrees with contracts ` +
        `(${DISCIPLINE_CALCULATOR[code]}).`,
      );
    }
    if (!reg.required_profile_fields.length) {
      problems.push(`${code}: no required profile fields declared.`);
    }
  }
  return { ok: problems.length === 0, problems };
}
