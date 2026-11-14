import test from 'node:test';
import assert from 'node:assert/strict';
import {createSyntheticRplScaleCatalog}
  from '../dist/core/synthetic.js';
import {createInitialCareer}
  from '../dist/core/save.js';
import {startM1V188LeagueJournal,prepareM1V188LeagueMatch,
  applyM1V188LeagueMatch,validateM1V188LeagueJournal}
  from '../dist/core/m1-v188-league-source-journal.js';

const catalog=createSyntheticRplScaleCatalog(2026);
const selected=catalog.clubs[0].id;
const seeds=[11,23,37,41,53,67,73,89,97,101,113,127];

/** Paired real v188 playable proposals, not the old standalone v5/v57
 * research engine. Only the selected manager's tempo is changed.
 * Both sides retain the same source roster, club identities and seed.
 */
test('P2: higher tempo produces directional playable-source shot opportunities across paired seeds',()=>{
  const sums={slowShots:0,fastShots:0,slowXg:0,fastXg:0};
  let changed=0;
  for(const seed of seeds){
    const initial=createInitialCareer(catalog,selected,seed,
      'p2-playable-tempo-'+seed);
    const started=startM1V188LeagueJournal(initial);
    assert.ok(started.ok);
    const before=JSON.stringify(started.journal);
    const baseline=prepareM1V188LeagueMatch(initial,started.journal,
      [],undefined,5,undefined,2);
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
    const slow=prepareM1V188LeagueMatch(initial,started.journal,
      [],undefined,5,managed(0),2);
    const fast=prepareM1V188LeagueMatch(initial,started.journal,
      [],undefined,5,managed(100),2);
    assert.ok(slow?.ok,'seed '+seed+' slow '+JSON.stringify(slow).slice(0,200));
    assert.ok(fast?.ok,'seed '+seed+' fast '+JSON.stringify(fast).slice(0,200));
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
});

/** P5-2: paired original playable journal, not the legacy isolated model. */
test('P5-2: source-replayed player attributes increase selected-club open-play xG',()=>{
  const selectedIds=new Set(catalog.clubs[0].registeredPlayerIds);
  const stronger=(skill)=>{
    const pack=structuredClone(catalog);
    pack.packVersion=catalog.packVersion+'-attack-'+skill;
    pack.players=pack.players.map(p=>selectedIds.has(p.id)?
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
    const baseline=prepareM1V188LeagueMatch(
      wi,w0.journal,[],undefined,5,undefined,2);
    assert.ok(baseline?.ok);
    assert.equal(baseline.selectedClubFixture,true);
    const ownHome=baseline.fixture.homeClubId===selected;
    const side=ownHome?'home':'away';
    const preset={schemaVersion:1,clubId:selected,
      starters:[...baseline.request.prematch[side+'Lineup'].starters],
      tactics:structuredClone(baseline.request.prematch[side+'Tactics'])};
    const wp=prepareM1V188LeagueMatch(wi,w0.journal,
      [],undefined,5,preset,2);
    const sp=prepareM1V188LeagueMatch(si,s0.journal,
      [],undefined,5,preset,2);
    assert.ok(wp?.ok&&sp?.ok,'source pair '+seed);
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
});
