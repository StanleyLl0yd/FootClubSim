#!/usr/bin/env node
// Chromium DevTools Protocol smoke: native browser, no DOM emulator or extra packages.
import { spawn } from 'node:child_process';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';

const executable = process.argv[2];
const targetUrl = process.argv[3] ?? 'http://127.0.0.1:4173/';
if (!executable) {
  console.error('Usage: node scripts/chromium-e2e.mjs /path/to/chrome-or-edge [url]');
  process.exit(2);
}

async function until(fn, description, duration = 30_000) {
  const deadline = Date.now() + duration;
  let lastError;
  do {
    try {
      const value = await fn();
      if (value) return value;
    } catch (error) {
      lastError = error;
    }
    await delay(300);
  } while (Date.now() < deadline);
  throw new Error('Timed out: ' + description + (lastError ? ': ' + String(lastError) : ''));
}

function openSocket(url) {
  return new Promise((resolve, reject) => {
    const socket = new WebSocket(url);
    const timeout = setTimeout(() => reject(new Error('CDP websocket timeout')), 15000);
    socket.addEventListener('open', () => {
      clearTimeout(timeout);
      resolve(socket);
    }, { once: true });
    socket.addEventListener('error', () => {
      clearTimeout(timeout);
      reject(new Error('CDP websocket refused'));
    }, { once: true });
  });
}

function cdpClient(socket) {
  let nextId = 1;
  const pending = new Map();
  socket.addEventListener('message', event => {
    const response = JSON.parse(String(event.data));
    if (!Number.isInteger(response.id)) return;
    const entry = pending.get(response.id);
    if (!entry) return;
    pending.delete(response.id);
    clearTimeout(entry.timeout);
    if (response.error) entry.reject(new Error('CDP: ' + JSON.stringify(response.error)));
    else entry.resolve(response.result ?? {});
  });
  socket.addEventListener('close', () => {
    for (const entry of pending.values()) {
      clearTimeout(entry.timeout);
      entry.reject(new Error('CDP websocket disconnected'));
    }
    pending.clear();
  });
  return (method, params = {}) => new Promise((resolve, reject) => {
    const id = nextId++;
    const timeout = setTimeout(() => {
      pending.delete(id);
      reject(new Error('CDP timed out: ' + method));
    }, 20_000);
    pending.set(id, { resolve, reject, timeout });
    socket.send(JSON.stringify({ id, method, params }));
  });
}

async function run() {
  const profile = await mkdtemp(join(tmpdir(), 'footclubsim-cdp-'));
  const browser = spawn(executable, [
    '--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
    '--disable-extensions', '--remote-debugging-port=0',
    '--remote-allow-origins=*', '--user-data-dir=' + profile,
    'about:blank',
  ], { stdio: 'ignore', windowsHide: true });
  let socket;
  try {
    const portFile = join(profile, 'DevToolsActivePort');
    const port = await until(async () => {
      const file = await readFile(portFile, 'utf8');
      const parsed = Number(file.split(/\r?\n/)[0]);
      if (!Number.isInteger(parsed) || parsed < 1 || parsed > 65535) return null;
      return parsed;
    }, 'Edge/Chrome DevTools port');

    const target = await until(async () => {
      const response = await fetch('http://127.0.0.1:' + port + '/json/list');
      if (!response.ok) return null;
      const pages = await response.json();
      return pages.find(page => page.type === 'page' && page.webSocketDebuggerUrl);
    }, 'CDP page target');

    socket = await openSocket(target.webSocketDebuggerUrl);
    const send = cdpClient(socket);
    await send('Page.enable');
    await send('Runtime.enable');

    async function evaluate(expression) {
      const reply = await send('Runtime.evaluate', {
        expression, returnByValue: true, awaitPromise: true,
      });
      if (reply.exceptionDetails) {
        throw new Error('Browser JS exception: ' + JSON.stringify(reply.exceptionDetails));
      }
      return reply.result?.value;
    }

    async function waitText(text) {
      return until(async () => {
        const body = await evaluate('document.body?.innerText ?? ""');
        return typeof body === 'string' && body.includes(text) ? body : null;
      }, 'rendered text "' + text + '"');
    }

    async function click(label) {
      const found = await evaluate(`(() => {
        const button = Array.from(document.querySelectorAll('button')).find(
          element => element.textContent.trim() === ${JSON.stringify(label)}
        );
        if (!button || button.disabled) return false;
        button.click();
        return true;
      })()`);
      if (found !== true) throw new Error('Unavailable browser button: ' + label);
    }

    await send('Page.navigate', { url: targetUrl });
    const body = await waitText('Начало карьеры');
    for (const text of ['Календарь', 'Сохранения', '368', '240']) {
      if (!body.includes(text)) throw new Error('Missing M0 UI text: ' + text);
    }

    await click('Создать стартовую карьеру');
    await waitText('Стартовая карьера создана в памяти браузера');
    await click('Сохранить в браузере');
    await waitText('Начальная карьера записана в IndexedDB');

    await click('Сохранить в браузере');
    await waitText('Сохранение отклонено: DUPLICATE');

    await send('Page.reload', { ignoreCache: true });
    await waitText('Выберите вымышленный клуб');
    await click('Восстановить из браузера');
    await waitText('Стартовая карьера восстановлена и проверена по SHA-256');

    // A blocked/disabled storage API must not silently drop the open career.
    await evaluate("(() => { Object.defineProperty(window, 'indexedDB', { configurable: true, value: undefined }); return true; })()");
    await click('Сохранить в браузере');
    await waitText('Сохранение отклонено: UNAVAILABLE');
    const stillActive = await evaluate("Boolean(document.querySelector('.career-info'))");
    if (!stillActive) throw new Error('Active career lost after IndexedDB became unavailable');

    console.log('PASS: browser initial career survives reload, duplicate save, and unavailable storage');
  } finally {
    socket?.close();
    browser.kill();
    await delay(500);
    await rm(profile, { recursive: true, force: true, maxRetries: 4, retryDelay: 500 });
  }
}

run().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
