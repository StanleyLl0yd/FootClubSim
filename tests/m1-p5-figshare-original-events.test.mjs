import test from 'node:test';
import assert from 'node:assert/strict';
import {inspectOriginalFigshareEvents,inspectOriginalFigshareBytes,
  FIGSHARE_ORIGINAL_EVENTS}
  from '../scripts/m1-p5-figshare-original-events.mjs';

const fixture=(matchId,eventId,type,subType,tags=[],teamId=10)=>({
  id:eventId,matchId,teamId,playerId:0,
  eventId:10,eventName:type,subEventName:subType,
  matchPeriod:'1H',eventSec:eventId*3,
  positions:[],tags:tags.map(id=>({id})),
});
const cohort=()=>[
  fixture(111,1,'Shot','Shot',[101,1801]),
  fixture(111,2,'Save attempt','Save attempt',[101]),
  fixture(111,3,'Foul','Foul',[1702]),
  fixture(111,4,'Free Kick','Penalty',[101]),
  fixture(222,5,'Shot','Shot',[]),
  fixture(222,6,'Free Kick','Free kick shot',[1801]),
  fixture(222,7,'Foul','Foul',[1701]),
  fixture(222,8,'Foul','Foul',[1703]),
];
const cfg={competition:'England',expectedMatches:2};
const ok=data=>inspectOriginalFigshareEvents(data,cfg);

test('original-events mechanic cohort keeps free historical external scope',()=>{
  const data=cohort(),saved=structuredClone(data);
  const observed=ok(data);
  assert.deepEqual(data,saved);
  assert.deepEqual(ok(structuredClone(data)),observed);
  assert.equal(observed.schemaVersion,1);
  assert.equal(observed.status,
    'ORIGINAL_FIGSHARE_CROSS_LEAGUE_MECHANICS_NOT_RPL_CALIBRATION');
  assert.equal(FIGSHARE_ORIGINAL_EVENTS.publisherLicense,'CC BY 4.0');
  assert.equal(observed.sample.matches,2);
  assert.equal(observed.sample.events,8);
  const m=observed.observedPerMatch;
  assert.equal(m.ordinaryShots.total,2);
  assert.equal(m.penaltyAttempts.total,1);
  assert.equal(m.directFreeKickShots.total,1);
  assert.equal(m.cardYellowTags.total,1);
  assert.equal(m.cardDirectRedTags.total,1);
  assert.equal(m.cardSecondYellowTags.total,1);
  assert.equal(m.goalTaggedAttackingActions.total,2);
  assert.equal(m.goalTaggedGoalkeeperMirrors.total,1);
  assert.equal(m.eventCount.total,8);
  for(const metric of Object.values(m)){
    assert.equal(metric.count,2);
    assert.ok(metric.mean>=0);
    assert.equal(metric.mean,metric.total/2);
    assert.ok(metric.normalMean95.lower<=metric.mean);
    assert.ok(metric.mean<=metric.normalMean95.upper);
  }
  assert.equal(observed.matchesWithYellowTag.count,1);
  assert.equal(observed.matchesWithYellowTag.denominator,2);
  assert.equal(observed.matchesWithYellowTag.rate,0.5);
  assert.ok(observed.matchesWithYellowTag.wilson95.lower<0.5);
  assert.ok(observed.matchesWithYellowTag.wilson95.upper>0.5);
  assert.equal(observed.metricsUnavailable.rplCurrentRates,null);
  assert.equal(observed.metricsUnavailable.shotOnTarget,null);
  assert.equal(observed.metricsUnavailable.independentXg,null);
  assert.equal(observed.metricsUnavailable.clinicalInjuries,null);
  assert.equal(observed.externalBenchmarkAccepted,false);
  assert.equal(observed.rplRealismCalibrated,false);
});

test('original bytes retain SHA256 without outputting raw fixtures or people',()=>{
  const data=Buffer.from(JSON.stringify(cohort()));
  const x=inspectOriginalFigshareBytes(data,cfg);
  assert.match(x.sourceBytes.sha256,/^[0-9a-f]{64}$/);
  assert.equal(x.sourceBytes.byteCount,data.length);
  assert.equal(x.sourceBytes.classification,
    'CALLER_LOCAL_ORIGINAL_EXPORT_NOT_SELF_AUTHENTICATING');
  assert.equal(JSON.stringify(x).includes('"matchId":111'),false);
  assert.equal(JSON.stringify(x).includes('"matchId":222'),false);
  const changed=cohort();
  changed[0].eventName='Different';
  assert.notEqual(inspectOriginalFigshareBytes(
    Buffer.from(JSON.stringify(changed)),cfg).sourceBytes.sha256,
  x.sourceBytes.sha256);
});

test('invalid match classes, duplicate source events and tags refuse attribution',()=>{
  for(const bad of [
    {competition:'RPL',expectedMatches:2},
    {competition:'England',expectedMatches:0},
    {competition:'England',expectedMatches:501},
    {competition:'Spain',expectedMatches:3},
  ]){
    assert.throws(()=>inspectOriginalFigshareEvents(cohort(),bad));
  }
  const dup=cohort();dup[1].id=1;
  assert.throws(()=>ok(dup),/INVALID_ORIGINAL_EVENT/);
  const tag=cohort();tag[0].tags.push({id:101});
  assert.throws(()=>ok(tag),/DUPLICATE_EVENT_TAG/);
  const wrong=cohort();wrong[0].eventSec=-2;
  assert.throws(()=>ok(wrong),/INVALID_ORIGINAL_EVENT/);
  const leaked=cohort();leaked[0].matchId=0;
  assert.throws(()=>ok(leaked),/INVALID_ORIGINAL_EVENT/);
  const altered=cohort();altered[0].matchPeriod='P';
  assert.throws(()=>ok(altered),/INVALID_ORIGINAL_EVENT/);
  const missing=cohort().filter(x=>x.matchId===111);
  assert.throws(()=>ok(missing),/INCOMPLETE_MATCH_COVERAGE/);
});

test('untrusted getters, cycles, aliases and non-files cannot be used',()=>{
  assert.throws(()=>ok(null));
  assert.throws(()=>ok([]));
  assert.throws(()=>ok({events:cohort()}));
  const cycle=cohort();cycle[0].cycle=cycle;
  assert.throws(()=>ok(cycle));
  const alias=cohort();alias[1]=alias[0];
  assert.throws(()=>ok(alias));
  const input=cohort();
  let calls=0;
  Object.defineProperty(input[0],'eventName',{enumerable:true,get(){
    calls++;return 'Shot';
  }});
  assert.throws(()=>ok(input));
  assert.equal(calls,0);
  assert.throws(()=>inspectOriginalFigshareBytes(new Uint8Array(3),cfg),
    /INVALID_FILE_SIZE/);
  assert.throws(()=>inspectOriginalFigshareBytes(
    Buffer.from('{not json}'.repeat(5)),cfg));
});
