import test from 'node:test';
import assert from 'node:assert/strict';
import { createSyntheticRplScaleCatalog } from '../dist/core/synthetic.js';
import { createInitialCareer } from '../dist/core/save.js';
import { prepareM1V113PlayableMatch }
  from '../dist/core/m1-v113-browser-playtest.js';
import { deriveM1V118InternalRecovery }
  from '../dist/core/m1-v118-modelled-recovery.js';
import { startM1V8MatchJournal, applyM1V8MatchResult,
  validateM1V8MatchJournal }
  from '../dist/core/m1-v8-result-journal.js';

test('v157 synthetic recovery is bound to its actual replayed fixture', () => {
  const catalog = createSyntheticRplScaleCatalog(2026);
  let chosen;
  for (let seed = 1; seed <= 96; seed++) {
    const career = createInitialCareer(catalog, catalog.clubs[0].id, seed,
      'v157-fixture-bound-recovery-' + seed);
    const started = startM1V8MatchJournal(career);
    assert.equal(started.ok, true);
    const prepared = prepareM1V113PlayableMatch(
      career, started.journal, 'internal-referee');
    assert.equal(prepared?.ok, true);
    if (!prepared.request.plannedCommands.some(command =>
      command.kind === 'injury-withdrawal')) continue;
    const applied = applyM1V8MatchResult(
      career, started.journal, prepared.request);
    assert.equal(applied.ok, true);
    const item = applied.journal.results[0];
    if (deriveM1V118InternalRecovery(career, item).length === 0) continue;
    chosen = { career, item, journal: applied.journal };
    break;
  }
  assert.ok(chosen, 'Fixed source seeds must yield a replayed virtual injury');
  const { career, item, journal } = chosen;
  const before = JSON.stringify(journal);
  const genuine = deriveM1V118InternalRecovery(career, item);
  assert.ok(genuine.length > 0);
  assert.equal(item.fixtureId, item.source.prematch.fixture.id);

  // Retag both outer fixture identity AND every replayed command. Without
  // cross-checking recreated.fixtureId, canonical command comparison alone
  // would accept this self-consistent but wrong fixture attribution.
  const forged = structuredClone(item);
  forged.fixtureId = item.fixtureId + '-retagged';
  for (const command of forged.source.plannedCommands) {
    command.fixtureId = forged.fixtureId;
  }
  assert.notEqual(forged.fixtureId, forged.source.prematch.fixture.id);
  assert.deepEqual(deriveM1V118InternalRecovery(career, forged), []);
  assert.equal(validateM1V8MatchJournal(career, {
    ...journal, results: [forged],
  }).ok, false);

  const onlyOuter = structuredClone(item);
  onlyOuter.fixtureId += '-retagged';
  assert.deepEqual(deriveM1V118InternalRecovery(career, onlyOuter), []);
  const onlyCommands = structuredClone(item);
  for (const command of onlyCommands.source.plannedCommands) {
    command.fixtureId += '-retagged';
  }
  assert.deepEqual(deriveM1V118InternalRecovery(career, onlyCommands), []);
  assert.deepEqual(deriveM1V118InternalRecovery(career, item), genuine);
  assert.equal(JSON.stringify(journal), before);
});
