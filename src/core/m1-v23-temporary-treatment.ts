import { sameCanonicalValue } from './canonical-value.js';
import { M1_CLOCK_MAX_EVENTS, M1_CLOCK_STEP_SECONDS,
  M1_CLOCK_END_SECONDS, startM1Clock, type M1PrematchInput }
  from './m1-clock.js';
import { isPlainJsonTree } from './plain-json-tree.js';
import { SeededRng, RNG_VERSION } from './rng.js';
import type { M1V7TemporaryMedicalAction }
  from './m1-v7-temporary-medical.js';
import { simulateM1V23RefereeWithTreatment,
  type M1V23RefereeRun } from './m1-v23-referee-treatment-source.js';

/**
 * Isolated v23: generated referee foul windows may include synthetic
 * temporary off-field treatment. The ONE v8 physical-XI source replay
 * excludes absent players before later shooter and foul selection.
 * Assessed injury/medical/referee authority remains unverified.
 */
export const M1_V23_COACH_SCHEMA = 1 as const;
export const M1_V23_COACH_RULES =
  'ifab-2026-27-internal-foul-temporary-treatment-subset' as const;
export const M1_V23_COACH_DOMAIN_SALT = 0x7f4a7c15 as const;
export const M1_V23_TREATMENT_DOMAIN_SALT = 0x5b33ab2d as const;
const CONDITIONAL_TREATMENT_TRIGGER = 0.28;
const TREATMENT_DRAWS_PER_PHASE = 3 as const;
const FOUL_TRIGGER = 0.2;
const DIRECT_RED_TRIGGER = 0.06;
const SUSPECTED_INJURY_TRIGGER = 0.03;
const REFEREE_DRAWS_PER_PHASE = 5 as const;
const MAX_PREMATCH_BYTES = 10_000_000;
type Side = 'home' | 'away';
type Sanction = 'caution' | 'direct-red' | 'injury-withdrawal';
export interface M1V23GeneratedIncident {
  readonly id: string;
  readonly decisionId: string;
  readonly sourceEventId: string;
  readonly elapsedSeconds: number;
  readonly teamId: string;
  readonly playerId: string;
  readonly offence: 'reckless-challenge' | 'serious-foul-play' |
    'suspected-noncontact-injury';
  readonly sanction: Sanction;
}
export type M1V23CoachError = 'INVALID_SOURCE' |
  'INVALID_HALF_TIME_COMMANDS' | 'INVALID_INPLAY_COMMANDS' |
  'NO_GENERATED_FOUL_STOPPAGE' | 'SOURCE_MATCH_REJECTED' |
  'REFEREE_REPLAY_MISMATCH';
export type M1V23CoachRun =
  | Readonly<{ ok: false; error: M1V23CoachError }>
  | Readonly<{
    ok: true;
    schemaVersion: typeof M1_V23_COACH_SCHEMA;
    rulesId: typeof M1_V23_COACH_RULES;
    status: 'INTERNAL_FOUL_TREATMENT_NOT_CALIBRATED';
    fixtureId: string;
    rngAlgorithmVersion: typeof RNG_VERSION;
    refereeRngSeed: number;
    refereeRngState: number;
    refereeRngDraws: number;
    generatedIncidents: readonly M1V23GeneratedIncident[];
    acceptedHalfTimeCommands: number;
    acceptedInPlayCommands: number;
    syntheticTreatmentActions: readonly M1V7TemporaryMedicalAction[];
    syntheticTemporaryExitCount: number;
    syntheticTemporaryReturnCount: number;
    treatmentRngSeed: number;
    treatmentRngState: number;
    treatmentRngDraws: number;
    match: Extract<M1V23RefereeRun, { ok: true }>;
    inGameRefereeGenerated: true;
    externalRefereeAuthorityAuthenticated: false;
    syntheticFoulRatesCalibrated: false;
    specialGoalsGenerated: false;
    syntheticInjuryWithdrawalsGenerated: true;
    injuryDiagnosisAndRecoverySupported: false;
    syntheticTemporaryTreatmentSupported: true;
    externalMedicalAuthorityAuthenticated: false;
    halfTimeMedicalExceptionSupported: false;
    inPlayCoachingAtGeneratedFoulSupported: true;
    lateEntrySupported: false;
    arbitraryRestartSupported: false;
  }>;
const fail = (error: M1V23CoachError):
  M1V23CoachRun => ({ ok: false, error });
const isAction = (v: unknown): v is Record<string, unknown> =>
  v !== null && typeof v === 'object' && !Array.isArray(v);

/**
 * A separate, labelled deterministic RNG domain prevents cards/withdrawals
 * from consuming or shifting v8's five open-play draws per checkpoint.
 * These are TWO independent substreams of ONE causally evaluated match,
 * never separately calculated matches or concatenated results.
 */
export function simulateM1V23TemporaryTreatment(
  prematch: unknown, policy: unknown, halfTimeCommands: unknown = [],
  inPlayCommands: unknown = [],
): M1V23CoachRun {
  if (!isPlainJsonTree(prematch) || !isPlainJsonTree(policy) ||
      !isPlainJsonTree(halfTimeCommands) ||
      !isPlainJsonTree(inPlayCommands)) {
    return fail('INVALID_SOURCE');
  }
  let input: M1PrematchInput;
  let requested: unknown;
  let additional: unknown;
  try {
    const encoded = JSON.stringify(prematch);
    const commandText = JSON.stringify(halfTimeCommands);
    const inPlayText = JSON.stringify(inPlayCommands);
    if (encoded.length > MAX_PREMATCH_BYTES ||
        commandText.length > 1_000_000 || inPlayText.length > 1_000_000) {
      return fail('INVALID_SOURCE');
    }
    input = JSON.parse(encoded) as M1PrematchInput;
    requested = JSON.parse(commandText) as unknown;
    additional = JSON.parse(inPlayText) as unknown;
  } catch {
    return fail('INVALID_SOURCE');
  }
  const gate = startM1Clock(input);
  if (!gate.ok) return fail('INVALID_SOURCE');
  if (!Array.isArray(requested) || requested.length > 10 ||
      requested.some(a => !isAction(a) ||
        a.kind !== 'substitute-normal' ||
        a.elapsedSeconds !== 2700 || a.stoppage !== 'half-time')) {
    return fail('INVALID_HALF_TIME_COMMANDS');
  }
  if (!Array.isArray(additional) || additional.length > 10 ||
      additional.some(a => !isAction(a) ||
        a.kind !== 'substitute-normal' ||
        typeof a.elapsedSeconds !== 'number' ||
        !Number.isSafeInteger(a.elapsedSeconds) ||
        a.elapsedSeconds <= 0 ||
        a.elapsedSeconds >= M1_CLOCK_END_SECONDS ||
        a.elapsedSeconds === 2700 ||
        a.elapsedSeconds % M1_CLOCK_STEP_SECONDS !== 0 ||
        a.stoppage !== 'referee-authorized')) {
    return fail('INVALID_INPLAY_COMMANDS');
  }
  const extraByTime = new Map<number, Record<string, unknown>[]>();
  for (const a of additional as Record<string, unknown>[]) {
    const second = a.elapsedSeconds as number;
    const list = extraByTime.get(second) ?? [];
    list.push(a);
    extraByTime.set(second, list);
  }
  const seed = ((gate.state.rngSeed ^ M1_V23_COACH_DOMAIN_SALT) >>> 0)
    || 0x9e3779b9;
  const rng = new SeededRng(seed);
  const treatmentSeed = (
    (gate.state.rngSeed ^ M1_V23_TREATMENT_DOMAIN_SALT) >>> 0
  ) || 0x9e3779b9;
  const treatmentRng = new SeededRng(treatmentSeed);
  const clubIds = {
    home: input.fixture.homeClubId, away: input.fixture.awayClubId,
  };
  const players = new Map(input.catalog.players.map(p =>
    [p.id, p.primaryPosition]));
  const active = {
    home: new Set(input.homeLineup.starters),
    away: new Set(input.awayLineup.starters),
  };
  // At most one ordinary outfield assessment at any running checkpoint.
  let pending: {side: Side; playerId: string; returnAt: number} | null = null;
  const treatment: M1V7TemporaryMedicalAction[] = [];
  let treatmentExits = 0;
  let treatmentReturns = 0;
  function completeDueReturn(second: number, phase: number): void {
    if (pending === null || pending.returnAt !== second) return;
    const action: M1V7TemporaryMedicalAction = {
      schemaVersion: 1, id: 'm1-v23-return-' + (phase + 1),
      fixtureId: input.fixture.id, teamId: clubIds[pending.side],
      playerId: pending.playerId, elapsedSeconds: second,
      kind: 'treatment-return', returnContext: 'running-clock',
      ballInPlay: true, entryBoundary: 'touchline',
      refereeSignalId: 'm1-v23-unverified-synthetic-signal',
    };
    treatment.push(action);
    active[pending.side].add(pending.playerId);
    pending = null;
    treatmentReturns++;
  }
  const cautions = new Set<string>();
  const commands: unknown[] = [];
  const incidents: Omit<M1V23GeneratedIncident, 'sourceEventId'>[] = [];
  const foulTimes: number[] = [];
  let acceptedInPlayCommands = 0;
  for (let phase = 0; phase < M1_CLOCK_MAX_EVENTS; phase++) {
    const second = phase * M1_CLOCK_STEP_SECONDS;
    // Fixed draw budget even if there is no offence or an ineligible team.
    const trigger = rng.nextFloat();
    const teamDraw = rng.nextFloat();
    const playerDraw = rng.nextFloat();
    const severity = rng.nextFloat();
    const injuryTrigger = rng.nextFloat();
    // Independent, fixed-budget exploratory medical random substream.
    const treatmentRoll = treatmentRng.nextFloat();
    const treatmentTeamRoll = treatmentRng.nextFloat();
    const treatmentPlayerRoll = treatmentRng.nextFloat();
    if (second === 2700) {
      // The one approved coach checkpoint is applied BEFORE all later
      // generated sanctions and shots. v17/v8 still performs full team,
      // actor, bench, foreigner and five-substitution admission.
      for (const action of requested as Record<string, unknown>[]) {
        const side: Side | null = action.teamId === clubIds.home ? 'home' :
          action.teamId === clubIds.away ? 'away' : null;
        const leaving = action.outPlayerId;
        const entering = action.inPlayerId;
        if (!side || typeof leaving !== 'string' ||
            typeof entering !== 'string' ||
            !active[side].has(leaving) || active[side].has(entering)) {
          return fail('INVALID_HALF_TIME_COMMANDS');
        }
        active[side].delete(leaving);
        active[side].add(entering);
        commands.push(action);
      }
      completeDueReturn(second, phase);
      continue;
    }
    // No events at kickoff or half-time. Never fabricate physical injury
    // evidence: this is a labelled synthetic withdrawal hypothesis only.
    const injuryIncident = trigger >= FOUL_TRIGGER &&
      injuryTrigger < SUSPECTED_INJURY_TRIGGER;
    if (phase === 0 || second === 2700 ||
        (trigger >= FOUL_TRIGGER && !injuryIncident)) {
      completeDueReturn(second, phase);
      continue;
    }
    const side: Side = teamDraw < 0.5 ? 'home' : 'away';
    const candidates = [...active[side]].filter(id =>
      players.get(id) !== 'GK').sort();
    if (candidates.length === 0) {
      completeDueReturn(second, phase);
      continue;
    }
    const playerId = candidates[Math.floor(playerDraw * candidates.length)]!;
    const kind: Sanction = injuryIncident ? 'injury-withdrawal' :
      severity < DIRECT_RED_TRIGGER && active[side].size > 7 ?
        'direct-red' : 'caution';
    // No kind of irreversible withdrawal may reduce the team below seven.
    if (active[side].size <= 7 &&
        (kind !== 'caution' || cautions.has(playerId))) {
      completeDueReturn(second, phase);
      continue;
    }
    const id = 'm1-v23-ref-' + (phase + 1);
    commands.push({
      schemaVersion: 1, id, fixtureId: input.fixture.id,
      teamId: clubIds[side], playerId, elapsedSeconds: second,
      kind, origin: kind === 'injury-withdrawal' ?
        'trusted-medical' : 'trusted-referee',
    });
    incidents.push({
      id: 'm1-v23-foul-' + (phase + 1), decisionId: id,
      elapsedSeconds: second, teamId: clubIds[side], playerId,
      offence: kind === 'injury-withdrawal' ?
        'suspected-noncontact-injury' : kind === 'direct-red' ?
          'serious-foul-play' : 'reckless-challenge', sanction: kind,
    });
    if (kind !== 'caution' || cautions.has(playerId)) {
      active[side].delete(playerId);
      cautions.delete(playerId);
    } else {
      cautions.add(playerId);
    }
    if (kind !== 'injury-withdrawal') {
      foulTimes.push(second);
      for (const action of extraByTime.get(second) ?? []) {
        const coachSide: Side | null =
          action.teamId === clubIds.home ? 'home' :
          action.teamId === clubIds.away ? 'away' : null;
        const leaving = action.outPlayerId;
        const entering = action.inPlayerId;
        if (!coachSide || typeof leaving !== 'string' ||
            typeof entering !== 'string' ||
            !active[coachSide].has(leaving) ||
            active[coachSide].has(entering)) {
          return fail('INVALID_INPLAY_COMMANDS');
        }
        active[coachSide].delete(leaving);
        active[coachSide].add(entering);
        commands.push(action);
        acceptedInPlayCommands++;
      }
      // A new, medically absent outfielder is selected ONLY at an
      // internally generated foul stoppage. A 300-second absence suffices
      // for the narrow IFAB one-minute post-restart test; this is NOT an
      // observed injury, diagnosis, or real referee instruction.
      if (pending === null &&
          treatmentRoll < CONDITIONAL_TREATMENT_TRIGGER &&
          second !== 2400 && second < 5100) {
        const treatmentSide: Side =
          treatmentTeamRoll < 0.5 ? 'home' : 'away';
        const initialStarters = treatmentSide === 'home' ?
          input.homeLineup.starters : input.awayLineup.starters;
        const eligible = [...active[treatmentSide]]
          .filter(id => players.get(id) !== 'GK' &&
            initialStarters.includes(id)).sort();
        if (active[treatmentSide].size > 7 && eligible.length > 0) {
          const player = eligible[
            Math.floor(treatmentPlayerRoll * eligible.length)]!;
          treatment.push({
            schemaVersion: 1, id: 'm1-v23-exit-' + (phase + 1),
            fixtureId: input.fixture.id, teamId: clubIds[treatmentSide],
            playerId: player, elapsedSeconds: second,
            kind: 'treatment-exit', reason: 'medical-staff-entered',
            restartAtRunningSeconds: second,
          });
          active[treatmentSide].delete(player);
          pending = { side: treatmentSide, playerId: player,
            returnAt: second + M1_CLOCK_STEP_SECONDS };
          treatmentExits++;
        }
      }
    }
    completeDueReturn(second, phase);
  }
  if (acceptedInPlayCommands !== additional.length) {
    return fail('NO_GENERATED_FOUL_STOPPAGE');
  }
  // Source v8 evaluates exactly one match with generated decisions
  // and authenticated-internally stoppage-gated coach substitutions.
  const match = simulateM1V23RefereeWithTreatment(
    input, policy, commands, treatment, 0, 900, foulTimes, 20,
  );
  if (!match.ok) return fail('SOURCE_MATCH_REJECTED');
  const decisions = match.events.filter(e =>
    e.kind === 'caution' || e.kind === 'second-yellow-dismissal' ||
    e.kind === 'straight-red-dismissal' || e.kind === 'injury-withdrawal');
  if (decisions.length !== incidents.length) {
    return fail('REFEREE_REPLAY_MISMATCH');
  }
  const generatedIncidents: M1V23GeneratedIncident[] = [];
  for (let i = 0; i < incidents.length; i++) {
    const incident = incidents[i]!;
    const event = decisions[i]!;
    if (event.runningSeconds !== incident.elapsedSeconds ||
        event.teamId !== incident.teamId ||
        event.playerId !== incident.playerId ||
        (event.kind === 'straight-red-dismissal') !==
          (incident.sanction === 'direct-red') ||
        (event.kind === 'injury-withdrawal') !==
          (incident.sanction === 'injury-withdrawal')) {
      return fail('REFEREE_REPLAY_MISMATCH');
    }
    generatedIncidents.push({ ...incident, sourceEventId: event.id });
  }
  return {
    ok: true, schemaVersion: M1_V23_COACH_SCHEMA,
    rulesId: M1_V23_COACH_RULES,
    status: 'INTERNAL_FOUL_TREATMENT_NOT_CALIBRATED',
    fixtureId: input.fixture.id, rngAlgorithmVersion: RNG_VERSION,
    refereeRngSeed: seed, refereeRngState: rng.snapshot(),
    refereeRngDraws: M1_CLOCK_MAX_EVENTS * REFEREE_DRAWS_PER_PHASE,
    generatedIncidents, acceptedHalfTimeCommands: requested.length,
    acceptedInPlayCommands,
    syntheticTreatmentActions: treatment,
    syntheticTemporaryExitCount: treatmentExits,
    syntheticTemporaryReturnCount: treatmentReturns,
    treatmentRngSeed: treatmentSeed,
    treatmentRngState: treatmentRng.snapshot(),
    treatmentRngDraws: M1_CLOCK_MAX_EVENTS * TREATMENT_DRAWS_PER_PHASE,
    match, inGameRefereeGenerated: true,
    externalRefereeAuthorityAuthenticated: false,
    syntheticFoulRatesCalibrated: false,
    specialGoalsGenerated: false,syntheticInjuryWithdrawalsGenerated: true,
    injuryDiagnosisAndRecoverySupported: false,
    syntheticTemporaryTreatmentSupported: true,
    externalMedicalAuthorityAuthenticated: false,
    halfTimeMedicalExceptionSupported: false,
    inPlayCoachingAtGeneratedFoulSupported: true,
    lateEntrySupported: false,
    arbitraryRestartSupported: false,
  };
}
export function verifyM1V23TemporaryTreatment(
  prematch: unknown, policy: unknown, halfTimeCommands: unknown,
  inPlayCommands: unknown, candidate: unknown,
): boolean {
  if (!isPlainJsonTree(candidate)) return false;
  const replay = simulateM1V23TemporaryTreatment(
    prematch, policy, halfTimeCommands, inPlayCommands);
  return replay.ok && sameCanonicalValue(replay, candidate);
}
