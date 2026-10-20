import { sameCanonicalValue } from './canonical-value.js';
import { M1_CLOCK_MAX_EVENTS, M1_CLOCK_STEP_SECONDS,
  M1_CLOCK_END_SECONDS, startM1Clock, type M1PrematchInput }
  from './m1-clock.js';
import { isPlainJsonTree } from './plain-json-tree.js';
import { SeededRng, RNG_VERSION } from './rng.js';
import { simulateM1V22RefereeMedicalFoulCoaching,
  type M1V22RefereeRun } from './m1-v22-referee-foul-coaching-source.js';

/**
 * Isolated v20: internally generated cards/withdrawals AND bounded,
 * source-validated halftime manager changes share one v17/v8 match.
 * No caller-supplied referee rulings, arbitrary in-play stoppages or
 * save migration. Rates remain explicitly uncalibrated.
 */
export const M1_V22_COACH_SCHEMA = 1 as const;
export const M1_V22_COACH_RULES =
  'ifab-2026-27-internal-foul-coaching-subset' as const;
export const M1_V22_COACH_DOMAIN_SALT = 0x7f4a7c15 as const;
const FOUL_TRIGGER = 0.2;
const DIRECT_RED_TRIGGER = 0.06;
const SUSPECTED_INJURY_TRIGGER = 0.03;
const REFEREE_DRAWS_PER_PHASE = 5 as const;
const MAX_PREMATCH_BYTES = 10_000_000;
type Side = 'home' | 'away';
type Sanction = 'caution' | 'direct-red' | 'injury-withdrawal';
export interface M1V22GeneratedIncident {
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
export type M1V22CoachError = 'INVALID_SOURCE' |
  'INVALID_HALF_TIME_COMMANDS' | 'INVALID_INPLAY_COMMANDS' |
  'NO_GENERATED_FOUL_STOPPAGE' | 'SOURCE_MATCH_REJECTED' |
  'REFEREE_REPLAY_MISMATCH';
export type M1V22CoachRun =
  | Readonly<{ ok: false; error: M1V22CoachError }>
  | Readonly<{
    ok: true;
    schemaVersion: typeof M1_V22_COACH_SCHEMA;
    rulesId: typeof M1_V22_COACH_RULES;
    status: 'INTERNAL_FOUL_AUTHORIZED_COACHING_NOT_CALIBRATED';
    fixtureId: string;
    rngAlgorithmVersion: typeof RNG_VERSION;
    refereeRngSeed: number;
    refereeRngState: number;
    refereeRngDraws: number;
    generatedIncidents: readonly M1V22GeneratedIncident[];
    acceptedHalfTimeCommands: number;
    acceptedInPlayCommands: number;
    match: Extract<M1V22RefereeRun, { ok: true }>;
    inGameRefereeGenerated: true;
    externalRefereeAuthorityAuthenticated: false;
    syntheticFoulRatesCalibrated: false;
    specialGoalsGenerated: false;
    syntheticInjuryWithdrawalsGenerated: true;
    injuryDiagnosisAndRecoverySupported: false;
    inPlayCoachingAtGeneratedFoulSupported: true;
    lateEntrySupported: false;
    arbitraryRestartSupported: false;
  }>;
const fail = (error: M1V22CoachError):
  M1V22CoachRun => ({ ok: false, error });
const isAction = (v: unknown): v is Record<string, unknown> =>
  v !== null && typeof v === 'object' && !Array.isArray(v);

/**
 * A separate, labelled deterministic RNG domain prevents cards/withdrawals
 * from consuming or shifting v8's five open-play draws per checkpoint.
 * These are TWO independent substreams of ONE causally evaluated match,
 * never separately calculated matches or concatenated results.
 */
export function simulateM1V22FoulStoppageCoaching(
  prematch: unknown, policy: unknown, halfTimeCommands: unknown = [],
  inPlayCommands: unknown = [],
): M1V22CoachRun {
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
  const seed = ((gate.state.rngSeed ^ M1_V22_COACH_DOMAIN_SALT) >>> 0)
    || 0x9e3779b9;
  const rng = new SeededRng(seed);
  const clubIds = {
    home: input.fixture.homeClubId, away: input.fixture.awayClubId,
  };
  const players = new Map(input.catalog.players.map(p =>
    [p.id, p.primaryPosition]));
  const active = {
    home: new Set(input.homeLineup.starters),
    away: new Set(input.awayLineup.starters),
  };
  const cautions = new Set<string>();
  const commands: unknown[] = [];
  const incidents: Omit<M1V22GeneratedIncident, 'sourceEventId'>[] = [];
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
      continue;
    }
    // No events at kickoff or half-time. Never fabricate physical injury
    // evidence: this is a labelled synthetic withdrawal hypothesis only.
    const injuryIncident = trigger >= FOUL_TRIGGER &&
      injuryTrigger < SUSPECTED_INJURY_TRIGGER;
    if (phase === 0 || second === 2700 ||
        (trigger >= FOUL_TRIGGER && !injuryIncident)) continue;
    const side: Side = teamDraw < 0.5 ? 'home' : 'away';
    const candidates = [...active[side]].filter(id =>
      players.get(id) !== 'GK').sort();
    if (candidates.length === 0) continue;
    const playerId = candidates[Math.floor(playerDraw * candidates.length)]!;
    const kind: Sanction = injuryIncident ? 'injury-withdrawal' :
      severity < DIRECT_RED_TRIGGER && active[side].size > 7 ?
        'direct-red' : 'caution';
    // No kind of irreversible withdrawal may reduce the team below seven.
    if (active[side].size <= 7 &&
        (kind !== 'caution' || cautions.has(playerId))) continue;
    const id = 'm1-v22-ref-' + (phase + 1);
    commands.push({
      schemaVersion: 1, id, fixtureId: input.fixture.id,
      teamId: clubIds[side], playerId, elapsedSeconds: second,
      kind, origin: kind === 'injury-withdrawal' ?
        'trusted-medical' : 'trusted-referee',
    });
    incidents.push({
      id: 'm1-v22-foul-' + (phase + 1), decisionId: id,
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
  }
  // Only ONE source v8 match is evaluated, inside v17. There is no
  // independent baseline used for goals, RNG or participant attribution.
  const match = simulateM1V22RefereeMedicalFoulCoaching(
    input, policy, commands, [], 0, 900,
  );
  if (!match.ok) return fail('SOURCE_MATCH_REJECTED');
  const decisions = match.events.filter(e =>
    e.kind === 'caution' || e.kind === 'second-yellow-dismissal' ||
    e.kind === 'straight-red-dismissal' || e.kind === 'injury-withdrawal');
  if (decisions.length !== incidents.length) {
    return fail('REFEREE_REPLAY_MISMATCH');
  }
  const generatedIncidents: M1V22GeneratedIncident[] = [];
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
    ok: true, schemaVersion: M1_V22_COACH_SCHEMA,
    rulesId: M1_V22_COACH_RULES,
    status: 'INTERNAL_FOUL_AUTHORIZED_COACHING_NOT_CALIBRATED',
    fixtureId: input.fixture.id, rngAlgorithmVersion: RNG_VERSION,
    refereeRngSeed: seed, refereeRngState: rng.snapshot(),
    refereeRngDraws: M1_CLOCK_MAX_EVENTS * REFEREE_DRAWS_PER_PHASE,
    generatedIncidents, acceptedHalfTimeCommands: requested.length,
    match, inGameRefereeGenerated: true,
    externalRefereeAuthorityAuthenticated: false,
    syntheticFoulRatesCalibrated: false,
    specialGoalsGenerated: false,syntheticInjuryWithdrawalsGenerated: true,
    injuryDiagnosisAndRecoverySupported: false,
    inPlayCoachingAndLateEntrySupported: false,
    arbitraryRestartSupported: false,
  };
}
export function verifyM1V22FoulStoppageCoaching(
  prematch: unknown, policy: unknown, halfTimeCommands: unknown,
  candidate: unknown,
): boolean {
  if (!isPlainJsonTree(candidate)) return false;
  const replay = simulateM1V22FoulStoppageCoaching(
    prematch, policy, halfTimeCommands);
  return replay.ok && sameCanonicalValue(replay, candidate);
}
