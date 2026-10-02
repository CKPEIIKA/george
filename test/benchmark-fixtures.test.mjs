import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import {normalWordCounts} from './support/normal-word-counts.mjs';
import {randomBigForm} from './support/random-big-form.mjs';
import {randomGrowingForm} from './support/random-growing-form.mjs';
import {algebra} from './support/algebra.mjs';
import {readInputFile,parseRelation} from '../web/src/bergman-syntax.js';

test('Independent normal-word DP handles suffix failures, empty ideals and large counts', () => {
  assert.deepEqual(normalWordCounts(2,[],4),['1','2','4','8','16']);
  assert.deepEqual(normalWordCounts(2,[''],3),['0','0','0','0']);
  for (const words of [['AA','BB'],['ABA','BA'],['AB','BA','BBA'],['AAA','AAB','ABAB']]) {
    const a = algebra(['a','b']);
    const gb = words.map(w => new Map([[w,[1n,1n]]]));
    assert.deepEqual(normalWordCounts(2,words,7),a.hilbert(gb,7).map(String));
  }
  assert.equal(normalWordCounts(15,[],30)[30],(15n**30n).toString());
});
test('Random big fixture is reproducible, quadratic and has 15 generators / 100 relations', () => {
  const fixture = randomBigForm();
  assert.deepEqual(fixture,JSON.parse(fs.readFileSync('test/fixtures/random-big-form.json')));
  assert.notEqual(randomBigForm(42).inputText,fixture.inputText);
  const {vars,rels}=readInputFile('(ALGFORMINPUT)\n'+fixture.inputText);
  assert.equal(vars.length,15);assert.equal(rels.length,100);assert.equal(new Set(rels).size,100);
  const sizes=rels.map(source=>parseRelation(source,vars).length);
  assert.deepEqual([1,2,3].map(size=>sizes.filter(n=>n===size).length),[15,45,40]);
  for (const source of rels) for (const term of parseRelation(source,vars))
    assert.equal(term.factors.reduce((n,f)=>n+f.e,0),2);
});
test('FK6 regression anchors cover all bounds 1–9 and the exact Hilbert prefix', () => {
  const fixture=JSON.parse(fs.readFileSync('test/fixtures/fk6-degree-prefixes.json'));
  const coefficients=['1','15','125','765','3831','16605','64432','228855','755777','2347365'];
  assert.deepEqual(fixture.degrees.map(row=>row.degree),[1,2,3,4,5,6,7,8,9]);
  for(const row of fixture.degrees)assert.deepEqual(row.hilbert,coefficients.slice(0,row.degree+1));
});
test('Matched regression fixture has n FK6 and n random cases within the oracle cap',()=>{
  for(const [file,degreeBound] of [['fk6-matrix.json',6],['fk6-growing-matrix.json',8]]){
    const matrix=JSON.parse(fs.readFileSync('test/fixtures/'+file));
    assert.equal(matrix.degreeBound,degreeBound);assert.equal(matrix.timeLimitSeconds,120);
    for(const input of matrix.inputFiles){
      assert.equal(crypto.createHash('sha256').update(fs.readFileSync(input.file)).digest('hex'),input.sha256);
      assert.deepEqual(matrix.expected.filter(row=>row.id===input.id).map(row=>row.degree),Array.from({length:degreeBound},(_,i)=>i+1));
    }
    if(degreeBound===8)for(let degree=1;degree<=degreeBound;degree++){
      const original=matrix.expected.find(row=>row.id==='fk6'&&row.degree===degree);
      const scaled=matrix.expected.find(row=>row.id==='random-fk6'&&row.degree===degree);
      assert.equal(original.rules,scaled.rules);assert.deepEqual(original.hilbert,scaled.hilbert);
      assert.equal(original.leadingWordsSha256,scaled.leadingWordsSha256);
    }
  }
  const matrix=JSON.parse(fs.readFileSync('test/fixtures/fk6-matrix.json'));
  assert.deepEqual(matrix.expected.find(row=>row.id==='random-fk6'&&row.degree===6).hilbert,['1','15','125','522','14','1','0']);
});
test('Growing random form uses reproducible invertible scalings and preserves monomial supports',()=>{
  const base=JSON.parse(fs.readFileSync('test/fixtures/fomin-kirillov-user.json'));
  const fixture=randomGrowingForm(base.inputText);
  assert.deepEqual(fixture,JSON.parse(fs.readFileSync('test/fixtures/random-fk6-growing.json')));
  assert.notEqual(fixture.inputText,base.inputText);assert.notEqual(randomGrowingForm(base.inputText,42).inputText,fixture.inputText);
  const {vars,rels}=readInputFile('(ALGFORMINPUT)\n'+base.inputText);
  const changed=readInputFile('(ALGFORMINPUT)\n'+fixture.inputText);
  assert.deepEqual(changed.vars,vars);assert.equal(changed.rels.length,100);
  for(let index=0;index<rels.length;index++){
    const original=parseRelation(rels[index],vars),scaled=parseRelation(changed.rels[index],vars);
    assert.deepEqual(scaled.map(t=>t.factors),original.map(t=>t.factors));
    const expected=original.map(t=>BigInt(t.sign)*BigInt(t.coef)*t.factors.reduce((p,f)=>p*BigInt(fixture.scalings[f.v])**BigInt(f.e),1n));
    const actual=scaled.map(t=>BigInt(t.sign)*BigInt(t.coef));
    for(let term=0;term<actual.length;term++)assert.equal(actual[term]*expected[0],actual[0]*expected[term]);
  }
});
