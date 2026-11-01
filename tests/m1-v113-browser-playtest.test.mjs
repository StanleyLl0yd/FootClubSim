import test from 'node:test';
import assert from 'node:assert/strict';
import { createSyntheticRplScaleCatalog }
  from '../dist/core/synthetic.js';
import { createInitialCareer } from '../dist/core/save.js';
import { prepareM1V113PlayableMatch }
  from '../dist/core/m1-v113-browser-playtest.js';
import {
  startM1V8MatchJournal, applyM1V8MatchResult,
  applyM1V8MatchResultBatchAtRevision, validateM1V8MatchJournal,
} from '../dist/core/m1-v8-result-journal.js';

const catalog = createSyntheticRplScaleCatalog(2026);
const career = createInitialCareer(
  catalog, catalog.clubs[0].id, 42, 'v113-browser-playtest');
const original = JSON.stringify(career);
function empty() {
  const journal = startM1V8MatchJournal(career);
  assert.equal(journal.ok, true);
  return journal.journal;
}
function preview(journal, scenario) {
  const result = prepareM1V113PlayableMatch(career, journal, scenario);
  assert.equal(result?.ok, true, JSON.stringify(result).slice(0, 350));
  return result;
}
function commit(journal, proposal) {
  const accepted = applyM1V8MatchResultBatchAtRevision(
    career, journal, journal.revision, [proposal.request]);
  assert.equal(accepted.ok, true, JSON.stringify(accepted).slice(0, 350));
  assert.equal(accepted.journal.revision, journal.revision + 1);
  assert.equal(validateM1V8MatchJournal(career, accepted.journal).ok, true);
  return accepted.journal;
}

test('normal match is replay-checked and next fixture advances without changing M0', () => {
  const first = preview(empty(), 'ordinary');
  const journal = commit(empty(), first);
  assert.equal(journal.results[0].fixtureId, first.fixture.id);
  assert.equal(journal.results[0].dossier.match.home.goals,
    first.request.result.report.home.goals);
  assert.equal(journal.results[0].source.medicalActions.length, 0);
  const second = preview(journal, 'ordinary');
  assert.notEqual(second.fixture.id, first.fixture.id);
  assert.equal(second.request.expectedRevision, 1);
  assert.notEqual(second.request.prematch.rngSeed, first.request.prematch.rngSeed);
  assert.equal(JSON.stringify(career), original);
});

test('temporary medical exit and return have physical effects and persist as evidence', () => {
  const initial = empty();
  const proposal = preview(initial, 'temporary-treatment');
  const result = proposal.request.result;
  assert.equal(proposal.request.medicalActions.length, 2);
  assert.equal(result.events.filter(e => e.type === 'medical').length, 2);
  assert.equal(result.offFieldAtFullTime.length, 0);
  const next = commit(initial, proposal);
  assert.deepEqual(next.results[0].source.medicalActions,
    proposal.request.medicalActions);
  assert.ok(next.results[0].dossier.players.some(p =>
    p.temporarilyAbsentPhaseSeconds > 0));
});

test('legal user-side normal substitution updates final XI and named bench', () => {
  const initial = empty();
  const proposal = preview(initial, 'normal-substitution');
  const fixture = proposal.fixture;
  const side = fixture.homeClubId === career.selectedClubId ? 'home' : 'away';
  const command = proposal.request.plannedCommands[0];
  assert.equal(command.kind, 'substitute-normal');
  assert.equal(proposal.request.result.events
    .filter(e => e.type === 'availability').length, 1);
  const onField = proposal.request.result.onFieldAtFullTime[side];
  assert.ok(onField.includes(command.inPlayerId));
  assert.ok(!onField.includes(command.outPlayerId));
  assert.equal(commit(initial, proposal).results[0].dossier.teams[side].participants
    .includes(command.inPlayerId), true);
});

test('combined treatment and substitution share the same verified replay path', () => {
  const initial = empty();
  const proposed = preview(initial, 'combined');
  assert.equal(proposed.request.medicalActions.length, 2);
  assert.equal(proposed.request.plannedCommands.length, 1);
  assert.equal(proposed.request.result.events.filter(e => e.type === 'medical').length, 2);
  assert.equal(proposed.request.result.events.filter(e => e.type === 'availability').length, 1);
  const next = commit(initial, proposed);
  const further = prepareM1V113PlayableMatch(career, next, 'ordinary');
  assert.equal(further?.ok, true);
});

test('invalid scenario, corrupted source and stale CAS cannot advance history', () => {
  const initial = empty();
  assert.deepEqual(prepareM1V113PlayableMatch(career, initial, 'fake'), {
    ok: false, error: 'INVALID_SCENARIO',
  });
  const proposed = preview(initial, 'ordinary');
  const forged = structuredClone(proposed.request);
  forged.result.report.home.goals += 1;
  assert.deepEqual(applyM1V8MatchResult(career, initial, forged), {
    ok: false, error: 'INVALID_MATCH_RESULT',
  });
  const committed = commit(initial, proposed);
  assert.deepEqual(applyM1V8MatchResultBatchAtRevision(
    career, committed, 0, [proposed.request]), {
    ok: false, error: 'CAS_REVISION_MISMATCH',
  });
  assert.deepEqual(prepareM1V113PlayableMatch(career,
    { ...committed, revision: 0 }, 'ordinary'), {
    ok: false, error: 'INVALID_JOURNAL',
  });
  assert.equal(JSON.stringify(career), original);
});

test('manager chooses a different legal outgoing starter and incoming bench player', () => {
  const initial = empty();
  const baseline = preview(initial, 'normal-substitution');
  const ownSide = baseline.fixture.homeClubId === career.selectedClubId ?
    'home' : 'away';
  const lineup = ownSide === 'home' ? baseline.request.prematch.homeLineup :
    baseline.request.prematch.awayLineup;
  const player = new Map(catalog.players.map(p => [p.id, p]));
  const out = lineup.starters.filter(id => player.get(id)?.primaryPosition !== 'GK')[6];
  const incoming = lineup.bench.filter(id =>
    player.get(id)?.primaryPosition !== 'GK').at(-1);
  const chosen = prepareM1V113PlayableMatch(career, initial,
    'normal-substitution', { outPlayerId: out, inPlayerId: incoming });
  assert.equal(chosen?.ok, true, JSON.stringify(chosen));
  const cmd = chosen.request.plannedCommands[0];
  assert.equal(cmd.outPlayerId, out);
  assert.equal(cmd.inPlayerId, incoming);
  assert.notEqual(cmd.outPlayerId, baseline.request.plannedCommands[0].outPlayerId);
  assert.ok(chosen.request.result.onFieldAtFullTime[ownSide].includes(incoming));
  assert.ok(!chosen.request.result.onFieldAtFullTime[ownSide].includes(out));
  const committed = commit(initial, chosen);
  assert.equal(committed.results[0].source.plannedCommands[0].outPlayerId, out);
  assert.equal(JSON.stringify(career), original);
});

test('forged substitution participants cannot modify the match or source history', () => {
  const initial = empty();
  const baseline = preview(initial, 'combined');
  const ownSide = baseline.fixture.homeClubId === career.selectedClubId ?
    'home' : 'away';
  const lineup = ownSide === 'home' ? baseline.request.prematch.homeLineup :
    baseline.request.prematch.awayLineup;
  const originalPlayer = baseline.request.plannedCommands[0].outPlayerId;
  const incoming = baseline.request.plannedCommands[0].inPlayerId;
  const cases = [
    { outPlayerId: lineup.bench[0], inPlayerId: incoming },
    { outPlayerId: originalPlayer, inPlayerId: lineup.starters[0] },
    { outPlayerId: lineup.starters[0], inPlayerId: incoming },
    { outPlayerId: baseline.request.medicalActions[0].playerId,
      inPlayerId: incoming },
    { outPlayerId: originalPlayer, inPlayerId: 'unknown-player' },
    { outPlayerId: originalPlayer, inPlayerId: incoming, extra: true },
  ];
  for (const selection of cases) {
    assert.deepEqual(prepareM1V113PlayableMatch(
      career, initial, 'combined', selection), {
      ok: false, error: 'INVALID_SUBSTITUTION_SELECTION',
    });
  }
  assert.deepEqual(prepareM1V113PlayableMatch(
    career, initial, 'ordinary', { outPlayerId: originalPlayer,
      inPlayerId: incoming }), {
    ok: false, error: 'INVALID_SUBSTITUTION_SELECTION',
  });
  let accessed = 0;
  const malicious = { inPlayerId: incoming };
  Object.defineProperty(malicious, 'outPlayerId', {
    enumerable: true, get() { accessed++; throw Error('unexpected getter'); },
  });
  assert.deepEqual(prepareM1V113PlayableMatch(
    career, initial, 'normal-substitution', malicious), {
    ok: false, error: 'INVALID_SUBSTITUTION_SELECTION',
  });
  assert.equal(accessed, 0);
  assert.equal(JSON.stringify(initial), JSON.stringify(empty()));
  assert.equal(JSON.stringify(career), original);
});
