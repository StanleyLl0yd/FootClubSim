import test from 'node:test';
import assert from 'node:assert/strict';
import {createSyntheticRplScaleCatalog}
  from '../dist/core/synthetic.js';
import {createLigaPrikolovPreviewCatalog}
  from '../dist/app/ligaPrikolovPreviewCatalog.js';
import {createInitialCareer}
  from '../dist/core/save.js';
import {startM1V188LeagueJournal,prepareM1V188LeagueMatch,
  applyM1V188LeagueMatch,validateM1V188LeagueJournal}
  from '../dist/core/m1-v188-league-source-journal.js';

const seeds=[11,23,37,41,53,67,73,89,97,101,113,127];
const scenarios=[
  {name:'legacy calendar',catalog:createSyntheticRplScaleCatalog(2026),
    calendar:undefined},
  {name:'default preview calendar v2',catalog:createLigaPrikolovPreviewCatalog(2026),
    calendar:2},
];

const prepareFor=calendar=>(initial,journal,selection=undefined)=>
  prepareM1V188LeagueMatch(initial,journal,[],undefined,5,selection,2,[],calendar);

/** Paired real v188 playable proposals, not the old standalone v5/v57
 * research engine. Only the selected manager's tempo is changed.
 * Both sides retain the same source roster, club identities and seed.
 */
function checkTempo({name,catalog,calendar}){
  const selected=catalog.clubs[0].id;
  const prepare=prepareFor(calendar);
  const sums={slowShots:0,fastShots:0,slowXg:0,fastXg:0};
  let changed=0;
  for(const seed of seeds){
    const initial=createInitialCareer(catalog,selected,seed,
      'p2-playable-tempo-'+seed);
    const started=startM1V188LeagueJournal(initial);
    assert.ok(started.ok);
    const before=JSON.stringify(started.journal);
    const baseline=prepare(initial,started.journal);
    assert.ok(baseline?.ok,'seed '+seed+' baseline');
    const fixture=baseline.request.prematch.fixture;
    assert.equal(baseline.selectedClubFixture,true);
    const ownHome=fixture.homeClubId===selected;
    const lineup=ownHome?baseline.request.prematch.homeLineup:
      baseline.request.prematch.awayLineup;
    const tactics=ownHome?baseline.request.prematch.homeTactics:
      baseline.request.prematch.awayTactics;
    const managed=tempo=>({
      schemaVersion:1,clubId:selected,starters:[...lineup.starters],
      tactics:{...tactics,schemaVersion:2,tempo},
    });
    const slow=prepare(initial,started.journal,managed(0));
    const fast=prepare(initial,started.journal,managed(100));
    assert.ok(slow?.ok,'seed '+seed+' slow '+JSON.stringify(slow).slice(0,200));
    assert.ok(fast?.ok,'seed '+seed+' fast '+JSON.stringify(fast).slice(0,200));
    for(const proposal of [slow,fast]){
      assert.equal(proposal.request.medicalPolicyVersion,5);
      assert.equal(proposal.request.specialGoalSourceVersion,2);
      assert.equal(proposal.request.fixtureCalendarPolicyVersion,calendar);
    }
    assert.deepEqual(slow.request.prematch.fixture,fast.request.prematch.fixture);
    assert.equal(slow.request.prematch.rngSeed,fast.request.prematch.rngSeed);
    const own=ownHome?'home':'away';
    assert.deepEqual(slow.request.prematch[own+'Lineup'].starters,
      fast.request.prematch[own+'Lineup'].starters);
    assert.deepEqual({...slow.request.prematch[own+'Tactics'],tempo:100},
      fast.request.prematch[own+'Tactics']);
    const opposing=ownHome?'away':'home';
    assert.deepEqual(slow.request.prematch[opposing+'Tactics'],
      fast.request.prematch[opposing+'Tactics'],
      'opponent tactical inputs unchanged in paired experiment');
    assert.deepEqual(slow.request.prematch[opposing+'Lineup'],
      fast.request.prematch[opposing+'Lineup'],
      'opponent lineup unchanged in paired experiment');
    const slowSaved=applyM1V188LeagueMatch(
      initial,started.journal,slow.request);
    const fastSaved=applyM1V188LeagueMatch(
      initial,started.journal,fast.request);
    assert.ok(slowSaved.ok,'seed '+seed+' slow source/CAS');
    assert.ok(fastSaved.ok,'seed '+seed+' fast source/CAS');
    const side=ownHome?'home':'away';
    const a=slow.request.result.report[side];
    const b=fast.request.result.report[side];
    sums.slowShots+=a.shots;
    sums.fastShots+=b.shots;
    sums.slowXg+=a.xgMilli;
    sums.fastXg+=b.xgMilli;
    if(JSON.stringify(slow.request.result.events)!==
        JSON.stringify(fast.request.result.events))changed++;
    assert.equal(JSON.stringify(started.journal),before,
      'parallel source preparation/application never mutates original');
    if(seed===seeds[0]){
      assert.equal(validateM1V188LeagueJournal(
        initial,slowSaved.journal).ok,true);
      assert.equal(validateM1V188LeagueJournal(
        initial,fastSaved.journal).ok,true);
    }
  }
  assert.ok(changed>=seeds.length/2,
    'many same-seed playable match event streams must respond to tempo');
  assert.ok(sums.fastShots>sums.slowShots,
    'high tempo must produce more selected-club source shots in aggregate: '+
      JSON.stringify(sums));
  assert.ok(sums.fastXg>sums.slowXg,
    'high tempo must produce more selected-club open-play xG in aggregate: '+
      JSON.stringify(sums));
  console.log('M1_PAIRED_SENSITIVITY '+JSON.stringify({
    scenario:name,kind:'tempo',medical:5,goals:2,calendar:calendar??null,
    seedCount:seeds.length,changed,...sums,
  }));
}

/** P5-2: paired original playable journal, not the legacy isolated model. */
function checkAttributes({name,catalog,calendar}){
  const selected=catalog.clubs[0].id;
  const prepare=prepareFor(calendar);
  const selectedIds=new Set(catalog.clubs[0].registeredPlayerIds);
  const stronger=(skill)=>{
    const pack=structuredClone(catalog);
    pack.packVersion=catalog.packVersion+'-attack-'+skill;
    pack.players=pack.players.map(p=>selectedIds.has(p.id)&&
      (calendar!==2||p.primaryPosition!=='GK')?
      {...p,attributes:{...p.attributes,
        finishing:skill,composure:skill,offBallMovement:skill}}:p);
    return pack;
  };
  const weak=stronger(35),strong=stronger(75);
  let weakXg=0,strongXg=0,changed=0;
  for(const seed of seeds){
    const careerId='p5-player-attribute-pair-'+seed;
    const wi=createInitialCareer(weak,selected,seed,careerId);
    const si=createInitialCareer(strong,selected,seed,careerId);
    const w0=startM1V188LeagueJournal(wi);
    const s0=startM1V188LeagueJournal(si);
    assert.ok(w0.ok&&s0.ok);
    const baseline=prepare(wi,w0.journal);
    assert.ok(baseline?.ok);
    assert.equal(baseline.selectedClubFixture,true);
    const ownHome=baseline.fixture.homeClubId===selected;
    const side=ownHome?'home':'away';
    const preset={schemaVersion:1,clubId:selected,
      starters:[...baseline.request.prematch[side+'Lineup'].starters],
      tactics:structuredClone(baseline.request.prematch[side+'Tactics'])};
    const wp=prepare(wi,w0.journal,preset);
    const sp=prepare(si,s0.journal,preset);
    assert.ok(wp?.ok&&sp?.ok,'source pair '+seed);
    for(const proposal of [wp,sp]){
      assert.equal(proposal.request.medicalPolicyVersion,5);
      assert.equal(proposal.request.specialGoalSourceVersion,2);
      assert.equal(proposal.request.fixtureCalendarPolicyVersion,calendar);
    }
    assert.deepEqual(wp.request.prematch.fixture,sp.request.prematch.fixture);
    assert.equal(wp.request.prematch.rngSeed,sp.request.prematch.rngSeed);
    for(const key of ['homeTactics','awayTactics'])
      assert.deepEqual(wp.request.prematch[key],sp.request.prematch[key]);
    for(const key of ['homeLineup','awayLineup'])
      assert.deepEqual(wp.request.prematch[key].starters,
        sp.request.prematch[key].starters);
    const ws=applyM1V188LeagueMatch(wi,w0.journal,wp.request);
    const ss=applyM1V188LeagueMatch(si,s0.journal,sp.request);
    assert.ok(ws.ok&&ss.ok,'source/CAS after attribute change '+seed);
    weakXg+=wp.request.result.report[side].xgMilli;
    strongXg+=sp.request.result.report[side].xgMilli;
    if(JSON.stringify(wp.request.result.events)!==
       JSON.stringify(sp.request.result.events))changed++;
    if(seed===seeds[0]){
      assert.equal(validateM1V188LeagueJournal(wi,ws.journal).ok,true);
      assert.equal(validateM1V188LeagueJournal(si,ss.journal).ok,true);
    }
  }
  assert.ok(changed>=seeds.length/2,
    'Original source must reflect skill changes in multiple match streams');
  assert.ok(strongXg>weakXg*1.05,
    'Paired predeclared +5% xG sensitivity gate: '+
    JSON.stringify({weakXg,strongXg,changed}));
  console.log('M1_PAIRED_SENSITIVITY '+JSON.stringify({
    scenario:name,kind:'attacking-attributes',medical:5,goals:2,
    calendar:calendar??null,seedCount:seeds.length,changed,weakXg,strongXg,
  }));
}
for(const scenario of scenarios){
  const suffix=scenario.calendar===2?' (default preview calendar v2)':'';
  test('P2: higher tempo produces directional playable-source shot opportunities across paired seeds'+suffix,
    ()=>checkTempo(scenario));
  test('P5-2: source-replayed player attributes increase selected-club open-play xG'+suffix,
    ()=>checkAttributes(scenario));
}
