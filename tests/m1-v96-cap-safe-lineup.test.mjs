import test from 'node:test';
import assert from 'node:assert/strict';
import {selectM1V96EligibleRegisteredLineup as pick}
  from '../dist/core/m1-v96-cap-safe-lineup.js';
import {deriveM1V82SourceBoundAvailableLineups as medical}
  from '../dist/core/m1-v82-source-bound-eligible-lineup.js';
import {proposeM1V84MedicallyAndAutomaticallyEligibleLineups as discipline}
  from '../dist/core/m1-v84-automatically-eligible-lineups.js';
import {createSyntheticRplScaleCatalog,defaultSyntheticLineup}
  from '../dist/core/synthetic.js';
import {createInitialCareer} from '../dist/core/save.js';
import {startM1V32ExposureJournal}
  from '../dist/core/m1-v32-causal-medical-journal.js';
import {generateDoubleRoundRobin} from '../dist/core/fixtures.js';
import {MATCH_LEDGER_VERSION,M0_RULES_PACK_ID,M0_RULES_PACK_VERSION}
  from '../dist/core/match-contracts.js';
import {M1_ENGINE_VERSION} from '../dist/core/m1-clock.js';
import {RNG_VERSION} from '../dist/core/rng.js';
import {defaultTacticalPlan} from '../dist/core/tactics.js';
import {validateLineup,validateCatalog}
  from '../dist/core/validation.js';

const RULES={starterCount:11,maxBench:12,maxForeignersOnField:7};
const setup=()=>{
  const catalog=structuredClone(createSyntheticRplScaleCatalog(77));
  const club=catalog.clubs[0];
  const get=id=>catalog.players.find(p=>p.id===id);
  const players=new Map(catalog.players.map(p=>[p.id,p]));
  return{catalog,club,get,players};
};

test('v96 default domestic-first registration remains unchanged, no mutation',()=>{
  const {club,players,catalog}=setup();
  const before=structuredClone(catalog);
  const x=pick(club,players,new Set(),RULES);
  assert.deepEqual(x,defaultSyntheticLineup(club));
  assert.deepEqual(catalog,before);
});

test('v96 late registered domestic reserves legally replace extra foreign starters',()=>{
  const{club,players,get}=setup();
  const foreign=club.registeredPlayerIds.slice(1,9);
  for(const id of foreign)get(id).foreignerForCompetition=true;
  const impossible=defaultSyntheticLineup(club);
  assert.ok(validateLineup(impossible,club,players,RULES)
    .some(e=>e.code==='FOREIGN_LIMIT'));
  const x=pick(club,players,new Set(),RULES);
  assert.ok(x);
  assert.deepEqual(validateLineup(x,club,players,RULES),[]);
  assert.equal(x.starters.length,11);
  assert.equal(x.bench.length,12);
  assert.equal(x.starters.filter(id=>players.get(id).foreignerForCompetition).length,7);
  assert.equal(x.starters.includes(club.registeredPlayerIds[8]),false);
  assert.ok(x.starters.includes(club.registeredPlayerIds[11]));
  assert.ok(x.bench.includes(club.registeredPlayerIds[8]));
  const blocked=new Set([club.registeredPlayerIds[11]]);
  const y=pick(club,players,blocked,RULES);
  assert.ok(y);
  assert.ok(![...y.starters,...y.bench].some(id=>blocked.has(id)));
  assert.deepEqual(validateLineup(y,club,players,RULES),[]);
});

test('v96 foreign goalkeeper cannot force cap breach if domestic reserve goalkeeper exists',()=>{
  const {club,players,get}=setup();
  get(club.registeredPlayerIds[0]).foreignerForCompetition=true;
  for(const id of club.registeredPlayerIds) {
    const p=get(id);
    if(p.primaryPosition!=='GK')p.foreignerForCompetition=true;
  }
  for(const id of club.registeredPlayerIds.slice(11,14))
    get(id).foreignerForCompetition=false;
  get(club.registeredPlayerIds[21]).foreignerForCompetition=false;
  const y=pick(club,players,new Set(),RULES);
  assert.ok(y);
  assert.equal(y.starters[0],club.registeredPlayerIds[21]);
  assert.deepEqual(validateLineup(y,club,players,RULES),[]);
  get(club.registeredPlayerIds[21]).foreignerForCompetition=true;
  assert.equal(pick(club,players,new Set(),RULES),null);
  get(club.registeredPlayerIds[21]).foreignerForCompetition=false;
  assert.equal(pick(club,players,new Set([club.registeredPlayerIds[21]]),RULES),null);
});

test('v96 v82 + v84 first-match source gates both use legal registered domestic replacements',()=>{
  const {catalog,club,get,players}=setup();
  for(const id of club.registeredPlayerIds.slice(1,9))
    get(id).foreignerForCompetition=true;
  assert.deepEqual(validateCatalog(catalog),[]);
  const initial=createInitialCareer(catalog,club.id,42,'m1-v96-source-cap');
  const j=startM1V32ExposureJournal(initial);
  assert.equal(j.ok,true);
  const fixtures=generateDoubleRoundRobin(catalog.clubs.map(c=>c.id));
  const fixture=fixtures[0].fixtures.find(f=>
    f.homeClubId===club.id||f.awayClubId===club.id);
  assert.ok(fixture);
  const m=medical(initial,j.journal,fixture);
  assert.equal(m.ok,true,JSON.stringify(m));
  const ml=m.homeLineup.clubId===club.id?m.homeLineup:m.awayLineup;
  assert.deepEqual(validateLineup(ml,club,players,RULES),[]);
  assert.equal(ml.starters.filter(id=>players.get(id).foreignerForCompetition).length,7);
  const currentCatalog=new Map(catalog.clubs.map(c=>[c.id,c]));
  const prematch={
    schemaVersion:MATCH_LEDGER_VERSION,engineVersion:M1_ENGINE_VERSION,
    rulesPackId:M0_RULES_PACK_ID,rulesPackVersion:M0_RULES_PACK_VERSION,
    fixture,catalog,homeLineup:m.homeLineup,awayLineup:m.awayLineup,
    homeTactics:defaultTacticalPlan(fixture.homeClubId),
    awayTactics:defaultTacticalPlan(fixture.awayClubId),
    rosterRules:RULES,rngAlgorithmVersion:RNG_VERSION,rngSeed:1,
  };
  const proposal=discipline(initial,j.journal,prematch);
  assert.equal(proposal.ok,true,JSON.stringify(proposal));
  assert.deepEqual(proposal.homeLineup,m.homeLineup);
  assert.deepEqual(proposal.awayLineup,m.awayLineup);
  assert.equal(proposal.subsequentV76AdmissionStillRequired,true);
  assert.equal(proposal.noMedicalRecoveryOrTreatmentGranted,true);
});

test('v96 correctly rejects impossible legal XI, even with abundant foreign reserves',()=>{
  const {club,players,get}=setup();
  for(const id of club.registeredPlayerIds){
    if(get(id).primaryPosition!=='GK')
      get(id).foreignerForCompetition=true;
  }
  assert.equal(pick(club,players,new Set(),RULES),null);
});
