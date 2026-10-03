// Cold FK6 degree prefixes in all four actual Wasm modules, independently checked.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {buildJob,readInputFile,parseRelation,toBergman,parseBasis} from '../web/src/bergman-syntax.js';
import {BackendClient} from '../test/support/backend-client.mjs';
import {algebra} from '../test/support/algebra.mjs';
import {normalWordCounts} from '../test/support/normal-word-counts.mjs';
import {CheckTimings, engineHashes, validationSnapshot, writeJSON} from './release-support.mjs';

const out=path.resolve(process.argv[2]??'build/validation/fk6-degrees');fs.mkdirSync(out,{recursive:true});
const fixtureFile='test/fixtures/fomin-kirillov-user.json';
const {vars,rels}=readInputFile('(ALGFORMINPUT)\n'+JSON.parse(fs.readFileSync(fixtureFile)).inputText);
const a=algebra(vars),sha=file=>crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const manifest=JSON.parse(fs.readFileSync('web/engine/fomkyr/build.json'));
const expected=JSON.parse(fs.readFileSync('test/fixtures/fk6-degree-prefixes.json'));
const timings=new CheckTimings(out),hashes=engineHashes(),sourceHashes=validationSnapshot();
const previous=process.argv.includes('--resume')&&fs.existsSync(path.join(out,'report.json'))?JSON.parse(fs.readFileSync(path.join(out,'report.json'))):null;
if(previous){assert.deepEqual(previous.kernelHashes,hashes);assert.deepEqual(previous.validationSourceHashes,sourceHashes);}
const retainedAt=process.argv.indexOf('--singular-report');
const retainedFile=retainedAt<0?null:path.resolve(process.argv[retainedAt+1]);
const retained=retainedFile?JSON.parse(fs.readFileSync(retainedFile)):null;
if(retained){assert.equal(retained.state,'complete');assert.equal(retained.inputSha256,sha(fixtureFile));}
const report={state:'running',version:manifest.version,inputSha256:sha(fixtureFile),timeLimitSeconds:120,
  kernelHashes:hashes,validationSourceHashes:sourceHashes,startedAt:previous?.startedAt??new Date().toISOString(),
  method:'Fresh degree 1–9 jobs for each of the four Wasm variants. Exact leading words, independent BigInt normal-word DP, input membership and changed-tail mutual reductions against archived reference bases. Full critical-pair certificates through degree 5. Singular bounded leading ideals are checked until its first two-minute limit; higher skipped oracles are explicitly recorded.',cases:[]};
report.cases=previous?.cases??[];
if(retained)report.retainedSingular={sourceReportSha256:sha(retainedFile),method:'Reuse recorded Singular calculations on the identical input; reread and check their leading words against each exact reference. No independent oracle timing is repeated.'};
const save=()=>writeJSON(path.join(out,'report.json'),report);save();
const canonical=p=>JSON.stringify([...p].sort(([x],[y])=>x.localeCompare(y)).map(([w,[n,d]])=>[w,n.toString(),d.toString()]));
const root=path.resolve('build/oracles/root'),singular=path.join(root,'usr/bin/Singular');
const env={...process.env,LD_LIBRARY_PATH:`${root}/usr/lib/x86_64-linux-gnu:${root}/usr/lib/x86_64-linux-gnu/singular/MOD`,SINGULARPATH:`${root}/usr/share/singular/LIB:${root}/usr/lib/x86_64-linux-gnu/singular/MOD`};
env.SINGULAR_PROCS_DIR=path.join(root,'usr/lib/x86_64-linux-gnu/singular/MOD');
let singularLimit=report.cases.some(row=>row.singular.status==='timeout')?'A previous degree reached the Singular deadline.':null;
try {
  for (let degree=1;degree<=9;degree++) {
    if(report.cases.some(row=>row.degree===degree))continue;
    const directory=path.join(out,'degree-'+degree);fs.mkdirSync(directory,{recursive:true});
    const anchor=expected.degrees.find(row=>row.degree===degree);
    const reference=anchor.referenceFile?a.basis(fs.readFileSync(anchor.referenceFile,'utf8')):[];
    if(anchor.referenceFile)assert.equal(sha(anchor.referenceFile),anchor.referenceSha256);
    const refByHead=new Map(reference.map(p=>[a.lead(p),p]));
    const form={task:'gb',ring:'noncomm',order:'degleftlex',field:'0',vars,rels,maxdeg:String(degree),maxserdeg:String(degree),memoryMiB:512,backend:'fomkyr',monomialPruning:true,timeoutMinutes:2};
    const row={degree,rules:anchor.rules,hilbert:anchor.hilbert,engines:[]};
    for (const [bits,execution,workers] of [[32,'single',1],[32,'multicore',4],[64,'single',1],[64,'multicore',4]]) {
      const client=new BackendClient(path.join(directory,`storage-${bits}-${execution}`),{timeoutMs:120000,workerURL:new URL('../test/support/fomkyr-worker.mjs',import.meta.url)});
      let result;
      try {const job=buildJob(form);result=await timings.measure(`degree-${degree}-${bits}-${execution}`,()=>client.run({...job,fomkyrOptions:{...job.fomkyrOptions,bits,execution,workers,scratchBytes:128*1048576,previewBytes:1048576,spill:true,resume:false,hilbert:true,hilbertRequired:true}}));}
      finally {await client.close();}
      const text=result.files['result.gb'];assert.equal(parseBasis(text).done,true);
      fs.writeFileSync(path.join(directory,`fomkyr-${bits}-${execution}.gb`),text);
      const gb=a.basis(text),heads=gb.map(a.lead).sort();
      assert.equal(gb.length,anchor.rules);assert.equal(crypto.createHash('sha256').update(heads.join('\n')).digest('hex'),anchor.leadingWordsSha256);
      assert.deepEqual(normalWordCounts(vars.length,heads,degree),anchor.hilbert);
      assert.deepEqual(result.hilbert.coefficients,anchor.hilbert);
      assert.equal(result.completedThroughDegree,degree);assert.equal(result.bits,bits);assert.equal(result.shared,execution==='multicore');assert.equal(result.workers,workers);
      const input=rels.map(a.parse).filter(p=>a.degree(a.lead(p))<=degree);
      for (const p of input)assert.equal(a.nf(p,gb).size,0);
      let differingTails=0;
      for (const p of gb) {const old=refByHead.get(a.lead(p));assert.ok(old);if(canonical(p)!==canonical(old)){differingTails++;assert.equal(a.nf(p,reference).size,0);assert.equal(a.nf(old,gb).size,0);}}
      const ambiguities=degree<=5?a.certify(input,gb,degree):null;
      row.engines.push({bits,execution,workers,passed:true,inputMembership:true,leadingWordsMatch:true,mutualIdealMembership:true,differingTails,ambiguities,hilbertMatches:true,elapsedSeconds:result.elapsedMs/1000});
      console.log('FK6',degree,bits,execution,'PASS');
    }
    if(retained){
      const previous=retained.cases.find(c=>c.degree===degree);assert.ok(previous?.singular);
      row.singular={...previous.singular,retained:true};
      if(previous.singular.passed){
        const logFile=path.join(path.dirname(retainedFile),'degree-'+degree,'singular.log');
        const log=fs.readFileSync(logFile,'utf8');assert.match(log,/ORACLE_DONE/);assert.doesNotMatch(log,/^\s*\?/m);
        const s=algebra(vars.map((_,i)=>'fk_var_'+i)),heads=[...log.matchAll(/^LEAD:(.+)$/gm)].map(m=>s.lead(s.parse(m[1]))).sort();
        assert.deepEqual(heads,reference.map(a.lead).sort());assert.deepEqual(normalWordCounts(vars.length,heads,degree),anchor.hilbert);
        row.singular.logSha256=sha(logFile);
        fs.copyFileSync(logFile,path.join(directory,'singular.log'));
      }
    }else if(singularLimit)row.singular={status:'skipped',reason:singularLimit};
    else {
      const names=vars.map((_,i)=>'fk_var_'+i),ids=Object.fromEntries(vars.map((v,i)=>[v,names[i]]));
      const convert=p=>toBergman(parseRelation(p,vars).map(t=>({...t,factors:t.factors.map(f=>({...f,v:ids[f.v]}))})));
      const code=`LIB "freegb.lib";\nring fk_r=0,(${[...names].reverse().join(',')}),Dp;\ndef fk_a=freeAlgebra(fk_r,${Math.max(2,degree)});\nsetring fk_a;\noption(redSB);option(intStrategy);\nideal I=${degree<2?'0':rels.map(convert).join(',')};\nideal G=twostd(I);\nfor(int j=1;j<=size(G);j++){if(G[j]!=0){print("LEAD:"+string(lead(G[j])));}}\nprint("ORACLE_DONE");\nquit;\n`;
      fs.writeFileSync(path.join(directory,'singular.sing'),code);
      const check=timings.begin(`degree-${degree}-singular`),start=performance.now(),result=spawnSync(singular,['-q'],{input:code,env,encoding:'utf8',timeout:120000,killSignal:'SIGKILL',maxBuffer:16e6});
      const log=(result.stdout??'')+(result.stderr??'');fs.appendFileSync(path.join(directory,'singular.log'),log);
      timings.end(check,result.error??(result.status!==0?new Error('Singular exit '+result.status):null));
      if(result.error?.code==='ETIMEDOUT') {singularLimit=`Singular reached 120 seconds at degree ${degree}.`;row.singular={status:'timeout',capSeconds:120,elapsedSeconds:(performance.now()-start)/1000};}
      else {assert.ifError(result.error);assert.equal(result.status,0);assert.doesNotMatch(log,/^\s*\?/m);assert.match(log,/ORACLE_DONE/);
        const s=algebra(names),heads=[...log.matchAll(/^LEAD:(.+)$/gm)].map(m=>s.lead(s.parse(m[1]))).sort();
        assert.deepEqual(heads,reference.map(a.lead).sort());row.singular={status:'complete',passed:true,leadingWordsMatch:true,hilbert:normalWordCounts(vars.length,heads,degree),elapsedSeconds:(performance.now()-start)/1000};}
    }
    report.cases.push(row);save();
  }
  report.state='complete';report.summary={degreeBounds:9,fomkyrRuns:report.cases.reduce((n,c)=>n+c.engines.length,0),singularPassed:report.cases.filter(c=>c.singular.passed).length,singularCensored:report.cases.filter(c=>c.singular.status==='timeout').length};
}catch(error){report.state='failed';report.error=error.stack;throw error;}
finally{report.finishedAt=new Date().toISOString();save();}
