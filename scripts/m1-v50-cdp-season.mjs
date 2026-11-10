#!/usr/bin/env node
/**
 * Native Chromium IndexedDB smoke via CDP, no JS DOM emulator/dependencies.
 * The HTML fixture navigates once; poll the actual post-reload result.
 */
import { spawn } from 'node:child_process';
import { readFile, mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { setTimeout as sleep } from 'node:timers/promises';

const executable = process.argv[2];
const url = process.argv[3] ?? 'http://127.0.0.1:5173/examples/m1-v50-native-season.html';
const marker = 'M1_V50_NATIVE_FULL_SEASON';
if (!executable) {
  console.error('Usage: node scripts/m1-v50-cdp-season.mjs /path/to/chromium [url]');
  process.exit(2);
}
async function until(fn, description, duration = 45_000) {
  const deadline = Date.now() + duration;
  let lastError;
  while (Date.now() < deadline) {
    try {
      const answer = await fn();
      if (answer) return answer;
    } catch (error) { lastError = error; }
    await sleep(250);
  }
  throw new Error('Timeout waiting for ' + description +
    (lastError ? ': ' + String(lastError) : ''));
}
async function connect(address) {
  const socket = new WebSocket(address);
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('CDP socket timeout')), 10_000);
    socket.addEventListener('open', () => { clearTimeout(timer); resolve(); }, { once: true });
    socket.addEventListener('error', () => {
      clearTimeout(timer);
      reject(new Error('CDP websocket error'));
    }, { once: true });
  });
  let id = 0;
  const pending = new Map();
  socket.addEventListener('message', event => {
    const response = JSON.parse(String(event.data));
    const call = pending.get(response.id);
    if (!call) return;
    pending.delete(response.id);
    clearTimeout(call.timer);
    if (response.error) call.reject(new Error(JSON.stringify(response.error)));
    else call.resolve(response.result ?? {});
  });
  function send(method, params = {}) {
    return new Promise((resolve, reject) => {
      const next = ++id;
      const timer = setTimeout(() => {
        pending.delete(next);
        reject(new Error('CDP request timed out: ' + method));
      }, 90_000);
      pending.set(next, { resolve, reject, timer });
      socket.send(JSON.stringify({ id: next, method, params }));
    });
  }
  return { socket, send };
}
const profile = await mkdtemp(join(tmpdir(), 'footclubsim-m1-cas-'));
const browser = spawn(executable, [
  '--headless=new', '--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage',
  '--no-first-run', '--no-default-browser-check', '--disable-extensions',
  '--remote-debugging-port=0', '--remote-allow-origins=*',
  '--user-data-dir=' + profile, 'about:blank',
], { stdio: 'ignore' });
let connection = null;
try {
  const port = await until(async () => {
    if (browser.exitCode !== null) throw new Error('browser exit ' + browser.exitCode);
    const file = await readFile(join(profile, 'DevToolsActivePort'), 'utf8');
    const value = Number(file.split(/\r?\n/)[0]);
    return Number.isInteger(value) && value > 0 ? value : null;
  }, 'Chrome DevToolsActivePort', 20_000);
  const page = await until(async () => {
    const response = await fetch('http://127.0.0.1:' + port + '/json/list');
    if (!response.ok) return null;
    return (await response.json()).find(p => p.type === 'page' && p.webSocketDebuggerUrl);
  }, 'CDP page');
  connection = await connect(page.webSocketDebuggerUrl);
  const { send } = connection;
  await send('Page.enable');
  await send('Runtime.enable');
  await send('Page.navigate', { url });
  const result = await until(async () => {
    // Navigation can briefly invalidate Runtime's execution context.
    const reply = await send('Runtime.evaluate', {
      expression: 'document.querySelector("#status")?.textContent ?? ""',
      returnByValue: true,
    });
    const value = reply.result?.value;
    if (typeof value !== 'string') return null;
    if (value.startsWith(marker + '_FAIL')) throw new Error(value);
    return value === marker + '_PASS' ? value : null;
  }, marker + ' native IndexedDB post-navigation result',
    1_200_000);

  const readReport=await send('Runtime.evaluate',{
    expression:'document.querySelector("#report")?.textContent ?? ""',
    returnByValue:true,
  });
  const encoded=readReport.result?.value;
  if(typeof encoded!=='string'||!encoded)throw Error('missing 240-fixture report');
  const data=JSON.parse(encoded);
  const metrics=data.measurements;
  if(data.schemaVersion!==1||
      data.status!=='NATIVE_240_SYNTHETIC_SCHEMA6_NOT_RELEASE_GATE'||
      data.fixtureCount!==240||data.batchSize!==16||
      data.checkpointCount!==15||
      data.immutableM0Preserved!==true||
      data.allFixturesReplayValidated!==true||
      data.fullRestoreIdentical!==true||
      !metrics||!Array.isArray(metrics.checkpoints)||
      metrics.checkpoints.length!==15||
      !metrics.checkpoints.every((row,index)=>
        row.revision===(index+1)*16&&
        Number.isFinite(row.sourceMs)&&row.sourceMs>=0&&
        Number.isFinite(row.commitMs)&&row.commitMs>=0)||
      ![metrics.appendAndSourceMs,metrics.postReloadReplayMs,
        metrics.exportMs,metrics.restoreMs,metrics.archiveChars,
        metrics.journalChars].every(x=>Number.isFinite(x)&&x>0)){
    throw Error('invalid native 240-fixture report');
  }
  console.log(JSON.stringify(data));
  console.log('PASS: '+result+' (real Chromium source replay/export/restore)');
} catch (error) {
  console.error(error);
  process.exitCode = 1;
} finally {
  connection?.socket.close();
  browser.kill();
  await rm(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
}
