import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash,webcrypto} from 'node:crypto';
import {createSyntheticRplScaleCatalog}
  from '../dist/core/synthetic.js';
import {createInitialCareer}
  from '../dist/core/save.js';
import {startM1V188LeagueJournal,prepareM1V188LeagueMatch,
  applyM1V188LeagueMatch}
  from '../dist/core/m1-v188-league-source-journal.js';
import {encodeM1V188FullCareerBackup,decodeM1V188FullCareerBackup,
  M1V188FullBackupError} from '../dist/browser/m1-v188-full-career-backup.js';
if(!globalThis.crypto)
  Object.defineProperty(globalThis,'crypto',{value:webcrypto,configurable:true});
const catalog=createSyntheticRplScaleCatalog(2026);
const career=createInitialCareer(catalog,catalog.clubs[0].id,42,
  'full-backup-unit-test');
const initial=startM1V188LeagueJournal(career);
if(!initial.ok)throw Error(initial.error);
const isInvalid=error=>error instanceof M1V188FullBackupError&&
  error.code==='INVALID_BACKUP';
const checksum=value=>createHash('sha256').update(value).digest('hex');

test('full v188 archive restores all canonical initial and source entries',async()=>{
  const first=prepareM1V188LeagueMatch(career,initial.journal);
  assert.equal(first?.ok,true);
  const saved=applyM1V188LeagueMatch(
    career,initial.journal,first.request);
  assert.equal(saved.ok,true);
  const encoded=await encodeM1V188FullCareerBackup(career,saved.journal);
  const decoded=await decodeM1V188FullCareerBackup(encoded,[catalog]);
  assert.deepEqual(decoded.initial,career);
  assert.deepEqual(decoded.journal,saved.journal);
  assert.equal(decoded.journal.revision,1);
  await assert.rejects(()=>decodeM1V188FullCareerBackup(encoded,[
    createSyntheticRplScaleCatalog(2027)]),error=>
    error instanceof M1V188FullBackupError&&
    error.code==='UNKNOWN_PACK');
  const modified=JSON.parse(encoded);
  modified.journalPayload=modified.journalPayload.replace(
    '"revision":1','"revision":2');
  await assert.rejects(()=>decodeM1V188FullCareerBackup(
    JSON.stringify(modified),[catalog]),isInvalid);
  modified.journalChecksum=checksum(modified.journalPayload);
  await assert.rejects(()=>decodeM1V188FullCareerBackup(
    JSON.stringify(modified),[catalog]),isInvalid);
  const extra=JSON.parse(encoded);
  extra.injected=true;
  await assert.rejects(()=>decodeM1V188FullCareerBackup(
    JSON.stringify(extra),[catalog]),isInvalid);
});

test('v188 full archive rejects partial, malformed, or swapped pair',async()=>{
  const encoded=await encodeM1V188FullCareerBackup(
    career,initial.journal);
  const clean=await decodeM1V188FullCareerBackup(encoded,[catalog]);
  assert.equal(clean.journal.revision,0);
  const partial=JSON.parse(encoded);
  partial.careerId='other-career';
  await assert.rejects(()=>decodeM1V188FullCareerBackup(
    JSON.stringify(partial),[catalog]),isInvalid);
  const altered=JSON.parse(encoded);
  altered.initialPayload='{}';
  altered.initialChecksum=checksum(altered.initialPayload);
  await assert.rejects(()=>decodeM1V188FullCareerBackup(
    JSON.stringify(altered),[catalog]),isInvalid);
  await assert.rejects(()=>decodeM1V188FullCareerBackup(
    '{"format":', [catalog]),isInvalid);
});
