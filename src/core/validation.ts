import { isStableId } from './identifiers.js';
import {
  FIELD_ATTRIBUTE_KEYS, GOALKEEPER_ATTRIBUTE_KEYS, POSITIONS,
  type Catalog, type Club, type MatchLineup, type MatchRosterRules, type Player,
} from './model.js';

export type ValidationError = Readonly<{ code: string; at: string }>;

const ATTRIBUTE_KEYS = [...FIELD_ATTRIBUTE_KEYS, ...GOALKEEPER_ATTRIBUTE_KEYS];

/** Validates a typed model. JSON parsing needs a separate untrusted-data adapter. */
export function validateCatalog(catalog: Catalog): readonly ValidationError[] {
  const errors: ValidationError[] = [];
  if (catalog.schemaVersion !== 1 || catalog.source !== 'synthetic') {
    errors.push({ code: 'UNSUPPORTED_CATALOG', at: 'catalog' });
  }
  if (!isStableId(catalog.packId) || !isStableId(catalog.packVersion)) {
    errors.push({ code: 'INVALID_PACK_ID', at: 'catalog' });
  }
  const players = new Set<string>();
  for (const player of catalog.players) {
    if (!isStableId(player.id) || players.has(player.id)) {
      errors.push({ code: 'DUPLICATE_OR_INVALID_PLAYER', at: 'player:' + player.id });
    }
    players.add(player.id);
    if (typeof player.displayName !== 'string' || !player.displayName.trim() ||
        player.displayName.length > 256 || !POSITIONS.includes(player.primaryPosition) ||
        typeof player.foreignerForCompetition !== 'boolean') {
      errors.push({ code: 'INVALID_PLAYER', at: 'player:' + player.id });
    }
    for (const key of ATTRIBUTE_KEYS) {
      const value = player.attributes[key];
      if (!Number.isInteger(value) || value < 1 || value > 100) {
        errors.push({ code: 'INVALID_ATTRIBUTE', at: 'player:' + player.id + '.' + key });
      }
    }
  }
  const clubs = new Set<string>();
  const owners = new Set<string>();
  for (const club of catalog.clubs) {
    if (!isStableId(club.id) || clubs.has(club.id)) {
      errors.push({ code: 'DUPLICATE_OR_INVALID_CLUB', at: 'club:' + club.id });
    }
    clubs.add(club.id);
    if (typeof club.displayName !== 'string' || !club.displayName.trim() ||
        club.displayName.length > 256) {
      errors.push({ code: 'INVALID_CLUB', at: 'club:' + club.id });
    }
    const roster = new Set<string>();
    for (const id of club.registeredPlayerIds) {
      if (!players.has(id)) errors.push({ code: 'UNKNOWN_PLAYER', at: 'club:' + club.id + '.' + id });
      if (roster.has(id) || owners.has(id)) errors.push({ code: 'DUPLICATE_REGISTRATION', at: 'club:' + club.id + '.' + id });
      roster.add(id);
      owners.add(id);
    }
  }
  return errors;
}

export function validateLineup(
  lineup: MatchLineup,
  club: Club,
  players: ReadonlyMap<string, Player>,
  rules: MatchRosterRules,
): readonly ValidationError[] {
  const errors: ValidationError[] = [];
  if (lineup.clubId !== club.id) errors.push({ code: 'WRONG_CLUB', at: 'clubId' });
  if (!Number.isInteger(rules.starterCount) || rules.starterCount < 1 || rules.starterCount > 11 ||
      !Number.isSafeInteger(rules.maxBench) || rules.maxBench < 0 || rules.maxBench > 128 ||
      !Number.isInteger(rules.maxForeignersOnField) || rules.maxForeignersOnField < 0 ||
      rules.maxForeignersOnField > rules.starterCount) {
    return [{ code: 'INVALID_RULES', at: 'rules' }];
  }
  if (lineup.starters.length !== rules.starterCount) errors.push({ code: 'STARTER_COUNT', at: 'starters' });
  if (lineup.bench.length > rules.maxBench) errors.push({ code: 'BENCH_TOO_LARGE', at: 'bench' });
  const eligible = new Set(club.registeredPlayerIds);
  const seen = new Set<string>();
  let foreignCount = 0;
  let goalkeeperCount = 0;
  for (const id of [...lineup.starters, ...lineup.bench]) {
    if (seen.has(id)) errors.push({ code: 'DUPLICATE_LINEUP', at: 'player:' + id });
    seen.add(id);
    if (!eligible.has(id) || !players.has(id)) errors.push({ code: 'INELIGIBLE_PLAYER', at: 'player:' + id });
  }
  for (const id of lineup.starters) {
    if (players.get(id)?.foreignerForCompetition) foreignCount++;
    if (players.get(id)?.primaryPosition === 'GK') goalkeeperCount++;
  }
  if (foreignCount > rules.maxForeignersOnField) errors.push({ code: 'FOREIGN_LIMIT', at: 'starters' });
  if (goalkeeperCount !== 1) errors.push({ code: 'GOALKEEPER_COUNT', at: 'starters' });
  return errors;
}
