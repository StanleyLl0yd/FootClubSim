import test from 'node:test';
import assert from 'node:assert/strict';
import {createLigaPrikolovPreviewCatalog,LIGA_PRIKOLOV_PREVIEW_PACK_ID}
  from '../dist/app/ligaPrikolovPreviewCatalog.js';
import {LIGA_PRIKOLOV_IDENTITIES}
  from '../dist/branding/identities.js';
import {createSyntheticRplScaleCatalog}
  from '../dist/core/synthetic.js';
import {importSyntheticCatalog}
  from '../dist/core/import.js';
import {createInitialCareer}
  from '../dist/core/save.js';
import {startM1V188LeagueJournal,prepareM1V188LeagueMatch,
  applyM1V188LeagueMatch}
  from '../dist/core/m1-v188-league-source-journal.js';

test('approved fictional branding and invented rosters form distinct immutable pack',()=>{
  const preview=createLigaPrikolovPreviewCatalog(2026);
  assert.equal(preview.packId,LIGA_PRIKOLOV_PREVIEW_PACK_ID);
  assert.deepEqual(preview.clubs.map(x=>x.id),
    LIGA_PRIKOLOV_IDENTITIES.map(x=>x.id));
  assert.deepEqual(preview.clubs.map(x=>x.displayName),
    LIGA_PRIKOLOV_IDENTITIES.map(x=>x.name));
  assert.equal(preview.clubs.length,16);
  assert.equal(preview.players.length,368);
  assert.equal(new Set(preview.players.map(x=>x.id)).size,368);
  assert.equal(new Set(preview.players.map(x=>x.displayName)).size,368);
  assert.ok(preview.clubs.every(x=>x.registeredPlayerIds.length===23));
  assert.ok(preview.players.every(x=>!/Fictional Player/.test(x.displayName)));
  assert.equal(importSyntheticCatalog(JSON.stringify(preview)).ok,true);
  assert.deepEqual(createLigaPrikolovPreviewCatalog(2026),preview);
  assert.notDeepEqual(createLigaPrikolovPreviewCatalog(2027),preview);
  const legacy=createSyntheticRplScaleCatalog(2026);
  assert.equal(legacy.packId,'fictional-rpl-scale');
  assert.equal(legacy.clubs[0].id,'fictional-1');
  assert.notEqual(legacy.clubs[0].id,preview.clubs[0].id);
});

test('original fictional clubs can actually play through canonical v188',()=>{
  const catalog=createLigaPrikolovPreviewCatalog(2026);
  const initial=createInitialCareer(
    catalog,catalog.clubs[0].id,42,'lp-prototype-real-first-fixture');
  const zero=startM1V188LeagueJournal(initial);
  assert.equal(zero.ok,true);
  const ready=prepareM1V188LeagueMatch(initial,zero.journal);
  assert.equal(ready?.ok,true);
  if(!ready?.ok)throw Error('No legal fictional league match');
  const saved=applyM1V188LeagueMatch(initial,zero.journal,ready.request);
  assert.equal(saved.ok,true);
  assert.equal(saved.journal.revision,1);
});

test('two new careers with different saved seeds have distinct fixture outcomes yet repeat exactly',()=>{
  const catalog=createLigaPrikolovPreviewCatalog(2026);
  const first=createInitialCareer(catalog,catalog.clubs[0].id,
    42,'lp-career-seed-42');
  const second=createInitialCareer(catalog,catalog.clubs[0].id,
    314159,'lp-career-seed-314159');
  const left=startM1V188LeagueJournal(first);
  const right=startM1V188LeagueJournal(second);
  assert.equal(left.ok,true);assert.equal(right.ok,true);
  const a=prepareM1V188LeagueMatch(first,left.journal);
  const b=prepareM1V188LeagueMatch(second,right.journal);
  assert.equal(a?.ok,true);assert.equal(b?.ok,true);
  assert.equal(a.fixture.id,b.fixture.id);
  assert.notEqual(first.rngState,second.rngState);
  assert.notEqual(a.request.prematch.rngSeed,
    b.request.prematch.rngSeed,'fixture RNG must be career-specific');
  assert.deepEqual(
    prepareM1V188LeagueMatch(first,left.journal).request,
    a.request,'same saved seed must deterministically replay');
  assert.deepEqual(
    prepareM1V188LeagueMatch(second,right.journal).request,
    b.request,'another saved seed must deterministically replay');
});
