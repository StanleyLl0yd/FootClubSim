#!/usr/bin/env python3
"""M0 shipping-bundle boundary check; not legal clearance or a full security audit.

Inspect the built Vite directory, not just Git-tracked source. M0 intentionally
ships no downloaded football databases, images, fonts, PDFs or other binary files.
The only extra text artifact is the generated dependency license notice.
"""
from __future__ import annotations

import json
import re
import sys
from pathlib import Path

ASSET_PATH = re.compile(r"^assets/[A-Za-z0-9_-]+\.(?:js|css)$")
RESEARCH_MARKERS = (
    "data/drafts/", "data/packs/", "wikipedia.org", "wikidata.org",
    "transfermarkt.", "reportedCoachLeads", "sourcePlayerRowsImported",
)
MAX_FILE_BYTES = 5_000_000
LICENSE_FILE = "THIRD_PARTY_LICENSES.txt"


def inspect_bundle(root: Path, required_notices: dict[str, str] | None = None) -> tuple[dict[str, int], list[str]]:
    metrics = {"files": 0, "bytes": 0, "scripts": 0, "styles": 0}
    concerns: list[str] = []
    license_text = ""
    if not root.is_dir() or root.is_symlink():
        return metrics, ["web build directory missing or is a symlink"]
    for item in sorted(root.rglob("*")):
        rel = item.relative_to(root).as_posix()
        if item.is_symlink():
            concerns.append(f"{rel}: symlink in production bundle")
            continue
        if item.is_dir():
            continue
        if not item.is_file():
            concerns.append(f"{rel}: non-file production entry")
            continue
        metrics["files"] += 1
        size = item.stat().st_size
        metrics["bytes"] += size
        if rel not in {"index.html", LICENSE_FILE} and not ASSET_PATH.fullmatch(rel):
            concerns.append(f"{rel}: unexpected shipped file type or path")
            continue
        if rel.endswith(".js"):
            metrics["scripts"] += 1
        elif rel.endswith(".css"):
            metrics["styles"] += 1
        if size > MAX_FILE_BYTES:
            concerns.append(f"{rel}: M0 bundle file exceeds review size limit")
            continue
        try:
            text = item.read_text(encoding="utf-8")
        except UnicodeError:
            concerns.append(f"{rel}: production entry is not UTF-8 text")
            continue
        if "\x00" in text:
            concerns.append(f"{rel}: NUL in production text")
        if rel == LICENSE_FILE:
            license_text = text
        for marker in RESEARCH_MARKERS:
            if marker.casefold() in text.casefold():
                concerns.append(f"{rel}: research-only reference included in M0 bundle ({marker})")
    if not (root / "index.html").is_file():
        concerns.append("index.html: missing Vite browser entrypoint")
    if metrics["scripts"] < 1 or metrics["styles"] < 1:
        concerns.append("production bundle missing JavaScript or CSS")
    if not license_text.strip():
        concerns.append(f"{LICENSE_FILE}: missing dependency license notices")
    for heading, notice in (required_notices or {}).items():
        if f"{heading}\n\n{notice.strip()}" not in license_text:
            concerns.append(f"{LICENSE_FILE}: missing or incomplete notice for {heading}")
    return metrics, concerns


def main() -> int:
    repo = Path(__file__).resolve().parents[1]
    notices = {}
    try:
        for name in ("react", "react-dom", "scheduler"):
            package = repo / "node_modules" / name
            metadata = json.loads((package / "package.json").read_text(encoding="utf-8"))
            heading = f"## {name} - {metadata['version']} ({metadata['license']})"
            notices[heading] = (package / "LICENSE").read_text(encoding="utf-8")
    except (OSError, UnicodeError, ValueError, KeyError):
        print("ERROR: installed dependency license texts unavailable; run npm ci first", file=sys.stderr)
        return 1
    metrics, concerns = inspect_bundle(repo / "web-dist", notices)
    print(f"M0_WEB_BUNDLE_FILES={metrics['files']} BYTES={metrics['bytes']}")
    for message in concerns:
        print("ERROR: " + message, file=sys.stderr)
    if concerns:
        return 1
    print("PASS: M0 HTML/JS/CSS and exact dependency notices, without known research markers")
    print("NOTE: this is a bounded artifact check, not proof of source rights or absence of all third-party code")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
