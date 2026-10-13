import { importSyntheticCatalog } from './import.js';
import { isStableId } from './identifiers.js';
import type { Catalog } from './model.js';
import { RNG_VERSION, SeededRng } from './rng.js';

/**
 * M0-only initial career snapshot. No match/season state exists yet.
 * A later playable save version must migrate this explicitly rather than
 * treating an initial snapshot as a complete career.
 */
export interface InitialCareerSave {
  readonly saveSchemaVersion: 1;
  readonly careerId: string;
  readonly revision: 0;
  readonly engineVersion: '0';
  readonly rngAlgorithmVersion: typeof RNG_VERSION;
  readonly rngState: number;
  readonly basePackId: string;
  readonly basePackVersion: string;
  readonly selectedClubId: string;
  readonly catalog: Catalog;
}

export type InitialCareerImportResult =
  | { readonly ok: true; readonly value: InitialCareerSave }
  | { readonly ok: false; readonly error:
    'TOO_LARGE' | 'INVALID_JSON' | 'INVALID_FORMAT' | 'INVALID_DATA' |
    'UNSUPPORTED_VERSION' | 'INTEGRITY_ERROR' | 'CRYPTO_UNAVAILABLE' };

const FORMAT = 'footclubsim-initial-career';
const MAX_EXPORT_LENGTH = 5_000_000;
const MAX_PAYLOAD_LENGTH = 4_500_000;
const HEX_SHA256 = /^[a-f0-9]{64}$/;

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}


/** Validate and copy a potential snapshot without trusting its static TypeScript type. */
function readInitialCareer(value: unknown): InitialCareerSave | null {
  if (!isRecord(value) || Object.keys(value).length !== 10 ||
      value.saveSchemaVersion !== 1 || value.revision !== 0 ||
      value.engineVersion !== '0' || value.rngAlgorithmVersion !== RNG_VERSION ||
      !isStableId(value.careerId) || !isStableId(value.basePackId) ||
      !isStableId(value.basePackVersion) || !isStableId(value.selectedClubId) ||
      !Number.isInteger(value.rngState) || (value.rngState as number) < 1 ||
      (value.rngState as number) > 0xffffffff) return null;

  let encodedCatalog: string;
  try { encodedCatalog = JSON.stringify(value.catalog); }
  catch { return null; }
  const imported = importSyntheticCatalog(encodedCatalog);
  if (!imported.ok || imported.value.packId !== value.basePackId ||
      imported.value.packVersion !== value.basePackVersion ||
      !imported.value.clubs.some(club => club.id === value.selectedClubId)) return null;

  return {
    saveSchemaVersion: 1, careerId: value.careerId, revision: 0, engineVersion: '0',
    rngAlgorithmVersion: RNG_VERSION, rngState: value.rngState as number,
    basePackId: value.basePackId, basePackVersion: value.basePackVersion,
    selectedClubId: value.selectedClubId, catalog: imported.value,
  };
}

/** No browser storage or game-world mutation occurs during snapshot creation. */
export function createInitialCareer(
  catalog: Catalog, selectedClubId: string, seed: number, careerId: string,
): InitialCareerSave {
  const snapshot = readInitialCareer({
    saveSchemaVersion: 1, careerId, revision: 0, engineVersion: '0',
    rngAlgorithmVersion: RNG_VERSION, rngState: new SeededRng(seed).snapshot(),
    basePackId: catalog.packId, basePackVersion: catalog.packVersion,
    selectedClubId, catalog,
  });
  if (!snapshot) throw new RangeError('Invalid initial career');
  return snapshot;
}

async function sha256(value: string): Promise<string | null> {
  if (!globalThis.crypto?.subtle) return null;
  const bytes = new TextEncoder().encode(value);
  const digest = await globalThis.crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
}

/**
 * SHA-256 detects accidental corruption only; it is not authentication.
 * The payload stays as a JSON string so that the exact validated bytes are hashed.
 */
export async function exportInitialCareer(snapshot: InitialCareerSave): Promise<string> {
  const validated = readInitialCareer(snapshot);
  if (!validated) throw new RangeError('Invalid initial career');
  const payload = JSON.stringify(validated);
  if (payload.length > MAX_PAYLOAD_LENGTH) throw new RangeError('Initial career too large');
  const checksum = await sha256(payload);
  if (checksum === null) throw new Error('Secure-context Web Crypto required for save export');
  const encoded = JSON.stringify({ format: FORMAT, checksumAlgorithm: 'sha256', checksum, payload });
  if (encoded.length > MAX_EXPORT_LENGTH) throw new RangeError('Initial career too large');
  return encoded;
}

/** Parse and verify in isolation. Callers must commit storage updates separately and atomically. */
export async function importInitialCareer(json: string): Promise<InitialCareerImportResult> {
  if (typeof json !== 'string' || json.length > MAX_EXPORT_LENGTH) {
    return { ok: false, error: 'TOO_LARGE' };
  }
  let envelope: unknown;
  try { envelope = JSON.parse(json) as unknown; }
  catch { return { ok: false, error: 'INVALID_JSON' }; }

  if (!isRecord(envelope) || envelope.format !== FORMAT ||
      envelope.checksumAlgorithm !== 'sha256' || Object.keys(envelope).length !== 4 ||
      typeof envelope.payload !== 'string' || !HEX_SHA256.test(String(envelope.checksum))) {
    return { ok: false, error: 'INVALID_FORMAT' };
  }
  if (envelope.payload.length > MAX_PAYLOAD_LENGTH) return { ok: false, error: 'TOO_LARGE' };
  let digest: string | null;
  try { digest = await sha256(envelope.payload); }
  catch { return { ok: false, error: 'CRYPTO_UNAVAILABLE' }; }
  if (digest === null) return { ok: false, error: 'CRYPTO_UNAVAILABLE' };
  if (digest !== envelope.checksum) return { ok: false, error: 'INTEGRITY_ERROR' };

  let snapshot: unknown;
  try { snapshot = JSON.parse(envelope.payload) as unknown; }
  catch { return { ok: false, error: 'INVALID_JSON' }; }
  if (isRecord(snapshot) && snapshot.saveSchemaVersion !== 1) {
    return { ok: false, error: 'UNSUPPORTED_VERSION' };
  }
  const validated = readInitialCareer(snapshot);
  return validated ? { ok: true, value: validated } : { ok: false, error: 'INVALID_DATA' };
}
