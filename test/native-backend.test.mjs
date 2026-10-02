import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import {buildJob, validateSettings} from '../web/src/bergman-syntax.js';
import {getBackend, validMemoryMiB} from '../web/src/backends.js';
import {parseNativeJob} from '../web/engine/native/job-adapter.js';
import {createShareLink, readShareLink} from '../web/src/share.js';

const form={task:'gb',backend:'native',ring:'noncomm',order:'degleftlex',field:'0',
  vars:['a','b'],rels:['a^2','b^2','b*a-a*b'],maxdeg:'4',nonhomog:'degreewise',nativeWorkers:3};

test('Native NC uses its own worker, modules and recorded asset hashes',()=>{
  const backend=getBackend('native');assert.equal(backend.kind,'native');assert.match(backend.worker,/native\/worker.js$/);
  const manifest=JSON.parse(fs.readFileSync(new URL('../web/engine/native/build.json',import.meta.url)));
  assert.equal(manifest.backend,'native');assert.equal(manifest.provenance.kernelChanged,false);
  for(const [name,expected] of Object.entries(manifest.files)){
    const bytes=fs.readFileSync(new URL('../web/engine/native/'+name,import.meta.url));
    assert.equal(bytes.length,expected.bytes);assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'),expected.sha256,name);
  }
  assert.equal(validMemoryMiB(14304,'native'),true);assert.equal(validMemoryMiB(14305,'native'),false);
  assert.equal(validMemoryMiB(0,'native'),false);assert.equal(validMemoryMiB(4096,'native'),true);
});

test('current George jobs retain native coefficient/order semantics and worker settings',()=>{
  const job=buildJob(form),parsed=parseNativeJob(job);
  assert.equal(job.memoryMiB,512);assert.equal(job.nativeOptions.workers,3);
  assert.equal(parsed.target,4);assert.equal(parsed.modulus,0);assert.deepEqual(parsed.fixture.variables,['a','b']);
  assert.deepEqual(parsed.fixture.relations[2].terms.map(t=>t.word),[[1,0],[0,1]]);
  assert.equal(parseNativeJob(buildJob({...form,field:'p',modulus:'7',reverseVars:true})).modulus,7);
  for(const extra of ['(COMMIFY)','(SETWEIGHTS 1 2)','(EVAL FOO)'])assert.throws(()=>parseNativeJob({...job,script:job.script+'\n'+extra}));
});

test('native restrictions reject unsupported jobs before worker execution',()=>{
  for(const change of [{task:'anick'},{ring:'comm',order:'deglex'},{legacy:true},{weights:'1 2'},
    {maxdeg:''},{maxdeg:'21'},{rels:['a^2-a']},{rels:['1']},{rels:['4611686018427387904*a']},
    {vars:Array.from({length:17},(_,i)=>'x'+i),rels:['x0^2']},{nativeWorkers:33},{nativeWorkers:1.5}]) {
    assert.ok(validateSettings({...form,...change}).length,JSON.stringify(change));assert.throws(()=>buildJob({...form,...change}));
  }
  assert.equal(validateSettings({...form,rels:['a^3'],maxdeg:'20'}).length,0);
  assert.equal(buildJob({...form,nativeWorkers:0}).nativeOptions.workers,undefined);
});

test('worker count uses bit 31 without changing old Share links',async()=>{
  for(const nativeWorkers of [0,1,3,4,32]){
    const link=await createShareLink({backend:'native',nativeWorkers,memoryMiB:512,maxdeg:'7'},'https://example.org/george/');
    const decoded=await readShareLink(new URL(link).hash);assert.equal(decoded.nativeWorkers,nativeWorkers);assert.equal(decoded.backend,'native');
  }
  const old=await readShareLink('#s=1u'+btoa('["0"]').replace(/=+$/,''));assert.equal(old.nativeWorkers,0);
  for(const nativeWorkers of [-1,33,0.5,'4'])await assert.rejects(createShareLink({nativeWorkers},'https://example.org/'),/share.invalid/);
});
