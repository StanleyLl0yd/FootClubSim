import { isStableId } from '../core/identifiers.js';
import { validateM1V32ExposureJournal,
  type M1V32Journal } from '../core/m1-v32-causal-medical-journal.js';
import { loadInitialCareer } from './initial-career-store.js';
import {
  loadM1V32PersistedJournal, restoreM1V32PersistedJournal,
} from './m1-v32-journal-store.js';

/**
 * Backup for a EXISTING immutable M0 initial career only. SHA-256 detects
 * accidental corruption, NOT malicious modification or clinical authority.
 * The schema-6 journal is always source-replayed during import.
 */
export const M1_V35_BACKUP_FORMAT =
  'footclubsim-schema6-existing-m0-career-journal' as const;
export const M1_V35_BACKUP_VERSION = 1 as const;
const MAX_BACKUP_CHARS = 20_000_000;
const CHECKSUM_PATTERN = /^[a-f0-9]{64}$/;
const KEYS = ['format','version','careerId','checksumAlgorithm',
  'initialFingerprint','journalChecksum','payload'] as const;

export type M1V35BackupErrorCode =
  'INVALID_BACKUP' | 'BACKUP_TOO_LARGE' | 'CRYPTO_UNAVAILABLE';
export class M1V35BackupError extends Error {
  constructor(public readonly code:M1V35BackupErrorCode) {
    super(code);
    this.name='M1V35BackupError';
  }
}
const fail=(code:M1V35BackupErrorCode):M1V35BackupError =>
  new M1V35BackupError(code);
async function sha256(text:string):Promise<string> {
  if(!globalThis.crypto?.subtle)throw fail('CRYPTO_UNAVAILABLE');
  try {
    const digest=await globalThis.crypto.subtle.digest('SHA-256',
      new TextEncoder().encode(text));
    return Array.from(new Uint8Array(digest),byte=>
      byte.toString(16).padStart(2,'0')).join('');
  } catch {throw fail('CRYPTO_UNAVAILABLE');}
}
function exactKeys(value:unknown):value is Record<string,unknown> {
  return value!==null && typeof value==='object' &&
    !Array.isArray(value) &&
    Object.keys(value).length===KEYS.length &&
    KEYS.every(k=>Object.hasOwn(value,k));
}

/** Export only already-present, fully replay-validated schema-6 journal. */
export async function exportM1V35Schema6Backup(careerId:string):
  Promise<string> {
  if(!isStableId(careerId))throw fail('INVALID_BACKUP');
  const initial=await loadInitialCareer(careerId);
  const journal=await loadM1V32PersistedJournal(careerId);
  if(journal.careerId!==careerId)throw fail('INVALID_BACKUP');
  const payload=JSON.stringify(journal);
  const initialFingerprint=await sha256(JSON.stringify(initial));
  const journalChecksum=await sha256(payload);
  const envelope=JSON.stringify({
    format:M1_V35_BACKUP_FORMAT,version:M1_V35_BACKUP_VERSION,
    careerId,checksumAlgorithm:'sha256',initialFingerprint,
    journalChecksum,payload,
  });
  if(envelope.length>MAX_BACKUP_CHARS)throw fail('BACKUP_TOO_LARGE');
  return envelope;
}

/**
 * Add-only import for the SAME pre-existing M0 career. Cannot create,
 * replace or migrate an initial career or overwrite a schema-6 journal.
 * If storage fails, the journal remains missing (one atomic IDB add).
 */
export async function restoreM1V35Schema6Backup(
  careerId:string,encoded:unknown,
):Promise<M1V32Journal> {
  if(!isStableId(careerId)||typeof encoded!=='string')
    throw fail('INVALID_BACKUP');
  if(encoded.length>MAX_BACKUP_CHARS)throw fail('BACKUP_TOO_LARGE');
  let parsed:unknown;
  try {parsed=JSON.parse(encoded) as unknown;}
  catch {throw fail('INVALID_BACKUP');}
  if(!exactKeys(parsed) ||
      parsed.format!==M1_V35_BACKUP_FORMAT ||
      parsed.version!==M1_V35_BACKUP_VERSION ||
      parsed.careerId!==careerId ||
      parsed.checksumAlgorithm!=='sha256' ||
      typeof parsed.payload!=='string' ||
      typeof parsed.initialFingerprint!=='string' ||
      typeof parsed.journalChecksum!=='string' ||
      !CHECKSUM_PATTERN.test(parsed.initialFingerprint) ||
      !CHECKSUM_PATTERN.test(parsed.journalChecksum)) {
    throw fail('INVALID_BACKUP');
  }
  const initial=await loadInitialCareer(careerId);
  const [fingerprint,checksum]=await Promise.all([
    sha256(JSON.stringify(initial)),sha256(parsed.payload),
  ]);
  if(fingerprint!==parsed.initialFingerprint ||
      checksum!==parsed.journalChecksum)throw fail('INVALID_BACKUP');
  let journal:unknown;
  try {journal=JSON.parse(parsed.payload) as unknown;}
  catch {throw fail('INVALID_BACKUP');}
  const verified=validateM1V32ExposureJournal(initial,journal);
  if(!verified.ok || verified.journal.careerId!==careerId)
    throw fail('INVALID_BACKUP');
  return restoreM1V32PersistedJournal(careerId,verified.journal);
}
