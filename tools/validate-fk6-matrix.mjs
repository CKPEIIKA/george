// Matched degree prefixes: submitted FK6 and random FK6-shaped coefficients.
// Singular must finish every included oracle job within two minutes.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {buildJob,readInputFile,parseRelation,toBergman,parseBasis} from '../web/src/bergman-syntax.js';
import {BackendClient} from '../test/support/backend-client.mjs';
import {algebra} from '../test/support/algebra.mjs';
import {normalWordCounts} from '../test/support/normal-word-counts.mjs';
import {oraclePolynomial} from '../vendor/fomkyr-0.6.1/tools/oracle-format.mjs';

const out=path.resolve(process.argv[2]??'build/validation/fk6-matrix');fs.mkdirSync(out,{recursive:true});
const finiteProfile=process.argv.includes('--finite');
const configFile=finiteProfile?'test/fixtures/fk6-matrix.json':'test/fixtures/fk6-growing-matrix.json';
const configured=fs.existsSync(configFile)?JSON.parse(fs.readFileSync(configFile)):null;
const degreeArgument=process.argv[3]?.startsWith('--')?undefined:process.argv[3];
const requestedDegrees=Number(degreeArgument??configured?.degreeBound??9);
if(!Number.isInteger(requestedDegrees)||requestedDegrees<1||requestedDegrees>9)throw new RangeError('Choose 1–9 degree bounds.');
const sha=file=>crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const inputs=[['fk6','test/fixtures/fomin-kirillov-user.json'],['random-fk6',finiteProfile?'test/fixtures/random-big-form.json':'test/fixtures/random-fk6-growing.json']].map(([id,file])=>({id,file,sha256:sha(file),fixture:JSON.parse(fs.readFileSync(file))}));
const root=path.resolve('build/oracles/root'),singular=path.join(root,'usr/bin/Singular');
const env={...process.env,LD_LIBRARY_PATH:`${root}/usr/lib/x86_64-linux-gnu:${root}/usr/lib/x86_64-linux-gnu/singular/MOD`,SINGULARPATH:`${root}/usr/share/singular/LIB:${root}/usr/lib/x86_64-linux-gnu/singular/MOD`};
env.SINGULAR_PROCS_DIR=path.join(root,'usr/lib/x86_64-linux-gnu/singular/MOD');
const report={state:'running',version:JSON.parse(fs.readFileSync('web/engine/fomkyr/build.json')).version,requestedDegrees,timeLimitSeconds:120,
  inputs,kernelHashes:Object.fromEntries(['fomkyr32.wasm','fomkyr64.wasm','fomkyr32-single.wasm','fomkyr64-single.wasm'].map(n=>[n,sha('web/engine/fomkyr/'+n)])),singularSha256:sha(singular),cases:[],attempts:[],
  method:'Matched bounds 1..n for submitted FK6 and random FK6-shaped coefficients, up to the requested bound. Each included Singular bounded completion finishes within 120 s. All four actual Wasm modules are compared by exact input and mutual ideal membership, leading words and independent normal-word BigInt DP. Distinct bases are certified through degree 4. C/ECL comparison runs until its first 120-second cap. An unfinished oracle degree is retained in attempts and excluded from the matched matrix.'};
if(process.argv.includes('--resume')&&fs.existsSync(path.join(out,'report.json'))){
  const previous=JSON.parse(fs.readFileSync(path.join(out,'report.json')));
  assert.deepEqual(previous.kernelHashes,report.kernelHashes);assert.deepEqual(previous.inputs,inputs);assert.equal(previous.singularSha256,report.singularSha256);
  report.commonDegreeBound=previous.commonDegreeBound??0;
  report.cases=previous.cases.filter(row=>row.degree<=report.commonDegreeBound);report.attempts=previous.attempts.filter(row=>row.degree<=report.commonDegreeBound);
}
const save=()=>fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2)+'\n');save();
const canonical=p=>JSON.stringify([...p].sort(([x],[y])=>x.localeCompare(y)).map(([w,[n,d]])=>[w,n.toString(),d.toString()]));
const cLimit=new Set(),anchors=JSON.parse(fs.readFileSync('test/fixtures/fk6-degree-prefixes.json'));
for(const row of report.cases)if(row.bergman?.status==='timeout')cLimit.add(row.id);
try {
  degrees:for(let degree=(report.commonDegreeBound??0)+1;degree<=requestedDegrees;degree++) {
    const staged=[];
    // Complete both oracles before adding either degree to the matrix.
    for(const input of inputs) {
      const {vars,rels}=readInputFile('(ALGFORMINPUT)\n'+input.fixture.inputText),a=algebra(vars);
      const directory=path.join(out,input.id+'-d'+degree);fs.mkdirSync(directory,{recursive:true});
      const names=vars.map((_,i)=>'fk_var_'+i),ids=Object.fromEntries(vars.map((v,i)=>[v,names[i]]));
      const convert=p=>toBergman(parseRelation(p,vars).map(t=>({...t,factors:t.factors.map(f=>({...f,v:ids[f.v]}))})));
      const ringDegreeBound=Math.max(2,degree); // Singular's minimum is 2; degree 1 uses the empty quadratic ideal prefix.
      const code=`LIB "freegb.lib";\nring fk_r=0,(${[...names].reverse().join(',')}),Dp;\ndef fk_a=freeAlgebra(fk_r,${ringDegreeBound});\nsetring fk_a;\noption(redSB);option(intStrategy);\nideal I=${degree<2?'0':rels.map(convert).join(',')};\nideal G=twostd(I);\nfor(int j=1;j<=size(G);j++){if(G[j]!=0){print("POLY:"+string(G[j]));}}\nprint("ORACLE_DONE");\nquit;\n`;
      fs.writeFileSync(path.join(directory,'singular.sing'),code);
      const start=performance.now(),r=spawnSync(singular,['-q'],{input:code,env,encoding:'utf8',timeout:120000,killSignal:'SIGKILL',maxBuffer:32e6});
      const log=(r.stdout??'')+(r.stderr??'');fs.writeFileSync(path.join(directory,'singular.log'),log);
      const elapsedSeconds=(performance.now()-start)/1000;
      if(r.error?.code==='ETIMEDOUT'){report.attempts.push({id:input.id,degree,status:'timeout',elapsedSeconds,capSeconds:120});report.commonDegreeBound=degree-1;save();break degrees;}
      assert.ifError(r.error);assert.equal(r.status,0);assert.doesNotMatch(log,/^\s*\?|Could not find dynamic library/m);assert.match(log,/ORACLE_DONE/);
      const s=algebra(names),basis=[...log.matchAll(/^POLY:(.+)$/gm)].map(m=>s.monic(oraclePolynomial(m[1],s,names)));
      const heads=basis.map(a.lead).sort(),hilbert=normalWordCounts(vars.length,heads,degree);
      const row={id:input.id,degree,rules:basis.length,hilbert,singular:{passed:true,elapsedSeconds,ringDegreeBound,emptyQuadraticPrefix:degree===1,leadingWordsSha256:crypto.createHash('sha256').update(heads.join('\n')).digest('hex')},engines:[]};
      const recorded=configured?.expected.find(anchor=>anchor.id===input.id&&anchor.degree===degree);
      if(recorded){assert.equal(row.rules,recorded.rules);assert.deepEqual(row.hilbert,recorded.hilbert);assert.equal(row.singular.leadingWordsSha256,recorded.leadingWordsSha256);}
      if(input.id==='fk6'){const anchor=anchors.degrees.find(row=>row.degree===degree);assert.equal(row.rules,anchor.rules);assert.equal(row.singular.leadingWordsSha256,anchor.leadingWordsSha256);assert.deepEqual(hilbert,anchor.hilbert);}
      report.attempts.push({id:input.id,degree,status:'complete',elapsedSeconds});save();staged.push({input,vars,rels,a,directory,basis,heads,row});
      console.log(input.id,degree,'Singular PASS',elapsedSeconds.toFixed(2),'s');
    }
    for(const {input,vars,rels,a,directory,basis,heads,row} of staged) {
      const form={task:'gb',ring:'noncomm',order:'degleftlex',field:'0',vars,rels,maxdeg:String(degree),maxserdeg:String(degree),memoryMiB:512,backend:'fomkyr',monomialPruning:true,timeoutMinutes:2};
      const reference=new Map(basis.map(p=>[a.lead(p),p])),inputPolys=rels.map(a.parse).filter(p=>a.degree(a.lead(p))<=degree),audited=new Map();
      const check=(text)=>{
        assert.equal(parseBasis(text).done,true);const gb=a.basis(text);assert.deepEqual(gb.map(a.lead).sort(),heads);
        const key=JSON.stringify(gb.map(canonical).sort());
        if(audited.has(key))return {...audited.get(key),ambiguities:null,reusedExactPolynomialCertificate:true};
        for(const p of inputPolys)assert.equal(a.nf(p,gb).size,0);
        let differingTails=0;
        for(const p of gb){const old=reference.get(a.lead(p));if(canonical(p)!==canonical(old)){differingTails++;assert.equal(a.nf(p,basis).size,0);assert.equal(a.nf(old,gb).size,0);}}
        const ambiguities=degree<=4?a.certify(inputPolys,gb,degree):null;
        assert.deepEqual(normalWordCounts(vars.length,heads,degree),row.hilbert);
        const proof={passed:true,leadingWordsMatch:true,inputMembership:true,mutualIdealMembership:true,differingTails,ambiguities};audited.set(key,proof);return proof;
      };
      for(const [bits,execution,workers] of [[32,'single',1],[32,'multicore',4],[64,'single',1],[64,'multicore',4]]) {
        const client=new BackendClient(path.join(directory,`storage-${bits}-${execution}`),{timeoutMs:120000,workerURL:new URL('../test/support/fomkyr-worker.mjs',import.meta.url)});let r;
        try{const job=buildJob(form);r=await client.run({...job,fomkyrOptions:{...job.fomkyrOptions,bits,execution,workers,scratchBytes:128*1048576,previewBytes:1048576,spill:true,resume:false,hilbert:true,hilbertRequired:true}});}finally{await client.close();}
        fs.writeFileSync(path.join(directory,`fomkyr-${bits}-${execution}.gb`),r.files['result.gb']);
        assert.equal(r.completedThroughDegree,degree);assert.equal(r.bits,bits);assert.equal(r.shared,execution==='multicore');assert.equal(r.workers,workers);assert.deepEqual(r.hilbert.coefficients,row.hilbert);
        row.engines.push({bits,execution,workers,...check(r.files['result.gb']),hilbertMatches:true,elapsedSeconds:r.elapsedMs/1000});
        console.log(input.id,degree,bits,execution,'PASS');
      }
      if(cLimit.has(input.id))row.bergman={status:'skipped',reason:'Earlier degree reached the 120-second limit.'};
      else {
        const client=new BackendClient(path.resolve('web/engine/compiled'),{timeoutMs:120000});let r;
        // Bergman always loads its initial degree; use the empty linear prefix
        // when the requested bound is below these quadratic generators.
        try{r=await client.run(buildJob({...form,backend:'compiled',memoryMiB:2048,rels:degree===1?['0']:rels}));}
        catch(error){if(!/timed out|time limit/i.test(error.message))throw error;cLimit.add(input.id);row.bergman={status:'timeout',capSeconds:120};}
        finally{await client.close();}
        if(r){fs.writeFileSync(path.join(directory,'bergman.gb'),r.files['result.gb']);row.bergman={status:'complete',...check(r.files['result.gb']),elapsedSeconds:r.elapsedMs/1000};}
      }
      report.cases.push(row);save();
    }
    report.commonDegreeBound=degree;save();
    const finite=staged.find(({row})=>row.hilbert.at(-1)==='0');
    if(finite){report.stopReason={kind:'finite-algebra',id:finite.input.id,firstZeroDegree:degree,dimension:finite.row.hilbert.reduce((sum,n)=>sum+BigInt(n),0n).toString()};break;}
  }
  report.state='complete';report.summary={commonDegreeBound:report.commonDegreeBound,cases:report.cases.length,fomkyrRuns:report.cases.reduce((n,c)=>n+c.engines.length,0),singularCases:report.cases.length};
}catch(error){report.state='failed';report.error=error.stack;throw error;}
finally{report.finishedAt=new Date().toISOString();save();}
