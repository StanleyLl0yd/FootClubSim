# M1 P1: versioned v8 interactive phase checkpoints

**Experimental synthetic engine-7 replay path, 2026-10-16.**

`src/core/m1-v8-phase-checkpoint.ts` provides ordinary manager
pause/continue/fast-forward behavior at deterministic **300-second
virtual checkpoints** (completed phases 0..18). Unlike the referee
interruption snapshot, `status=preview-paused` is an ordinary
simulation preview and is **not** a legal interruption or match ruling.

The checkpoint stores only the already completed event prefix and the
source commands, separately externally trusted referee decisions and
medical assertions known by that phase. It exposes seeded PRNG
continuation state, tentative goals, virtual-time physical presence and
an optional **full-time preview report only at phase 18**. It is not a
saved career transaction or permission to post points.

On continue/fast-forward, the supplied previous checkpoint is
recalculated from the original trusted prematch, rules, manager policy,
command timeline, referee claims and medical history, then compared
field-for-field. New commands/decisions/treatment actions must be
at or after the previous checkpoint and before the next requested
phase. Backdated actions, forged prior events/states and attempted
post-full-time commands return typed failures. The same versioned v8
event engine generates both paused and uninterrupted simulations.

**Limits:** the current algorithm reruns the complete bounded
18-phase engine for validation on each checkpoint, not optimized
direct PRNG resume. Input provenance is not cryptographically
authenticated. Referee and medical events remain independently
asserted external facts; passing the replay merely checks consistency,
not authenticity or complete IFAB/RFU procedure. Not genuine 1-second
match control, retrospective match adjudication, referee-stopped
resume, official lineup record, career CAS, player condition posting,
realistic calibration or M1 acceptance. No writes to M0/v3-v7 saves,
existing journals, synthetic data or v8 event schema.

P1 #27, P3 #29, P4 #30, P5 #31, exit #3 remain OPEN. M2 prohibited
until separately approved.
