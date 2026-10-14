import type { Catalog } from './model.js';

/**
 * Source declaration for the authored M0-only synthetic pack.
 * This is not a signature, license proof or third-party rights clearance.
 */
export interface M0SyntheticProvenance {
  readonly manifestSchemaVersion: 1;
  readonly catalogSchemaVersion: 1;
  readonly packId: 'fictional-rpl-scale';
  readonly packVersion: string;
  readonly generator: 'src/core/synthetic.ts';
  readonly generatorSeed: number;
  readonly declaredAt: string;
  readonly rightsBasis: 'project-authored-synthetic';
  readonly containsThirdPartyFootballData: false;
  readonly containsThirdPartyArtwork: false;
  readonly assetPaths: readonly [];
  readonly reviewStatus: 'synthetic-only';
}

export type ProvenanceImportResult =
  | Readonly<{ ok: true; value: M0SyntheticProvenance }>
  | Readonly<{ ok: false; error: 'TOO_LARGE' | 'INVALID_JSON' | 'UNSUPPORTED_SCHEMA' | 'INVALID_MANIFEST' }>;

const MAX_MANIFEST_LENGTH = 16_384;
const FIELDS = [
  'manifestSchemaVersion', 'catalogSchemaVersion', 'packId', 'packVersion',
  'generator', 'generatorSeed', 'declaredAt', 'rightsBasis',
  'containsThirdPartyFootballData', 'containsThirdPartyArtwork', 'assetPaths', 'reviewStatus',
] as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function isValidDate(value: unknown): value is string {
  if (typeof value !== 'string' || !/^20\d{2}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  if (!year || !month || !day) return false;
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() + 1 === month &&
    date.getUTCDate() === day;
}

/** Strict, bounded parser for the fictional M0 pack manifest only. */
export function importM0SyntheticProvenance(json: unknown): ProvenanceImportResult {
  if (typeof json !== 'string' || json.length > MAX_MANIFEST_LENGTH) {
    return { ok: false, error: 'TOO_LARGE' };
  }
  let raw: unknown;
  try { raw = JSON.parse(json) as unknown; }
  catch { return { ok: false, error: 'INVALID_JSON' }; }
  if (!isRecord(raw) || raw.manifestSchemaVersion !== 1) {
    return { ok: false, error: 'UNSUPPORTED_SCHEMA' };
  }
  if (Object.keys(raw).length !== FIELDS.length ||
      FIELDS.some(field => !Object.hasOwn(raw, field)) ||
      raw.catalogSchemaVersion !== 1 ||
      raw.packId !== 'fictional-rpl-scale' ||
      raw.generator !== 'src/core/synthetic.ts' ||
      raw.rightsBasis !== 'project-authored-synthetic' ||
      raw.reviewStatus !== 'synthetic-only' ||
      raw.containsThirdPartyFootballData !== false ||
      raw.containsThirdPartyArtwork !== false ||
      !Array.isArray(raw.assetPaths) || raw.assetPaths.length !== 0 ||
      !Number.isInteger(raw.generatorSeed) || (raw.generatorSeed as number) < 1 ||
      (raw.generatorSeed as number) > 0xffffffff ||
      raw.packVersion !== '1-seed-' + raw.generatorSeed ||
      !isValidDate(raw.declaredAt)) {
    return { ok: false, error: 'INVALID_MANIFEST' };
  }
  return { ok: true, value: {
    manifestSchemaVersion: 1,
    catalogSchemaVersion: 1,
    packId: 'fictional-rpl-scale',
    packVersion: raw.packVersion as string,
    generator: 'src/core/synthetic.ts',
    generatorSeed: raw.generatorSeed as number,
    declaredAt: raw.declaredAt as string,
    rightsBasis: 'project-authored-synthetic',
    containsThirdPartyFootballData: false,
    containsThirdPartyArtwork: false,
    assetPaths: [],
    reviewStatus: 'synthetic-only',
  } };
}

/**
 * Check identity between a generated catalog and its authored declaration.
 * A matching declaration does not authenticate either party or rights.
 */
export function syntheticProvenanceMatchesCatalog(
  declaration: M0SyntheticProvenance, catalog: Catalog,
): boolean {
  return catalog.schemaVersion === declaration.catalogSchemaVersion &&
    catalog.source === 'synthetic' &&
    catalog.packId === declaration.packId &&
    catalog.packVersion === declaration.packVersion;
}
