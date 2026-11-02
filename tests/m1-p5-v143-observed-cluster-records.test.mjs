import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {analyzeM1P5V142ClusterIntervals}
  from '../scripts/m1-p5-v142-cluster-intervals.mjs';

const root=new URL('../data/',import.meta.url);
const manifest=JSON.parse(readFileSync(new URL('m1-p5-v143-observed-manifest.json',root),'utf8'));
const source=readFileSync(new URL('m1-p5-v143-observed-careers.jsonl',root),'utf8');
const lines=source.split('\n');
const sha=text=>createHash('sha256').update(text,'utf8').digest('hex');
const near=(actual,expected)=>assert.ok(Math.abs(actual-expected)<1e-10,
  'Expected '+expected+', received '+actual);

test('v143 pinned original v141 job records reproduce exact SHA-256 and source',()=>{
  assert.equal(manifest.schemaVersion,143);
  assert.equal(manifest.sourceCommit,'66c71880e0bddd32f91503f91cff0030a79103ac');
  assert.equal(manifest.workflowRun,41353522380);
  assert.equal(manifest.independentUnit,'SEED_CAREER_NOT_FIXTURE');
  assert.equal(manifest.holdout2024_25Used,false);
  assert.equal(manifest.releaseP5Accepted,false);
  assert.equal(manifest.records.length,8);
  assert.equal(manifest.sourceLineCount,8);
  assert.equal(lines.at(-1),'');
  assert.equal(lines.length,9);
  for(let i=0;i<8;i++){
    const row=manifest.records[i];
    assert.equal(row.firstSeed,1+i*8);
    assert.equal(sha(lines[i]+'\n'),row.sha256);
    const data=JSON.parse(lines[i].slice('V141_CAREER_CLUSTERS='.length));
    assert.equal(data.firstSeed,row.firstSeed);
    assert.equal(data.seedCount,8);
    assert.equal(data.accepted,32);
    assert.equal(data.rejected,0);
    assert.equal(data.holdout2024_25Used,false);
  }
});
test('v143 independent career-cluster totals and intervals reproduce measured v131',()=>{
  const shards=lines.slice(0,-1).map(line=>{
    assert.ok(line.startsWith('V141_CAREER_CLUSTERS='));
    return JSON.parse(line.slice('V141_CAREER_CLUSTERS='.length));
  });
  const s=analyzeM1P5V142ClusterIntervals(shards);
  assert.equal(s.schemaVersion,142);
  assert.equal(s.clusters,64);
  assert.equal(s.accepted,256);
  assert.equal(s.attempted,256);
  assert.equal(s.rejected,0);
  assert.equal(s.intervalEligible,true);
  assert.equal(s.referenceCategoryAligned,false);
  assert.equal(s.releaseP5Accepted,false);
  const expected={goals:[3.59765625,3.3575667357485117,3.8377457642514883],
    shots:[20.61328125,20.107388092344266,21.119174407655734],
    onTarget:[10.17578125,9.797133424144112,10.554429075855888],
    openPlayXgMilli:[3.5731953125,3.4715373417682094,3.674853283231791],
    homeWins:[0.41015625,0.34898756793134966,0.47132493206865034],
    draws:[0.203125,0.15802853221980684,0.24822146778019316],
    awayWins:[0.38671875,0.323828125,0.449609375],
    cautions:[3.08984375,2.8825278342674743,3.2971596657325257],
    straightReds:[0.22265625,0.14952586658437975,0.2957866334156203],
    fictionalInjuryWithdrawals:[0.34765625,0.2840227301105924,0.4112897698894076],
    secondYellowDismissals:[0.21875,0.15417506775071305,0.28332493224928695],
    fixturesWithEvents:[0.984375,0.9683641394281881,1]};
  for(const [key,values] of Object.entries(expected)){
    const metric=s.metrics[key];
    near(metric.perAcceptedFixture,values[0]);
    near(metric.exploratory95ClusterInterval.lower,values[1]);
    near(metric.exploratory95ClusterInterval.upper,values[2]);
  }
  assert.equal(s.holdout2024_25Used,false);
});
