import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import {buildJob, validateSettings, monomialPruningAvailable} from '../web/src/bergman-syntax.js';
import {getBackend} from '../web/src/backends.js';
import {parseNativeJob} from '../web/engine/fomkyr/job-adapter.js';
import {FOMKYR_DEFAULTS, FOMKYR_FIELDS, validateFomkyrOptions, writeFomkyrOptions, readFomkyrOptions} from '../web/src/fomkyr-options.js';
import {createShareLink, readShareLink} from '../web/src/share.js';
import {fomkyrSamples, FOMKYR_LHS_DIMENSIONS} from './support/fomkyr-lhs.mjs';
import {publicationAssets} from '../tools/publication-assets.mjs';

const form = {task:'gb', backend:'fomkyr', ring:'noncomm', order:'degleftlex', field:'0',
  vars:['a','b'], rels:['a^2','b^2','b*a-a*b'], maxdeg:'4', maxserdeg:'4',
  nonhomog:'degreewise', nativeWorkers:3, monomialPruning:true};
test('fomkyr ships all shared/unshared variants with exact asset hashes', () => {
  assert.match(getBackend('fomkyr').worker, /fomkyr\/george-worker\.js$/);
  const manifest = JSON.parse(fs.readFileSync('web/engine/fomkyr/build.json'));
  assert.equal(manifest.version,'0.3.0'); assert.equal(manifest.provenance.kernelChanged,false);
  for (const [name, record] of Object.entries(manifest.files)) {
    const bytes = fs.readFileSync('web/engine/fomkyr/' + name);
    assert.equal(bytes.length,record.bytes); assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'),record.sha256,name);
  }
  for (const bits of [32,64]) for (const suffix of ['', '-single']) {
    const name = `fomkyr${bits}${suffix}.wasm`;
    assert.ok(manifest.files[name]);
    assert.deepEqual(fs.readFileSync('web/engine/fomkyr/'+name),fs.readFileSync('vendor/fomkyr-0.3.0/dist/'+name));
  }
});
test('George form controls are authoritative for fomkyr workers, pruning and Hilbert degree', () => {
  for (const monomialPruning of [true,false]) {
    const job = buildJob({...form,monomialPruning,weights:'1 1',lowterms:'safe'});
    assert.equal(job.fomkyrOptions.workers,3); assert.equal(job.fomkyrOptions.monomialPruning,monomialPruning);
    assert.equal(job.fomkyrOptions.hilbertDegree,4); assert.equal(job.outputs.hs,'result.hs');
    assert.doesNotMatch(job.script,/SETREDUCTIVITY/); assert.equal(parseNativeJob(job).target,4);
  }
  assert.equal(monomialPruningAvailable({...form,weights:'1 1'}),true);
  assert.equal(parseNativeJob(buildJob({...form,maxdeg:''})).target,null);
  const long = buildJob({...form,rels:['b^100001-a^100001'],maxdeg:'100001'});
  assert.equal(parseNativeJob(long).fixture.relations[0].degree,100001);
  assert.throws(()=>parseNativeJob(buildJob({...form,rels:['a^4294967294'],maxdeg:'4294967294'})),/workspace budget/);
  assert.equal(buildJob({...form,fomkyrOptions:{hilbert:false}}).outputs.hs,undefined);
});
test('unsupported fomkyr jobs and invalid runtime options are rejected before execution', () => {
  for (const change of [{task:'anick'}, {ring:'comm',order:'deglex'}, {order:'lex'}, {legacy:true},
    {weights:'1 2'}, {weights:'1'}, {rels:['a^2-a']}, {rels:['1']}, {nativeWorkers:33},
    {rels:['4611686018427387904*a']}, {maxdeg:'4294967295'}, {fomkyrOptions:{bits:64}},
    {fomkyrOptions:{batchPairs:513}}, {fomkyrOptions:{scratchMiB:512},memoryMiB:128}]) {
    assert.ok(validateSettings({...form,...change}).length,JSON.stringify(change));
    assert.throws(()=>buildJob({...form,...change}));
  }
  assert.equal(validateSettings({...form,rels:['0'],maxdeg:''}).length,0);
  assert.throws(()=>validateFomkyrOptions({runKey:'arbitrary'}));
});
test('fomkyr runtime settings round-trip in Share without changing old tokens', async () => {
  const fomkyrOptions = {...FOMKYR_DEFAULTS,execution:'single',bits:'64',resume:false,hilbert:false,
    heapReduction:false,batchPairs:0,cachePercent:0,scratchMiB:16,ioMode:'broker'};
  const link = await createShareLink({...form,memoryMiB:512,fomkyrOptions},'https://example.org/george/');
  const decoded = await readShareLink(new URL(link).hash);
  assert.equal(decoded.backend,'fomkyr');assert.deepEqual(decoded.fomkyrOptions,fomkyrOptions);
  assert.equal((await readShareLink('#s=1u'+btoa('["0"]').replace(/=+$/,''))).backend,'standard');
  for (const options of [{bits:64},{execution:'invalid'},{constructor:true},'invalid JSON']) {
    await assert.rejects(createShareLink({backend:'fomkyr',fomkyrOptions:options},'https://example.org/'),/share.invalid/);
  }
});
test('unfinished local fomkyr drafts remain editable without accepting invalid shared settings', () => {
  const nodes = Object.fromEntries(FOMKYR_FIELDS.map(([key]) => ['fomkyr-' + key, {value:'',checked:false}]));
  const root = {getElementById:id=>nodes[id]};
  const draft = {...FOMKYR_DEFAULTS,cachePercent:99,heapThreshold:null,bits:'64'};
  assert.throws(()=>writeFomkyrOptions(draft,root));
  writeFomkyrOptions(draft,root,{strict:false});
  assert.equal(readFomkyrOptions(root).cachePercent,99);
  assert.equal(readFomkyrOptions(root).heapThreshold,null);
  assert.equal(readFomkyrOptions(root).bits,'64');
  assert.equal(buildJob({...form,memoryMiB:128,fomkyrOptions:{execution:'single',scratchMiB:1}}).fomkyrOptions.scratchBytes,1048576);
  assert.throws(()=>buildJob({...form,memoryMiB:128,fomkyrOptions:{scratchMiB:1}}));
});
test('George 0.6 release keeps its experimental label only in the engine chooser', () => {
  const html = fs.readFileSync('web/index.html','utf8');
  assert.match(html,/<title>George 0\.6<\/title>/);
  assert.doesNotMatch(html,/class="release-tag"/);
  const mentions = html.split('\n').filter(line=>/experimental/.test(line));
  assert.equal(mentions.length,1);assert.match(mentions[0],/<option value="fomkyr"/);
  assert.doesNotMatch(fs.readFileSync('README.md','utf8'),/experimental release|0\.6 experimental/);
});
test('fomkyr LHS is reproducible and covers every declared stratum', () => {
  const design = fomkyrSamples();assert.deepEqual(design,fomkyrSamples());
  for (const dimension of FOMKYR_LHS_DIMENSIONS) {
    assert.deepEqual(design.samples.map(row=>Math.floor(row[dimension]*design.count)).sort((a,b)=>a-b),Array.from({length:design.count},(_,i)=>i));
  }
  for (const sample of design.cases) assert.doesNotThrow(()=>buildJob({...form,...sample.form,memoryMiB:128}));
  assert.deepEqual(new Set(design.cases.map(row=>row.rank)),new Set([3,4,5,6]));
});
test('publication checks include the complete fomkyr runtime', () => {
  const base=['index.html','style.css','isolation-worker.js','engine/build.json','engine/worker.js','engine/runner.js','sources/george-source.tar.gz'];
  const files=fs.readdirSync('web/engine/fomkyr').map(name=>'engine/fomkyr/'+name);
  const selected=publicationAssets([...base,...files]);
  for(const file of files)assert.ok(selected.includes(file),file);
});
