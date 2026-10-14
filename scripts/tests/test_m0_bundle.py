"""Negative cases for the generated M0 Vite shipping boundary."""
import tempfile
import unittest
from pathlib import Path
from sys import path

path.insert(0, str(Path(__file__).resolve().parents[1]))
from check_m0_bundle import inspect_bundle  # noqa: E402


class M0BundleTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.root = Path(self.tmp.name)
        self.put("index.html", "<html><div id='root'></div></html>")
        self.put("assets/app-123.js", "console.log('fictional');")
        self.put("assets/app-123.css", "body { color: black; }")

    def put(self, name, text):
        p = self.root / name
        p.parent.mkdir(parents=True, exist_ok=True)
        if isinstance(text, bytes):
            p.write_bytes(text)
        else:
            p.write_text(text, encoding="utf-8")
        return p

    def test_expected_m0_static_bundle(self):
        metrics, concerns = inspect_bundle(self.root)
        self.assertEqual(concerns, [])
        self.assertEqual(metrics["files"], 3)
        self.assertEqual(metrics["scripts"], 1)
        self.assertEqual(metrics["styles"], 1)

    def test_research_data_artwork_and_mobile_package_are_not_shipped(self):
        for name in (
            "data/drafts/club.json", "assets/crest.svg",
            "assets/photo.png", "assets/football.csv", "app.apk",
        ):
            self.put(name, b"content")
        _, concerns = inspect_bundle(self.root)
        self.assertEqual(len([c for c in concerns if "unexpected shipped" in c]), 5)

    def test_research_marker_inside_javascript_is_rejected(self):
        for marker in ("data/drafts/", "WIKIDATA.ORG", "reportedCoachLeads"):
            self.put("assets/app-123.js", "let data = " + repr(marker) + ";")
            _, concerns = inspect_bundle(self.root)
            self.assertTrue(any("research-only" in c for c in concerns), marker)

    def test_binary_text_or_oversized_output_does_not_pass(self):
        self.put("assets/app-123.js", b"binary" + bytes([0]) + b"script")
        _, concerns = inspect_bundle(self.root)
        self.assertTrue(any("NUL" in c for c in concerns))
        self.put("assets/app-123.js", b"x" * 5_000_001)
        _, concerns = inspect_bundle(self.root)
        self.assertTrue(any("size limit" in c for c in concerns))
        self.put("assets/app-123.js", bytes([0xff, 0xfe]))
        _, concerns = inspect_bundle(self.root)
        self.assertTrue(any("UTF-8" in c for c in concerns))

    def test_missing_js_or_css_blocks_acceptance(self):
        (self.root / "assets/app-123.css").unlink()
        _, concerns = inspect_bundle(self.root)
        self.assertTrue(any("missing JavaScript or CSS" in c for c in concerns))

    def test_symlinked_output_is_rejected(self):
        p = self.root / "assets/link.js"
        try:
            p.symlink_to(self.root / "assets/app-123.js")
        except (OSError, NotImplementedError):
            self.skipTest("symlinks unavailable")
        _, concerns = inspect_bundle(self.root)
        self.assertTrue(any("symlink" in c for c in concerns))


if __name__ == "__main__":
    unittest.main()
