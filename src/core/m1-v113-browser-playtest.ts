import { generateDoubleRoundRobin, type Fixture } from './fixtures.js';
import { MATCH_LEDGER_VERSION, M0_RULES_PACK_ID, M0_RULES_PACK_VERSION } from './match-contracts.js';
import { M1_ENGINE_VERSION, type M1PrematchInput } from './m1-clock.js';
import { validateM1V8MatchJournal, applyM1V8MatchResult,
  M1_V8_APPLY_SCHEMA_VERSION, type M1V8MatchJournal }
  from './m1-v8-result-journal.js';
import { simulateM1V8MedicalPhases, type M1V8Result }
  from './m1-v8-medical-phases.js';
import { selectM1V96EligibleRegisteredLineup }
  from './m1-v96-cap-safe-lineup.js';
import { RNG_VERSION } from './rng.js';
import type { MatchRosterRules } from './model.js';
import type { InitialCareerSave } from './save.js';
import { defaultTacticalPlan } from './tactics.js';

/**
 * A browser-only synthetic playtest. Deliberately does not authenticate official
 * referee/medical evidence, settle disciplinary rulings or mutate the M0 save.
 */
export const M1_V113_PLAYTEST_SCHEMA = 1 as const;
export type M1V113Scenario = 'ordinary' | 'temporary-treatment' |
  'normal-substitution' | 'combined';
const RULES: MatchRosterRules = {
  starterCount: 11, maxBench: 12, maxForeignersOnField: 7,
};
const POLICY = {
  home: { assignedActor: { kind: 'player' }, availableStaffIds: [] },
  away: { assignedActor: { kind: 'player' }, availableStaffIds: [] },
};
export interface M1V113PlaytestRequest {
  readonly schemaVersion: typeof M1_V8_APPLY_SCHEMA_VERSION;
  readonly commandId: string;
  readonly careerId: string;
  readonly expectedRevision: number;
  readonly prematch: M1PrematchInput;
  readonly policy: typeof POLICY;
  readonly plannedCommands: readonly unknown[];
  readonly trustedDecisions: readonly unknown[];
  readonly medicalActions: readonly unknown[];
  readonly result: M1V8Result;
}
export type M1V113Playtest =
  | Readonly<{ ok: false; error: 'INVALID_JOURNAL' | 'INVALID_SCENARIO' |
      'UNRESOLVED_MEDICAL_OR_DISCIPLINE' | 'NO_LEGAL_LINEUP' |
      'INVALID_SIMULATION' | 'SOURCE_REPLAY_REJECTED' }>
  | Readonly<{ ok: true; schemaVersion: typeof M1_V113_PLAYTEST_SCHEMA;
      status: 'SYNTHETIC_LOCAL_PLAYTEST_NOT_OFFICIAL_CAREER';
      fixture: Fixture; request: M1V113PlaytestRequest;
      remainingControlledClubFixtures: number }>;

function deriveSeed(base: number, fixtureId: string): number {
  let value = base >>> 0;
  for (const character of fixtureId) {
    value = Math.imul(value ^ character.charCodeAt(0), 16777619) >>> 0;
  }
  return value || 1;
}

export function prepareM1V113PlayableMatch(
  initial: InitialCareerSave, prior: M1V8MatchJournal,
  scenario: M1V113Scenario,
): M1V113Playtest | null {
  if (!['ordinary', 'temporary-treatment', 'normal-substitution', 'combined']
    .includes(scenario)) return { ok: false, error: 'INVALID_SCENARIO' };
  const checked = validateM1V8MatchJournal(initial, prior);
  if (!checked.ok) return { ok: false, error: 'INVALID_JOURNAL' };
  const journal = checked.journal;
  const played = new Set(journal.results.map(entry => entry.fixtureId));
  const remaining = generateDoubleRoundRobin(initial.catalog.clubs.map(c => c.id))
    .flatMap(round => round.fixtures)
    .filter(f => (f.homeClubId === initial.selectedClubId ||
      f.awayClubId === initial.selectedClubId) && !played.has(f.id));
  const fixture = remaining[0];
  if (!fixture) return null;

  // No implicit recovery or automatic ban clearance. Any prior unresolved
  // medical withdrawal or dismissal must be routed through P3 authority.
  if (journal.results.some(entry =>
    [entry.dossier.teams.home, entry.dossier.teams.away]
      .some(team => (team.teamId === fixture.homeClubId ||
        team.teamId === fixture.awayClubId) &&
        (team.permanentMedicalWithdrawals > 0 || team.dismissals > 0)))) {
    return { ok: false, error: 'UNRESOLVED_MEDICAL_OR_DISCIPLINE' };
  }

  const clubs = new Map(initial.catalog.clubs.map(c => [c.id, c]));
  const players = new Map(initial.catalog.players.map(p => [p.id, p]));
  const home = clubs.get(fixture.homeClubId), away = clubs.get(fixture.awayClubId);
  if (!home || !away) return { ok: false, error: 'NO_LEGAL_LINEUP' };
  const homeLineup = selectM1V96EligibleRegisteredLineup(home, players,
    new Set<string>(), RULES);
  const awayLineup = selectM1V96EligibleRegisteredLineup(away, players,
    new Set<string>(), RULES);
  if (!homeLineup || !awayLineup) return { ok: false, error: 'NO_LEGAL_LINEUP' };
  const prematch: M1PrematchInput = {
    schemaVersion: MATCH_LEDGER_VERSION, engineVersion: M1_ENGINE_VERSION,
    rulesPackId: M0_RULES_PACK_ID, rulesPackVersion: M0_RULES_PACK_VERSION,
    fixture, catalog: initial.catalog, homeLineup, awayLineup,
    homeTactics: defaultTacticalPlan(fixture.homeClubId),
    awayTactics: defaultTacticalPlan(fixture.awayClubId),
    rosterRules: RULES, rngAlgorithmVersion: RNG_VERSION,
    rngSeed: deriveSeed(initial.rngState, fixture.id),
  };
  const ownSide = fixture.homeClubId === initial.selectedClubId ? 'home' : 'away';
  const ownLineup = ownSide === 'home' ? homeLineup : awayLineup;
  const outfield = ownLineup.starters.filter(id =>
    players.get(id)?.primaryPosition !== 'GK');
  const treatmentPlayer = outfield[0], substitutedPlayer = outfield[1];
  const replacement = ownLineup.bench.find(id =>
    players.get(id)?.primaryPosition !== 'GK');
  if (!treatmentPlayer || !substitutedPlayer || !replacement) {
    return { ok: false, error: 'NO_LEGAL_LINEUP' };
  }

  const plannedCommands: unknown[] = [];
  const medicalActions: unknown[] = [];
  if (scenario === 'temporary-treatment' || scenario === 'combined') {
    medicalActions.push({
      schemaVersion: 1, id: 'v113-exit-' + fixture.id,
      fixtureId: fixture.id, teamId: initial.selectedClubId,
      playerId: treatmentPlayer, elapsedSeconds: 0,
      kind: 'treatment-exit', reason: 'medical-staff-entered',
      restartAtRunningSeconds: 15,
    }, {
      schemaVersion: 1, id: 'v113-return-' + fixture.id,
      fixtureId: fixture.id, teamId: initial.selectedClubId,
      playerId: treatmentPlayer, elapsedSeconds: 300,
      kind: 'treatment-return', returnContext: 'running-clock',
      ballInPlay: true, entryBoundary: 'touchline',
      refereeSignalId: 'v113-virtual-referee-' + fixture.id,
    });
  }
  if (scenario === 'normal-substitution' || scenario === 'combined') {
    plannedCommands.push({
      schemaVersion: 1, commandId: 'v113-sub-' + fixture.id,
      fixtureId: fixture.id, teamId: initial.selectedClubId,
      elapsedSeconds: 300, kind: 'substitute-normal',
      actor: { kind: 'player' }, stoppage: 'referee-authorized',
      outPlayerId: substitutedPlayer, inPlayerId: replacement,
    });
  }
  const result = simulateM1V8MedicalPhases(
    prematch, POLICY, plannedCommands, [], medicalActions);
  if (!result.ok) return { ok: false, error: 'INVALID_SIMULATION' };
  const request: M1V113PlaytestRequest = {
    schemaVersion: M1_V8_APPLY_SCHEMA_VERSION,
    commandId: 'v113-play-' + fixture.id,
    careerId: initial.careerId, expectedRevision: journal.revision,
    prematch, policy: POLICY, plannedCommands,
    trustedDecisions: [], medicalActions, result,
  };
  const checkedRequest = applyM1V8MatchResult(initial, journal, request);
  if (!checkedRequest.ok) return { ok: false, error: 'SOURCE_REPLAY_REJECTED' };
  return {
    ok: true, schemaVersion: M1_V113_PLAYTEST_SCHEMA,
    status: 'SYNTHETIC_LOCAL_PLAYTEST_NOT_OFFICIAL_CAREER',
    fixture, request, remainingControlledClubFixtures: remaining.length,
  };
}
