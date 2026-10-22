#!/usr/bin/env node
/**
 * Linux-only native Chromium SIGKILL during an unacknowledged IndexedDB put.
 * The page uses a real v32/schema-6 CAS, with a CDP debugger statement
 * immediately AFTER its native IDBObjectStore.put has enqueued the write.
 * This deliberately does not simulate a power loss or OS filesystem failure.
 */
import { spawn } from 'node:child_process';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { setTimeout as sleep } from 'node:timers/promises';

const executable = process.argv[2];
const baseUrl = process.argv[3];
if (!executable || !baseUrl ||
    !/^http:\/\/127\.0\.0\.1:[0-9]+\/examples\/m1-v38-uncommitted-restart\.html$/.test(baseUrl)) {
  throw new Error('Usage: node scripts/m1-v38-cdp-interrupt.mjs CHROME http://127.0.0.1:5173/examples/m1-v38-uncommitted-restart.html');
}
async function until(fn, label, timeout = 60_000) {
  const deadline = Date.now() + timeout;
  let last;
  while (Date.now() < deadline) {
    try { const result = await fn(); if (result) return result; }
    catch (error) { last = error; }
    await sleep(100);
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
  const events = {putQueued:false, paused:false};
  let nextId = 0;
  const waiting = new Map();
  socket.addEventListener('message', event => {
    const data = JSON.parse(String(event.data));
    if (data.method === 'Runtime.consoleAPICalled' &&
        data.params?.args?.some(arg =>
          arg.value === 'M1_V38_UNACKNOWLEDGED_PUT_QUEUED')) {
      events.putQueued = true;
    }
    if (data.method === 'Debugger.paused') events.paused = true;
    const entry = waiting.get(data.id);
    if (!entry) return;
    waiting.delete(data.id);
    clearTimeout(entry.timeout);
    if (data.error) entry.reject(new Error(JSON.stringify(data.error)));
    else entry.resolve(data.result ?? {});
  });
  const send = (method, params = {}) => new Promise((resolve, reject) => {
    const id = ++nextId;
    const timeout = setTimeout(() => {
      waiting.delete(id);
      reject(new Error('CDP timeout ' + method));
    }, 15_000);
    waiting.set(id, {resolve, reject, timeout});
    socket.send(JSON.stringify({id, method, params}));
  });
  return {socket, send, events};
}
function killGroup(handle) {
  if (!handle || handle.exitCode !== null || handle.signalCode !== null) return;
  try { process.kill(-handle.pid, 'SIGKILL'); }
  catch { handle.kill('SIGKILL'); }
}
const profile = await mkdtemp(join(tmpdir(), 'footclubsim-m1-v38-'));
let current = null;
async function launch(stage) {
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
    const contents = await readFile(join(profile, 'DevToolsActivePort'), 'utf8');
    const value = Number(contents.split(/\r?\n/)[0]);
    return Number.isInteger(value) && value > 0 ? value : null;
  }, 'Chromium CDP port startup', 20_000);
  const page = await until(async () => {
    const response = await fetch('http://127.0.0.1:' + port + '/json/list');
    if (!response.ok) return null;
    return (await response.json()).find(item =>
      item.type === 'page' && item.webSocketDebuggerUrl);
  }, 'Chromium debug page');
  current.cdp = await connect(page.webSocketDebuggerUrl);
  await current.cdp.send('Page.enable');
  await current.cdp.send('Runtime.enable');
  if (stage === 'interrupt') await current.cdp.send('Debugger.enable');
  await current.cdp.send('Page.navigate', {url:baseUrl + '?stage=' + stage});
  if (stage === 'interrupt') {
    await until(() => current.cdp.events.putQueued &&
      current.cdp.events.paused, 'CDP paused inside native IDB put', 90_000);
    console.log('PASS: CDP paused after native put was queued, before transaction callback returned');
    return;
  }
  const expected = stage === 'prepare' ?
    'M1_V38_PREPARED' : 'M1_V38_RECOVERED';
  await until(async () => {
    const response = await current.cdp.send('Runtime.evaluate', {
      expression: 'document.querySelector("#status")?.textContent ?? ""',
      returnByValue: true,
    });
    const value = response.result?.value;
    if (typeof value !== 'string') return false;
    if (value.startsWith('M1_V38_FAIL:')) throw new Error(value);
    return value === expected;
  }, 'Chromium ' + expected, 120_000);
  console.log('PASS: ' + expected);
}
try {
  await launch('prepare');
  current.cdp?.socket.close();
  killGroup(current.browser);
  await until(() => current.browser.exitCode !== null ||
    current.browser.signalCode !== null, 'prepare browser exit', 10_000);
  current = null;
  await launch('interrupt');
  current.cdp?.socket.close();
  const interrupted = current.browser;
  killGroup(interrupted);
  await until(() => interrupted.exitCode !== null ||
    interrupted.signalCode !== null, 'paused browser SIGKILL', 10_000);
  current = null;
  await launch('verify');
  console.log('PASS: interrupted unacknowledged schema-6 put rolled back; committed baseline and clean retry survived');
} catch (error) {
  console.error(error);
  process.exitCode = 1;
} finally {
  current?.cdp?.socket.close();
  killGroup(current?.browser);
  await rm(profile, {recursive:true,force:true,maxRetries:8,retryDelay:300});
}
