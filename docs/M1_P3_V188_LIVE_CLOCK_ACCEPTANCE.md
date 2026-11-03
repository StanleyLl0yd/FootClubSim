# M1 P3-1: executable v188 clock, on-field keeper and source stops

This change is scoped to **P3-1 acceptance criterion 1** and the
source-related subcases of criteria 2 and 3. It uses the already
accepted fictional v184/v105 source, **not a new referee simulator**.

On every v188 prepare and replay admission, the same physical event
chronology must produce the v179 running/stopped clock. A shot or special
goal is refused unless the opponent's currently physical XI includes
exactly one registered goalkeeper. All manager substitutions must have
a generated referee stoppage (including actual foul whistle) or halftime;
the source v23 independently verifies the actual seeded stop.

The clock view is exposed as **transient** on the prepared v188 proposal;
the v188 journal, original M0 and v8 persistence bytes and old schema
remain unchanged. No external referee evidence, KDK sanction expiry,
clinical authority, other Law 5 exceptions or complete league
recovery is implied. An actual 10-player restart and subsequent shot
must pass a deterministic fixture test; a fabricated nonwhistle
substitution and forged absent shooter must fail.

P3-1 remains OPEN until **all** three matrix criteria have exact-main
acceptance evidence. P3-2/P3-3/P3-4 and P5 remain independent gates;
the 2024/25 holdout stays sealed.

## P3-1 ordinary goal-restart substitution (Law 3)

The same `v23` causal source now admits a user-requested ordinary
in-play substitution at a **verified goal restart**, not only at
seed-generated carded foul whistles or halftime. The proof is derived
from the existing v23 referee's real `goal-whistle` at running second
T−1 on the replayed source before any new command at T. Generated
incidents, physical roster, future shots and the saved result then
replay with that exact command. No caller-declared goal/referee identity
is trusted. An ungenerated stop fails closed; the ordinary automatic
path does not perform any speculative forecasting or consume PRNG.
The goal/foul same-second collision and unimplemented IFAB 2026/27
late-entry exceptions remain explicitly unsupported.

The source is official IFAB Law 3 substitution procedure:
https://www.theifab.com/laws/latest/the-players/

The new deterministic regression must establish a **positive** real
goal-based source switch on v188, plus a forged-stop and tampered-goal
negative and historical journal replay before this can contribute to
P3-1 acceptance. P3-1 remains OPEN pending full three-criterion review.

## P3-1 single simulated referee and physical wall clock

Before this integration the v188/v179 view projected 30s after a goal,
15–25s for cards, 10s for a replacement and 45s for medical exit;
the causal v23 source instead used 0s after goals, 20s for a
carded-foul stop and no extra substitution/treatment delay. Two
inconsistent wall clocks for the same seed fail the first P3-1 gate.

The common M1 fictional policy is now 30s per generated goal restart,
20s per generated carded foul, 900s halftime, and **no additional
stoppage minted by substitution or medical exit/return**. On the v188
causal source only, v23 uses these constants; legacy noncausal v23
keeps its original 0s-goal research behavior. v179 projects exactly
those same durations from the identical v105 physical events.

The native integration test compares each source shot's player,
running seconds and modelled wall seconds and the final full-time wall
clock between causal v23 and v188/v179, across distinct seeded
fixtures. Inconsistency is a FAIL, not an alternative time source.
Neither official timing, medical/KDK clearance nor P5 calibration is
inferred. Original persisted M0/v8/v188 schema and PRNG remain intact.

### Source-model correction after actual CI failure

The first integrated P3-1 clock test failed: v23's legacy 300-second
v8 match had only **4 actual shots**, whereas the persisted v105/v103
100-second physical source had **18**. This is a real dual-authority
mismatch, not a missing assertion. v188 now expressly opts into a v103
shot-chronology referee using independently replay-matched v8 checkpoint
physical transitions. The old v23/v29/v184 research path is unchanged.
Old v188 saved entries with no version field are accepted only if their
full original generated source, result, physical XI and clock still
replay exactly under the old model; no forged bytes are trusted. Dense
goals at 100-second boundaries have a pause but cannot authorize a
manager substitution outside the existing 300-second source gate.
Half-time/full-time goals do not mint a non-existent kick-off pause.

### Security: historical replay is not an append policy

Exact old v188 saved entries may be independently replayed with the
original validated v8 causal referee source when the newer v103 replay
does not match those exact bytes. **Every newly submitted match entry**
uses only the dense v103 referee and physical source; source fallback is
for historical read, never current journal admission. The rule rejects
injected event and score mutations and preserves immutable older files.
