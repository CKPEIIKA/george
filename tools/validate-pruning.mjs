// Compare pruning on/off across all backends, native Bergman and Singular.
// node tools/validate-pruning.mjs [OUTPUT] [SBCL_LAUNCHER]
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {BERGMAN_BACKENDS as BACKENDS} from '../web/src/backends.js';
import {buildJob, monomialPruningAvailable, ORDERS, parseBasis, parseRelation, toBergman} from '../web/src/bergman-syntax.js';
import {latinHypercube} from '../test/support/backend-lhs.mjs';
import {BackendClient} from '../test/support/backend-client.mjs';
import {algebra} from '../test/support/algebra.mjs';
import {validateTimeoutMs} from '../web/src/time-limit.js';

const [output = `build/validation/pruning-${Date.now()}`, nativePath =
  'build/sbcl-oracle-fixed-v4-04-20261001/bin/clisp/unix/bergman'] = process.argv.slice(2);
const out = path.resolve(output), native = path.resolve(nativePath);
const sha = x => crypto.createHash('sha256').update(x).digest('hex');
const referencePath = path.resolve('build/validation/parity-oracle-final-20261001/report.json');
const reference = JSON.parse(fs.readFileSync(referencePath));
assert.equal(reference.state, 'complete');
const cases = reference.cases.filter(c => monomialPruningAvailable(c.form)).map(c =>
  ({...c, id: `pruning-${c.id}`, baselineId: c.id, form: {...c.form, monomialPruning: true}}));
const dimensions = ['generators', 'field', 'degree', 'coefficient', 'order', 'legacy', 'reverse', 'linear'];
const select = (x, a) => a[Math.floor(x * a.length)];
const samples = latinHypercube(32, dimensions, 0x5052554e);
samples.forEach((row, i) => {
  const n = 1 + Math.floor(row.generators * 4), vars = Array.from({length:n}, (_,j) => `x_${j+1}`);
  const rels = vars.map(v => `${v}^2`), coefficient = select(row.coefficient, [1, 2, -1]);
  for (let a=0;a<n;a++) for (let b=a+1;b<n;b++) rels.push(`${vars[b]}*${vars[a]}-${coefficient}*${vars[a]}*${vars[b]}`);
  if (row.linear > 0.8) rels.push(vars[0]);
  cases.push({id:`pruning-lhs-${String(i+1).padStart(3,'0')}`, group:'pruning-lhs', sample:row, form:{
    task:'gb',ring:'noncomm',vars,rels,field:select(row.field,['0','2','p']),modulus:'5',
    order:select(row.order,ORDERS.noncomm.map(o=>o.id)),maxdeg:String(3+Math.floor(row.degree*4)),
    legacy:row.legacy>0.5,reverseVars:row.reverse>0.5,lowterms:'safe',monomialPruning:true}});
});
fs.mkdirSync(out,{recursive:true});
const engines = Object.fromEntries(Object.keys(BACKENDS).map(id => {
  const directory=path.resolve(id==='standard'?'web/engine':`web/engine/${id}`);
  return [id,{directory,hashes:Object.fromEntries(['ecl.js','ecl.wasm','ecl.data'].map(n =>
    [n,sha(fs.readFileSync(path.join(directory,n)))]))}];
}));
const oracleRoot=path.resolve('build/oracles/root'), singular=path.join(oracleRoot,'usr/bin/Singular');
const env={...process.env,LD_LIBRARY_PATH:`${oracleRoot}/usr/lib/x86_64-linux-gnu:${process.env.LD_LIBRARY_PATH||''}`,
  SINGULARPATH:`${oracleRoot}/usr/share/singular/LIB:${oracleRoot}/usr/lib/x86_64-linux-gnu/singular/MOD`};
const timeoutMs=validateTimeoutMs(Number(process.env.GEORGE_TEST_TIMEOUT_MS??180000)), report={state:'running',startedAt:new Date().toISOString(),reference:referencePath,
  referenceSha256:sha(fs.readFileSync(referencePath)),sampling:{seed:0x5052554e,count:32,dimensions,samples},
  perCaseTimeoutMs:timeoutMs,engines,cases,results:[],native,singular,timingIsDiagnosticOnly:true};
const save=()=>fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2)+'\n');
if(process.argv.includes('--resume')){
  const previous=JSON.parse(fs.readFileSync(path.join(out,'report.json')));
  assert.deepEqual(previous.engines,engines);assert.deepEqual(previous.cases,cases);
  for(const row of previous.results){
    for(const [backend,values] of Object.entries(row.backends)){
      const files=JSON.parse(fs.readFileSync(path.join(out,row.id,backend+'.outputs.json')));
      assert.deepEqual(Object.fromEntries(Object.entries(files).map(([n,t])=>[n,sha(t)])),values.hashes);
    }
  }
  report.results=previous.results;report.resumedResults=previous.results.length;
}
function run(exe,script,cwd,name,environment=process.env){
  fs.writeFileSync(path.join(cwd,name),script);
  const r=spawnSync(exe,['-q'].filter(()=>exe===singular),{cwd,input:script,env:environment,
    encoding:'utf8',timeout:timeoutMs,killSignal:'SIGKILL',maxBuffer:16e6});
  fs.writeFileSync(path.join(cwd,name+'.log'),(r.stdout||'')+(r.stderr||''));
  assert.ifError(r.error);assert.equal(r.status,0,name+': '+r.stderr);return r.stdout;
}
let client;
try {
  for (const c of cases) {
    if(report.results.some(r=>r.id===c.id))continue;
    assert.ok(monomialPruningAvailable(c.form),c.id);
    const dir=path.join(out,c.id);fs.mkdirSync(dir,{recursive:true});
    const row={id:c.id,backends:{}};let expected;
    if(c.baselineId)expected=JSON.parse(fs.readFileSync(path.join(path.dirname(referencePath),c.baselineId,'compiled.outputs.json')));
    for(const [backend,engine] of Object.entries(engines)){
      for(const enabled of [false,true]){
        report.activeCase={id:c.id,backend,enabled};save();
        client=new BackendClient(engine.directory,{timeoutMs});
        const job=buildJob({...c.form,monomialPruning:enabled});
        let result;try{result=await client.run(job);}finally{await client.close();client=null;}
        if(expected)assert.deepEqual(result.files,expected,`${c.id}/${backend}/${enabled}`);else expected=result.files;
        const label=enabled?backend:`${backend}-unpruned`;
        fs.writeFileSync(path.join(dir,label+'.outputs.json'),JSON.stringify(result.files,null,2)+'\n');
        row.backends[label]={elapsedMs:result.elapsedMs,memoryBytes:result.memoryBytes,
          hashes:Object.fromEntries(Object.entries(result.files).map(([n,t])=>[n,sha(t)]))};
      }
    }
    const nativeDir=path.join(dir,'native');fs.mkdirSync(nativeDir,{recursive:true});
    const job=buildJob(c.form);
    // A resumed attempt must not enter Bergman's interactive overwrite prompt.
    for(const name of Object.values(job.outputs))fs.rmSync(path.join(nativeDir,name),{force:true});
    for(const [name,text] of Object.entries(job.files))fs.writeFileSync(path.join(nativeDir,name),text);
    run(native,job.script+'\n(QUIT)\n',nativeDir,'session.lsp');
    for(const name of Object.values(job.outputs))assert.equal(fs.readFileSync(path.join(nativeDir,name),'utf8'),expected[name],c.id+': native');
    row.nativeExact=true;
    if(c.form.vars.length<=4){
      const p=c.form.field==='0'?0:c.form.field==='2'?2:5;
      const basis=parseBasis(expected['result.gb']).groups.flatMap(g=>g.polys);
      const code=['LIB "freealgebra.so";',`ring r=${p},(${[...c.form.vars].reverse().join(',')}),Dp;`,
        'def R=freeAlgebra(r,16);','setring R;',`ideal I=${c.form.rels.map(r=>toBergman(parseRelation(r,c.form.vars))).join(',')};`,
        `ideal B=${basis.join(',')||'0'};`,'ideal G=twostd(I);','ideal H=twostd(B);',
        'print("ORACLE:"+string(size(reduce(I,H)))+":"+string(size(reduce(B,G))));','quit;'].join('\n');
      const log=run(singular,code,dir,'singular.sing',env);
      assert.doesNotMatch(log,/^\s*\?/m);assert.match(log,/ORACLE:0:0/,c.id);row.singularMutualIdealMembership=true;
      if(c.form.order==='degleftlex'&&!c.form.reverseVars){
        const a=algebra(c.form.vars,false,p);row.ambiguities=a.certify(c.form.rels.map(s=>a.parse(s)),a.basis(expected['result.gb']),Number(c.form.maxdeg));
      }
    }
    report.results.push(row);save();console.log(c.id,'on/off x3 + native'+(row.singularMutualIdealMembership?' + Singular':'')+' PASS');
  }
  report.state='complete';report.finishedAt=new Date().toISOString();delete report.activeCase;save();
}catch(error){report.state='failed';report.error=error.stack;save();throw error;}
finally{await client?.close();}
