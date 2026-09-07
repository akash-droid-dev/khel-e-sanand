/**
 * Tie resolution.
 *
 * §15: "Tie resolution is an ordered, versioned policy. Exhausting that policy yields
 * TIE_REQUIRES_DECISION or an explicitly permitted shared place. Never break ties
 * using database IDs, names, school names, data-entry time or hidden randomness."
 *
 * That last sentence is the whole design constraint. This module therefore:
 *   - takes candidates as an UNORDERED set and never consults their input order;
 *   - only ever compares values a declared TieRule asks for;
 *   - stops and asks a human the moment the declared policy runs out.
 *
 * A stable sort over equal keys would preserve insertion order and quietly decide a
 * medal. Instead, groups that remain tied after the policy stay explicitly tied.
 */
import type { TieRule, UnresolvedDecision, ParticipantResult } from './types.js';
import { HUMAN_DECISION_COMPARATORS } from './types.js';

/**
 * Supplies a comparator's value for one participant.
 * Returns null when the value cannot be computed from the recorded observations —
 * which escalates to an official decision rather than defaulting to zero.
 */
export type ComparatorResolver = (participantId: string, rule: TieRule) => number | null;

export interface RankInput {
  participant_id: string;
  /** null → unrankable (DNS/DNF/DQ/NM). Excluded from ranking entirely. */
  primary_value: number | null;
}

export interface RankOutcome {
  /** participant_id → 1-based rank. Absent for unrankable participants. */
  ranks: Map<string, number>;
  /** participant_ids that share their rank with at least one other. */
  shared: Set<string>;
  /** Per-participant trace of which tie rules were applied and what they yielded. */
  traces: Map<string, string[]>;
  /** Secondary values in the order the policy declared them. */
  secondaries: Map<string, number[]>;
  unresolved: UnresolvedDecision[];
}

export interface RankOptions {
  /** 'LowerWins' for times, 'HigherWins' for distances and points. */
  direction: 'HigherWins' | 'LowerWins';
  policy: readonly TieRule[];
  allowSharedPlace: boolean;
  resolve: ComparatorResolver;
}

/**
 * Rank a set of participants.
 *
 * Unrankable participants (primary_value === null) are never assigned a rank, which
 * is how GT-005 / §15 are satisfied structurally: a DNS cannot reach rank 1 because
 * it never enters the ranking set at all.
 */
export function rankParticipants(inputs: readonly RankInput[], opts: RankOptions): RankOutcome {
  const outcome: RankOutcome = {
    ranks: new Map(),
    shared: new Set(),
    traces: new Map(),
    secondaries: new Map(),
    unresolved: [],
  };
  for (const i of inputs) outcome.traces.set(i.participant_id, []);

  const rankable = inputs.filter((i): i is RankInput & { primary_value: number } =>
    i.primary_value !== null);

  for (const i of inputs) {
    if (i.primary_value === null) {
      outcome.traces.get(i.participant_id)!.push('No comparable result — excluded from ranking.');
    }
  }
  if (rankable.length === 0) return outcome;

  // Group by exact primary value. Integer base units make this equality safe.
  const byValue = new Map<number, string[]>();
  for (const r of rankable) {
    const bucket = byValue.get(r.primary_value);
    if (bucket) bucket.push(r.participant_id);
    else byValue.set(r.primary_value, [r.participant_id]);
  }

  const orderedValues = [...byValue.keys()].sort((a, b) =>
    opts.direction === 'LowerWins' ? a - b : b - a);

  let nextRank = 1;
  for (const value of orderedValues) {
    const group = byValue.get(value)!;
    if (group.length === 1) {
      const id = group[0]!;
      outcome.ranks.set(id, nextRank);
      outcome.traces.get(id)!.push(`Rank ${nextRank} on primary result (${value}).`);
      nextRank += 1;
      continue;
    }

    // Tied on the primary value — walk the declared policy.
    const resolved = breakTie(group, nextRank, opts, outcome);
    nextRank += resolved;
  }

  return outcome;
}

/**
 * Apply the ordered tie policy to one tied group.
 * Returns how many rank positions the group consumed.
 */
function breakTie(
  group: readonly string[],
  startRank: number,
  opts: RankOptions,
  outcome: RankOutcome,
): number {
  for (const id of group) {
    outcome.traces.get(id)!.push(
      `Tied on primary result with ${group.length - 1} other participant(s); applying tie policy.`,
    );
  }

  // Partition progressively: each rule splits the group into finer sub-groups.
  let partitions: string[][] = [[...group]];

  for (const rule of opts.policy) {
    if (partitions.every((p) => p.length === 1)) break;

    if (HUMAN_DECISION_COMPARATORS.includes(rule.comparator)) {
      // e.g. DrawingOfLots — permitted, but only an official can record the outcome.
      return finishUnresolved(partitions, startRank, rule, opts, outcome,
        `Tie policy reached "${rule.label}", which requires an official to record a witnessed decision.`,
        'The official records the drawing-of-lots outcome; the software does not generate it.');
    }

    const next: string[][] = [];
    let abandoned: { reason: string; required: string } | null = null;

    for (const part of partitions) {
      if (part.length === 1) { next.push(part); continue; }

      const values = new Map<string, number>();
      let missing = false;
      for (const id of part) {
        const v = opts.resolve(id, rule);
        if (v === null) { missing = true; break; }
        values.set(id, v);
      }
      if (missing) {
        abandoned = {
          reason: `Tie policy step "${rule.label}" cannot be computed from the recorded observations.`,
          required: `Supply the data "${rule.label}" needs, or record an official decision.`,
        };
        next.push(part);
        continue;
      }

      for (const id of part) {
        const v = values.get(id)!;
        outcome.traces.get(id)!.push(`${rule.label}: ${v}`);
        const sec = outcome.secondaries.get(id) ?? [];
        sec.push(v);
        outcome.secondaries.set(id, sec);
      }

      const distinct = [...new Set(values.values())].sort((a, b) =>
        rule.direction === 'LowerWins' ? a - b : b - a);
      for (const dv of distinct) {
        next.push(part.filter((id) => values.get(id) === dv));
      }
    }

    partitions = next;
    if (abandoned) {
      return finishUnresolved(partitions, startRank, rule, opts, outcome,
        abandoned.reason, abandoned.required);
    }
  }

  // Policy exhausted.
  if (partitions.every((p) => p.length === 1)) {
    let rank = startRank;
    for (const part of partitions) {
      const id = part[0]!;
      outcome.ranks.set(id, rank);
      outcome.traces.get(id)!.push(`Rank ${rank} after tie policy.`);
      rank += 1;
    }
    return partitions.length;
  }

  const lastRule = opts.policy[opts.policy.length - 1];
  return finishUnresolved(partitions, startRank, lastRule, opts, outcome,
    'The published tie policy is exhausted and these participants remain equal.',
    'Approve a shared place, or record the official decision that separates them.');
}

/**
 * Terminal handling for a group the policy could not separate.
 * Either awards a shared place (only when the profile explicitly permits it) or
 * raises TIE_REQUIRES_DECISION and leaves those participants unranked.
 */
function finishUnresolved(
  partitions: string[][],
  startRank: number,
  rule: TieRule | undefined,
  opts: RankOptions,
  outcome: RankOutcome,
  reason: string,
  requiredInput: string,
): number {
  let rank = startRank;
  let consumed = 0;

  for (const part of partitions) {
    if (part.length === 1) {
      const id = part[0]!;
      outcome.ranks.set(id, rank);
      outcome.traces.get(id)!.push(`Rank ${rank} after tie policy.`);
      rank += 1; consumed += 1;
      continue;
    }

    if (opts.allowSharedPlace) {
      for (const id of part) {
        outcome.ranks.set(id, rank);
        outcome.shared.add(id);
        outcome.traces.get(id)!.push(
          `Shared rank ${rank}: ${reason} The rule profile permits a shared place.`,
        );
      }
      // Standard competition ranking: N tied at rank R consume R..R+N-1.
      rank += part.length; consumed += part.length;
      continue;
    }

    outcome.unresolved.push({
      code: 'TIE_REQUIRES_DECISION',
      message: `${reason}${rule ? ` Last rule applied: "${rule.label}".` : ''}`,
      participant_ids: [...part],
      required_input: requiredInput,
    });
    for (const id of part) {
      outcome.traces.get(id)!.push(`Unresolved tie at rank ${rank} — awaiting official decision.`);
    }
    rank += part.length; consumed += part.length;
  }
  return consumed;
}

/** Copy ranking output onto participant result lines. */
export function applyRanking(results: ParticipantResult[], outcome: RankOutcome): void {
  for (const r of results) {
    const rank = outcome.ranks.get(r.participant_id);
    r.rank = rank ?? null;
    r.shared_rank = outcome.shared.has(r.participant_id);
    const trace = outcome.traces.get(r.participant_id);
    if (trace) r.reason_trace.push(...trace);
    const sec = outcome.secondaries.get(r.participant_id);
    if (sec) r.secondary_values = sec;
  }
}
