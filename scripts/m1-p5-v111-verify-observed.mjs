import evidence from '../data/m1-p5-v111-fuzz-observed.json' with {type:'json'};
const names=['baseline','candidateA','candidateB'];
const fields=['matches','shots','onTarget','goals','xgMilli'];
// Immutable observations independently matched to the original four GitHub job logs.
const PINNED_SHARDS=[
  {
    "jobId": 123996266757,
    "resultSha256": "f685cdea41b7ed76de4bbd8eb2feb7e83d60eb8de838c076732e5b827f3ce1ac",
    "totals": {
      "baseline": {
        "matches": 64,
        "shots": 1393,
        "onTarget": 728,
        "goals": 270,
        "xgMilli": 257827
      },
      "candidateA": {
        "matches": 64,
        "shots": 1532,
        "onTarget": 581,
        "goals": 188,
        "xgMilli": 176112
      },
      "candidateB": {
        "matches": 64,
        "shots": 1532,
        "onTarget": 561,
        "goals": 183,
        "xgMilli": 170419
      }
    }
  },
  {
    "jobId": 123996266630,
    "resultSha256": "521b137337e7ea779ad7867540358535209d9dbd4e1ee51c13872fc4253573af",
    "totals": {
      "baseline": {
        "matches": 64,
        "shots": 1333,
        "onTarget": 677,
        "goals": 235,
        "xgMilli": 252096
      },
      "candidateA": {
        "matches": 64,
        "shots": 1457,
        "onTarget": 519,
        "goals": 154,
        "xgMilli": 170686
      },
      "candidateB": {
        "matches": 64,
        "shots": 1457,
        "onTarget": 496,
        "goals": 151,
        "xgMilli": 165199
      }
    }
  },
  {
    "jobId": 123996266692,
    "resultSha256": "0a45ba79fe327f66a49dc9390b5bd2b0f07ccbd2ed4ec4a3eeaff8b0e527a0d2",
    "totals": {
      "baseline": {
        "matches": 64,
        "shots": 1338,
        "onTarget": 670,
        "goals": 254,
        "xgMilli": 248624
      },
      "candidateA": {
        "matches": 64,
        "shots": 1441,
        "onTarget": 547,
        "goals": 174,
        "xgMilli": 166109
      },
      "candidateB": {
        "matches": 64,
        "shots": 1441,
        "onTarget": 523,
        "goals": 167,
        "xgMilli": 160752
      }
    }
  },
  {
    "jobId": 123996266781,
    "resultSha256": "2403666d13c1aee4fac6849fa368c8c01e20ce48d33dba15d8725ed0ee042091",
    "totals": {
      "baseline": {
        "matches": 64,
        "shots": 1335,
        "onTarget": 656,
        "goals": 224,
        "xgMilli": 247989
      },
      "candidateA": {
        "matches": 64,
        "shots": 1457,
        "onTarget": 521,
        "goals": 152,
        "xgMilli": 168951
      },
      "candidateB": {
        "matches": 64,
        "shots": 1457,
        "onTarget": 496,
        "goals": 151,
        "xgMilli": 163457
      }
    }
  }
];
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
    if(row.jobId!==PINNED_SHARDS[group].jobId||
        row.resultSha256!==PINNED_SHARDS[group].resultSha256)
      fail('OBSERVED_SHARD');
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
      if(fields.some(f=>count[f]!==PINNED_SHARDS[group].totals[name][f]))
        fail('OBSERVED_SHARD');
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
