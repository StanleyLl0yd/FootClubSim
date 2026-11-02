import test from 'node:test';
import assert from 'node:assert/strict';
import {createSyntheticRplScaleCatalog} from '../dist/core/synthetic.js';
import {createInitialCareer} from '../dist/core/save.js';
import {prepareM1V113PlayableMatch}
  from '../dist/core/m1-v113-browser-playtest.js';
import {deriveM1V118InternalRecovery}
  from '../dist/core/m1-v118-modelled-recovery.js';
import {startM1V8MatchJournal,applyM1V8MatchResult}
  from '../dist/core/m1-v8-result-journal.js';

function genuineInternalInjury() {
  const catalog=createSyntheticRplScaleCatalog(2026);
  for(let seed=1;seed<=96;seed++){
    const career=createInitialCareer(catalog,catalog.clubs[0].id,seed,
      'v156-recovery-source-negative-'+seed);
    const started=startM1V8MatchJournal(career);
    assert.equal(started.ok,true);
    const prepared=prepareM1V113PlayableMatch(
      career,started.journal,'internal-referee');
    assert.equal(prepared?.ok,true,JSON.stringify(prepared).slice(0,300));
    if(!prepared.request.plannedCommands.some(command=>
      command.kind==='injury-withdrawal'&&
      command.teamId===career.selectedClubId)) continue;
    if(prepared.request.plannedCommands.length<2) continue;
    const saved=applyM1V8MatchResult(career,started.journal,
      prepared.request);
    assert.equal(saved.ok,true,JSON.stringify(saved).slice(0,300));
    const item=saved.journal.results[0];
    assert.ok(deriveM1V118InternalRecovery(career,item).some(
      recovery=>recovery.clubId===career.selectedClubId));
    return {career,item};
  }
  assert.fail('No replay-verified multi-event selected-club injury in 96 fixed seeds');
}

test('v156 genuine recovery is source-bound and fails closed for command mutations',()=>{
  const {career,item}=genuineInternalInjury();
  const original=JSON.stringify(item);
  const trusted=deriveM1V118InternalRecovery(career,item);
  assert.ok(trusted.length>0);
  const commands=item.source.plannedCommands;
  const injuryIndex=commands.findIndex(command=>
    command.kind==='injury-withdrawal'&&
    command.teamId===career.selectedClubId);
  assert.ok(injuryIndex>=0);
  const alter=(change)=>{
    const forged=structuredClone(item);
    change(forged.source);
    assert.deepEqual(deriveM1V118InternalRecovery(career,forged),[]);
  };
  const changeIncident=(key,value)=>alter(source=>{
    source.plannedCommands[injuryIndex][key]=value;
  });
  alter(source=>source.plannedCommands.splice(injuryIndex,1));
  alter(source=>source.plannedCommands.push(
    structuredClone(source.plannedCommands[injuryIndex])));
  alter(source=>source.plannedCommands.reverse());
  changeIncident('id','forged-recovery-id');
  changeIncident('teamId','forged-team');
  changeIncident('playerId','forged-player');
  changeIncident('elapsedSeconds',commands[injuryIndex].elapsedSeconds+1);
  changeIncident('kind','caution');
  changeIncident('origin','trusted-referee');
  changeIncident('schemaVersion',2);
  alter(source=>delete source.plannedCommands[injuryIndex].origin);
  alter(source=>source.plannedCommands[injuryIndex].extra='forged');
  alter(source=>source.policy=null);
  alter(source=>source.prematch.rngSeed=null);
  alter(source=>source.medicalActions.push({kind:'unverified-clearance'}));
  alter(source=>source.trustedDecisions.push({kind:'unverified-referee'}));
  assert.equal(JSON.stringify(item),original);
  assert.deepEqual(deriveM1V118InternalRecovery(career,item),trusted);
});
