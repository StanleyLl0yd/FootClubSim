#!/usr/bin/env python3
"""Exercise the compiled M0 web app in actual macOS Safari through WebDriver.

Uses stdlib only; neither Node test DOM simulators nor WebKit substitute Safari.
The runner must already have Safari remote automation enabled.
"""
from __future__ import annotations

import hashlib
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


def is_retryable_safari_session_error(status: int, detail: str) -> bool:
    """Retry only the macOS runner's transient failure to launch Safari itself.

    Never retry failed navigation, assertion, or other WebDriver/session errors.
    """
    if status != 500:
        return False
    try:
        response = json.loads(detail)
    except (TypeError, ValueError):
        return False
    value = response.get("value") if isinstance(response, dict) else None
    if not isinstance(value, dict):
        return False
    message = value.get("message")
    return (
        value.get("error") == "session not created"
        and isinstance(message, str)
        and "session timed out while connecting to a Safari instance" in message
    )


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


def run_async_script(session: str, code: str):
    return wd(session, "execute/async", {"script": code, "args": []})


def load_indexeddb_backup(session: str) -> str:
    result = run_async_script(session, """
        const done = arguments[arguments.length - 1];
        const request = indexedDB.open('footclubsim-m0', 1);
        request.onerror = () => done(null);
        request.onsuccess = () => {
            const db = request.result;
            const tx = db.transaction('initial-careers', 'readonly');
            const get = tx.objectStore('initial-careers').get('m0-ui-initial-career');
            let value;
            get.onsuccess = () => { value = get.result; };
            tx.oncomplete = () => { db.close(); done(value ?? null); };
            tx.onabort = () => { db.close(); done(null); };
        };
    """)
    if not isinstance(result, str) or "footclubsim-initial-career" not in result:
        raise AssertionError("Safari could not obtain isolated M0 test backup")
    return result


def set_test_file(session: str, content: str, filename: str):
    script = (
        "const input = document.querySelector('#import-file');"
        "if (!input) return false;"
        "const transfer = new DataTransfer();"
        "transfer.items.add(new File([" + json.dumps(content, ensure_ascii=False) +
        "], " + json.dumps(filename) + ", {type: 'application/json'}));"
        "input.files = transfer.files;"
        "input.dispatchEvent(new Event('change', {bubbles: true}));"
        "return true;"
    )
    if run_script(session, script) is not True:
        raise AssertionError("Safari file-input test injection failed")


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


def select_nondefault_club(session: str):
    # Exercise restore of non-default state, not merely the initial selected club.
    changed = run_script(session, """
        const select = document.querySelector('#club-select');
        if (!select || select.options[1]?.value !== 'fictional-2') return false;
        const setter = Object.getOwnPropertyDescriptor(
            HTMLSelectElement.prototype, 'value'
        ).set;
        setter.call(select, 'fictional-2');
        select.dispatchEvent(new Event('change', {bubbles: true}));
        return true;
    """)
    if changed is not True:
        raise AssertionError("Safari could not select the non-default synthetic club")


def assert_restored_club(session: str):
    selected = run_script(session, """
        const selected = document.querySelector('#club-select')?.value;
        const text = document.querySelector('.career-info')?.innerText ?? '';
        return selected === 'fictional-2' &&
            text.includes('Fictional Club 2') && text.includes('Ревизия 0');
    """)
    if selected is not True:
        raise AssertionError("Safari did not restore non-default club and initial revision")


def exercise_journal_cas(session: str, schema: int):
    """Verify the requested fixture, not a stale page from the previous Safari run."""
    if schema not in (7, 8, 26, 32):
        raise ValueError("Unsupported native CAS fixture")
    url = f"http://127.0.0.1:5173/examples/m1-v{schema}-cas-smoke.html"
    expected_path = f"/examples/m1-v{schema}-cas-smoke.html"
    wd(session, "url", {"url": url})
    deadline = time.monotonic() + 90
    navigation_deadline = time.monotonic() + 12
    last = None
    while time.monotonic() < deadline:
        # SafariDriver can return before the new document has finished loading.
        # The previous schema's status must never be attributed to this fixture.
        last = run_script(session, """
            return {path: location.pathname,
                    status: document.querySelector('#status')?.textContent ?? ''};
        """)
        if not isinstance(last, dict):
            raise AssertionError(f"Safari v{schema} returned invalid page state: {last!r}")
        if last.get("path") != expected_path:
            if time.monotonic() > navigation_deadline:
                raise AssertionError(
                    f"Safari v{schema} navigation never reached {expected_path}: {last!r}"
                )
            time.sleep(0.4)
            continue
        status = last.get("status")
        if status == f"M1_V{schema}_BROWSER_CAS_PASS":
            print(f"PASS: real Safari v{schema} CAS survived navigation and serialized writers")
            return
        if isinstance(status, str) and status.startswith("M1_") and "_BROWSER_CAS_FAIL" in status:
            raise AssertionError(f"Safari v{schema} fixture failed: {last!r}")
        time.sleep(0.4)
    raise AssertionError(f"Safari v{schema} CAS timed out, last page state: {last!r}")


def exercise_journal_cas_group(session: str):
    """Keep one Vite process for all CAS fixtures to avoid port-reuse races."""
    log_path = "/tmp/footclubsim-m1-safari-cas.log"
    with open(log_path, "w", encoding="utf-8") as log:
        server = subprocess.Popen(
            ["node", "node_modules/vite/bin/vite.js", "--host", "127.0.0.1",
             "--port", "5173", "--strictPort"],
            cwd=ROOT, stdout=log, stderr=subprocess.STDOUT,
        )
        try:
            deadline = time.monotonic() + TIMEOUT
            for schema in (7, 8, 26, 32):
                url = f"http://127.0.0.1:5173/examples/m1-v{schema}-cas-smoke.html"
                while time.monotonic() < deadline:
                    try:
                        with urllib.request.urlopen(url, timeout=2) as response:
                            if response.status == 200:
                                break
                    except (OSError, urllib.error.URLError):
                        pass
                    if server.poll() is not None:
                        raise RuntimeError("Safari CAS Vite dev server exited")
                    time.sleep(0.4)
                else:
                    raise RuntimeError(f"Safari v{schema} Vite dev server unavailable")
            for schema in (7, 8, 26, 32):
                exercise_journal_cas(session, schema)
        except Exception:
            log.flush()
            print(f"---- {log_path} ----", file=sys.stderr)
            print(Path(log_path).read_text(
                encoding="utf-8", errors="replace")[-8000:], file=sys.stderr)
            raise
        finally:
            server.terminate()
            try:
                server.wait(timeout=6)
            except subprocess.TimeoutExpired:
                server.kill()
                server.wait(timeout=6)


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

            startup_timeout_retries = 0
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
                    detail = error.read().decode("utf-8", errors="replace")
                    if (
                        startup_timeout_retries < 1
                        and time.monotonic() + 2 < deadline
                        and is_retryable_safari_session_error(error.code, detail)
                    ):
                        startup_timeout_retries += 1
                        print(
                            "SafariDriver timed out launching Safari; retrying session once",
                            file=sys.stderr,
                        )
                        time.sleep(2)
                        continue
                    raise RuntimeError(
                        "SafariDriver refused session: " + detail[:3000]
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

            select_nondefault_club(session)
            click(session, "Создать стартовую карьеру")
            wait_for_text(session, "Стартовая карьера создана в памяти браузера")
            assert_restored_club(session)
            click(session, "Сохранить в браузере")
            wait_for_text(session, "Начальная карьера записана в IndexedDB")
            wd(session, "refresh", {})
            wait_for_text(session, "Выберите вымышленный клуб")
            click(session, "Восстановить из браузера")
            wait_for_text(session, "Стартовая карьера восстановлена и проверена по SHA-256")
            assert_restored_club(session)
            # Real Safari IndexedDB deletion followed by app file-input recovery.
            # The File object is injected by WebDriver, not chosen via OS dialog.
            backup = load_indexeddb_backup(session)
            removed = run_async_script(session, """
                const done = arguments[arguments.length - 1];
                const request = indexedDB.deleteDatabase('footclubsim-m0');
                request.onsuccess = () => done('deleted');
                request.onerror = () => done('failed');
                request.onblocked = () => done('blocked');
            """)
            if removed != "deleted":
                raise AssertionError(f"Safari IndexedDB clearing failed: {removed!r}")
            wd(session, "refresh", {})
            wait_for_text(session, "Выберите вымышленный клуб")
            click(session, "Восстановить из браузера")
            wait_for_text(session, "Восстановление отклонено: NOT_FOUND")
            set_test_file(session, backup, "m0-recovery.json")
            wait_for_text(session, "Стартовая карьера проверена и загружена в память")
            assert_restored_club(session)
            other = json.loads(backup)
            payload = json.loads(other["payload"])
            payload["careerId"] = "another-valid-initial-career"
            other["payload"] = json.dumps(payload, ensure_ascii=False, separators=(",", ":"))
            other["checksum"] = hashlib.sha256(other["payload"].encode("utf-8")).hexdigest()
            set_test_file(session, json.dumps(other), "m0-foreign-career-id.json")
            wait_for_text(session, "Импорт отклонён: идентификатор карьеры отличается")
            if not run_script(session, "return Boolean(document.querySelector('.career-info'))"):
                raise AssertionError("Safari lost active M0 career after foreign-ID import")
            foreign = json.loads(backup)
            foreign_payload = json.loads(foreign["payload"])
            selected = next(club for club in foreign_payload["catalog"]["clubs"]
                            if club["id"] == foreign_payload["selectedClubId"])
            selected["id"] = "foreign-valid-club"
            foreign_payload["selectedClubId"] = selected["id"]
            foreign["payload"] = json.dumps(foreign_payload, ensure_ascii=False, separators=(",", ":"))
            foreign["checksum"] = hashlib.sha256(foreign["payload"].encode("utf-8")).hexdigest()
            set_test_file(session, json.dumps(foreign), "m0-foreign-club.json")
            wait_for_text(session, "Импорт отклонён: клуб отсутствует в тестовой базе")
            assert_restored_club(session)
            invalid = backup.replace("fictional-1", "fictional-X", 1)
            if invalid == backup:
                raise AssertionError("Safari invalid-file fixture unchanged")
            set_test_file(session, invalid, "m0-corrupted.json")
            wait_for_text(session, "Импорт отклонён: INTEGRITY_ERROR")
            if not run_script(session, "return Boolean(document.querySelector('.career-info'))"):
                raise AssertionError("Safari lost recovered career on corrupted JSON import")
            click(session, "Сохранить в браузере")
            wait_for_text(session, "Начальная карьера записана в IndexedDB")
            print("PASS: Safari recovers from explicit IndexedDB deletion via app JSON import")

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
            exercise_journal_cas_group(session)
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
