# M1 P3 v80: opt-in interactive medical-gated fixture prototype

This is the first **human-clickable** M1 fixture flow, deliberately
separate from the accepted M0 React shell and its shipping bundle.

Open `examples/m1-v80-interactive-career.html` through the Vite dev
server after `npm run build:core`. Click **Создать или открыть карьеру**
to load an existing immutable M0 career or create an add-only one with
a separate v32 schema-6 journal. Click **Сыграть следующий матч** to
simulate the next unplayed synthetic fixture and persist it using only
`commitM1V76PersistedMedicallyGatedFixture`.

The UI reloads and fully verifies the original M0 and complete source
journal before choosing each match. Seed selection is deterministic
SHA-256(domain, careerId, fixtureId), distributed into the unchanged
production xorshift32-v1 RNG state; it never silently rerolls failed
source generation. The v75/v76 source-replayed medical and two-club
automatic discipline gate plus native exact-snapshot CAS is the only
write path on this page. Rejected medical/discipline admission, stale
CAS, invalid source or quota errors display a refusal; no low-level
v32 batch fallback or automatic treatment clearance is provided.

Native Chromium, Windows Chrome/Edge and Safari workflows test one
real UI action, saving the first fixture, a page navigation, a fresh
fully source-replayed journal load, preserved M0, and status output.
Existing v78 tests separately cover forged results, stale revisions,
real concurrent writers and transaction rollback.

**Limitations:** This is not production M1 gameplay. Standard XI and
bench cannot yet be adjusted and may be blocked by modelled permanent
injuries or synthetic automatic sanctions. No staff-signed recovery,
IFAB Law 5 exceptional return ruling, official KDK/referee
authentication, trusted lineup roster registration, external football
realism pass or release performance benchmark. The v80 UI's sequential
main-thread replay may pause the page for long histories. Browser
storage can still be evicted; release requires independently verified
backup/restore and safe resumed lifecycle.

P3 #29 OPEN; P5 #31 OPEN; P4 #30 deferred. The two full
repository-wide M1 exit audits #3 remain required, M1 OPEN,
M2 prohibited.
