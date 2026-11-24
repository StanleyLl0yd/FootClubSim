import test from 'node:test';
import assert from 'node:assert/strict';
import {createSyntheticRplScaleCatalog}
  from '../dist/core/synthetic.js';
import {createInitialCareer} from '../dist/core/save.js';
import {deriveM1V188ScorerStandings}
  from '../dist/core/m1-v188-scorers.js';

const catalog=createSyntheticRplScaleCatalog(2026);
const initial=createInitialCareer(catalog,catalog.clubs[0].id,17,
  'source-only-league-scorers');
const [home,away]=catalog.clubs;
const [h1]=home.registeredPlayerIds;
const [a1,a2]=away.registeredPlayerIds;
const fixture={id:'league-1',round:1,
  homeClubId:home.id,awayClubId:away.id};
const future={id:'league-2',round:2,
  homeClubId:away.id,awayClubId:home.id};
const goal=(teamId,playerId,time)=>({
  type:'source',source:{type:'shot',teamId,playerId,
    outcome:'goal',elapsedSeconds:time},
});
const penalty=(teamId,playerId,time)=>({
  type:'penalty',elapsedSeconds:time,
  decision:{kind:'penalty',teamId,playerId,outcome:'scored'},
});
const ownGoal=(beneficiary,playerId,time)=>({
  type:'special',elapsedSeconds:time,
  decision:{kind:'own-goal',teamId:beneficiary,playerId},
});
const entry={
  fixtureId:fixture.id,round:fixture.round,
  source:{prematch:{fixture}},
  result:{
    report:{
      home:{goals:3,shots:1,shotsOnTarget:1,penaltiesTaken:1,xgMilli:300},
      away:{goals:1,shots:1,shotsOnTarget:1,penaltiesTaken:0,xgMilli:250},
    },
    events:[
      goal(home.id,h1,300),penalty(home.id,h1,600),
      ownGoal(home.id,a2,1100),goal(away.id,a1,2200),
    ],
  },
};

test('top scorers expose only played goals, excluding own goals',()=>{
  const before=JSON.stringify(entry);
  const blank=deriveM1V188ScorerStandings(initial,
    [fixture,future],[]);
  assert.deepEqual(blank,{matches:0,totalGoals:0,ownGoals:0,rows:[]});
  const current=deriveM1V188ScorerStandings(initial,
    [fixture,future],[entry]);
  assert.deepEqual(current,{
    matches:1,totalGoals:4,ownGoals:1,
    rows:[
      {playerId:h1,clubId:home.id,goals:2,penaltyGoals:1},
      {playerId:a1,clubId:away.id,goals:1,penaltyGoals:0},
    ],
  });
  assert.equal(JSON.stringify(entry),before);
});

test('scorer standings reject inconsistent source and calendar',()=>{
  const fixtures=[fixture,future];
  assert.equal(deriveM1V188ScorerStandings(initial,[],[entry]),null);
  assert.equal(deriveM1V188ScorerStandings(initial,fixtures,
    [{...entry,fixtureId:'not-scheduled'}]),null);
  assert.equal(deriveM1V188ScorerStandings(initial,fixtures,
    [{...entry,result:{...entry.result,report:{
      ...entry.result.report,home:{...entry.result.report.home,goals:4},
    }}}]),null);
  const wrongPlayer=structuredClone(entry);
  wrongPlayer.result.events[0].source.playerId=a1;
  assert.equal(deriveM1V188ScorerStandings(initial,fixtures,
    [wrongPlayer]),null);
  const wrongOwnGoal=structuredClone(entry);
  wrongOwnGoal.result.events[2].decision.playerId=h1;
  assert.equal(deriveM1V188ScorerStandings(initial,fixtures,
    [wrongOwnGoal]),null);
});
