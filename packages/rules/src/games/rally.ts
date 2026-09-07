/**
 * Rally-scoring core, shared by G10 Badminton (games) and G11 Volleyball (sets).
 *
 * §25 and §26 describe the same shape with different parameters:
 *   a scoring unit closes when a side reaches the target T with a lead of at least L,
 *   or when it reaches an optional cap C.
 *
 * The non-obvious requirement is §25's third clause: reject "results that imply play
 * continued after the game should already have ended". A validator that only checks
 * whether the FINAL score is terminal accepts 25–20 under T=21/L=2 — a score that
 * cannot occur, because play would have stopped at 22–20. So a final score is legal
 * only when it is terminal AND the score one rally earlier was not.
 */

export interface UnitRules {
  /** Target score T. */
  target: number;
  /** Required winning lead L. */
  margin: number;
  /** Optional cap C. null = uncapped (the ordinary volleyball profile). */
  cap: number | null;
}

export type UnitState = 'Open' | 'Closed' | 'Invalid';

export interface UnitEvaluation {
  state: UnitState;
  /** 'A' | 'B' when Closed, otherwise null. */
  winner: 'A' | 'B' | null;
  reason: string;
  /** Set when state is Invalid, for a precise operator message. */
  code?:
    | 'NEGATIVE_SCORE'
    | 'ABOVE_CAP'
    | 'BOTH_AT_CAP'
    | 'PLAY_CONTINUED_AFTER_CLOSE'
    | 'CAP_BELOW_TARGET';
}

/** Is (a, b) a terminal score under these rules? Pure predicate, no legality check. */
function isTerminal(a: number, b: number, rules: UnitRules): 'A' | 'B' | null {
  const { target, margin, cap } = rules;
  if (cap !== null) {
    if (a >= cap && a > b) return 'A';
    if (b >= cap && b > a) return 'B';
  }
  if (a >= target && a - b >= margin) return 'A';
  if (b >= target && b - a >= margin) return 'B';
  return null;
}

/**
 * Evaluate a completed or in-progress unit score.
 * `finalise` = true means the operator asserts this unit is over, so an Open score
 * is reported as such rather than accepted.
 */
export function evaluateUnit(a: number, b: number, rules: UnitRules): UnitEvaluation {
  const { target, margin, cap } = rules;

  if (cap !== null && cap < target) {
    return {
      state: 'Invalid', winner: null, code: 'CAP_BELOW_TARGET',
      reason: `Rule profile error: cap ${cap} is below target ${target}. §25 requires C absent or C ≥ T.`,
    };
  }
  if (!Number.isInteger(a) || !Number.isInteger(b) || a < 0 || b < 0) {
    return {
      state: 'Invalid', winner: null, code: 'NEGATIVE_SCORE',
      reason: 'Scores must be whole numbers of rallies, zero or above.',
    };
  }
  if (cap !== null && (a > cap || b > cap)) {
    return {
      state: 'Invalid', winner: null, code: 'ABOVE_CAP',
      reason: `Score ${a}–${b} exceeds the cap of ${cap}. Play stops the moment a side reaches ${cap}.`,
    };
  }
  if (cap !== null && a === cap && b === cap) {
    return {
      state: 'Invalid', winner: null, code: 'BOTH_AT_CAP',
      reason: `Both sides cannot reach the cap of ${cap}; the first to reach it ends the unit.`,
    };
  }

  const terminal = isTerminal(a, b, rules);
  if (terminal === null) {
    return {
      state: 'Open', winner: null,
      reason:
        `${a}–${b} does not close the unit: a side needs at least ${target} with a lead of ` +
        `${margin}${cap !== null ? `, or ${cap} to reach the cap` : ''}.`,
    };
  }

  // Legality: the score one rally earlier must NOT already have been terminal.
  const prevA = terminal === 'A' ? a - 1 : a;
  const prevB = terminal === 'B' ? b - 1 : b;
  if (isTerminal(prevA, prevB, rules) !== null) {
    return {
      state: 'Invalid', winner: null, code: 'PLAY_CONTINUED_AFTER_CLOSE',
      reason:
        `${a}–${b} cannot occur: the unit would already have ended at ${prevA}–${prevB}. ` +
        `Check the recorded score against the official sheet.`,
    };
  }

  return {
    state: 'Closed', winner: terminal,
    reason:
      cap !== null && Math.max(a, b) === cap
        ? `${a}–${b} closes the unit at the cap of ${cap}.`
        : `${a}–${b} closes the unit: ${target} reached with a lead of at least ${margin}.`,
  };
}

/** Which unit number is the deciding one, given W units needed to win. §26: 2W−1. */
export function decidingUnitNumber(unitsToWin: number): number {
  return 2 * unitsToWin - 1;
}

/** Maximum units that can legally be played. Same value as the deciding unit number. */
export function maxUnits(unitsToWin: number): number {
  return decidingUnitNumber(unitsToWin);
}
