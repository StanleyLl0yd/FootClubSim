import {execFileSync} from 'node:child_process';
import assert from 'node:assert/strict';
import {basename} from 'node:path';

export const SAFARI_RSS_SAMPLE_INTERVAL_MS=5000;
export const SAFARI_MAX_SAMPLED_RSS_BYTES=2*1024*1024*1024;

// macOS ps reports RSS in KiB. Count only Safari and named WebKit
// executables on the isolated runner, not arbitrary process arguments.
export function summarizeSafariRss(output){
  let totalBytes=0,safariProcesses=0,webContentProcesses=0,processCount=0;
  for(const line of output.split('\n')){
    const row=line.trim().match(/^(\d+)\s+(.+)$/u);
    if(!row)continue;
    const name=basename(row[2]);
    if(!['Safari','com.apple.WebKit.WebContent',
      'com.apple.WebKit.Networking','com.apple.WebKit.GPU'].includes(name))
      continue;
    const bytes=Number(row[1])*1024;
    assert.ok(Number.isSafeInteger(bytes)&&bytes>=0,'Invalid Safari RSS');
    totalBytes+=bytes;
    assert.ok(Number.isSafeInteger(totalBytes),'Invalid aggregate Safari RSS');
    processCount++;
    if(name==='Safari')safariProcesses++;
    if(name==='com.apple.WebKit.WebContent')webContentProcesses++;
  }
  return {totalBytes,safariProcesses,webContentProcesses,processCount};
}

// This is sampled process RSS, not a JS heap, true peak, or per-tab memory.
// Shared pages and unrelated WebKit processes can inflate the aggregate.
export function startSafariRssSampler(){
  let sampleCount=0,completeSampleCount=0,baselineBytes=null,
    maxSampledBytes=0,maxProcessCount=0,error=null;
  const sample=()=>{
    try{
      const observed=summarizeSafariRss(execFileSync('/bin/ps',
        ['-axo','rss=,comm='],{encoding:'utf8',timeout:3000,maxBuffer:2*1024*1024}));
      sampleCount++;
      baselineBytes??=observed.totalBytes;
      maxSampledBytes=Math.max(maxSampledBytes,observed.totalBytes);
      maxProcessCount=Math.max(maxProcessCount,observed.processCount);
      if(observed.safariProcesses>0&&observed.webContentProcesses>0)
        completeSampleCount++;
    }catch(cause){error??=cause;}
  };
  sample();
  const timer=setInterval(sample,SAFARI_RSS_SAMPLE_INTERVAL_MS);
  timer.unref();
  return {
    stop:()=>clearInterval(timer),
    evidence:()=>{
      sample();
      if(error)throw error;
      assert.ok(completeSampleCount>=2,'Missing repeated Safari/WebContent RSS measurements');
      assert.ok(maxSampledBytes>0&&maxSampledBytes<=SAFARI_MAX_SAMPLED_RSS_BYTES,
        'Safari/WebKit sampled aggregate RSS exceeded 2 GiB: '+maxSampledBytes);
      return {kind:'sampled-aggregate-safari-webkit-rss',
        intervalMs:SAFARI_RSS_SAMPLE_INTERVAL_MS,sampleCount,completeSampleCount,
        baselineBytes,maxSampledBytes,maxProcessCount,
        maxAllowedBytes:SAFARI_MAX_SAMPLED_RSS_BYTES};
    },
  };
}
