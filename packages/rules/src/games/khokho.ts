/**
 * G03 Kho Kho (KHO). §18.
 *
 * Scoring is per-turn: a chasing side earns points for defenders put out during its
 * turn, and the match total is the sum of a side's CHASING turns — §18 is explicit
 * that defender survival time does not score by default.
 *
 * The structural rules that matter:
 *   - a defender's departure counts once per BATCH APPEARANCE; re-entry in a later
 *     valid batch is a new appearance and can be counted again (§18);
 *   - a missing turn blocks finalisation and must never be treated as a completed
 *     turn that happened to score zero (GT-011).
 */
import type { DisciplineCode } from '@khel/contracts';
import type {
  Side,
  BaseRuleProfile, CalculationOutput, ParticipantResult, ParticipantRef,
  UnresolvedDecision, ValidationIssue,
} from '../types.js';
import { otherSide as other } from '../types.js';


export interface KhoTurn {
  observation_id: string;
  inning_no: number;
  turn_no: number;
  chasing_side: Side;
  /** Set when the turn is finished. An open turn cannot be scored. */
  closed: boolean;
  close_reason?: string | null;
  planned_seconds: number;
  actual_seconds?: number | null;
}

export interface KhoBatch {
  observation_id: string;
  inning_no: number;
  turn_no: number;
  /** 1-based order of this batch within the turn. */
  batch_sequence: number;
  /** Defender ids entering the field in this batch, in order. */
  defender_ids: string[];
}

export interface KhoOutEvent {
  observation_id: string;
  inning_no: number;
  turn_no: number;
  batch_sequence: number;
  defender_id: string;
  out_reason: string;
  /** Points for this out. Normally the profile's points_per_out. */
  points_awarded: number;
  official_confirmed: boolean;
}

export interface KhoPenalty {
  observation_id: string;
  inning_no: number;
  awarded_to: Side;
  points: number;
  reason: string;
}

export interface KhoRuleProfile extends BaseRuleProfile {
  discipline: Extract<DisciplineCode, 'KHO'>;
  variant: string;
  on_court_players: number;
  batch_size: number;
  innings: number;
  /** Turns per inning — normally 2 (each side chases once). */
  turns_per_inning: number;
  turn_minutes: number;
  points_per_out: number;
  /** Disabled unless a variant is expressly adopted (§18). */
  dream_run_enabled: boolean;
}

export interface KhoInput {
  profile: KhoRuleProfile;
  participants: [ParticipantRef, ParticipantRef];
  turns: KhoTurn[];
  batches: KhoBatch[];
  outs: KhoOutEvent[];
  penalties?: KhoPenalty[];
  /** An officially recorded early finish, which alone can excuse a missing turn (§18). */
  early_finish_reason?: string | null;
}

export function calculateKhoKho(input: KhoInput): CalculationOutput {
  const { profile, participants } = input;
  const issues: ValidationIssue[] = [];
  const unresolved: UnresolvedDecision[] = [];
  const explanation: string[] = [
    `KHO ${profile.variant}: ${profile.innings} inning(s) × ${profile.turns_per_inning} turn(s), ` +
    `batch size ${profile.batch_size}, ${profile.points_per_out} point(s) per out.`,
  ];
  if (!profile.dream_run_enabled) {
    explanation.push('Dream-run / powerplay variant not adopted: it contributes no points.');
  }

  const turns = [...input.turns].sort(
    (a, b) => a.inning_no - b.inning_no || a.turn_no - b.turn_no,
  );

  // ---- Structural completeness (GT-011) -----------------------------------
  const expected: { inning: number; turn: number }[] = [];
  for (let i = 1; i <= profile.innings; i += 1) {
    for (let t = 1; t <= profile.turns_per_inning; t += 1) expected.push({ inning: i, turn: t });
  }
  const present = new Set(turns.map((t) => `${t.inning_no}#${t.turn_no}`));
  const missing = expected.filter((e) => !present.has(`${e.inning}#${e.turn}`));

  if (missing.length > 0) {
    const list = missing.map((m) => `inning ${m.inning} turn ${m.turn}`).join(', ');
    if (input.early_finish_reason) {
      explanation.push(`Missing ${list}, excused by recorded early finish: ${input.early_finish_reason}.`);
    } else {
      // §18: "Missing turns must not be treated as zero-scoring completed turns."
      unresolved.push({
        code: 'INCOMPLETE_STRUCTURE',
        message:
          `The approved structure requires ${expected.length} turn(s); ${list} ` +
          `${missing.length === 1 ? 'is' : 'are'} not recorded. A missing turn is not a ` +
          `completed turn that scored nothing.`,
        participant_ids: participants.map((p) => p.participant_id),
        required_input:
          'Record the missing turn, or record an official early-completion decision.',
      });
    }
  }

  // Chasing/defending roles must alternate through the approved sequence (§18).
  for (let i = 1; i < turns.length; i += 1) {
    const prev = turns[i - 1]!;
    const cur = turns[i]!;
    if (prev.chasing_side === cur.chasing_side) {
      issues.push({
        code: 'TURN_ROLES_NOT_ALTERNATING',
        message:
          `Inning ${cur.inning_no} turn ${cur.turn_no}: side ${cur.chasing_side} chases twice in ` +
          `succession, which the approved sequence does not allow.`,
        observation_id: cur.observation_id,
      });
    }
    if (!prev.closed) {
      issues.push({
        code: 'PREVIOUS_TURN_NOT_CLOSED',
        message:
          `Inning ${cur.inning_no} turn ${cur.turn_no} begins although the previous turn is not closed.`,
        observation_id: cur.observation_id,
      });
    }
  }

  // ---- Batch membership ----------------------------------------------------
  const batchKey = (inn: number, turn: number, seq: number) => `${inn}#${turn}#${seq}`;
  const batchMembers = new Map<string, Set<string>>();
  for (const b of input.batches) {
    const key = batchKey(b.inning_no, b.turn_no, b.batch_sequence);
    if (batchMembers.has(key)) {
      issues.push({
        code: 'DUPLICATE_BATCH',
        message: `Batch ${b.batch_sequence} of inning ${b.inning_no} turn ${b.turn_no} is recorded twice.`,
        observation_id: b.observation_id,
      });
      continue;
    }
    if (b.defender_ids.length !== profile.batch_size) {
      issues.push({
        code: 'BATCH_SIZE_MISMATCH',
        message:
          `Batch ${b.batch_sequence} of inning ${b.inning_no} turn ${b.turn_no} has ` +
          `${b.defender_ids.length} defender(s); the profile specifies ${profile.batch_size}.`,
        observation_id: b.observation_id,
      });
    }
    batchMembers.set(key, new Set(b.defender_ids));
  }

  // ---- Outs ----------------------------------------------------------------
  // GT-010: one departure per batch APPEARANCE. The key includes the batch, so the
  // same defender re-entering in a later batch is a new, countable appearance.
  const countedAppearances = new Set<string>();
  const turnPoints = new Map<string, number>();     // "inning#turn" → points
  const outsByTurn = new Map<string, number>();
  const seenObs = new Set<string>();

  for (const o of input.outs) {
    if (seenObs.has(o.observation_id)) continue;
    seenObs.add(o.observation_id);

    const tKey = `${o.inning_no}#${o.turn_no}`;
    const bKey = batchKey(o.inning_no, o.turn_no, o.batch_sequence);
    const members = batchMembers.get(bKey);

    if (!members) {
      issues.push({
        code: 'OUT_WITHOUT_BATCH',
        message:
          `An out is recorded for batch ${o.batch_sequence} of inning ${o.inning_no} turn ` +
          `${o.turn_no}, but that batch was never entered.`,
        observation_id: o.observation_id,
      });
      continue;
    }
    if (!members.has(o.defender_id)) {
      issues.push({
        code: 'DEFENDER_NOT_IN_BATCH',
        message:
          `Defender ${o.defender_id} is not part of batch ${o.batch_sequence} in inning ` +
          `${o.inning_no} turn ${o.turn_no}.`,
        observation_id: o.observation_id,
      });
      continue;
    }

    const appearanceKey = `${bKey}#${o.defender_id}`;
    if (countedAppearances.has(appearanceKey)) {
      issues.push({
        code: 'DUPLICATE_OUT_FOR_APPEARANCE',
        message:
          `Defender ${o.defender_id} is already recorded out for this batch appearance. ` +
          `A second out for the same appearance is rejected.`,
        observation_id: o.observation_id,
      });
      continue;
    }
    if (!o.official_confirmed) {
      issues.push({
        code: 'OUT_NOT_CONFIRMED',
        message: `An out for defender ${o.defender_id} is not confirmed by the official.`,
        observation_id: o.observation_id,
      });
      continue;
    }
    if (!o.out_reason) {
      issues.push({
        code: 'OUT_REASON_REQUIRED',
        message: `An out for defender ${o.defender_id} has no recorded reason.`,
        observation_id: o.observation_id,
      });
    }

    countedAppearances.add(appearanceKey);
    turnPoints.set(tKey, (turnPoints.get(tKey) ?? 0) + o.points_awarded);
    outsByTurn.set(tKey, (outsByTurn.get(tKey) ?? 0) + 1);
  }

  // ---- Totals: sum a side's CHASING turns ---------------------------------
  const score: Record<Side, number> = { A: 0, B: 0 };
  const outs: Record<Side, number> = { A: 0, B: 0 };
  const turnLines: string[] = [];

  for (const t of turns) {
    const tKey = `${t.inning_no}#${t.turn_no}`;
    const pts = turnPoints.get(tKey) ?? 0;
    const cnt = outsByTurn.get(tKey) ?? 0;

    if (!t.closed) {
      issues.push({
        code: 'TURN_NOT_CLOSED',
        message: `Inning ${t.inning_no} turn ${t.turn_no} is still open and cannot be scored.`,
        observation_id: t.observation_id,
      });
      continue;
    }
    score[t.chasing_side] += pts;
    outs[t.chasing_side] += cnt;
    turnLines.push(
      `Inning ${t.inning_no} turn ${t.turn_no}: ${t.chasing_side} chasing, ` +
      `${cnt} out(s), ${pts} point(s).`,
    );
  }

  for (const p of input.penalties ?? []) {
    if (!p.reason) {
      issues.push({
        code: 'PENALTY_REASON_REQUIRED',
        message: `A penalty of ${p.points} to side ${p.awarded_to} has no recorded reason.`,
        observation_id: p.observation_id,
      });
    }
    score[p.awarded_to] += p.points;
    turnLines.push(`Inning ${p.inning_no} penalty: ${p.points} to ${p.awarded_to} (${p.reason}).`);
  }
  explanation.push(...turnLines);

  const obsIds = [...turns.map((t) => t.observation_id), ...input.outs.map((o) => o.observation_id)];
  const results: ParticipantResult[] = (['A', 'B'] as Side[]).map((side, i) => ({
    participant_id: participants[i]!.participant_id,
    status: 'Completed',
    primary_value: score[side],
    primary_display: String(score[side]),
    secondary_values: [],
    rank: null,
    shared_rank: false,
    components: { points: score[side], outs_taken: outs[side] },
    reason_trace: [`Sum of ${side}'s chasing turns and awarded penalties = ${score[side]}.`],
    source_observation_ids: obsIds,
  }));

  const [a, b] = results as [ParticipantResult, ParticipantResult];
  let winner: string | null = null;
  const structureComplete = unresolved.length === 0 && issues.length === 0;

  if (structureComplete) {
    if (score.A > score.B) { winner = a.participant_id; a.rank = 1; b.rank = 2; }
    else if (score.B > score.A) { winner = b.participant_id; b.rank = 1; a.rank = 2; }
    else if (profile.allow_shared_place) {
      a.rank = 1; b.rank = 1; a.shared_rank = true; b.shared_rank = true;
    } else {
      unresolved.push({
        code: 'TIE_REQUIRES_DECISION',
        message:
          `Totals are level at ${score.A}–${score.B}. The selected tie procedure ` +
          `(for example an extra turn or minimum-chase profile) must be played and confirmed.`,
        participant_ids: [a.participant_id, b.participant_id],
        required_input: 'Play the configured tie procedure and record the official result.',
      });
    }
  }

  return {
    discipline: 'KHO',
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
