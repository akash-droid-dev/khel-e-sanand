/**
 * Programme coverage.
 *
 * §15 confirms 11 game groups as 13 discipline codes and §14 says the increments are
 * "sequencing increments, not permission to omit a confirmed game from the launch
 * scope". These tests fail if a discipline is dropped or a test vector goes uncovered.
 */
import { describe, it, expect } from 'vitest';
import { DISCIPLINE_REGISTRY, ALL_DISCIPLINES, registryIsConsistent, missingProfileFields } from './registry.js';
import { DISCIPLINE_CODE } from '@khel/contracts';

/** The 38 game cases in Khelo_Sanand_Data_and_Functions.xlsx → Game_Cases. */
const WORKBOOK_GAME_CASES = Array.from({ length: 38 }, (_, i) =>
  `GT-${String(i + 1).padStart(3, '0')}`);

describe('confirmed programme coverage', () => {
  it('registers all 13 confirmed discipline codes', () => {
    expect(ALL_DISCIPLINES).toHaveLength(13);
    expect([...DISCIPLINE_CODE].sort()).toEqual(
      ['BAD', 'CHE', 'CYC', 'KAB', 'KHO', 'KJT', 'SBJ', 'SBT', 'SP30', 'SP50', 'SP60', 'TOW', 'VOL'],
    );
    for (const code of DISCIPLINE_CODE) {
      expect(DISCIPLINE_REGISTRY[code]).toBeDefined();
      expect(DISCIPLINE_REGISTRY[code].calculator).toBeTruthy();
    }
  });

  it('excludes football, which §15 places outside the confirmed scope', () => {
    expect(DISCIPLINE_CODE as readonly string[]).not.toContain('FOO');
    expect(Object.values(DISCIPLINE_REGISTRY).map((d) => d.label))
      .not.toContain('Football');
  });

  it('keeps each sprint distance an independent discipline', () => {
    const sprints = (['SP30', 'SP50', 'SP60'] as const).map((c) => DISCIPLINE_REGISTRY[c]);
    expect(new Set(sprints.map((s) => s.code)).size).toBe(3);
    expect(sprints.every((s) => s.calculator === 'sprint')).toBe(true);
  });

  it('agrees with the calculation families declared in the contracts package', () => {
    const check = registryIsConsistent();
    expect(check.problems).toEqual([]);
    expect(check.ok).toBe(true);
  });

  it('covers every one of the workbook’s 38 game test cases', () => {
    const covered = new Set(
      Object.values(DISCIPLINE_REGISTRY).flatMap((d) => d.test_vectors),
    );
    const uncovered = WORKBOOK_GAME_CASES.filter((c) => !covered.has(c));
    expect(uncovered).toEqual([]);
    expect(covered.size).toBe(38);
  });

  it('routes the eight calculation families to a calculator', () => {
    const families = new Set(Object.values(DISCIPLINE_REGISTRY).map((d) => d.family));
    expect([...families].sort()).toEqual(
      ['Attempts', 'Chess', 'Games', 'Pulls', 'Raid', 'Sets', 'Time', 'Turn'],
    );
  });
});

describe('rule-version readiness (§6)', () => {
  it('reports every unset required setting rather than defaulting silently', () => {
    const missing = missingProfileFields('BAD', {
      singles_doubles: 'Singles', games_to_win: 2, target_points: 21,
      winning_margin: 2, cap: 30,
      // rule_effective_date, intervals, end_changes, retirement_policy, tie_procedure unset
    });
    expect(missing).toContain('rule_effective_date');
    expect(missing).toContain('tie_procedure');
    expect(missing).toHaveLength(5);
  });

  it('treats an empty string as unset, not as a value', () => {
    expect(missingProfileFields('SBJ', { attempts: 3, takeoff_policy: '' }))
      .toContain('takeoff_policy');
  });

  it('passes when every required setting carries a value', () => {
    const complete = Object.fromEntries(
      DISCIPLINE_REGISTRY.TOW.required_profile_fields.map((k) => [k, 'set']),
    );
    expect(missingProfileFields('TOW', complete)).toEqual([]);
  });
});
