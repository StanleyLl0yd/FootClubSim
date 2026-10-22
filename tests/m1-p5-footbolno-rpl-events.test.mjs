import test from 'node:test';
import assert from 'node:assert/strict';
import {gzipSync} from 'node:zlib';
import {inspectFootbolnoRplDevelopment as inspect,
  inspectFootbolnoLocalBytes as inspectBytes,
  parseFootbolnoCsv,FOOTBOLNO_RPL_SOURCE}
  from '../scripts/m1-p5-footbolno-rpl-events.mjs';
const matchHeader=[
  'match_id','league_id','league','season','date_utc','date_msk',
  'time_confirmed','round','home_id','home','away_id','away',
  'home_goals','away_goals','home_pens','away_pens','status',
  'venue','venue_ru','city','city_ru','attendance',
].join(',');
const eventHeader=[
  'match_id','league_id','minute','kind','team_id','player_id','player',
].join(',');
function matches(){
  return [matchHeader,
    '11,235,RPL,2023/24,2023-08-01,2023-08-01,1,1,100,A,200,B,2,1,,,finished,,,,,',
    '12,235,RPL,2023/24,2023-08-02,2023-08-02,1,1,300,C,400,D,0,0,,,finished,,,,,',
    '13,235,RPL,2024/25,2024-08-02,2024-08-02,1,1,500,E,600,F,3,2,,,finished,,,,,',
  ].join('\n')+'\n';
}
function events(){
  return [eventHeader,
    '11,235,13,goal,100,88,Player One',
    '11,235,29,yellow,200,99,Player Two',
    '11,235,90+2,penalty,100,88,Player One',
    '13,235,50,red,500,33,Reserved Player',
    '999,55,38,goal,777,1,Foreign Player',
  ].join('\n')+'\n';
}
const opts={requiredMatches:2};

test('public CC BY source is scoped to real RPL development season only',()=>{
  const x=inspect(matches(),events(),opts);
  assert.equal(x.schemaVersion,1);
  assert.equal(x.source.publisherLicenseClaim,'CC BY 4.0');
  assert.equal(x.source.leagueId,'235');
  assert.equal(x.sample.finishedMatches,2);
  assert.equal(x.sample.sourceSeasonRows,2);
  assert.equal(x.sample.otherSeasonMatchRows,1);
  assert.equal(x.sample.distinctSeasonClubs,4);
  assert.ok(x.sample.sourceSeasonLabels.includes('2023/24'));
  assert.equal(x.sample.processedEventRows,5);
  assert.equal(x.sample.otherLeagueEventRows,1);
  assert.equal(x.sample.matchedSeasonEventRows,3);
  assert.equal(x.sample.matchesWithAnyEvent,1);
  assert.equal(x.sample.matchesWithoutEventRows,1);
  assert.equal(x.observedResultCounts.allGoals,3);
  assert.equal(x.observedResultCounts.homeWins,1);
  assert.equal(x.observedResultCounts.draws,1);
  assert.equal(x.observedEventKindCounts.goal,1);
  assert.equal(x.observedEventKindCounts.penalty,1);
  assert.equal(x.observedEventKindCounts.yellow,1);
  assert.equal(x.observedEventKindCounts.red,0);
  assert.equal(x.perFinishedMatch.yellow,null);
  assert.equal(x.perFinishedMatch.red,null);
  assert.equal(x.perFinishedMatch.goals,1.5);
  assert.equal(x.completeMatchEventCoverageClaim,false);
  assert.equal(x.reservedHoldoutUsed,false);
  assert.equal(x.externalModelAcceptance,null);
  assert.equal(x.unsupported.xg,null);
  assert.equal(x.unsupported.clinicalInjuries,null);
});
test('observed cards may be divided by matches only in toy full-event-coverage input',()=>{
  const complete=events()+'12,235,45,goal,300,44,Player Three\n';
  const x=inspect(matches(),complete,opts);
  assert.equal(x.sample.matchesWithAnyEvent,2);
  assert.equal(x.perFinishedMatch.yellow,0.5);
  assert.equal(x.perFinishedMatch.red,0);
  // This parser cannot prove that a match with some event rows contains
  // *all* events; hence completeMatchEventCoverageClaim remains false.
  assert.equal(x.completeMatchEventCoverageClaim,false);
});
test('byte hash binds exact gzip snapshot without exposing source rows',()=>{
  const m=Buffer.from(matches());
  const e=gzipSync(Buffer.from(events()));
  const x=inspectBytes(m,e,opts);
  assert.match(x.snapshot.matchCsvSha256,/^[a-f0-9]{64}$/);
  assert.match(x.snapshot.eventGzipSha256,/^[a-f0-9]{64}$/);
  assert.equal(x.snapshot.matchesBytes,m.length);
  assert.equal(x.snapshot.eventsGzipBytes,e.length);
  assert.equal(JSON.stringify(x).includes('Reserved Player'),false);
  assert.equal(x.externalModelAcceptance,null);
  assert.throws(()=>inspectBytes(m,Buffer.from('not gzipped'),opts));
  assert.throws(()=>inspectBytes(new Uint8Array(2),e,opts));
});
test('CSV RFC4180 quotes, escaping, multiline and strict header',()=>{
  const header='match_id,league_id,league';
  const raw=header+'\n11,235,"A, B"\n12,235,"say ""hello"""\n';
  const rows=parseFootbolnoCsv(raw,
    ['match_id','league_id','league'],2);
  assert.deepEqual(rows,[
    {match_id:'11',league_id:'235',league:'A, B'},
    {match_id:'12',league_id:'235',league:'say "hello"'},
  ]);
  assert.throws(()=>parseFootbolnoCsv(header+'\n11,235,"bad',[
    'match_id','league_id','league'],2),/UNTERMINATED/);
  assert.throws(()=>parseFootbolnoCsv(header+'\n11,235,"X"extra\n',[
    'match_id','league_id','league'],2),/TRAILING/);
  assert.throws(()=>parseFootbolnoCsv(header+'\n11,235,x\n12,235,y\n',[
    'league_id','match_id','league'],2),/UNEXPECTED/);
});
test('no fabricated valid season, invalid events or invalid denominators',()=>{
  const x=matches().replace('11,235,','11,240,');
  assert.throws(()=>inspect(x,events(),opts),/WRONG_LEAGUE/);
  const duplicated=matches().replace('12,235,','11,235,');
  assert.throws(()=>inspect(duplicated,events(),opts),/BAD_COMPLETED_MATCH/);
  const incomplete=inspect(matches(),events(),{requiredMatches:240});
  assert.equal(incomplete.status,
    'INCOMPLETE_RPL_DEVELOPMENT_SAMPLE_NOT_CALIBRATED');
  assert.equal(incomplete.sample.missingExpectedFinishedMatches,238);
  assert.equal(incomplete.fullSeasonResultCoverage,false);
  assert.equal(incomplete.eligibleForAnyCalibration,false);
  assert.equal(incomplete.externalModelAcceptance,null);
  assert.throws(()=>inspect(matches(),events(),
    {requiredMatches:0}),/EXPECTED_COVERAGE/);
  const wrong=events().replace('11,235,29,yellow,200','11,235,29,yellow,999');
  assert.throws(()=>inspect(matches(),wrong,opts),/INVALID_SEASON_EVENT_ROWS/);
  const bad=events().replace('11,235,13,goal','11,235,13,unknown');
  assert.throws(()=>inspect(matches(),bad,opts),/INVALID_SEASON_EVENT_ROWS/);
});

test('season label filter accepts digits but rejects control characters',()=>{
  const x=inspect(matches(),events(),opts);
  assert.equal(x.sample.malformedSeasonLabelRows,0);
  assert.equal(x.sample.finishedMatches,2);
  assert.ok(x.sample.sourceSeasonLabels.includes('2024/25'));
  const bad=matches().replaceAll('2023/24','2023\u0001/24');
  const y=inspect(bad,events(),opts);
  assert.equal(y.sample.malformedSeasonLabelRows,2);
  assert.equal(y.sample.finishedMatches,0);
  assert.equal(y.eligibleForAnyCalibration,false);
});
