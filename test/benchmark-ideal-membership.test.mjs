import test from 'node:test';
import assert from 'node:assert/strict';
import {sameRationalPolynomial,mutualIdealMembership} from '../tools/benchmark-ideal-membership.mjs';
import {algebra} from './support/algebra.mjs';

test('rational polynomial equality includes every word and coefficient',()=>{
 const f=new Map([['A',[1n,2n]],['B',[-1n,1n]]]);
 assert.ok(sameRationalPolynomial(f,new Map([['B',[-1n,1n]],['A',[2n,4n]]])));
 assert.ok(!sameRationalPolynomial(f,new Map([['A',[1n,2n]],['B',[1n,1n]]])));
 assert.ok(!sameRationalPolynomial(f,new Map([['A',[1n,2n]],['C',[-1n,1n]]])));
});

test('identical polynomials prove both ideal containments without NF',()=>{
 const a=algebra(['x','y']),candidate=['x','y'].map(a.parse),oracle=['y','x'].map(a.parse);
 a.nf=()=>{throw new Error('Identical polynomials need no reduction');};
 assert.deepEqual(mutualIdealMembership(candidate,oracle,a),{identicalPolynomials:4,normalFormChecks:0});
});

test('different tails still require exact ideal membership checks',()=>{
 const a=algebra(['x','y']),candidate=['x','y-x'].map(a.parse),oracle=['x','y'].map(a.parse);
 assert.deepEqual(mutualIdealMembership(candidate,oracle,a),{identicalPolynomials:2,normalFormChecks:2});
 assert.throws(()=>mutualIdealMembership(['x','y-x'].map(a.parse),['x','y-1'].map(a.parse),a),/Candidate belongs to Singular ideal/);
});

test('normal-form rule metadata is refreshed on each call',()=>{
 const a=algebra(['x','y']),basis=[a.parse('y')];
 assert.equal(a.nf(a.parse('y'),basis).size,0);
 basis[0]=a.parse('x');
 assert.equal(a.nf(a.parse('y'),basis).size,1);
 a.put(basis[0],'B',a.q(1));
 assert.equal(a.nf(a.parse('x+y'),basis).size,0);
});
