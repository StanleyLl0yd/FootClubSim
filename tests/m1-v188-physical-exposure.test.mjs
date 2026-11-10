import test from 'node:test';
import assert from 'node:assert/strict';
import {createSyntheticRplScaleCatalog}
  from '../dist/core/synthetic.js';
import {createInitialCareer} from '../dist/core/save.js';
import {startM1V188LeagueJournal,prepareM1V188LeagueMatch,
  applyM1V188LeagueMatch}
  from '../dist/core/m1-v188-league-source-journal.js';
import {deriveM1V188PhysicalExposure}
  from '../dist/core/m1-v188-physical-exposure.js';

const catalog=createSyntheticRplScaleCatalog(2026);
const career=createInitialCareer(catalog,catalog.clubs[0].id,
  11,'v188-exposure-source');
const zero=startM1V188LeagueJournal(career);
if(!zero.ok)throw Error(zero.error);
const proposal=prepareM1V188LeagueMatch(career,zero.journal);
if(!proposal?.ok)throw Error('No source-replayed fixture');
const applied=applyM1V188LeagueMatch(career,zero.journal,
  proposal.request);
if(!applied.ok)throw Error('No source-replayed applied fixture');
const entry=applied.journal.entries[0];

test('exact source clock yields bounded two-team physical exposure',()=>{
  const original=JSON.stringify(entry);
  const first=deriveM1V188PhysicalExposure(entry);
  assert.ok(first);
  assert.equal(first.fixtureId,entry.fixtureId);
  assert.equal(first.fatigueAndConditionApplied,false);
  assert.equal(first.runningMatchSeconds,5400);
  assert.ok(first.players.length>=22);
  assert.equal(new Set(first.players.map(p=>p.playerId)).size,
    first.players.length);
  for(const side of ['home','away']){
    const id=proposal.fixture[side+'ClubId'];
    const rows=first.players.filter(p=>p.teamId===id);
    const sum=rows.reduce((n,p)=>n+p.physicalSeconds,0);
    assert.ok(rows.length>=11&&rows.length<=23);
    assert.ok(rows.every(p=>Number.isSafeInteger(p.physicalSeconds)&&
      p.physicalSeconds>=0&&p.physicalSeconds<=5400));
    assert.equal(sum,first.teamPhysicalSeconds[side]);
    assert.ok(sum>0&&sum<=59400);
  }
  assert.deepEqual(deriveM1V188PhysicalExposure(entry),first);
  assert.equal(JSON.stringify(entry),original,
    'physical projection cannot change the trusted source');
});

test('halftime substitution moves only subsequent physical seconds',()=>{
  const base=proposal.request.prematch;
  const selected=career.selectedClubId;
  const own=proposal.fixture.homeClubId===selected?
    base.homeLineup:base.awayLineup;
  const positions=new Map(catalog.players.map(p=>[p.id,p.primaryPosition]));
  let accepted=null;
  for(const outgoing of own.starters.filter(id=>positions.get(id)!=='GK')){
    for(const incoming of own.bench.filter(id=>positions.get(id)!=='GK')){
      const prepared=prepareM1V188LeagueMatch(career,zero.journal,[{
        outPlayerId:outgoing,inPlayerId:incoming,elapsedSeconds:2700,
      }]);
      if(!prepared?.ok)continue;
      const updated=applyM1V188LeagueMatch(career,zero.journal,
        prepared.request);
      if(!updated.ok)continue;
      accepted={outgoing,incoming,entry:updated.journal.entries[0]};
      break;
    }
    if(accepted)break;
  }
  assert.ok(accepted,'No legal source-replayed halftime substitution');
  const exposure=deriveM1V188PhysicalExposure(accepted.entry);
  assert.ok(exposure);
  const former=exposure.players.find(p=>p.playerId===accepted.outgoing);
  const incoming=exposure.players.find(p=>p.playerId===accepted.incoming);
  assert.ok(former&&incoming);
  assert.equal(former.started,true);
  assert.equal(incoming.started,false);
  assert.ok(former.physicalSeconds<=2700);
  assert.ok(incoming.physicalSeconds<=2700);
  assert.equal(former.presentAtFullTime,false);
});

test('broken source event chronology cannot produce exposure',()=>{
  const forged=structuredClone(entry);
  forged.result.events[0].sequence=999;
  assert.equal(deriveM1V188PhysicalExposure(forged),null);
  const another=structuredClone(entry);
  another.source.prematch.fixture.id='wrong';
  assert.equal(deriveM1V188PhysicalExposure(another),null);
});
