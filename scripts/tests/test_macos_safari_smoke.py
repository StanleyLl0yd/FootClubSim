"""Bounded recovery classification for native SafariDriver session startup failures."""
import json
import unittest
from pathlib import Path
from sys import path

path.insert(0, str(Path(__file__).resolve().parents[1]))
from macos_safari_smoke import is_retryable_safari_session_error  # noqa: E402


def session_error(error: str, message: str) -> str:
    return json.dumps({"value": {"error": error, "message": message}})


class SafariSessionStartupTests(unittest.TestCase):
    def test_retry_known_runner_startup_timeout(self):
        detail = session_error(
            "session not created",
            "Could not create a session: The session timed out while connecting "
            "to a Safari instance. RWIApplication did not become ready.",
        )
        self.assertTrue(is_retryable_safari_session_error(500, detail))
        self.assertFalse(is_retryable_safari_session_error(400, detail))

    def test_no_retry_on_unrelated_webdriver_errors(self):
        for status, detail in (
            (500, session_error("unknown error", "RWIApplication launch failed")),
            (500, session_error("session not created", "Safari is not installed")),
            (500, session_error("invalid session id", "session timed out while connecting to a Safari instance")),
            (503, session_error("session not created", "session timed out while connecting to a Safari instance")),
            (500, "{}"),
            (500, '{"value": null}'),
            (500, '{"value": {"message": 42}}'),
            (500, "not JSON"),
        ):
            with self.subTest(status=status, detail=detail):
                self.assertFalse(is_retryable_safari_session_error(status, detail))


if __name__ == "__main__":
    unittest.main()
