// Separately bounded independent audit; executed only after timed measurements.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {loadCatalog,loadBenchmark,sha256,singularScript,hilbertOracle} from './free-algebra-benchmarks.mjs';
import {OracleCache,singularIdentity} from './oracle-cache.mjs';
import {algebra} from '../test/support/algebra.mjs';
import {oraclePolynomial} from '../fomkyr/tools/oracle-format.mjs';
import {normalWordCounts} from '../test/support/normal-word-counts.mjs';
import {parseBasis} from '../web/src/bergman-syntax.js';
import {mutualIdealMembership} from './benchmark-ideal-membership.mjs';

let stage='reference';
try{
const [file,id,engine,timeout='120']=process.argv.slice(2),report=JSON.parse(fs.readFileSync(file));
const out=path.dirname(file),row=report.rows.find(r=>r.id===id&&r.engine===engine);
assert.equal(row.status,'complete');
const entry=loadCatalog().cases.find(c=>c.id===id),p=loadBenchmark(entry);
assert.ok(p.homogeneous);assert.equal(row.inputSha256,entry.inputSha256);
const basisText=fs.readFileSync(path.join(out,row.basisFile),'utf8');assert.equal(sha256(basisText),row.basisSha256);
const root=path.resolve(report.contract.singularRoot??'build/oracles/root'),executable=path.join(root,'usr/bin/Singular');
const identity=singularIdentity(root),source=singularScript(p,row.degree);
assert.equal(report.contract.hashes[executable],sha256(fs.readFileSync(executable)),'Singular executable changed after the run');
const environment={...process.env,LD_LIBRARY_PATH:`${root}/usr/lib/x86_64-linux-gnu:${root}/usr/lib/x86_64-linux-gnu/singular/MOD`,SINGULARPATH:`${root}/usr/share/singular/LIB:${root}/usr/lib/x86_64-linux-gnu/singular/MOD`,SINGULAR_PROCS_DIR:path.join(root,'usr/lib/x86_64-linux-gnu/singular/MOD')};
const cache=new OracleCache();
const reference=await cache.obtain('singular-basis',{source},identity,()=>{
 const timed=report.rows.find(r=>r.id===id&&r.engine==='singular'&&r.status==='complete');
 if(timed){
  const log=fs.readFileSync(path.join(out,timed.basisFile),'utf8');assert.equal(sha256(log),timed.basisSha256);
  const dir=path.dirname(path.join(out,timed.basisFile));assert.equal(fs.readFileSync(path.join(dir,'input.sing'),'utf8'),source);
  return log;
 }
 const r=spawnSync('/usr/bin/prlimit',['--as='+String(report.contract.memoryMiB*1048576),'--',executable,'-q'],{input:source,env:environment,encoding:'utf8',timeout:Number(timeout)*1000,killSignal:'SIGKILL',maxBuffer:256*1048576});
 assert.ifError(r.error);assert.equal(r.status,0,r.stderr);return r.stdout;
},log=>{assert.match(log,/^BENCHMARK_DONE$/m);assert.doesNotMatch(log,/^\s*\?|Could not find dynamic library/m);});
stage='candidate-check';
const a=algebra(p.variables),names=p.variables.map((_,i)=>'bench_v'+i),s=algebra(names);
const oracle=[...reference.value.matchAll(/^POLY:(.+)$/gm)].map(m=>s.monic(oraclePolynomial(m[1],s,names))).filter(f=>f.size);
let candidate;
if(engine==='singular')candidate=[...basisText.matchAll(/^POLY:(.+)$/gm)].map(m=>s.monic(oraclePolynomial(m[1],s,names))).filter(f=>f.size);
else if(engine==='fomkyr'){
 assert.match(basisText,/^Done\s*$/m,'Truncated or unfinished native output');
 candidate=basisText.split(/\r?\n/).filter(line=>line.trim()&&!/^\s*(%|Done\s*$)/.test(line))
  .map(line=>a.monic(oraclePolynomial(line.trim().replace(/,$/,''),a,p.variables))).filter(f=>f.size);
}else{assert.ok(parseBasis(basisText).done,'Truncated or unfinished output');candidate=a.basis(basisText);}
assert.deepEqual(candidate.map(a.lead).sort(),oracle.map(a.lead).sort());
const membership=mutualIdealMembership(candidate,oracle,a);
const input=p.rels.map(a.parse).filter(f=>a.degree(a.lead(f))<=row.degree);
for(const f of input)assert.equal(a.nf(f,candidate).size,0);
const hilbert=normalWordCounts(p.variables.length,candidate.map(a.lead),row.degree);
const expected=hilbertOracle(entry,row.degree);if(expected)assert.deepEqual(hilbert,expected);
if(entry.id==='fk6-d9'){
 const anchor=JSON.parse(fs.readFileSync(entry.referenceFile)).degrees.find(c=>c.degree===9);
 assert.equal(sha256(candidate.map(a.lead).sort().join('\n')),anchor.leadingWordsSha256);assert.deepEqual(hilbert,anchor.hilbert);
}
const ambiguities=row.degree<=6?a.certify(input,candidate,row.degree):null;
console.log(JSON.stringify({status:'passed',passed:true,reference:{key:reference.key,reused:reference.reused},
 leadingIdealMatches:true,mutualIdealMembership:true,membership,inputMembership:true,hilbert,formulaMatches:expected!==null,
 criticalPairCertificate:ambiguities!==null,ambiguities,
 scope:ambiguities===null?'Bounded basis equivalence to independent Singular; no additional exhaustive composition certificate.':'Independent Singular equivalence and exhaustive bounded compositions.'}));
}catch(error){
 const failed=stage==='candidate-check'&&error.code==='ERR_ASSERTION'&&!/reduction terminates|ETIMEDOUT|ENOBUFS/.test(error.message);
 console.log(JSON.stringify({status:failed?'failed':'incomplete',stage,passed:false,error:String(error.stack??error)}));
 process.exitCode=1;
}
