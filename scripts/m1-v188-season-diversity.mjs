import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {writeFileSync} from 'node:fs';
import {performance} from 'node:perf_hooks';
import {createLigaPrikolovPreviewCatalog}
  from '../dist/app/ligaPrikolovPreviewCatalog.js';
import {createInitialCareer} from '../dist/core/save.js';
import {startM1V188LeagueJournal,prepareM1V188LeagueMatch,
  applyM1V188LeagueMatch,validateM1V188LeagueJournal}
  from '../dist/core/m1-v188-league-source-journal.js';
import {deriveM1V188ProvisionalTable}
  from '../dist/core/m1-v188-provisional-table.js';

const argument=(prefix)=>process.argv.find(s=>s.startsWith(prefix))
  ?.slice(prefix.length);
const seedArg=argument('--seeds=')??'11,41,71,101';
const seeds=seedArg.split(',').map(s=>{
  if(!/^[1-9]\d*$/.test(s))throw Error('Bad seed: '+s);
  const n=Number(s);
  if(!Number.isSafeInteger(n)||n>0xffffffff)
    throw Error('Seed is not uint32: '+s);
  return n;
});
if(seeds.length<2||seeds.length>24||new Set(seeds).size!==seeds.length)
  throw Error('Provide 2–24 distinct uint32 seeds');
const catalog=createLigaPrikolovPreviewCatalog(2026);
assert.equal(catalog.clubs.length,16);
const clubName=new Map(catalog.clubs.map(c=>[c.id,c.name]));
const results=[];
for(const seed of seeds){
  const start=performance.now();
  // The preview catalog intentionally remains fixed: only the stored
  // per-career seed varies. This isolates fixture-outcome randomness
  // from changes in players, club strength, names or roster provenance.
  const career=createInitialCareer(catalog,catalog.clubs[0].id,
    seed,'diversity-career-'+seed);
  const opened=startM1V188LeagueJournal(career);
  assert.equal(opened.ok,true,'Could not start seeded career '+seed);
  let journal=opened.journal;
  for(let played=0;played<240;played++){
    const next=prepareM1V188LeagueMatch(career,journal);
    assert.ok(next?.ok,
      'Could not prepare fixture '+(played+1)+' for '+seed+': '+
      JSON.stringify(next));
    const committed=applyM1V188LeagueMatch(career,journal,next.request);
    assert.equal(committed.ok,true,
      'Could not commit fixture '+(played+1)+' for '+seed+': '+
      JSON.stringify(committed).slice(0,220));
    journal=committed.journal;
    if((played+1)%60===0){
      console.log('progress: seed='+seed+', fixtures='+(played+1)+
        '/240, elapsedSeconds='+((performance.now()-start)/1000).toFixed(1));
    }
  }
  assert.equal(journal.revision,240);
  assert.equal(validateM1V188LeagueJournal(career,journal).ok,true);
  const table=deriveM1V188ProvisionalTable(career,journal);
  assert.ok(table&&table.length===16,'Missing final table');
  assert.ok(table.every(t=>t.played===30&&
    t.won+t.drawn+t.lost===30),'Invalid full-season standings');
  assert.equal(table.reduce((sum,t)=>sum+t.goalsFor,0),
    table.reduce((sum,t)=>sum+t.goalsAgainst,0),
    'Goals scored/conceded across league must balance');
  assert.equal(table.reduce((sum,t)=>sum+t.won,0),
    table.reduce((sum,t)=>sum+t.lost,0),
    'Every win must correspond to a loss');
  const matchResults=journal.entries.map(e=>
    [e.fixtureId,e.result.report.home.goals,e.result.report.away.goals]);
  const digest=createHash('sha256')
    .update(JSON.stringify(matchResults)).digest('hex');
  const ranks=table.map((t,i)=>({
    rank:i+1,clubId:t.clubId,club:clubName.get(t.clubId),
    points:t.points,wins:t.won,draws:t.drawn,losses:t.lost,
    goalDifference:t.goalDifference,goalsFor:t.goalsFor,
  }));
  results.push({seed,fixtureCount:240,finalTableHash:digest,
    ordering:table.map(t=>t.clubId),
    champion:clubName.get(table[0].clubId),
    pointsChampion:table[0].points,
    selectedClubRank:table.findIndex(t=>
      t.clubId===career.selectedClubId)+1,
    totalGoals:table.reduce((sum,t)=>sum+t.goalsFor,0),
    elapsedSeconds:Number(((performance.now()-start)/1000).toFixed(2)),
    ranks});
  console.log('complete: seed='+seed+', champion='+
    clubName.get(table[0].clubId)+', ownRank='+
    results.at(-1).selectedClubRank+', digest='+digest.slice(0,12));
}
const uniqueOrderings=new Set(results.map(r=>r.ordering.join('|'))).size;
const uniqueResultDigests=new Set(results.map(r=>r.finalTableHash)).size;
const rankSpans=catalog.clubs.map(club=>{
  const positions=results.map(r=>r.ordering.indexOf(club.id)+1);
  return{club:club.name,minRank:Math.min(...positions),
    maxRank:Math.max(...positions)};
});
const report={
  provenance:'FootClubSim v188 preview, local source-replayed deterministic cohort',
  catalogId:catalog.packId,catalogVersion:catalog.packVersion,
  sampleSize:results.length,seeds,uniqueOrderings,uniqueResultDigests,
  champions:[...new Set(results.map(r=>r.champion))],
  movedClubs:rankSpans.filter(r=>r.minRank!==r.maxRank).length,
  rankSpans,results,
  caveat:'Reproducible prototype smoke, NOT competition realism calibration, '+
    'source rights clearance or owner acceptance.',
};
assert.ok(uniqueResultDigests>1,
  'Different career seeds must not produce identical entire match journals');
assert.ok(uniqueOrderings>1,
  'All sampled complete seasons had the same final club ordering');
assert.ok(report.movedClubs>0,
  'No sampled club changed its finishing rank');
const output=argument('--output=');
if(output)writeFileSync(output,JSON.stringify(report,null,2)+'\n');
console.log('SEASON DIVERSITY PASS: '+JSON.stringify({
  sampleSize:report.sampleSize,uniqueOrderings,uniqueResultDigests,
  distinctChampions:report.champions.length,movedClubs:report.movedClubs,
  selectedClubRanks:results.map(r=>r.selectedClubRank),
  totalGoals:results.map(r=>r.totalGoals),
}));
