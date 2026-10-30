import {sameCanonicalValue} from './canonical-value.js';
import {isStableId} from './identifiers.js';
import {isPlainJsonTree} from './plain-json-tree.js';
import {simulateM1V105SpecialGoalChronology,
  type M1V105Run} from './m1-v105-special-goal-chronology.js';

/**
 * Isolated v107 pre-admission gate. The key comes from an independent host
 * trust configuration, never from a signature, journal or editable career.
 * A cryptographic signature does NOT prove official referee/doctor status.
 */
export const M1_V107_SIGNED_SOURCE_SCHEMA=107 as const;
export const M1_V107_PURPOSE='footclubsim-m1-v105-career-source' as const;
const CONTEXT=['careerId','fixtureId','expectedRevision','challengeId'];
const PAYLOAD=['schemaVersion','purpose',...CONTEXT,'sourceSha256'];
const ENVELOPE=['schemaVersion','payload','signature'];
const MAX_SOURCE_BYTES=2_000_000;
type Good=Extract<M1V105Run,{ok:true}>;
export type M1V107Verification=
  | Readonly<{ok:false;error:'INVALID_CONTEXT'|'INVALID_SOURCE'|
      'INVALID_ENVELOPE'|'SCOPE_MISMATCH'|'TRUST_ANCHOR_UNAVAILABLE'|
      'INVALID_SIGNATURE'|'V105_SOURCE_REJECTED'|'CLAIMED_RESULT_MISMATCH'}>
  | Readonly<{ok:true;schemaVersion:107;
      status:'EXTERNALLY_SIGNED_V105_SOURCE_REPLAY_GATED';
      careerId:string;fixtureId:string;expectedRevision:number;
      challengeId:string;sourceSha256:string;result:Good;
      signedByProvidedTrustAnchor:true;
      officialRefereeAndPhysicianIdentityEstablished:false;
      externalChallengeReplayProtectionEstablished:false;
      immutableM0CareerJournalValidated:false;
      durableCareerCASCommitted:false}>;
const fail=(error:Extract<M1V107Verification,{ok:false}>['error']):
  M1V107Verification=>({ok:false,error});
const rec=(x:unknown):x is Record<string,unknown> =>
  x!==null&&typeof x==='object'&&!Array.isArray(x);
const exact=(o:Record<string,unknown>,keys:readonly string[]) =>
  Reflect.ownKeys(o).length===keys.length&&keys.every(k=>Object.hasOwn(o,k));
function contextValid(x:unknown):x is Record<string,unknown>{
  return isPlainJsonTree(x)&&rec(x)&&exact(x,CONTEXT)&&
    isStableId(x.careerId)&&isStableId(x.fixtureId)&&
    isStableId(x.challengeId)&&Number.isSafeInteger(x.expectedRevision)&&
    (x.expectedRevision as number)>=0&&(x.expectedRevision as number)<=240;
}
function keyValid(x:unknown):x is CryptoKey{
  try{
    const key=x as CryptoKey;
    return key!==null&&typeof key==='object'&&key.type==='public'&&
      key.algorithm.name==='Ed25519'&&key.usages.length===1&&
      key.usages[0]==='verify';
  }catch{return false;}
}
function parseEnvelope(raw:unknown):{payload:Record<string,unknown>;
  payloadBytes:Uint8Array;signatureBytes:Uint8Array}|null{
  if(!isPlainJsonTree(raw)||!rec(raw)||!exact(raw,ENVELOPE)||
      raw.schemaVersion!==107||typeof raw.payload!=='string'||
      typeof raw.signature!=='string'||
      !/^[A-Za-z0-9_-]{86}$/.test(raw.signature))return null;
  try{
    const payload=JSON.parse(raw.payload) as unknown;
    if(!isPlainJsonTree(payload)||!rec(payload)||
        !exact(payload,PAYLOAD)||JSON.stringify(payload)!==raw.payload||
        payload.schemaVersion!==107||payload.purpose!==M1_V107_PURPOSE||
        !contextValid(Object.fromEntries(CONTEXT.map(k=>[k,payload[k]])))||
        typeof payload.sourceSha256!=='string'||
        !/^[a-f0-9]{64}$/.test(payload.sourceSha256))return null;
    const binary=atob(raw.signature.replace(/-/g,'+').replace(/_/g,'/')+'==');
    if(binary.length!==64||
        btoa(binary).split('+').join('-').split('/').join('_')
          .replace(/=+$/g,'')!==raw.signature)return null;
    return {payload,payloadBytes:new TextEncoder().encode(raw.payload),
      signatureBytes:Uint8Array.from(binary,c=>c.charCodeAt(0))};
  }catch{return null;}
}

/**
 * The host must independently bind the public key to its issuer, guarantee
 * unique challenge IDs, load immutable M0 data and check the current CAS
 * revision. This gate deliberately does not claim those obligations.
 */
export async function verifyM1V107SignedV105Source(
  trustedPublicKey:unknown,trustedContext:unknown,
  signedEnvelope:unknown,source:unknown,claimedResult:unknown,
):Promise<M1V107Verification>{
  if(!contextValid(trustedContext))return fail('INVALID_CONTEXT');
  if(!isPlainJsonTree(source)||!Array.isArray(source)||
      source.length!==6||!source.every(isPlainJsonTree)||
      !Array.isArray(source[2])||!Array.isArray(source[3])||
      !Array.isArray(source[4])||!Array.isArray(source[5])||
      source[2].length>24||source[3].length>36||
      source[4].length>36||source[5].length>18)
    return fail('INVALID_SOURCE');
  const prematch=source[0];
  if(!rec(prematch)||!rec(prematch.fixture)||
      prematch.fixture.id!==trustedContext.fixtureId)
    return fail('SCOPE_MISMATCH');
  const envelope=parseEnvelope(signedEnvelope);
  if(!envelope)return fail('INVALID_ENVELOPE');
  if(CONTEXT.some(k=>envelope.payload[k]!==trustedContext[k]))
    return fail('SCOPE_MISMATCH');
  if(!keyValid(trustedPublicKey)||typeof crypto==='undefined'||
      !crypto.subtle)return fail('TRUST_ANCHOR_UNAVAILABLE');
  let bytes:Uint8Array;
  try{
    bytes=new TextEncoder().encode(JSON.stringify(source));
    if(bytes.length===0||bytes.length>MAX_SOURCE_BYTES)
      return fail('INVALID_SOURCE');
  }catch{return fail('INVALID_SOURCE');}
  try{
    const digest=await crypto.subtle.digest('SHA-256',bytes);
    const hex=Array.from(new Uint8Array(digest),
      x=>x.toString(16).padStart(2,'0')).join('');
    if(envelope.payload.sourceSha256!==hex)return fail('SCOPE_MISMATCH');
    if(!await crypto.subtle.verify('Ed25519',trustedPublicKey,
      envelope.signatureBytes,envelope.payloadBytes))
      return fail('INVALID_SIGNATURE');
    const result=simulateM1V105SpecialGoalChronology(
      source[0],source[1],source[2],source[3],source[4],source[5]);
    if(!result.ok)return fail('V105_SOURCE_REJECTED');
    if(!isPlainJsonTree(claimedResult)||
        !sameCanonicalValue(result,claimedResult))
      return fail('CLAIMED_RESULT_MISMATCH');
    return {ok:true,schemaVersion:107,
      status:'EXTERNALLY_SIGNED_V105_SOURCE_REPLAY_GATED',
      careerId:trustedContext.careerId as string,
      fixtureId:trustedContext.fixtureId as string,
      expectedRevision:trustedContext.expectedRevision as number,
      challengeId:trustedContext.challengeId as string,
      sourceSha256:hex,result,
      signedByProvidedTrustAnchor:true,
      officialRefereeAndPhysicianIdentityEstablished:false,
      externalChallengeReplayProtectionEstablished:false,
      immutableM0CareerJournalValidated:false,
      durableCareerCASCommitted:false};
  }catch{return fail('TRUST_ANCHOR_UNAVAILABLE');}
}
