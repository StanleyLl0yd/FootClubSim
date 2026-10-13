/** The initial, UI-independent domain contract for synthetic M0 fixtures. */
export const POSITIONS = [
  'GK', 'DL', 'DC', 'DR', 'WBL', 'WBR', 'DM', 'ML', 'MC',
  'MR', 'AML', 'AMC', 'AMR', 'ST',
] as const;
export type Position = (typeof POSITIONS)[number];

export const FIELD_ATTRIBUTE_KEYS = [
  'firstTouch', 'shortPassing', 'longPassing', 'dribbling', 'finishing',
  'tackling', 'marking', 'heading', 'crossing', 'setPieces',
  'decisions', 'anticipation', 'composure', 'defensivePositioning',
  'offBallMovement', 'vision', 'workRate', 'teamwork', 'aggression', 'leadership',
  'acceleration', 'sprintSpeed', 'agility', 'balance', 'stamina',
  'strength', 'jumpingReach', 'naturalFitness',
] as const;
export const GOALKEEPER_ATTRIBUTE_KEYS = [
  'handling', 'reflexes', 'oneOnOnes', 'aerialCommand', 'distribution',
] as const;
export type AttributeKey = (typeof FIELD_ATTRIBUTE_KEYS)[number] | (typeof GOALKEEPER_ATTRIBUTE_KEYS)[number];

export interface Player {
  readonly id: string;
  readonly displayName: string;
  readonly primaryPosition: Position;
  /** Derived from competition-specific eligibility, not nationality alone. */
  readonly foreignerForCompetition: boolean;
  readonly attributes: Readonly<Record<AttributeKey, number>>;
}

export interface Club {
  readonly id: string;
  readonly displayName: string;
  readonly registeredPlayerIds: readonly string[];
}

export interface Catalog {
  readonly schemaVersion: 1;
  readonly packId: string;
  readonly packVersion: string;
  readonly source: 'synthetic';
  readonly clubs: readonly Club[];
  readonly players: readonly Player[];
}

export interface MatchRosterRules {
  readonly starterCount: number;
  readonly maxBench: number;
  readonly maxForeignersOnField: number;
}

export interface MatchLineup {
  readonly clubId: string;
  readonly starters: readonly string[];
  readonly bench: readonly string[];
}
