import test from 'node:test';
import assert from 'node:assert/strict';
import {summarizeSafariRss,SAFARI_MAX_SAMPLED_RSS_BYTES,
  SAFARI_RSS_SAMPLE_INTERVAL_MS} from '../scripts/playable-season-memory.mjs';

test('Safari memory evidence counts only named executables and converts KiB to bytes',()=>{
  const input=[
    '  4096 /Applications/Safari.app/Contents/MacOS/Safari',
    '  8192 /System/Library/Frameworks/WebKit.framework/XPCServices/com.apple.WebKit.WebContent.xpc/Contents/MacOS/com.apple.WebKit.WebContent',
    '  2048 com.apple.WebKit.Networking',
    '  1024 com.apple.WebKit.GPU',
    '  1234 /tmp/NotSafari',
    '  9999 /usr/bin/python3',
    '  9999 /tmp/com.apple.WebKit.WebContent-helper',
    'not a process',
  ].join('\n');
  assert.deepEqual(summarizeSafariRss(input),{
    totalBytes:15360*1024,safariProcesses:1,webContentProcesses:1,processCount:4,
  });
  assert.deepEqual(summarizeSafariRss('  42 /usr/bin/node'),{
    totalBytes:0,safariProcesses:0,webContentProcesses:0,processCount:0,
  });
  assert.equal(SAFARI_MAX_SAMPLED_RSS_BYTES,2147483648);
  assert.equal(SAFARI_RSS_SAMPLE_INTERVAL_MS,5000);
});
