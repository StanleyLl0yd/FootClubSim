import { readFile, writeFile } from 'node:fs/promises';
import { setTimeout as delay } from 'node:timers/promises';

export const ROW_LIMIT = 1501;
const AS_OF = '2026-10-14';
const API = 'https://query.wikidata.org/sparql';
const USER_AGENT = 'FootClubSim-CC0-roster-diagnostic/0.1 (https://github.com/StanleyLl0yd/FootClubSim)';
const WD_ENTITY = /^http:\/\/www\.wikidata\.org\/entity\/Q[1-9][0-9]*$/;
const WD_STATEMENT = /^http:\/\/www\.wikidata\.org\/entity\/statement\/[a-zA-Z0-9-]+$/;

/** Diagnostic only. No real people or source URLs are persisted. */
export function buildP54Query(qid) {
  if (!/^Q[1-9][0-9]*$/.test(qid)) throw new Error('Invalid club Wikidata QID');
  return `PREFIX wd: <http://www.wikidata.org/entity/>
PREFIX p: <http://www.wikidata.org/prop/>
PREFIX ps: <http://www.wikidata.org/prop/statement/>
PREFIX pq: <http://www.wikidata.org/prop/qualifier/>
SELECT ?person ?statement ?start ?end WHERE {
  ?person p:P54 ?statement .
  ?statement ps:P54 wd:${qid} .
  OPTIONAL { ?statement pq:P580 ?start . }
  OPTIONAL { ?statement pq:P582 ?end . }
}
LIMIT ${ROW_LIMIT}`;
}

/** A date-looking qualifier is only usable if its calendar day exists. */
function isValidCalendarDay(value) {
  if (typeof value !== 'string' || !/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  if (year < 1 || month < 1 || month > 12 || day < 1) return false;
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const daysInMonth = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return day <= daysInMonth[month - 1];
}

export function classifyP54Statement(row, asOf = AS_OF) {
  if (!isValidCalendarDay(asOf)) throw new Error('Invalid reference date');
  const read = key => {
    const value = row?.[key]?.value;
    if (value === undefined) return null;
    if (typeof value !== 'string' || !/^[0-9]{4}-[0-9]{2}-[0-9]{2}T00:00:00Z$/.test(value)) return 'uncertain';
    const date = value.slice(0, 10);
    return isValidCalendarDay(date) ? date : 'uncertain';
  };
  const start = read('start'), end = read('end');
  if (start === 'uncertain' || end === 'uncertain' ||
      (start && end && start > end)) return 'unknown';
  if ((start && start > asOf) || (end && end < asOf)) return 'outside';
  if (start && end) return 'boundedCandidate';
  if (start) return 'openEndedCandidate';
  return 'unknown';
}

/** One conservative classification for each distinct P54 statement, shared by all diagnostics. */
export function classifyP54Bindings(bindings, asOf = AS_OF) {
  if (!isValidCalendarDay(asOf)) throw new Error('Invalid reference date');
  if (!Array.isArray(bindings) || bindings.length >= ROW_LIMIT) {
    throw new Error('WDQS query result truncated or malformed; do not report complete counts');
  }
  const statements = new Map();
  for (const row of bindings) {
    const person = row?.person?.value;
    const statement = row?.statement?.value;
    if (!WD_ENTITY.test(person || '') || !WD_STATEMENT.test(statement || '')) {
      throw new Error('Unexpected WDQS entity/statement URI');
    }
    const key = person + '/' + statement;
    const qualifiers = JSON.stringify([row?.start?.value ?? null, row?.end?.value ?? null]);
    const previous = statements.get(key);
    if (previous) {
      if (previous.qualifiers !== qualifiers) previous.ambiguous = true;
      continue;
    }
    statements.set(key, { person, row, qualifiers, ambiguous: false });
  }
  // Several Wikidata qualifiers for the same statement may generate multiple rows.
  // Never count one unqualified fragment of an ambiguous statement as membership.
  return [...statements.values()].map(({ person, row, ambiguous }) => ({
    person, type: ambiguous ? 'unknown' : classifyP54Statement(row, asOf),
  }));
}

export function summarizeP54Bindings(bindings, asOf = AS_OF) {
  const byPerson = new Map();
  const classified = classifyP54Bindings(bindings, asOf);
  const byType = { boundedCandidate: 0, openEndedCandidate: 0, unknown: 0, outside: 0 };
  for (const { person, type } of classified) {
    byType[type]++;
    if (!byPerson.has(person)) byPerson.set(person, new Set());
    byPerson.get(person).add(type);
  }
  const people = {
    boundedCandidate: 0,
    openEndedCandidate: 0,
    unknown: 0,
    outside: 0,
  };
  for (const types of byPerson.values()) {
    const priority = ['boundedCandidate', 'openEndedCandidate', 'unknown', 'outside'];
    people[priority.find(type => types.has(type))]++;
  }
  return {
    candidatePersonsAllSeasons: byPerson.size,
    statementCount: classified.length,
    statementClasses: byType,
    distinctPersonClasses: people,
    registrationVerified: false,
    rosterCompletenessVerified: false,
  };
}

export async function queryWikidata(qid, fetchImpl = fetch) {
  const url = new URL(API);
  url.searchParams.set('query', buildP54Query(qid));
  url.searchParams.set('format', 'json');
  url.searchParams.set('timeout', '25');
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30000);
  try {
    const response = await fetchImpl(url, {
      headers: {
        Accept: 'application/sparql-results+json',
        'User-Agent': USER_AGENT,
      },
      signal: controller.signal,
    });
    if (response.status === 429 || response.status === 503) {
      // On overload/service unavailability do not continue querying other clubs.
      const error = new Error(response.status === 429
        ? 'Wikidata rate limit; stop requests and honor Retry-After'
        : 'Wikidata service unavailable (503); stop further requests');
      error.rateLimited = true;
      error.retryAfter = response.headers.get('retry-after');
      throw error;
    }
    if (!response.ok) throw new Error('Wikidata HTTP ' + response.status);
    const size = Number(response.headers.get('content-length'));
    if (size > 4_000_000) throw new Error('Unexpectedly large response');
    const body = await response.text();
    if (body.length > 4_000_000) throw new Error('Wikidata response exceeds 4MB');
    const data = JSON.parse(body);
    if (!Array.isArray(data?.results?.bindings)) throw new Error('Malformed SPARQL result');
    return data.results.bindings;
  } finally {
    clearTimeout(timeout);
  }
}

export async function collectCoverage(clubs, fetchImpl = fetch, pause = delay) {
  if (!Array.isArray(clubs) || clubs.length < 1 || clubs.length > 16) {
    throw new Error('Expected a bounded, non-empty club list');
  }
  const result = [];
  for (const [index, club] of clubs.entries()) {
    if (index) await pause(1500);
    try {
      const rows = await queryWikidata(club.wikidataQid, fetchImpl);
      result.push({ clubId: club.clubId, wikidataQid: club.wikidataQid, status: 'measured-wdqs-graph', ...summarizeP54Bindings(rows) });
    } catch (error) {
      result.push({
        clubId: club.clubId,
        wikidataQid: club.wikidataQid,
        status: 'query-failed',
        error: String(error?.message || error).slice(0, 160),
      });
      if (error?.rateLimited) {
        // Wikimedia asks clients to stop further calls after 429, not continue a crawl.
        break;
      }
    }
  }
  return {
    schemaVersion: 1,
    intendedAsOf: AS_OF,
    queryMethod: 'WDQS p:P54/ps:P54 with optional P580/P582; all ranks and all historical seasons',
    label: 'diagnostic candidate statement counts, not historical 2026-10-14 player registrations',
    generatedAt: new Date().toISOString(),
    completeClubCoverage: result.length === clubs.length && result.every(entry => entry.status === 'measured-wdqs-graph'),
    verifiedRosterCount: 0,
    results: result,
  };
}

async function main() {
  const map = JSON.parse(await readFile(new URL('../data/drafts/liga-wikidata-club-map-v1.json', import.meta.url), 'utf8'));
  const only = process.argv.find(arg => arg.startsWith('--club='))?.slice(7);
  const selected = only ? map.clubs.filter(c => c.clubId === only) : map.clubs;
  if (selected.length === 0) throw new Error('Unknown club ID');
  const result = await collectCoverage(selected);
  const json = JSON.stringify(result, null, 2);
  console.log(json);
  if (process.argv.includes('--output')) {
    const i = process.argv.indexOf('--output');
    const target = process.argv[i + 1];
    if (!target || target.startsWith('-')) throw new Error('Missing --output path');
    await writeFile(target, json + '\n');
  }
  if (!result.completeClubCoverage) process.exitCode = 2;
}

if (process.argv[1] && import.meta.url === new URL('file://' + process.argv[1]).href) {
  main().catch(error => {
    console.error(String(error?.message || error));
    process.exitCode = 2;
  });
}
