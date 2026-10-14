#!/usr/bin/env python3
"""Exercise the compiled M0 web app in actual macOS Safari through WebDriver.

Uses stdlib only; neither Node test DOM simulators nor WebKit substitute Safari.
The runner must already have Safari remote automation enabled.
"""
from __future__ import annotations

import json
import subprocess
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
APP_URL = "http://127.0.0.1:4173/"
DRIVER = "http://127.0.0.1:4444"
TIMEOUT = 75


def request(url: str, method: str = "GET", payload: dict | None = None, timeout: int = 15):
    encoded = json.dumps(payload).encode("utf-8") if payload is not None else None
    req = urllib.request.Request(
        url, data=encoded, method=method,
        headers={"Content-Type": "application/json"},
    )
    with urllib.request.urlopen(req, timeout=timeout) as response:
        body = response.read()
    return json.loads(body) if body else None


def wd(session: str, path: str, payload: dict | None = None):
    response = request(f"{DRIVER}/session/{session}/{path}", "POST", payload or {})
    if not isinstance(response, dict) or not isinstance(response.get("value"), (dict, str, int, float, type(None))):
        raise AssertionError(f"Bad WebDriver response for {path}: {response!r}")
    value = response["value"]
    if isinstance(value, dict) and value.get("error"):
        raise RuntimeError(f"WebDriver {path}: {value!r}")
    return value


def run_script(session: str, code: str):
    return wd(session, "execute/sync", {"script": code, "args": []})


def wait_for_text(session: str, fragment: str, timeout: int = 20):
    deadline = time.monotonic() + timeout
    last = ""
    while time.monotonic() < deadline:
        last = run_script(session, "return document.body.innerText")
        if isinstance(last, str) and fragment in last:
            return last
        time.sleep(0.4)
    raise AssertionError(f"Expected Safari text {fragment!r} not found; DOM text={last!r}")


def click(session: str, name: str):
    script = (
        "var label = " + json.dumps(name, ensure_ascii=False) + ";"
        "var button = Array.from(document.querySelectorAll('button')).find("
        "element => element.textContent.trim() === label);"
        "if (!button || button.disabled) return false;"
        "button.click();"
        "return true;"
    )
    if run_script(session, script) is not True:
        raise AssertionError(f"Safari button missing or disabled: {name}")


def main():
    with open("/tmp/footclubsim-m0-preview.log", "w", encoding="utf-8") as preview_log, \
         open("/tmp/footclubsim-m0-safari-driver.log", "w", encoding="utf-8") as driver_log:
        preview = subprocess.Popen(
            ["node", "node_modules/vite/bin/vite.js", "preview",
             "--host", "127.0.0.1", "--port", "4173", "--strictPort"],
            cwd=ROOT, stdout=preview_log, stderr=subprocess.STDOUT,
        )
        driver = subprocess.Popen(
            ["/usr/bin/safaridriver", "-p", "4444"],
            cwd=ROOT, stdout=driver_log, stderr=subprocess.STDOUT,
        )
        session = None
        try:
            deadline = time.monotonic() + TIMEOUT
            while True:
                try:
                    with urllib.request.urlopen(APP_URL, timeout=3) as response:
                        if response.status == 200:
                            break
                except (OSError, urllib.error.URLError):
                    pass
                if preview.poll() is not None or time.monotonic() > deadline:
                    raise RuntimeError("Vite preview unavailable")
                time.sleep(0.4)

            while time.monotonic() < deadline:
                try:
                    result = request(
                        DRIVER + "/session", "POST",
                        {"capabilities": {"alwaysMatch": {"browserName": "safari"}}},
                        timeout=45,
                    )
                    value = result.get("value", {}) if isinstance(result, dict) else {}
                    session = value.get("sessionId")
                    if session:
                        break
                    raise RuntimeError(f"Safari session refused: {value!r}")
                except urllib.error.HTTPError as error:
                    raise RuntimeError(
                        "SafariDriver refused session: " +
                        error.read().decode("utf-8", errors="replace")[:3000]
                    ) from error
                except urllib.error.URLError:
                    if driver.poll() is not None:
                        raise RuntimeError(f"SafariDriver exited: {driver.returncode}")
                    time.sleep(1)
            if not session:
                raise RuntimeError("Safari WebDriver session could not be started")

            wd(session, "url", {"url": APP_URL})
            text = wait_for_text(session, "Начало карьеры")
            for expected in ("Календарь", "Сохранения", "368", "240"):
                if expected not in text:
                    raise AssertionError(f"Safari rendered UI without {expected!r}")

            click(session, "Создать стартовую карьеру")
            wait_for_text(session, "Стартовая карьера создана в памяти браузера")
            click(session, "Сохранить в браузере")
            wait_for_text(session, "Начальная карьера записана в IndexedDB")
            wd(session, "refresh", {})
            wait_for_text(session, "Выберите вымышленный клуб")
            click(session, "Восстановить из браузера")
            wait_for_text(session, "Стартовая карьера восстановлена и проверена по SHA-256")
            run_script(session, """
                Object.defineProperty(window, 'indexedDB', {configurable: true, value: {
                    open() {
                        const request = { error: new DOMException('Full', 'QuotaExceededError') };
                        queueMicrotask(() => request.onerror?.());
                        return request;
                    }
                }});
            """)
            click(session, "Сохранить в браузере")
            wait_for_text(session, "Недостаточно места в хранилище браузера")
            if not run_script(session, "return Boolean(document.querySelector('.career-info'))"):
                raise AssertionError("Safari lost active career after simulated quota error")
            run_script(session, "Object.defineProperty(window, 'indexedDB', {configurable: true, value: undefined});")
            click(session, "Сохранить в браузере")
            wait_for_text(session, "Сохранение отклонено: UNAVAILABLE")
            if not run_script(session, "return Boolean(document.querySelector('.career-info'))"):
                raise AssertionError("Active career disappeared after storage API failure")
            print("PASS: Safari initial career survives reload and unavailable storage")
        except Exception:
            preview_log.flush()
            driver_log.flush()
            for filename in ("/tmp/footclubsim-m0-preview.log", "/tmp/footclubsim-m0-safari-driver.log"):
                print(f"---- {filename} ----", file=sys.stderr)
                print(Path(filename).read_text(encoding="utf-8", errors="replace")[-8000:], file=sys.stderr)
            raise
        finally:
            if session:
                try:
                    request(f"{DRIVER}/session/{session}", "DELETE")
                except Exception:
                    pass
            for process in (driver, preview):
                process.terminate()
                try:
                    process.wait(timeout=6)
                except subprocess.TimeoutExpired:
                    process.kill()
                    process.wait(timeout=6)


if __name__ == "__main__":
    main()
