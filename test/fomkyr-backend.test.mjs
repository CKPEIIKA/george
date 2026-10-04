import test from 'node:test';
import {planMemory} from '../web/engine/fomkyr/memory-policy.js';
import {VERSION} from '../web/engine/fomkyr/storage.js';
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
import {automaticWorkers,computeWorkers} from '../web/engine/fomkyr/worker-count.js';
import {WASM_COMPILER} from '../web/engine/fomkyr/build-info.js';

const form = {task:'gb', backend:'fomkyr', ring:'noncomm', order:'degleftlex', field:'0',
  vars:['a','b'], rels:['a^2','b^2','b*a-a*b'], maxdeg:'4', maxserdeg:'4',
  nonhomog:'degreewise', nativeWorkers:3, monomialPruning:true,fomkyrOptions:{hilbert:true}};
test('automatic workers scale with available CPU threads up to the engine limit',()=>{
  for(const [reported,selected] of [[1,1],[2,1],[6,5],[8,7],[16,15],[64,32],[0,1],[null,1],[Infinity,1]])assert.equal(automaticWorkers(reported),selected);
  assert.equal(computeWorkers(0,{hardwareConcurrency:8}),7);
  assert.equal(computeWorkers(32,{hardwareConcurrency:8}),32);
  assert.equal(computeWorkers(0,{hardwareConcurrency:8,shared:false}),1);
  assert.equal(computeWorkers(8,{hardwareConcurrency:8,execution:'single'}),1);
});
test('fomkyr ships all shared/unshared variants with exact asset hashes', () => {
  assert.match(getBackend('fomkyr').worker, /fomkyr\/george-worker\.js$/);
  const manifest = JSON.parse(fs.readFileSync('web/engine/fomkyr/build.json'));
  assert.equal(manifest.version,VERSION);
  const inventory=JSON.parse(fs.readFileSync('fomkyr/SOURCE.json'));
  const kernel=inventory.retainedBuildAndTestFiles['src/kernel.c'];
  assert.equal(crypto.createHash('sha256').update(fs.readFileSync('fomkyr/src/kernel.c')).digest('hex'),kernel.sha256);
  assert.equal(inventory.kernelChanged,kernel.sha256!==(kernel.originalSha256??kernel.sha256));
  assert.equal(manifest.provenance.kernelChanged,inventory.kernelChanged);
  assert.equal(manifest.compiler.pgo,WASM_COMPILER.pgo);
  if(WASM_COMPILER.pgo){
    const profile=JSON.parse(fs.readFileSync('fomkyr/tools/wasm-profile.json'));
    assert.equal(manifest.compiler.profileSha256,profile.profileSha256);
    assert.equal(crypto.createHash('sha256').update(fs.readFileSync('fomkyr/tools/wasm-profile.proftext')).digest('hex'),profile.profileSha256);
    for(const [name,expected] of Object.entries(profile.sourceHashes))
      assert.equal(crypto.createHash('sha256').update(fs.readFileSync('fomkyr/'+name)).digest('hex'),expected,name);
    assert.deepEqual(profile.compatibleTargets,manifest.variants);
  }
  for (const [name, record] of Object.entries(manifest.files)) {
    const bytes = fs.readFileSync('web/engine/fomkyr/' + name);
    assert.equal(bytes.length,record.bytes); assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'),record.sha256,name);
  }
  for (const bits of [32,64]) for (const suffix of ['', '-single']) {
    const name = `fomkyr${bits}${suffix}.wasm`;
    assert.ok(manifest.files[name]);
    assert.deepEqual(fs.readFileSync('web/engine/fomkyr/'+name),fs.readFileSync('fomkyr/dist/'+name));
  }
});
test('shared row reserve settings preserve automatic, disabled and explicit budgets', async () => {
  assert.equal(buildJob(form).fomkyrOptions.rowReserveBytes,undefined);
  for(const rowReserveMiB of [0,16,128]) {
    const options={memoryPolicy:'manual',rowReserveMiB,radixHeap:false,reserveInPlace:false};
    const decoded=await readShareLink(new URL(await createShareLink({...form,memoryMiB:512,fomkyrOptions:options},'https://example.org/')).hash);
    const actual=buildJob({...form,memoryMiB:512,fomkyrOptions:decoded.fomkyrOptions}).fomkyrOptions;
    assert.equal(actual.rowReserveBytes,rowReserveMiB*1048576);
    assert.equal(actual.radixHeap,false);assert.equal(actual.reserveInPlace,false);
  }
  for(const rowReserveMiB of [-1,0.5,512,'16'])assert.throws(()=>buildJob({...form,memoryMiB:512,fomkyrOptions:{memoryPolicy:'manual',rowReserveMiB}}));
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
test('new fomkyr jobs default to pruning, disk, resume and heap with optional counting off',()=>{
  const job=buildJob({...form,monomialPruning:undefined,nativeWorkers:0,fomkyrOptions:undefined});
  const options=job.fomkyrOptions;
  assert.equal(options.monomialPruning,true);assert.equal(options.spill,true);assert.equal(options.resume,'auto');
  assert.equal(options.heapReduction,true);assert.equal(options.hilbert,false);assert.equal(options.cachePercent,12);
  for(const key of ['wordMatcher','chainCriterion','eagerPruning','quadraticRewrite','costScheduling','progress','rationalHeap','rationalRewrites','compiledRewrites'])assert.equal(options[key],true);
  assert.equal(options.rewriteDegree,4);assert.equal(options.rewriteSupport,8);
  assert.equal(options.rewriteBudgetBytes,undefined);assert.equal(options.sharedReducerCacheBytes,undefined);
  assert.equal(options.wordCacheEntries,256);assert.equal(options.progressIntervalMs,1000);assert.equal(options.matcherBudgetBytes,undefined);
  assert.equal(job.memoryMiB,3584);assert.equal(options.arithmeticMode,'exact');
  assert.equal(options.scheduler,'cooperative');assert.equal(options.quantumMs,250);
  assert.equal(options.lookahead,128);assert.equal(options.radixMaxCache,true);
  assert.equal(options.workers,undefined);assert.equal(options.batchPairs,128);assert.equal(options.memoryPolicy,'auto');assert.equal(options.scratchBytes,undefined);
  assert.equal(planMemory(job.memoryMiB*1048576,3,options).ordinaryScratchBytes,2048*1048576);
  assert.equal(buildJob({...form,fomkyrOptions:{batchPairs:null}}).fomkyrOptions.batchPairs,128);
  for(const memoryMiB of [128,256,512,1024,2048]) {
    const small=buildJob({...form,memoryMiB,fomkyrOptions:{}}).fomkyrOptions;
    const workspace=planMemory(memoryMiB*1048576,3,small);
    assert.ok(workspace.ordinaryScratchBytes<memoryMiB*1048576);assert.ok(workspace.ordinaryScratchBytes>=32*1048576);
  }
  assert.equal(job.outputs.hs,undefined);
  assert.equal(buildJob({...form,monomialPruning:false,fomkyrOptions:{hilbert:true}}).fomkyrOptions.monomialPruning,false);
});
test('large-coefficient optimizers default on and round-trip explicit ablations',async()=>{
  for(const key of ['bigRationalHeap','fastBigDivision','growingRationalHeap','radixHeap','reserveInPlace']) {
    assert.equal(buildJob(form).fomkyrOptions[key],true);
    const options={...FOMKYR_DEFAULTS,[key]:false};
    const decoded=await readShareLink(new URL(await createShareLink({...form,fomkyrOptions:options},'https://example.org/')).hash);
    assert.equal(decoded.fomkyrOptions[key],false);
    assert.equal(buildJob({...form,fomkyrOptions:decoded.fomkyrOptions}).fomkyrOptions[key],false);
    assert.throws(()=>validateFomkyrOptions({[key]:'false'}));
  }
});
test('unsupported fomkyr jobs and invalid runtime options are rejected before execution', () => {
  for (const change of [{task:'anick'}, {ring:'comm',order:'deglex'}, {order:'lex'}, {legacy:true},
    {weights:'1 2'}, {weights:'1'}, {rels:['a^2-a']}, {rels:['1']}, {nativeWorkers:33},
    {rels:['4611686018427387904*a']}, {maxdeg:'4294967295'}, {fomkyrOptions:{bits:64}},
    {fomkyrOptions:{batchPairs:513}}, {fomkyrOptions:{memoryPolicy:'manual',scratchMiB:512},memoryMiB:128},
    {fomkyrOptions:{wordCacheEntries:257}},{fomkyrOptions:{matcherMiB:128},memoryMiB:128},
    {fomkyrOptions:{progressIntervalSeconds:0}},{fomkyrOptions:{wordMatcher:1}}]) {
    assert.ok(validateSettings({...form,...change}).length,JSON.stringify(change));
    assert.throws(()=>buildJob({...form,...change}));
  }
  assert.equal(validateSettings({...form,rels:['0'],maxdeg:''}).length,0);
  assert.throws(()=>validateFomkyrOptions({runKey:'arbitrary'}));
});
test('local rewrite and shared cache controls are bounded, persisted and converted to bytes',async()=>{
  const fomkyrOptions=validateFomkyrOptions({compiledRewrites:false,rationalHeap:false,rewriteDegree:3,rewriteSupport:1,rewriteMiB:0,sharedCacheMiB:2});
  const options=buildJob({...form,memoryMiB:128,fomkyrOptions}).fomkyrOptions;
  assert.equal(options.compiledRewrites,false);assert.equal(options.rationalHeap,false);
  assert.equal(options.rewriteBudgetBytes,0);assert.equal(options.sharedReducerCacheBytes,2*1048576);
  assert.equal(options.rewriteMiB,undefined);assert.equal(options.sharedCacheMiB,undefined);
  const decoded=await readShareLink(new URL(await createShareLink({...form,memoryMiB:128,fomkyrOptions},'https://example.org/')).hash);
  assert.deepEqual(decoded.fomkyrOptions,fomkyrOptions);
  for(const change of [{rewriteDegree:5},{rewriteSupport:0},{rewriteMiB:-1},{sharedCacheMiB:257},{rationalHeap:1}])assert.throws(()=>validateFomkyrOptions(change));
  assert.throws(()=>buildJob({...form,memoryMiB:128,fomkyrOptions:{rewriteMiB:128}}));
  assert.throws(()=>buildJob({...form,memoryMiB:128,fomkyrOptions:{sharedCacheMiB:128}}));
});
test('fomkyr runtime settings round-trip in Share without changing old tokens', async () => {
  const fomkyrOptions = {...FOMKYR_DEFAULTS,execution:'single',bits:'64',resume:false,hilbert:false,
    heapReduction:false,batchPairs:0,cachePercent:0,scratchMiB:16,ioMode:'broker',
    wordMatcher:false,chainCriterion:false,eagerPruning:false,quadraticRewrite:false,costScheduling:false,
    wordCacheEntries:4096,matcherMiB:1,progress:false,progressIntervalSeconds:0.5};
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
  assert.equal(buildJob({...form,memoryMiB:128,fomkyrOptions:{execution:'single',memoryPolicy:'manual',scratchMiB:1}}).fomkyrOptions.scratchBytes,1048576);
  assert.throws(()=>buildJob({...form,memoryMiB:128,fomkyrOptions:{memoryPolicy:'manual',scratchMiB:1}}));
});
test('optimizer budgets and update seconds reach the engine without changing old form choices',()=>{
  const options=buildJob({...form,memoryMiB:128,fomkyrOptions:{wordMatcher:false,chainCriterion:false,matcherMiB:0,wordCacheEntries:4096,progressIntervalSeconds:0.25}}).fomkyrOptions;
  assert.equal(options.matcherBudgetBytes,0);assert.equal(options.wordMatcher,false);assert.equal(options.chainCriterion,false);
  assert.equal(options.wordCacheEntries,4096);assert.equal(options.progressIntervalMs,250);
  assert.equal(options.progressIntervalSeconds,undefined);assert.equal(options.matcherMiB,undefined);
  assert.equal(validateFomkyrOptions({heapReduction:false}).wordMatcher,true);
});
test('George 0.6 release keeps its experimental label only in the engine chooser', () => {
  const html = fs.readFileSync('web/index.html','utf8');
  assert.ok(html.includes('<title>George '+JSON.parse(fs.readFileSync('package.json')).version+'</title>'));
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
  for(const key of ['rationalHeap','rationalRewrites','compiledRewrites'])assert.deepEqual(new Set(design.cases.map(row=>row.form.fomkyrOptions[key])),new Set([true,false]));
  assert.deepEqual(new Set(design.cases.map(row=>row.form.fomkyrOptions.rewriteDegree)),new Set([2,3,4]));
  assert.deepEqual(new Set(design.cases.map(row=>row.form.fomkyrOptions.rewriteSupport)),new Set([1,8,64]));
  for(const key of ['rewriteMiB','sharedCacheMiB'])assert.deepEqual(new Set(design.cases.map(row=>row.form.fomkyrOptions[key])),new Set([0,1,null]));
});
test('publication checks include the complete fomkyr runtime', () => {
  const base=['index.html','style.css','isolation-worker.js','engine/build.json','engine/worker.js','engine/runner.js','sources/george-source.tar.gz','fomkyr/index.html'];
  const files=fs.readdirSync('web/engine/fomkyr').map(name=>'engine/fomkyr/'+name);
  const selected=publicationAssets([...base,...files]);
  for(const file of files)assert.ok(selected.includes(file),file);
});
