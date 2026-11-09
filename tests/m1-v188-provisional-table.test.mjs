import test from 'node:test';
import assert from 'node:assert/strict';
import {createSyntheticRplScaleCatalog} from '../dist/core/synthetic.js';
import {createInitialCareer} from '../dist/core/save.js';
import {startM1V188LeagueJournal,prepareM1V188LeagueMatch,
  applyM1V188LeagueMatch} from '../dist/core/m1-v188-league-source-journal.js';
import {deriveM1V188ProvisionalTable}
  from '../dist/core/m1-v188-provisional-table.js';

const catalog=createSyntheticRplScaleCatalog(2026);
const career=createInitialCareer(
  catalog,catalog.clubs[0].id,15,'v188-player-visible-table');
const zero=startM1V188LeagueJournal(career);
if(!zero.ok)throw Error(zero.error);

test('player table starts empty, with all sixteen clubs',()=>{
  const table=deriveM1V188ProvisionalTable(career,zero.journal);
  assert.equal(table?.length,16);
  assert.deepEqual(new Set(table.map(row=>row.clubId)),
    new Set(catalog.clubs.map(club=>club.id)));
  assert.ok(table.every(row=>
    row.played===0&&row.won===0&&row.drawn===0&&
    row.lost===0&&row.points===0));
});

test('played fixture updates both clubs, never mutating saved journal',()=>{
  const proposed=prepareM1V188LeagueMatch(career,zero.journal);
  assert.equal(proposed?.ok,true);
  if(!proposed?.ok)throw Error('No playable fixture');
  const next=applyM1V188LeagueMatch(career,zero.journal,proposed.request);
  assert.equal(next.ok,true);
  if(!next.ok)throw Error(next.error);
  const before=JSON.stringify(next.journal);
  const table=deriveM1V188ProvisionalTable(career,next.journal);
  assert.equal(table?.length,16);
  assert.equal(table.reduce((sum,row)=>sum+row.played,0),2);
  assert.equal(table.reduce((sum,row)=>sum+row.won,0)+
    table.reduce((sum,row)=>sum+row.drawn,0),1);
  assert.equal(table.reduce((sum,row)=>sum+row.lost,0),
    table.reduce((sum,row)=>sum+row.won,0));
  assert.ok(table.every(row=>
    row.played===row.won+row.drawn+row.lost&&
    row.points===row.won*3+row.drawn));
  const home=table.find(row=>row.clubId===proposed.fixture.homeClubId);
  const away=table.find(row=>row.clubId===proposed.fixture.awayClubId);
  assert.ok(home&&away);
  assert.equal(home.goalsFor,proposed.request.result.report.home.goals);
  assert.equal(away.goalsFor,proposed.request.result.report.away.goals);
  assert.equal(table.reduce((sum,row)=>sum+row.goalsFor,0),
    table.reduce((sum,row)=>sum+row.goalsAgainst,0));
  assert.equal(JSON.stringify(next.journal),before);
});

test('provisional table rejects wrong career and inconsistent fixture order',()=>{
  const proposed=prepareM1V188LeagueMatch(career,zero.journal);
  assert.equal(proposed?.ok,true);
  if(!proposed?.ok)throw Error('No playable fixture');
  const next=applyM1V188LeagueMatch(career,zero.journal,proposed.request);
  assert.equal(next.ok,true);
  if(!next.ok)throw Error(next.error);
  assert.equal(deriveM1V188ProvisionalTable(
    {...career,careerId:'other'},next.journal),null);
  const changed=structuredClone(next.journal);
  changed.entries[0].fixtureId='wrong';
  assert.equal(deriveM1V188ProvisionalTable(career,changed),null);
});
