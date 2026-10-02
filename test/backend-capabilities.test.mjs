import test from 'node:test';
import assert from 'node:assert/strict';
import {QUADRATIC_BASIS_CAPABILITIES, backendAllows, backendSettingsErrors, backendRelationErrors} from '../web/src/backend-capabilities.js';
import {parseRelation} from '../web/src/bergman-syntax.js';
const specialized={capabilities:QUADRATIC_BASIS_CAPABILITIES};

test('a specialized engine declares its supported options independently of Bergman',()=>{
  for(const backend of ['standard','optimized','compiled','memory64']) {
    assert.ok(backendAllows(backend,'task','anick'));assert.ok(backendAllows(backend,'legacy',true));
  }
  assert.ok(backendAllows(specialized,'task','gb'));
  for(const [key,value] of [['task','anick'],['ring','comm'],['order','elim'],['weights','1 2'],['legacy',true],['monomialPruning',true]]) {
    assert.equal(backendAllows(specialized,key,value),false);
    assert.ok(backendSettingsErrors({[key]:value},specialized).length);
  }
  assert.deepEqual(backendSettingsErrors({task:'gb',ring:'noncomm',order:'degleftlex',legacy:false,weights:''},specialized),[]);
  assert.equal(backendAllows(specialized,'legacy','false'),false);
  assert.ok(backendSettingsErrors({legacy:'false'},specialized).length);
});

test('future profiles can enable series, fields and arbitrary setting choices',()=>{
  const backend={capabilities:{choices:{task:['gb','ncpbh'],field:['p'],outmode:['ALG','MACAULAY']},fixedSettings:{legacy:false}}};
  assert.ok(backendAllows(backend,'task','ncpbh'));assert.ok(backendAllows(backend,'outmode','MACAULAY'));
  assert.equal(backendAllows(backend,'field','0'),false);assert.ok(backendAllows(backend,'field','p'));
  assert.equal(backendAllows(backend,'legacy',true),false);
});

test('relation restrictions are enforced independently of disabled UI controls',()=>{
  const parse=s=>[parseRelation(s,['a','b'])];
  assert.deepEqual(backendRelationErrors(parse('a*b-b*a'),specialized),[]);
  assert.ok(backendRelationErrors(parse('a^2-a'),specialized).length);
  assert.ok(backendRelationErrors(parse('a^3'),specialized).length);
  assert.deepEqual(backendRelationErrors(parse('a^3'),{capabilities:{relationDegrees:[2,3]}}),[]);
});
