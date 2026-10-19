import test from 'node:test';
import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';
import { simulateM1V8WithSignedSource }
  from '../dist/core/m1-v8-signed-execution.js';
import { M1_V8_AUTHORITY_PURPOSE }
  from '../dist/core/m1-v8-authority-attestation.js';
import { simulateM1V8MedicalPhases }
  from '../dist/core/m1-v8-medical-phases.js';
import { M1_ENGINE_VERSION } from '../dist/core/m1-clock.js';
import { MATCH_LEDGER_VERSION, M0_RULES_PACK_ID, M0_RULES_PACK_VERSION }
  from '../dist/core/match-contracts.js';
import { createSyntheticRplScaleCatalog, defaultSyntheticLineup }
  from '../dist/core/synthetic.js';
import { generateDoubleRoundRobin } from '../dist/core/fixtures.js';
import { RNG_VERSION } from '../dist/core/rng.js';
import { defaultTacticalPlan } from '../dist/core/tactics.js';

const catalog = createSyntheticRplScaleCatalog(77);
const fixture = generateDoubleRoundRobin(catalog.clubs.map(c => c.id))[0].fixtures[0];
const home = defaultSyntheticLineup(catalog.clubs.find(c => c.id === fixture.homeClubId));
const away = defaultSyntheticLineup(catalog.clubs.find(c => c.id === fixture.awayClubId));
const prematch = () => ({
  schemaVersion: MATCH_LEDGER_VERSION, engineVersion: M1_ENGINE_VERSION,
  rulesPackId: M0_RULES_PACK_ID, rulesPackVersion: M0_RULES_PACK_VERSION,
  fixture, catalog, homeLineup: home, awayLineup: away,
  homeTactics: defaultTacticalPlan(fixture.homeClubId),
  awayTactics: defaultTacticalPlan(fixture.awayClubId),
  rosterRules: { starterCount: 11, maxBench: 12, maxForeignersOnField: 7 },
  rngAlgorithmVersion: RNG_VERSION, rngSeed: 42,
});
const policy = () => ({
  home: { assignedActor: { kind: 'player' }, availableStaffIds: [] },
  away: { assignedActor: { kind: 'player' }, availableStaffIds: [] },
});
const context = () => ({
  careerId: 'signed-v8-career', fixtureId: fixture.id,
  expectedRevision: 3, challengeId: 'externally-issued-one-time-id-1',
});
const keypair = webcrypto.subtle.generateKey('Ed25519', true, ['sign', 'verify']);
async function envelope(ctx, decisions, medical) {
  const keys = await keypair;
  const payload = JSON.stringify({
    schemaVersion: 1, purpose: M1_V8_AUTHORITY_PURPOSE, ...ctx,
    trustedDecisions: decisions, medicalActions: medical,
  });
  const signature = await webcrypto.subtle.sign(
    'Ed25519', keys.privateKey, new TextEncoder().encode(payload));
  return { schemaVersion: 1, payload,
    signature: Buffer.from(signature).toString('base64url') };
}
const run = async (env, ctx = context(), decisions = [], medical = [],
  input = prematch(), commands = [], trustedKey = null) =>
  simulateM1V8WithSignedSource(input, policy(), commands, decisions, medical,
    ctx, env, trustedKey ?? (await keypair).publicKey);

test('signed empty source runs same deterministic domain engine and stays research only', async () => {
  const signed = await envelope(context(), [], []);
  const result = await run(signed);
  assert.equal(result.ok, true, JSON.stringify(result));
  assert.equal(result.classification, 'SIGNED_SOURCE_CHECKED_NOT_OFFICIAL_AUTHORITY');
  assert.equal(result.expectedRevision, 3);
  assert.equal(result.challengeId, 'externally-issued-one-time-id-1');
  const baseline = simulateM1V8MedicalPhases(prematch(), policy(), [], [], []);
  assert.equal(baseline.ok, true);
  assert.deepEqual(result.result, baseline);
});

test('signature, fixture and career revision mismatch reject before simulation', async () => {
  const signed = await envelope(context(), [], []);
  for (const change of [
    { expectedRevision: 4 }, { challengeId: 'another-challenge' },
    { careerId: 'another-career' },
  ]) {
    const result = await run(signed, { ...context(), ...change });
    assert.equal(result.ok, false);
    assert.equal(result.error, 'AUTHORITY_REJECTED');
  }
  assert.deepEqual(await run(signed, { ...context(), fixtureId: 'other-fixture' }),
    { ok: false, error: 'FIXTURE_SCOPE_MISMATCH' });
  const stranger = await webcrypto.subtle.generateKey('Ed25519', true,
    ['sign', 'verify']);
  assert.deepEqual(await run(signed, context(), [], [],
    prematch(), [], stranger.publicKey), {
    ok: false, error: 'AUTHORITY_REJECTED',
    authorityError: 'INVALID_SIGNATURE',
  });
});

test('well signed but invalid football decision cannot bypass v8 source validation', async () => {
  const ghost = {
    schemaVersion: 1, decisionId: 'ghost-penalty', fixtureId: fixture.id,
    teamId: fixture.homeClubId, playerId: 'not-on-field',
    elapsedSeconds: 300, kind: 'penalty-kick', outcome: 'scored',
  };
  const decisions = [ghost];
  const signed = await envelope(context(), decisions, []);
  const result = await run(signed, context(), decisions);
  assert.deepEqual(result, { ok: false, error: 'MATCH_REJECTED',
    matchError: 'INVALID_MATCH_SOURCE' });
  const tampered = [{ ...ghost, outcome: 'saved' }];
  const changed = await run(signed, context(), tampered);
  assert.equal(changed.ok, false);
  assert.equal(changed.error, 'AUTHORITY_REJECTED');
  assert.equal(changed.authorityError, 'SCOPE_MISMATCH');
});

test('source and context mutations after entering async verification cannot affect replay', async () => {
  const ctx = context(), p = prematch(), decisions = [], medical = [],
    commands = [];
  const signed = await envelope(ctx, decisions, medical);
  const pending = simulateM1V8WithSignedSource(p, policy(), commands,
    decisions, medical, ctx, signed, (await keypair).publicKey);
  ctx.challengeId = 'mutated-after-start';
  ctx.expectedRevision = 99;
  medical.push({ forged: true });
  decisions.push({ forged: true });
  commands.push({ forged: true });
  const result = await pending;
  assert.equal(result.ok, true, JSON.stringify(result));
  assert.equal(result.expectedRevision, 3);
  assert.equal(result.challengeId, 'externally-issued-one-time-id-1');
  assert.deepEqual(result.result,
    simulateM1V8MedicalPhases(prematch(), policy(), [], [], []));
});

test('invalid JSON snapshots, accessor attack and untrusted data refuse execution', async () => {
  const signed = await envelope(context(), [], []);
  const bad = { ...prematch(), rngSeed: 0 };
  assert.deepEqual(await run(signed, context(), [], [], bad), {
    ok: false, error: 'INVALID_PREMATCH',
  });
  const p = prematch();
  let invokes = 0;
  Object.defineProperty(p, 'catalog', {
    enumerable: true, get() { invokes++; return catalog; },
  });
  assert.deepEqual(await run(signed, context(), [], [], p), {
    ok: false, error: 'INVALID_SNAPSHOT',
  });
  assert.equal(invokes, 0);
  const contextWithHidden = context();
  contextWithHidden.extra = undefined;
  assert.deepEqual(await run(signed, contextWithHidden), {
    ok: false, error: 'INVALID_SNAPSHOT',
  });
  assert.deepEqual(await run(signed, context(), {}, []), {
    ok: false, error: 'INVALID_SNAPSHOT',
  });
});
