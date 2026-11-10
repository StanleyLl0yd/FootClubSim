import {isStableId} from './identifiers.js';

/** Source-bounded 2026/27 Article 5.8/5.8.1 arithmetic checks only.
 * Caller-declared facts are NOT authenticated federation registrations. */
export const M2_RPL_REGISTRATION_LIMITS_VERSION=1 as const;
export type M2RegistrationList='3A'|'3B'|'3C';
export type M2RegistrationPlayer=Readonly<{
  personId:string;list:M2RegistrationList;birthDate:string|null;
  position:'GK'|'outfield';legionnaire:boolean|null;
  homegrown:boolean|null;clubTrained:boolean|null;
  associationTrained:boolean|null;loanFromRplClub:boolean|null;
  russianNationalTeamEligible:boolean|null;
}>;
export type M2RegistrationLimitBlocker=
  'FORM_3A_EXCEEDS_25'|'FORM_3B_EXCEEDS_30'|'FORM_3C_EXCEEDS_50'|
  'GOALKEEPERS_BELOW_TWO'|'LEGIONNAIRE_STATUS_UNKNOWN'|
  'LEGIONNAIRES_EXCEED_12'|'HOMEGROWN_STATUS_UNKNOWN'|
  'HOMEGROWN_QUOTA_ADJUSTMENT_UNRESOLVED'|'RPL_LOAN_STATUS_UNKNOWN'|
  'RPL_LOANS_EXCEED_TWO'|'FORM_3B_BIRTH_UNKNOWN'|
  'FORM_3B_BIRTH_TOO_EARLY'|'FORM_3C_BIRTH_UNKNOWN'|
  'FORM_3C_BIRTH_TOO_EARLY'|'FORM_3C_RFU_ELIGIBILITY_UNKNOWN'|
  'FORM_3C_RFU_ELIGIBILITY_DENIED';
export type M2RegistrationLimitResult=
  | Readonly<{ok:false;error:'INVALID_INPUT'}>
  | Readonly<{ok:true;schemaVersion:1;
    status:'LIMIT_CHECK_ONLY_NOT_REGISTERED';
    numericalLimitsPass:boolean;registrationAuthenticated:false;
    counts:Readonly<{form3A:number;form3B:number;form3C:number;
      legionnaires3A3B:number;goalkeepers3A3B:number;
      homegrown3A:number;clubTrained3A:number;
      associationTrained3A:number;rplLoans:number}>;
    blockers:readonly M2RegistrationLimitBlocker[]}>;
export type M2OnFieldResult=
  | Readonly<{ok:false;error:'INVALID_INPUT'}>
  | Readonly<{ok:true;status:'LINEUP_CAP_ONLY_NOT_MATCH_ELIGIBILITY';
    numericalLimitsPass:boolean;matchEligibilityAuthenticated:false;
    legionnaires:number;blockers:readonly ('FOREIGN_STATUS_UNKNOWN'|
    'TOO_MANY_LEGIONNAIRES'|'GOALKEEPER_COUNT_INVALID')[]}>;

const rec=(v:unknown):v is Record<string,unknown>=>
  v!==null&&typeof v==='object'&&!Array.isArray(v);
const bool=(v:unknown)=>v===null||typeof v==='boolean';
const keys=['personId','list','birthDate','position','legionnaire',
  'homegrown','clubTrained','associationTrained','loanFromRplClub',
  'russianNationalTeamEligible'];
function validDate(v:unknown):v is string{
  if(typeof v!=='string'||!/^(?:19|20)\d{2}-\d{2}-\d{2}$/u.test(v))
    return false;
  const [y,m,d]=v.split('-').map(Number);
  const parsed=new Date(Date.UTC(y!,m!-1,d!));
  return parsed.toISOString().slice(0,10)===v;
}
function isPlayer(value:unknown):value is M2RegistrationPlayer{
  if(!rec(value)||Object.keys(value).length!==keys.length||
     !keys.every(k=>Object.hasOwn(value,k))||
     !isStableId(value.personId)||
     !['3A','3B','3C'].includes(String(value.list))||
     !['GK','outfield'].includes(String(value.position))||
     !(value.birthDate===null||validDate(value.birthDate))||
     !bool(value.legionnaire)||!bool(value.homegrown)||
     !bool(value.clubTrained)||!bool(value.associationTrained)||
     !bool(value.loanFromRplClub)||
     !bool(value.russianNationalTeamEligible))return false;
  // A positive club/association training claim must be consistent with the
  // distinct overall homegrown claim. Unknown statuses never mean "false".
  if((value.clubTrained===true||value.associationTrained===true)&&
      value.homegrown!==true)return false;
  if(value.homegrown===false&&
      (value.clubTrained!==false||value.associationTrained!==false))
    return false;
  return true;
}
function players(raw:unknown):readonly M2RegistrationPlayer[]|null{
  if(!Array.isArray(raw)||raw.length>105||!raw.every(isPlayer))return null;
  if(new Set(raw.map(p=>p.personId)).size!==raw.length)return null;
  return raw as readonly M2RegistrationPlayer[];
}

/** Restrictions from documented RFU article 5.8. A homegrown shortage is
 * unresolved, not an unverified invented reduced-quota calculation. */
export function inspectM2Rpl2026RegistrationLimits(
  input:unknown,
):M2RegistrationLimitResult{
  if(!rec(input)||Object.keys(input).length!==1||
     !Object.hasOwn(input,'players'))return {ok:false,error:'INVALID_INPUT'};
  const all=players(input.players);
  if(!all)return {ok:false,error:'INVALID_INPUT'};
  const a=all.filter(p=>p.list==='3A');
  const b=all.filter(p=>p.list==='3B');
  const c=all.filter(p=>p.list==='3C');
  const ab=[...a,...b];
  const counted=(items:readonly M2RegistrationPlayer[],
    key:'legionnaire'|'homegrown'|'clubTrained'|'associationTrained'|
      'loanFromRplClub')=>items.filter(p=>p[key]===true).length;
  const known=(items:readonly M2RegistrationPlayer[],
    key:'legionnaire'|'homegrown'|'clubTrained'|'associationTrained'|
      'loanFromRplClub')=>items.every(p=>p[key]!==null);
  const counts={form3A:a.length,form3B:b.length,form3C:c.length,
    legionnaires3A3B:counted(ab,'legionnaire'),
    goalkeepers3A3B:ab.filter(p=>p.position==='GK').length,
    homegrown3A:counted(a,'homegrown'),
    clubTrained3A:counted(a,'clubTrained'),
    associationTrained3A:counted(a,'associationTrained'),
    rplLoans:counted(all,'loanFromRplClub')};
  const blockers:M2RegistrationLimitBlocker[]=[];
  if(a.length>25)blockers.push('FORM_3A_EXCEEDS_25');
  if(b.length>30)blockers.push('FORM_3B_EXCEEDS_30');
  if(c.length>50)blockers.push('FORM_3C_EXCEEDS_50');
  if(counts.goalkeepers3A3B<2)blockers.push('GOALKEEPERS_BELOW_TWO');
  if(!known(ab,'legionnaire'))blockers.push('LEGIONNAIRE_STATUS_UNKNOWN');
  if(counts.legionnaires3A3B>12)blockers.push('LEGIONNAIRES_EXCEED_12');
  if(!known(a,'homegrown')||!known(a,'clubTrained')||
     !known(a,'associationTrained'))
    blockers.push('HOMEGROWN_STATUS_UNKNOWN');
  if(counts.homegrown3A<12||counts.clubTrained3A<4||
     counts.associationTrained3A<8)
    blockers.push('HOMEGROWN_QUOTA_ADJUSTMENT_UNRESOLVED');
  if(!known(all,'loanFromRplClub'))blockers.push('RPL_LOAN_STATUS_UNKNOWN');
  if(counts.rplLoans>2)blockers.push('RPL_LOANS_EXCEED_TWO');
  if(b.some(p=>p.birthDate===null))
    blockers.push('FORM_3B_BIRTH_UNKNOWN');
  if(b.some(p=>p.birthDate!==null&&p.birthDate<'2005-01-01'))
    blockers.push('FORM_3B_BIRTH_TOO_EARLY');
  if(c.some(p=>p.birthDate===null))
    blockers.push('FORM_3C_BIRTH_UNKNOWN');
  if(c.some(p=>p.birthDate!==null&&p.birthDate<'2007-01-01'))
    blockers.push('FORM_3C_BIRTH_TOO_EARLY');
  if(c.some(p=>p.russianNationalTeamEligible===null))
    blockers.push('FORM_3C_RFU_ELIGIBILITY_UNKNOWN');
  if(c.some(p=>p.russianNationalTeamEligible===false))
    blockers.push('FORM_3C_RFU_ELIGIBILITY_DENIED');
  return {ok:true,schemaVersion:1,status:'LIMIT_CHECK_ONLY_NOT_REGISTERED',
    numericalLimitsPass:blockers.length===0,registrationAuthenticated:false,
    counts,blockers};
}

/** One team at a kickoff/checkpoint. No source registration, substitution
 * windows, federation evidence or pre-match paperwork is authenticated here. */
export function inspectM2Rpl2026OnFieldLimit(
  input:unknown,
):M2OnFieldResult{
  if(!rec(input)||Object.keys(input).length!==2||
     !Object.hasOwn(input,'players')||!Object.hasOwn(input,'starters'))
    return {ok:false,error:'INVALID_INPUT'};
  const all=players(input.players);
  if(!all||!Array.isArray(input.starters)||input.starters.length!==11||
     !input.starters.every(isStableId)||
     new Set(input.starters).size!==11)
    return {ok:false,error:'INVALID_INPUT'};
  const pool=new Map(all.map(p=>[p.personId,p]));
  const onField=input.starters.map(id=>pool.get(id));
  if(onField.some(p=>p===undefined))return {ok:false,error:'INVALID_INPUT'};
  const eleven=onField as M2RegistrationPlayer[];
  const foreign=eleven.filter(p=>p.legionnaire===true).length;
  const blockers:('FOREIGN_STATUS_UNKNOWN'|'TOO_MANY_LEGIONNAIRES'|
    'GOALKEEPER_COUNT_INVALID')[]=[];
  if(eleven.some(p=>p.legionnaire===null))
    blockers.push('FOREIGN_STATUS_UNKNOWN');
  if(foreign>7)blockers.push('TOO_MANY_LEGIONNAIRES');
  if(eleven.filter(p=>p.position==='GK').length!==1)
    blockers.push('GOALKEEPER_COUNT_INVALID');
  return {ok:true,status:'LINEUP_CAP_ONLY_NOT_MATCH_ELIGIBILITY',
    numericalLimitsPass:blockers.length===0,matchEligibilityAuthenticated:false,
    legionnaires:foreign,blockers};
}
