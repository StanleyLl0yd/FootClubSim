# M1 P3 v110: native atomic CAS for a separate signed-source journal

A *research-only* browser IndexedDB adapter for the pure v109
signed-source history. M0 initial careers and historical v7/schema-6
journals are never upgraded, rewritten, or silently reinterpreted.

1. Read the M0 initial career using its existing validated add-only store.
2. Read a coherent v110 journal snapshot from an isolated IndexedDB database.
3. **Outside** the write transaction, independently reverify all old
   signatures, source hashes, M0 fixtures/catalog, challenge uniqueness
   and original v105 chronology; verify the new signed entry and revision.
4. Inside **one** IndexedDB readwrite transaction, compare the currently
   stored whole journal to the exact prevalidated snapshot and revision.
   Reject a stale writer or altered record without a put; otherwise issue
   precisely one put. Report success only after transaction completion.
5. Reload revalidates full history; quota, corruption and rejected
   transactions never repair or overwrite historical source records.

A deterministic staged-IDB test model exercises add-only creation,
reload, concurrent writers, corrupted data, stale revisions, wrong
key, invalid ID, quota failure and rollback.

```bash
npm ci
npm run build:core
node --test tests/m1-v109-signed-journal.test.mjs
node --test tests/m1-v110-signed-journal-store.test.mjs
```

This DOES NOT establish real-world referee/physician authority or
host-issued challenge namespace, globally prevent rollback against
malicious local-storage rewriting, implement an authenticated external
signer registry, or fill missing legal exceptional rulings. Native v110-specific smoke fixtures are now wired into Linux Chromium,
Windows Chrome/Edge and macOS Safari CI. They test a real navigation,
Ed25519 replay and competing IndexedDB writers. Those checks must finish
successfully on the exact PR HEAD before they count as browser evidence;
v7-only smoke results do not validate v110.

P3 #29 and P5 #31 stay OPEN, M1 and exit audit #3 OPEN.
P4 #30 deferred; M2 prohibited.
