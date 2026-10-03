// Bounded independent Singular comparisons for the new coefficient-heavy corpus.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {VERSION} from '../web/engine/fomkyr/storage.js';
import {buildJob,readInputFile,toBergman,parseRelation} from '../web/src/bergman-syntax.js';
import {BackendClient} from '../test/support/backend-client.mjs';
import {algebra} from '../test/support/algebra.mjs';
import {oraclePolynomial} from '../vendor/fomkyr-0.6.1/tools/oracle-format.mjs';

const out=path.resolve(process.argv[2]??'local/validation/fomkyr-'+VERSION+'-published');fs.mkdirSync(out,{recursive:true});
const root=path.resolve('build/oracles/root'),singular=path.join(root,'usr/bin/Singular');
const env={...process.env,LD_LIBRARY_PATH:`${root}/usr/lib/x86_64-linux-gnu:${root}/usr/lib/x86_64-linux-gnu/singular/MOD`,SINGULARPATH:`${root}/usr/share/singular/LIB:${root}/usr/lib/x86_64-linux-gnu/singular/MOD`,SINGULAR_PROCS_DIR:path.join(root,'usr/lib/x86_64-linux-gnu/singular/MOD')};
const report={state:'running',version:VERSION,cases:[],timeLimitSeconds:120};
const save=()=>fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2)+'\n');save();
const cases=[];
for(const q of [2,3,4,5]) {
  const fixture=JSON.parse(fs.readFileSync(`vendor/fomkyr-${VERSION}/fixtures/published/affine-q-serre-q2.json`));
  for(const relation of fixture.relations)for(const [i,term] of relation.terms.entries())term.coefficient=String([q*q,-(q**4+q*q+1),q**4+q*q+1,-q*q][i]);
  const rels=fixture.relations.map(r=>r.terms.map((t,i)=>{const c=BigInt(t.coefficient);return (c<0n?'-':i?'+':'')+(c<0n?-c:c)+'*'+t.word.map(k=>fixture.variables[k]).join('*');}).join(''));
  cases.push({name:'q-serre-q'+q,vars:fixture.variables,rels,degree:q<4?12:8});
}
const sky=readInputFile('(ALGFORMINPUT)\n'+fs.readFileSync(`vendor/fomkyr-${VERSION}/fixtures/published/sklyanin-1-2-3.bg`,'utf8'));
cases.push({name:'sklyanin',...sky,degree:6});
try {
 for(const c of cases) {
  const directory=path.join(out,c.name);fs.mkdirSync(directory,{recursive:true});
  const names=c.vars.map((_,i)=>'v'+i),a=algebra(c.vars),s=algebra(names);
  const relations=c.rels.map(r=>toBergman(parseRelation(r,c.vars)).replace(/\b[A-Za-z_][A-Za-z_0-9]*\b/g,v=>names[c.vars.indexOf(v)]??v));
  const source=`LIB "freegb.lib";\nring r=0,(${[...names].reverse().join(',')}),Dp;\ndef A=freeAlgebra(r,${c.degree+1});\nsetring A;\nideal I=${relations.join(',')};\nideal G=twostd(I);\nfor(int j=1;j<=size(G);j++){print("POLY:"+string(G[j]));}\nprint("ORACLE_DONE");\nquit;\n`;
  fs.writeFileSync(path.join(directory,'oracle.sing'),source);
  const result=spawnSync(singular,['-q'],{input:source,env,encoding:'utf8',timeout:120000,killSignal:'SIGKILL',maxBuffer:16*1024*1024});
  const log=(result.stdout??'')+(result.stderr??'');fs.writeFileSync(path.join(directory,'singular.log'),log);
  assert.ifError(result.error);assert.equal(result.status,0);assert.match(log,/ORACLE_DONE/);assert.doesNotMatch(log,/^\s*\?|Could not find dynamic library/m);
  const reference=[...log.matchAll(/^POLY:(.+)$/gm)].map(m=>s.monic(oraclePolynomial(m[1],s,names))).filter(p=>a.degree(a.lead(p))<=c.degree);
  const heads=reference.map(a.lead).sort(),variants=[];
  for(const [bits,execution] of [[32,'single'],[32,'multicore'],[64,'single'],[64,'multicore']]) {
   const client=new BackendClient(path.join(directory,`${bits}-${execution}`),{timeoutMs:120000,workerURL:new URL('../test/support/fomkyr-worker.mjs',import.meta.url)});
   let actual;try{actual=await client.run(buildJob({...c,task:'gb',ring:'noncomm',order:'degleftlex',field:'0',maxdeg:String(c.degree),backend:'fomkyr',memoryMiB:512,nativeWorkers:4,monomialPruning:true,timeoutMinutes:2,fomkyrOptions:{bits:String(bits),execution,resume:false,hilbert:false}}));}finally{await client.close();}
   const basis=a.basis(actual.files['result.gb']);assert.deepEqual(basis.map(a.lead).sort(),heads);
   for(const p of basis)assert.equal(a.nf(p,reference).size,0);
   for(const p of reference)assert.equal(a.nf(p,basis).size,0);
   const input=c.rels.map(a.parse),ambiguities=a.certify(input,basis,c.degree);
   fs.writeFileSync(path.join(directory,`${bits}-${execution}.gb`),actual.files['result.gb']);
   variants.push({bits,execution,passed:true,rules:basis.length,ambiguities,leadingWordsMatch:true,mutualIdealMembership:true});
  }
  report.cases.push({name:c.name,degree:c.degree,singularPassed:true,variants});save();console.log(c.name,'Singular / four Wasm variants PASS');
 }
 report.state='complete';
}catch(error){report.state='failed';report.error=error.stack;throw error;}
finally{save();}
