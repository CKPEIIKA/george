// Cross-engine monomial PB check. Bergman's legacy .pb omits C0 and C1.
import fs from 'node:fs';import path from 'node:path';import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {BackendClient} from '../test/support/backend-client.mjs';
import {buildJob} from '../web/src/bergman-syntax.js';
import {setup} from '../fomkyr/tests/node-host.mjs';
import {FomkyrEngine} from '../fomkyr/web/engine.js';
import {createEngine} from '../fomkyr/web/modular-engine.js';
import {dispatchFomkyr} from '../web/engine/fomkyr/george-entry.js';
const out=path.resolve(process.argv[2]??'build/validation/fomkyr-poincare/parity');fs.mkdirSync(out,{recursive:true});setup(path.join(out,'opfs'));
const report={state:'running',passed:false,checks:[],method:'Shared C counter in all four Wasm variants, native CLI, production George dispatcher, exact modular lift, and Bergman monomial PB oracle. No original-algebra minimal Betti claim.'};
const save=()=>fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2)+'\n');
const form={task:'ncpbh',ring:'noncomm',order:'degleftlex',field:'0',backend:'fomkyr',memoryMiB:128,maxdeg:'7',nativeWorkers:1};
const cases=[{name:'free',vars:['a','b'],rels:['0']},{name:'truncated',vars:['a'],rels:['a^3']},{name:'overlap',vars:['a','b'],rels:['a*b*a','b*a*b']},{name:'mixed',vars:['a','b'],rels:['a^2','a*b^2*a','b^3']},{name:'nonmonomial',vars:['a','b'],rels:['b*a-a*b','b^2-a^2']},{name:'linear',vars:['a','b'],rels:['b-a','a^3']}];
function legacyPB(text){
 const m=new Map();const compact=text.replace(/\s/g,'');
 for(const block of compact.matchAll(/([+-]?)t\^(\d+)\*\(([^()]*)\)/g))for(const term of block[3].matchAll(/([+-]?)(\d*)\*?z\^(\d+)/g)){
  const p=Number(term[3]),d=Number(block[2]),v=BigInt(term[2]||1)*(term[1]==='-'?-1n:1n)*(block[1]==='-'?-1n:1n);m.set(`${p},${d}`,(m.get(`${p},${d}`)??0n)+v);
 }
 for(const [k,v]of m)if(!v)m.delete(k);return m;
}
const higher=r=>new Map(r.coefficients.filter(c=>c.homological>=2).map(c=>[`${c.homological},${c.internal}`,BigInt(c.dimension)]));
const sorted=m=>[...m].sort(([a],[b])=>a.localeCompare(b));
const bergman=new BackendClient('web/engine/compiled',{timeoutMs:20000});
try{
 for(const c of cases){
  console.log('CHECK',c.name);
  let pb;
  if(c.name==='linear'){pb=new Map([['2,3',1n],['3,4',1n],['4,6',1n],['5,7',1n]]);}
  else{
  const job=buildJob({...form,...c,backend:'compiled'});if(c.name!=='free')job.script=job.script.replace('(CLEARRING)','(CALCTOLIMIT 7)\n(PRIN2 "PB_EXT_BEGIN")\n(TERPRI)\n(CL:DOLIST (ENTRY (CL:REVERSE DOUBLEPBSERIES)) (CL:WHEN (CL:>= (CL:CAR ENTRY) 2) (CL:LET ((DOUBLEPBSERIES (CL:LIST ENTRY))) (DEGREEPBSERIESDISPLAY))))\n(PRIN2 "PB_EXT_END")\n(TERPRI)\n(CLEARRING)');const b=await bergman.run(job);fs.writeFileSync(path.join(out,c.name+'-bergman-pb.txt'),b.files['result.pb']??'MISSING');fs.writeFileSync(path.join(out,c.name+'-bergman-hs.txt'),b.files['result.hs']??'MISSING');const extended=c.name==='free'?b.files['result.pb']??'':b.stdout.split('PB_EXT_BEGIN')[1]?.split('PB_EXT_END')[0];assert.ok(extended!==undefined);fs.writeFileSync(path.join(out,c.name+'-bergman-extended-pb.txt'),extended);pb=legacyPB(extended);
  }
  for(const [bits,execution]of [[32,'single'],[32,'multicore'],[64,'single'],[64,'multicore']]){
   const fj=buildJob({...form,...c});const{fixture,target,modulus}= (await import('../fomkyr/web/job-adapter.js')).parseNativeJob(fj);
   const e=new FomkyrEngine({...fj.fomkyrOptions,bits,execution,workers:execution==='multicore'?2:1,budgetBytes:128*1048576,timeoutMs:20000,spill:false,exportText:false});
   try{const r=await e.compute(fixture,target,modulus);assert.equal(r.poincare.available,true);assert.equal(r.poincare.eulerInverseCheck,true);assert.equal(r.poincare.originalAlgebraBettiNumbers,false);assert.deepEqual(sorted(higher(r.poincare)),sorted(pb),`${c.name} ${bits}/${execution}`);report.checks.push({name:c.name,bits,execution,bergmanParity:c.name!=='linear',reference:c.name==='linear'?'independent bar homology and k[a]/(a^3) formula; Bergman linear continuation timed out':'Bergman CALCTOLIMIT',states:r.poincare.tailStates});}finally{await e.close();}
  }
  save();
 }
 // Real George dispatch must return downloadable series even if the GB-only
 // optional-Hilbert preference was previously switched off.
 const job=buildJob({...form,vars:['a'],rels:['a^3'],maxdeg:'8',fomkyrOptions:{hilbert:false,spill:false,execution:'single',bits:'32'}});let result;
 await dispatchFomkyr({id:1,backend:'fomkyr',command:'run',job},m=>{if(m.error)throw new Error(m.error);if(m.result)result=m.result;});
 assert.ok(result?.fomkyr?.poincare?.available);for(const name of ['result.pb','result.hs','poincare.json','poincare.csv'])assert.ok(result.files[name],name);
 report.checks.push({name:'George-dispatch',files:Object.keys(result.files),passed:true});
 // The exact modular verification path must count only after Q certification.
 const modular=createEngine({arithmeticMode:'modular-verified',bits:32,execution:'single',budgetBytes:128*1048576,spill:true,workers:1,hilbert:true,poincare:true,poincareRequired:true,modularPrimes:[101,103],modularMinPrimes:2,modularMaxPrimes:2,modularFallback:false,exportText:false});
 try{const r=await modular.compute({variables:['a'],relations:[{degree:3,terms:[{word:[0,0,0],coefficient:'1'}]}]},7,0);assert.equal(r.arithmeticMode,'modular-verified');assert.equal(r.poincare.eulerInverseCheck,true);report.checks.push({name:'modular-verified-Q',passed:true});}finally{await modular.close();}
 const limited=createEngine({arithmeticMode:'modular-verified',bits:32,execution:'single',budgetBytes:128*1048576,spill:true,workers:1,poincare:true,poincareRequired:true,poincareBudgetBytes:0,modularPrimes:[101,103],modularMinPrimes:2,modularMaxPrimes:2,modularFallback:false,exportText:false});let retained;
 try{
  await assert.rejects(limited.compute({variables:['a'],relations:[{degree:3,terms:[{word:[0,0,0],coefficient:'1'}]}]},7,0),/MEMORY_BUDGET/);
  assert.equal(limited.quarantineKey,null);assert.equal(limited.child.lastCheckpoint.completedThroughDegree,7);retained=limited.child.runKey;
 }finally{await limited.close();}
 assert.ok(fs.readdirSync(path.join(out,'opfs','fomkyr',retained)).some(n=>n.startsWith('checkpoint-')));report.checks.push({name:'modular-PB-resource-failure-keeps-certified-checkpoint',passed:true});
 const file=path.join(out,'input.bg');fs.writeFileSync(file,'vars a; a^3;\n');
 for(const wasm of [false,true]){
  const p=spawnSync('fomkyr/dist/fomkyr',[...(wasm?['--wasm']:[]),'-i',file,'-d','8','-j','1','--memory','128M','--poincare','--quiet','--workdir',path.join(out,wasm?'wasm-cli':'native-cli')],{encoding:'utf8',timeout:120000});assert.equal(p.status,0,p.stdout+p.stderr);
  function find(dir){for(const x of fs.readdirSync(dir,{withFileTypes:true})){const q=path.join(dir,x.name);if(x.isDirectory()){const v=find(q);if(v)return v;}else if(x.name==='poincare.json')return q;}}
  const data=JSON.parse(fs.readFileSync(find(path.join(out,wasm?'wasm-cli':'native-cli'))));assert.equal(data.originalAlgebraBettiNumbers,false);assert.equal(data.coefficients.find(c=>c.homological===4&&c.internal===6)?.dimension,'1');report.checks.push({name:wasm?'Wasm-CLI':'native-CLI',passed:true});
 }
 report.passed=true;report.state='complete';save();console.log(JSON.stringify({passed:true,checks:report.checks.length,out}));
}catch(error){report.error=error.stack;report.state='failed';save();throw error;}finally{await bergman.close();}
