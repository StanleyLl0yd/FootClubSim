import { sameCanonicalValue } from './canonical-value.js';
import type { M1PrematchInput } from './m1-clock.js';
import { projectM1V8GoalAttributionFromVerifiedReplay,
  M1_V8_GOAL_ATTRIBUTION_SCHEMA_VERSION,
  type M1V8GoalAttribution, type M1V8PlayerStats }
  from './m1-v8-goal-attribution.js';
import { projectM1V8PhasePresenceFromVerifiedReplay,
  M1_V8_PHASE_PRESENCE_SCHEMA_VERSION, type M1V8PhasePlayer }
  from './m1-v8-phase-presence.js';
import { M1_V8_ENGINE_VERSION, M1_V8_EVENT_SCHEMA_VERSION,
  simulateM1V8MedicalPhases, type M1V8Result } from './m1-v8-medical-phases.js';

/** Read-only composite v8 match dossier; not a legally final match sheet. */
export const M1_V8_MATCH_DOSSIER_SCHEMA_VERSION = 1 as const;
export interface M1V8DossierPlayer extends M1V8PlayerStats {
  readonly benchNamed: boolean;
  readonly registeredPhaseSeconds: M1V8PhasePlayer['registeredPhaseSeconds'];
  readonly physicalPhaseSeconds: M1V8PhasePlayer['physicalPhaseSeconds'];
  readonly temporarilyAbsentPhaseSeconds:
    M1V8PhasePlayer['temporarilyAbsentPhaseSeconds'];
  readonly yellowCards: number;
  readonly dismissal: 'second-yellow' | 'straight-red' | null;
  readonly permanentlyMedicallyWithdrawn: boolean;
}
export interface M1V8DossierTeam {
  readonly teamId: string;
  /** All original XI and matchday substitutes, including unused bench. */
  readonly starters: readonly string[];
  readonly benchNamed: readonly string[];
  readonly namedPlayerIds: readonly string[];
  readonly participants: readonly string[];
  readonly unusedBench: readonly string[];
  readonly physicallyOnFieldAtFullTime: readonly string[];
  readonly temporarilyOffFieldAtFullTime: readonly string[];
  readonly yellowCards: number;
  readonly dismissals: number;
  readonly permanentMedicalWithdrawals: number;
}
export interface M1V8MatchDossier {
  readonly schemaVersion: typeof M1_V8_MATCH_DOSSIER_SCHEMA_VERSION;
  readonly engineVersion: typeof M1_V8_ENGINE_VERSION;
  readonly eventSchemaVersion: typeof M1_V8_EVENT_SCHEMA_VERSION;
  readonly scorerSchemaVersion: typeof M1_V8_GOAL_ATTRIBUTION_SCHEMA_VERSION;
  readonly physicalPresenceSchemaVersion:
    typeof M1_V8_PHASE_PRESENCE_SCHEMA_VERSION;
  readonly status: 'SYNTHETIC_V8_UNAUTHENTICATED_MATCH_DOSSIER_NO_CAREER_POSTING';
  readonly fixtureId: string;
  readonly match: M1V8Result['report'];
  readonly goalAttributions: M1V8GoalAttribution['goals'];
  readonly players: readonly M1V8DossierPlayer[];
  readonly teams: Readonly<{ home: M1V8DossierTeam; away: M1V8DossierTeam }>;
}
export type M1V8DossierResult =
  | Readonly<{ ok: true; dossier: M1V8MatchDossier }>
  | Readonly<{ ok: false; error: 'INVALID_MATCH_SOURCE' | 'INTERNAL_INVARIANT' }>;
type Mutable = { -readonly [K in keyof M1V8DossierPlayer]: M1V8DossierPlayer[K] };
const invariant = { ok: false, error: 'INTERNAL_INVARIANT' } as const;

/**
 * Compose two independently calculated projections from ONE already
 * replay-matched v8 candidate. Never trust a claimed score, scorer,
 * lineup, bench or discipline row without its exact source inputs.
 * The legal provenance and completeness of referee facts are external.
 */
export function deriveM1VerifiedV8MatchDossier(
  prematch: unknown, policy: unknown, commands: unknown,
  decisions: unknown, medical: unknown, candidate: unknown,
): M1V8DossierResult {
  const replay = simulateM1V8MedicalPhases(
    prematch, policy, commands, decisions, medical,
  );
  if (!replay.ok || !sameCanonicalValue(replay, candidate)) {
    return { ok: false, error: 'INVALID_MATCH_SOURCE' };
  }
  return projectM1V8MatchDossierFromVerifiedReplay(
    prematch as M1PrematchInput, replay,
  );
}

/**
 * Internal projection: the caller must already have verified this exact replay.
 * Never use this entrypoint to admit untrusted results or stored journals.
 */
export function projectM1V8MatchDossierFromVerifiedReplay(
  input: M1PrematchInput, replay: M1V8Result,
): M1V8DossierResult {
  const attributed = projectM1V8GoalAttributionFromVerifiedReplay(input, replay);
  const physical = projectM1V8PhasePresenceFromVerifiedReplay(input, replay);
  if (!attributed.ok || !physical.ok) {
    return { ok: false, error: 'INVALID_MATCH_SOURCE' };
  }
  const match = replay;
  const byPresence = new Map(physical.report.players.map(p => [p.playerId, p]));
  const rows = new Map<string, Mutable>();
  const namedHome = [...input.homeLineup.starters, ...input.homeLineup.bench];
  const namedAway = [...input.awayLineup.starters, ...input.awayLineup.bench];
  const homeId = input.fixture.homeClubId, awayId = input.fixture.awayClubId;
  const named = new Set([...namedHome, ...namedAway]);
  if (named.size !== namedHome.length + namedAway.length) return invariant;
  for (const score of attributed.report.players) {
    const part = byPresence.get(score.playerId);
    if (!part || !named.has(score.playerId) ||
        part.teamId !== score.teamId || part.started !== score.started ||
        rows.has(score.playerId)) return invariant;
    const benchNamed = score.teamId === homeId ?
      input.homeLineup.bench.includes(score.playerId) :
      score.teamId === awayId ? input.awayLineup.bench.includes(score.playerId) :
        null;
    if (benchNamed === null) return invariant;
    rows.set(score.playerId, {
      ...score, benchNamed,
      registeredPhaseSeconds: part.registeredPhaseSeconds,
      physicalPhaseSeconds: part.physicalPhaseSeconds,
      temporarilyAbsentPhaseSeconds: part.temporarilyAbsentPhaseSeconds,
      yellowCards: 0, dismissal: null, permanentlyMedicallyWithdrawn: false,
    });
  }
  if (rows.size !== physical.report.players.length) return invariant;
  for (const event of match.events) {
    if (event.type !== 'availability') continue;
    const entry = event.source.entry;
    const action = entry.action;
    if (action.kind === 'substitute-normal') continue;
    const row = rows.get(action.playerId);
    if (!row || row.teamId !== action.teamId) return invariant;
    switch (entry.effect) {
      case 'yellow':
        row.yellowCards++;
        break;
      case 'second-yellow-red':
        row.yellowCards++;
        if (row.dismissal !== null) return invariant;
        row.dismissal = 'second-yellow';
        break;
      case 'straight-red':
        if (row.dismissal !== null) return invariant;
        row.dismissal = 'straight-red';
        break;
      case 'injury-withdrawn':
        row.permanentlyMedicallyWithdrawn = true;
        break;
      default:
        return invariant;
    }
  }
  function team(side: 'home' | 'away'): M1V8DossierTeam | null {
    const clubId = side === 'home' ? homeId : awayId;
    const lineup = side === 'home' ? input.homeLineup : input.awayLineup;
    const listed = side === 'home' ? namedHome : namedAway;
    const group = [...rows.values()].filter(p => p.teamId === clubId);
    const participants = group.map(p => p.playerId);
    const unusedBench = lineup.bench.filter(id => !participants.includes(id));
    const physicalFinish = match.onFieldAtFullTime[side];
    const absentFinish = match.offFieldAtFullTime.filter(id =>
      participants.includes(id));
    if (!physicalFinish.every(id => participants.includes(id)) ||
        !absentFinish.every(id => participants.includes(id)) ||
        !sameCanonicalValue(
          [...physicalFinish, ...absentFinish].sort(),
          [...new Set([...physicalFinish, ...absentFinish])].sort(),
        )) return null;
    return {
      teamId: clubId,
      starters: [...lineup.starters], benchNamed: [...lineup.bench],
      namedPlayerIds: listed,
      participants, unusedBench,
      physicallyOnFieldAtFullTime: physicalFinish,
      temporarilyOffFieldAtFullTime: absentFinish,
      yellowCards: group.reduce((n, p) => n + p.yellowCards, 0),
      dismissals: group.filter(p => p.dismissal !== null).length,
      permanentMedicalWithdrawals:
        group.filter(p => p.permanentlyMedicallyWithdrawn).length,
    };
  }
  const home = team('home'), away = team('away');
  if (!home || !away ||
      !sameCanonicalValue(attributed.report.match, match.report) ||
      !sameCanonicalValue(physical.report.onFieldAtFullTime,
        match.onFieldAtFullTime) ||
      !sameCanonicalValue(physical.report.offFieldAtFullTime,
        match.offFieldAtFullTime)) return invariant;
  return { ok: true, dossier: {
    schemaVersion: M1_V8_MATCH_DOSSIER_SCHEMA_VERSION,
    engineVersion: M1_V8_ENGINE_VERSION,
    eventSchemaVersion: M1_V8_EVENT_SCHEMA_VERSION,
    scorerSchemaVersion: M1_V8_GOAL_ATTRIBUTION_SCHEMA_VERSION,
    physicalPresenceSchemaVersion: M1_V8_PHASE_PRESENCE_SCHEMA_VERSION,
    status: 'SYNTHETIC_V8_UNAUTHENTICATED_MATCH_DOSSIER_NO_CAREER_POSTING',
    fixtureId: input.fixture.id, match: match.report,
    goalAttributions: attributed.report.goals,
    players: [...rows.values()],
    teams: { home, away },
  } };
}

/** Independently rebuild against an unchanged trusted source and seed. */
export function verifyM1V8MatchDossier(
  prematch: unknown, policy: unknown, commands: unknown,
  decisions: unknown, medical: unknown, match: unknown, dossier: unknown,
): boolean {
  const derived = deriveM1VerifiedV8MatchDossier(
    prematch, policy, commands, decisions, medical, match,
  );
  return derived.ok && sameCanonicalValue(derived.dossier, dossier);
}
