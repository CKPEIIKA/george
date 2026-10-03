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
import {stageBoundedReserveTests} from './stage-fomkyr-tests.mjs';
import {engineHashes, validationSnapshot, CheckTimings, writeJSON} from './release-support.mjs';
import {OracleCache, singularIdentity, bergmanIdentity} from './oracle-cache.mjs';
import {oraclePolynomial} from '../fomkyr/tools/oracle-format.mjs';
import {copyFomkyrSource} from './fomkyr-source.mjs';

const currentManifest=JSON.parse(fs.readFileSync('web/engine/fomkyr/build.json'));
const sourceDirectory='fomkyr';
const out=path.resolve(process.argv[2] || `build/validation/fomkyr-${Date.now()}`);
const sha=file=>crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
fs.mkdirSync(out,{recursive:true});
const timings=new CheckTimings(out),cache=new OracleCache({refresh:process.argv.includes('--refresh-oracles')});
const report={state:'running',startedAt:new Date().toISOString(),upstreamVersion:currentManifest.version,
  importedArchiveSha256:currentManifest.provenance.archiveSha256,
  engineHashes:engineHashes(),validationSourceHashes:validationSnapshot(),
  bergmanManifest:JSON.parse(fs.readFileSync('web/engine/compiled/build.json')),upstreamTests:[],cases:[],
  method:'Fomkyr primitive unreduced bases are compared by two-way bounded reduction and critical-pair certificates, not byte equality. Singular uses the same degree bound. Node OPFS is emulated; browser evidence is separate.'};
const save=()=>writeJSON(path.join(out,'report.json'),report);
if(process.argv.includes('--resume') && fs.existsSync(path.join(out,'report.json'))) {
  const previous=JSON.parse(fs.readFileSync(path.join(out,'report.json')));
  assert.deepEqual(previous.engineHashes,report.engineHashes,'Cannot resume after engine changes');
  assert.deepEqual(previous.validationSourceHashes,report.validationSourceHashes,'Cannot resume after validation source changes; use a new output directory.');
  report.startedAt=previous.startedAt;
  report.upstreamTests=previous.upstreamTests;report.cases=previous.cases;report.design=previous.design;
}
function run(command,args,{cwd=out,input,env=process.env,name,timeout=120000}={}){
  return timings.run(name,command,args,{cwd,input,env,timeout});
}
save();
try {
  const evidenceArgument=process.argv.indexOf('--upstream-report');
  if(evidenceArgument>=0){
    const evidenceFile=process.argv[evidenceArgument+1];
    const evidence=JSON.parse(fs.readFileSync(evidenceFile));
    assert.equal(evidence.state,'complete');assert.equal(evidence.upstreamVersion,report.upstreamVersion);
    assert.equal(evidence.importedArchiveSha256,report.importedArchiveSha256);
    assert.deepEqual(evidence.engineHashes,report.engineHashes);
    assert.equal(evidence.upstreamHost,'production');
    assert.ok(evidence.upstreamTests.length>=25);assert.ok(evidence.upstreamTests.every(row=>row.passed));
    report.upstreamTests=evidence.upstreamTests;report.upstreamHost=evidence.upstreamHost;report.upstreamEvidence={file:evidenceFile,sha256:sha(evidenceFile)};
  }else if(!process.argv.includes('--matrix-only')){
  const stage=path.join(out,'upstream');
  copyFomkyrSource(stage);fs.mkdirSync(path.join(stage,'results'),{recursive:true});
  // Shared suite evidence is valid only for the actual production host.
  fs.cpSync('web/engine/fomkyr',path.join(stage,'web'),{recursive:true});
  report.upstreamHost='production';
  for(const version of ['0.5','0.6','0.6.1','0.6.2','0.6.3','0.6.4'])fs.mkdirSync(path.join(stage,'results',version),{recursive:true});
  stageBoundedReserveTests(stage);
  // Older archives omitted the native field argument. Apply that correction
  // only when needed, retaining the original source and kernel.
  const nativeMatrix=path.join(stage,'tests/test_physics_matrix.py');
  const matrixSource=fs.readFileSync(nativeMatrix,'utf8'),matrixFixed=matrixSource.replaceAll('scratch=16<<20,optimize=', 'scratch=16<<20,modulus=prime,optimize=');
  fs.writeFileSync(nativeMatrix,matrixFixed);
  report.testHarnessCorrections=matrixSource===matrixFixed?[]:['Native physics matrix passes modulus=prime to both optimized and plain engines in the staging copy.'];save();
  // This suite contains thirteen separate engine jobs and a separate checker.
  // Cap each job rather than their combined runtime; retain stage-only changes.
  const compiledTest=path.join(stage,'tests/test_compiled_wasm.mjs');
  fs.writeFileSync(compiledTest,fs.readFileSync(compiledTest,'utf8')
    .replace('new FomkyrEngine({workers:4','new FomkyrEngine({timeoutMs:120000,workers:4')
    .replace('reports.push({test:key','console.log("COMPILED_JOB_PASS",key);reports.push({test:key')
    .replace(/ const manifest=path\.join\(root,'manifest\.json'\);[\s\S]*? fs\.writeFileSync\('results\/0\.6\/compiled-wasm-oracle\.log',checked\.stdout\);/, `
 const oracleCases=[];let oracleLog='';
 for(let index=0;index<entries.length;index++){
  const manifest=path.join(root,'manifest-'+index+'.json'),output=path.join(root,'oracle-'+index+'.json');
  fs.writeFileSync(manifest,JSON.stringify([entries[index]]));
  const checked=spawnSync('python3',['tests/verify_physics_wasm.py',manifest,output],{encoding:'utf8',timeout:120000});
  assert.equal(checked.status,0,checked.stdout+checked.stderr);oracleLog+=checked.stdout;
  oracleCases.push(...JSON.parse(fs.readFileSync(output)).cases);console.log('COMPILED_ORACLE_PASS',index);
 }
 fs.writeFileSync('results/0.6/compiled-wasm-oracle.json',JSON.stringify({passed:true,cases:oracleCases},null,2));
 fs.writeFileSync('results/0.6/compiled-wasm-oracle.log',oracleLog);`));
  report.testHarnessCorrections.push('Compiled-Wasm suite: 120-second deadline for each engine job and each independent serialized-basis certificate; aggregate suite limit 1800 seconds; all original cases retained.');save();
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
    ['rational-arithmetic','python3',['tests/test_rational_arithmetic.py']],
    ['rational-cases','python3',['tests/test_rational_cases.py']],
    ['compiled-edge','python3',['tests/test_compiled_rewrites.py']],
    ['compiled-fk6-certificate','python3',['tests/test_compiled_rewrites.py','--fk6']],
    ['compiled-wasm',process.execPath,['tests/test_compiled_wasm.mjs']],
    ['direct-controls',process.execPath,['tests/test_direct_controls.mjs']],
    ['modular-compatibility',process.execPath,['tests/test_modular.mjs']],
    ['audit','python3',['tests/test_audit.py']],
    ['oracle-format',process.execPath,['tests/test_oracle_format.mjs']],
    ['rational-rewrite-wasm',process.execPath,['tests/test_deep_polish_wasm.mjs']],
    ['ubsan','bash',['tools/test_ubsan.sh']],
    ...(fs.existsSync(path.join(stage,'tests/test_062_wasm.mjs'))?[
      ['big-integer-division','python3',['tests/test_big_division.py']],
      ['big-exact-fractions','python3',['tests/test_big_fraction.py']],
      ['held-out-presentations','python3',['tests/test_062_presentations.py']],
      ['four-wasm-exact-paths',process.execPath,['tests/test_062_wasm.mjs']],
    ]:[]),
    ...(fs.existsSync(path.join(stage,'tests/test_063_wasm.mjs'))?[
      ['nearby-fk-queue-parity','python3',['tests/test_063_native.py']],
      ['four-wasm-overflow-reserve',process.execPath,['tests/test_063_wasm.mjs']],
      ['cancel-acquired-reserve',process.execPath,['tests/test_063_cancel_leased.mjs']],
      ['upstream-control-roundtrip',process.execPath,['tests/test_063_controls.mjs']],
    ]:[]),
  ]) {
    if(report.upstreamTests.some(result=>result.name===name&&result.passed))continue;
    const stdout=run(executable,args,{cwd:stage,name:'upstream-'+name,env:upstreamEnv,timeout:['compiled-wasm','four-wasm-overflow-reserve','cancel-acquired-reserve'].includes(name)?1800000:120000});
    const reportName={release:'fomkyr-tests.json','static-host-unit':'static-host-unit-tests.json',
      'rational-arithmetic':'0.5/rational-arithmetic-tests.json','rational-cases':'0.5/rational-cases.json',
      'compiled-edge':'0.6/compiled-edge-tests.json','compiled-fk6-certificate':'0.6/compiled-fk6-certificate.json',
      'compiled-wasm':'0.6/compiled-wasm-tests.json','direct-controls':'0.6/direct-controls-tests.json',
      'modular-compatibility':'0.5/modular-tests.json'}[name]??(name.startsWith('physics-')?name+'.json':name+'-tests.json');
    const special={'oracle-format':{exactInterchange:true,passed:true},'upstream-control-roundtrip':{savedPreferencesPreserved:true,passed:true},
      ...(['big-integer-division','big-exact-fractions'].includes(name)?{[name]:JSON.parse(stdout.trim().split('\n').at(-1))}:{})}[name];
    const actualName={'audit':'0.6.1/audit-tests.json','rational-rewrite-wasm':'0.6.1/deep-polish-wasm.json',
      'held-out-presentations':'0.6.2/presentation-regressions.json','four-wasm-exact-paths':'0.6.2/wasm-exact.json',
      'nearby-fk-queue-parity':'0.6.3/fk-nearby.json','four-wasm-overflow-reserve':'0.6.3/reserve-wasm.json',
      'cancel-acquired-reserve':'0.6.3/cancel-leased.json'}[name]??reportName;
    report.upstreamTests.push({name,passed:true,report:name==='ubsan'?{sanitizer:'undefined',passed:true}:special??JSON.parse(fs.readFileSync(path.join(stage,'results',actualName)))});save();
    console.log('Upstream',name,'PASS');
  }
  }
  const design=fomkyrSamples(Number(process.env.FOMKYR_LHS_COUNT || 64));
  if(report.design)assert.deepEqual(report.design,design,'Cannot resume after changing the LHS design.');
  const original=JSON.parse(fs.readFileSync('test/fixtures/fomin-kirillov-user.json'));
  const submitted=readInputFile('(ALGFORMINPUT)\n'+original.inputText);
  report.design=design;save();
  const cases=[...design.cases,
    {id:'fk-E3-degree4',form:{...fominKirillov(3),field:'0',maxdeg:'4'}},
    ...[3,4].map(degree=>({id:'submitted-degree'+degree,form:{vars:submitted.vars,rels:submitted.rels,field:'0',maxdeg:String(degree),maxserdeg:String(degree)}}))];
  // Reuse the archive's coefficient and word-boundary anchors with our coordinator.
  const big=JSON.parse(fs.readFileSync(sourceDirectory+'/fixtures/big-coefficients.json'));
  const fromFixture=f=>({vars:f.variables,rels:f.relations.map(r=>r.terms.map((t,i)=>{
    const c=BigInt(t.coefficient),abs=c<0n?-c:c;
    return (c<0n?'-':i?'+':'')+(abs===1n?'':abs+'*')+t.word.map(k=>f.variables[k]).join('*');
  }).join(''))});
  cases.push({id:'archive-155-bit-coefficients',form:{...fromFixture(big),field:'0',maxdeg:'5'},coefficientBits:155});
  const physics=JSON.parse(fs.readFileSync(sourceDirectory+'/fixtures/physics-matrix.json'));
  for(const fixture of physics.filter(f=>f.name.startsWith('homogenized-')||['commuting-polynomial-4','exterior-6','homogeneous-braid-3'].includes(f.name)))
    for(const prime of [0,2,101])cases.push({id:`physics-${fixture.name}-p${prime}`,form:{...fromFixture(fixture),field:prime===0?'0':prime===2?'2':'p',modulus:String(prime),maxdeg:'4'}});
  const root=path.resolve('build/oracles/root'),singular=path.join(root,'usr/bin/Singular');
  const env={...process.env,LD_LIBRARY_PATH:`${root}/usr/lib/x86_64-linux-gnu:${root}/usr/lib/x86_64-linux-gnu/singular/MOD`,
    SINGULAR_PROCS_DIR:path.join(root,'usr/lib/x86_64-linux-gnu/singular/MOD'),
    SINGULARPATH:`${root}/usr/share/singular/LIB:${root}/usr/lib/x86_64-linux-gnu/singular/MOD`};
  const singularBuild=singularIdentity(root),bergmanBuild=bergmanIdentity();
  for (const c of cases) {
    if(report.cases.some(result=>result.id===c.id))continue;
    const form={task:'gb',ring:'noncomm',order:'degleftlex',field:'0',...c.form,
      nonhomog:'degreewise',strategy:'default',lowterms:'quick',outmode:'ALG',legacy:false,memoryMiB:128};
    const dir=path.join(out,c.id);fs.mkdirSync(dir,{recursive:true});
    const referenceJob=buildJob({...form,backend:'compiled'});
    const reference=await cache.obtain('bergman-basis',{files:referenceJob.files,script:referenceJob.script},bergmanBuild,
      ()=>timings.measure(c.id+'-bergman',async()=>{
        const client=new BackendClient(path.resolve('web/engine/compiled'),{timeoutMs:30000});
        try{return (await client.run(referenceJob)).files['result.gb'];}finally{await client.close();}
      }),text=>assert.equal(parseBasis(text).done,true));
    fs.writeFileSync(path.join(dir,'bergman.gb'),reference.value);
    const vars=form.reverseVars?[...form.vars].reverse():form.vars;
    const modulus=form.field==='0'?0:form.field==='2'?2:Number(form.modulus);
    const degree=Number(form.maxdeg),a=algebra(vars,false,modulus);
    const expected=a.basis(reference.value),input=form.rels.map(r=>a.parse(r));
    const names=vars.map((v,i)=>'gn_var_'+i),ids=Object.fromEntries(vars.map((v,i)=>[v,names[i]]));
    const convert=p=>toBergman(parseRelation(p,vars).map(t=>({...t,factors:t.factors.map(f=>({...f,v:ids[f.v]}))})));
    // The oracle script depends solely on the presentation, never on candidate output.
    const code=`LIB "freegb.lib";\nring gn_r=${modulus},(${[...names].reverse().join(',')}),Dp;\ndef gn_a=freeAlgebra(gn_r,${degree});\nsetring gn_a;\nideal I=${form.rels.map(convert).join(',')||'0'};\nideal G=twostd(I);\nfor(int j=1;j<=size(G);j++){print("POLY:"+string(G[j]));}\nprint("ORACLE_DONE");\nquit;\n`;
    fs.writeFileSync(path.join(dir,'singular.sing'),code);
    const singularReference=await cache.obtain('singular-basis',{source:code},singularBuild,
      ()=>run(singular,['-q'],{cwd:dir,input:code,env,name:c.id+'-singular',timeout:30000}),log=>{
        assert.doesNotMatch(log,/^\s*\?|Could not find dynamic library/m);assert.match(log,/ORACLE_DONE/);
      });
    fs.writeFileSync(path.join(dir,'singular.log'),singularReference.value);
    const oracle=algebra(names,false,modulus),oracleBasis=[...singularReference.value.matchAll(/^POLY:(.+)$/gm)]
      .map(m=>oracle.monic(oraclePolynomial(m[1],oracle,names))).filter(p=>p.size);
    const row={id:c.id,degree,vars,modulus,dimensions:a.hilbert(expected,degree),engines:[],
      references:{bergman:{key:reference.key,reused:reference.reused},singular:{key:singularReference.key,reused:singularReference.reused}}};
    for(const [bits,execution,workers] of [[32,'single',1],[32,'multicore',4],[64,'single',1],[64,'multicore',4]]) {
      const client=new BackendClient(path.join(dir,`storage-${bits}-${execution}`),{timeoutMs:30000,workerURL:new URL('../test/support/fomkyr-worker.mjs',import.meta.url)});
      let r;
      try{r=await timings.measure(c.id+`-${bits}-${execution}`,()=>client.run({...buildJob({...form,backend:'fomkyr'}),fomkyrOptions:{...buildJob({...form,backend:'fomkyr'}).fomkyrOptions,bits,execution,workers,spill:true,resume:false,hilbert:true}}));}finally{await client.close();}
      const text=r.files['result.gb'];assert.equal(parseBasis(text).done,true);
      fs.writeFileSync(path.join(dir,`fomkyr-${bits}-${execution}.gb`),text);
      const gb=a.basis(text),ambiguities=a.certify(input,gb,degree);
      for(const p of gb)assert.equal(a.nf(p,expected).size,0,c.id+': native belongs to reference ideal');
      for(const p of expected)assert.equal(a.nf(p,gb).size,0,c.id+': reference belongs to native ideal');
      for(const p of gb)assert.equal(a.nf(p,oracleBasis).size,0,c.id+': native belongs to Singular ideal');
      for(const p of oracleBasis)assert.equal(a.nf(p,gb).size,0,c.id+': Singular belongs to native ideal');
      assert.deepEqual(oracleBasis.map(oracle.lead).sort(),gb.map(a.lead).sort());
      assert.deepEqual(a.hilbert(gb,degree),row.dimensions);
      if(c.coefficientBits)assert.ok([...text.matchAll(/\d+\*/g)].some(m=>BigInt(m[0].slice(0,-1)).toString(2).length===c.coefficientBits));
      assert.equal(r.bits,bits);assert.equal(r.shared,execution==='multicore');assert.equal(r.workers,workers);
      assert.deepEqual(r.hilbert.coefficients,row.dimensions.map(String));
      row.engines.push({bits,execution,workers,passed:true,ambiguities,basisSize:gb.length,elapsedSeconds:r.elapsedMs/1000,memoryBytes:r.memoryBytes,hilbertMatches:true});
      if(bits===32 && execution==='single') {
        assert.deepEqual(oracle.hilbert(oracleBasis,degree),row.dimensions);
        row.singular={passed:true,degreeBound:degree,mutualIdealMembership:true,leadingWordsMatch:true,dimensions:row.dimensions};
      }
    }
    report.cases.push(row);save();console.log(c.id,'four WASM variants + Bergman + Singular PASS');
  }
  report.state='complete';report.summary={cases:report.cases.length,fomkyrRuns:report.cases.length*4,
    singularCases:report.cases.length,oracleCacheHits:cache.hits,oracleCalculations:cache.misses,
    ambiguities:report.cases.reduce((n,c)=>n+c.engines.reduce((s,e)=>s+e.ambiguities,0),0)};
} catch(error) {report.state='failed';report.error=error.stack||String(error);throw error;}
finally {report.finishedAt=new Date().toISOString();save();}
