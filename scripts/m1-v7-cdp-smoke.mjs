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
const url = process.argv[3] ?? 'http://127.0.0.1:5173/examples/m1-v7-cas-smoke.html';
const marker = process.argv[4] ?? 'M1_V7_BROWSER_CAS';
if (!/^(?:M1_V(?:7|8|26|32)_BROWSER_CAS|M1_V36_BROWSER_PROFILE|M1_V40_BROWSER_RECOVERY|M1_V43_BROWSER_WORKER)$/.test(marker)) {
  throw new Error('Unsupported browser CAS status marker');
}
if (!executable) {
  console.error('Usage: node scripts/m1-v7-cdp-smoke.mjs /path/to/chromium [url]');
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
      }, 15_000);
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
    marker === 'M1_V36_BROWSER_PROFILE' ? 240_000 : 90_000);
  if (marker === 'M1_V36_BROWSER_PROFILE') {
    const reply = await send('Runtime.evaluate', {
      expression: 'document.querySelector("#report")?.textContent ?? ""',
      returnByValue: true,
    });
    const payload = reply.result?.value;
    if (typeof payload !== 'string') throw new Error('Profile report missing');
    const profile = JSON.parse(payload);
    if (profile.schemaVersion !== 1 ||
        profile.status !== 'NATIVE_SCHEMA6_BOUNDED_OBSERVATION_NOT_A_RELEASE_GATE' ||
        !Number.isInteger(profile.fixtureCount) ||
        !Array.isArray(profile.measurements?.checkpoints) ||
        profile.measurements.checkpoints.length !== profile.fixtureCount) {
      throw new Error('Unexpected native profile report');
    }
    if (url.includes('instrument=1')) {
      if (profile.measurements?.transactionLifetimeInstrumented !== true ||
          !Number.isFinite(profile.measurements?.addOnlyRestoreTransactionMs) ||
          !profile.measurements.checkpoints.every(row =>
            Number.isFinite(row.transactionLifetimeMs) &&
            row.transactionLifetimeMs >= 0 &&
            row.transactionLifetimeMs <= row.endToEndCommitMs + 5)) {
        throw new Error('Native transaction-lifetime instrumentation missing');
      }
    }
    console.log(JSON.stringify(profile));
    console.log('PASS: ' + result + ' (real Chromium, navigation and IDB recovery)');
  } else {
    console.log('PASS: ' + result +
      ' (real Chromium, reload, concurrent readwrite locks)');
  }
} catch (error) {
  console.error(error);
  process.exitCode = 1;
} finally {
  connection?.socket.close();
  browser.kill();
  await rm(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
}
