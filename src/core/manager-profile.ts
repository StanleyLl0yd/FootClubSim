import { sameCanonicalValue } from './canonical-value.js';
import { SeededRng } from './rng.js';

export const MANAGER_SKILL_KEYS = [
  'tacticalKnowledge', 'matchPreparation', 'inGameAdaptation',
  'trainingMethodology', 'playerDevelopment', 'peopleManagement',
  'motivation', 'talentAssessment', 'scoutingAnalysis', 'negotiation',
  'clubManagement', 'mediaCommunication',
] as const;
export type ManagerSkill = typeof MANAGER_SKILL_KEYS[number];
export type ManagerSkills = Readonly<Record<ManagerSkill, number>>;

export const MANAGER_SKILL_SCALE = 20;
export const MANAGER_START_MIN = 5;
export const MANAGER_START_MAX = 15;
export const MANAGER_START_BUDGET = 120;
export const MANAGER_NAME_LIMIT = 60;
export const MANAGER_ORIGINS = ['former-player', 'theorist', 'custom'] as const;
export type ManagerOrigin = typeof MANAGER_ORIGINS[number];

const presets: Readonly<Record<ManagerOrigin, ManagerSkills>> = {
  'former-player': {
    tacticalKnowledge: 10, matchPreparation: 9, inGameAdaptation: 13,
    trainingMethodology: 8, playerDevelopment: 10, peopleManagement: 14,
    motivation: 14, talentAssessment: 12, scoutingAnalysis: 7, negotiation: 7,
    clubManagement: 8, mediaCommunication: 8,
  },
  theorist: {
    tacticalKnowledge: 14, matchPreparation: 13, inGameAdaptation: 9,
    trainingMethodology: 13, playerDevelopment: 11, peopleManagement: 8,
    motivation: 7, talentAssessment: 9, scoutingAnalysis: 14, negotiation: 7,
    clubManagement: 9, mediaCommunication: 6,
  },
  custom: {
    tacticalKnowledge: 10, matchPreparation: 10, inGameAdaptation: 10,
    trainingMethodology: 10, playerDevelopment: 10, peopleManagement: 10,
    motivation: 10, talentAssessment: 10, scoutingAnalysis: 10, negotiation: 10,
    clubManagement: 10, mediaCommunication: 10,
  },
};

export function startingManagerSkills(origin: ManagerOrigin): ManagerSkills {
  return { ...presets[origin] };
}

const specialties = [
  { kind: 'analysis', skills: ['tacticalKnowledge', 'matchPreparation', 'scoutingAnalysis'] },
  { kind: 'development', skills: ['trainingMethodology', 'playerDevelopment', 'talentAssessment'] },
  { kind: 'leadership', skills: ['inGameAdaptation', 'peopleManagement', 'motivation'] },
  { kind: 'operations', skills: ['negotiation', 'clubManagement', 'mediaCommunication'] },
] as const satisfies readonly { kind: string; skills: readonly ManagerSkill[] }[];

type BiographyKind =
  | 'playing-debut' | 'playing-milestone' | 'courses' | 'analyst' | 'grassroots'
  | typeof specialties[number]['kind'] | 'generalist' | 'coaching';

export interface ManagerBiographyEvent {
  readonly kind: BiographyKind;
  readonly yearsBeforeStart: number;
  readonly variant: number;
}
export interface ManagerProfile {
  readonly schemaVersion: 1;
  readonly displayName: string;
  readonly origin: ManagerOrigin;
  readonly skills: ManagerSkills;
  readonly biography: {
    readonly templateVersion: 1;
    readonly seed: number;
    readonly events: readonly ManagerBiographyEvent[];
  };
}

function isOrigin(value: unknown): value is ManagerOrigin {
  return MANAGER_ORIGINS.some(origin => origin === value);
}
function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}
export function isManagerDisplayName(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0 &&
    value.length <= MANAGER_NAME_LIMIT && value === value.trim() &&
    !/[\p{Cc}\u2028\u2029\u202A-\u202E\u2066-\u2069]/u.test(value);
}
function isStartingSkill(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) &&
    value >= MANAGER_START_MIN && value <= MANAGER_START_MAX;
}
function readSkills(value: unknown): ManagerSkills | null {
  if (!isRecord(value) || Object.keys(value).length !== MANAGER_SKILL_KEYS.length) return null;
  const skills = { ...presets.custom };
  let total = 0;
  for (const key of MANAGER_SKILL_KEYS) {
    const skill = value[key];
    if (!Object.hasOwn(value, key) || !isStartingSkill(skill)) return null;
    skills[key] = skill;
    total += skill;
  }
  return total === MANAGER_START_BUDGET ? skills : null;
}

function customSpecialty(skills: ManagerSkills): BiographyKind {
  const ranked = specialties.map(({ kind, skills: keys }) => ({
    kind, total: keys.reduce((sum, key) => sum + skills[key], 0),
  })).sort((a, b) => b.total - a.total);
  return ranked[0]!.total === ranked[1]!.total ? 'generalist' : ranked[0]!.kind;
}

// Keep v1 generation stable: stored timelines are validated against their pinned version.
function biographyV1(origin: ManagerOrigin, skills: ManagerSkills, seed: number) {
  const rng = new SeededRng(seed);
  const events: readonly [BiographyKind, number][] = origin === 'former-player' ?
    [['playing-debut', 16], ['playing-milestone', 9], ['coaching', 3]] :
    origin === 'theorist' ? [['courses', 10], ['analyst', 6], ['coaching', 3]] :
    [['grassroots', 10], [customSpecialty(skills), 6], ['coaching', 3]];
  return {
    templateVersion: 1 as const,
    seed,
    events: events.map(([kind, year], index) => ({
      kind,
      yearsBeforeStart: year + rng.nextUint32() % 2,
      variant: index === 0 ? seed % 3 : rng.nextUint32() % 3,
    })),
  };
}

export function createManagerProfile(
  displayName: string, origin: ManagerOrigin, skills: ManagerSkills, seed: number,
): ManagerProfile {
  const validSkills = readSkills(skills);
  if (!isManagerDisplayName(displayName) || !isOrigin(origin) || !validSkills ||
      (origin !== 'custom' && !sameCanonicalValue(validSkills, presets[origin]))) {
    throw new RangeError('Invalid manager profile');
  }
  return {
    schemaVersion: 1, displayName, origin, skills: validSkills,
    biography: biographyV1(origin, validSkills, seed),
  };
}

export function regenerateManagerBiography(profile: ManagerProfile): ManagerProfile {
  const seed = profile.biography.seed === 0xffffffff ? 1 : profile.biography.seed + 1;
  return createManagerProfile(profile.displayName, profile.origin, profile.skills, seed);
}

export function readManagerProfile(value: unknown): ManagerProfile | null {
  if (!isRecord(value) || value.schemaVersion !== 1 ||
      !isManagerDisplayName(value.displayName) || !isOrigin(value.origin) ||
      !isRecord(value.biography)) return null;
  const skills = readSkills(value.skills);
  const seed = value.biography.seed;
  if (!skills || typeof seed !== 'number' || !Number.isInteger(seed) ||
      seed < 1 || seed > 0xffffffff ||
      (value.origin !== 'custom' && !sameCanonicalValue(skills, presets[value.origin]))) return null;
  const canonical: ManagerProfile = {
    schemaVersion: 1, displayName: value.displayName, origin: value.origin, skills,
    biography: biographyV1(value.origin, skills, seed),
  };
  return sameCanonicalValue(canonical, value) ? canonical : null;
}
