import { isStableId } from '../core/identifiers.js';
import {
  exportInitialCareer, importInitialCareer, type InitialCareerSave,
} from '../core/save.js';
import {
  validateM1V32ExposureJournal, type M1V32Journal,
} from '../core/m1-v32-causal-medical-journal.js';
import {
  CareerStorageError, loadInitialCareer, saveNewInitialCareer,
} from './initial-career-store.js';
import {
  M1V32PersistenceError, loadM1V32PersistedJournal,
  restoreM1V32PersistedJournal,
} from './m1-v32-journal-store.js';

/**
 * Bounded, research-only bundle for a lost M0 initial career AND its v32
 * schema-6 journal. The two existing IndexedDB databases are independent:
 * import is deliberately a verified, idempotent TWO-STAGE add-only protocol,
 * NEVER falsely described as one atomic cross-database transaction.
 *
 * Hashes detect accidental corruption, not forgery. No production UI,
 * encryption, authenticated medical authority or schema migration.
 */
export const M1_V40_BACKUP_FORMAT = 'footclubsim-m0-schema6-recovery' as const;
export const M1_V40_BACKUP_VERSION = 1 as const;
const MAX_BACKUP_CHARS = 25_000_000;
const HASH = /^[a-f0-9]{64}$/;
const KEYS = [
  'format', 'version', 'careerId', 'checksumAlgorithm',
  'm0Payload', 'm0Checksum', 'journalPayload', 'journalChecksum',
] as const;

export type M1V40RecoveryCode =
  'INVALID_BACKUP' | 'BACKUP_TOO_LARGE' | 'CRYPTO_UNAVAILABLE' | 'CONFLICT';
export class M1V40RecoveryError extends Error {
  constructor(public readonly code: M1V40RecoveryCode) {
    super(code);
    this.name = 'M1V40RecoveryError';
  }
}
const fail = (code: M1V40RecoveryCode) => new M1V40RecoveryError(code);
const exactKeys = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value) &&
  Object.keys(value).length === KEYS.length &&
  KEYS.every(key => Object.hasOwn(value, key));
async function sha256(text: string): Promise<string> {
  if (!globalThis.crypto?.subtle) throw fail('CRYPTO_UNAVAILABLE');
  try {
    const digest = await globalThis.crypto.subtle.digest(
      'SHA-256', new TextEncoder().encode(text));
    return Array.from(new Uint8Array(digest), byte =>
      byte.toString(16).padStart(2, '0')).join('');
  } catch { throw fail('CRYPTO_UNAVAILABLE'); }
}

export async function exportM1V40TwoStoreBackup(careerId: string):
  Promise<string> {
  if (!isStableId(careerId)) throw fail('INVALID_BACKUP');
  const initial = await loadInitialCareer(careerId);
  const journal = await loadM1V32PersistedJournal(careerId);
  if (initial.careerId !== journal.careerId) throw fail('INVALID_BACKUP');
  const m0Payload = await exportInitialCareer(initial);
  const journalPayload = JSON.stringify(journal);
  const [m0Checksum, journalChecksum] = await Promise.all([
    sha256(m0Payload), sha256(journalPayload),
  ]);
  const envelope = JSON.stringify({
    format: M1_V40_BACKUP_FORMAT, version: M1_V40_BACKUP_VERSION,
    careerId, checksumAlgorithm: 'sha256',
    m0Payload, m0Checksum, journalPayload, journalChecksum,
  });
  if (envelope.length > MAX_BACKUP_CHARS) throw fail('BACKUP_TOO_LARGE');
  return envelope;
}
export interface M1V40Restored {
  readonly initial: InitialCareerSave;
  readonly journal: M1V32Journal;
}
function same(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

async function ensureInitial(careerId: string,
  expected: InitialCareerSave): Promise<void> {
  try {
    const existing = await loadInitialCareer(careerId);
    if (!same(existing, expected)) throw fail('CONFLICT');
    return;
  } catch (error) {
    if (!(error instanceof CareerStorageError) ||
        error.code !== 'NOT_FOUND') throw error;
  }
  try {
    await saveNewInitialCareer(expected);
  } catch (error) {
    // A simultaneous identical restore may have won the add-only race.
    if (!(error instanceof CareerStorageError) ||
        error.code !== 'DUPLICATE') throw error;
  }
  const persisted = await loadInitialCareer(careerId);
  if (!same(persisted, expected)) throw fail('CONFLICT');
}

async function ensureJournal(careerId: string,
  expected: M1V32Journal): Promise<M1V32Journal> {
  try {
    return await restoreM1V32PersistedJournal(careerId, expected);
  } catch (error) {
    // Never rewrite an existing entry, even if damaged or from a
    // competing writer. Validate and allow ONLY exact idempotent retry.
    if (!(error instanceof M1V32PersistenceError) ||
        error.code !== 'ALREADY_EXISTS') throw error;
  }
  const present = await loadM1V32PersistedJournal(careerId);
  if (!same(present, expected)) throw fail('CONFLICT');
  return present;
}

/**
 * Fully validate both sources BEFORE either store is written. First add
 * the M0 career (or verify an identical existing copy), then add schema-6
 * journal (or verify identical existing copy). If the second stage fails,
 * M0 may remain alone; retrying the same archive is safe and necessary.
 */
export async function restoreM1V40TwoStoreBackup(
  careerId: string, encoded: unknown,
): Promise<M1V40Restored> {
  if (!isStableId(careerId) || typeof encoded !== 'string')
    throw fail('INVALID_BACKUP');
  if (encoded.length > MAX_BACKUP_CHARS) throw fail('BACKUP_TOO_LARGE');
  let envelope: unknown;
  try { envelope = JSON.parse(encoded) as unknown; }
  catch { throw fail('INVALID_BACKUP'); }
  if (!exactKeys(envelope) ||
      envelope.format !== M1_V40_BACKUP_FORMAT ||
      envelope.version !== M1_V40_BACKUP_VERSION ||
      envelope.careerId !== careerId ||
      envelope.checksumAlgorithm !== 'sha256' ||
      typeof envelope.m0Payload !== 'string' ||
      typeof envelope.journalPayload !== 'string' ||
      typeof envelope.m0Checksum !== 'string' ||
      typeof envelope.journalChecksum !== 'string' ||
      !HASH.test(envelope.m0Checksum) ||
      !HASH.test(envelope.journalChecksum))
    throw fail('INVALID_BACKUP');
  const [m0Hash, journalHash] = await Promise.all([
    sha256(envelope.m0Payload), sha256(envelope.journalPayload),
  ]);
  if (m0Hash !== envelope.m0Checksum ||
      journalHash !== envelope.journalChecksum) throw fail('INVALID_BACKUP');
  const parsedInitial = await importInitialCareer(envelope.m0Payload);
  if (!parsedInitial.ok || parsedInitial.value.careerId !== careerId)
    throw fail('INVALID_BACKUP');
  let journal: unknown;
  try { journal = JSON.parse(envelope.journalPayload) as unknown; }
  catch { throw fail('INVALID_BACKUP'); }
  const validated = validateM1V32ExposureJournal(
    parsedInitial.value, journal);
  if (!validated.ok || validated.journal.careerId !== careerId)
    throw fail('INVALID_BACKUP');
  await ensureInitial(careerId, parsedInitial.value);
  const savedJournal = await ensureJournal(careerId, validated.journal);
  return {initial: parsedInitial.value, journal: savedJournal};
}
