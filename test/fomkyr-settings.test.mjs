import test from 'node:test';
import assert from 'node:assert/strict';
import {FOMKYR_DEFAULTS, FOMKYR_FIELDS, fomkyrControlAvailability, fomkyrEngineOptions,
  updateFomkyrControlAvailability, validateFomkyrOptions} from '../web/src/fomkyr-options.js';
import {validateSettings} from '../web/src/bergman-syntax.js';
import {createShareLink, readShareLink} from '../web/src/share.js';
import {FOMKYR_GROUPS} from '../web/src/fomkyr-options.js';
import {computeWorkers} from '../fomkyr/web/worker-count.js';
import {planMemory,sharedCacheAllowance} from '../fomkyr/web/memory-policy.js';

test('engine submenus cover every control once and keep mathematical choices separate',()=>{
 const grouped=Object.values(FOMKYR_GROUPS).flat();assert.equal(new Set(grouped).size,grouped.length);
 assert.deepEqual([...grouped].sort(),FOMKYR_FIELDS.map(([k])=>k).sort());
 assert.deepEqual(FOMKYR_GROUPS.execution,['execution','bits','memoryPolicy']);
 assert.ok(FOMKYR_GROUPS.mathematics.includes('gateMiB'));
});
test('automatic workers use available threads and the FK6 row-workspace allowance',()=>{
 const ordinaryScratchBytes=planMemory(14304*1048576,1).ordinaryScratchBytes;
 assert.equal(computeWorkers(0,{hardwareConcurrency:12}),11);
 assert.equal(computeWorkers(0,{hardwareConcurrency:12,ordinaryScratchBytes,minWorkerMiB:1024,coordinator:true}),6);
 assert.equal(computeWorkers(12,{hardwareConcurrency:12,ordinaryScratchBytes,minWorkerMiB:1024,coordinator:true}),12);
 assert.equal(computeWorkers(12,{shared:false}),1);
});
test('explicit shared cache exceeds old budget/16 ceiling and adapts after Wasm32 fallback',()=>{
 const large=planMemory(14304*1048576,6),small=planMemory(4095*1048576,1);
 assert.equal(sharedCacheAllowance(2048*1048576,large),2048*1048576);
 assert.ok(sharedCacheAllowance(2048*1048576,small)<small.unreservedBytes);
 assert.equal(sharedCacheAllowance(null,large),Math.floor(large.budgetBytes/16));
 assert.equal(sharedCacheAllowance(0,large),0);
});

const form = {backend:'fomkyr',field:'0',nativeWorkers:4,monomialPruning:true};
const available = change => fomkyrControlAvailability({...form,...change});

test('large-row admission and helper execution default to automatic and remain shareable', async () => {
  assert.equal(FOMKYR_DEFAULTS.largeRowWorkspaces,0);
  assert.equal(FOMKYR_DEFAULTS.helperRows,true);
  assert.equal(available({}).largeRowWorkspaces,true);
  assert.equal(available({}).helperRows,true);
  for(const largeRowWorkspaces of [0,1,2,33]) {
    const value={...form,fomkyrOptions:{largeRowWorkspaces,helperRows:false}};
    const options=fomkyrEngineOptions(value);
    assert.equal(options.largeRowWorkspaces,largeRowWorkspaces);
    assert.equal(options.helperRows,false);
    const decoded=await readShareLink(new URL(await createShareLink(value,'https://example.org/')).hash);
    assert.equal(decoded.fomkyrOptions.largeRowWorkspaces,largeRowWorkspaces);
    assert.equal(decoded.fomkyrOptions.helperRows,false);
  }
  for(const largeRowWorkspaces of [-1,1.5,34,'auto'])
    assert.throws(()=>validateFomkyrOptions({largeRowWorkspaces}));
  for(const change of [{field:'101'},{fomkyrOptions:{heapReduction:false}},
    {fomkyrOptions:{memoryPolicy:'manual',rowReserveMiB:0}}])
    assert.equal(available(change).largeRowWorkspaces,false);
  for(const change of [{nativeWorkers:1},{fomkyrOptions:{execution:'single'}},
    {fomkyrOptions:{scheduler:'barrier'}},{fomkyrOptions:{batchPairs:0}}])
    assert.equal(available(change).helperRows,false);
});

test('cooperative window and FK dispatch choices are wired and shareable', async () => {
  assert.equal(FOMKYR_DEFAULTS.elasticWindow,true);
  assert.equal(FOMKYR_DEFAULTS.sectorPriority,true);
  assert.equal(FOMKYR_DEFAULTS.maxLookahead,512);
  assert.throws(()=>validateFomkyrOptions({lookahead:128,maxLookahead:64}),/ceiling/);
  assert.doesNotThrow(()=>validateFomkyrOptions({lookahead:128,maxLookahead:64,elasticWindow:false}));
  const opts={lookahead:32,maxLookahead:256,elasticWindow:false,sectorPriority:false};
  const engine=fomkyrEngineOptions({...form,fomkyrOptions:opts});
  for(const [key,value] of Object.entries(opts))assert.equal(engine[key],value);
  const saved=await readShareLink(new URL(await createShareLink({...form,varsText:'a,b',relsText:'a^2',fomkyrOptions:opts},'https://example.org/')).hash);
  for(const [key,value] of Object.entries(opts))assert.equal(saved.fomkyrOptions[key],value);
  for(const key of ['elasticWindow','maxLookahead','sectorPriority'])assert.equal(available({fomkyrOptions:{scheduler:'barrier'}})[key],false,key);
  assert.equal(available({fomkyrOptions:{elasticWindow:false}}).maxLookahead,false);
  assert.equal(available({}).sectorPriority,false);
  assert.equal(available({fomkyrOptions:{hilbertGate:true,hilbertSectors:true}}).sectorPriority,true);
  assert.equal(available({nativeWorkers:'1',fomkyrOptions:{hilbertGate:true}}).sectorPriority,false);
  assert.equal(available({fomkyrOptions:{hilbertGate:true,execution:'single'}}).sectorPriority,false);
  assert.equal(available({field:'101',fomkyrOptions:{hilbertGate:true}}).sectorPriority,false);
});

test('Fomkyr controls have unique names and hide inactive engine settings', () => {
  assert.equal(new Set(FOMKYR_FIELDS.map(([key])=>key)).size,FOMKYR_FIELDS.length);
  assert.ok(Object.values(available({backend:'compiled'})).every(value=>value===false));
  const nodes = Object.fromEntries([...FOMKYR_FIELDS.map(([key])=>'fomkyr-'+key),'nativeWorkers']
    .map(key=>[key,{disabled:false,closest:()=>null}]));
  const root = {getElementById:key=>nodes[key]};
  updateFomkyrControlAvailability({...form,backend:'standard',fomkyrOptions:FOMKYR_DEFAULTS},root);
  assert.ok(Object.values(nodes).every(node=>node.disabled));
});

test('Fomkyr dependent controls follow disk, counting, telemetry and rewrite choices', () => {
  const a=available({fomkyrOptions:{spill:false,hilbert:false,progress:false,compiledRewrites:false}});
  for (const key of ['resume','ioMode','sharedCacheMiB','hilbertMiB','progressIntervalSeconds',
    'rewriteDegree','rewriteSupport','rewriteMiB','rationalRewrites']) assert.equal(a[key],false,key);
  for (const key of ['spill','hilbert','progress','compiledRewrites','wordMatcher','chainCriterion',
    'batchPairs']) assert.equal(a[key],true,key);
  const b=available({fomkyrOptions:{execution:'single'}});
  assert.equal(b.ioMode,false);
  assert.equal(b.costScheduling,false);
  assert.equal(available({monomialPruning:false}).eagerPruning,false);
  assert.equal(available({fomkyrOptions:{batchPairs:0}}).costScheduling,false);
});

test('Fomkyr prime fields disable rational controls and heap toggles retain the general divider', () => {
  for (const field of ['2','p']) for (const key of ['rationalHeap','bigRationalHeap','rationalRewrites',
    'growingRationalHeap','fastBigDivision','rowReserveMiB','reserveInPlace']) {
    assert.equal(available({field})[key],false,key);
  }
  const a=available({fomkyrOptions:{heapReduction:false}});
  assert.equal(a.fastBigDivision,true);
  for (const key of ['heapThreshold','radixHeap','rationalHeap','bigRationalHeap','compiledRewrites',
    'rowReserveMiB','reserveInPlace','eagerPruning','quadraticRewrite']) assert.equal(a[key],false,key);
  assert.equal(available({fomkyrOptions:{rationalHeap:false}}).rationalRewrites,true);
  assert.equal(available({fomkyrOptions:{memoryPolicy:'manual',rowReserveMiB:0}}).reserveInPlace,false);
});

test('word index is available to either word matching or the chain criterion', () => {
  for (const [wordMatcher,chainCriterion,wanted] of [[true,true,true],[false,true,true],[true,false,true],[false,false,false]]) {
    assert.equal(available({fomkyrOptions:{wordMatcher,chainCriterion}}).matcherMiB,wanted);
  }
});

test('explicit workspace checks use the resolved default memory allowance', () => {
  const options=fomkyrEngineOptions({...form,fomkyrOptions:{memoryPolicy:'manual',scratchMiB:2048,matcherMiB:600,rowReserveMiB:512}});
  assert.equal(options.scratchBytes,2048*1048576);
  assert.equal(options.matcherBudgetBytes,600*1048576);
  assert.equal(options.rowReserveBytes,512*1048576);
  assert.throws(()=>fomkyrEngineOptions({...form,fomkyrOptions:{memoryPolicy:'manual',scratchMiB:3584}}));
  assert.doesNotThrow(()=>fomkyrEngineOptions({...form,field:'p',memoryMiB:128,fomkyrOptions:{rowReserveMiB:256}}));
});

test('unused Fomkyr draft settings cannot block a Bergman job or its share link', async () => {
  const values={...form,backend:'compiled',task:'gb',ring:'noncomm',order:'degleftlex',
    vars:['x','y'],rels:['x^2'],varsText:'x,y',relsText:'x^2',nonhomog:'auto',
    nativeWorkers:99,fomkyrOptions:{cachePercent:99}};
  assert.deepEqual(validateSettings(values),[]);
  const link=await createShareLink(values,'https://example.org/george/');
  const decoded=await readShareLink(new URL(link).hash);
  assert.equal(decoded.nativeWorkers,99);
  assert.equal(decoded.fomkyrOptions.cachePercent,99);
  assert.ok(validateSettings({...values,backend:'fomkyr'}).length);
  const single={...values,backend:'fomkyr',fomkyrOptions:{execution:'single'}};
  assert.deepEqual(validateSettings(single),[]);
  const singleLink=await createShareLink(single,'https://example.org/george/');
  assert.equal((await readShareLink(new URL(singleLink).hash)).nativeWorkers,99);
});

 test('automatic memory ignores saved workspace sizes and manual mode restores them',async()=>{
  const saved={scratchMiB:4096,rowReserveMiB:4096,radixHeap:false,batchPairs:64};
  const automatic=fomkyrEngineOptions({...form,memoryMiB:128,fomkyrOptions:saved});
  assert.equal(automatic.memoryPolicy,'auto');assert.equal(automatic.scratchBytes,undefined);
  assert.equal(automatic.rowReserveBytes,undefined);assert.equal(automatic.radixHeap,false);
  assert.equal(automatic.batchPairs,64);assert.equal(available({fomkyrOptions:saved}).scratchMiB,false);
  assert.equal(available({fomkyrOptions:saved}).rowReserveMiB,false);
  assert.equal(available({fomkyrOptions:{rowReserveMiB:0}}).reserveInPlace,true);
  assert.equal(available({fomkyrOptions:{memoryPolicy:'manual'}}).scratchMiB,true);
  assert.equal(available({fomkyrOptions:{memoryPolicy:'manual'}}).rowReserveMiB,true);
  const manual=fomkyrEngineOptions({...form,fomkyrOptions:{memoryPolicy:'manual',scratchMiB:2048,rowReserveMiB:512}});
  assert.equal(manual.scratchBytes,2048*1048576);assert.equal(manual.rowReserveBytes,512*1048576);
  const share=await createShareLink({...form,varsText:'a,b',relsText:'a^2',fomkyrOptions:saved},'https://example.org/');
  assert.deepEqual((await readShareLink(new URL(share).hash)).fomkyrOptions.scratchMiB,4096);
});

test('FK6 dimension assistance requires opt-in and keeps mathematical choices shareable', async () => {
  assert.equal(FOMKYR_DEFAULTS.hilbertGate,false);
  assert.equal(available({}).hilbertSectors,false);
  assert.equal(available({}).gateMiB,false);
  assert.equal(available({fomkyrOptions:{hilbertGate:true}}).hilbertSectors,true);
  assert.equal(available({field:'101',fomkyrOptions:{hilbertGate:true}}).hilbertGate,false);
  const options={hilbertGate:true,hilbertSectors:false,gateMiB:64};
  const share=await createShareLink({...form,varsText:'a,b',relsText:'a^2',fomkyrOptions:options},'https://example.org/');
  const decoded=await readShareLink(new URL(share).hash);
  const engine=fomkyrEngineOptions({...form,fomkyrOptions:decoded.fomkyrOptions});
  assert.equal(engine.hilbertGate,true);assert.equal(engine.hilbertSectors,false);
  assert.equal(engine.gateBudgetBytes,64*1048576);assert.equal(engine.gateMiB,undefined);
});


test('big-row capacity is automatic by default, configurable and saved in shares', async () => {
  assert.equal(FOMKYR_DEFAULTS.bigRowMaxTerms,0);
  for(const bigRowMaxTerms of [0,128,1048576,4194304,1073741824]) {
    const value={...form,fomkyrOptions:{bigRowMaxTerms}};
    const decoded=await readShareLink(new URL(await createShareLink(value,'https://example.org/')).hash);
    assert.equal(decoded.fomkyrOptions.bigRowMaxTerms,bigRowMaxTerms);
    assert.equal(fomkyrEngineOptions(value).bigRowMaxTerms,bigRowMaxTerms);
  }
  for(const bigRowMaxTerms of [-1,127,129,1048577,2147483648,'auto'])
    assert.throws(()=>validateFomkyrOptions({bigRowMaxTerms}));
  assert.equal(available({field:'101'}).bigRowMaxTerms,false);
  assert.equal(available({fomkyrOptions:{heapReduction:false}}).bigRowMaxTerms,false);
  assert.equal(available({fomkyrOptions:{bigRationalHeap:false}}).bigRowMaxTerms,false);
  assert.equal(available({fomkyrOptions:{rationalHeap:false}}).bigRowMaxTerms,true);
  assert.equal(available({fomkyrOptions:{rationalHeap:false}}).reserveInPlace,true);
});
