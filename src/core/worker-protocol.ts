import { isStableId } from './identifiers.js';
import type { MatchLedgerInput, MatchLedgerReport, MatchTeamReport } from './match-contracts.js';

/**
 * M0 wire-message contract. No Worker is spawned and no simulation is run.
 * Inbound match data still requires full deriveMatchLedger validation by a worker.
 */
export const WORKER_PROTOCOL_VERSION = 1 as const;

export type WorkerRequest =
  | Readonly<{
      protocolVersion: 1;
      kind: 'derive-ledger';
      jobId: string;
      careerId: string;
      expectedRevision: number;
      input: MatchLedgerInput;
    }>
  | Readonly<{
      protocolVersion: 1;
      kind: 'cancel';
      jobId: string;
      careerId: string;
      targetJobId: string;
    }>;

export type WorkerReply =
  | Readonly<{
      protocolVersion: 1;
      kind: 'progress';
      jobId: string;
      careerId: string;
      basedOnRevision: number;
      percent: number;
    }>
  | Readonly<{
      protocolVersion: 1;
      kind: 'completed';
      jobId: string;
      careerId: string;
      basedOnRevision: number;
      report: MatchLedgerReport;
    }>
  | Readonly<{
      protocolVersion: 1;
      kind: 'failed';
      jobId: string;
      careerId: string;
      basedOnRevision: number;
      code: 'INVALID_INPUT' | 'COMPUTATION_FAILED';
    }>
  | Readonly<{
      protocolVersion: 1;
      kind: 'cancelled';
      jobId: string;
      careerId: string;
      basedOnRevision: number;
    }>;

export type WorkerWireError =
  'INVALID_MESSAGE' | 'INVALID_JOB' | 'INVALID_REPORT' | 'STALE_RESULT' |
  'CANCELLED_JOB' | 'WRONG_JOB' | 'WRONG_FIXTURE';

export type WorkerWireResult<T> =
  | Readonly<{ ok: true; value: T }>
  | Readonly<{ ok: false; error: WorkerWireError }>;

const fail = <T>(error: WorkerWireError): WorkerWireResult<T> => ({ ok: false, error });
const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
const hasKeys = (value: Record<string, unknown>, keys: readonly string[]): boolean =>
  Object.keys(value).length === keys.length && keys.every(key => Object.hasOwn(value, key));
const isRevision = (value: unknown): value is number =>
  Number.isSafeInteger(value) && (value as number) >= 0;

/** Validate bounded transport metadata before dispatch, not domain match legality. */
export function readWorkerRequest(value: unknown): WorkerWireResult<WorkerRequest> {
  if (!isRecord(value) || value.protocolVersion !== WORKER_PROTOCOL_VERSION ||
      !isStableId(value.jobId) || !isStableId(value.careerId)) {
    return fail('INVALID_MESSAGE');
  }
  if (value.kind === 'cancel') {
    if (!hasKeys(value, ['protocolVersion', 'kind', 'jobId', 'careerId', 'targetJobId']) ||
        !isStableId(value.targetJobId) || value.jobId === value.targetJobId) {
      return fail('INVALID_MESSAGE');
    }
    return { ok: true, value: {
      protocolVersion: 1, kind: 'cancel',
      jobId: value.jobId, careerId: value.careerId, targetJobId: value.targetJobId,
    } };
  }
  if (value.kind !== 'derive-ledger' || !hasKeys(value, [
    'protocolVersion', 'kind', 'jobId', 'careerId', 'expectedRevision', 'input',
  ]) || !isRevision(value.expectedRevision) || !isRecord(value.input)) {
    return fail('INVALID_MESSAGE');
  }
  // This is only a cheap early bound for a structured-clone message.
  // Full shape/rules/event validation remains in deriveMatchLedger.
  const input = value.input;
  if (!isRecord(input.catalog) || !Array.isArray(input.catalog.players) ||
      input.catalog.players.length > 2048 || !Array.isArray(input.catalog.clubs) ||
      input.catalog.clubs.length > 64 || !Array.isArray(input.events) ||
      input.events.length < 1 || input.events.length > 4096) {
    return fail('INVALID_MESSAGE');
  }
  return { ok: true, value: {
    protocolVersion: 1, kind: 'derive-ledger',
    jobId: value.jobId, careerId: value.careerId,
    expectedRevision: value.expectedRevision, input: value.input as unknown as MatchLedgerInput,
  } };
}

export interface PendingWorkerJob {
  readonly jobId: string;
  readonly careerId: string;
  readonly expectedRevision: number;
  readonly fixtureId: string;
  readonly cancelled: boolean;
}

function readStats(value: unknown): MatchTeamReport | null {
  if (!isRecord(value) || !hasKeys(value, [
    'goals', 'shots', 'shotsOnTarget', 'xgMilli',
  ])) return null;
  const { goals, shots, shotsOnTarget, xgMilli } = value;
  if (![goals, shots, shotsOnTarget, xgMilli].every(
    n => Number.isSafeInteger(n) && typeof n === 'number' && n >= 0,
  ) || (shots as number) > 4096 || (xgMilli as number) > 4096000 ||
      (goals as number) > (shotsOnTarget as number) ||
      (shotsOnTarget as number) > (shots as number) ||
      (xgMilli as number) > (shots as number) * 1000) return null;
  return {
    goals: goals as number, shots: shots as number,
    shotsOnTarget: shotsOnTarget as number, xgMilli: xgMilli as number,
  };
}

/**
 * Gate messages from a worker against a single pending job and current state.
 * Even an accepted "completed" reply is uncommitted: the application must
 * verify canonical ledger/result provenance and commit exactly once.
 */
export function readWorkerReply(
  value: unknown, pending: PendingWorkerJob, currentRevision: number,
): WorkerWireResult<WorkerReply> {
  if (!isRecord(value) || value.protocolVersion !== WORKER_PROTOCOL_VERSION ||
      !isStableId(value.jobId) || !isStableId(value.careerId) ||
      !isRevision(value.basedOnRevision)) return fail('INVALID_MESSAGE');

  if (value.jobId !== pending.jobId || value.careerId !== pending.careerId) {
    return fail('WRONG_JOB');
  }
  if (pending.cancelled) {
    if (value.basedOnRevision !== pending.expectedRevision) return fail('STALE_RESULT');
    if (value.kind === 'cancelled' && hasKeys(value, [
      'protocolVersion', 'kind', 'jobId', 'careerId', 'basedOnRevision',
    ])) {
      return { ok: true, value: {
        protocolVersion: 1, kind: 'cancelled',
        jobId: value.jobId, careerId: value.careerId,
        basedOnRevision: value.basedOnRevision,
      } };
    }
    return fail('CANCELLED_JOB');
  }
  if (!isRevision(currentRevision) || currentRevision !== pending.expectedRevision ||
      value.basedOnRevision !== pending.expectedRevision) return fail('STALE_RESULT');

  const base = {
    protocolVersion: WORKER_PROTOCOL_VERSION,
    jobId: value.jobId, careerId: value.careerId,
    basedOnRevision: value.basedOnRevision,
  };
  if (value.kind === 'progress' && hasKeys(value, [
    'protocolVersion', 'kind', 'jobId', 'careerId', 'basedOnRevision', 'percent',
  ]) && Number.isInteger(value.percent) &&
      typeof value.percent === 'number' && value.percent >= 0 && value.percent <= 100) {
    return { ok: true, value: { ...base, kind: 'progress', percent: value.percent } };
  }
  if (value.kind === 'cancelled' && hasKeys(value, [
    'protocolVersion', 'kind', 'jobId', 'careerId', 'basedOnRevision',
  ])) return { ok: true, value: { ...base, kind: 'cancelled' } };
  if (value.kind === 'failed' && hasKeys(value, [
    'protocolVersion', 'kind', 'jobId', 'careerId', 'basedOnRevision', 'code',
  ]) && (value.code === 'INVALID_INPUT' || value.code === 'COMPUTATION_FAILED')) {
    return { ok: true, value: { ...base, kind: 'failed', code: value.code } };
  }

  if (value.kind !== 'completed' || !hasKeys(value, [
    'protocolVersion', 'kind', 'jobId', 'careerId', 'basedOnRevision', 'report',
  ]) || !isRecord(value.report) || !hasKeys(value.report, [
    'fixtureId', 'home', 'away',
  ])) return fail('INVALID_MESSAGE');
  if (value.report.fixtureId !== pending.fixtureId) return fail('WRONG_FIXTURE');
  const home = readStats(value.report.home), away = readStats(value.report.away);
  if (!home || !away) return fail('INVALID_REPORT');
  return { ok: true, value: {
    ...base, kind: 'completed', report: { fixtureId: pending.fixtureId, home, away },
  } };
}
