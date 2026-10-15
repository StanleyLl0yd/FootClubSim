import test from 'node:test';
import assert from 'node:assert/strict';
import { openEndedCandidateQids, summarizeClaimAvailability, measureFieldAvailability, measureAllClubs } from '../scripts/wikidata-candidate-fields.mjs';
const row = (id, start, end, statementId = id) => ({
  person: { value: 'http://www.wikidata.org/entity/Q' + id },
  statement: { value: 'http://www.wikidata.org/entity/statement/Q' + id + '-' + statementId },
  ...(start ? { start: { value: start + 'T00:00:00Z' } } : {}),
  ...(end ? { end: { value: end + 'T00:00:00Z' } } : {}),
});
const statement = rank => ({ rank, mainsnak: { snaktype: 'value' } });
test('candidate field research excludes dated historical and unqualified memberships', () => {
  const rows = [
    row(10, '2026-01-01'), row(10, '2026-01-01'), row(20, '2023-01-01', '2024-01-01'),
    row(30, '2026-10-14'), row(40), row(50, '2027-01-01'),
  ];
  assert.deepEqual(openEndedCandidateQids(rows), ['Q10', 'Q30']);
});
test('field candidate QIDs reject conflicting qualifier fragments for the same statement', () => {
  const open = row(10, '2026-01-01', undefined, 'same');
  const closed = row(10, '2026-01-01', '2026-10-14', 'same');
  const otherValid = row(20, '2026-01-01', undefined, 'valid');
  for (const rows of [[open, closed, otherValid], [closed, open, otherValid]]) {
    assert.deepEqual(openEndedCandidateQids(rows), ['Q20']);
  }
  assert.deepEqual(openEndedCandidateQids([open, { ...open }]), ['Q10']);
  assert.deepEqual(openEndedCandidateQids([open, closed, row(10, '2026-02-01', undefined, 'independent')]), ['Q10']);
  assert.throws(() => openEndedCandidateQids([{ ...open, statement: { value: 'bad' } }]), /statement URI/);
});

test('citizenship is not eligibility and counts omit deprecated/no-value claims', () => {
  const counts = summarizeClaimAvailability(['Q10', 'Q30'], {
    Q10: { claims: { P569: [statement('normal')], P27: [statement('normal')], P413: [statement('normal')] } },
    Q30: { claims: { P569: [statement('deprecated')], P27: [{ rank: 'normal', mainsnak: { snaktype: 'novalue' } }], P413: [statement('normal')] } },
  });
  assert.deepEqual(counts, { candidatePersons: 2, birthDate: 1, citizenship: 1, position: 2, allThree: 1 });
});
test('incomplete entity batches fail instead of reporting missing property values', () => {
  assert.throws(() => summarizeClaimAvailability(['Q10'], {}), /Missing candidate/);
  assert.throws(() => summarizeClaimAvailability(['Q10'], { Q10: { missing: true } }), /Missing candidate/);
});
test('per-club measurement never exposes source QIDs or private claims in output', async () => {
  const result = await measureFieldAvailability({ clubId: 'lp-nadir', wikidataQid: 'Q29108' }, {
    query: async () => [row(10, '2026-01-01'), row(20, '2025-01-01', '2025-12-31')],
    entities: async ids => Object.fromEntries(ids.map(id => [id, { claims: { P569: [statement('normal')] } }])),
    pause: async () => {},
  });
  assert.deepEqual(result, {
    clubId: 'lp-nadir', wikidataQid: 'Q29108', status: 'measured-current-wikidata',
    candidatePersons: 1, birthDate: 1, citizenship: 0, position: 0, allThree: 0,
  });
  assert.ok(!JSON.stringify(result).includes('Q10'));
});
test('transport error is not disguised as all missing person attributes', async () => {
  const response = await measureAllClubs([{ clubId: 'lp-nadir', wikidataQid: 'Q29108' }], {
    query: async () => { throw new Error('connection failed'); },
    pause: async () => {},
  });
  assert.equal(response.completeForRequestedClubs, false);
  assert.equal(response.results[0].status, 'query-failed');
  assert.ok(!Object.hasOwn(response.results[0], 'candidatePersons'));
});

test('empty-string missing markers and malformed entities cannot become zero-availability reports', () => {
  for (const entity of [null, [], { missing: '' }, { missing: false, claims: {} }, {}]) {
    assert.throws(() => summarizeClaimAvailability(['Q10'], { Q10: entity }), /candidate entity/);
  }
  assert.deepEqual(summarizeClaimAvailability(['Q10'], { Q10: { claims: {} } }), {
    candidatePersons: 1, birthDate: 0, citizenship: 0, position: 0, allThree: 0,
  });
});

test('failed measurements do not publish source-person IDs in error summaries', async () => {
  const result = await measureAllClubs([{ clubId: 'lp-nadir', wikidataQid: 'Q29108' }], {
    query: async () => [row(10, '2026-01-01')],
    entities: async () => ({ Q10: { missing: '' } }),
    pause: async () => {},
  });
  assert.equal(result.completeForRequestedClubs, false);
  assert.equal(result.results[0].status, 'query-failed');
  assert.ok(!JSON.stringify(result).includes('Q10'));
});
