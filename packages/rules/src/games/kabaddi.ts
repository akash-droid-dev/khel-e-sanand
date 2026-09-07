/**
 * G01 Kabaddi (KAB). §16.
 *
 * Kabaddi is the only confirmed discipline whose score depends on REPLAYABLE STATE:
 * who is on court, who is out, and who is next to revive. §16 makes three demands
 * that follow from that:
 *
 *   - "Persist components separately from total" — a total alone cannot be audited.
 *   - "Both sides may receive points in the same raid when the official's decision
 *     permits it. Do not model every raid as a simple win/loss toggle."
 *   - "A correction to an earlier raid replays subsequent state and exposes dependent
 *     contradictions for review. It cannot merely change the displayed total while
 *     leaving player state unchanged."
 *
 * So this calculator is a deterministic replay of the raid sequence from the opening
 * court state. Correcting raid 4 re-runs raids 5..n and reports what no longer holds.
 */
import type { DisciplineCode } from '@khel/contracts';
import type {
  Side,
  BaseRuleProfile, CalculationOutput, ParticipantResult, ParticipantRef,
  UnresolvedDecision, ValidationIssue,
} from '../types.js';
import { otherSide as other } from '../types.js';


export interface KabaddiRaid {
  observation_id: string;
  half: number;
  /** Sequential within the match. Used to order the replay — never array position. */
  raid_no: number;
  raiding_side: Side;
  raider_id: string;
  /** Defenders on court before the raid, as recorded by the official. */
  defenders_before: number;
  /** Defenders the official declared out in this raid. */
  defenders_out: string[];
  /** True when the raider was caught. Awards the defending side a point. */
  raider_out: boolean;
  /** Bonus point claimed and allowed by the official. */
  bonus_awarded: boolean;
  /** The official's confirmation that an all-out occurred on this raid. */
  all_out_awarded: boolean;
  /** Technical / penalty points awarded outside the raid mechanics. */
  technical_points_a?: number;
  technical_points_b?: number;
  official_reason?: string | null;
}

/** §16: "A penalty can exist outside a raid and must not require a fictional raider." */
export interface KabaddiPenalty {
  observation_id: string;
  half: number;
  /** Ordering key, sharing the raid sequence space. */
  sequence: number;
  awarded_to: Side;
  points: number;
  reason: string;
}

export interface KabaddiRuleProfile extends BaseRuleProfile {
  discipline: Extract<DisciplineCode, 'KAB'>;
  on_court_players: number;
  points_per_out: number;
  bonus_enabled: boolean;
  /** Minimum defenders on court for a bonus to be available. */
  bonus_defender_threshold: number;
  bonus_points: number;
  /** Extra points awarded to the side that inflicts an all-out. */
  all_out_extra: number;
  /**
   * How revivals work. 'OnePerOpponentOut' is the conventional profile; 'None'
   * disables revival entirely for a simplified school variant.
   */
  revival_policy: 'OnePerOpponentOut' | 'None';
  super_tackle_enabled: boolean;
  do_or_die_enabled: boolean;
  halves: number;
}

export interface KabaddiInput {
  profile: KabaddiRuleProfile;
  /** Exactly two team participants: index 0 is side A, index 1 is side B. */
  participants: [ParticipantRef, ParticipantRef];
  /** Ordered squad lists; the first `on_court_players` of each start on court. */
  roster: Record<Side, string[]>;
  raids: KabaddiRaid[];
  penalties?: KabaddiPenalty[];
  /** True once the official has confirmed full time. */
  full_time?: boolean;
}

interface CourtState {
  active: Set<string>;
  /** FIFO order of players who went out — the revival queue. */
  outQueue: string[];
}

interface Components {
  touch_points: number;
  bonus_points: number;
  all_out_points: number;
  technical_points: number;
  raider_out_points: number;
}

const zero = (): Components => ({
  touch_points: 0, bonus_points: 0, all_out_points: 0,
  technical_points: 0, raider_out_points: 0,
});

const total = (c: Components): number =>
  c.touch_points + c.bonus_points + c.all_out_points + c.technical_points + c.raider_out_points;

export function calculateKabaddi(input: KabaddiInput): CalculationOutput {
  const { profile, participants, roster } = input;
  const issues: ValidationIssue[] = [];
  const unresolved: UnresolvedDecision[] = [];
  const explanation: string[] = [
    `KAB: ${profile.on_court_players} on court, ${profile.points_per_out} point(s) per out, ` +
    `all-out extra ${profile.all_out_extra}, bonus ${profile.bonus_enabled ? 'enabled' : 'disabled'}, ` +
    `revival ${profile.revival_policy}.`,
  ];
  if (profile.super_tackle_enabled || profile.do_or_die_enabled) {
    explanation.push(
      `Variant switches in force: ${[
        profile.super_tackle_enabled ? 'super tackle' : null,
        profile.do_or_die_enabled ? 'do-or-die raids' : null,
      ].filter(Boolean).join(', ')}.`,
    );
  }

  // ---- Deduplicate (GT-002) ------------------------------------------------
  // A repeated command with the same observation identity changes nothing.
  const seenObs = new Set<string>();
  const seenRaidKey = new Set<string>();
  const raids: KabaddiRaid[] = [];
  let duplicates = 0;

  for (const r of [...input.raids].sort((a, b) => a.half - b.half || a.raid_no - b.raid_no)) {
    if (seenObs.has(r.observation_id)) { duplicates += 1; continue; }
    seenObs.add(r.observation_id);
    const key = `${r.half}#${r.raid_no}`;
    if (seenRaidKey.has(key)) {
      issues.push({
        code: 'DUPLICATE_RAID_NUMBER',
        message: `Half ${r.half} raid ${r.raid_no} is recorded more than once.`,
        observation_id: r.observation_id,
      });
      duplicates += 1;
      continue;
    }
    seenRaidKey.add(key);
    raids.push(r);
  }
  if (duplicates > 0) explanation.push(`${duplicates} duplicate raid command(s) ignored.`);

  // ---- Opening court state -------------------------------------------------
  const state: Record<Side, CourtState> = {
    A: { active: new Set(roster.A.slice(0, profile.on_court_players)), outQueue: [] },
    B: { active: new Set(roster.B.slice(0, profile.on_court_players)), outQueue: [] },
  };
  const comp: Record<Side, Components> = { A: zero(), B: zero() };
  const raidLog: string[] = [];

  for (const side of ['A', 'B'] as Side[]) {
    if (roster[side].length < profile.on_court_players) {
      issues.push({
        code: 'ROSTER_TOO_SMALL',
        message:
          `Side ${side} has ${roster[side].length} players but the profile needs ` +
          `${profile.on_court_players} on court.`,
      });
    }
  }

  // ---- Replay --------------------------------------------------------------
  for (const raid of raids) {
    const raiding = raid.raiding_side;
    const defending = other(raiding);
    const label = `H${raid.half} R${raid.raid_no}`;

    // §16: "the raider must be active for the raiding side".
    if (!state[raiding].active.has(raid.raider_id)) {
      issues.push({
        code: 'RAIDER_NOT_ACTIVE',
        message:
          `${label}: raider ${raid.raider_id} is not active for side ${raiding} at this point ` +
          `in the replayed match state.`,
        observation_id: raid.observation_id,
      });
    }

    // §16: "A defender cannot be counted twice in one raid, an out player cannot be
    // tagged again before revival."
    const outsThisRaid = new Set<string>();
    const acceptedOuts: string[] = [];
    for (const d of raid.defenders_out) {
      if (outsThisRaid.has(d)) {
        issues.push({
          code: 'DEFENDER_COUNTED_TWICE',
          message: `${label}: defender ${d} is recorded out twice in the same raid.`,
          observation_id: raid.observation_id,
        });
        continue;
      }
      outsThisRaid.add(d);
      if (!state[defending].active.has(d)) {
        issues.push({
          code: 'DEFENDER_ALREADY_OUT',
          message:
            `${label}: defender ${d} is already out and has not been revived, so cannot be ` +
            `tagged again.`,
          observation_id: raid.observation_id,
        });
        continue;
      }
      acceptedOuts.push(d);
    }

    // Recorded defender count must agree with the replayed state.
    const actualDefenders = state[defending].active.size;
    if (raid.defenders_before !== actualDefenders) {
      issues.push({
        code: 'COURT_STATE_MISMATCH',
        message:
          `${label}: the sheet records ${raid.defenders_before} defender(s) on court but the ` +
          `replayed state has ${actualDefenders}. An earlier raid may have been corrected.`,
        observation_id: raid.observation_id,
      });
    }

    // ---- Points -----------------------------------------------------------
    const touch = acceptedOuts.length * profile.points_per_out;
    comp[raiding].touch_points += touch;

    let bonus = 0;
    if (raid.bonus_awarded) {
      if (!profile.bonus_enabled) {
        issues.push({
          code: 'BONUS_NOT_AVAILABLE',
          message: `${label}: a bonus was recorded but this rule version does not enable bonus points.`,
          observation_id: raid.observation_id,
        });
      } else if (actualDefenders < profile.bonus_defender_threshold) {
        issues.push({
          code: 'BONUS_THRESHOLD_NOT_MET',
          message:
            `${label}: a bonus needs at least ${profile.bonus_defender_threshold} defenders ` +
            `on court; ${actualDefenders} were active.`,
          observation_id: raid.observation_id,
        });
      } else {
        bonus = profile.bonus_points;
        comp[raiding].bonus_points += bonus;
      }
    }

    // §16: both sides may score in one raid. A caught raider awards the defenders.
    let raiderOutPoints = 0;
    if (raid.raider_out) {
      raiderOutPoints = profile.points_per_out;
      comp[defending].raider_out_points += raiderOutPoints;
    }

    const techA = raid.technical_points_a ?? 0;
    const techB = raid.technical_points_b ?? 0;
    comp.A.technical_points += techA;
    comp.B.technical_points += techB;

    // ---- State transitions ------------------------------------------------
    // §16: "Apply opponent-out transitions before revival/reset."
    for (const d of acceptedOuts) {
      state[defending].active.delete(d);
      state[defending].outQueue.push(d);
    }
    if (raid.raider_out && state[raiding].active.has(raid.raider_id)) {
      state[raiding].active.delete(raid.raider_id);
      state[raiding].outQueue.push(raid.raider_id);
    }

    // Revival. §16 / GT-003: "Bonus-only awards do not revive players."
    if (profile.revival_policy === 'OnePerOpponentOut') {
      revive(state[raiding], acceptedOuts.length, profile.on_court_players);
      if (raid.raider_out) revive(state[defending], 1, profile.on_court_players);
    }

    // ---- All-out ----------------------------------------------------------
    const defendingEmpty = state[defending].active.size === 0;
    let allOutPoints = 0;
    if (raid.all_out_awarded) {
      if (!defendingEmpty) {
        issues.push({
          code: 'ALL_OUT_NOT_SUPPORTED_BY_STATE',
          message:
            `${label}: an all-out was confirmed but side ${defending} still has ` +
            `${state[defending].active.size} player(s) on court in the replayed state.`,
          observation_id: raid.observation_id,
        });
      } else {
        allOutPoints = profile.all_out_extra;
        comp[raiding].all_out_points += allOutPoints;
        // §16: "Record the reset so a later save cannot add the bonus again."
        resetCourt(state.A, input.roster.A, profile.on_court_players);
        resetCourt(state.B, input.roster.B, profile.on_court_players);
      }
    } else if (defendingEmpty) {
      // The state says all-out but no official confirmed it. Never award silently.
      unresolved.push({
        code: 'OFFICIAL_DISPOSITION_REQUIRED',
        message:
          `${label}: side ${defending} has no players left on court but no all-out was ` +
          `confirmed by the official.`,
        participant_ids: [participants[defending === 'A' ? 0 : 1].participant_id],
        required_input: 'The official confirms or rejects the all-out and the court reset.',
      });
    }

    raidLog.push(
      `${label} (${raiding} raiding): ` +
      [
        touch ? `${touch} touch` : null,
        bonus ? `${bonus} bonus` : null,
        allOutPoints ? `${allOutPoints} all-out` : null,
        raiderOutPoints ? `${raiderOutPoints} to ${defending} (raider out)` : null,
        techA ? `${techA} technical to A` : null,
        techB ? `${techB} technical to B` : null,
      ].filter(Boolean).join(', ') || 'no score',
    );
  }

  // ---- Standalone penalties ------------------------------------------------
  for (const p of input.penalties ?? []) {
    if (!p.reason) {
      issues.push({
        code: 'PENALTY_REASON_REQUIRED',
        message: `A penalty of ${p.points} to side ${p.awarded_to} has no recorded reason.`,
        observation_id: p.observation_id,
      });
    }
    comp[p.awarded_to].technical_points += p.points;
    raidLog.push(`H${p.half} penalty: ${p.points} to ${p.awarded_to} (${p.reason}).`);
  }

  explanation.push(...raidLog);

  // ---- Results -------------------------------------------------------------
  const obsIds = raids.map((r) => r.observation_id);
  const results: ParticipantResult[] = (['A', 'B'] as Side[]).map((side, i) => {
    const c = comp[side];
    return {
      participant_id: participants[i]!.participant_id,
      status: 'Completed',
      primary_value: total(c),
      primary_display: String(total(c)),
      secondary_values: [],
      rank: null,
      shared_rank: false,
      // §16: components persist alongside — never only the total.
      components: { ...c, total: total(c), on_court_at_end: state[side].active.size },
      reason_trace: [
        `Touch ${c.touch_points} + bonus ${c.bonus_points} + all-out ${c.all_out_points} + ` +
        `raider-out ${c.raider_out_points} + technical ${c.technical_points} = ${total(c)}.`,
      ],
      source_observation_ids: obsIds,
    };
  });

  const [a, b] = results as [ParticipantResult, ParticipantResult];
  let winner: string | null = null;

  if (input.full_time) {
    if (a.primary_value! > b.primary_value!) { winner = a.participant_id; a.rank = 1; b.rank = 2; }
    else if (b.primary_value! > a.primary_value!) { winner = b.participant_id; b.rank = 1; a.rank = 2; }
    else {
      // §16: "no winner is fabricated from first scorer or number of raids."
      if (profile.allow_shared_place) {
        a.rank = 1; b.rank = 1; a.shared_rank = true; b.shared_rank = true;
        explanation.push('Full time level. The profile permits a shared placing (league draw).');
      } else {
        unresolved.push({
          code: 'TIE_REQUIRES_DECISION',
          message:
            `Full time is level at ${a.primary_value}–${b.primary_value}. The approved tie stage ` +
            `must be played and its result approved; no winner is derived from the raid record.`,
          participant_ids: [a.participant_id, b.participant_id],
          required_input: 'Play and approve the configured tie stage, or apply the league draw policy.',
        });
      }
    }
  }

  return {
    discipline: 'KAB',
    rule_version_id: profile.rule_version_id,
    participants: results,
    winner_participant_id: winner,
    standings: winner
      ? [winner, winner === a.participant_id ? b.participant_id : a.participant_id]
      : [],
    unresolved,
    issues,
    complete: issues.length === 0 && unresolved.length === 0 && winner !== null,
    explanation,
  };
}

/** Revive up to `count` players from the front of the out queue. */
function revive(court: CourtState, count: number, capacity: number): void {
  for (let i = 0; i < count; i += 1) {
    if (court.outQueue.length === 0) break;
    if (court.active.size >= capacity) break;
    court.active.add(court.outQueue.shift()!);
  }
}

/** All-out reset: both sides return to full strength and the queues clear. */
function resetCourt(court: CourtState, roster: string[], capacity: number): void {
  court.active = new Set(roster.slice(0, capacity));
  court.outQueue = [];
}

/**
 * Replay a corrected raid sequence against the original and report what no longer holds.
 * §16 / GT-004: a correction "replays subsequent state and exposes dependent
 * contradictions for review. It cannot merely change the displayed total."
 */
export function replayWithCorrection(
  original: KabaddiInput,
  correctedRaids: KabaddiRaid[],
): { before: CalculationOutput; after: CalculationOutput; contradictions: ValidationIssue[] } {
  const before = calculateKabaddi(original);
  const after = calculateKabaddi({ ...original, raids: correctedRaids });

  const beforeCodes = new Set(before.issues.map((i) => `${i.code}#${i.observation_id ?? ''}`));
  const contradictions = after.issues.filter(
    (i) => !beforeCodes.has(`${i.code}#${i.observation_id ?? ''}`),
  );
  return { before, after, contradictions };
}
