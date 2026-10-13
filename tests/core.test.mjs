import test from 'node:test';
import assert from 'node:assert/strict';
import { validateCatalog, validateLineup } from '../dist/core/validation.js';
import { FIELD_ATTRIBUTE_KEYS, GOALKEEPER_ATTRIBUTE_KEYS } from '../dist/core/model.js';
import { RNG_VERSION, SeededRng } from '../dist/core/rng.js';

const attributes = Object.fromEntries([...FIELD_ATTRIBUTE_KEYS, ...GOALKEEPER_ATTRIBUTE_KEYS].map(key => [key, 50]));
const players = Array.from({ length: 23 }, (_, index) => ({
  id: 'person-' + index, displayName: 'Fictional Player ' + index,
  primaryPosition: index === 0 ? 'GK' : 'MC',
  foreignerForCompetition: index > 16, attributes,
}));
const club = { id: 'fictional-club', displayName: 'Fictional club', registeredPlayerIds: players.map(p => p.id) };
const catalog = { schemaVersion: 1, packId: 'fictional-pack', packVersion: '1', source: 'synthetic', clubs: [club], players };
const rules = { starterCount: 11, maxBench: 12, maxForeignersOnField: 7 };
const lineup = { clubId: club.id, starters: players.slice(0, 11).map(p => p.id), bench: players.slice(11).map(p => p.id) };
const playerMap = new Map(players.map(p => [p.id, p]));

test('synthetic catalog and legal lineup pass', () => {
  assert.deepEqual(validateCatalog(catalog), []);
  assert.deepEqual(validateLineup(lineup, club, playerMap, rules), []);
});
test('duplicate club registration and bad attributes fail', () => {
  assert.ok(validateCatalog({ ...catalog, clubs: [{ ...club, registeredPlayerIds: [...club.registeredPlayerIds, 'person-0'] }] }).some(e => e.code === 'DUPLICATE_REGISTRATION'));
  assert.ok(validateCatalog({ ...catalog, players: [{ ...players[0], attributes: { ...attributes, vision: 101 } }, ...players.slice(1)] }).some(e => e.code === 'INVALID_ATTRIBUTE'));
});
test('lineup detects duplicates and ineligible players', () => {
  assert.ok(validateLineup({ ...lineup, starters: [...lineup.starters.slice(0, 10), 'person-0'] }, club, playerMap, rules).some(e => e.code === 'DUPLICATE_LINEUP'));
  assert.ok(validateLineup({ ...lineup, bench: ['not-registered'] }, club, playerMap, rules).some(e => e.code === 'INELIGIBLE_PLAYER'));
});
test('lineup enforces foreigner cap by explicit status not passport', () => {
  const starters = players.slice(12, 23).map(p => p.id);
  assert.ok(validateLineup({ ...lineup, starters, bench: [] }, club, playerMap, { ...rules, maxForeignersOnField: 4 }).some(e => e.code === 'FOREIGN_LIMIT'));
});
test('lineup has exactly one goalkeeper and valid competition rules', () => {
  const noKeeper = { ...lineup, starters: players.slice(1, 12).map(p => p.id) };
  assert.ok(validateLineup(noKeeper, club, playerMap, rules).some(e => e.code === 'GOALKEEPER_COUNT'));
  assert.ok(validateLineup(lineup, club, playerMap, { ...rules, starterCount: 12 }).some(e => e.code === 'INVALID_RULES'));
});
test('seeded RNG is repeatable and resume-state safe', () => {
  assert.equal(RNG_VERSION, 'xorshift32-v1');
  const a = new SeededRng(42); const b = new SeededRng(42);
  assert.deepEqual(Array.from({ length: 10 }, () => a.nextUint32()), Array.from({ length: 10 }, () => b.nextUint32()));
  const state = a.snapshot();
  assert.equal(new SeededRng(state).nextUint32(), a.nextUint32());
  assert.throws(() => new SeededRng(0), RangeError);
  assert.ok(new SeededRng(17).nextFloat() < 1);
});
