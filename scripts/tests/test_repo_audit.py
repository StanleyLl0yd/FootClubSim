"""Tests of Git inventory/rights heuristics without reading credentials."""
import tempfile
import unittest
from pathlib import Path
from sys import path

path.insert(0, str(Path(__file__).resolve().parents[1]))
from repo_audit import audit_files, is_safe_asset_path, read_manifest  # noqa: E402


class RepositoryAuditTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)

    def put(self, name, value):
        destination = self.root / name
        destination.parent.mkdir(parents=True, exist_ok=True)
        if isinstance(value, bytes):
            destination.write_bytes(value)
        else:
            destination.write_text(value, encoding="utf-8")
        return destination

    def test_counts_reproducible_files_and_lines(self):
        self.put("src/core/model.ts", "const x = 1;\nconst y = 2;\n")
        self.put("tests/demo.test.mjs", "test('simple', () => {});\n")
        self.put("README.md", "# Hello\n")
        files = ["src/core/model.ts", "tests/demo.test.mjs", "README.md"]
        metrics, concerns = audit_files(self.root, files, set())
        self.assertEqual(concerns, [])
        self.assertEqual(metrics["trackedFiles"], 3)
        self.assertEqual(metrics["sourceFiles"], 2)
        self.assertEqual(metrics["sourceLines"], 3)
        self.assertEqual(metrics["testFiles"], 1)
        self.assertEqual(metrics["documentationFiles"], 1)
        self.assertEqual(metrics["trackedBytes"], sum((self.root / f).stat().st_size for f in files))

    def test_asset_requires_declared_path_but_license_still_needs_review(self):
        self.put("assets/club.png", b"not a real image")
        files = ["assets/club.png"]
        self.assertTrue(any("reviewed manifest" in c for c in audit_files(self.root, files, set())[1]))
        self.assertEqual(audit_files(self.root, files, {"assets/club.png"})[1], [])
        self.assertTrue(any("does not exist" in c for c in
                            audit_files(self.root, [], {"assets/unused.png"})[1]))

    def test_symlinks_and_generated_files_are_rejected(self):
        self.put("src/present.ts", "export const value = 1;\n")
        self.put("node_modules/demo.js", "const a = 1;\n")
        self.assertTrue(any("generated" in c for c in
                            audit_files(self.root, ["node_modules/demo.js"], set())[1]))
        self.assertTrue(any("missing file" in c for c in
                            audit_files(self.root, ["no-such-file.ts"], set())[1]))
        try:
            (self.root / "src/linked.ts").symlink_to(self.root / "src/present.ts")
        except (OSError, NotImplementedError):
            self.skipTest("symlinks unavailable")
        self.assertTrue(any("tracked symlink" in c for c in
                            audit_files(self.root, ["src/linked.ts"], set())[1]))

    def test_scan_known_token_signatures_without_disclosing_values(self):
        prefix = "gh" + "p_"
        self.put("config.json", '{"token":"' + prefix + "z" * 36 + '"}\n')
        metrics, concerns = audit_files(self.root, ["config.json"], set())
        self.assertEqual(metrics["trackedFiles"], 1)
        self.assertTrue(any("GitHub classic token" in c for c in concerns))
        self.assertFalse(any("z" * 36 in c for c in concerns))

    def test_unpinned_action_is_rejected_and_sha_action_allowed(self):
        self.put(".github/workflows/example.yml", "steps:\n  - uses: actions/checkout@v4\n")
        files = [".github/workflows/example.yml"]
        self.assertTrue(any("unpinned" in c for c in audit_files(self.root, files, set())[1]))
        self.put(".github/workflows/example.yml",
                 "steps:\n  - uses: actions/checkout@" + "a" * 40 + "\n"
                 "  - uses: ./local-action\n")
        self.assertEqual(audit_files(self.root, files, set())[1], [])

    def test_manifest_rejects_path_traversal_and_duplicates(self):
        manifest = "data/packs/m0-synthetic-manifest.json"
        self.put(manifest, '{"assetPaths":["../external.png"]}\n')
        self.assertTrue(read_manifest(self.root)[1])
        self.put(manifest, '{"assetPaths":["assets/icon.png","assets/icon.png"]}\n')
        self.assertTrue(read_manifest(self.root)[1])
        self.put(manifest, '{"assetPaths":["assets/icon.png"]}\n')
        self.assertEqual(read_manifest(self.root), ({"assets/icon.png"}, []))

    def test_unsafe_paths_are_rejected(self):
        for value in ["/absolute.png", "../up.png", "folder/../up.png", "folder\\logo.png", ""]:
            self.assertFalse(is_safe_asset_path(value))
        self.assertTrue(is_safe_asset_path("assets/original.png"))

    def test_environment_file_and_binary_text_mismatch(self):
        self.put(".env", "NO_REAL_SECRET=true\n")
        self.put("README.md", b"\xff")
        errors = audit_files(self.root, [".env", "README.md"], set())[1]
        self.assertTrue(any("environment file" in c for c in errors))
        self.assertTrue(any("UTF-8" in c for c in errors))


if __name__ == "__main__":
    unittest.main()
