import evidence from '../data/m1-p5-v111-fuzz-observed.json' with {type:'json'};
const names=['baseline','candidateA','candidateB'];
const fields=['matches','shots','onTarget','goals','xgMilli'];
const fail=what=>{throw Error('V111_PIN_'+what)};
const isInt=x=>Number.isSafeInteger(x)&&x>=0;
export function verifyM1V111Observed(input=evidence){
  if(!input||input.schemaVersion!==1||
      input.status!=='P5_V111_OBSERVED_INDEPENDENT_FUZZ_NOT_RELEASE_ACCEPTANCE'||
      input.source?.headSha!=='76109ebc49055fae21a8e885cbd7214e56b8dacc'||
      input.source?.workflowRunId!==41035823871||
      input.source?.seedDomain!=='footclubsim-v111-fuzz-v1'||
      input.source?.fixtureGroups!==4||input.source?.fixturesPerGroup!==4||
      input.source?.seedsPerFixture!==16||input.source?.modelCandidates!==3||
      !Array.isArray(input.shards)||input.shards.length!==4)
    fail('SOURCE_IDENTITY');
  const uniqueJobs=new Set(),uniqueDigests=new Set();
  const totals=Object.fromEntries(names.map(name=>[name,
    Object.fromEntries(fields.map(field=>[field,0]))]));
  for(let group=0;group<4;group++){
    const row=input.shards[group];
    if(!row||row.group!==group||!isInt(row.jobId)||
        uniqueJobs.has(row.jobId)||row.distinctSeeds!==64||
        row.negativeChecks!==4||
        !/^[a-f0-9]{64}$/.test(row.resultSha256)||
        uniqueDigests.has(row.resultSha256)||
        !Number.isFinite(row.timing?.observedWallMs)||
        row.timing.observedWallMs<=0||row.timing.observedWallMs>300000||
        !Number.isFinite(row.timing?.observedPeakRssMiB)||
        row.timing.observedPeakRssMiB<=0||
        row.timing.observedPeakRssMiB>1024)
      fail('SHARD_IDENTITY');
    uniqueJobs.add(row.jobId);
    uniqueDigests.add(row.resultSha256);
    if(Object.keys(row.totals).sort().join('|')!==[...names].sort().join('|'))
      fail('CANDIDATE_COVERAGE');
    for(const name of names){
      const count=row.totals[name];
      if(!count||Object.keys(count).sort().join('|')!==[...fields].sort().join('|')||
          !fields.every(f=>isInt(count[f]))||count.matches!==64||
          count.goals>count.onTarget||count.onTarget>count.shots||
          count.shots>count.matches*54)fail('CONSERVATION');
      for(const f of fields)totals[name][f]+=count[f];
    }
  }
  for(const name of names){
    if(totals[name].matches!==256||fields.some(f=>
        input.observedTotals?.[name]?.[f]!==totals[name][f]))
      fail('AGGREGATION');
  }
  const flags=input.interpretation;
  if(flags?.candidateGamesEach!==256||flags?.modelSimulations!==768||
      flags?.negativeChecks!==16||flags?.holdout2024_25Used!==false||
      flags?.providerTaxonomyAligned!==false||
      flags?.productionPerformanceAccepted!==false||
      flags?.releaseCalibrationAccepted!==false)fail('LIMITATIONS');
  return {shardCount:4,jobCount:uniqueJobs.size,negativeChecks:16,
    modelSimulations:768,totals,releaseCalibrationAccepted:false};
}
