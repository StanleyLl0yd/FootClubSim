import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildP54Query, classifyP54Statement, summarizeP54Bindings,
  collectCoverage, ROW_LIMIT,
} from '../scripts/wikidata-p54-coverage.mjs';

const entity = number => 'http://www.wikidata.org/entity/Q' + number;
const stmt = number => 'http://www.wikidata.org/entity/statement/Q' + number + '-deadbeef';
const row = (n, start, end, stmtN = n) => ({
  person: { type: 'uri', value: entity(n) },
  statement: { type: 'uri', value: stmt(stmtN) },
  ...(start ? { start: { type: 'literal', value: start } } : {}),
  ...(end ? { end: { type: 'literal', value: end } } : {}),
});
const t = date => date + 'T00:00:00Z';

test('query has verified QID, qualified statement shape and a hard row limit', () => {
  const query = buildP54Query('Q29108');
  assert.match(query, /ps:P54 wd:Q29108/);
  assert.match(query, /pq:P580/);
  assert.match(query, /pq:P582/);
  assert.ok(query.includes('LIMIT ' + ROW_LIMIT));
  for (const bad of ['Q0', 'Q29108) . ?person ?x ?y', 'lp-nadir']) {
    assert.throws(() => buildP54Query(bad));
  }
});

test('P54 temporal classes do not treat missing end date as verified membership', () => {
  assert.equal(classifyP54Statement(row(1, t('2025-01-01'), t('2026-12-31'))), 'boundedCandidate');
  assert.equal(classifyP54Statement(row(1, t('2026-10-14'), t('2026-10-14'))), 'boundedCandidate');
  assert.equal(classifyP54Statement(row(1, t('2026-01-01'))), 'openEndedCandidate');
  assert.equal(classifyP54Statement(row(1)), 'unknown');
  assert.equal(classifyP54Statement(row(1, null, t('2026-12-31'))), 'unknown');
  assert.equal(classifyP54Statement(row(1, t('2027-01-01'))), 'outside');
  assert.equal(classifyP54Statement(row(1, null, t('2025-01-01'))), 'outside');
  assert.equal(classifyP54Statement(row(1, '2025-01-01T12:00:00Z')), 'unknown');
});

test('same person with several historical spells contributes once to person counts', () => {
  const bindings = [
    row(12, t('2021-01-01'), t('2022-12-31'), 1),
    row(12, t('2025-01-01'), t('2027-12-31'), 2),
    row(12, t('2025-01-01'), t('2027-12-31'), 2),
    row(13, t('2023-01-01'), undefined, 3),
    row(14, null, null, 4),
    row(15, null, t('2020-01-01'), 5),
  ];
  assert.deepEqual(summarizeP54Bindings(bindings), {
    candidatePersonsAllSeasons: 4,
    statementCount: 5,
    statementClasses: { boundedCandidate: 1, openEndedCandidate: 1, unknown: 1, outside: 2 },
    distinctPersonClasses: { boundedCandidate: 1, openEndedCandidate: 1, unknown: 1, outside: 1 },
    registrationVerified: false,
    rosterCompletenessVerified: false,
  });
});

test('fail closed on query truncation and malformed response identifiers', () => {
  assert.throws(() => summarizeP54Bindings(new Array(ROW_LIMIT).fill(row(1))), /truncated/);
  assert.throws(() => summarizeP54Bindings([{ person: { value: 'bad' }, statement: { value: stmt(1) } }]));
  assert.throws(() => summarizeP54Bindings([row(1, null, null, 1), { ...row(2), statement: { value: 'bad' } }]));
});

test('network failure does not become a zero-player claim; no unverified rosters produced', async () => {
  const clubs = [{ clubId: 'lp-nadir', wikidataQid: 'Q29108' }];
  const response = await collectCoverage(clubs, async () => { throw new Error('Network unavailable'); });
  assert.equal(response.completeClubCoverage, false);
  assert.equal(response.verifiedRosterCount, 0);
  assert.equal(response.results[0].status, 'query-failed');
  assert.ok(!('candidatePersonsAllSeasons' in response.results[0]));
});

test('429 halts subsequent club requests without crossing Wikimedia retry limits', async () => {
  const clubs = [
    { clubId: 'lp-nadir', wikidataQid: 'Q29108' },
    { clubId: 'lp-vagon', wikidataQid: 'Q29115' },
  ];
  let called = 0;
  const response = await collectCoverage(clubs, async () => {
    called++;
    return { status: 429, ok: false, headers: { get: () => '20' } };
  }, async () => {});
  assert.equal(called, 1);
  assert.equal(response.results.length, 1);
  assert.equal(response.completeClubCoverage, false);
});
