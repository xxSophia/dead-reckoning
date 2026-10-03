const test=require('node:test'),assert=require('node:assert/strict');const {generateCrisis,initialState,reduce}=require('../src/game');
test('generator is deterministic',()=>assert.deepEqual(generateCrisis('abc',5),generateCrisis('abc',5)));
test('depth changes generated crisis',()=>assert.notDeepEqual(generateCrisis('abc',1),generateCrisis('abc',2)));
test('correct action advances without damage',()=>{let s=reduce(initialState('x'),{type:'START'}),h=s.hull,d=s.depth;s=reduce(s,{type:'SUBMIT',actions:s.round.solution});assert.equal(s.depth,d+1);assert.equal(s.hull,h)});
test('wrong action damages hull',()=>{let s=reduce(initialState('x'),{type:'START'});s=reduce(s,{type:'SUBMIT',actions:['SURFACE']});assert.equal(s.hull,75)});
test('ten correct crises wins',()=>{let s=reduce(initialState('win'),{type:'START'});while(s.status==='playing')s=reduce(s,{type:'SUBMIT',actions:s.round.solution});assert.equal(s.status,'won');assert.equal(s.depth,10)});
