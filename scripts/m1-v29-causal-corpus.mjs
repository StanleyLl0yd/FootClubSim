import { createHash } from 'node:crypto';
import { m1Wilson95 } from '../dist/core/m1-diagnostics.js';
import { argv } from 'node:process';
import { simulateM1V29CausalMedical, verifyM1V29CausalMedical }
  from '../dist/core/m1-v29-causal-medical.js';
import { M1_ENGINE_VERSION, M1_CLOCK_MAX_EVENTS,
  M1_CLOCK_STEP_SECONDS } from '../dist/core/m1-clock.js';
import { MATCH_LEDGER_VERSION, M0_RULES_PACK_ID, M0_RULES_PACK_VERSION }
  from '../dist/core/match-contracts.js';
import { createSyntheticRplScaleCatalog, defaultSyntheticLineup }
  from '../dist/core/synthetic.js';
import { generateDoubleRoundRobin } from '../dist/core/fixtures.js';
import { RNG_VERSION } from '../dist/core/rng.js';
import { defaultTacticalPlan } from '../dist/core/tactics.js';

/**
 * Bounded source-replay regression for the isolated v29 synthetic medical
 * model. The cohort is NOT evidence of observed injuries or calibrated rates.
 */
function option(name, fallback) {
  const found = argv.filter(a => a.startsWith('--' + name + '='));
  if (found.length > 1) throw Error('DUPLICATE_OPTION:' + name);
  if (found.length === 0) return fallback;
  const raw = found[0].slice(name.length + 3);
  if (!/^[1-9][0-9]*$/.test(raw)) throw Error('INVALID_OPTION:' + name);
  const number = Number(raw);
  if (!Number.isSafeInteger(number)) throw Error('INVALID_OPTION:' + name);
  return number;
}
export function runCorpus() {
  const allowed = new Set(['start','count','fixtures','firstfixture']);
  for (const arg of argv.slice(2)) {
    if (!/^--[a-z]+=[^=]*$/.test(arg) ||
        !allowed.has(arg.slice(2).split('=')[0])) {
      throw Error('UNKNOWN_OPTION');
    }
  }
  const start = option('start', 1);
  const count = option('count', 12);
  const fixtureCount = option('fixtures', 1);
  const firstFixture = option('firstfixture', 1);
  if (fixtureCount > 32 || firstFixture>240 ||
      firstFixture+fixtureCount-1>240) {
    throw Error('BOUNDED_FIXTURE_RANGE_REQUIRED');
  }
  if (count > 128 || start > 0xffffffff ||
      start + count - 1 > 0xffffffff) {
    throw Error('BOUNDED_SEED_RANGE_REQUIRED');
  }
  const catalog = createSyntheticRplScaleCatalog(77);
  const fixtures = generateDoubleRoundRobin(catalog.clubs.map(c => c.id))
    .flatMap(r => r.fixtures)
    .slice(firstFixture-1, firstFixture-1+fixtureCount);
  if (fixtures.length !== fixtureCount) {
    throw Error('BOUNDED_FIXTURE_RANGE_REQUIRED');
  }
  const policy = {
    home: {assignedActor:{kind:'player'},availableStaffIds:[]},
    away: {assignedActor:{kind:'player'},availableStaffIds:[]},
  };
  const digest = createHash('sha256');
  const rejections = {};
  const summaries = [];
  let accepted = 0, rejected = 0, quickAssessments = 0;
  let offFieldAssessments = 0, generatedFouls = 0;
  let totalGoals = 0, medicalExitEvents = 0, medicalReturnEvents = 0;
  let minShotsPerMatch = Infinity, maxShotsPerMatch = 0;
  let shotlessMatches = 0;
  // Rejected seeds are recorded separately, never treated as zero-valued games.
  const observed = {
    homeWins:0, draws:0, awayWins:0, scorelessDraws:0,
    matchesWithModelledAssessment:0,
    goals:0, shots:0, yellowCards:0, dismissals:0,
    syntheticInjuryWithdrawals:0, modelledAssessments:0,
  };
  const squared = {goals:0,shots:0,yellowCards:0,dismissals:0,
    syntheticInjuryWithdrawals:0,modelledAssessments:0};
  for (const fixture of fixtures) {
    const home = catalog.clubs.find(c => c.id === fixture.homeClubId);
    const away = catalog.clubs.find(c => c.id === fixture.awayClubId);
    const base = {
      schemaVersion:MATCH_LEDGER_VERSION, engineVersion:M1_ENGINE_VERSION,
      rulesPackId:M0_RULES_PACK_ID,
      rulesPackVersion:M0_RULES_PACK_VERSION,
      fixture,catalog,
      homeLineup:defaultSyntheticLineup(home),
      awayLineup:defaultSyntheticLineup(away),
      homeTactics:defaultTacticalPlan(fixture.homeClubId),
      awayTactics:defaultTacticalPlan(fixture.awayClubId),
      rosterRules:{starterCount:11,maxBench:12,maxForeignersOnField:7},
      rngAlgorithmVersion:RNG_VERSION,
    };
    let fixtureAccepted = 0, fixtureRejected = 0;
    for (let seed = start; seed < start + count; seed++) {
      const prematch = {...base,rngSeed:seed};
      const run = simulateM1V29CausalMedical(prematch,policy);
      if (!run.ok) {
        if (!['SOURCE_MATCH_REJECTED','REFEREE_REPLAY_MISMATCH']
          .includes(run.error)) {
          throw Error('UNEXPECTED_REJECTION:' + fixture.id + ':' +
            seed + ':' + run.error);
        }
        rejected++; fixtureRejected++;
        rejections[run.error] = (rejections[run.error] ?? 0) + 1;
        digest.update(JSON.stringify({fixtureId:fixture.id,seed,
          error:run.error}) + '\n');
        continue;
      }
      if (!verifyM1V29CausalMedical(prematch,policy,[],[],run)) {
        throw Error('REPLAY_MISMATCH:' + fixture.id + ':' + seed);
      }
      const match = run.source.match;
      if (match.rngDraws !== 90 ||
          run.source.refereeRngDraws !== 90 ||
          run.source.treatmentRngDraws !== 54 ||
          match.events.at(-1)?.kind !== 'full-time' ||
          match.events.at(-1)?.runningSeconds !== 5400 ||
          run.source.externalMedicalAuthorityAuthenticated !== false ||
          run.realWorldInjuryAuthenticated !== false ||
          run.calibratedInjuryRate !== false) {
        throw Error('SOURCE_INVARIANT:' + fixture.id + ':' + seed);
      }
      const events = new Map(match.events.map(e => [e.id,e]));
      for (const a of run.assessments) {
        const whistle = events.get(a.foulWhistleEventId);
        const decision = events.get(a.offenderSourceEventId);
        const restart = events.get(a.foulRestartEventId);
        if (!whistle || !decision || !restart ||
            whistle.kind !== 'synthetic-foul-whistle' ||
            restart.kind !== 'synthetic-foul-restart' ||
            whistle.runningSeconds !== a.elapsedSeconds ||
            decision.runningSeconds !== a.elapsedSeconds ||
            restart.runningSeconds !== a.elapsedSeconds ||
            !(whistle.sequence < decision.sequence &&
              decision.sequence < restart.sequence) ||
            a.patientTeamId === decision.teamId ||
            a.externalMedicalAuthorityAuthenticated !== false) {
          throw Error('CAUSAL_LINK_MISMATCH:' + fixture.id + ':' + seed);
        }
        const side = a.patientTeamId === fixture.homeClubId ? 'home' : 'away';
        if (!whistle.onField[side].includes(a.patientPlayerId)) {
          throw Error('PATIENT_NOT_PRESENT:' + fixture.id + ':' + seed);
        }
        if (a.transition === 'on-field-quick') {
          if (a.medicalExitEventId !== null ||
              a.medicalReturnEventId !== null ||
              !restart.onField[side].includes(a.patientPlayerId)) {
            throw Error('QUICK_TRANSITION_MISMATCH:' + fixture.id + ':' + seed);
          }
          quickAssessments++;
        } else if (a.transition === 'off-field-return') {
          const exit = events.get(a.medicalExitEventId);
          const returned = events.get(a.medicalReturnEventId);
          if (!exit || !returned ||
              exit.kind !== 'treatment-exit' ||
              returned.kind !== 'treatment-return' ||
              exit.playerId !== a.patientPlayerId ||
              returned.playerId !== a.patientPlayerId ||
              returned.runningSeconds - exit.runningSeconds !== 300 ||
              !(decision.sequence < exit.sequence &&
                exit.sequence < restart.sequence &&
                restart.sequence < returned.sequence) ||
              restart.onField[side].includes(a.patientPlayerId) ||
              !returned.onField[side].includes(a.patientPlayerId)) {
            throw Error('OFF_FIELD_TRANSITION_MISMATCH:' +
              fixture.id + ':' + seed);
          }
          offFieldAssessments++;
        } else {
          throw Error('UNKNOWN_TRANSITION:' + fixture.id + ':' + seed);
        }
      }
      const exits = match.events.filter(e => e.kind === 'treatment-exit');
      const returns = match.events.filter(e => e.kind === 'treatment-return');
      if (exits.length !== returns.length) {
        throw Error('MEDICAL_COUNT_MISMATCH:' + fixture.id + ':' + seed);
      }
      medicalExitEvents += exits.length;
      medicalReturnEvents += returns.length;
      const {home:homeGoals,away:awayGoals} = match.finalScore;
      const goals = homeGoals + awayGoals;
      const shotEvents = match.events.filter(e => e.kind === 'shot');
      const shots = shotEvents.length;
      if (shots > M1_CLOCK_MAX_EVENTS ||
          new Set(shotEvents.map(e=>
            Math.floor(e.runningSeconds/M1_CLOCK_STEP_SECONDS))).size!==shots||
          shotEvents.some(e=>
            e.runningSeconds%M1_CLOCK_STEP_SECONDS !==
              M1_CLOCK_STEP_SECONDS-1)) {
        throw Error('SHOT_PHASE_BUDGET_BROKEN:' + fixture.id + ':' + seed);
      }
      const referee = match.sourceRefereeEffects;
      const yellowCards = referee.yellow;
      const dismissals = referee.secondYellowRed + referee.straightRed;
      const syntheticInjuryWithdrawals = referee.injuryWithdrawn;
      if (match.events.filter(e => e.kind === 'caution').length !== yellowCards ||
          match.events.filter(e => e.kind === 'second-yellow-dismissal' ||
            e.kind === 'straight-red-dismissal').length !== dismissals ||
          match.events.filter(e => e.kind === 'injury-withdrawal').length !==
            syntheticInjuryWithdrawals ||
          goals > shots || !Number.isSafeInteger(goals) ||
          !Number.isSafeInteger(shots)) {
        throw Error('SOURCE_METRICS_MISMATCH:' + fixture.id + ':' + seed);
      }
      minShotsPerMatch=Math.min(minShotsPerMatch,shots);
      maxShotsPerMatch=Math.max(maxShotsPerMatch,shots);
      shotlessMatches+=Number(shots===0);
      observed.homeWins += Number(homeGoals > awayGoals);
      observed.draws += Number(homeGoals === awayGoals);
      observed.awayWins += Number(homeGoals < awayGoals);
      observed.scorelessDraws += Number(goals === 0);
      observed.matchesWithModelledAssessment +=
        Number(run.assessments.length > 0);
      const sample = {goals,shots,yellowCards,dismissals,
        syntheticInjuryWithdrawals,modelledAssessments:run.assessments.length};
      for (const [name,value] of Object.entries(sample)) {
        observed[name] += value;
        squared[name] += value * value;
      }
      generatedFouls += match.generatedFoulStoppages;
      totalGoals += goals;
      accepted++;fixtureAccepted++;
      digest.update(JSON.stringify({
        fixtureId:fixture.id,seed,score:match.finalScore,
        rng:match.rngState,refereeRng:run.source.refereeRngState,
        treatmentRng:run.source.treatmentRngState,
        observed:{goals,shots,yellowCards,dismissals,
          syntheticInjuryWithdrawals},
        assessments:run.assessments.map(a=>({
          incident:a.incidentId,patient:a.patientPlayerId,
          mode:a.transition,exit:a.medicalExitEventId,
          returned:a.medicalReturnEventId,
        })),
      }) + '\n');
    }
    if (!fixtureAccepted || fixtureAccepted + fixtureRejected !== count) {
      throw Error('INVALID_FIXTURE_COVERAGE:' + fixture.id);
    }
    summaries.push({fixtureId:fixture.id,accepted:fixtureAccepted,
      rejected:fixtureRejected});
  }
  if (!accepted || accepted + rejected !== count * fixtureCount) {
    throw Error('INVALID_CORPUS_COVERAGE');
  }
  const rate = count => ({
    count,denominator:accepted,rate:count / accepted,
    wilson95:m1Wilson95(count,accepted),
  });
  const mean = key => {
    const sum = observed[key];
    const average = sum / accepted;
    const variance = accepted > 1 ?
      Math.max(0,(squared[key] - sum * sum / accepted) / (accepted - 1)) :
      null;
    const sampleStdDev = variance === null ? null : Math.sqrt(variance);
    const margin = sampleStdDev === null ? null :
      1.959963984540054 * sampleStdDev / Math.sqrt(accepted);
    return {count:accepted,total:sum,mean:average,sampleStdDev,
      normalMean95:margin === null ? null : {
        lower:average - margin,upper:average + margin,
      }};
  };
  const p5Observation = {
    schemaVersion:1,
    status:'SYNTHETIC_V29_CONDITIONAL_OBSERVATION_NOT_CALIBRATION',
    denominatorPolicy:'SUCCESSFUL_FULL_SOURCE_REPLAYS_ONLY',
    accepted, rejected, attempted:accepted+rejected,
    outcomeRates:{
      homeWin:rate(observed.homeWins),draw:rate(observed.draws),
      awayWin:rate(observed.awayWins),
      scorelessDraw:rate(observed.scorelessDraws),
    },
    modelledAssessmentIncidencePerAcceptedMatch:
      rate(observed.matchesWithModelledAssessment),
    perAcceptedMatch:{
      goals:mean('goals'), shots:mean('shots'),
      yellowCards:mean('yellowCards'),
      dismissals:mean('dismissals'),
      syntheticInjuryWithdrawals:mean('syntheticInjuryWithdrawals'),
      modelledAssessments:mean('modelledAssessments'),
    },
    shotStructure:{
      schemaVersion:1,
      virtualPhasesPerMatch:M1_CLOCK_MAX_EVENTS,
      runningSecondsPerPhase:M1_CLOCK_STEP_SECONDS,
      theoreticalShotEventsCapPerMatch:M1_CLOCK_MAX_EVENTS,
      observedMinimumShotsPerAcceptedMatch:minShotsPerMatch,
      observedMaximumShotsPerAcceptedMatch:maxShotsPerMatch,
      observedShotlessAcceptedMatches:shotlessMatches,
      oneShotEventPerPhaseVerified:true,
      modelShotsPerAcceptedMatch:observed.shots/accepted,
      realRplShotReferenceAvailable:false,
      role:'STRUCTURAL_DIAGNOSTIC_NOT_REALISM_GATE',
    },
    xg:{status:'UNAVAILABLE_NOT_EXPOSED_BY_V29_SOURCE_TIMELINE',
      total:null,interval95:null},
    realInjuries:{status:'UNAVAILABLE_NO_CLINICAL_DIAGNOSIS',
      total:null,interval95:null},
    externalReference:{status:'UNAVAILABLE_METRIC_COMPATIBLE_LICENSED_RPL',
      matchingSampleSize:null,preregisteredTolerance:null,pass:null},
    sourceEventCoverage:{
      goals:'OPEN_PLAY_ONLY_NO_GENERATED_PENALTIES_OR_OWN_GOALS',
      shots:'V29_SOURCE_TIMELINE_SHOT_EVENTS',
      cards:'SEEDED_INTERNAL_REFEREE_NOT_EXTERNAL_AUTHORITY',
      injuryWithdrawals:'SYNTHETIC_NOT_DIAGNOSED',
      medicalAssessments:'SEEDED_HYPOTHESIS_NOT_DIAGNOSED',
    },
  };
  if (observed.goals !== totalGoals ||
      observed.homeWins+observed.draws+observed.awayWins !== accepted ||
      observed.modelledAssessments !== quickAssessments+offFieldAssessments) {
    throw Error('SOURCE_METRICS_AGGREGATE_MISMATCH');
  }
  return {
    schemaVersion:1,status:'SEEDED_CAUSAL_MEDICAL_REGRESSION_NOT_CALIBRATION',
    sourceEngine:'m1-v29-synthetic-medical-source',start,count,fixtureCount,
    firstFixture,
    totalCases:count * fixtureCount, accepted,rejected,
    fixtureSummaries:summaries,rejectionReasons:rejections,
    generatedFouls,quickAssessments,offFieldAssessments,
    medicalExitEvents,medicalReturnEvents,totalGoals,
    p5Observation,
    deterministicSha256:digest.digest('hex'),
    realFootballReferenceSample:false,
    injuryOccurrenceCalibrated:false,
    physicianOrRefereeAuthorityAuthenticated:false,
  };
}
try {
  process.stdout.write(JSON.stringify(runCorpus()) + '\n');
} catch (error) {
  process.stderr.write('M1_V29_CORPUS_ERROR:' +
    (error instanceof Error ? error.message : 'UNKNOWN') + '\n');
  process.exitCode=1;
}
