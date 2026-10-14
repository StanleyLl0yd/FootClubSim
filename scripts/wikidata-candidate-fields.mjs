import { readFile } from 'node:fs/promises';
import { setTimeout as delay } from 'node:timers/promises';
import { classifyP54Statement, queryWikidata } from './wikidata-p54-coverage.mjs';

const API = 'https://www.wikidata.org/w/api.php';
const USER_AGENT = 'FootClubSim-CC0-roster-diagnostic/0.1 (https://github.com/StanleyLl0yd/FootClubSim)';
const QID = /^Q[1-9][0-9]*$/;
const MAX_IDS_PER_BATCH = 40;
const PROPS = ['P569', 'P27', 'P413'];

export function openEndedCandidateQids(bindings) {
  const people = new Set();
  for (const row of bindings) {
    if (classifyP54Statement(row) !== 'openEndedCandidate') continue;
    const uri = row?.person?.value;
    const id = typeof uri === 'string' ? uri.replace(/^http:\/\/www\.wikidata\.org\/entity\//, '') : '';
    if (!QID.test(id)) throw new Error('Invalid candidate QID');
    people.add(id);
  }
  return [...people].sort((a, b) => Number(a.slice(1)) - Number(b.slice(1)));
}

export function summarizeClaimAvailability(ids, entities) {
  if (Object.keys(entities).length > ids.length) throw new Error('Unexpected entities in response');
  const counts = { candidatePersons: ids.length, birthDate: 0, citizenship: 0, position: 0, allThree: 0 };
  for (const id of ids) {
    if (!QID.test(id) || !Object.hasOwn(entities, id) || entities[id]?.missing) {
      throw new Error('Missing candidate entity in response: ' + id);
    }
    const flags = PROPS.map(prop => Array.isArray(entities[id].claims?.[prop])
      && entities[id].claims[prop].some(statement => statement.rank !== 'deprecated'
        && statement.mainsnak?.snaktype === 'value'));
    if (flags[0]) counts.birthDate++;
    if (flags[1]) counts.citizenship++;
    if (flags[2]) counts.position++;
    if (flags.every(Boolean)) counts.allThree++;
  }
  return counts;
}

async function fetchEntityBatch(ids, fetchImpl = fetch) {
  if (!Array.isArray(ids) || ids.length < 1 || ids.length > MAX_IDS_PER_BATCH || ids.some(id => !QID.test(id))) {
    throw new Error('Invalid Wikidata entity batch');
  }
  const url = new URL(API);
  url.searchParams.set('action', 'wbgetentities');
  url.searchParams.set('ids', ids.join('|'));
  url.searchParams.set('props', 'claims');
  url.searchParams.set('format', 'json');
  url.searchParams.set('maxlag', '5');
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30000);
  try {
    const response = await fetchImpl(url, {
      headers: { Accept: 'application/json', 'User-Agent': USER_AGENT },
      signal: controller.signal,
    });
    if (response.status === 429 || response.status === 503) {
      const error = new Error('Wikidata API throttle ' + response.status + '; halt requests');
      error.rateLimited = true;
      throw error;
    }
    if (!response.ok) throw new Error('Wikidata API HTTP ' + response.status);
    const value = await response.text();
    if (value.length > 4_000_000) throw new Error('Entity response exceeds 4MB');
    const json = JSON.parse(value);
    if (json.error?.code === 'maxlag') {
      const error = new Error('Wikidata maxlag; halt requests');
      error.rateLimited = true;
      throw error;
    }
    if (json.error || !json.entities || typeof json.entities !== 'object') {
      throw new Error('Wikidata API error or malformed result');
    }
    return json.entities;
  } finally {
    clearTimeout(timeout);
  }
}

export async function measureFieldAvailability(club, { query = queryWikidata, entities = fetchEntityBatch, pause = delay } = {}) {
  const membershipRows = await query(club.wikidataQid);
  const ids = openEndedCandidateQids(membershipRows);
  const all = {};
  for (let index = 0; index < ids.length; index += MAX_IDS_PER_BATCH) {
    if (index) await pause(1500);
    const batch = ids.slice(index, index + MAX_IDS_PER_BATCH);
    Object.assign(all, await entities(batch));
  }
  return {
    clubId: club.clubId,
    wikidataQid: club.wikidataQid,
    status: 'measured-current-wikidata',
    ...summarizeClaimAvailability(ids, all),
  };
}

export async function measureAllClubs(clubs, options = {}) {
  if (!Array.isArray(clubs) || clubs.length < 1 || clubs.length > 16) throw new Error('Invalid club list');
  const results = [];
  for (const [index, club] of clubs.entries()) {
    if (index) await (options.pause || delay)(1500);
    try {
      results.push(await measureFieldAvailability(club, options));
    } catch (error) {
      results.push({ clubId: club.clubId, wikidataQid: club.wikidataQid,
        status: 'query-failed', error: String(error?.message || error).slice(0, 160) });
      if (error?.rateLimited) break;
    }
  }
  return {
    schemaVersion: 1,
    targetAsOf: '2026-10-14',
    source: 'current Wikidata graph plus current wbgetentities claims',
    method: 'P54 open-ended candidate field presence: P569, P27, P413',
    caveat: 'presence does not certify date accuracy, eligibility, current roster, or player identity',
    measuredAt: new Date().toISOString(),
    completeForRequestedClubs: results.length === clubs.length && results.every(x => x.status === 'measured-current-wikidata'),
    verifiedRosterFacts: 0,
    results,
  };
}

if (process.argv[1] && import.meta.url === new URL('file://' + process.argv[1]).href) {
  const main = async () => {
    const map = JSON.parse(await readFile(new URL('../data/drafts/liga-wikidata-club-map-v1.json', import.meta.url), 'utf8'));
    const clubArg = process.argv.find(x => x.startsWith('--club='))?.slice(7);
    const clubs = clubArg ? map.clubs.filter(c => c.clubId === clubArg) : map.clubs;
    if (clubs.length === 0) throw new Error('Unknown club');
    const result = await measureAllClubs(clubs);
    console.log(JSON.stringify(result, null, 2));
    if (!result.completeForRequestedClubs) process.exitCode = 2;
  };
  main().catch(error => { console.error(String(error?.message || error)); process.exitCode = 2; });
}
