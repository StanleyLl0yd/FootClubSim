#!/usr/bin/env node
/**
 * Linux-only, development-only native Chromium process restart experiment.
 * SIGKILL is issued AFTER a schema-6 transaction has committed and read back.
 * NOT a simulated OS power loss, aborted-write certification or eviction test.
 */
import { spawn } from 'node:child_process';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { setTimeout as sleep } from 'node:timers/promises';

const executable = process.argv[2];
const baseUrl = process.argv[3];
if (!executable || !baseUrl ||
    !/^http:\/\/127\.0\.0\.1:[0-9]+\/examples\/m1-v37-process-restart\.html$/.test(baseUrl)) {
  throw new Error('Usage: node scripts/m1-v37-cdp-restart.mjs CHROME http://127.0.0.1:5173/examples/m1-v37-process-restart.html');
}
async function until(fn, label, timeout = 60_000) {
  const deadline = Date.now() + timeout;
  let last;
  while (Date.now() < deadline) {
    try { const result = await fn(); if (result) return result; }
    catch (e) { last = e; }
    await sleep(250);
  }
  throw new Error('Timeout: ' + label + (last ? ': ' + String(last) : ''));
}
async function connect(url) {
  const socket = new WebSocket(url);
  await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('CDP connect timeout')), 10_000);
    socket.addEventListener('open', () => {
      clearTimeout(timeout); resolve();
    }, {once:true});
    socket.addEventListener('error', () => {
      clearTimeout(timeout); reject(new Error('CDP connect error'));
    }, {once:true});
  });
  let currentId = 0;
  const waiting = new Map();
  socket.addEventListener('message', event => {
    const data = JSON.parse(String(event.data));
    const entry = waiting.get(data.id);
    if (!entry) return;
    waiting.delete(data.id);
    clearTimeout(entry.timeout);
    if (data.error) entry.reject(new Error(JSON.stringify(data.error)));
    else entry.resolve(data.result ?? {});
  });
  function send(method, params = {}) {
    return new Promise((resolve, reject) => {
      const id = ++currentId;
      const timeout = setTimeout(() => {
        waiting.delete(id); reject(new Error('CDP timeout ' + method));
      }, 15_000);
      waiting.set(id, {resolve, reject, timeout});
      socket.send(JSON.stringify({id, method, params}));
    });
  }
  return {socket, send};
}
function killGroup(processHandle) {
  if (!processHandle || processHandle.exitCode !== null ||
      processHandle.signalCode !== null) return;
  try { process.kill(-processHandle.pid, 'SIGKILL'); }
  catch { processHandle.kill('SIGKILL'); }
}
const profile = await mkdtemp(join(tmpdir(), 'footclubsim-m1-v37-'));
let current = null;
async function launch(stage) {
  // The previous hard-killed browser may have left a stale CDP port file.
  await rm(join(profile, 'DevToolsActivePort'), {force:true});
  const browser = spawn(executable, [
    '--headless=new', '--no-sandbox', '--disable-gpu',
    '--disable-dev-shm-usage', '--no-first-run',
    '--no-default-browser-check', '--disable-extensions',
    '--remote-debugging-port=0', '--remote-allow-origins=*',
    '--user-data-dir=' + profile, 'about:blank',
  ], {stdio:'ignore', detached:true});
  current = {browser, cdp:null};
  const port = await until(async () => {
    if (browser.exitCode !== null || browser.signalCode !== null)
      throw new Error('Chrome exited prematurely');
    const file = await readFile(join(profile, 'DevToolsActivePort'), 'utf8');
    const value = Number(file.split(/\r?\n/)[0]);
    return Number.isInteger(value) && value > 0 ? value : null;
  }, 'CDP port startup', 20_000);
  const page = await until(async () => {
    const response = await fetch('http://127.0.0.1:' + port + '/json/list');
    if (!response.ok) return null;
    return (await response.json()).find(p =>
      p.type === 'page' && p.webSocketDebuggerUrl);
  }, 'CDP page');
  current.cdp = await connect(page.webSocketDebuggerUrl);
  await current.cdp.send('Page.enable');
  await current.cdp.send('Runtime.enable');
  await current.cdp.send('Page.navigate', {
    url: baseUrl + '?stage=' + stage,
  });
  const expected = stage === 'commit' ?
    'M1_V37_RESTART_COMMITTED' : 'M1_V37_RESTART_PASS';
  await until(async () => {
    const reply = await current.cdp.send('Runtime.evaluate', {
      expression: 'document.querySelector("#status")?.textContent ?? ""',
      returnByValue: true,
    });
    const status = reply.result?.value;
    if (typeof status !== 'string') return false;
    if (status.startsWith('M1_V37_RESTART_FAIL:'))
      throw new Error(status);
    return status === expected;
  }, 'real Chrome ' + expected, 120_000);
  console.log('PASS: ' + expected);
}
try {
  await launch('commit');
  // Terminate the entire browser process group, not the server or OS.
  const first = current.browser;
  current.cdp?.socket.close();
  killGroup(first);
  await until(() => first.exitCode !== null || first.signalCode !== null,
    'killed browser exit', 10_000);
  current = null;
  // Start a fresh Chrome instance with EXACTLY the previous profile.
  await launch('verify');
  console.log('PASS: committed v32/schema-6 IDB state survived process SIGKILL/restart');
} catch (error) {
  console.error(error);
  process.exitCode = 1;
} finally {
  current?.cdp?.socket.close();
  killGroup(current?.browser);
  await rm(profile, {recursive:true,force:true,maxRetries:8,retryDelay:300});
}
