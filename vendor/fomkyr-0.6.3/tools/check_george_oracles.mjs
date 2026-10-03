// SPDX-License-Identifier: MIT
// Execute THIS release, George's actual Bergman backend, and Singular Letterplace.
// Missing programs are UNAVAILABLE (exit 77), never passing verification.
import fs from 'node:fs';import path from 'node:path';import os from 'node:os';import crypto from 'node:crypto';import assert from 'node:assert/strict';import {spawnSync} from 'node:child_process';import {fileURLToPath,pathToFileURL} from 'node:url';
import {oraclePolynomial} from './oracle-format.mjs';
import {setup} from '../tests/node-host.mjs';import {FomkyrEngine} from '../web/engine.js';import {parseNativeJob} from '../web/job-adapter.js';
const ROOT=fileURLToPath(new URL('../',import.meta.url));
const args=process.argv.slice(2);const arg=(key,fallback)=>{const i=args.indexOf(key);return i<0?fallback:args[i+1];};
const george=path.resolve(arg('--george','.'));const out=path.resolve(arg('--out',path.join(ROOT,'results/0.6.1/external-oracles')));fs.mkdirSync(out,{recursive:true});
const oracleRoot=path.join(george,'build/oracles/root'),singular=path.resolve(arg('--singular',process.env.SINGULAR_BIN??path.join(oracleRoot,'usr/bin/Singular')));
const sha=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');const report={status:'running',externalVerified:false,cases:[],version:JSON.parse(fs.readFileSync(path.join(ROOT,'package.json'))).version,
 startedAt:new Date().toISOString(),fomkyrWasmSHA256:sha(path.join(ROOT,'web/fomkyr32.wasm')),george,singular};
const save=()=>fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2)+'\n');
const required=[singular,...['web/src/bergman-syntax.js','test/support/backend-client.mjs','test/support/algebra.mjs','web/engine/compiled/build.json'].map(p=>path.join(george,p))];
const missing=required.filter(p=>!fs.existsSync(p));
if(missing.length){report.status='unavailable';report.missing=missing;report.reason='Use an initialized George checkout and install its pinned oracle packages. No engine comparison was run.';save();console.error(report.reason);process.exit(77);}
const load=p=>import(pathToFileURL(path.join(george,p)));
const {buildJob,parseBasis}=await load('web/src/bergman-syntax.js'),{BackendClient}=await load('test/support/backend-client.mjs'),{algebra}=await load('test/support/algebra.mjs');
report.bergmanManifest=JSON.parse(fs.readFileSync(path.join(george,'web/engine/compiled/build.json')));
report.validatorSHA256=Object.fromEntries(['web/src/bergman-syntax.js','test/support/algebra.mjs'].map(p=>[p,sha(path.join(george,p))]));
const inputs=JSON.parse(fs.readFileSync(path.join(ROOT,'fixtures/george-supported.json')));
const cases=inputs.cases.map(c=>({...c,fields:inputs.fields}));
// Fail rather than comparing against an accidentally different fixture revision.
const georgeFixturePath=path.join(george,'test/fixtures/upstream-cases.json');
if(fs.existsSync(georgeFixturePath)){
 const actual=JSON.parse(fs.readFileSync(georgeFixturePath));
 for(const c of cases){const other=actual.cases.find(x=>x.id===c.id);assert.ok(other,'Missing upstream case '+c.id);assert.deepEqual(other.vars,c.vars);assert.deepEqual(other.rels,c.rels);assert.equal(other.maxdeg,c.maxdeg);}
 report.georgeFixtureSHA256=sha(georgeFixturePath);
 report.excludedCaseIds=actual.cases.filter(x=>!cases.some(c=>c.id===x.id)).map(x=>x.id);
}

// Physical homogeneous presentations complement the imported upstream subset.
const physics=JSON.parse(fs.readFileSync(path.join(ROOT,'fixtures/physics-matrix.json')));
const text=(f)=>f.relations.map(r=>r.terms.map((t,i)=>{let c=BigInt(t.coefficient);return (c<0n?'-':i?'+':'')+(c===1n||c===-1n?'':String(c<0n?-c:c)+'*')+t.word.map(j=>f.variables[j]).join('*');}).join(''));
for(const f of physics.filter(f=>f.name.startsWith('homogenized-')))
 cases.push({id:f.name,vars:f.variables,rels:text(f),maxdeg:4,fields:[0,2,101]});
const fk=JSON.parse(fs.readFileSync(path.join(ROOT,'fixtures/fk6.json')));
cases.push({id:'submitted-FK6',vars:fk.variables,rels:text(fk),maxdeg:Number(arg('--fk-degree','5')),fields:[0]});
const env={...process.env,LD_LIBRARY_PATH:[path.join(oracleRoot,'usr/lib/x86_64-linux-gnu'),path.join(oracleRoot,'usr/lib/x86_64-linux-gnu/singular/MOD'),process.env.LD_LIBRARY_PATH??''].join(':'),SINGULARPATH:[path.join(oracleRoot,'usr/share/singular/LIB'),path.join(oracleRoot,'usr/lib/x86_64-linux-gnu/singular/MOD'),process.env.SINGULARPATH??''].join(':')};
const timeout=Number(arg('--timeout-ms','120000'));assert.ok(Number.isSafeInteger(timeout)&&timeout>0);
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'fomkyr-external-'));setup(tmp);
try{
 for(const c of cases)for(const p of c.fields){
  const id=`${c.id}-p${p}`,dir=path.join(out,id);fs.mkdirSync(dir,{recursive:true});
  const form={task:'gb',ring:'noncomm',order:'degleftlex',field:p===0?'0':p===2?'2':'p',modulus:String(p),vars:c.vars,rels:c.rels,maxdeg:String(c.maxdeg),lowterms:'safe',legacy:false,outmode:'ALG'};
  const job={task:'gb',script:`(NONCOMMIFY)\n(DEGLEFTLEXIFY)\n(SETMODULUS ${p})\n(SETMAXDEG ${c.maxdeg})\n(SIMPLE "input.bg" "result.gb")`,files:{'input.bg':`(ALGFORMINPUT)\nvars ${c.vars.join(',')};\n${c.rels.join(',')} ;`}};
  const {fixture}=parseNativeJob(job);const engine=new FomkyrEngine({workers:4,bits:32,execution:'multicore',budgetBytes:256*1048576,scratchBytes:64*1048576,spill:true,runKey:id,resume:false,timeoutMs:timeout,progress:false,hilbert:true,exportText:true});
  let result;try{result=await engine.compute(fixture,c.maxdeg,p);}finally{await engine.close();}
  const output=fs.readFileSync(path.join(tmp,'fomkyr',id,'result.gb'),'utf8');fs.writeFileSync(path.join(dir,'fomkyr.gb'),output);
  assert.equal(result.modulus,p,'Kernel field must match the requested field');
  const client=new BackendClient(path.join(george,'web/engine/compiled'),{timeoutMs:timeout});let external;
  try{external=await client.run(buildJob({...form,backend:'compiled'}));}finally{await client.close();}
  const refText=external.files['result.gb'];fs.writeFileSync(path.join(dir,'bergman.gb'),refText);
  const a=algebra(c.vars,false,p),basis=a.basis(output),reference=a.basis(refText),input=c.rels.map(a.parse);
  const ambiguities=a.certify(input,basis,c.maxdeg),refAmbiguities=a.certify(input,reference,c.maxdeg);
  for(const f of basis)assert.equal(a.nf(f,reference).size,0,id+': Fomkyr belongs to Bergman ideal');
  for(const f of reference)assert.equal(a.nf(f,basis).size,0,id+': Bergman belongs to Fomkyr ideal');
  assert.deepEqual(a.hilbert(basis,c.maxdeg),a.hilbert(reference,c.maxdeg));
  // The exact canonical monic rows must agree even when raw unreduced tails do not.
  const canonical=g=>g.map((f,i)=>a.monic(a.nf(f,g.filter((_,j)=>j!==i)))).filter(f=>f.size).map(f=>JSON.stringify([...f].map(([w,n])=>[w,String(n)]).sort((u,v)=>String(u[0]).localeCompare(String(v[0]))))).sort();
  assert.deepEqual(canonical(basis),canonical(reference),id+': canonical rows');
  const rename=new Map(c.vars.map((v,i)=>[v,`g_${i}`]));const convert=s=>s.replace(/[A-Za-z_][A-Za-z_0-9]*/g,v=>{assert.ok(rename.has(v),`unknown generator ${v}`);return rename.get(v);});
  const names=c.vars.map(v=>rename.get(v));const polys=parseBasis(output).groups.flatMap(g=>g.polys);
  const code=`LIB "freegb.lib";\nring r=${p},(${[...names].reverse().join(',')}),Dp;\ndef A=freeAlgebra(r,${c.maxdeg});\nsetring A;\noption(redSB);\noption(redTail);\nideal I=${c.rels.map(convert).join(',')||'0'};\nideal B=${polys.map(convert).join(',')||'0'};\nideal G=twostd(I);\nprint("ORACLE:"+string(size(reduce(I,B)))+":"+string(size(reduce(B,G)))+":"+string(size(reduce(G,B))));\nfor(int j=1;j<=size(G);j++){print("CANON:"+string(G[j]));}\nquit;\n`;
  fs.writeFileSync(path.join(dir,'singular.sing'),code);
  const execution=spawnSync(singular,['-q'],{input:code,encoding:'utf8',cwd:dir,env,timeout,maxBuffer:64*1048576,killSignal:'SIGKILL'});
  const log=(execution.stdout??'')+(execution.stderr??'');fs.writeFileSync(path.join(dir,'singular.log'),log);
  assert.ifError(execution.error);assert.equal(execution.status,0);assert.doesNotMatch(log,/^\s*\?/m);assert.match(log,/ORACLE:0:0:0/);
  const inverse=new Map([...rename].map(([a,b])=>[b,a]));const singularPolys=[...log.matchAll(/^CANON:(.+)$/gm)].map(m=>m[1].replace(/g_\d+/g,v=>inverse.get(v)));
  const third=singularPolys.filter(s=>s.trim()!=='0').map(s=>oraclePolynomial(s,a,c.vars));assert.deepEqual(canonical(basis),canonical(third),id+': Singular canonical rows');
  const row={id,degree:c.maxdeg,modulus:p,fomkyrRules:basis.length,bergmanRules:reference.length,singularRules:third.length,passed:true,criticalCompositions:ambiguities,bergmanCriticalCompositions:refAmbiguities,canonicalEquality:true,threeIdealInclusions:true};
  report.cases.push(row);save();console.log(id,'PASS');
 }
 report.status='passed';report.externalVerified=true;
}catch(error){report.status='failed';report.error=String(error.stack??error);process.exitCode=1;}
finally{report.finishedAt=new Date().toISOString();save();fs.rmSync(tmp,{recursive:true,force:true});}
