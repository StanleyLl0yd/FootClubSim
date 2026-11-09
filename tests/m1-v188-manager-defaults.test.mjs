import test from 'node:test';
import assert from 'node:assert/strict';
import {createSyntheticRplScaleCatalog}
  from '../dist/core/synthetic.js';
import {createInitialCareer} from '../dist/core/save.js';
import {startM1V188LeagueJournal,prepareM1V188LeagueMatch,
  applyM1V188LeagueMatch}
  from '../dist/core/m1-v188-league-source-journal.js';
import {deriveM1V188RememberedXI}
  from '../dist/core/m1-v188-manager-defaults.js';

const catalog=createSyntheticRplScaleCatalog(2026);
const career=createInitialCareer(
  catalog,catalog.clubs[0].id,17,'v188-manager-remembered');
const zero=startM1V188LeagueJournal(career);
if(!zero.ok)throw Error(zero.error);
const first=prepareM1V188LeagueMatch(career,zero.journal);
assert.equal(first?.ok,true);
const p=first.request.prematch;
const mine=p.fixture.homeClubId===career.selectedClubId?
  p.homeLineup:p.awayLineup;
const tactics=p.fixture.homeClubId===career.selectedClubId?
  p.homeTactics:p.awayTactics;
const chosen={schemaVersion:1,clubId:career.selectedClubId,
  starters:[...mine.starters],tactics:{...tactics,
    formation:'4-4-2',pressing:70,tempo:80}};
const played=prepareM1V188LeagueMatch(career,zero.journal,[],
  undefined,undefined,chosen);
assert.equal(played?.ok,true);
const one=applyM1V188LeagueMatch(career,zero.journal,played.request);
assert.equal(one.ok,true);
let progress=one.journal;
let next=null;
for(let i=0;i<16;i++){
  next=prepareM1V188LeagueMatch(career,progress);
  assert.equal(next?.ok,true);
  if(next.selectedClubFixture)break;
  const committed=applyM1V188LeagueMatch(career,progress,next.request);
  assert.equal(committed.ok,true);
  progress=committed.journal;
}
assert.ok(next?.selectedClubFixture);
const upcoming=next.request.prematch;
const baseline=upcoming.fixture.homeClubId===career.selectedClubId?
  upcoming.homeLineup:upcoming.awayLineup;

test('after another club fixtures, same eleven and tactics are restored',()=>{
  assert.equal(deriveM1V188RememberedXI(career,zero.journal,upcoming),null);
  const remembered=deriveM1V188RememberedXI(career,progress,upcoming);
  assert.ok(remembered);
  const eligible=new Set([...baseline.starters,...baseline.bench]);
  const retained=chosen.starters.filter(id=>eligible.has(id));
  assert.ok(retained.every(id=>remembered.starters.includes(id)),
    'An eligible previous starter was dropped');
  assert.ok(remembered.starters.every(id=>eligible.has(id)),
    'An unavailable player was reused');
  assert.equal(remembered.starters.length,11);
  assert.equal(new Set(remembered.starters).size,11);
  assert.equal(remembered?.tactics.formation,'4-4-2');
  assert.equal(remembered?.tactics.pressing,70);
  assert.equal(remembered?.tactics.tempo,80);
  const replay=prepareM1V188LeagueMatch(career,progress,[],
    undefined,undefined,remembered);
  assert.equal(replay?.ok,true);
});

test('unavailable starter falls back only to eligible lineup players',()=>{
  const removed=chosen.starters.find(id=>
    catalog.players.find(p=>p.id===id).primaryPosition!=='GK');
  assert.ok(removed);
  const missing={
    ...upcoming,
    [upcoming.fixture.homeClubId===career.selectedClubId?
      'homeLineup':'awayLineup']:{
      ...baseline,starters:baseline.starters.filter(id=>id!==removed),
      bench:baseline.bench.filter(id=>id!==removed),
    },
  };
  const remembered=deriveM1V188RememberedXI(career,progress,missing);
  assert.ok(remembered);
  assert.equal(remembered.starters.length,11);
  assert.equal(remembered.starters.includes(removed),false);
  assert.equal(remembered.tactics.pressing,70);
});
