// Additional tests adapted from pinned Singular, SymPy and GAP GBNP sources.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {buildJob,parseBasis} from '../web/src/bergman-syntax.js';
import {algebra} from '../test/support/algebra.mjs';
import {wasmRuntime} from '../test/support/regression.mjs';

const fixturePath='test/fixtures/upstream-cases.json';
const fixture=JSON.parse(fs.readFileSync(fixturePath,'utf8'));
const out=path.resolve(process.argv[2]||`build/validation/upstream-${Date.now()}`);
const nativeOnly=process.argv[3]==='--native-only';
fs.mkdirSync(out,{recursive:true});
const native=path.resolve(process.env.BERGMAN_SBCL||'build/sbcl-upstream-final-20260930/bin/clisp/unix/bergman');
assert.ok(fs.existsSync(native),'Build the native SBCL reference or set BERGMAN_SBCL.');
const oracleRoot=path.resolve('build/oracles/root');
const singular=process.env.SINGULAR_BIN||`${oracleRoot}/usr/bin/Singular`;
const env={...process.env,LD_LIBRARY_PATH:`${oracleRoot}/usr/lib/x86_64-linux-gnu:${process.env.LD_LIBRARY_PATH||''}`,
  SINGULARPATH:`${oracleRoot}/usr/share/singular/LIB:${oracleRoot}/usr/lib/x86_64-linux-gnu/singular/MOD`};
const sha=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
for(const source of fixture.sources){
  const file=path.join('build/oracles/upstream-tests',source.repository.replace('/', '-'),source.path);
  assert.ok(fs.existsSync(file),'Run python3 tools/setup-upstream-tests.py: '+source.id);
  assert.equal(sha(file),source.sha256,source.id+': source digest');
}
const validatorFiles=['tools/validate-upstream.mjs','tools/upstream-sympy.py','test/fixtures/upstream-cases.json','test/support/algebra.mjs','ports/common/behavior-patches.py','ports/common/george-overlay.sl','web/src/bergman-syntax.js','web/engine/runner.js'];
const report={validatorHashes:Object.fromEntries(validatorFiles.map(p=>[p,sha(p)])),date:new Date().toISOString(),fixtureSha256:sha(fixturePath),engine:JSON.parse(fs.readFileSync('web/engine/build.json','utf8')),
  native,sources:fixture.sources,cases:[]};
const run=(bin,args,code,dir,name,extra={})=>{
  const r=spawnSync(bin,args,{input:code,encoding:'utf8',cwd:dir,timeout:30000,killSignal:'SIGKILL',maxBuffer:16e6,...extra});
  fs.writeFileSync(path.join(dir,name),(r.stdout||'')+(r.stderr||''));
  assert.ifError(r.error);assert.equal(r.status,0,`${name}: process failed`);
  return r.stdout;
};
function singularCheck(c,basis,dir){
  const degree=c.maxdeg;
  const order=c.weights?`Wp(${[...c.weights].reverse().join(',')})`:'Dp';
  const code=[c.comm?'':'LIB "freealgebra.so";',`ring r=${c.p},(${(c.comm?c.vars:[...c.vars].reverse()).join(',')}),${order};`,
    // Letterplace needs room for its internal shifts as well as final words.
    // Weighted cases keep the weighted certificate bound below, while providing
    // at least that many word positions to Singular's shift algorithm.
    ...(c.comm?[]:[`def R=freeAlgebra(r,${c.weights?degree+2:c.scope==='degree-bound'?degree:degree+2});`,'setring R;']),
    'option(redSB);','option(redTail);',`ideal I=${c.rels.join(',')};`,`ideal B=${basis.join(',')||'0'};`,
    ...(c.weights?[`degBound=${degree};`]:[]),
    `ideal G=${c.comm?'std':'twostd'}(I);`,
    ...(c.scope==='complete'?['ideal L=G;']:[`ideal L;for(int k=1;k<=size(G);k++){if(deg(G[k])<=${degree}){L[size(L)+1]=G[k];}}`]),
    'print("ORACLE:"+string(size(reduce(I,B)))+":"+string(size(reduce(B,G)))+":"+string(size(reduce(L,B))));',
    'quit;'].join('\n')+'\n';
  fs.writeFileSync(path.join(dir,'oracle.sing'),code);
  const text=run(singular,['-q'],code,dir,'singular.log',{env});
  assert.doesNotMatch(text,/^\s*\?/m);assert.match(text,/ORACLE:0:0:0/,'all three ideal membership checks');
  return {oracle:'Singular',idealEquality:true,oracleBasisReduction:true};
}
function pluralCheck(c,basis,dir){
  const p=c.plural;
  const code=[`ring r=${c.p},(${p.vars.join(',')}),dp;`,'matrix D[3][3];',
    `D[1,2]=${p.d[0]};D[1,3]=${p.d[1]};D[2,3]=${p.d[2]};`,
    'def A=nc_algebra(1,D);setring A;',`ideal I=${p.ideal.join(',')};`,`ideal B=${basis.join(',')||'0'};`,
    'ideal G=twostd(I);ideal H=twostd(B);',
    'print("PLURAL:"+string(size(reduce(I,H)))+":"+string(size(reduce(B,G)))+":"+string(size(reduce(G,H))));',
    'print("DIM:"+string(vdim(G)));','quit;'].join('\n')+'\n';
  fs.writeFileSync(path.join(dir,'plural.sing'),code);
  const text=run(singular,['-q'],code,dir,'plural.log',{env});
  assert.doesNotMatch(text,/^\s*\?/m);assert.match(text,/PLURAL:0:0:0/);
  const dimension=Number(/DIM:(\d+)/.exec(text)?.[1]);assert.ok(Number.isSafeInteger(dimension));
  return {pluralIdealEquality:true,pluralDimension:dimension};
}
try{
  report.sympyReference=JSON.parse(run(process.env.PYTHON||'python3',[path.resolve('tools/upstream-sympy.py'),'--reference-tests'],'',out,'sympy-reference.json'));
  assert.equal(report.sympyReference.version,'1.14.0');assert.equal(report.sympyReference.passed,10);
  for(const input of fixture.cases)for(const p of input.fields){
    const c={...input,p},id=`${c.id}-F${p}`,dir=path.join(out,id);fs.mkdirSync(dir);
    const form={task:'gb',ring:c.comm?'comm':'noncomm',order:c.comm?'deglex':'degleftlex',
      field:p?'p':'0',modulus:p,vars:c.vars,rels:c.rels,maxdeg:c.maxdeg,lowterms:'safe',weights:c.weights?.join(' ')};
    const job=buildJob(form);
    const identityProbe=c.id===fixture.cases[0].id&&p===0;
    if(identityProbe)job.script='(SETLEGACYMODE T)\n(PRIN2 "ORIGINAL-VERSION:") (PRINT BMVERSIONSTRING)\n(SETLEGACYMODE NIL)\n(PRIN2 "FIXED-VERSION:") (PRINT BMVERSIONSTRING)\n'+job.script;

    for(const [file,text]of Object.entries(job.files))fs.writeFileSync(path.join(dir,file),text);
    fs.writeFileSync(path.join(dir,'session.lsp'),job.script+'\n(QUIT)\n');
    const started=performance.now();
    run(native,[],job.script+'\n(QUIT)\n',dir,'native.log');
    const nativeMs=performance.now()-started;
    if(identityProbe){
      const log=fs.readFileSync(path.join(dir,'native.log'),'utf8');
      assert.match(log,/ORIGINAL-VERSION:[\s\S]*?"Bergman 1\.001/);
      assert.match(log,/FIXED-VERSION:[\s\S]*?"bergman-1\.001-fix"/);
      report.engineIdentity={fixed:'bergman-1.001-fix',legacy:'Bergman 1.001'};
    }
    const nativeText=fs.readFileSync(path.join(dir,job.outputs.gb),'utf8');
    let text=nativeText,wasmMs=null;
    if(!nativeOnly){
      const rt=await wasmRuntime({onOutput:line=>fs.appendFileSync(path.join(dir,'wasm.log'),line+'\n')});
      const result=rt.run(job);text=result.files[job.outputs.gb];wasmMs=result.elapsedMs;
      assert.equal(text,nativeText,`${id}: native/Wasm equality`);
      if(identityProbe){assert.match(result.stdout,/ORIGINAL-VERSION:[\s\S]*?"Bergman 1\.001/);assert.match(result.stdout,/FIXED-VERSION:[\s\S]*?"bergman-1\.001-fix"/);}
      fs.writeFileSync(path.join(dir,'wasm.gb'),text);
    }
    const a=algebra(c.vars,c.comm,p,c.weights),gb=a.basis(text);
    const ambiguities=a.certify(c.rels.map(a.parse),gb,c.scope==='complete'?Infinity:c.maxdeg);
    const basis=parseBasis(text).groups.flatMap(g=>g.polys);
    const row={id,source:c.source,modulus:p,scope:c.scope,degreeBound:c.maxdeg,basisSize:gb.length,
      nativeEquality:!nativeOnly,ambiguities,nativeMs,wasmMs,...singularCheck(c,basis,dir)};
    if(c.comm){
      const args={vars:c.vars,rels:c.rels,basis,modulus:p};
      fs.writeFileSync(path.join(dir,'sympy-input.json'),JSON.stringify(args,null,2));
      const reference=JSON.parse(run(process.env.PYTHON||'python3',[path.resolve('tools/upstream-sympy.py')],JSON.stringify(args),dir,'sympy.json'));
      assert.deepEqual(a.hilbert(gb,6),reference.dimensions);
      row.sympy=reference;
    }
    if(c.plural){
      Object.assign(row,pluralCheck(c,basis,dir));
      const dimensions=a.hilbert(gb,16);
      assert.equal(dimensions.at(-1),0,'finite PBW quotient tail');
      assert.equal(dimensions.reduce((sum,n)=>sum+n,0),row.pluralDimension);
    }
    if(c.expectedFields.includes(p)){
      if(c.expectedBasis){
        const reference=c.referenceOrder==='degree-lex'?algebra(c.vars,c.comm,p,c.weights,c.vars.map(()=>1)):a;
        const expected=c.expectedBasis.map(reference.parse).filter(f=>f.size).map(reference.monic);
        reference.certify(c.rels.map(reference.parse),expected,c.scope==='complete'?Infinity:c.maxdeg);
        for(const f of expected)assert.equal(a.nf(f,gb).size,0,'upstream basis reduces in Bergman');
        for(const f of gb)assert.equal(reference.nf(f,expected).size,0,'Bergman basis reduces in upstream reference');
        row.upstreamBasisEquality=true;
      }
      for(const probe of c.normalForms||[]){
        assert.deepEqual(a.nf(a.parse(probe.input),gb),a.nf(a.parse(probe.result),gb));
      }
      if(c.normalForms)row.normalFormProbes=c.normalForms.length;
      if(c.expectedDimensions){assert.deepEqual(a.hilbert(gb,c.maxdeg),c.expectedDimensions);row.upstreamDimensions=true;}
      if(c.expectedDimension!==undefined){
        const dimensions=a.hilbert(gb,10);assert.equal(dimensions.at(-1),0);
        assert.equal(dimensions.reduce((sum,n)=>sum+n,0),c.expectedDimension);row.upstreamDimension=c.expectedDimension;
      }
    }
    report.cases.push(row);fs.writeFileSync(path.join(out,'partial-report.json'),JSON.stringify(report,null,2));
    console.log(id,'PASS',gb.length,'basis polynomials;',ambiguities,'critical ambiguities');
  }
  assert.equal(report.cases.length,fixture.cases.reduce((n,c)=>n+c.fields.length,0));
  fs.writeFileSync(path.join(out,nativeOnly?'native-report.json':'report.json'),JSON.stringify(report,null,2));console.log(out);
}catch(error){fs.writeFileSync(path.join(out,'partial-report.json'),JSON.stringify(report,null,2));console.error(error);process.exitCode=1;}
