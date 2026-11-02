import test from 'node:test';
import assert from 'node:assert/strict';
import {createSyntheticRplScaleCatalog}
  from '../dist/core/synthetic.js';
import {createInitialCareer} from '../dist/core/save.js';
import {startM1V120Journal,applyM1V120Source,
  validateM1V120Journal}
  from '../dist/core/m1-v120-playable-journal.js';
import {prepareM1V166CombinedMatch}
  from '../dist/core/m1-v166-combined-playable.js';

const catalog=createSyntheticRplScaleCatalog(2026);

test('v170 10-player red-card restart uses physical XI for later shots',()=>{
  let selected=null;
  for(let seed=1;seed<=40;seed++){
    const career=createInitialCareer(catalog,catalog.clubs[0].id,
      seed,'v170-red-physical-'+seed);
    const started=startM1V120Journal(career);
    assert.equal(started.ok,true);
    const prepared=prepareM1V166CombinedMatch(
      career,started.journal,[]);
    if(!prepared?.ok)continue;
    const fixture=prepared.fixture;
    const teams={
      home:new Set(prepared.request.prematch.homeLineup.starters),
      away:new Set(prepared.request.prematch.awayLineup.starters),
    };
    let red=null, laterShots=0, hasTenPlayerRestart=false;
    for(const entry of prepared.request.result.events){
      if(entry.type!=='source')continue;
      const event=entry.source;
      if(event.type==='physical-transition'){
        const change=event.source;
        if(change.type!=='availability')continue;
        const action=change.source.entry.action;
        const side=action.teamId===fixture.homeClubId?'home':'away';
        const active=teams[side];
        if(action.kind==='substitute-normal'){
          assert.equal(active.delete(action.outPlayerId),true);
          assert.equal(active.has(action.inPlayerId),false);
          active.add(action.inPlayerId);
        }else if(change.source.entry.effect!=='yellow'){
          const before=active.size;
          assert.equal(active.delete(action.playerId),true);
          if(action.kind==='direct-red'&&before===11&&active.size===10){
            red={teamId:action.teamId,playerId:action.playerId,
              elapsedSeconds:entry.elapsedSeconds};
            hasTenPlayerRestart=true;
            laterShots=0;
          }
        }
      }else if(event.type==='shot'){
        const side=event.teamId===fixture.homeClubId?'home':'away';
        assert.equal(teams[side].has(event.playerId),true,
          'A shot must come from the current physical XI');
        if(red&&event.teamId===red.teamId&&
            entry.elapsedSeconds>red.elapsedSeconds){
          laterShots++;
          assert.notEqual(event.playerId,red.playerId,
            'A red-card player cannot take another shot');
        }
      }
    }
    if(!hasTenPlayerRestart||!laterShots)continue;
    selected={career,started,prepared,red,laterShots};
    break;
  }
  assert.ok(selected,
    'Fixed synthetic cohort must have a 10-player red restart and later shots');
  const {career,started,prepared,red,laterShots}=selected;
  assert.ok(laterShots>0);
  assert.ok(red);
  const accepted=applyM1V120Source(
    career,started.journal,prepared.request);
  assert.equal(accepted.ok,true,JSON.stringify(accepted).slice(0,300));
  assert.equal(validateM1V120Journal(career,accepted.journal).ok,true);
  const forged=structuredClone(prepared.request);
  const target=forged.plannedCommands.find(c=>
    c.kind==='direct-red'&&c.playerId===red.playerId&&
    c.teamId===red.teamId);
  assert.ok(target);
  target.playerId+='-forged';
  assert.deepEqual(applyM1V120Source(
    career,started.journal,forged),
  {ok:false,error:'SOURCE_REPLAY_REJECTED'});
});
