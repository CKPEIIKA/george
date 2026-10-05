import {test} from 'node:test';
import assert from 'node:assert/strict';
import {parseOutputRelation} from '../web/src/output-polynomial.js';
import {parseRelation,typeset} from '../web/src/bergman-syntax.js';
import {algebra} from './support/algebra.mjs';
test('monic result fractions preserve exact numerators and denominators',()=>{
  const terms=parseOutputRelation('y^2+2/3*x^2-4/5*x*y',['x','y']);
  assert.equal(terms[1].coef,'2');assert.equal(terms[1].coefDen,'3');assert.equal(terms[2].sign,-1);
  const a=algebra(['x','y']);assert.deepEqual(a.parse('2/3*x^2').get('AA'),[2n,3n]);
  assert.deepEqual(a.parse('2/3*x^2+1/3*x^2').get('AA'),[1n,1n]);
  assert.throws(()=>parseRelation('2/3*x^2',['x','y']),SyntaxError);
  assert.doesNotMatch(typeset('y^2+2/3*x^2',{lead:true}),/class="raw"/);
});
test('malformed result fractions are rejected',()=>{
  for(const source of ['2/0*x','x/2','1/2/3*x','1/2*x+','1/2*x+garbage'])assert.throws(()=>parseOutputRelation(source,['x']),SyntaxError,source);
});
