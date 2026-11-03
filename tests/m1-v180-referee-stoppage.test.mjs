import test from 'node:test';
import assert from 'node:assert/strict';
import {createSyntheticRplScaleCatalog} from '../dist/core/synthetic.js';
import {createInitialCareer} from '../dist/core/save.js';
import {startM1V120Journal} from '../dist/core/m1-v120-playable-journal.js';
import {prepareM1V128ManualFictionalContinuation}
  from '../dist/core/m1-v128-manual-fictional-continuation.js';
import {prepareM1V166CombinedMatch}
  from '../dist/core/m1-v166-combined-playable.js';
import {simulateM1V19InternalReferee}
  from '../dist/core/m1-v19-internal-foul-injury.js';
import {verifyM1V158CommandShape,verifyM1V158SourceClaim}
  from '../dist/core/m1-v158-generated-goal-stops.js';
import {admitM1V171SourceWithHolds}
  from '../dist/core/m1-v171-precommit-holds.js';
import {reviewM1V126DenseSourceHolds}
  from '../dist/core/m1-v126-dense-source-holds.js';
import {projectM1V179MatchClock}
  from '../dist/core/m1-v179-source-clock.js';

test('v180 generated whistle survives source, holds and journal admission',()=>{
  const catalog=createSyntheticRplScaleCatalog(2026);
  const initial=createInitialCareer(catalog,catalog.clubs[0].id,
    1,'v180-referee-1');
  const started=startM1V120Journal(initial);
  assert.equal(started.ok,true);
  const journal=started.journal;
  const candidate=prepareM1V128ManualFictionalContinuation(initial,journal);
  assert.equal(candidate?.ok,true);
  const generated=simulateM1V19InternalReferee(
    candidate.request.prematch,candidate.request.policy);
  assert.equal(generated.ok,true);
  const incident=generated.generatedIncidents.at(-1);
  assert.ok(incident,'Expected a deterministic generated whistle');
  assert.equal(incident.elapsedSeconds,5100);
  const p=candidate.request.prematch;
  const own=p.fixture.homeClubId===initial.selectedClubId?
    p.homeLineup:p.awayLineup;
  const byId=new Map(catalog.players.map(player=>[player.id,player]));
  const leaving=own.starters.find(id=>
    byId.get(id)?.primaryPosition!=='GK'&&
    !generated.generatedIncidents.some(event=>
      event.teamId===initial.selectedClubId&&event.playerId===id&&
      event.elapsedSeconds<=incident.elapsedSeconds));
  const incoming=own.bench.find(id=>byId.get(id)?.primaryPosition!=='GK');
  assert.ok(leaving&&incoming);
  const prepared=prepareM1V166CombinedMatch(initial,journal,[{
    outPlayerId:leaving,inPlayerId:incoming,
    elapsedSeconds:incident.elapsedSeconds,
  }]);
  assert.equal(prepared?.ok,true,
    'Seeded whistle must admit a physical manager change');
  assert.equal(prepared.request.commandId,
    'v180-ref-whistle-'+candidate.fixture.id);
  const gate=admitM1V171SourceWithHolds(
    initial,journal,prepared.request);
  assert.equal(gate.ok,true,
    gate.ok?'':gate.error);
  assert.equal(gate.journal.revision,1);
  const holds=reviewM1V126DenseSourceHolds(initial,gate.journal);
  assert.equal(holds.ok,true,
    holds.ok?'':holds.error);
  assert.equal(holds.sourceVerifiedVirtualFixtures,1);
  assert.equal(holds.modelledIncidentCount,
    generated.generatedIncidents.length);
  const snap=projectM1V179MatchClock(
    prepared.request.prematch,prepared.request.result);
  assert.equal(snap.ok,true);
  assert.ok(snap.managerStopsFromSource.includes(incident.elapsedSeconds));
  assert.ok(snap.snapshots.some(x=>
    x.sourceKind==='physical-transition'&&
    x.runningSeconds===incident.elapsedSeconds));
  const forged=structuredClone(prepared.request);
  const refereeIndex=forged.plannedCommands.findIndex(c=>
    c.kind!=='substitute-normal'&&
    c.elapsedSeconds===incident.elapsedSeconds);
  assert.ok(refereeIndex>=0);
  forged.plannedCommands.splice(refereeIndex,1);
  const denied=admitM1V171SourceWithHolds(initial,journal,forged);
  assert.equal(denied.ok,false,'Removed whistle must not persist');
});

test('v158/v180 command-shape guards return false, never throw, on invalid JSON elements',()=>{
  const catalog=createSyntheticRplScaleCatalog(2026);
  const initial=createInitialCareer(catalog,catalog.clubs[0].id,7,'v180-invalid-shape');
  const started=startM1V120Journal(initial);
  assert.equal(started.ok,true);
  const p=prepareM1V128ManualFictionalContinuation(initial,started.journal);
  assert.equal(p?.ok,true);
  const args=[p.request.prematch,p.request.policy,p.fixture.id,
    initial.selectedClubId,initial.rngState];
  for(const invalid of [null,17,'forged',[],true]){
    assert.doesNotThrow(()=>verifyM1V158CommandShape(
      args[0],args[1],[invalid],args[2],args[3],args[4]));
    assert.equal(verifyM1V158CommandShape(
      args[0],args[1],[invalid],args[2],args[3],args[4]),false);
    assert.equal(verifyM1V158SourceClaim(
      args[0],args[1],[invalid],args[2],args[3],args[4]),false);
  }
});
