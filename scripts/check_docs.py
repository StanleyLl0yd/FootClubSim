#!/usr/bin/env python3
"""Validate repository Markdown links without external dependencies."""

from __future__ import annotations

import re
import sys
from os import walk
from pathlib import Path
from urllib.parse import unquote, urlsplit

LINK = re.compile(r"(?<!!)\[[^\]]+\]\(([^\)]+)\)|!\[[^\]]*\]\(([^\)]+)\)")
SKIP_DIRS = {".git", "node_modules", ".venv", "dist", "web-dist", "build"}
REQUIRED = {
    "AGENTS.md", "README.md", "ROADMAP.md", "ARCHITECTURE.md",
    "COPYRIGHT.md", "SECURITY.md", "CONTRIBUTING.md",
    "docs/DATA_MODEL.md", "docs/MATCH_ENGINE.md",
    "docs/DATA_SOURCES.md", "docs/M0_ACCEPTANCE.md",
}


def iter_markdown_files(root: Path):
    """Prune ignored dependency/build trees before visiting their contents."""
    for directory, subdirs, files in walk(root, followlinks=False):
        subdirs[:] = sorted(
            name for name in subdirs
            if name not in SKIP_DIRS and not (Path(directory) / name).is_symlink()
        )
        for name in sorted(files):
            if name.endswith(".md"):
                yield Path(directory) / name


def check_repository(root: Path) -> list[str]:
    root = root.resolve()
    errors: list[str] = []
    for required in sorted(REQUIRED):
        if not (root / required).is_file():
            errors.append(f"missing required file: {required}")
    for file in iter_markdown_files(root):
        relative = file.relative_to(root)
        if file.is_symlink():
            errors.append(f"{relative}: symlinked Markdown file is not allowed")
            continue
        try:
            content = file.read_text(encoding="utf-8")
        except UnicodeError:
            errors.append(f"{relative}: not UTF-8")
            continue
        for match in LINK.finditer(content):
            destination = (match.group(1) or match.group(2)).strip()
            if not destination:
                errors.append(f"{relative}: empty link")
                continue
            if destination.startswith("#"):
                continue
            parsed = urlsplit(destination)
            if parsed.scheme in {"https", "http", "mailto"}:
                continue
            if parsed.scheme or parsed.netloc or destination.startswith(("/", "\\")):
                errors.append(f"{relative}: unsupported or absolute URL: {destination}")
                continue
            target = (file.parent / unquote(parsed.path)).resolve()
            if not target.is_relative_to(root):
                errors.append(f"{relative}: link escapes repository: {destination}")
            elif not target.is_file():
                errors.append(f"{relative}: broken local link: {destination}")
    return errors


def main() -> int:
    root = Path(__file__).resolve().parents[1]
    errors = check_repository(root)
    if errors:
        for error in errors:
            print(f"ERROR: {error}", file=sys.stderr)
        return 1
    print("PASS: required docs present; all checked Markdown file links resolve")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
