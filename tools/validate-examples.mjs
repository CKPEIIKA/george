import fs from 'node:fs';
import assert from 'node:assert/strict';
import {EXAMPLES} from '../web/src/examples.js';
import {buildJob,exampleForm,parseBasis} from '../web/src/bergman-syntax.js';
import {wasmRuntime} from '../test/support/regression.mjs';
import {algebra} from '../test/support/algebra.mjs';
const out=`build/validation/examples-${Date.now()}`;fs.mkdirSync(out,{recursive:true});const report=[];
for(const ex of EXAMPLES){
 const job=buildJob(exampleForm(ex)),rt=await wasmRuntime(),r=rt.run(job);
 for(const [kind,file] of Object.entries(job.outputs)){
  fs.writeFileSync(`${out}/${ex.id}.${kind}`,r.files[file]);
  assert.ok(r.files[file].trim(),`${ex.id}/${kind}`);
  if(ex.id==='leftmodbtn'&&kind==='gb'){
    // The older preset reference has a trailing Done marker; a fresh
    // bounded module session omits it. Compare its polynomial content.
    const a=algebra(exampleForm(ex).vars);
    const canonical=s=>a.basis(s).map(f=>JSON.stringify([...f].sort(([u],[v])=>u.localeCompare(v)),(_,v)=>typeof v==='bigint'?String(v):v)).sort();
    assert.deepEqual(canonical(r.files[file]),canonical(ex.out[kind]));
  }else if(kind!=='resolution') assert.equal(r.files[file],ex.out[kind],`${ex.id}/${kind}`);
 }
 assert.ok(parseBasis(r.files[job.outputs.gb]).groups.length,ex.id);
 report.push({id:ex.id,task:ex.task,outputs:Object.keys(job.outputs),elapsedMs:r.elapsedMs});console.log(ex.id,'PASS');
}
fs.writeFileSync(`${out}/report.json`,JSON.stringify(report,null,2));
