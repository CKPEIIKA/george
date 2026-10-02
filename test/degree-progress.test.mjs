import test from 'node:test';
import assert from 'node:assert/strict';
import {degreeProgress,degreeLabel} from '../web/src/degree-progress.js';

test('degree 11 start means completed through 10 for either requested bound',()=>{
  const start=degreeProgress({type:'degree-start',degree:11,completedThroughDegree:10,currentDegree:0,basisSize:2155});
  assert.equal(start.degree,11);assert.equal(start.completed,false);assert.equal(start.completedThroughDegree,10);
  assert.equal(degreeLabel(start,12),'11 … / 12');assert.equal(degreeLabel(start,11),'11 … / 11');
  assert.equal(degreeLabel(null,12),'— / 12');
});
test('resuming degree 10 never marks degree 11 complete',()=>{
  const restored=degreeProgress({type:'degree',completedThroughDegree:10,source:'checkpoint'});
  assert.equal(degreeLabel(restored,12),'10 ✓ / 12');
  const started=degreeProgress({type:'degree-start',degree:11,completedThroughDegree:10},restored);
  const working=degreeProgress({type:'progress',currentDegree:11,completedThroughDegree:10,pairs:123,reductions:456,basisSize:2156},started);
  assert.equal(working.completed,false);assert.equal(working.completedThroughDegree,10);
  assert.equal(working.pairs,123);assert.equal(working.reductions,456);
  assert.equal(degreeLabel(working,12),'11 … / 12');
});
test('completed basis, saving checkpoint, Hilbert counting and export are distinct',()=>{
  for(const phase of ['checkpoint','hilbert','export']){
    const state=degreeProgress({type:'phase',phase,completedThroughDegree:11,currentDegree:0,basisSize:3000});
    assert.equal(state.completed,true);assert.equal(state.degree,11);assert.equal(state.phase,phase);
    assert.equal(degreeLabel(state,11),'11 ✓ / 11');
  }
  const state=degreeProgress({type:'degree',completedThroughDegree:11,currentDegree:0});
  assert.equal(state.completed,true);assert.equal(state.completedThroughDegree,11);
});
test('unrelated or invalid events cannot change degree; Anick starts its own phase',()=>{
  for(const event of [{type:'memory',bytes:123},{type:'progress'},{type:'degree-start',degree:NaN},{type:'phase',phase:'unknown'}])
    assert.equal(degreeProgress(event),null);
  const basis=degreeProgress({type:'degree',completedThroughDegree:10,pairs:100});
  const anick=degreeProgress({type:'degree-start',phase:'anick',degree:3},basis);
  assert.equal(anick.completedThroughDegree,2);assert.equal(anick.pairs,undefined);
  const next=degreeProgress({type:'degree-start',phase:'anick',degree:4},anick);
  assert.equal(next.completedThroughDegree,3);
});
