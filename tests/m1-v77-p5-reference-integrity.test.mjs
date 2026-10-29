import test from 'node:test';
import assert from 'node:assert/strict';
import reference from '../data/rpl-2025-26-p5-reference.json' with {type:'json'};

test('v77 pinned external aggregate conserves full RPL 2025/26 season',()=>{
  assert.equal(reference.schemaVersion,1);
  assert.equal(reference.season,'2025/26');
  assert.equal(reference.stage,'regular-season-only');
  assert.equal(reference.sourceAttribution.wikipediaRevision,'1380192814');
  const teams=reference.clubs;
  const summary=reference.reference;
  assert.equal(teams.length,16);
  assert.equal(summary.teamCount,teams.length);
  const sum=key=>teams.reduce((value,team)=>value+team[key],0);
  assert.equal(sum('played'),summary.matches*2);
  assert.equal(sum('wins'),sum('losses'));
  assert.equal(sum('draws'),summary.drawnMatches*2);
  assert.equal(sum('wins')+sum('draws')+sum('losses'),
    summary.matches*2);
  assert.equal(sum('goalsFor'),sum('goalsAgainst'));
  assert.equal(sum('goalsFor'),summary.goalsAllTypes);
  assert.equal(summary.matches,240);
  assert.equal(summary.goalsAllTypes,609);
  assert.equal(summary.drawnMatches,67);
  assert.equal(summary.homeWins,109);
  assert.equal(summary.awayWins,64);
  assert.equal(summary.scorelessFullTimeMatches,15);
  assert.equal(summary.homeWins+summary.awayWins+summary.drawnMatches,
    summary.matches);
  assert.ok(summary.scorelessFullTimeMatches<=summary.drawnMatches);
  for(const team of teams){
    assert.equal(team.played,30);
    assert.equal(team.wins+team.draws+team.losses,team.played);
    for(const key of ['wins','draws','losses','goalsFor','goalsAgainst']){
      assert.ok(Number.isSafeInteger(team[key])&&team[key]>=0);
    }
  }
});

test('v77 external data cannot masquerade as comparable P5 source metrics',()=>{
  const x=reference.reference;
  assert.match(x.goalsScope,/penalties.*own goals.*open-play/);
  for(const unavailable of ['shots','shotsOnTarget',
    'openPlayGoals','xG','cards','injuries']){
    assert.equal(x[unavailable],null,unavailable+' must remain unknown');
  }
  const totalRate=x.goalsAllTypes/x.matches;
  assert.equal(totalRate,2.5375);
  assert.equal(x.drawnMatches/x.matches,67/240);
  assert.equal(x.homeWins/x.matches,109/240);
  assert.equal(x.awayWins/x.matches,64/240);
  assert.equal(x.scorelessFullTimeMatches/x.matches,15/240);
  // Never compare open-play-only synthetic goals directly to total goals.
  assert.equal(x.openPlayGoals,null);
});
