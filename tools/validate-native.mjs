// Archive tests + bounded FK parity against Bergman and Singular.
// No bundled high-degree benchmark results are treated as fresh evidence.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {buildJob, parseBasis, parseRelation, readInputFile, toBergman} from '../web/src/bergman-syntax.js';
import {NATIVE_CAPABILITIES} from '../web/src/native-capabilities.js';
import {fominKirillovSamples, fominKirillov} from '../test/support/fomin-kirillov.mjs';
import {BackendClient} from '../test/support/backend-client.mjs';
import {algebra} from '../test/support/algebra.mjs';

const out=path.resolve(process.argv[2] || `build/validation/native-${Date.now()}`);
const sha=file=>crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
fs.mkdirSync(out,{recursive:true});
const report={state:'running',startedAt:new Date().toISOString(),upstreamVersion:'0.1.0-experimental',
  importedArchiveSha256:'a517030392eb2db53fbf919817ce78132a8d45a1afefa907d718decc117ac1c9',
  engineHashes:Object.fromEntries(['george32.wasm','george64.wasm','engine.js','runtime.js','job-adapter.js'].map(n=>[n,sha('web/engine/native/'+n)])),
  bergmanManifest:JSON.parse(fs.readFileSync('web/engine/compiled/build.json')),upstreamTests:[],cases:[],
  method:'Native primitive unreduced bases are compared by two-way bounded reduction and critical-pair certificates, not byte equality. Singular uses the same degree bound. Node OPFS is emulated; browser evidence is separate.'};
const save=()=>fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2)+'\n');
function run(command,args,{cwd=out,input,env=process.env,name,timeout=120000}={}){
  const r=spawnSync(command,args,{cwd,input,env,timeout,encoding:'utf8',maxBuffer:16e6,killSignal:'SIGKILL'});
  fs.writeFileSync(path.join(out,name+'.log'),(r.stdout||'')+(r.stderr||''));
  assert.ifError(r.error);assert.equal(r.status,0,name+': '+r.stderr);return r.stdout;
}
save();
try {
  const stage=path.join(out,'upstream');
  fs.cpSync('vendor/george-native-0.1.0',stage,{recursive:true});fs.mkdirSync(path.join(stage,'results'));
  run(process.env.CLANG||'/usr/bin/clang',['-std=c11','-O3','-flto','-fno-builtin','-fPIC','-shared',
    'src/kernel.c','tests/host.c','-o','dist/libgeorge.so','-fuse-ld=lld'],{cwd:stage,name:'upstream-build-native'});
  for (const [name,executable,args] of [
    ['native','python3',['tests/test_native.py']],
    ['extra','python3',['tests/test_extra.py']],
    ['wasm',process.execPath,['tests/test_wasm.mjs']],
    ['integration',process.execPath,['tests/test_integration.mjs']],
  ]) {
    run(executable,args,{cwd:stage,name:'upstream-'+name});
    report.upstreamTests.push({name,passed:true,report:JSON.parse(fs.readFileSync(path.join(stage,'results',name==='extra'?'extra-tests.json':name+'-tests.json')))});save();
    console.log('Upstream',name,'PASS');
  }
  const design=fominKirillovSamples(16);
  const original=JSON.parse(fs.readFileSync('test/fixtures/fomin-kirillov-user.json'));
  const submitted=readInputFile('(ALGFORMINPUT)\n'+original.inputText);
  const cases=[...design.cases,
    {id:'fk-E3-degree4',form:{...fominKirillov(3),field:'0',maxdeg:'4'}},
    {id:'submitted-degree3',form:{vars:submitted.vars,rels:submitted.rels,field:'0',maxdeg:'3'}}];
  // Reuse the archive's coefficient and word-boundary anchors with our coordinator.
  const big=JSON.parse(fs.readFileSync('vendor/george-native-0.1.0/fixtures/big-coefficients.json'));
  const fromFixture=f=>({vars:f.variables,rels:f.relations.map(r=>r.terms.map((t,i)=>{
    const c=BigInt(t.coefficient),abs=c<0n?-c:c;
    return (c<0n?'-':i?'+':'')+(abs===1n?'':abs+'*')+t.word.map(k=>f.variables[k]).join('*');
  }).join(''))});
  cases.push({id:'archive-155-bit-coefficients',form:{...fromFixture(big),field:'0',maxdeg:'5'},coefficientBits:155});
  const root=path.resolve('build/oracles/root'),singular=path.join(root,'usr/bin/Singular');
  const env={...process.env,LD_LIBRARY_PATH:`${root}/usr/lib/x86_64-linux-gnu:${root}/usr/lib/x86_64-linux-gnu/singular/MOD`,
    SINGULARPATH:`${root}/usr/share/singular/LIB:${root}/usr/lib/x86_64-linux-gnu/singular/MOD`};
  for (const c of cases) {
    const form={task:'gb',ring:'noncomm',order:'degleftlex',field:'0',...c.form,
      ...NATIVE_CAPABILITIES.fixedSettings,memoryMiB:128};
    const dir=path.join(out,c.id);fs.mkdirSync(dir);
    const referenceClient=new BackendClient(path.resolve('web/engine/compiled'),{timeoutMs:30000});
    let reference;
    try{reference=await referenceClient.run(buildJob({...form,backend:'compiled'}));}finally{await referenceClient.close();}
    fs.writeFileSync(path.join(dir,'bergman.gb'),reference.files['result.gb']);
    const vars=form.reverseVars?[...form.vars].reverse():form.vars;
    const modulus=form.field==='0'?0:form.field==='2'?2:Number(form.modulus);
    const degree=Number(form.maxdeg),a=algebra(vars,false,modulus);
    const expected=a.basis(reference.files['result.gb']),input=form.rels.map(r=>a.parse(r));
    const row={id:c.id,degree,vars,modulus,dimensions:a.hilbert(expected,degree),engines:[]};
    for(const [bits,workers] of [[32,1],[64,3]]) {
      const client=new BackendClient(path.join(dir,`storage-${bits}`),{timeoutMs:30000,workerURL:new URL('../test/support/native-worker.mjs',import.meta.url)});
      let r;
      try{r=await client.run({...buildJob({...form,backend:'native'}),nativeOptions:{bits,workers,scratchBytes:32*1048576,spill:true}});}finally{await client.close();}
      const text=r.files['result.gb'];assert.equal(parseBasis(text).done,true);
      fs.writeFileSync(path.join(dir,`native-${bits}.gb`),text);
      const gb=a.basis(text),ambiguities=a.certify(input,gb,degree);
      for(const p of gb)assert.equal(a.nf(p,expected).size,0,c.id+': native belongs to reference ideal');
      for(const p of expected)assert.equal(a.nf(p,gb).size,0,c.id+': reference belongs to native ideal');
      assert.deepEqual(a.hilbert(gb,degree),row.dimensions);
      if(c.coefficientBits)assert.ok([...text.matchAll(/\d+\*/g)].some(m=>BigInt(m[0].slice(0,-1)).toString(2).length===c.coefficientBits));
      row.engines.push({bits,workers,passed:true,ambiguities,basisSize:gb.length,elapsedMs:r.elapsedMs,memoryBytes:r.memoryBytes});
      if(bits===32) {
        const names=vars.map((v,i)=>'gn_var_'+i),ids=Object.fromEntries(vars.map((v,i)=>[v,names[i]]));
        const convert=p=>toBergman(parseRelation(p,vars).map(t=>({...t,factors:t.factors.map(f=>({...f,v:ids[f.v]}))})));
        const polys=parseBasis(text).groups.flatMap(g=>g.polys);
        const code=`LIB "freegb.lib";\nring gn_r=${modulus},(${names.join(',')}),dp;\ndef gn_a=freeAlgebra(gn_r,${degree});\nsetring gn_a;\nideal I=${form.rels.map(convert).join(',')||'0'};\nideal B=${polys.map(convert).join(',')||'0'};\nideal G=twostd(I);\nideal H=twostd(B);\nprint("ORACLE:"+string(size(reduce(B,G)))+":"+string(size(reduce(I,H))));\nfor(int j=1;j<=size(G);j++){print("LEAD:"+string(lead(G[j])));}\nquit;\n`;
        fs.writeFileSync(path.join(dir,'singular.sing'),code);
        const log=run(singular,['-q'],{cwd:dir,input:code,env,name:c.id+'-singular',timeout:30000});
        assert.doesNotMatch(log,/^\s*\?/m);assert.match(log,/ORACLE:0:0/);
        const oracle=algebra(names,false,modulus),leaders=[...log.matchAll(/^LEAD:(.+)$/gm)].map(m=>oracle.parse(m[1]));
        assert.deepEqual(oracle.hilbert(leaders,degree),row.dimensions);
        row.singular={passed:true,degreeBound:degree,mutualIdealMembership:true,dimensions:row.dimensions};
      }
    }
    report.cases.push(row);save();console.log(c.id,'32/64 + Bergman + Singular PASS');
  }
  report.state='complete';report.summary={cases:report.cases.length,nativeRuns:report.cases.length*2,
    singularCases:report.cases.length,ambiguities:report.cases.reduce((n,c)=>n+c.engines.reduce((s,e)=>s+e.ambiguities,0),0)};
} catch(error) {report.state='failed';report.error=error.stack||String(error);throw error;}
finally {report.finishedAt=new Date().toISOString();save();}
