#!/usr/bin/env python3
"""Deterministic tracked-file inventory and basic public-repository safety checks.

A green result is not a legal rights audit or proof of absence of all secrets.
Only Git-tracked files are examined; no external data sources are contacted.
"""
from __future__ import annotations

import json
import re
import subprocess
import sys
from pathlib import Path, PurePosixPath

ASSET_SUFFIXES = {
    ".png", ".jpg", ".jpeg", ".gif", ".webp", ".ico", ".icns", ".svg",
    ".pdf", ".woff", ".woff2", ".ttf", ".otf", ".mp3", ".mp4", ".csv",
    ".sqlite", ".db", ".parquet", ".zip", ".7z", ".gz",
}
SOURCE_SUFFIXES = {".ts", ".tsx", ".mjs", ".py", ".css"}
TEXT_SUFFIXES = SOURCE_SUFFIXES | {".md", ".json", ".html", ".yml", ".yaml", ".txt"}
GENERATED_DIRS = {"node_modules", "dist", "web-dist", "build", ".git", ".venv"}
TOKEN_PATTERNS = {
    "GitHub classic token": re.compile(r"\bgh[oprsu]_[A-Za-z0-9]{36}\b"),
    "GitHub fine-grained token": re.compile(r"\bgithub_pat_[A-Za-z0-9_]{60,}\b"),
    "AWS key ID": re.compile(r"\bAKIA[0-9A-Z]{16}\b"),
    "API secret token": re.compile(r"\bsk-(?:proj-)?[A-Za-z0-9_-]{30,}\b"),
    "private key header": re.compile(
        "-----BEGIN " + r"(?:RSA |EC |OPENSSH |ENCRYPTED )?PRIVATE KEY-----"
    ),
}
ACTION_USE = re.compile(r"^\s*(?:-\s*)?uses:\s*(\S+)", re.MULTILINE)
PINNED_ACTION = re.compile(r"^[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+(?:/[A-Za-z0-9_.-]+)*@[0-9a-f]{40}$")


def is_safe_asset_path(value: object) -> bool:
    if not isinstance(value, str) or "\\" in value:
        return False
    p = PurePosixPath(value)
    return not p.is_absolute() and ".." not in p.parts and p.as_posix() == value


def audit_files(root: Path, files: list[str], declared_assets: set[str]):
    """Return statistics and concerns from an exact Git-tracked file list."""
    concerns: list[str] = []
    stats = {
        "trackedFiles": 0,
        "trackedBytes": 0,
        "sourceFiles": 0,
        "sourceLines": 0,
        "testFiles": 0,
        "documentationFiles": 0,
        "assetFiles": 0,
    }
    for path in sorted(files):
        if not is_safe_asset_path(path):
            concerns.append(f"{path}: unsafe tracked path")
            continue
        item = root / path
        if not item.is_file() or item.is_symlink():
            concerns.append(f"{path}: missing file or tracked symlink")
            continue
        if any(part in GENERATED_DIRS for part in PurePosixPath(path).parts):
            concerns.append(f"{path}: generated/dependency tree tracked")
        if PurePosixPath(path).name == ".env" or PurePosixPath(path).name.startswith(".env."):
            concerns.append(f"{path}: environment file tracked")
        data = item.read_bytes()
        stats["trackedFiles"] += 1
        stats["trackedBytes"] += len(data)
        suffix = item.suffix.lower()
        if suffix in ASSET_SUFFIXES:
            stats["assetFiles"] += 1
            if path not in declared_assets:
                concerns.append(f"{path}: asset/data file is not listed in the reviewed manifest")
        if suffix == ".md":
            stats["documentationFiles"] += 1
        if path.startswith(("tests/", "scripts/tests/")):
            stats["testFiles"] += 1
        if suffix in SOURCE_SUFFIXES:
            stats["sourceFiles"] += 1
            stats["sourceLines"] += len(data.splitlines())
        if suffix not in TEXT_SUFFIXES and item.name not in {".gitignore"}:
            continue
        try:
            text = data.decode("utf-8")
        except UnicodeDecodeError:
            concerns.append(f"{path}: supposedly text file is not UTF-8")
            continue
        for label, pattern in TOKEN_PATTERNS.items():
            if pattern.search(text):
                concerns.append(f"{path}: possible {label} (value never logged)")
        if path.startswith(".github/workflows/") and suffix in {".yml", ".yaml"}:
            for action in ACTION_USE.findall(text):
                if action.startswith("./"):
                    continue
                if not PINNED_ACTION.fullmatch(action):
                    concerns.append(f"{path}: unpinned third-party action {action.split('@')[0]}")
    for declared in sorted(declared_assets):
        if declared not in files:
            concerns.append(f"{declared}: declared asset does not exist among tracked files")
    return stats, concerns


def read_manifest(root: Path) -> tuple[set[str], list[str]]:
    path = root / "data/packs/m0-synthetic-manifest.json"
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, UnicodeError, ValueError):
        return set(), ["synthetic asset manifest unreadable"]
    values = data.get("assetPaths")
    if not isinstance(values, list) or any(not is_safe_asset_path(value) for value in values):
        return set(), ["synthetic asset manifest has invalid asset paths"]
    if len(set(values)) != len(values):
        return set(), ["synthetic asset manifest duplicates an asset path"]
    return set(values), []


def tracked_file_paths(root: Path) -> list[str]:
    result = subprocess.run(
        ["git", "ls-files", "-z"], cwd=root, check=True,
        stdout=subprocess.PIPE, stderr=subprocess.PIPE,
    )
    return [path.decode("utf-8") for path in result.stdout.split(b"\0") if path]


def main() -> int:
    root = Path(__file__).resolve().parents[1]
    try:
        paths = tracked_file_paths(root)
    except (OSError, subprocess.CalledProcessError, UnicodeDecodeError):
        print("ERROR: unable to enumerate the Git-tracked repository", file=sys.stderr)
        return 1
    allowed, errors = read_manifest(root)
    stats, concerns = audit_files(root, paths, allowed)
    print("TRACKED_REPO_METRICS=" + json.dumps(stats, sort_keys=True))
    for error in errors + concerns:
        print("ERROR: " + error, file=sys.stderr)
    if errors or concerns:
        return 1
    print("PASS: tracked inventory, known secret signatures, declared assets and action pins")
    print("NOTE: automated heuristics do not establish source permissions or complete security clearance")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
