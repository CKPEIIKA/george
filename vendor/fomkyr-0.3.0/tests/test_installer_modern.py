#!/usr/bin/env python3
"""Executable current-George-shaped integration fixtures; NOT a full checkout.
Tests original controls -> installed job builder -> actual fomkyr parser.
"""
from pathlib import Path
import json, subprocess, tempfile
ROOT=Path(__file__).resolve().parents[1]
FILES={
 'src/backends.js':'''export const BACKENDS = Object.freeze({
  standard: Object.freeze({maximumHeapMiB:2048}),
  native: Object.freeze({kind:'native',maximumHeapMiB:14304}),
});
export const validMemoryMiB=(v,b)=>v>=128&&v<=BACKENDS[b].maximumHeapMiB;
''',
 'engine/worker.js':'''const dispatchNative=async()=>false;
onmessage = async ({data:{id, command, job, source, backend}}) => {
  if (await dispatchNative({id, command, job, source, backend})) return;
};
''',
 'src/engine.js':'''export class Engine {
 f(data){
  if(data.event){
   if (data.event.type === 'control' && data.event.memory?.buffer instanceof SharedArrayBuffer) this.nativeControl=data.event;
  }
 }
 cancel(){
  if(this.nativeControl) Atomics.store(new Int32Array(this.nativeControl.memory.buffer, this.nativeControl.cancelOffset, 1), 0, 1);
 }
}
''',
 'src/bergman-syntax.js':'''import {BACKENDS,validMemoryMiB} from './backends.js';
const timeoutMilliseconds=x=>Number(x||0)*60000;
export function parseRelation(src, vars) {
  for(const m of src.matchAll(/\\^(\\d+)/g)){
    const e=Number(m[1]);
    if (!Number.isSafeInteger(e) || e > 10000) throw new SyntaxError('Exponents must be integers from 0 to 10000');
  }
  return src;
}
const isHomogeneous=()=>true;
export function monomialPruningAvailable(form) {
  if (form.task !== 'gb' || form.ring !== 'noncomm' || form.nonhomog === 'itemwise' ||
      (form.strategy && form.strategy !== 'default') || String(form.weights || '').trim()) return false;
  try { return (form.rels || []).every(r => isHomogeneous(parseRelation(r, form.vars || []), new Map())); }
  catch { return false; }
}
export function validateSettings(form) {
  const errors = [];
  const integer=(v,min,max)=>/^\\d+$/.test(String(v))&&Number(v)>=min&&Number(v)<=max;
  for(const [key,label] of [['maxdeg','Maximal degree'],['maxserdeg','Series degree']]){
    if (form[key] !== undefined && form[key] !== '' && !integer(form[key], 1, 10000)) errors.push(`${label} must be an integer from 1 to 10000.`);
  }
  if(!validMemoryMiB(Number(form.memoryMiB),form.backend)) errors.push('Memory range');
  if(form.monomialPruning&&!monomialPruningAvailable(form)) errors.push('Pruning unavailable');
  return errors;
}
export function buildJob(form){
 const errors=validateSettings(form);if(errors.length)throw Error(errors.join(' '));
 const parsed = form.rels.map((r) => parseRelation(r, form.vars));
 const vars=form.reverseVars?[...form.vars].reverse():form.vars;
 const input='(ALGFORMINPUT)\\nvars '+vars.join(',')+';\\n'+parsed.join(',')+';';
 const session=['(SETLEGACYMODE NIL)','(NONCOMMIFY)','(DEGLEFTLEXIFY)','(SETMODULUS '+(form.field==='2'?2:form.field==='p'?form.modulus:0)+')','(SETMAXDEG '+(form.maxdeg||'NIL')+')'];
 if(form.weights)session.push('(SETWEIGHTS '+form.weights+')');
 if(form.lowterms==='safe')session.push('(SETSAFELOWTERMSHANDLING)');
 if (form.monomialPruning) session.push('(SETREDUCTIVITY NIL)');
 session.push('(SIMPLE "input.bg" "result.gb")');
 if (form.monomialPruning) session.push('(SETREDUCTIVITY T)');
 session.push('(CLEARRING)');
 const job={backend:form.backend,task:form.task,memoryMiB:form.memoryMiB,outputs:{gb:'result.gb'},files:{'input.bg':input},script:session.join('\\n')};
  job.timeoutMs = timeoutMilliseconds(form.timeoutMinutes);
 return job;
}
''',
 'src/app.js':'''function render(job,files,res){
  renderFiles(job, files);
  if (job.outputs.hs || job.outputs.pb) $('seriesOut').innerHTML = renderSeries(files[job.outputs.hs], files[job.outputs.pb], res);
  if (res.native?.reduced === false) flagUnreduced();
  if (res.native?.previewTruncated) flagPreview();
}
function preview(r,vv,f){return parseRelation(r, vv.names);}
function refresh(f){
  $('nativeWorkersField').hidden = els.backend.value !== 'native';
  els.maxserdegField.hidden = f.task !== 'hilbert';
  const show = { basis: true, series: has('hs') || has('pb'), files: true};
}
''',
 'index.html':'<select id="backend"></select>\n<select id="memoryMiB" aria-describedby="memoryHint"></select>\n',
 'isolation-worker.js':'// existing George isolation worker MUST remain untouched\n',
}
TEST='''import assert from 'node:assert/strict';
import {BACKENDS} from './web/src/backends.js';
import {buildJob,validateSettings,parseRelation} from './web/src/bergman-syntax.js';
import {parseNativeJob} from './web/engine/fomkyr/job-adapter.js';
import {Engine} from './web/src/engine.js';
const base={backend:'fomkyr',task:'gb',ring:'noncomm',order:'degleftlex',strategy:'default',nonhomog:'auto',outmode:'ALG',vars:['a','b'],rels:['b^33-a^33'],memoryMiB:128,field:'0',maxdeg:'34',maxserdeg:'34',nativeWorkers:'3',monomialPruning:true,weights:'1 1',lowterms:'safe',timeoutMinutes:'2'};
let job=buildJob(base),r=parseNativeJob(job);
assert.equal(r.target,34);assert.equal(r.fixture.relations[0].degree,33);
assert.equal(job.fomkyrOptions.workers,3);assert.equal(job.fomkyrOptions.monomialPruning,true);
assert.equal(job.fomkyrOptions.hilbertDegree,34);assert.equal(job.timeoutMs,120000);
assert.equal(job.outputs.hs,'result.hs');assert.ok(!job.script.includes('SETREDUCTIVITY'));
assert.equal(parseNativeJob(buildJob({...base,maxdeg:''})).target,null);
assert.deepEqual(parseNativeJob(buildJob({...base,reverseVars:true})).fixture.variables,['b','a']);
assert.equal(buildJob({...base,monomialPruning:false}).fomkyrOptions.monomialPruning,false);
assert.equal(parseNativeJob(buildJob({...base,field:'p',modulus:101})).modulus,101);
assert.equal(validateSettings({...base,maxdeg:'100001',maxserdeg:'100001'}).length,0);
assert.equal(parseNativeJob(buildJob({...base,rels:['b^100001-a^100001'],maxdeg:'100002'})).fixture.relations[0].degree,100001);
assert.throws(()=>parseRelation('a^100001',['a'])); // Other engines retain their limit.
for(const bad of [{task:'ncpbh'},{ring:'comm'},{strategy:'rabbit'},{legacy:true},{weights:'1 2'},{outmode:'LISP'}])assert.throws(()=>buildJob({...base,...bad}));
assert.equal(BACKENDS.fomkyr.kind,'native');assert.equal(BACKENDS.fomkyr.maximumHeapMiB,14304);
assert.equal(BACKENDS.fomkyr.capabilities.fixedSettings.monomialPruning,undefined);
const original=globalThis.SharedArrayBuffer;globalThis.SharedArrayBuffer=undefined;
const e=new Engine();e.f({event:{type:'control',shared:false}});e.cancel();
globalThis.SharedArrayBuffer=original;
console.log('Current-shaped installer: actual form/job/parser pipeline passed');
'''
with tempfile.TemporaryDirectory() as td:
 root=Path(td);(root/'package.json').write_text('{"type":"module"}')
 for name,text in FILES.items():
  p=root/'web'/name;p.parent.mkdir(parents=True,exist_ok=True);p.write_text(text)
 def install(*args):
  result=subprocess.run(['python3',str(ROOT/'tools/install.py'),str(root),*args],capture_output=True,text=True)
  assert result.returncode==0,result.stdout+result.stderr
 install('--dry-run');install()
 (root/'test.mjs').write_text(TEST)
 result=subprocess.run(['node',str(root/'test.mjs')],capture_output=True,text=True)
 assert result.returncode==0,result.stdout+result.stderr
 before={n:(root/'web'/n).read_bytes() for n in FILES};install()
 assert all((root/'web'/n).read_bytes()==b for n,b in before.items())
 assert (root/'web/isolation-worker.js').read_text()==FILES['isolation-worker.js']
 assert (root/'web/fomkyr-isolation-worker.js').is_file() and (root/'web/.nojekyll').is_file()
 for name in ['fomkyr32.wasm','fomkyr64.wasm','fomkyr32-single.wasm','fomkyr64-single.wasm']:
  assert (root/'web/engine/fomkyr'/name).read_bytes()==(ROOT/'web'/name).read_bytes()
 # Recognized 0.2 registry/bridge/options overlay upgrades, rather than duplicate.
 p=root/'web/src/backends.js';s=p.read_text();s=s.replace("kind:'native',experimental:true,defaultHeapMiB:512,maximumHeapMiB:14304,capabilities:FOMKYR_CAPABILITIES", "experimental:true,capabilities:{maximumGenerators:16}");p.write_text(s)
 install();assert (root/'web/src/backends.js').read_text().count('  fomkyr:')==1
 for p in (root/'web').rglob('*.js'):
  a=subprocess.run(['node','--check',str(p)],capture_output=True,text=True);assert a.returncode==0,a.stderr
 print(result.stdout.strip())
(ROOT/'results/installer-modern-tests.json').write_text(json.dumps({'passed':True,'fixture':'current-source-shaped executable fixtures, not a full checkout','formToJobToParser':True,'originalWorkersAndPruning':True,'degreeBeyond10000AndUnbounded':True,'primeFieldAndReversedVariables':True,'strictUnsupportedSettings':True,'noSharedArrayBufferBridge':True,'fourBinaries':True,'idempotentAndRegistryUpgrade':True,'existingServiceWorkerPreserved':True},indent=2))
