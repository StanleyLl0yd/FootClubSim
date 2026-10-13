# ADR-0001: Local-first browser architecture

**Status:** Proposed (2026-10-13; owner review before M0 exit).

## Context

FootClubSim is initially an offline-capable browser-based football management game in Russian. Matches are automatic calculations, not animated 2D/3D. Priority clients are macOS Safari and Windows Chromium. A dedicated Linux executable is not planned.

## Decision

- Separate pure TypeScript domain modules (match/rules/career) from web UI and browser storage.
- Initially plan a React + Vite UI, a Web Worker for potentially long computation and IndexedDB for local saves, plus file import/export.
- No mandatory backend, hosted account or OCI VM. Later cloud sync is optional and requires a separate decision and security model.
- Keep a versioned immutable starting dataset and a separately versioned mutable career snapshot.
- Distinguish gameplay rules from external football facts, browser rendering and platform-specific integrations.

## Reasons

Matches need deterministic testability and local responsiveness more than graphics. Browser-first supports Mac and Windows without two native UI implementations. Eliminating server-side dependence makes gameplay independent of connectivity and OCI instance availability.

## Consequences

Real Safari storage and offline behavior require dedicated acceptance, not only Chromium tests. Local saves need export/backup to protect against browser eviction. If performance later justifies WebAssembly, a native wrapper or remote compute, change only the outer adapter or replace a measured calculation module through an explicit ADR.

## Deferred decisions

Specific state management libraries, PWA rollout, Tauri packaging, database helper libraries, precise worker protocol and precise deployment host remain open. Do not import unused dependencies preemptively.
