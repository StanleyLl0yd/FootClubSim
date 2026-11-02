import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = JSON.parse(readFileSync(
  new URL('../data/m1-p3-p5-closure-gates.json', import.meta.url), 'utf8'));
const doc = readFileSync(
  new URL('../docs/M1_P3_P5_ACCEPTANCE_MATRIX.md', import.meta.url), 'utf8');
const expected = ['P3-1','P3-2','P3-3','P3-4',
  'P5-1','P5-2','P5-3','P5-4','P5-5'];
test('M1 P3/P5 nine gates are complete, nonduplicated and evidence-bound', () => {
  assert.equal(source.schemaVersion, 1);
  assert.equal(source.milestone, 'M1');
  assert.equal(source.blocks.length, 9);
  assert.deepEqual(source.blocks.map(g => g.id), expected);
  assert.equal(source.policy.holdout2024_25,
    'SEALED_UNTIL_PREDECLARED_FREEZE');
  assert.equal(source.policy.historicalScoreMatchingRequired, false);
  assert.equal(source.policy.m2Permitted, false);
  assert.equal(source.policy.fullRepositoryExitAuditsRequired, 2);
  const ids = new Set(expected);
  for (const gate of source.blocks) {
    assert.equal(gate.issue, gate.id.startsWith('P3') ? 29 : 31);
    assert.equal(typeof gate.title, 'string');
    assert.ok(gate.title.length > 8);
    assert.ok(Array.isArray(gate.criteria) && gate.criteria.length >= 3);
    assert.ok(gate.criteria.every(c => typeof c === 'string' && c.length > 30));
    assert.ok(Array.isArray(gate.dependsOn));
    assert.ok(gate.dependsOn.every(d => ids.has(d) && d !== gate.id));
    assert.ok(['open', 'in_progress', 'accepted'].includes(gate.state));
    assert.match(doc, new RegExp('\\| '+gate.id.replace('-', '\\-')+' \\|'));
    if (gate.state === 'accepted') {
      assert.ok(gate.dependsOn.every(id =>
        source.blocks.find(x => x.id === id)?.state === 'accepted'));
      assert.match(gate.verification?.exactMainSha ?? '', /^[a-f0-9]{40}$/);
      assert.ok(Array.isArray(gate.verification?.evidenceUrls) &&
        gate.verification.evidenceUrls.length >= 2);
      assert.ok(gate.verification.evidenceUrls.every(s =>
        typeof s === 'string' &&
        /^https:\/\/github\.com\/StanleyLl0yd\/FootClubSim\//.test(s)));
      assert.match(gate.verification?.acceptedBy ?? '', /^https:\/\/github\.com\//);
    } else {
      assert.equal(gate.verification, null);
    }
  }
});
