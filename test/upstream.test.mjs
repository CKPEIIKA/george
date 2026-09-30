import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {buildJob} from '../web/src/bergman-syntax.js';
import {algebra} from './support/algebra.mjs';

test('imported upstream fixtures retain provenance and build all ninety field cases',()=>{
  const fixture=JSON.parse(fs.readFileSync('test/fixtures/upstream-cases.json','utf8'));
  assert.equal(fixture.version,1);assert.equal(fixture.cases.length,30);
  assert.equal(fixture.sources.length,17);
  assert.equal(new Set(fixture.cases.map(c=>c.id)).size,30);
  const sources=new Set(fixture.sources.map(s=>s.id));
  for(const s of fixture.sources){assert.match(s.revision,/^[a-f0-9]{40}$/);assert.match(s.sha256,/^[a-f0-9]{64}$/);assert.ok(s.license);}
  let jobs=0;
  for(const c of fixture.cases){
    assert.ok(sources.has(c.source));assert.ok(['complete','degree-bound'].includes(c.scope));
    for(const p of c.fields){
      const job=buildJob({task:'gb',ring:c.comm?'comm':'noncomm',order:c.comm?'deglex':'degleftlex',
        field:p?'p':'0',modulus:p,vars:c.vars,rels:c.rels,maxdeg:c.maxdeg,weights:c.weights?.join(' '),lowterms:'safe'});
      assert.ok(job.script);jobs++;
    }
  }
  assert.equal(jobs,90);
});

test('independent checker counts weighted normal words and the zero quotient',()=>{
  const a=algebra(['x','y'],false,0,[2,3]);
  const basis=[a.parse('y*x-x*y'),a.parse('x^2'),a.parse('y^2')].map(a.monic);
  assert.ok(a.certify(basis,basis)>0);
  assert.deepEqual(a.hilbert(basis,7),[1,0,1,1,0,1,0,0]);
  assert.deepEqual(a.hilbert([a.parse('1')],7),Array(8).fill(0));
});
