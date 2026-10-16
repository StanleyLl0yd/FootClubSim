# GitHub repository protection and CI gate

Repository rules are enforced by GitHub at the repository level, not by this file.
For the operational audit trail, see [issue #217](https://github.com/StanleyLl0yd/FootClubSim/issues/217).

As verified on 2026-10-16, `main` has an active branch ruleset requiring
pull requests, squash merges, resolved review conversations, up-to-date
GitHub Actions status checks, CodeQL scanning, and signed commits. Force pushes,
branch deletion, and bypass are prohibited. Versioned tags matching `v*` are
immutable under a separate active tag ruleset.

The nine required GitHub Actions job names are:

- `TypeScript and domain tests`
- `Markdown links and Python unit tests`
- `npm dependency vulnerability audit`
- `Built app renders in Chromium`
- `Windows Chrome app and native v7 CAS`
- `Windows Edge app and native v7 CAS`
- `Safari M0 restore and native v7 IndexedDB CAS`
- `Analyze javascript-typescript`
- `Analyze python`

All required jobs run on every PR and every `main` push. The longer
240-fixture synthetic benchmark is intentionally **not** an unconditional
required check because that workflow is path-scoped.

CodeQL scanning thresholds: no security alerts at Medium or above, and
no code-scanning errors. The GitHub-managed aggregate `CodeQL` status may
be separate from the two required CodeQL analysis jobs.

For an administrator-only, idempotent configuration procedure, see
[`scripts/configure-github-rules.ps1`](../scripts/configure-github-rules.ps1).
That script deliberately waits for passing checks on the exact current
`main` revision before changing rules. Changes to these rules require
repository administrator authorization and an explicit verification that
they are enforced, rather than merely present.

## Enforcement smoke-test procedure

For an ordinary, non-draft PR targeting `main`, query GitHub checks for the
current head SHA and confirm all nine required jobs have succeeded before a
squash merge. A test merge attempted while these checks are still pending
must be denied by GitHub. The PR's `mergeable_state` is useful for monitoring,
but can lag behind completed checks; it is not proof by itself of either an
enforced rejection or a successful merge.

Verify that the resulting squash commit is signed, `main` remains protected,
the merged feature branch is auto-deleted, and all nine exact-main CI checks
pass. Do not disable protections, bypass CodeQL or force-push for this test.
