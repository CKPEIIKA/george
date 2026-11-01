// Exact cross-engine tests for the production Anick task and C exports.
import fs from 'node:fs';import path from 'node:path';import assert from 'node:assert/strict';import {spawnSync} from 'node:child_process';
import {BackendClient} from '../test/support/backend-client.mjs';import {buildJob,parseAnick} from '../web/src/bergman-syntax.js';
import {readResolution} from '../web/src/resolution-data.js';import {certifyResolution} from '../test/support/resolution.mjs';
import {setup} from '../fomkyr/tests/node-host.mjs';import {FomkyrEngine} from '../fomkyr/web/engine.js';
import {createEngine} from '../fomkyr/web/modular-engine.js';import {parseNativeJob} from '../fomkyr/web/job-adapter.js';
import {dispatchFomkyr} from '../web/engine/fomkyr/george-entry.js';
const out=path.resolve(process.argv[2]??'build/validation/fomkyr-anick/parity');fs.mkdirSync(out,{recursive:true});setup(path.join(out,'opfs'));
const report={state:'running',passed:false,checks:[],method:'Actual C differentials replayed independently over the algebra; actual Betti tables compared with Bergman; four Wasm variants and native CLI.'};
const save=()=>fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2)+'\n');
const form={task:'anick',backend:'fomkyr',ring:'noncomm',order:'degleftlex',field:'0',maxdeg:'6',memoryMiB:256,nativeWorkers:1};
const cases=[{name:'free',vars:['a','b'],rels:['0']},{name:'power',vars:['a'],rels:['a^3']},{name:'commutative',vars:['a','b'],rels:['b*a-a*b']},{name:'cancellation',vars:['a','b'],rels:['a*b','b*a-a^2']},{name:'rational',vars:['a','b'],rels:['7*b*a-11*a*b','b^2']},{name:'prime2',vars:['a','b'],rels:['a*b','b*a-a^2'],field:'2'},{name:'prime5',vars:['a','b'],rels:['a*b','b*a-a^2'],field:'p',modulus:5}];
const fk3=JSON.parse(fs.readFileSync('fomkyr/fixtures/fk3.json'));cases.push({name:'fk3-control',vars:fk3.variables,rels:fk3.relations.map(r=>r.terms.map(t=>`${t.coefficient}*${t.word.map(i=>fk3.variables[i]).join('*')}`).join('+').replaceAll('+-','-')),maxdeg:'4'});
function bettiMap(parsed,D){
 assert.ok(parsed.table,'Bergman did not return a Betti table');const m=new Map();
 for(const row of parsed.table.rows)for(let j=0;j<parsed.table.cols.length;j++){const cell=row.cells[j];if(cell&&cell!=='-'){const p=Number(parsed.table.cols[j]),d=p+Number(row.label);if(d<=D)m.set(`${p},${d}`,cell);}}return [...m].sort();
}
const bergman=new BackendClient('web/engine/compiled',{timeoutMs:30000});
try{
 for(const c of cases){
  console.log('CHECK',c.name);const job=buildJob({...form,...c}),{fixture,target,modulus}=parseNativeJob(job);
  const b=await bergman.run(buildJob({...form,...c,backend:'compiled'}));fs.writeFileSync(path.join(out,c.name+'-bergman.anick'),b.files['result.anick']??'MISSING');
  const expected=bettiMap(parseAnick(b.files['result.anick']),target);
  for(const [bits,execution]of [[32,'single'],[32,'multicore'],[64,'single'],[64,'multicore']]){
   const e=new FomkyrEngine({...job.fomkyrOptions,bits,execution,workers:execution==='multicore'?2:1,budgetBytes:256*1048576,spill:false,timeoutMs:20000});
   try{
    const r=await e.compute(fixture,target,modulus),a=r.anick;assert.equal(a.checkedFullSquareZero,true);assert.equal(a.originalAlgebraBettiNumbers,true);assert.equal(a.eulerInverseCheck,true);
    const got=a.coefficients.filter(x=>x.dimension!=='0').map(x=>[`${x.homological},${x.internal}`,x.dimension]).sort();assert.deepEqual(got,expected,c.name+' '+bits+'/'+execution);
    const identities=certifyResolution(r.anickFiles['resolution.jsonl'],r.preview,fixture.variables,modulus);readResolution(r.anickFiles['resolution.jsonl'],fixture.variables,modulus);
    fs.writeFileSync(path.join(out,`${c.name}-${bits}-${execution}.jsonl`),r.anickFiles['resolution.jsonl']);
    report.checks.push({name:c.name,bits,execution,bergmanBettiParity:true,independentFullSquareZero:identities,chainCount:a.chainCount});save();
   }finally{await e.close();}
  }
 }
 // All-linear presentations resolve k by k alone; structural reader accepts
 // this explicitly marked empty resolution without inventing chains.
 const empty=new FomkyrEngine({bits:32,execution:'single',workers:1,budgetBytes:128*1048576,spill:false,anick:true,hilbert:true,timeoutMs:20000});
 try{const r=await empty.compute({variables:['a'],relations:[{degree:1,terms:[{word:[0],coefficient:'1'}]}]},5,0);assert.equal(readResolution(r.anickFiles['resolution.jsonl'],['a'],0).top,0);assert.deepEqual(r.anick.coefficients.map(x=>x.dimension),['1']);report.checks.push({name:'empty-resolution',passed:true});}finally{await empty.close();}
 let dispatched;
 await dispatchFomkyr({id:1,backend:'fomkyr',command:'run',job:buildJob({...form,...cases[3],fomkyrOptions:{bits:'32',execution:'single',spill:true,hilbert:false}})},m=>{if(m.error)throw Error(m.error);if(m.result)dispatched=m.result;});
 for(const name of ['resolution.jsonl','betti.json','betti.csv','result.anick'])assert.ok(dispatched.files[name]);assert.equal(dispatched.fomkyr.anick.originalAlgebraBettiNumbers,true);report.checks.push({name:'production-dispatch',passed:true});
 const modular=createEngine({arithmeticMode:'modular-verified',bits:32,execution:'single',workers:1,budgetBytes:256*1048576,spill:true,anick:true,hilbert:true,modularPrimes:[101,103],modularMinPrimes:2,modularMaxPrimes:2,modularFallback:false,exportText:false,timeoutMs:20000});
 try{const r=await modular.compute({variables:['a'],relations:[{degree:3,terms:[{word:[0,0,0],coefficient:'1'}]}]},7,0);assert.equal(r.anick.originalAlgebraBettiNumbers,true);assert.equal(r.anick.eulerInverseCheck,true);report.checks.push({name:'modular-certified-Q',passed:true});}finally{await modular.close();}
 const input=path.join(out,'input.bg');fs.writeFileSync(input,'vars a,b; a*b,b*a-a^2;\n');
 for(const wasm of [false,true]){
  const work=path.join(out,wasm?'wasm-cli':'native-cli');const p=spawnSync('fomkyr/dist/fomkyr',[...(wasm?['--wasm']:[]),'-i',input,'-d','6','-j','1','--memory','256M','--anick','--export','--quiet','--workdir',work],{encoding:'utf8',timeout:30000});assert.equal(p.status,0,p.stderr+p.stdout);
  function find(dir){for(const x of fs.readdirSync(dir,{withFileTypes:true})){const q=path.join(dir,x.name);if(x.isDirectory()){const found=find(q);if(found)return found;}else if(x.name==='resolution.jsonl')return q;}}
  const resolution=find(work),r=JSON.parse(fs.readFileSync(path.join(path.dirname(resolution),'betti.json')));assert.equal(r.coefficients.find(c=>c.homological===2&&c.internal===3).dimension,'0');certifyResolution(fs.readFileSync(resolution,'utf8'),fs.readFileSync(path.join(path.dirname(resolution),'result.gb'),'utf8'),['a','b'],0);report.checks.push({name:wasm?'Wasm-CLI':'native-CLI',passed:true});
 }
 report.passed=true;report.state='complete';save();console.log(JSON.stringify({passed:true,checks:report.checks.length,out}));
}catch(error){report.error=error.stack;report.state='failed';save();throw error;}finally{await bergman.close();}
