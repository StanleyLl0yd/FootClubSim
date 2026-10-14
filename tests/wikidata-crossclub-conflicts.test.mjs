import test from 'node:test';
import assert from 'node:assert/strict';
import { summarizeOpenEndedConflicts, queryOpenEndedConflicts } from '../scripts/wikidata-crossclub-conflicts.mjs';

test('counts repeated open-ended club identities without claiming a true double registration', () => {
  const stats = summarizeOpenEndedConflicts([
    { clubId: 'lp-nadir', personQids: ['Q10', 'Q20', 'Q30'] },
    { clubId: 'lp-vagon', personQids: ['Q20', 'Q30', 'Q40'] },
    { clubId: 'lp-spadov', personQids: ['Q30', 'Q50'] },
  ]);
  assert.equal(stats.totalClubPersonPairs, 8);
  assert.equal(stats.uniqueWikidataPersons, 5);
  assert.equal(stats.personsInMultipleCandidateClubs, 2);
  assert.equal(stats.excessClubPersonPairs, 3);
  assert.equal(stats.verifiedDoubleRegistrations, 0);
  assert.deepEqual(stats.clubs.map(x => x.flaggedConflictingPairs), [2, 2, 1]);
});
test('malformed or duplicate source person IDs are not tolerated', () => {
  assert.throws(() => summarizeOpenEndedConflicts([{ clubId: 'lp-nadir', personQids: ['Q10', 'Q10'] }]));
  assert.throws(() => summarizeOpenEndedConflicts([{ clubId: 'lp-nadir', personQids: ['N10'] }]));
  assert.throws(() => summarizeOpenEndedConflicts([
    { clubId: 'lp-nadir', personQids: [] },
    { clubId: 'lp-nadir', personQids: [] },
  ]));
});
test('a failed club query prevents misleading all-16 conflict conclusions', async () => {
  const clubs = Array.from({ length: 16 }, (_, index) => ({ clubId: 'lp-club-' + index, wikidataQid: 'Q' + (index + 1) }));
  let calls = 0;
  await assert.rejects(queryOpenEndedConflicts(clubs, {
    query: async () => {
      calls++;
      if (calls === 2) throw new Error('WDQS offline');
      return [];
    },
    pause: async () => {},
  }), /WDQS offline/);
  assert.equal(calls, 2);
});
test('no person identifiers appear in published summary', () => {
  const stats = summarizeOpenEndedConflicts([
    { clubId: 'lp-nadir', personQids: ['Q10', 'Q20'] },
    { clubId: 'lp-vagon', personQids: ['Q20'] },
  ]);
  assert.ok(!JSON.stringify(stats).includes('Q10'));
  assert.ok(!JSON.stringify(stats).includes('Q20'));
});
