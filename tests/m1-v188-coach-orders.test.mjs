import test from 'node:test';
import assert from 'node:assert/strict';
import {createSyntheticRplScaleCatalog}
  from '../dist/core/synthetic.js';
import {createInitialCareer} from '../dist/core/save.js';
import {startM1V188LeagueJournal,prepareM1V188LeagueMatch,
  applyM1V188LeagueMatch,validateM1V188LeagueJournal}
  from '../dist/core/m1-v188-league-source-journal.js';
import {admitM1V188CoachOrders,verifyM1V188CoachOrders}
  from '../dist/core/m1-v188-coach-orders.js';

const catalog=createSyntheticRplScaleCatalog(2026);
const selected=catalog.clubs[0].id;
function setup(seed){
  const career=createInitialCareer(catalog,selected,seed,
    'coach-orders-'+seed);
  const started=startM1V188LeagueJournal(career);
  assert.ok(started.ok);
  return{career,journal:started.journal};
}
function plan(prematch){
  const own=prematch.fixture.homeClubId===selected?
    prematch.homeTactics:prematch.awayTactics;
  return{...own,schemaVersion:2,formation:'3-4-3',
    mentality:2,pressing:100,tempo:100};
}
const readOrders=(proposal)=>proposal.request.plannedCommands.filter(
  c=>c.kind==='set-tactics'||c.kind==='set-player-focus');

test('tactical order enters exactly the selected second and replays from source',()=>{
  const {career,journal}=setup(515);
  const baseline=prepareM1V188LeagueMatch(career,journal);
  assert.ok(baseline?.ok);
  const coaching=[{kind:'team-tactics',elapsedSeconds:2700,
    plan:plan(baseline.request.prematch)}];
  const prepared=prepareM1V188LeagueMatch(career,journal,[],
    undefined,undefined,undefined,undefined,coaching);
  assert.ok(prepared?.ok);
  assert.equal(prepared.request.inMatchOrdersVersion,1);
  assert.equal(prepared.request.conditionPolicyVersion,2);
  const orders=readOrders(prepared);
  assert.equal(orders.length,1);
  assert.equal(orders[0].elapsedSeconds,2700);
  assert.equal(orders[0].teamId,selected);
  assert.deepEqual(admitM1V188CoachOrders(
    prepared.request.prematch,selected,coaching),orders);
  assert.equal(verifyM1V188CoachOrders(
    prepared.request.prematch,selected,orders),true);
  const before=JSON.stringify(journal);
  const applied=applyM1V188LeagueMatch(career,journal,prepared.request);
  assert.equal(applied.ok,true);
  if(!applied.ok)return;
  assert.equal(JSON.stringify(journal),before);
  assert.equal(validateM1V188LeagueJournal(career,applied.journal).ok,true);
  assert.equal(applied.journal.entries[0].source.inMatchOrdersVersion,1);
  assert.deepEqual(applied.journal.entries[0].source.plannedCommands,
    prepared.request.plannedCommands);
  const original=baseline.request.result.events.filter(e=>
    e.elapsedSeconds<=2700);
  const changed=prepared.request.result.events.filter(e=>
    e.elapsedSeconds<=2700);
  assert.deepEqual(changed,original,
    'future tactical instruction cannot modify source events before time');
});

test('coach may order player focus only for an eligible active own outfielder',()=>{
  const {career,journal}=setup(616);
  const baseline=prepareM1V188LeagueMatch(career,journal);
  assert.ok(baseline?.ok);
  const input=baseline.request.prematch;
  const lineup=input.fixture.homeClubId===selected?
    input.homeLineup:input.awayLineup;
  const positions=new Map(catalog.players.map(p=>[p.id,p.primaryPosition]));
  const playerId=lineup.starters.find(id=>positions.get(id)!=='GK');
  assert.ok(playerId);
  const coaching=[{kind:'player-focus',elapsedSeconds:300,
    playerId,focus:'attack'}];
  const admitted=admitM1V188CoachOrders(input,selected,coaching);
  assert.ok(admitted);
  assert.equal(admitted[0].kind,'set-player-focus');
  assert.equal(admitted[0].actor.kind,'player');
  assert.equal(verifyM1V188CoachOrders(input,selected,admitted),true);
  const forged=structuredClone(admitted);
  forged[0].teamId=input.fixture.homeClubId===selected?
    input.fixture.awayClubId:input.fixture.homeClubId;
  assert.equal(verifyM1V188CoachOrders(input,selected,forged),false);
  assert.equal(admitM1V188CoachOrders(input,selected,[{
    ...coaching[0],playerId:lineup.starters.find(id=>
      positions.get(id)==='GK'),
  }]),null);
  assert.equal(admitM1V188CoachOrders(input,selected,[{
    ...coaching[0],elapsedSeconds:301,
  }]),null);
});

test('individual focus order is admitted into physical source and CAS',()=>{
  const {career,journal}=setup(818);
  const baseline=prepareM1V188LeagueMatch(career,journal);
  assert.ok(baseline?.ok);
  const input=baseline.request.prematch;
  const lineup=input.fixture.homeClubId===selected?
    input.homeLineup:input.awayLineup;
  const positions=new Map(catalog.players.map(p=>[p.id,p.primaryPosition]));
  let accepted=null;
  for(const playerId of lineup.starters.filter(id=>
    positions.get(id)!=='GK')){
    const prepared=prepareM1V188LeagueMatch(career,journal,[],
      undefined,undefined,undefined,undefined,[{
        kind:'player-focus',elapsedSeconds:300,
        playerId,focus:'attack',
      }]);
    if(prepared?.ok){
      accepted=prepared;
      break;
    }
  }
  assert.ok(accepted,'at least one active own outfielder must accept focus');
  const orders=readOrders(accepted);
  assert.equal(orders.length,1);
  assert.equal(orders[0].kind,'set-player-focus');
  assert.equal(orders[0].elapsedSeconds,300);
  const applied=applyM1V188LeagueMatch(career,journal,accepted.request);
  assert.ok(applied.ok);
  assert.equal(validateM1V188LeagueJournal(career,applied.journal).ok,true);
});

test('half-time substitution and tactical change share a canonical source',()=>{
  const {career,journal}=setup(919);
  const base=prepareM1V188LeagueMatch(career,journal);
  assert.ok(base?.ok);
  const prematch=base.request.prematch;
  const lineup=prematch.fixture.homeClubId===selected?
    prematch.homeLineup:prematch.awayLineup;
  const positions=new Map(catalog.players.map(p=>[p.id,p.primaryPosition]));
  const outgoing=lineup.starters.filter(id=>
    positions.get(id)!=='GK');
  const incoming=lineup.bench.filter(id=>positions.get(id)!=='GK');
  let combined=null;
  for(const outPlayerId of outgoing){
    for(const inPlayerId of incoming){
      const attempted=prepareM1V188LeagueMatch(career,journal,
        [{outPlayerId,inPlayerId,elapsedSeconds:2700}],
        undefined,undefined,undefined,undefined,[{
          kind:'team-tactics',elapsedSeconds:2700,
          plan:plan(prematch),
        }]);
      if(attempted?.ok){combined=attempted;break;}
    }
    if(combined)break;
  }
  assert.ok(combined,'a legal half-time substitution must coexist with tactics');
  assert.equal(combined.request.inMatchOrdersVersion,1);
  assert.equal(combined.request.plannedCommands.filter(c=>
    c.kind==='substitute-normal').length,1);
  assert.equal(readOrders(combined).length,1);
  const applied=applyM1V188LeagueMatch(career,journal,combined.request);
  assert.ok(applied.ok);
  assert.equal(validateM1V188LeagueJournal(career,applied.journal).ok,true);
});

test('orders fail closed on foreign team, duplicate, malformed or forged data',()=>{
  const {career,journal}=setup(717);
  const baseline=prepareM1V188LeagueMatch(career,journal);
  assert.ok(baseline?.ok);
  const input=baseline.request.prematch;
  const ownPlan=plan(input);
  const good={kind:'team-tactics',elapsedSeconds:2700,plan:ownPlan};
  assert.equal(admitM1V188CoachOrders(input,'nonparticipant',[good]),null);
  assert.equal(admitM1V188CoachOrders(input,selected,[good,good]),null);
  assert.equal(admitM1V188CoachOrders(input,selected,[{
    ...good,plan:{...ownPlan,clubId:'opponent'},
  }]),null);
  assert.equal(admitM1V188CoachOrders(input,selected,[{
    ...good,elapsedSeconds:5400,
  }]),null);
  const valid=prepareM1V188LeagueMatch(career,journal,[],
    undefined,undefined,undefined,undefined,[good]);
  assert.ok(valid?.ok);
  const forged=structuredClone(valid.request);
  forged.plannedCommands.find(c=>c.kind==='set-tactics')
    .plan.mentality=-2;
  assert.equal(applyM1V188LeagueMatch(career,journal,forged).ok,false);
  const missing=structuredClone(valid.request);
  delete missing.inMatchOrdersVersion;
  assert.equal(applyM1V188LeagueMatch(career,journal,missing).ok,false);
  const extra=structuredClone(valid.request);
  extra.inMatchOrdersVersion=2;
  assert.equal(applyM1V188LeagueMatch(career,journal,extra).ok,false);
});

test('future match chance source changes from selected-half tactics',()=>{
  let differences=0;
  for(const seed of [11,22,33,44]){
    const {career,journal}=setup(seed);
    const baseline=prepareM1V188LeagueMatch(career,journal);
    assert.ok(baseline?.ok);
    const changed=prepareM1V188LeagueMatch(career,journal,[],
      undefined,undefined,undefined,undefined,[{
        kind:'team-tactics',elapsedSeconds:2700,
        plan:plan(baseline.request.prematch),
      }]);
    assert.ok(changed?.ok);
    if(JSON.stringify(baseline.request.result.events.filter(e=>
      e.elapsedSeconds>2700))!==
        JSON.stringify(changed.request.result.events.filter(e=>
          e.elapsedSeconds>2700)))differences++;
  }
  assert.ok(differences>0,
    'post-order chances must depend on changed tactical state');
});
