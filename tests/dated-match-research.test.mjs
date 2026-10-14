import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { validateDatedMatchResearch } from '../scripts/validate-dated-match-research.mjs';

const read = path => JSON.parse(readFileSync(new URL('../' + path, import.meta.url), 'utf8'));
const observations = read('data/drafts/liga-dated-match-observations-2026-10-14.json');
const clubs = read('data/drafts/liga-roster-sources.json').clubs.map(c => c.clubId);
const nadir = read('data/drafts/nadir-personnel-v1.json');
const pack = read('data/drafts/liga-personnel-pack-v1.json');
const input = {clubIds:clubs, nadir};

test('four fixture sources record bounded played appearances, not dated league registrations', () => {
  assert.deepEqual(validateDatedMatchResearch(observations, input), {
    fixtures: 4, teamsObserved: 6, datedTeamAppearanceSlots: 125,
    distinctRegisteredPlayersEstablished: 0, legallyClearedPlayableFacts: 0,
  });
  assert.equal(pack.availableForCareerStart, false);
  assert.equal(pack.verifiedFactCount, 0);
  assert.equal(observations.targetedCaseChecks[0].fictionalPersonId, 'lp-person-0020');
  assert.equal(observations.targetedCaseChecks[1].fictionalPersonId, 'lp-person-0027');
});

test('historical fixture evidence rejects invented roster clearance, source copying and date leakage', () => {
  const modify = [
    d => {d.licensedPlayableFacts=1;},
    d => {d.factualRosterDenominatorsVerified=1;},
    d => {d.reproducedSourceLineupTables=true;},
    d => {d.sourcePlayerImagesCopied=true;},
    d => {d.sourceRightsForBulkRedistribution='permitted';},
    d => {d.fixtures[0].playedOn='2026-10-15';},
    d => {d.fixtures[0].playedOn='2026-02-30';},
    d => {d.fixtures[0].isRegistrationList=true;},
    d => {d.fixtures[0].asOfRosterVerified=true;},
    d => {d.fixtures[0].participants[0].uniquePlayersAppeared=29;},
    d => {d.fixtures[0].participants[0].benchListed=3;},
    d => {d.fixtures[0].participants[1].fictionalClubId=d.fixtures[0].participants[0].fictionalClubId;},
    d => {d.fixtures[1].fixtureId=d.fixtures[0].fixtureId;},
    d => {d.fixtures[0].players=['copied','from','official','source'];},
    d => {d.targetedCaseChecks[0].asOf20261014Registered=true;},
    d => {d.targetedCaseChecks[0].fictionalPersonId='lp-person-9999';},
    d => {d.targetedCaseChecks[0].facts[0].fixtureId='nonexistent';},
    d => {d.targetedCaseChecks[0].facts[0].observedParticipation='confirmed-registered';},
    d => {d.targetedCaseChecks[0].facts[0].observedParticipation='named-head-coach'; d.targetedCaseChecks[0].extraField='secret';},
  ];
  for (const mutation of modify) {
    const copy = structuredClone(observations);
    mutation(copy);
    assert.throws(() => validateDatedMatchResearch(copy, input));
  }
});

test('case IDs and referenced real match participation are unique and club-scoped', () => {
  const copy = structuredClone(observations);
  copy.targetedCaseChecks[1].observationId = copy.targetedCaseChecks[0].observationId;
  assert.throws(() => validateDatedMatchResearch(copy, input), /duplicate case ID/);
  const outside = structuredClone(observations);
  outside.targetedCaseChecks[0].fictionalClubId = 'lp-zelenober';
  assert.throws(() => validateDatedMatchResearch(outside, input), /unapproved individual case club/);
});


test('October federation protocol resolves source-shortened Akron substitution counting', () => {
  const rows = observations.fixtures;
  assert.equal(rows.length, 4);
  assert.deepEqual(new Set(rows.map(x => x.fixtureId)).size, 4);
  const cup = rows.find(x => x.fixtureId === 'rfs-cup-2026-10-13-lokomotiv-akron');
  assert.ok(cup);
  assert.equal(cup.provider, 'Russian Football Union');
  const akron = cup.participants.find(x => x.fictionalClubId === 'lp-nizon');
  assert.deepEqual(akron, {
    fictionalClubId: 'lp-nizon', startingPlayers: 11,
    benchListed: 12, substitutesEntered: 5, uniquePlayersAppeared: 16,
  });
  const fakel = rows.find(x => x.fixtureId === 'rpl-2026-10-10-fakel-lokomotiv');
  assert.equal(fakel.participants.find(x => x.fictionalClubId === 'lp-ognetushitel').uniquePlayersAppeared, 15);
  assert.equal(fakel.participants.find(x => x.fictionalClubId === 'lp-vagon').uniquePlayersAppeared, 16);
});
