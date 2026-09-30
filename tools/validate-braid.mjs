// The native degreewise idempotent-braid stall and the browser's two-stage path.
// Exact basis checks, full d², and an independent projective-module certificate.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {buildJob, resolutionJob} from '../web/src/bergman-syntax.js';
import {augmentedHomology} from '../web/src/homology.js';
import {wasmRuntime} from '../test/support/regression.mjs';
import {algebra} from '../test/support/algebra.mjs';
import {certifyResolution} from '../test/support/resolution.mjs';

const out=path.resolve(process.argv[2]||`build/validation/braid-${Date.now()}`);
const nativeOnly=process.argv[3]==='--native-only';
fs.mkdirSync(out,{recursive:true});
const candidates=fs.readdirSync('build').filter(n=>/^sbcl-/.test(n)&&fs.existsSync(`build/${n}/bin/clisp/unix/bergman`)).sort().reverse();
const native=path.resolve(process.env.BERGMAN_SBCL||`build/${candidates[0]}/bin/clisp/unix/bergman`);
assert.ok(fs.existsSync(native),'Build the native reference first.');
const cases=[];
for(const p of [0,2,3,5,101])cases.push(
  {id:`direct-F${p}`,p,vars:['a','b'],direct:true,maxdeg:6},
  {id:`prefix-F${p}`,p,vars:['a','aa'],maxdeg:8},
  {id:`monoid-F${p}`,p,vars:['a','b'],augmentation:'monoid',maxdeg:8},
  {id:`weighted-reversed-F${p}`,p,vars:['x_1','x_11'],augmentation:'monoid',weights:'2 3',reverseVars:true,maxdeg:18}
);

function nativeRun(dir,stages){
  fs.mkdirSync(dir,{recursive:true});
  for(const part of stages)for(const [file,text]of Object.entries(part.files))fs.writeFileSync(path.join(dir,file),text);
  const script=stages.map(part=>part.script).join('\n')+'\n(QUIT)\n';
  fs.writeFileSync(path.join(dir,'session.lsp'),script);
  const started=performance.now();
  const result=spawnSync(native,[],{cwd:dir,input:script,encoding:'utf8',timeout:10000,killSignal:'SIGKILL',maxBuffer:8e6});
  fs.writeFileSync(path.join(dir,'native.log'),(result.stdout||'')+(result.stderr||''));
  assert.ifError(result.error);assert.equal(result.status,0,'native braid session must terminate');
  return performance.now()-started;
}

function projectiveCertificate(basis,vars,p,augmentation){
  const a=algebra(vars,false,p),gb=a.basis(basis),[x,y]=vars;
  const rels=[`${x}^2-${x}`,`${y}^2-${y}`,`${y}*${x}*${y}-${x}*${y}*${x}`];
  const ambiguities=a.certify(rels.map(a.parse),gb);
  assert.deepEqual(a.hilbert(gb,4),[1,2,2,1,0],'six-dimensional braid algebra');
  // eA is the one-dimensional augmentation module: e²=e, epsilon(e)=1,
  // and e*x=x*e=epsilon(x)e. Therefore it is projective and higher Tor is zero.
  const e=a.parse(augmentation==='monoid'?`${x}*${y}*${x}`:`1-${x}-${y}+${x}*${y}+${y}*${x}-${x}*${y}*${x}`);
  const subtract=(f,g)=>{const r=new Map(f);for(const [w,c]of g)a.put(r,w,a.q(-c[0],c[1]));return r;};
  assert.equal(a.nf(subtract(a.multiply(e,e),e),gb).size,0,'augmentation projector is idempotent');
  let epsilon=a.q(0);
  for(const [word,c]of e)if(augmentation==='monoid'||word===''){
    const t=new Map();a.put(t,'',epsilon);a.put(t,'',c);epsilon=t.get('')||a.q(0);
  }
  assert.deepEqual(epsilon,a.q(1),'projector has augmentation one');
  for(const v of vars)for(const side of ['left','right']){
    const product=side==='left'?a.multiply(a.parse(v),e):a.multiply(e,a.parse(v));
    const target=augmentation==='monoid'?e:new Map();
    assert.equal(a.nf(subtract(product,target),gb).size,0,`${side} generator action on projector`);
  }
  return {ambiguities,algebraDimension:6,augmentationModuleProjective:true};
}

const report=[];
try{
  for(const c of cases){
    const dir=path.join(out,c.id),vars=c.vars,[x,y]=vars;
    const form={task:'anick',ring:'noncomm',order:'degleftlex',field:c.p?'p':'0',modulus:c.p,lowterms:'safe',
      rels:[`${x}^2-${x}`,`${y}^2-${y}`,`${y}*${x}*${y}-${x}*${y}*${x}`],...c,_resolutionStage:!!c.direct};
    const job=buildJob(form);let stages=[job];
    if(job.resolution){
      nativeRun(path.join(dir,'basis'),[job]);
      const basis=fs.readFileSync(path.join(dir,'basis',job.outputs.gb),'utf8');
      stages.push(resolutionJob(job,basis));
    }
    const nativeMs=nativeRun(path.join(dir,'native'),stages);
    const last=stages.at(-1),data=fs.readFileSync(path.join(dir,'native',last.outputs.resolution),'utf8');
    const basis=fs.readFileSync(path.join(dir,'native',last.outputs.gb),'utf8');
    const original=fs.readFileSync(path.join(dir,'native',job.outputs.gb),'utf8');
    const certificate=projectiveCertificate(original,vars,c.p,c.augmentation);
    const identities=certifyResolution(data,basis,vars,c.p);
    const completion={completeBasis:true,basis,degreeBound:last.degreeBound,weights:c.weights};
    const homology=augmentedHomology(data,vars,c.p,completion);
    if(job.resolution)homology.shifted=c.augmentation==='monoid';
    assert.ok(homology.highestCertifiedDegree>=(c.weights||c.direct?2:3),'known higher Tor degrees are certified');
    assert.deepEqual(homology.betti,[1,...homology.betti.slice(1).map(()=>0)],'projective augmentation has no higher Tor');
    if(c.weights){
      assert.equal(homology.highestCertifiedDegree,2);
      assert.equal(homology.truncatedBetti[4],1,'partial H4 must stay outside certified Betti numbers');
    }
    let wasmMs=null;
    if(!nativeOnly){
      const rt=await wasmRuntime({onOutput:line=>fs.appendFileSync(path.join(dir,'wasm.log'),line+'\n')});
      const result=rt.run(job);wasmMs=result.elapsedMs;fs.mkdirSync(path.join(dir,'wasm'));
      for(const [file,text]of Object.entries(result.files)){
        fs.writeFileSync(path.join(dir,'wasm',file),text);
        if(/\.(gb|anick|jsonl)$/.test(file))assert.equal(text,fs.readFileSync(path.join(dir,'native',file),'utf8'),`${c.id}: native/Wasm ${file}`);
      }
      assert.deepEqual(result.homology||augmentedHomology(result.files[last.outputs.resolution],vars,c.p,completion),homology);
    }
    const row={id:c.id,modulus:c.p,generators:vars,augmentation:c.augmentation||'graded',weights:c.weights||null,
      reversed:!!c.reverseVars,directDegreewise:!!c.direct,nativeEquality:!nativeOnly,...certificate,identities,homology,nativeMs,wasmMs};
    report.push(row);fs.writeFileSync(path.join(out,'partial-report.json'),JSON.stringify(report,null,2));
    console.log(c.id,'PASS',identities,'full differential identities',homology.betti);
  }
  assert.equal(report.length,20);
  // The safe comparator must track a legacy switch even after ring setup.
  const probeDir=path.join(out,'mode-switch');fs.mkdirSync(probeDir);
  const probe={files:{'input.bg':'(ALGFORMINPUT)\nvars a,b;\na^2-a,b^2-b,b*a*b-a*b*a;\n'},script:`
(SETLEGACYMODE NIL)
(SETDEGREEWISE)
(STABILISE)
(NONCOMMIFY)
(DEGLEFTLEXIFY)
(SETSAFELOWTERMSHANDLING)
(LISPFORMINPUT)
(SETQ |CompareA| (MONINTERN '(1 1)))
(SETQ |CompareB| (MONINTERN '(2)))
(COND ((MONLESSP (CDR |CompareA|) (CDR |CompareB|)) (ERROR 99 "default mixed-degree order")))
(SETLEGACYMODE T)
(COND ((NOT (MONLESSP (CDR |CompareA|) (CDR |CompareB|))) (ERROR 99 "legacy shortcut")))
(SETLEGACYMODE NIL)
(COND ((MONLESSP (CDR |CompareA|) (CDR |CompareB|)) (ERROR 99 "restored default order")))
`,outputs:{}};
  // Initialise generator/monomial storage through an ordinary basis session.
  const init=buildJob({task:'gb',ring:'noncomm',order:'degleftlex',field:'0',vars:['a','b'],rels:['a^2-a','b^2-b'],maxdeg:4,lowterms:'safe'});
  const setup=init.script.replace('(CLEARRING)','');
  probe.script=setup+probe.script.replace('(LISPFORMINPUT)','');probe.files=init.files;
  nativeRun(probeDir,[probe]);
  if(!nativeOnly)(await wasmRuntime()).run(probe);
  fs.writeFileSync(path.join(out,nativeOnly?'native-report.json':'report.json'),JSON.stringify(report,null,2));
}catch(e){console.error(e);process.exitCode=1;}
