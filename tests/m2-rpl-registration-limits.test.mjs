import test from 'node:test';
import assert from 'node:assert/strict';
import {inspectM2Rpl2026RegistrationLimits as audit,
  inspectM2Rpl2026OnFieldLimit as field}
  from '../dist/core/m2-rpl-registration-limits.js';
const p = n => ({
  personId:'player-'+String(n).padStart(2,'0'), list:'3A',
  birthDate:'2000-01-01',position:n<=2?'GK':'outfield',
  legionnaire:n>=19, homegrown:n<=12,
  clubTrained:n<=4,associationTrained:n<=12,
  loanFromRplClub:false,russianNationalTeamEligible:null,
});
const base=()=>Array.from({length:25},(_,i)=>p(i+1));

test('25 synthetic applicants satisfy only source-described numerical caps',()=>{
  const all=base();const before=JSON.stringify(all);
  const result=audit({players:all});
  assert.equal(result.ok,true);
  assert.equal(result.numericalLimitsPass,true);
  assert.equal(result.registrationAuthenticated,false);
  assert.deepEqual(result.counts,{form3A:25,form3B:0,form3C:0,
    legionnaires3A3B:7,goalkeepers3A3B:2,homegrown3A:12,
    clubTrained3A:4,associationTrained3A:12,rplLoans:0});
  assert.deepEqual(result.blockers,[]);
  assert.equal(JSON.stringify(all),before);
});
test('list limits, 12+7 foreigner caps and two loans are independently checked',()=>{
  const all=base();
  const tooMany=[...all,{...p(26),personId:'player-26'}];
  assert.ok(audit({players:tooMany}).blockers.includes('FORM_3A_EXCEEDS_25'));
  const overForeign=all.map((r,i)=>({...r,legionnaire:i<13}));
  assert.ok(audit({players:overForeign}).blockers.includes('LEGIONNAIRES_EXCEED_12'));
  const overLoans=all.map((r,i)=>({...r,loanFromRplClub:i<3}));
  assert.ok(audit({players:overLoans}).blockers.includes('RPL_LOANS_EXCEED_TWO'));
  const eleven=[all[0],...all.slice(2,12)].map(r=>r.personId);
  assert.equal(field({players:all,starters:eleven}).numericalLimitsPass,true);
  const onFieldForeigners=new Set(eleven.slice(0,8));
  const tooManyOnField=all.map(r=>({...r,legionnaire:onFieldForeigners.has(r.personId)}));
  assert.deepEqual(field({players:tooManyOnField,starters:eleven}).blockers,
    ['TOO_MANY_LEGIONNAIRES']);
});
test('unknown status never quietly passes and homegrown shortage is unresolved',()=>{
  const all=base();
  const changed=all.map((r,i)=>i===2?{...r,legionnaire:null,
    loanFromRplClub:null}:r);
  const result=audit({players:changed});
  assert.ok(result.blockers.includes('LEGIONNAIRE_STATUS_UNKNOWN'));
  assert.ok(result.blockers.includes('RPL_LOAN_STATUS_UNKNOWN'));
  const shortage=all.map((r,i)=>i===4?{...r,homegrown:false,
    associationTrained:false,clubTrained:false}:r);
  const second=audit({players:shortage});
  assert.ok(second.blockers.includes('HOMEGROWN_QUOTA_ADJUSTMENT_UNRESOLVED'));
  assert.equal(second.numericalLimitsPass,false);
});
test('3B and 3C age and team eligibility require verified facts',()=>{
  const all=base();
  const b={...p(26),list:'3B',birthDate:'2005-01-01',position:'GK',
    homegrown:false,clubTrained:false,associationTrained:false,
    legionnaire:false};
  const c={...p(27),list:'3C',birthDate:'2007-01-01',position:'outfield',
    homegrown:false,clubTrained:false,associationTrained:false,
    legionnaire:false,russianNationalTeamEligible:true};
  assert.equal(audit({players:[...all,b,c]}).numericalLimitsPass,true);
  const tooOld=audit({players:[...all,{...b,birthDate:'2004-12-31'},
    {...c,birthDate:'2006-12-31',russianNationalTeamEligible:null}]});
  assert.ok(tooOld.blockers.includes('FORM_3B_BIRTH_TOO_EARLY'));
  assert.ok(tooOld.blockers.includes('FORM_3C_BIRTH_TOO_EARLY'));
  assert.ok(tooOld.blockers.includes('FORM_3C_RFU_ELIGIBILITY_UNKNOWN'));
});
test('adversarial duplicate and inconsistent claims are rejected, not normalized',()=>{
  const all=base();
  assert.deepEqual(audit({players:[...all,all[0]]}),
    {ok:false,error:'INVALID_INPUT'});
  assert.deepEqual(audit({players:[...all,{...p(26),birthDate:'2005-02-30'}]}),
    {ok:false,error:'INVALID_INPUT'});
  assert.deepEqual(audit({players:[...all,{...p(26),homegrown:false,
    clubTrained:true}]}),{ok:false,error:'INVALID_INPUT'});
  assert.deepEqual(field({players:all,starters:all.slice(2,13).map(p=>p.personId)}).blockers,
    ['GOALKEEPER_COUNT_INVALID']);
  assert.deepEqual(field({players:all,starters:[...all.slice(0,10).map(p=>p.personId),'unknown']}),
    {ok:false,error:'INVALID_INPUT'});
});
