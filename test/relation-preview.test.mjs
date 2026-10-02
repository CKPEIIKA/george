import test from 'node:test';
import assert from 'node:assert/strict';
import {groupRelations, polynomialTermCount} from '../web/src/relation-preview.js';

test('preview groups relations by term count and retains original numbers within each group',()=>{
  const rows=[{index:0,termCount:2},{index:1,termCount:1},{index:2},{index:3,termCount:3},{index:4,termCount:1}];
  const original=structuredClone(rows);
  const groups=groupRelations(rows);
  assert.deepEqual(groups.map(g=>g.termCount),[1,2,3,'error']);
  assert.deepEqual(groups.map(g=>g.relations.map(r=>r.index)),[[1,4],[0],[3],[2]]);
  assert.deepEqual(rows,original);
});
test('basis grouping counts top-level terms with rational coefficients and long powers',()=>{
  for(const [source,count] of [['a^2',1],['-12*a^100001',1],['a*b-b*a',2],['a^2+1/2*b^2-c^2',3],['-a*(b+c)+d',2],['+a-b+c',3],['',0]])assert.equal(polynomialTermCount(source),count,source);
});
test('empty previews and separate malformed relations remain available',()=>{
  assert.deepEqual(groupRelations([]),[]);
  assert.deepEqual(groupRelations([{index:0},{index:1}]).map(g=>g.relations.length),[2]);
});
