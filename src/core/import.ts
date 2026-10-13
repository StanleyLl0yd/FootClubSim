import { isStableId } from './identifiers.js';
import {
  FIELD_ATTRIBUTE_KEYS, GOALKEEPER_ATTRIBUTE_KEYS, POSITIONS,
  type AttributeKey, type Catalog, type Club, type Player, type Position,
} from './model.js';
import { validateCatalog } from './validation.js';

export type CatalogImportResult =
  | { readonly ok: true; readonly value: Catalog }
  | { readonly ok: false; readonly error: 'TOO_LARGE' | 'INVALID_JSON' | 'INVALID_SCHEMA' | 'INVALID_DATA' };

const MAX_JSON_LENGTH = 4_000_000;
const MAX_PLAYERS = 2048;
const MAX_CLUBS = 64;
const MAX_REGISTRATIONS = 128;
const keys = [...FIELD_ATTRIBUTE_KEYS, ...GOALKEEPER_ATTRIBUTE_KEYS];
const keySet = new Set<string>(keys);
const positions = new Set<string>(POSITIONS);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
function isName(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0 && value.length <= 256;
}
function isPosition(value: unknown): value is Position {
  return typeof value === 'string' && positions.has(value);
}
function isRating(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 1 && value <= 100;
}
function readAttributes(value: unknown): Readonly<Record<AttributeKey, number>> | null {
  if (!isRecord(value) || Object.keys(value).length !== keys.length ||
      Object.keys(value).some(key => !keySet.has(key))) return null;
  const attributes: Partial<Record<AttributeKey, number>> = {};
  for (const key of keys) {
    if (!isRating(value[key])) return null;
    attributes[key] = value[key];
  }
  return attributes as Record<AttributeKey, number>;
}
function readPlayer(value: unknown): Player | null {
  if (!isRecord(value) || !isStableId(value.id) || !isName(value.displayName) ||
      !isPosition(value.primaryPosition) || typeof value.foreignerForCompetition !== 'boolean') return null;
  const attributes = readAttributes(value.attributes);
  if (!attributes) return null;
  return {
    id: value.id, displayName: value.displayName,
    primaryPosition: value.primaryPosition,
    foreignerForCompetition: value.foreignerForCompetition, attributes,
  };
}
function readClub(value: unknown): Club | null {
  if (!isRecord(value) || !isStableId(value.id) || !isName(value.displayName) ||
      !Array.isArray(value.registeredPlayerIds) ||
      value.registeredPlayerIds.length > MAX_REGISTRATIONS ||
      !value.registeredPlayerIds.every(isStableId)) return null;
  return { id: value.id, displayName: value.displayName, registeredPlayerIds: value.registeredPlayerIds };
}

/** Parses a bounded, synthetic catalog and never mutates a career. */
export function importSyntheticCatalog(json: string): CatalogImportResult {
  if (typeof json !== 'string' || json.length > MAX_JSON_LENGTH) return { ok: false, error: 'TOO_LARGE' };
  let value: unknown;
  try { value = JSON.parse(json) as unknown; }
  catch { return { ok: false, error: 'INVALID_JSON' }; }
  if (!isRecord(value) || value.schemaVersion !== 1 || value.source !== 'synthetic') {
    return { ok: false, error: 'INVALID_SCHEMA' };
  }
  if (!isStableId(value.packId) || !isStableId(value.packVersion) ||
      !Array.isArray(value.players) || value.players.length > MAX_PLAYERS ||
      !Array.isArray(value.clubs) || value.clubs.length > MAX_CLUBS) {
    return { ok: false, error: 'INVALID_DATA' };
  }
  const players: Player[] = [];
  for (const candidate of value.players as unknown[]) {
    const player = readPlayer(candidate);
    if (!player) return { ok: false, error: 'INVALID_DATA' };
    players.push(player);
  }
  const clubs: Club[] = [];
  for (const candidate of value.clubs as unknown[]) {
    const club = readClub(candidate);
    if (!club) return { ok: false, error: 'INVALID_DATA' };
    clubs.push(club);
  }
  const catalog: Catalog = {
    schemaVersion: 1, source: 'synthetic', packId: value.packId,
    packVersion: value.packVersion, players, clubs,
  };
  if (validateCatalog(catalog).length) return { ok: false, error: 'INVALID_DATA' };
  return { ok: true, value: catalog };
}
