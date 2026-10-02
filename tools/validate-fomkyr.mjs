// Archive tests + bounded FK parity against Bergman and Singular.
// No bundled high-degree benchmark results are treated as fresh evidence.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {buildJob, parseBasis, parseRelation, readInputFile, toBergman} from '../web/src/bergman-syntax.js';
import {fomkyrSamples} from '../test/support/fomkyr-lhs.mjs';
import {fominKirillovSamples, fominKirillov} from '../test/support/fomin-kirillov.mjs';
import {BackendClient} from '../test/support/backend-client.mjs';
import {algebra} from '../test/support/algebra.mjs';

const out=path.resolve(process.argv[2] || `build/validation/fomkyr-${Date.now()}`);
const sha=file=>crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
fs.mkdirSync(out,{recursive:true});
const report={state:'running',startedAt:new Date().toISOString(),upstreamVersion:'0.4.0',
  importedArchiveSha256:'d6feec734d25a1901d2cb3c582caa150d0e91bdfb22b541f1c2da06e9739c20a',
  engineHashes:Object.fromEntries(['fomkyr32.wasm','fomkyr64.wasm','fomkyr32-single.wasm','fomkyr64-single.wasm','engine.js','runtime.js','job-adapter.js'].map(n=>[n,sha('web/engine/fomkyr/'+n)])),
  bergmanManifest:JSON.parse(fs.readFileSync('web/engine/compiled/build.json')),upstreamTests:[],cases:[],
  method:'Fomkyr primitive unreduced bases are compared by two-way bounded reduction and critical-pair certificates, not byte equality. Singular uses the same degree bound. Node OPFS is emulated; browser evidence is separate.'};
const save=()=>fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2)+'\n');
if(process.argv.includes('--resume') && fs.existsSync(path.join(out,'report.json'))) {
  const previous=JSON.parse(fs.readFileSync(path.join(out,'report.json')));
  assert.deepEqual(previous.engineHashes,report.engineHashes,'Cannot resume after engine changes');
  report.upstreamTests=previous.upstreamTests;report.cases=previous.cases;
}
function run(command,args,{cwd=out,input,env=process.env,name,timeout=120000}={}){
  const r=spawnSync(command,args,{cwd,input,env,timeout,encoding:'utf8',maxBuffer:16e6,killSignal:'SIGKILL'});
  fs.writeFileSync(path.join(out,name+'.log'),(r.stdout||'')+(r.stderr||''));
  assert.ifError(r.error);assert.equal(r.status,0,name+': '+r.stderr);return r.stdout;
}
save();
try {
  const stage=path.join(out,'upstream');
  fs.cpSync('vendor/fomkyr-0.4.0',stage,{recursive:true});fs.mkdirSync(path.join(stage,'results'),{recursive:true});
  // The archive's native field matrix forgot to pass its loop's modulus.
  // Correct only the test copy; keep the imported source and kernel intact.
  const nativeMatrix=path.join(stage,'tests/test_physics_matrix.py');
  fs.writeFileSync(nativeMatrix,fs.readFileSync(nativeMatrix,'utf8').replaceAll('scratch=16<<20,optimize=', 'scratch=16<<20,modulus=prime,optimize='));
  report.testHarnessCorrections=['Native physics matrix passes modulus=prime to both optimized and plain engines in the staging copy.'];save();
  // Upstream fixture tests invoke `python`; provide a local alias on hosts
  // which install only python3, without modifying the imported sources.
  const bin=path.join(out,'bin');fs.mkdirSync(bin,{recursive:true});
  fs.writeFileSync(path.join(bin,'python'),'#!/bin/sh\nexec python3 "$@"\n',{mode:0o755});
  const upstreamEnv={...process.env,PATH:bin+path.delimiter+process.env.PATH};
  run(process.env.CLANG||'/usr/bin/clang',['-std=c11','-O3','-flto','-fno-builtin','-fPIC','-shared',
    'src/kernel.c','tests/host.c','-o','dist/libfomkyr.so','-fuse-ld=lld'],{cwd:stage,name:'upstream-build-native'});
  for (const [name,executable,args] of [
    ['native','python3',['tests/test_native.py']],
    ['extra','python3',['tests/test_extra.py']],
    ['wasm',process.execPath,['tests/test_wasm.mjs']],
    ['release',process.execPath,['tests/test_fomkyr.mjs']],
    ['compatibility',process.execPath,['tests/test_compatibility.mjs']],
    ['integration',process.execPath,['tests/test_integration.mjs']],
    ['static-host-unit','node',['tests/test_static_host.mjs']],
    ['installer','python3',['tests/test_installer.py']],
    ['installer-modern','python3',['tests/test_installer_modern.py']],
    ['optimizer-edge','python3',['tests/test_optimizer_edges.py']],
    ['physics-matrix','python3',['tests/test_physics_matrix.py']],
    ['physics-wasm-matrix',process.execPath,['tests/test_physics_wasm.mjs']],
    ['progress-unit',process.execPath,['tests/test_progress.mjs']],
    ['progress-integration',process.execPath,['tests/test_progress_integration.mjs']],
    ['ubsan','bash',['tools/test_ubsan.sh']],
  ]) {
    if(report.upstreamTests.some(result=>result.name===name&&result.passed))continue;
    run(executable,args,{cwd:stage,name:'upstream-'+name,env:upstreamEnv});
    const reportName=name==='release'?'fomkyr-tests.json':name==='static-host-unit'?'static-host-unit-tests.json':name.startsWith('physics-')?name+'.json':name+'-tests.json';
    report.upstreamTests.push({name,passed:true,report:name==='ubsan'?{sanitizer:'undefined',passed:true}:JSON.parse(fs.readFileSync(path.join(stage,'results',reportName)))});save();
    console.log('Upstream',name,'PASS');
  }
  const design=fomkyrSamples(Number(process.env.FOMKYR_LHS_COUNT || 48));
  const original=JSON.parse(fs.readFileSync('test/fixtures/fomin-kirillov-user.json'));
  const submitted=readInputFile('(ALGFORMINPUT)\n'+original.inputText);
  report.design=design;save();
  const cases=[...design.cases,
    {id:'fk-E3-degree4',form:{...fominKirillov(3),field:'0',maxdeg:'4'}},
    ...[3,4].map(degree=>({id:'submitted-degree'+degree,form:{vars:submitted.vars,rels:submitted.rels,field:'0',maxdeg:String(degree),maxserdeg:String(degree)}}))];
  // Reuse the archive's coefficient and word-boundary anchors with our coordinator.
  const big=JSON.parse(fs.readFileSync('vendor/fomkyr-0.4.0/fixtures/big-coefficients.json'));
  const fromFixture=f=>({vars:f.variables,rels:f.relations.map(r=>r.terms.map((t,i)=>{
    const c=BigInt(t.coefficient),abs=c<0n?-c:c;
    return (c<0n?'-':i?'+':'')+(abs===1n?'':abs+'*')+t.word.map(k=>f.variables[k]).join('*');
  }).join(''))});
  cases.push({id:'archive-155-bit-coefficients',form:{...fromFixture(big),field:'0',maxdeg:'5'},coefficientBits:155});
  const physics=JSON.parse(fs.readFileSync('vendor/fomkyr-0.4.0/fixtures/physics-matrix.json'));
  for(const fixture of physics.filter(f=>f.name.startsWith('homogenized-')||['commuting-polynomial-4','exterior-6','homogeneous-braid-3'].includes(f.name)))
    for(const prime of [0,2,101])cases.push({id:`physics-${fixture.name}-p${prime}`,form:{...fromFixture(fixture),field:prime===0?'0':prime===2?'2':'p',modulus:String(prime),maxdeg:'4'}});
  const root=path.resolve('build/oracles/root'),singular=path.join(root,'usr/bin/Singular');
  const env={...process.env,LD_LIBRARY_PATH:`${root}/usr/lib/x86_64-linux-gnu:${root}/usr/lib/x86_64-linux-gnu/singular/MOD`,
    SINGULARPATH:`${root}/usr/share/singular/LIB:${root}/usr/lib/x86_64-linux-gnu/singular/MOD`};
  for (const c of cases) {
    if(report.cases.some(result=>result.id===c.id))continue;
    const form={task:'gb',ring:'noncomm',order:'degleftlex',field:'0',...c.form,
      nonhomog:'degreewise',strategy:'default',lowterms:'quick',outmode:'ALG',legacy:false,memoryMiB:128};
    const dir=path.join(out,c.id);fs.mkdirSync(dir,{recursive:true});
    const referenceClient=new BackendClient(path.resolve('web/engine/compiled'),{timeoutMs:30000});
    let reference;
    try{reference=await referenceClient.run(buildJob({...form,backend:'compiled'}));}finally{await referenceClient.close();}
    fs.writeFileSync(path.join(dir,'bergman.gb'),reference.files['result.gb']);
    const vars=form.reverseVars?[...form.vars].reverse():form.vars;
    const modulus=form.field==='0'?0:form.field==='2'?2:Number(form.modulus);
    const degree=Number(form.maxdeg),a=algebra(vars,false,modulus);
    const expected=a.basis(reference.files['result.gb']),input=form.rels.map(r=>a.parse(r));
    const row={id:c.id,degree,vars,modulus,dimensions:a.hilbert(expected,degree),engines:[]};
    for(const [bits,execution,workers] of [[32,'single',1],[32,'multicore',4],[64,'single',1],[64,'multicore',4]]) {
      const client=new BackendClient(path.join(dir,`storage-${bits}-${execution}`),{timeoutMs:30000,workerURL:new URL('../test/support/fomkyr-worker.mjs',import.meta.url)});
      let r;
      try{r=await client.run({...buildJob({...form,backend:'fomkyr'}),fomkyrOptions:{...buildJob({...form,backend:'fomkyr'}).fomkyrOptions,bits,execution,workers,scratchBytes:32*1048576,spill:true,resume:false,hilbert:true}});}finally{await client.close();}
      const text=r.files['result.gb'];assert.equal(parseBasis(text).done,true);
      fs.writeFileSync(path.join(dir,`fomkyr-${bits}-${execution}.gb`),text);
      const gb=a.basis(text),ambiguities=a.certify(input,gb,degree);
      for(const p of gb)assert.equal(a.nf(p,expected).size,0,c.id+': native belongs to reference ideal');
      for(const p of expected)assert.equal(a.nf(p,gb).size,0,c.id+': reference belongs to native ideal');
      assert.deepEqual(a.hilbert(gb,degree),row.dimensions);
      if(c.coefficientBits)assert.ok([...text.matchAll(/\d+\*/g)].some(m=>BigInt(m[0].slice(0,-1)).toString(2).length===c.coefficientBits));
      assert.equal(r.bits,bits);assert.equal(r.shared,execution==='multicore');assert.equal(r.workers,workers);
      assert.deepEqual(r.hilbert.coefficients,row.dimensions.map(String));
      row.engines.push({bits,execution,workers,passed:true,ambiguities,basisSize:gb.length,elapsedSeconds:r.elapsedMs/1000,memoryBytes:r.memoryBytes,hilbertMatches:true});
      if(bits===32 && execution==='single') {
        const names=vars.map((v,i)=>'gn_var_'+i),ids=Object.fromEntries(vars.map((v,i)=>[v,names[i]]));
        const convert=p=>toBergman(parseRelation(p,vars).map(t=>({...t,factors:t.factors.map(f=>({...f,v:ids[f.v]}))})));
        const polys=parseBasis(text).groups.flatMap(g=>g.polys);
        const code=`LIB "freegb.lib";\nring gn_r=${modulus},(${[...names].reverse().join(',')}),Dp;\ndef gn_a=freeAlgebra(gn_r,${degree});\nsetring gn_a;\nideal I=${form.rels.map(convert).join(',')||'0'};\nideal B=${polys.map(convert).join(',')||'0'};\nideal G=twostd(I);\nideal H=twostd(B);\nprint("ORACLE:"+string(size(reduce(B,G)))+":"+string(size(reduce(I,H))));\nfor(int j=1;j<=size(G);j++){print("LEAD:"+string(lead(G[j])));}\nquit;\n`;
        fs.writeFileSync(path.join(dir,'singular.sing'),code);
        const log=run(singular,['-q'],{cwd:dir,input:code,env,name:c.id+'-singular',timeout:30000});
        assert.doesNotMatch(log,/^\s*\?/m);assert.match(log,/ORACLE:0:0/);
        const oracle=algebra(names,false,modulus),leaders=[...log.matchAll(/^LEAD:(.+)$/gm)].map(m=>oracle.parse(m[1]));
        assert.deepEqual(oracle.hilbert(leaders,degree),row.dimensions);
        const leading=leaders.map(oracle.lead).sort();
        assert.deepEqual(leading,gb.map(a.lead).sort());
        row.singular={passed:true,degreeBound:degree,mutualIdealMembership:true,leadingWordsMatch:true,dimensions:row.dimensions};
      }
    }
    report.cases.push(row);save();console.log(c.id,'four WASM variants + Bergman + Singular PASS');
  }
  report.state='complete';report.summary={cases:report.cases.length,fomkyrRuns:report.cases.length*4,
    singularCases:report.cases.length,ambiguities:report.cases.reduce((n,c)=>n+c.engines.reduce((s,e)=>s+e.ambiguities,0),0)};
} catch(error) {report.state='failed';report.error=error.stack||String(error);throw error;}
finally {report.finishedAt=new Date().toISOString();save();}
