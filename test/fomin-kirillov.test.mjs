import test from 'node:test';
import assert from 'node:assert/strict';
import {fominKirillov, fominKirillovSamples, FK_DIMENSIONS} from './support/fomin-kirillov.mjs';
import {buildJob, parseRelation, isHomogeneous} from '../web/src/bergman-syntax.js';

test('FK presentations include every square, disjoint pair and both triangle orientations',()=>{
  const counts = [[3,5],[6,17],[10,45],[15,100]];
  for(let n=3;n<=6;n++) {
    const p=fominKirillov(n);
    assert.deepEqual([p.vars.length,p.rels.length],counts[n-3]);
    assert.equal(p.relationCounts.squares,n*(n-1)/2);
    assert.equal(p.relationCounts.triangleRelations,n*(n-1)*(n-2)/3);
    assert.equal(p.relationCounts.disjointCommutators,n*(n-1)*(n-2)*(n-3)/8);
    for(const relation of p.rels) {
      const parsed=parseRelation(relation,p.vars);assert.ok(isHomogeneous(parsed,new Map()));
      assert.ok(parsed.every(t=>t.factors.reduce((s,f)=>s+f.e,0)===2));
    }
  }
  assert.deepEqual(fominKirillov(3).rels.slice(-2),['x_1_2*x_2_3-x_2_3*x_1_3-x_1_3*x_1_2','x_2_3*x_1_2-x_1_3*x_2_3-x_1_2*x_1_3']);
});

test('FK LHS is reproducible, stratified, varied and bounded at low degree',()=>{
  const a=fominKirillovSamples();assert.deepEqual(a,fominKirillovSamples());
  assert.notDeepEqual(a,fominKirillovSamples(16,1));
  for(const dimension of FK_DIMENSIONS)assert.deepEqual(a.samples.map(r=>Math.floor(r[dimension]*16)).sort((x,y)=>x-y),Array.from({length:16},(_,i)=>i));
  assert.deepEqual([...new Set(a.cases.map(c=>c.rank))].sort(),[3,4,5,6]);
  assert.deepEqual([...new Set(a.cases.map(c=>c.form.modulus))].sort((x,y)=>x-y),[0,2,3,5,7]);
  for(const c of a.cases) {
    assert.ok(buildJob(c.form).script,c.id);
    assert.ok(Number(c.form.maxdeg)<= (c.rank===6?3:4));
  }
  for(const key of ['reverseVars','legacy','monomialPruning'])assert.deepEqual([...new Set(a.cases.map(c=>c.form[key]))].sort(),[false,true]);
  assert.throws(()=>fominKirillovSamples(9),/multiple of 8/);
});
