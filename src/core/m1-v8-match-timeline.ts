import { sameCanonicalValue } from './canonical-value.js';
import { isStableId } from './identifiers.js';
import { simulateM1V8MedicalPhases, type M1V8Event }
  from './m1-v8-medical-phases.js';
import { validateM1V8MatchJournal } from './m1-v8-result-journal.js';
import type { M1V8CreditedGoal } from './m1-v8-goal-attribution.js';
import type { InitialCareerSave } from './save.js';

/**
 * Read-only v8 match event view derived from the replay-verified schema-4
 * source journal. Neither chronology nor referee/medical "origin" strings
 * independently authenticate real-world match facts.
 */
export const M1_V8_MATCH_TIMELINE_SCHEMA_VERSION = 1 as const;
export interface M1V8GoalMoment {
  readonly eventId: string;
  readonly sequence: number;
  readonly elapsedSeconds: number;
  /** Scoring beneficiary club, including when the opponent scores an own goal. */
  readonly scoringClubId: string;
  /** Shooter for normal/penalty goals, opposing defender for own goals. */
  readonly actorPlayerId: string;
  readonly kind: 'open-play' | 'penalty' | 'own-goal';
  readonly scoreAfter: Readonly<{ home: number; away: number }>;
}
export interface M1V8MatchTimeline {
  readonly schemaVersion: typeof M1_V8_MATCH_TIMELINE_SCHEMA_VERSION;
  readonly status: 'SYNTHETIC_V8_REPLAYED_TIMELINE_NO_OFFICIAL_AUTHORITY';
  readonly careerId: string;
  readonly journalRevision: number;
  readonly fixtureId: string;
  readonly round: number;
  readonly homeClubId: string;
  readonly awayClubId: string;
  readonly eventCount: number;
  /** Includes every seeded shot, referee/medical input and full-time event. */
  readonly events: readonly M1V8Event[];
  /** Event-ordered goal history with score AFTER each goal. */
  readonly goals: readonly M1V8GoalMoment[];
  readonly finalScore: Readonly<{ home: number; away: number }>;
}
export type M1V8MatchTimelineResult =
  | Readonly<{ ok: true; timeline: M1V8MatchTimeline }>
  | Readonly<{ ok: false; error:
    'INVALID_JOURNAL' | 'INVALID_FIXTURE' |
    'NOT_COMMITTED' | 'INTERNAL_INVARIANT' }>;
const fail = (error: 'INVALID_JOURNAL' | 'INVALID_FIXTURE' |
  'NOT_COMMITTED' | 'INTERNAL_INVARIANT'): M1V8MatchTimelineResult =>
  ({ ok: false, error });

/**
 * Fully replay-check ALL stored fixture rows before returning the selected
 * fixture's regenerated complete event stream. Never trust a partial prefix
 * as a completed match or accept a client-supplied score/event stream.
 */
export function deriveM1VerifiedV8MatchTimeline(
  initial: unknown, journal: unknown, fixtureId: unknown,
): M1V8MatchTimelineResult {
  if (!isStableId(fixtureId)) return fail('INVALID_FIXTURE');
  const checked = validateM1V8MatchJournal(initial, journal);
  if (!checked.ok) return fail('INVALID_JOURNAL');
  const entry = checked.journal.results.find(row => row.fixtureId === fixtureId);
  if (!entry) return fail('NOT_COMMITTED');
  const original = initial as InitialCareerSave;
  const source = entry.source;
  const prematch = { ...source.prematch, catalog: original.catalog };
  const replay = simulateM1V8MedicalPhases(
    prematch, source.policy, source.plannedCommands,
    source.trustedDecisions, source.medicalActions);
  if (!replay.ok || replay.fixtureId !== entry.fixtureId ||
      replay.events.length !== entry.eventCount ||
      replay.rngSeed !== entry.rngSeed ||
      replay.rngState !== entry.rngState ||
      replay.rngDraws !== entry.rngDraws ||
      !sameCanonicalValue(replay.report, entry.dossier.match)) {
    return fail('INTERNAL_INVARIANT');
  }
  const goals: M1V8GoalMoment[] = [];
  const credits: M1V8CreditedGoal[] = [];
  const score = { home: 0, away: 0 };
  for (let i = 0; i < replay.events.length; i++) {
    const event = replay.events[i]!;
    if (event.sequence !== i + 1) return fail('INTERNAL_INVARIANT');
    let credit: M1V8CreditedGoal | null = null;
    if (event.type === 'shot' && event.outcome === 'goal') {
      credit = { kind: 'open-play', eventId: event.id,
        teamId: event.teamId, scorerId: event.playerId,
        elapsedSeconds: event.elapsedSeconds };
    } else if (event.type === 'adjudication') {
      const decision = event.decision;
      if (decision.kind === 'own-goal') {
        credit = { kind: 'own-goal', eventId: event.id,
          teamId: decision.teamId, defenderId: decision.playerId,
          elapsedSeconds: event.elapsedSeconds };
      } else if (decision.outcome === 'scored') {
        credit = { kind: 'penalty', eventId: event.id,
          teamId: decision.teamId, scorerId: decision.playerId,
          elapsedSeconds: event.elapsedSeconds };
      }
    }
    if (credit === null) continue;
    const homeGoal = credit.teamId === entry.homeClubId;
    if (!homeGoal && credit.teamId !== entry.awayClubId) {
      return fail('INTERNAL_INVARIANT');
    }
    if (homeGoal) score.home++;
    else score.away++;
    credits.push(credit);
    goals.push({
      eventId: credit.eventId, sequence: event.sequence,
      elapsedSeconds: credit.elapsedSeconds,
      scoringClubId: credit.teamId,
      actorPlayerId: credit.kind === 'own-goal' ?
        credit.defenderId : credit.scorerId,
      kind: credit.kind,
      scoreAfter: { ...score },
    });
  }
  if (!sameCanonicalValue(credits, entry.dossier.goalAttributions) ||
      score.home !== replay.report.home.goals ||
      score.away !== replay.report.away.goals) {
    return fail('INTERNAL_INVARIANT');
  }
  return { ok: true, timeline: {
    schemaVersion: M1_V8_MATCH_TIMELINE_SCHEMA_VERSION,
    status: 'SYNTHETIC_V8_REPLAYED_TIMELINE_NO_OFFICIAL_AUTHORITY',
    careerId: checked.journal.careerId,
    journalRevision: checked.journal.revision,
    fixtureId: entry.fixtureId, round: entry.round,
    homeClubId: entry.homeClubId, awayClubId: entry.awayClubId,
    eventCount: replay.events.length,
    events: replay.events, goals,
    finalScore: { ...score },
  } };
}
