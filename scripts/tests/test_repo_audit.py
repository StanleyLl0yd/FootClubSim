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

    def test_binary_build_outputs_cannot_evade_asset_inventory(self):
        paths = [
            "payload.wasm", "bin/tool.exe", "native/addon.so",
            "native/addon.dylib", "app/build.apk", "app/bundle.aab",
            "archives/content.jar", "archive/data.tar", "archive/data.zst",
        ]
        for name in paths:
            self.put(name, b"binary payload")
        metrics, concerns = audit_files(self.root, paths, set())
        self.assertEqual(metrics["assetFiles"], len(paths))
        self.assertEqual(len([c for c in concerns if "reviewed manifest" in c]), len(paths))
        self.assertEqual(audit_files(self.root, paths, set(paths))[1], [])

    def test_disguised_binary_payload_requires_review(self):
        self.put("bin/blob.unknown", b"prefix\\x00payload")
        self.put("data/custom.txt", b"prefix\\x00payload")
        paths = ["bin/blob.unknown", "data/custom.txt"]
        _, concerns = audit_files(self.root, paths, set())
        self.assertEqual(len([c for c in concerns if "binary content" in c]), 2)

    def test_extended_text_config_is_checked_for_secrets(self):
        token = "gh" + "p_" + "z" * 36
        for filename in ("config/settings.toml", "scripts/setup.sh", "app/build.gradle"):
            self.put(filename, f"auth = '{token}'\\n")
            _, concerns = audit_files(self.root, [filename], set())
            self.assertTrue(any("GitHub classic token" in c for c in concerns))
            self.assertFalse(any(token in c for c in concerns))

    def test_manifest_rejects_path_traversal_and_duplicates(self):
        manifest = "data/packs/m0-synthetic-manifest.json"
        self.put(manifest, '{"assetPaths":["../external.png"]}\n')
        self.assertTrue(read_manifest(self.root)[1])
        self.put(manifest, '{"assetPaths":["assets/icon.png","assets/icon.png"]}\n')
        self.assertTrue(read_manifest(self.root)[1])
        self.put(manifest, '{"assetPaths":["assets/icon.png"]}\n')
        self.assertEqual(read_manifest(self.root),
                         (set(), ["M0 synthetic manifest must not declare external asset paths"]))
        self.put(manifest, '{"assetPaths":[]}\n')
        self.assertEqual(read_manifest(self.root), (set(), []))

    def test_manifest_rejects_non_object_json_with_typed_error(self):
        manifest = "data/packs/m0-synthetic-manifest.json"
        for invalid in ("[]", "null", "42", '"hello"'):
            self.put(manifest, invalid + "\n")
            allowed, errors = read_manifest(self.root)
            self.assertEqual(allowed, set())
            self.assertEqual(errors, ["synthetic asset manifest must be a JSON object"])

    def test_unsafe_paths_are_rejected(self):
        for value in ["/absolute.png", "../up.png", "folder/../up.png", "folder\\logo.png", ""]:
            self.assertFalse(is_safe_asset_path(value))
        self.assertTrue(is_safe_asset_path("assets/original.png"))

    def test_sensitive_filenames_are_flagged_even_without_known_token_signatures(self):
        paths = [
            "config/.npmrc", "config/.pypirc", "config/.netrc",
            "keys/id_rsa", "keys/id_ed25519", "keys/id_ecdsa",
            "keys/dev.pem", "keys/device.key", "keys/client.p12",
            "keys/client.pfx", "keys/client.jks", "keys/device.keystore",
            "keys/passwords.kdbx",
        ]
        for name in paths:
            self.put(name, "dummy placeholder, no actual credential")
        stats, concerns = audit_files(self.root, paths, set())
        self.assertEqual(stats["trackedFiles"], len(paths))
        self.assertEqual(len([x for x in concerns if "possible private key" in x]), len(paths))
        self.assertFalse(any("dummy placeholder" in x for x in concerns))
        self.put("keys/id_rsa.pub", "PUBLIC TEST KEY")
        self.assertEqual(audit_files(self.root, ["keys/id_rsa.pub"], set())[1], [])

    def test_environment_file_and_binary_text_mismatch(self):
        self.put(".env", "NO_REAL_SECRET=true\n")
        self.put("README.md", b"\xff")
        errors = audit_files(self.root, [".env", "README.md"], set())[1]
        self.assertTrue(any("environment file" in c for c in errors))
        self.assertTrue(any("UTF-8" in c for c in errors))


if __name__ == "__main__":
    unittest.main()
