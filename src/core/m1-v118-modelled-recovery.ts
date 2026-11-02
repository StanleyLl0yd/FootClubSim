import { sameCanonicalValue } from './canonical-value.js';
import { simulateM1V19InternalReferee }
  from './m1-v19-internal-foul-injury.js';
import type { M1V8AppliedFixture } from './m1-v8-result-journal.js';
import type { InitialCareerSave } from './save.js';

/**
 * Only full source-identity with the independently recreated v19 fictional
 * referee permits a synthetic return window. A matching-looking command ID,
 * unsigned medical claim or source mutation is never sufficient.
 * Return timing is uncalibrated fiction, NOT clinical clearance.
 */
export const M1_V118_MODELLED_RECOVERY_SCHEMA = 118 as const;
export interface M1V118ModelledRecovery {
  readonly clubId: string;
  readonly playerId: string;
  readonly sourceFixtureId: string;
  readonly sourceIncidentId: string;
  readonly missedCompleteClubFixtures: number;
}
function modelledMissedFixtureCount(fixtureId: string, incidentId: string,
  playerId: string): number {
  let digest = 0x6a09e667;
  for (const char of [fixtureId, incidentId, playerId].join('/')) {
    digest = Math.imul(digest ^ char.charCodeAt(0), 16777619) >>> 0;
  }
  return 1 + (digest % 4);
}
export function deriveM1V118InternalRecovery(
  initial: InitialCareerSave, item: M1V8AppliedFixture,
): readonly M1V118ModelledRecovery[] {
  const source = item.source;
  if (!source.plannedCommands.some(command =>
    command !== null && typeof command === 'object' &&
    'kind' in command && command.kind === 'injury-withdrawal') ||
      source.medicalActions.length !== 0 ||
      source.trustedDecisions.length !== 0) return [];
  const recreated = simulateM1V19InternalReferee({
    ...source.prematch, catalog: initial.catalog,
  }, source.policy);
  if (!recreated.ok || recreated.fixtureId !== item.fixtureId) return [];
  const expected = recreated.generatedIncidents.map(incident => ({
    schemaVersion: 1, id: incident.decisionId,
    fixtureId: item.fixtureId, teamId: incident.teamId,
    playerId: incident.playerId, elapsedSeconds: incident.elapsedSeconds,
    kind: incident.sanction,
    origin: incident.sanction === 'injury-withdrawal' ?
      'trusted-medical' : 'trusted-referee',
  }));
  if (!sameCanonicalValue(source.plannedCommands, expected)) return [];
  return recreated.generatedIncidents.filter(incident =>
    incident.sanction === 'injury-withdrawal').map(incident => ({
      clubId: incident.teamId, playerId: incident.playerId,
      sourceFixtureId: item.fixtureId,
      sourceIncidentId: incident.decisionId,
      missedCompleteClubFixtures: modelledMissedFixtureCount(
        item.fixtureId, incident.decisionId, incident.playerId),
    }));
}
