import { readFile } from 'node:fs/promises';
import { setTimeout as delay } from 'node:timers/promises';
import { queryWikidata } from './wikidata-p54-coverage.mjs';
import { openEndedCandidateQids } from './wikidata-candidate-fields.mjs';

export function summarizeOpenEndedConflicts(clubSets) {
  if (!Array.isArray(clubSets) || clubSets.length < 1 || clubSets.length > 16) throw new Error('Invalid club candidate groups');
  const personClubs = new Map();
  const output = [];
  const clubIds = new Set();
  for (const club of clubSets) {
    if (!club || typeof club.clubId !== 'string' || clubIds.has(club.clubId)
      || !Array.isArray(club.personQids)) throw new Error('Duplicate club or malformed input');
    clubIds.add(club.clubId);
    const qids = new Set(club.personQids);
    if (qids.size !== club.personQids.length) throw new Error('Duplicate person in club');
    for (const qid of qids) {
      if (!/^Q[1-9][0-9]*$/.test(qid)) throw new Error('Invalid person QID');
      if (!personClubs.has(qid)) personClubs.set(qid, new Set());
      personClubs.get(qid).add(club.clubId);
    }
    output.push({ clubId: club.clubId, candidatePairs: qids.size });
  }
  const conflictPeople = [...personClubs.values()].filter(clubs => clubs.size > 1);
  const conflictingClubSet = new Map();
  for (const clubs of conflictPeople) {
    for (const clubId of clubs) conflictingClubSet.set(clubId, (conflictingClubSet.get(clubId) || 0) + 1);
  }
  return {
    clubs: output.map(club => ({ ...club, flaggedConflictingPairs: conflictingClubSet.get(club.clubId) || 0 })),
    totalClubPersonPairs: output.reduce((n, x) => n + x.candidatePairs, 0),
    uniqueWikidataPersons: personClubs.size,
    personsInMultipleCandidateClubs: conflictPeople.length,
    excessClubPersonPairs: output.reduce((n, x) => n + x.candidatePairs, 0) - personClubs.size,
    verifiedDoubleRegistrations: 0,
  };
}

export async function queryOpenEndedConflicts(clubs, { query = queryWikidata, pause = delay } = {}) {
  if (!Array.isArray(clubs) || clubs.length !== 16) throw new Error('Require exactly 16 source clubs');
  const data = [];
  for (const [index, club] of clubs.entries()) {
    if (index) await pause(1500);
    // Do not silently compute zero overlaps from incomplete network results.
    const rows = await query(club.wikidataQid);
    data.push({ clubId: club.clubId, personQids: openEndedCandidateQids(rows) });
  }
  return {
    schemaVersion: 1,
    targetAsOf: '2026-10-14',
    observationDate: new Date().toISOString(),
    method: 'Open-ended P54 membership leads, not registered or currently contracted players',
    allClubQueriesSucceeded: true,
    ...summarizeOpenEndedConflicts(data),
  };
}

if (process.argv[1] && import.meta.url === new URL('file://' + process.argv[1]).href) {
  const main = async () => {
    const map = JSON.parse(await readFile(new URL('../data/drafts/liga-wikidata-club-map-v1.json', import.meta.url), 'utf8'));
    const report = await queryOpenEndedConflicts(map.clubs);
    console.log(JSON.stringify(report, null, 2));
  };
  main().catch(error => {
    console.error('Wikidata conflict diagnostic unavailable: ' + String(error?.message || error));
    process.exitCode = 2;
  });
}
