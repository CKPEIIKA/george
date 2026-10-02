// Low-degree FK Latin hypercube + exact submitted-input anchor.
// Four engines, native SBCL, independent critical pairs/dimensions, Singular.
// node tools/validate-fomin-kirillov.mjs [OUTPUT] [LHS_COUNT=16] [SBCL_LAUNCHER]
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {BERGMAN_BACKENDS as BACKENDS} from '../web/src/backends.js';
import {buildJob, parseBasis, parseRelation, readInputFile, toBergman} from '../web/src/bergman-syntax.js';
import {fominKirillov, fominKirillovSamples, FK_SOURCE} from '../test/support/fomin-kirillov.mjs';
import {BackendClient} from '../test/support/backend-client.mjs';
import {algebra} from '../test/support/algebra.mjs';
import {validateTimeoutMs} from '../web/src/time-limit.js';

const [output=`build/validation/fomin-kirillov-${Date.now()}`,count='16',nativeArgument=
  'build/sbcl-oracle-fixed-v4-04-20261001/bin/clisp/unix/bergman'] = process.argv.slice(2);
const design=fominKirillovSamples(Number(count)),out=path.resolve(output),native=path.resolve(nativeArgument);
const original=JSON.parse(fs.readFileSync('test/fixtures/fomin-kirillov-user.json','utf8'));
const parsed=readInputFile('(ALGFORMINPUT)\n'+original.inputText);
const base={task:'gb',ring:'noncomm',order:'degleftlex',field:'0',memoryMiB:2048,
  nonhomog:'degreewise',strategy:'default',lowterms:'quick',outmode:'ALG'};
const cases=[...design.cases,
  {id:'fk-rational-E3-degree4',group:'fomin-kirillov-anchor',rank:3,
    form:{...base,...fominKirillov(3),maxdeg:'4',monomialPruning:true},expectedDimensions:[1,3,4,3,1]},
  {id:'fk-submitted-15-generators-100-relations-degree3',group:'submitted-anchor',
    form:{...base,vars:parsed.vars,rels:parsed.rels,maxdeg:'3',monomialPruning:true},expectedDimensions:[1,15,125,765]}];
const sha=x=>crypto.createHash('sha256').update(x).digest('hex');
const engines=Object.fromEntries(Object.entries(BACKENDS).map(([id,b])=>{
  const directory=path.resolve('web/src',b.directory);
  return [id,{directory,manifest:JSON.parse(fs.readFileSync(path.join(directory,'build.json'))),
    hashes:Object.fromEntries(['ecl.js','ecl.wasm','ecl.data'].map(n=>[n,sha(fs.readFileSync(path.join(directory,n)))]))}];
}));
const oracleRoot=path.resolve('build/oracles/root'),singular=process.env.SINGULAR_BIN||path.join(oracleRoot,'usr/bin/Singular');
const env={...process.env,LD_LIBRARY_PATH:`${oracleRoot}/usr/lib/x86_64-linux-gnu:${oracleRoot}/usr/lib/x86_64-linux-gnu/singular/MOD:${process.env.LD_LIBRARY_PATH||''}`,
  SINGULARPATH:`${oracleRoot}/usr/share/singular/LIB:${oracleRoot}/usr/lib/x86_64-linux-gnu/singular/MOD`};
const timeoutMs=validateTimeoutMs(Number(process.env.GEORGE_TEST_TIMEOUT_MS??30000));
fs.mkdirSync(out,{recursive:true});
const report={state:'running',startedAt:new Date().toISOString(),source:FK_SOURCE,engines,native,singular,
  sampling:{...design,cases:undefined},cases,perCaseTimeoutMs:timeoutMs,
  method:'Exact backend/native outputs, critical ambiguities through the requested degree, normal-word dimensions and Singular two-way ideal membership plus dimensions in a Letterplace ring bounded at exactly that degree. No unrestricted ideal or high-degree completion claim.',
  results:[],timingIsDiagnosticOnly:true};
const save=()=>fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2)+'\n');
function run(executable,code,dir,name,environment=process.env){
  fs.writeFileSync(path.join(dir,name),code);
  const result=spawnSync(executable,executable===singular?['-q']:[],{cwd:dir,input:code,env:environment,
    encoding:'utf8',timeout:timeoutMs||undefined,killSignal:'SIGKILL',maxBuffer:16e6});
  fs.writeFileSync(path.join(dir,name+'.log'),(result.stdout||'')+(result.stderr||''));
  assert.ifError(result.error);assert.equal(result.status,0,name+': '+result.stderr);return result.stdout;
}
save();
try{
  for(const c of cases){
    const dir=path.join(out,c.id);fs.mkdirSync(dir,{recursive:true});report.activeCase=c.id;save();
    const nativeDir=path.join(dir,'native');fs.mkdirSync(nativeDir,{recursive:true});
    const job=buildJob(c.form);
    for(const name of Object.values(job.outputs))fs.rmSync(path.join(nativeDir,name),{force:true});
    for(const [name,text] of Object.entries(job.files))fs.writeFileSync(path.join(nativeDir,name),text);
    run(native,job.script+'\n(QUIT)\n',nativeDir,'session.lsp');
    const expected=Object.fromEntries(Object.values(job.outputs).map(n=>[n,fs.readFileSync(path.join(nativeDir,n),'utf8')]));
    assert.ok(parseBasis(expected['result.gb']).done,c.id+': bounded computation finished');
    const row={id:c.id,nativeExact:true,backends:{}};
    for(const [backend,engine] of Object.entries(engines)){
      const client=new BackendClient(engine.directory,{timeoutMs});let result;
      try{result=await client.run(buildJob({...c.form,backend}));}finally{await client.close();}
      fs.writeFileSync(path.join(dir,backend+'.outputs.json'),JSON.stringify(result.files,null,2)+'\n');
      assert.deepEqual(result.files,expected,c.id+'/'+backend+': native output');
      row.backends[backend]={exactEquality:true,elapsedMs:result.elapsedMs,memoryBytes:result.memoryBytes,
        hashes:Object.fromEntries(Object.entries(result.files).map(([n,s])=>[n,sha(s)]))};
    }
    const modulus=c.form.field==='0'?0:c.form.field==='2'?2:Number(c.form.modulus),degree=Number(c.form.maxdeg);
    const effectiveVars=c.form.reverseVars?[...c.form.vars].reverse():c.form.vars;
    const a=algebra(effectiveVars,false,modulus),gb=a.basis(expected['result.gb']);
    row.ambiguities=a.certify(c.form.rels.map(s=>a.parse(s)),gb,degree);
    row.dimensions=a.hilbert(gb,degree);
    if(c.expectedDimensions)assert.deepEqual(row.dimensions,c.expectedDimensions,c.id+': known dimensions');
    const printed=parseBasis(expected['result.gb']).groups.flatMap(g=>g.polys);
    // User names such as r can collide with Singular's ring identifiers.
    const oracleNames=Object.fromEntries(c.form.vars.map((v,i)=>[v,`fk_var_${i+1}`]));
    const normalize=s=>toBergman(parseRelation(s,c.form.vars).map(t=>({...t,factors:t.factors.map(f=>({...f,v:oracleNames[f.v]}))})));
    const code=['LIB "freealgebra.so";',`ring r=${modulus},(${[...effectiveVars].reverse().map(v=>oracleNames[v]).join(',')}),Dp;`,
      `def R=freeAlgebra(r,${degree});`,'setring R;',`ideal I=${c.form.rels.map(normalize).join(',')};`,
      `ideal B=${printed.map(normalize).join(',')||'0'};`,'ideal G=twostd(I);','ideal H=twostd(B);',
      'print("ORACLE:"+string(size(reduce(I,H)))+":"+string(size(reduce(B,G))));',
      'for(int i=1;i<=size(G);i++){print("LEAD:"+string(lead(G[i])));}','quit;'].join('\n')+'\n';
    const log=run(singular,code,dir,'singular.sing',env);
    assert.doesNotMatch(log,/^\s*\?/m,c.id+': Singular error');assert.match(log,/ORACLE:0:0/,c.id+': Singular membership');
    const oracleAlgebra=algebra(effectiveVars.map(v=>oracleNames[v]),false,modulus);
    const leads=[...log.matchAll(/^LEAD:(.+)$/gm)].map(m=>oracleAlgebra.parse(m[1]));
    assert.ok(leads.length,c.id+': Singular leading words');
    row.singular={degreeBound:degree,mutualIdealMembershipThroughBound:true,oracleNames,dimensions:oracleAlgebra.hilbert(leads,degree),
      leadingWordsSha256:sha(leads.map(g=>oracleAlgebra.lead(g)).join('\n'))};
    assert.deepEqual(row.singular.dimensions,row.dimensions,c.id+': Singular dimensions');
    row.basisElements=gb.length;report.results.push(row);save();
    console.log(c.id,`degree ${degree}: four engines + native + Singular + ${row.ambiguities} ambiguities PASS`);
  }
  report.state='complete';delete report.activeCase;
  report.summary={lhsCases:design.count,anchors:cases.length-design.count,cases:cases.length,
    backendRuns:report.results.length*Object.keys(engines).length,nativeCases:report.results.length,singularCases:report.results.length,
    ambiguities:report.results.reduce((n,r)=>n+r.ambiguities,0),maximumDegree:Math.max(...cases.map(c=>Number(c.form.maxdeg))),
    maximumSubmittedDegree:3};
}catch(error){report.state='failed';report.error=String(error.stack||error);throw error;}
finally{report.finishedAt=new Date().toISOString();save();}
