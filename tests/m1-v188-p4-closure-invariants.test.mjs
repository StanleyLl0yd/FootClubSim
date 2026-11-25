import test from 'node:test';
import assert from 'node:assert/strict';
import {createSyntheticRplScaleCatalog} from '../dist/core/synthetic.js';
import {createInitialCareer} from '../dist/core/save.js';
import {createLigaPrikolovPreviewCatalog}
  from '../dist/app/ligaPrikolovPreviewCatalog.js';
import {startM1V188LeagueJournal,prepareM1V188LeagueMatch,
  applyM1V188LeagueMatch,validateM1V188LeagueJournal,
  inspectM1V188FictionalHolds,inspectM1V188LeagueCalendar}
  from '../dist/core/m1-v188-league-source-journal.js';
import {deriveM1V188MatchDetails}
  from '../dist/core/m1-v188-match-details.js';
import {deriveM1V188ProvisionalTable}
  from '../dist/core/m1-v188-provisional-table.js';
import {startM1V188Condition,advanceM1V188Condition,
  deriveM1V188Condition} from '../dist/core/m1-v188-condition.js';
import {createM1V188PauseDraft,recoverM1V188PauseDraft}
  from '../dist/core/m1-v188-pause-draft.js';

const catalog=createSyntheticRplScaleCatalog(2026);
const chosen=catalog.clubs[0].id;
const initial=(seed,label)=>createInitialCareer(
  catalog,chosen,seed,'p4-source-proof-'+label+'-'+seed);

test('P4 source: find an actual 0-0 fixture; no invented goal/scorer',()=>{
  let witnessed=false;
  for(let seed=1;seed<=256&&!witnessed;seed++){
    const career=initial(seed,'zero');
    const started=startM1V188LeagueJournal(career);
    assert.ok(started.ok);
    const prepared=prepareM1V188LeagueMatch(career,started.journal);
    if(!prepared?.ok||prepared.request.result.report.home.goals!==0||
        prepared.request.result.report.away.goals!==0)continue;
    const before=JSON.stringify(started.journal);
    const applied=applyM1V188LeagueMatch(
      career,started.journal,prepared.request);
    assert.ok(applied.ok);
    assert.equal(JSON.stringify(started.journal),before);
    const entry=applied.journal.entries[0];
    const details=deriveM1V188MatchDetails(entry);
    assert.ok(details);
    assert.equal(details.home.goals,0);
    assert.equal(details.away.goals,0);
    assert.equal(details.incidents.filter(x=>
      ['goal','own-goal','penalty-goal'].includes(x.kind)).length,0);
    assert.equal(validateM1V188LeagueJournal(
      career,applied.journal).ok,true);
    assert.deepEqual(applyM1V188LeagueMatch(
      career,applied.journal,prepared.request),
    {ok:false,error:'STALE_REVISION'});
    witnessed=true;
  }
  assert.equal(witnessed,true,'Must prove a REAL v188 0-0 source fixture');
});

test('P4 multi-fixture source commits are atomic and update BOTH clubs',()=>{
  const career=initial(77,'batch');
  const started=startM1V188LeagueJournal(career);
  assert.ok(started.ok);
  let journal=started.journal;
  let condition=startM1V188Condition(career);
  const originally=JSON.stringify(journal);
  const unique=new Set();
  for(let index=0;index<8;index++){
    const oldBytes=JSON.stringify(journal);
    const proposal=prepareM1V188LeagueMatch(career,journal);
    assert.ok(proposal?.ok,'canonical match '+index);
    assert.equal(proposal.request.expectedRevision,index);
    const bad=structuredClone(proposal.request);
    bad.result.report.home.goals+=1;
    const refused=applyM1V188LeagueMatch(career,journal,bad);
    assert.equal(refused.ok,false);
    assert.equal(JSON.stringify(journal),oldBytes);
    const committed=applyM1V188LeagueMatch(
      career,journal,proposal.request);
    assert.ok(committed.ok,'atomic fixture '+index);
    const entry=committed.journal.entries[index];
    assert.equal(entry.fixtureId,proposal.fixture.id);
    assert.ok(!unique.has(entry.fixtureId));
    unique.add(entry.fixtureId);
    const report=deriveM1V188MatchDetails(entry);
    assert.ok(report);
    assert.equal(report.home.goals,entry.result.report.home.goals);
    assert.equal(report.away.goals,entry.result.report.away.goals);
    assert.equal(report.incidents.filter(x=>
      ['goal','own-goal','penalty-goal'].includes(x.kind)).length,
      report.home.goals+report.away.goals);
    const nextCondition=advanceM1V188Condition(career,condition,entry);
    assert.ok(nextCondition);
    condition=nextCondition;
    assert.equal(validateM1V188LeagueJournal(
      career,committed.journal).ok,true);
    assert.deepEqual(deriveM1V188Condition(
      career,committed.journal.entries),condition);
    assert.deepEqual(applyM1V188LeagueMatch(
      career,committed.journal,proposal.request),
    {ok:false,error:'STALE_REVISION'});
    assert.equal(JSON.stringify(journal),oldBytes);
    journal=committed.journal;
  }
  assert.equal(journal.revision,8);
  assert.equal(unique.size,8);
  assert.equal(JSON.stringify(started.journal),originally);
  const table=deriveM1V188ProvisionalTable(career,journal);
  assert.ok(table);
  assert.equal(table.length,16);
  assert.equal(table.reduce((sum,row)=>sum+row.played,0),16);
  assert.equal(table.reduce((sum,row)=>sum+row.goalsFor,0),
    table.reduce((sum,row)=>sum+row.goalsAgainst,0));
  assert.ok(table.every(row=>
    row.played===row.won+row.drawn+row.lost&&
    row.points===3*row.won+row.drawn));
  const holds=inspectM1V188FictionalHolds(career,journal);
  assert.equal(holds.ok,true);
  assert.equal(holds.journalRevision,8);
  assert.equal(holds.externalKdkAuthenticated,false);
  assert.equal(holds.officialClearanceAuthenticated,false);
  const replay=structuredClone(journal);
  replay.entries[0].result.report.home.goals+=1;
  assert.equal(validateM1V188LeagueJournal(career,replay).ok,false);
  assert.equal(JSON.stringify(journal),JSON.stringify(
    structuredClone(journal)));
});

test('P4 interrupted match is an uncommitted pause, not a second CAS',()=>{
  const career=initial(7070,'interrupted');
  const started=startM1V188LeagueJournal(career);
  assert.ok(started.ok);
  const before=JSON.stringify(started.journal);
  const proposal=prepareM1V188LeagueMatch(
    career,started.journal,[],undefined,undefined,undefined,2);
  assert.ok(proposal?.ok);
  const draft=createM1V188PauseDraft(proposal,45);
  assert.ok(draft);
  const recovered=recoverM1V188PauseDraft(
    career,started.journal,structuredClone(draft));
  assert.ok(recovered);
  assert.equal(JSON.stringify(started.journal),before,
    'a pause must never commit an implicit fixture');
  const applied=applyM1V188LeagueMatch(
    career,started.journal,recovered.proposal.request);
  assert.ok(applied.ok);
  assert.equal(applied.journal.revision,1);
  assert.equal(recoverM1V188PauseDraft(
    career,applied.journal,draft),null);
  const stale=applyM1V188LeagueMatch(
    career,applied.journal,recovered.proposal.request);
  assert.deepEqual(stale,{ok:false,error:'STALE_REVISION'});
  assert.equal(JSON.stringify(started.journal),before);
});

function checkSeededSourceProperties(useDefault){
  const profile=useDefault?createLigaPrikolovPreviewCatalog(2026):catalog;
  const seeds=[11,37,71,127];
  let verified=0,refused=0,medical=0,staleRefusals=0,future=0,pauses=0,holdChecks=0;
  for(const seed of seeds){
    const career=useDefault?createInitialCareer(profile,profile.clubs[0].id,
      seed,'p5-default-property-'+seed):initial(seed,'p5-property');
    const started=startM1V188LeagueJournal(career);
    assert.ok(started.ok);
    let journal=started.journal;
    const committed=new Set();
    const calendar=inspectM1V188LeagueCalendar(career,journal,useDefault?2:undefined);
    assert.ok(calendar.ok&&calendar.fixtureCount===240);
    const prepare=state=>prepareM1V188LeagueMatch(career,state,[],
      undefined,5,undefined,2,[],useDefault?2:undefined);
    for(let step=0;step<12;step++){
      const before=JSON.stringify(journal);
      const p=prepare(journal);
      assert.ok(p?.ok,'valid real source '+seed+'/'+step);
      assert.equal(p.request.expectedRevision,step);
      assert.ok(!committed.has(p.fixture.id));
      assert.equal(p.fixture.id,calendar.fixtures[step].id);
      if(useDefault){
        const holds=inspectM1V188FictionalHolds(career,journal);
        assert.ok(holds.ok);
        for(const side of ['home','away']){
          const club=p.fixture[side+'ClubId'];
          const lineup=p.request.prematch[side+'Lineup'];
          const players=new Set([...lineup.starters,...lineup.bench]);
          assert.equal(players.size,lineup.starters.length+lineup.bench.length);
          for(const hold of holds.holds.filter(h=>h.clubId===club&&
            (h.remainingOwnFixtures===null||h.remainingOwnFixtures>0))){
            holdChecks++;
            assert.equal(players.has(hold.playerId),false,'unexpired player hold');
          }
        }
      }
      // Each mutation is independent. No failed operation may change
      // even one byte of the authoritative previous journal.
      const failures=[
        r=>{r.expectedRevision=step+1;},
        r=>{r.commandId='v188-league-forged';},
        r=>{r.prematch.fixture.id='forged-fixture';},
        r=>{r.prematch.catalog.clubs[0].displayName='untrusted-club';},
        r=>{r.result.report.home.goals+=1;},
        r=>{r.autonomousMedicalOrigin=[{id:'forged-medical-witness'}];},
      ];
      if(useDefault)failures.push(
        r=>{delete r.fixtureCalendarPolicyVersion;},
        r=>{r.externalLeagueDecision={approved:true};},
        r=>{r.sourceLaw5Evidence=[{externalMedicalAuthorityAuthenticated:true}];},
      );
      for(const mutate of failures){
        const bad=structuredClone(p.request);
        mutate(bad);
        const result=applyM1V188LeagueMatch(career,journal,bad);
        assert.equal(result.ok,false,
          'forged input wrongly accepted for seed '+seed+' step '+step);
        assert.equal(JSON.stringify(journal),before);
        refused++;
      }
      const applied=applyM1V188LeagueMatch(career,journal,p.request);
      assert.ok(applied.ok,'source commit '+seed+'/'+step);
      if(useDefault&&p.selectedClubFixture){
        const draft=createM1V188PauseDraft(p,45);
        assert.ok(draft);
        const recovered=recoverM1V188PauseDraft(career,journal,structuredClone(draft));
        assert.ok(recovered);
        assert.deepEqual(recovered.proposal.request,p.request);
        const resumed=applyM1V188LeagueMatch(career,journal,recovered.proposal.request);
        assert.ok(resumed.ok);
        assert.deepEqual(resumed.journal,applied.journal,
          'uninterrupted and recovered no-new-order result must agree');
        assert.equal(recoverM1V188PauseDraft(career,applied.journal,draft),null);
        pauses++;
      }
      if(useDefault&&step===0){
        const next=prepare(applied.journal);
        assert.ok(next?.ok);
        assert.deepEqual(applyM1V188LeagueMatch(career,journal,next.request),
          {ok:false,error:'STALE_REVISION'},'genuine future request cannot skip history');
        assert.equal(JSON.stringify(journal),before);
        future++;
      }
      assert.equal(applied.journal.revision,step+1);
      assert.equal(JSON.stringify(journal),before);
      committed.add(p.fixture.id);
      const entry=applied.journal.entries[step];
      assert.equal(entry.source.medicalPolicyVersion,5);
      assert.equal(entry.source.specialGoalSourceVersion,2);
      assert.equal(entry.source.fixtureCalendarPolicyVersion,useDefault?2:undefined);
      assert.ok(Array.isArray(entry.source.autonomousMedicalOrigin));
      medical+=entry.source.autonomousMedicalOrigin.length;
      const detail=deriveM1V188MatchDetails(entry);
      assert.ok(detail);
      assert.equal(detail.home.goals+detail.away.goals,
        entry.result.report.home.goals+entry.result.report.away.goals);
      const cold=structuredClone(applied.journal);
      assert.equal(validateM1V188LeagueJournal(career,cold).ok,true,
        'cold source verification step '+step);
      const table=deriveM1V188ProvisionalTable(career,cold);
      assert.ok(table&&table.length===16);
      assert.equal(table.reduce((sum,row)=>sum+row.played,0),
        (step+1)*2);
      assert.equal(table.reduce((sum,row)=>sum+row.goalsFor,0),
        table.reduce((sum,row)=>sum+row.goalsAgainst,0));
      const stale=applyM1V188LeagueMatch(career,
        applied.journal,p.request);
      assert.deepEqual(stale,{ok:false,error:'STALE_REVISION'});
      assert.equal(applied.journal.revision,step+1);
      staleRefusals++;
      journal=applied.journal;
      verified++;
    }
    assert.equal(committed.size,12);
    assert.equal(validateM1V188LeagueJournal(career,
      structuredClone(journal)).ok,true);
  }
  assert.equal(verified,seeds.length*12);
  assert.equal(refused,verified*(useDefault?9:6));
  assert.equal(staleRefusals,verified);
  if(useDefault){
    assert.equal(future,seeds.length);
    assert.ok(pauses>=seeds.length&&holdChecks>0);
  }
  assert.ok(medical>0,
    'The invalid-stream campaign must cover real medical v5 witnesses');
  console.log('M1_V188_PROPERTY_EVIDENCE '+JSON.stringify({
    profile:useDefault?'default-preview-5-2-2':'legacy-calendar',
    seeds,verified,refused,medical,stale:staleRefusals,future,pauses,holdChecks,
  }));
}

test('P5-4: seeded two-club source streams reject tamper, duplicate, stale and out-of-order commits',()=>checkSeededSourceProperties(false));
test('P3-4/P5-4: default preview source rejects tamper and matches uninterrupted versus restored pauses',()=>checkSeededSourceProperties(true));
