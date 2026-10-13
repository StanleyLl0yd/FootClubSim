import test from 'node:test';
import assert from 'node:assert/strict';
import { defaultTacticalPlan, validateTacticalPlan } from '../dist/core/tactics.js';

test('default tactical plan is valid and reproducible', () => {
  assert.deepEqual(defaultTacticalPlan('club-a'), defaultTacticalPlan('club-a'));
  assert.deepEqual(validateTacticalPlan(defaultTacticalPlan('club-a'), 'club-a'), []);
});

test('valid traditional formations and neutral tactical sliders pass', () => {
  for (const formation of ['4-4-2', '4-3-3', '4-2-3-1', '3-5-2', '5-3-2']) {
    const plan = { ...defaultTacticalPlan('club-a'), formation };
    assert.deepEqual(validateTacticalPlan(plan, 'club-a'), []);
  }
});

test('invalid formations cannot silently drop or add an outfield player', () => {
  for (const formation of ['4-4-4', '4-3', '4-0-6', '4-3-3-0', '4-2-3-1-0', '4-3-x', '4--3-3', '']) {
    const result = validateTacticalPlan({ ...defaultTacticalPlan('club-a'), formation }, 'club-a');
    assert.ok(result.some(e => e.code === 'INVALID_FORMATION'), formation);
  }
});

test('wrong club and out-of-range tactical settings are rejected', () => {
  const plan = defaultTacticalPlan('club-a');
  assert.ok(validateTacticalPlan(plan, 'club-b').some(e => e.code === 'INVALID_TACTICS_ID'));
  for (const [key, badValue] of [
    ['mentality', 3], ['mentality', 0.5], ['pressing', -1], ['tempo', 101],
    ['compactness', NaN], ['defensiveLine', Infinity], ['passingRisk', 20.5],
  ]) {
    assert.ok(validateTacticalPlan({ ...plan, [key]: badValue }, 'club-a').length);
  }
});
