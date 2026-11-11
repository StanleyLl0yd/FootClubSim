import test from 'node:test';
import assert from 'node:assert/strict';
import {createLigaPrikolovPreviewCatalog}
  from '../dist/app/ligaPrikolovPreviewCatalog.js';
import {createInitialCareer} from '../dist/core/save.js';
import {startM1V188LeagueJournal,prepareM1V188LeagueMatch,
  applyM1V188LeagueMatch,validateM1V188LeagueJournal}
  from '../dist/core/m1-v188-league-source-journal.js';
import {deriveM1V188RememberedXI}
  from '../dist/core/m1-v188-manager-defaults.js';

const catalog=createLigaPrikolovPreviewCatalog(2026);
const clubId='lp-vagon';
const positions=new Map(catalog.players.map(p=>[p.id,p.primaryPosition]));

test('preview selected-club second fixture after fatigued first managed XI',()=>{
  for(const seed of [11,77,241,777]){
    const initial=createInitialCareer(catalog,clubId,seed,
      'fatigued-managed-'+seed);
    const started=startM1V188LeagueJournal(initial);
    assert.ok(started.ok);
    let journal=started.journal,own=0;
    for(let i=0;i<40&&own<2;i++){
      const auto=prepareM1V188LeagueMatch(initial,journal,[],
        undefined,undefined,undefined,2);
      assert.ok(auto?.ok,'auto seed='+seed+' at '+journal.revision+
        ': '+JSON.stringify(auto));
      let prepared=auto;
      if(auto.selectedClubFixture){
        const input=auto.request.prematch;
        const local=input.fixture.homeClubId===clubId?
          input.homeLineup:input.awayLineup;
        const tactics=input.fixture.homeClubId===clubId?
          input.homeTactics:input.awayTactics;
        const manual=own===0?{
          schemaVersion:1,clubId,starters:[...local.starters],
          tactics:{...tactics,schemaVersion:2,formation:'4-4-2',
            mentality:1,pressing:70,tempo:80},
        }:deriveM1V188RememberedXI(initial,journal,input);
        assert.ok(manual,'No remembered XI for second own match');
        let changes=[];
        if(own===0){
          const out=local.starters.find(id=>positions.get(id)!=='GK');
          const incoming=local.bench.find(id=>positions.get(id)!=='GK');
          if(out&&incoming)changes=[{
            outPlayerId:out,inPlayerId:incoming,elapsedSeconds:2700,
          }];
        }
        const chosen=prepareM1V188LeagueMatch(initial,journal,
          changes,undefined,undefined,manual,2);
        assert.ok(chosen?.ok,'managed seed='+seed+', own='+own+
          ', revision='+journal.revision+': '+JSON.stringify(chosen));
        prepared=chosen;
        own++;
      }
      const applied=applyM1V188LeagueMatch(initial,journal,prepared.request);
      assert.ok(applied.ok,'apply seed='+seed+' at '+journal.revision+
        ': '+JSON.stringify(applied).slice(0,250));
      journal=applied.journal;
    }
    assert.equal(own,2,'did not reach second managed match');
    assert.equal(validateM1V188LeagueJournal(initial,journal).ok,true);
  }
});
