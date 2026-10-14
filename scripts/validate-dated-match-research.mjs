import assert from 'node:assert/strict';

const DATE = /^\d{4}-\d{2}-\d{2}$/;
function date(value) {
  if (typeof value !== 'string' || !DATE.test(value)) return false;
  const d = new Date(value + 'T00:00:00.000Z');
  return Number.isFinite(d.valueOf()) && d.toISOString().slice(0, 10) === value;
}
function objectKeys(obj, names, label) {
  assert.ok(obj && typeof obj === 'object' && !Array.isArray(obj), label + ': invalid object');
  assert.deepEqual(Object.keys(obj).sort(), [...names].sort(), label + ': unexpected/missing fields');
}
function count(n, name, min = 0, max = 99) {
  assert.ok(Number.isSafeInteger(n) && n >= min && n <= max, name + ': invalid count');
}
const FIXTURE_FIELDS = ['fixtureId', 'playedOn', 'competition', 'sourceUrl', 'provider', 'sourceKind', 'result', 'participants', 'isRegistrationList', 'asOfRosterVerified'];
const TEAM_FIELDS = ['fictionalClubId', 'startingPlayers', 'benchListed', 'substitutesEntered', 'uniquePlayersAppeared'];
const CASE_FIELDS = ['observationId', 'prototypeName', 'fictionalPersonId', 'fictionalClubId', 'facts', 'finding', 'asOf20261014Registered', 'footnote'];
const FACT_FIELDS = ['fixtureId', 'observedParticipation'];
const ROOT_FIELDS = ['schemaVersion', 'observedOn', 'targetAsOf', 'reportStatus', 'factualRosterDenominatorsVerified', 'licensedPlayableFacts', 'reproducedSourceLineupTables', 'sourcePlayerImagesCopied', 'sourceRightsForBulkRedistribution', 'fixtures', 'targetedCaseChecks'];
const SOURCES = Object.freeze({
  'Russian Football Union': {
    hosts: ['www.rfs.ru'],
    path: /^\/cup\/tournament\/match\/[1-9]\d*$/,
    kind: 'dated-completed-official-cup-match-protocol',
    competition: 'RFU Cup 2026/27',
  },
  'FC Krasnodar': {
    hosts: ['www.fckrasnodar.ru', 'fckrasnodar.ru'],
    path: /^\/team\/news\/object\/$/,
    kind: 'dated-club-published-rpl-match-report-not-league-registration',
    competition: 'RPL 2026/27',
  },
  'FC Lokomotiv': {
    hosts: ['www.fclm.ru', 'fclm.ru'],
    path: /^\/news\/n\/[a-z0-9-]+\/$/,
    kind: 'dated-club-published-rpl-match-report-not-league-registration',
    competition: 'RPL 2026/27',
  },
});
function sourceMatchesDeclaration(fixture) {
  const rule = SOURCES[fixture.provider];
  assert.ok(rule, 'unreviewed source provider');
  let url;
  try { url = new URL(fixture.sourceUrl); }
  catch { assert.fail('invalid source URL'); }
  assert.equal(url.protocol, 'https:', 'source must use HTTPS');
  assert.ok(rule.hosts.includes(url.hostname), 'source/provider host mismatch');
  assert.ok(!url.username && !url.password && !url.port && !url.hash, 'noncanonical source URL');
  assert.ok(rule.path.test(url.pathname), 'provider path mismatch');
  assert.equal(fixture.sourceKind, rule.kind, 'source-kind mismatch');
  assert.equal(fixture.competition, rule.competition, 'competition/provider mismatch');
}


/** Research-only shape/integrity check. Cannot verify third-party claims or legal rights. */
export function validateDatedMatchResearch(doc, { clubIds, nadir }) {
  objectKeys(doc, ROOT_FIELDS, 'research');
  assert.equal(doc.schemaVersion, 1);
  assert.ok(date(doc.observedOn) && date(doc.targetAsOf), 'invalid report/as-of date');
  assert.ok(doc.observedOn >= doc.targetAsOf, 'cannot observe historical snapshot in future');
  assert.equal(doc.reportStatus, 'dated-match-appearances-research-only');
  assert.equal(doc.factualRosterDenominatorsVerified, 0);
  assert.equal(doc.licensedPlayableFacts, 0);
  assert.equal(doc.reproducedSourceLineupTables, false);
  assert.equal(doc.sourcePlayerImagesCopied, false);
  assert.equal(doc.sourceRightsForBulkRedistribution, 'unverified');
  assert.ok(Array.isArray(doc.fixtures) && doc.fixtures.length >= 1 && doc.fixtures.length <= 16);
  assert.ok(Array.isArray(doc.targetedCaseChecks) && doc.targetedCaseChecks.length <= 16);
  const allowedClubs = new Set(clubIds);
  assert.equal(allowedClubs.size, 16, 'unresolved league club IDs');
  const fixtures = new Map();
  let reportedClubAppearances = 0;
  for (const fixture of doc.fixtures) {
    objectKeys(fixture, FIXTURE_FIELDS, 'fixture');
    assert.match(fixture.fixtureId, /^[a-z0-9-]{12,100}$/);
    assert.ok(!fixtures.has(fixture.fixtureId), 'duplicate fixture');
    assert.ok(date(fixture.playedOn) && fixture.playedOn <= doc.targetAsOf, 'future or invalid fixture date');
    // This research schema records only a calendar day, not a verified completion timestamp.
    // Fail closed on same-day matches, which may still be scheduled when observed.
    assert.ok(fixture.playedOn < doc.observedOn, 'same-day fixture requires timestamped completion evidence');
    assert.ok(typeof fixture.competition === 'string' && fixture.competition.length < 80);
    assert.ok(typeof fixture.provider === 'string' && fixture.provider.length < 80);
    assert.ok(typeof fixture.sourceKind === 'string' && fixture.sourceKind.length < 100);
    assert.ok(typeof fixture.result === 'string' && fixture.result.length < 100);
    assert.match(fixture.sourceUrl, /^https:\/\/[a-z0-9.-]+\/\S+$/i);
    sourceMatchesDeclaration(fixture);
    assert.equal(fixture.isRegistrationList, false);
    assert.equal(fixture.asOfRosterVerified, false);
    assert.ok(Array.isArray(fixture.participants) && fixture.participants.length === 2, 'two teams per fixture');
    const teams = new Set();
    for (const team of fixture.participants) {
      objectKeys(team, TEAM_FIELDS, 'team');
      assert.ok(allowedClubs.has(team.fictionalClubId), 'unknown club ID');
      assert.ok(!teams.has(team.fictionalClubId), 'duplicated participating club');
      teams.add(team.fictionalClubId);
      count(team.startingPlayers, 'starters', 7, 11);
      if (team.benchListed !== null) count(team.benchListed, 'bench listed', 0, 12);
      count(team.substitutesEntered, 'substitutes entered', 0, 12);
      count(team.uniquePlayersAppeared, 'unique match participants', 7, 23);
      assert.equal(team.uniquePlayersAppeared, team.startingPlayers + team.substitutesEntered, 'appearance count mismatch');
      if (team.benchListed !== null) assert.ok(team.substitutesEntered <= team.benchListed, 'more entrants than bench');
      reportedClubAppearances += team.uniquePlayersAppeared;
    }
    fixtures.set(fixture.fixtureId, fixture);
  }
  const nadirPeople = new Set(Object.values(nadir.groups).flat().map(p => p.personId));
  const seen = new Set();
  for (const person of doc.targetedCaseChecks) {
    objectKeys(person, CASE_FIELDS, 'targeted case');
    assert.match(person.observationId, /^[a-z0-9-]{12,100}$/);
    assert.ok(!seen.has(person.observationId), 'duplicate case ID');
    seen.add(person.observationId);
    assert.equal(person.fictionalClubId, nadir.clubId, 'unapproved individual case club');
    assert.ok(nadirPeople.has(person.fictionalPersonId), 'unapproved person ID');
    assert.ok(typeof person.prototypeName === 'string' && person.prototypeName.trim().length >= 3);
    assert.ok(typeof person.finding === 'string' && person.finding.length > 10 && person.finding.length <= 100);
    assert.ok(typeof person.footnote === 'string' && person.footnote.length > 20 && person.footnote.length <= 250);
    assert.equal(person.asOf20261014Registered, false);
    assert.ok(Array.isArray(person.facts) && person.facts.length >= 1 && person.facts.length <= doc.fixtures.length);
    const factRefs = new Set();
    for (const fact of person.facts) {
      objectKeys(fact, FACT_FIELDS, 'case fact');
      assert.ok(fixtures.has(fact.fixtureId), 'unknown source fixture');
      assert.ok(!factRefs.has(fact.fixtureId), 'duplicate same-fixture case');
      factRefs.add(fact.fixtureId);
      const event = fixtures.get(fact.fixtureId);
      assert.ok(event.participants.some(p => p.fictionalClubId === person.fictionalClubId), 'person club not in fixture');
      assert.ok(['substitute-entered', 'starting-eleven', 'named-head-coach'].includes(fact.observedParticipation), 'unknown participation type');
    }
  }
  return {
    fixtures: fixtures.size,
    teamsObserved: new Set(doc.fixtures.flatMap(f => f.participants.map(p => p.fictionalClubId))).size,
    datedTeamAppearanceSlots: reportedClubAppearances,
    distinctRegisteredPlayersEstablished: 0,
    legallyClearedPlayableFacts: 0,
  };
}
