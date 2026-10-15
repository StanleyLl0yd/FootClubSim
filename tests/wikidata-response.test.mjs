import test from 'node:test';
import assert from 'node:assert/strict';
import { readWikidataJson } from '../scripts/wikidata-response.mjs';
import { queryWikidata } from '../scripts/wikidata-p54-coverage.mjs';
import { fetchEntityBatch, measureFieldAvailability } from '../scripts/wikidata-candidate-fields.mjs';

function streamed(chunks, headers = {}) {
  let cancelled = false;
  let reads = 0;
  const body = new ReadableStream({
    pull(controller) {
      if (reads < chunks.length) controller.enqueue(chunks[reads++]);
      else controller.close();
    },
    cancel() { cancelled = true; },
  }, { highWaterMark: 0 });
  return { response: new Response(body, { headers }), get cancelled() { return cancelled; }, get reads() { return reads; } };
}

test('Wikidata JSON decoding preserves UTF-8 split between chunks and exact byte limit', async () => {
  const bytes = new TextEncoder().encode('{"name":"Я"}');
  const split = bytes.indexOf(0xd0) + 1;
  const small = streamed([bytes.slice(0, split), bytes.slice(split)]);
  assert.deepEqual(await readWikidataJson(small.response), { name: 'Я' });
  const exact = streamed([new TextEncoder().encode('"' + 'x'.repeat(3_999_998) + '"')]);
  assert.equal((await readWikidataJson(exact.response)).length, 3_999_998);
});

test('unknown-length and compressed-size responses are cancelled before buffering more than 4MB', async () => {
  for (const headers of [{}, { 'content-length': '10', 'content-encoding': 'gzip' }]) {
    const source = streamed([new Uint8Array(3_000_000), new Uint8Array(1_000_001), new Uint8Array(1)], headers);
    await assert.rejects(readWikidataJson(source.response), /exceeds 4MB/);
    assert.equal(source.cancelled, true);
    assert.equal(source.reads, 2);
    assert.equal(source.response.body.locked, false);
  }
  const declared = streamed([new Uint8Array(1)], { 'content-length': '4000001' });
  await assert.rejects(readWikidataJson(declared.response), /exceeds 4MB/);
  assert.equal(declared.cancelled, true);
  assert.equal(declared.reads, 0);
});

test('both Wikidata endpoints use bounded streaming and retain throttle/maxlag errors', async () => {
  assert.deepEqual(await queryWikidata('Q1', async () => Response.json({ results: { bindings: [] } })), []);
  assert.deepEqual(await fetchEntityBatch(['Q1'], async () => Response.json({ entities: { Q1: { claims: {} } } })), { Q1: { claims: {} } });
  for (const invoke of [fetch => queryWikidata('Q1', fetch), fetch => fetchEntityBatch(['Q1'], fetch)]) {
    const source = streamed([new Uint8Array(4_000_001), new Uint8Array(1)]);
    await assert.rejects(invoke(async () => source.response), /exceeds 4MB/);
    assert.equal(source.cancelled, true);
    for (const status of [429, 503]) {
      await assert.rejects(invoke(async () => new Response(null, { status })), error => error.rateLimited === true);
    }
  }
  await assert.rejects(fetchEntityBatch(['Q1'], async () => Response.json({ error: { code: 'maxlag' } })), error => error.rateLimited === true);
  await assert.rejects(readWikidataJson(new Response('invalid')), SyntaxError);
});

test('field measurement rejects a misplaced entity at its own batch boundary', async () => {
  const rows = Array.from({ length: 41 }, (_, i) => ({
    person: { value: 'http://www.wikidata.org/entity/Q' + (i + 1) },
    statement: { value: 'http://www.wikidata.org/entity/statement/Q' + (i + 1) + '-test' },
    start: { value: '2026-01-01T00:00:00Z' },
  }));
  const options = { query: async () => rows, pause: async () => {}, entities: async ids => Object.fromEntries(ids.map(id => [id, { claims: {} }])) };
  const success = await measureFieldAvailability({ clubId: 'lp-nadir', wikidataQid: 'Q29108' }, options);
  assert.equal(success.candidatePersons, 41);
  assert.equal(success.birthDate, 0);
  let calls = 0;
  await assert.rejects(measureFieldAvailability({ clubId: 'lp-nadir', wikidataQid: 'Q29108' }, {
    ...options,
    entities: async ids => {
      calls++;
      return Object.fromEntries(ids.map((id, i) => [i === 0 ? 'Q999' : id, { claims: {} }]));
    },
  }), /Missing candidate/);
  assert.equal(calls, 1);
});

test('transport controllers also cancel unread HTTP error bodies', async () => {
  for (const invoke of [fetch => queryWikidata('Q1', fetch), fetch => fetchEntityBatch(['Q1'], fetch)]) {
    let signal;
    await assert.rejects(invoke(async (_url, options) => {
      signal = options.signal;
      return new Response('unread error body', { status: 500 });
    }), /HTTP 500/);
    assert.equal(signal.aborted, true);
  }
});
