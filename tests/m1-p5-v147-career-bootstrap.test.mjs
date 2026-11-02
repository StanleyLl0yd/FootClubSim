import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {analyzeM1P5V147ObservedBootstrap}
  from '../scripts/m1-p5-v147-career-bootstrap.mjs';

const data=new URL('../data/',import.meta.url);
const source=readFileSync(new URL('m1-p5-v143-observed-careers.jsonl',data),'utf8');
const manifest=JSON.parse(readFileSync(
  new URL('m1-p5-v143-observed-manifest.json',data),'utf8'));

test('v147 resamples 64 whole careers with fixed reproducible source',()=>{
  const a=analyzeM1P5V147ObservedBootstrap(source,manifest,512);
  const b=analyzeM1P5V147ObservedBootstrap(source,manifest,512);
  assert.deepEqual(a,b);
  assert.equal(a.schemaVersion,147);
  assert.equal(a.bootstrapReplicates,512);
  assert.equal(a.clusters,64);
  assert.equal(a.accepted,256);
  assert.equal(a.rejected,0);
  assert.equal(a.sourceDigestsMatched,true);
  assert.equal(a.sourceJobOriginIndependentlyAuthenticated,false);
  assert.equal(a.finiteSampleCoverageGuaranteed,false);
  assert.equal(a.referenceCategoryAligned,false);
  assert.equal(a.releaseP5Accepted,false);
  assert.equal(a.holdout2024_25Used,false);
  assert.equal(Object.keys(a.metrics).length,12);
  for(const [key,value] of Object.entries(a.metrics)){
    assert.ok(Number.isFinite(value.perAcceptedFixture),key);
    const {lower,upper}=value.exploratoryBootstrapPercentile95;
    assert.ok(Number.isFinite(lower)&&Number.isFinite(upper)&&
      lower>=0&&upper>=lower,key);
    if(['homeWins','draws','awayWins','fixturesWithEvents'].includes(key))
      assert.ok(upper<=1,key);
  }
});
test('v147 rejects mutated records, altered provenance and invalid replication',()=>{
  assert.throws(()=>analyzeM1P5V147ObservedBootstrap(
    source.replace('V141_CAREER_CLUSTERS=','V140_CAREER_CLUSTERS='),
    manifest,256),/V147_SOURCE_DIGEST/);
  const tampered=structuredClone(manifest);
  tampered.records[0].sha256='0'.repeat(64);
  assert.throws(()=>analyzeM1P5V147ObservedBootstrap(
    source,tampered,256),/V147_SOURCE_DIGEST/);
  const wrongRun=structuredClone(manifest);
  wrongRun.workflowRun=1;
  assert.throws(()=>analyzeM1P5V147ObservedBootstrap(
    source,wrongRun,256),/V147_SOURCE_MANIFEST/);
  assert.throws(()=>analyzeM1P5V147ObservedBootstrap(
    source,manifest,255),/V147_REPLICATE_LIMIT/);
  assert.throws(()=>analyzeM1P5V147ObservedBootstrap(
    source.slice(0,-1),manifest,256),/V147_SOURCE_LINES/);
});
