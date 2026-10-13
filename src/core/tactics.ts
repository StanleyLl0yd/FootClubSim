import type { ValidationError } from './validation.js';

/**
 * M0 pre-match tactical input, not an implemented probability model.
 * Formation encodes ten outfield players, from defense to attack.
 */
export interface TacticalPlan {
  readonly schemaVersion: 1;
  readonly clubId: string;
  readonly formation: string;
  readonly mentality: number; // integer -2..2
  readonly pressing: number; // integer 0..100
  readonly compactness: number; // integer 0..100
  readonly defensiveLine: number; // integer 0..100
  readonly passingRisk: number; // integer 0..100
  readonly tempo: number; // integer 0..100
}

const within = (value: number, min: number, max: number): boolean =>
  Number.isInteger(value) && value >= min && value <= max;

/** Only structure is defined in M0; tactical efficacy must be calibrated in M1. */
export function validateTacticalPlan(plan: TacticalPlan, expectedClubId: string): readonly ValidationError[] {
  const errors: ValidationError[] = [];
  if (plan.schemaVersion !== 1 || plan.clubId !== expectedClubId) {
    errors.push({ code: 'INVALID_TACTICS_ID', at: 'tactics' });
  }
  const parts = typeof plan.formation === 'string' && /^\d(?:-\d){1,3}$/.test(plan.formation)
    ? plan.formation.split('-').map(Number) : [];
  if (parts.length < 2 || parts.length > 4 ||
      parts.some(part => !within(part, 1, 9)) ||
      parts.reduce((sum, part) => sum + part, 0) !== 10) {
    errors.push({ code: 'INVALID_FORMATION', at: 'tactics.formation' });
  }
  if (!within(plan.mentality, -2, 2)) errors.push({ code: 'INVALID_MENTALITY', at: 'tactics.mentality' });
  for (const key of ['pressing', 'compactness', 'defensiveLine', 'passingRisk', 'tempo'] as const) {
    if (!within(plan[key], 0, 100)) errors.push({ code: 'INVALID_TACTICS_SLIDER', at: 'tactics.' + key });
  }
  return errors;
}

export function defaultTacticalPlan(clubId: string): TacticalPlan {
  return {
    schemaVersion: 1, clubId, formation: '4-2-3-1', mentality: 0,
    pressing: 50, compactness: 50, defensiveLine: 50, passingRisk: 50, tempo: 50,
  };
}
