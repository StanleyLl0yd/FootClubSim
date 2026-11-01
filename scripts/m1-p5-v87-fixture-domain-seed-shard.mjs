import {argv} from 'node:process';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {researchFixtureSeedV87,runM1V86DisciplineSourceShard,
  V87_FIXTURE_SEEDS} from './m1-p5-v86-source-disciplinary-shard.mjs';

export function runM1V87IndependentRefereeShard(group){
  const report=runM1V86DisciplineSourceShard(group,'fixture-domain-v87');
  if(report.seedsPerFixture!==V87_FIXTURE_SEEDS||
      report.fixtureCount!==15||
      report.synthetic.attempted!==15*V87_FIXTURE_SEEDS||
      report.synthetic.accepted+report.synthetic.rejected!==
        report.synthetic.attempted||
      report.researchSeedStrategy!=='fixture-domain-v87'||
      !report.completePhysicalExposureReplay||
      report.productionProbabilityOrRngModified)
    throw Error('V87_SOURCE_RESEARCH_CONSERVATION');
  const mapped=new Set();
  for(const fixture of report.perFixture){
    for(let index=1;index<=V87_FIXTURE_SEEDS;index++){
      const seed=researchFixtureSeedV87(fixture.fixtureId,index);
      mapped.add(seed);
    }
  }
  if(mapped.size!==report.synthetic.attempted)
    throw Error('V87_FIXTURE_SEED_COLLISION');
  return{
    ...report,
    schemaVersion:1,
    status:'P5_V87_FIXTURE_DOMAIN_SEED_DIVERSITY_NOT_PRODUCTION_RECALIBRATION',
    fixtureIndexedSeedMapping:true,
    verifiedUniqueInputSeeds:mapped.size,
    fixtureVsIndexPairs:report.synthetic.attempted,
    reusedV86SourceEngine:true,
    officialRefereeOrKdkAuthorityAuthenticated:false,
    observedRedCardRateCanDependOnSeedStrategy:true,
    holdout2024_25Used:false,
    releaseCalibrationAccepted:false,
  };
}
if(argv[1]&&resolve(argv[1])===fileURLToPath(import.meta.url)){
  try{
    if(argv.length!==3||!/^(?:[0-9]|1[0-5])$/.test(argv[2]))
      throw Error('V87_EXPECTED_SHARD_0_TO_15');
    process.stdout.write('V87_SHARD_RESULT='+JSON.stringify(
      runM1V87IndependentRefereeShard(Number(argv[2])))+'\n');
  }catch(e){
    process.stderr.write('V87_SHARD_FAILED:'+
      (e instanceof Error?e.message:'UNKNOWN')+'\n');
    process.exitCode=1;
  }
}
