"""Smoke and error-path tests for the Markdown documentation validator."""

import tempfile
import unittest
from pathlib import Path
from sys import path

path.insert(0, str(Path(__file__).resolve().parents[1]))
from check_docs import REQUIRED, check_repository  # noqa: E402


class CheckDocsTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        for name in REQUIRED:
            p = self.root / name
            p.parent.mkdir(parents=True, exist_ok=True)
            p.write_text("# Title\n", encoding="utf-8")

    def test_valid_links(self):
        (self.root / "README.md").write_text(
            "[Spec](docs/DATA_MODEL.md) [Anchor](#title) "
            "[Github](https://github.com/) ![image](docs/DATA_MODEL.md)", encoding="utf-8"
        )
        self.assertEqual(check_repository(self.root), [])

    def test_broken_link(self):
        (self.root / "README.md").write_text("[Bad](missing.md)", encoding="utf-8")
        self.assertTrue(any("broken local link" in e for e in check_repository(self.root)))

    def test_escape(self):
        (self.root / "README.md").write_text("[Bad](../../secret.md)", encoding="utf-8")
        self.assertTrue(any("escapes repository" in e for e in check_repository(self.root)))

    def test_untrusted_url(self):
        (self.root / "README.md").write_text("[Bad](javascript:alert)", encoding="utf-8")
        self.assertTrue(any("unsupported" in e for e in check_repository(self.root)))

    def test_required_file(self):
        (self.root / "AGENTS.md").unlink()
        self.assertTrue(any("missing required file" in e for e in check_repository(self.root)))


if __name__ == "__main__":
    unittest.main()
