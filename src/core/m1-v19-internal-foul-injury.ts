import { sameCanonicalValue } from './canonical-value.js';
import { M1_CLOCK_MAX_EVENTS, M1_CLOCK_STEP_SECONDS,
  startM1Clock, type M1PrematchInput } from './m1-clock.js';
import { isPlainJsonTree } from './plain-json-tree.js';
import { SeededRng, RNG_VERSION } from './rng.js';
import { simulateM1V17RefereeMedicalGoalAndHalfTime,
  type M1V17RefereeRun } from './m1-v17-referee-medical-goal-halftime.js';

/**
 * Isolated internal foul/card and non-diagnostic injury-withdrawal prototype.
 * Frequencies are uncalibrated engineering placeholders; player availability,
 * goals and shots are produced by one physical-XI v17/v8 source replay.
 * No external referee or medical claims can be supplied here.
 */
export const M1_V19_REFEREE_SCHEMA = 1 as const;
export const M1_V19_REFEREE_RULES =
  'ifab-2026-27-internal-foul-injury-withdrawal-prototype' as const;
export const M1_V19_REFEREE_DOMAIN_SALT = 0x7f4a7c15 as const;
const FOUL_TRIGGER = 0.2;
const DIRECT_RED_TRIGGER = 0.06;
const SUSPECTED_INJURY_TRIGGER = 0.03;
const REFEREE_DRAWS_PER_PHASE = 5 as const;
const MAX_PREMATCH_BYTES = 10_000_000;
type Side = 'home' | 'away';
type Sanction = 'caution' | 'direct-red' | 'injury-withdrawal';
interface RefereeCommand {
  readonly schemaVersion: 1;
  readonly id: string;
  readonly fixtureId: string;
  readonly teamId: string;
  readonly playerId: string;
  readonly elapsedSeconds: number;
  readonly kind: Sanction;
  readonly origin: 'trusted-referee' | 'trusted-medical';
}
export interface M1V19GeneratedIncident {
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
export type M1V19InternalRefereeError = 'INVALID_SOURCE' |
  'SOURCE_MATCH_REJECTED' | 'REFEREE_REPLAY_MISMATCH';
export type M1V19InternalRefereeRun =
  | Readonly<{ ok: false; error: M1V19InternalRefereeError }>
  | Readonly<{
    ok: true;
    schemaVersion: typeof M1_V19_REFEREE_SCHEMA;
    rulesId: typeof M1_V19_REFEREE_RULES;
    status: 'SYNTHETIC_FOUL_INJURY_ENGINE_NOT_CALIBRATED';
    fixtureId: string;
    rngAlgorithmVersion: typeof RNG_VERSION;
    refereeRngSeed: number;
    refereeRngState: number;
    refereeRngDraws: number;
    generatedIncidents: readonly M1V19GeneratedIncident[];
    match: Extract<M1V17RefereeRun, { ok: true }>;
    inGameRefereeGenerated: true;
    externalRefereeAuthorityAuthenticated: false;
    syntheticFoulRatesCalibrated: false;
    specialGoalsGenerated: false;
    syntheticInjuryWithdrawalsGenerated: true;
    injuryDiagnosisAndRecoverySupported: false;
    arbitraryRestartAndLateEntrySupported: false;
  }>;
const fail = (error: M1V19InternalRefereeError):
  M1V19InternalRefereeRun => ({ ok: false, error });

/**
 * A separate, labelled deterministic RNG domain prevents cards/withdrawals
 * from consuming or shifting v8's five open-play draws per checkpoint.
 * These are TWO independent substreams of ONE causally evaluated match,
 * never separately calculated matches or concatenated results.
 */
export function simulateM1V19InternalReferee(
  prematch: unknown, policy: unknown,
): M1V19InternalRefereeRun {
  if (!isPlainJsonTree(prematch) || !isPlainJsonTree(policy)) {
    return fail('INVALID_SOURCE');
  }
  let input: M1PrematchInput;
  try {
    const encoded = JSON.stringify(prematch);
    if (encoded.length > MAX_PREMATCH_BYTES) return fail('INVALID_SOURCE');
    input = JSON.parse(encoded) as M1PrematchInput;
  } catch {
    return fail('INVALID_SOURCE');
  }
  const gate = startM1Clock(input);
  if (!gate.ok) return fail('INVALID_SOURCE');
  const seed = ((gate.state.rngSeed ^ M1_V19_REFEREE_DOMAIN_SALT) >>> 0)
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
  const commands: RefereeCommand[] = [];
  const incidents: Omit<M1V19GeneratedIncident, 'sourceEventId'>[] = [];
  for (let phase = 0; phase < M1_CLOCK_MAX_EVENTS; phase++) {
    const second = phase * M1_CLOCK_STEP_SECONDS;
    // Fixed draw budget even if there is no offence or an ineligible team.
    const trigger = rng.nextFloat();
    const teamDraw = rng.nextFloat();
    const playerDraw = rng.nextFloat();
    const severity = rng.nextFloat();
    const injuryTrigger = rng.nextFloat();
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
    const id = 'm1-v19-ref-' + (phase + 1);
    commands.push({
      schemaVersion: 1, id, fixtureId: input.fixture.id,
      teamId: clubIds[side], playerId, elapsedSeconds: second,
      kind, origin: kind === 'injury-withdrawal' ?
        'trusted-medical' : 'trusted-referee',
    });
    incidents.push({
      id: 'm1-v19-foul-' + (phase + 1), decisionId: id,
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
  const match = simulateM1V17RefereeMedicalGoalAndHalfTime(
    input, policy, commands, [], 0, 900,
  );
  if (!match.ok) return fail('SOURCE_MATCH_REJECTED');
  const decisions = match.events.filter(e =>
    e.kind === 'caution' || e.kind === 'second-yellow-dismissal' ||
    e.kind === 'straight-red-dismissal' || e.kind === 'injury-withdrawal');
  if (decisions.length !== incidents.length) {
    return fail('REFEREE_REPLAY_MISMATCH');
  }
  const generatedIncidents: M1V19GeneratedIncident[] = [];
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
    ok: true, schemaVersion: M1_V19_REFEREE_SCHEMA,
    rulesId: M1_V19_REFEREE_RULES,
    status: 'SYNTHETIC_FOUL_INJURY_ENGINE_NOT_CALIBRATED',
    fixtureId: input.fixture.id, rngAlgorithmVersion: RNG_VERSION,
    refereeRngSeed: seed, refereeRngState: rng.snapshot(),
    refereeRngDraws: M1_CLOCK_MAX_EVENTS * REFEREE_DRAWS_PER_PHASE,
    generatedIncidents, match, inGameRefereeGenerated: true,
    externalRefereeAuthorityAuthenticated: false,
    syntheticFoulRatesCalibrated: false,
    specialGoalsGenerated: false,syntheticInjuryWithdrawalsGenerated: true,
    injuryDiagnosisAndRecoverySupported: false,
    arbitraryRestartAndLateEntrySupported: false,
  };
}
export function verifyM1V19InternalReferee(
  prematch: unknown, policy: unknown, candidate: unknown,
): boolean {
  if (!isPlainJsonTree(candidate)) return false;
  const replay = simulateM1V19InternalReferee(prematch, policy);
  return replay.ok && sameCanonicalValue(replay, candidate);
}
