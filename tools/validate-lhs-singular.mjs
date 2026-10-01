// Complete both generating sets in Singular's own order. Require eligible
// inputs to lie in the returned ideal and every returned element to lie in
// the full original ideal. Also report full equivalence when it is established.
// node tools/validate-lhs-singular.mjs NODE_REPORT [OUTPUT]
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {parseBasis, parseRelation, isHomogeneous} from '../web/src/bergman-syntax.js';
import {algebra} from '../test/support/algebra.mjs';
import {validateTimeoutMs} from '../web/src/time-limit.js';

const [referencePath, output=`build/validation/lhs-singular-${Date.now()}`] = process.argv.slice(2);
assert.ok(referencePath, 'Supply a completed Node parity report.');
const reference=JSON.parse(fs.readFileSync(referencePath,'utf8'));assert.equal(reference.state,'complete');
const cases=reference.cases.filter(c=>c.id.startsWith('lhs-'));
assert.equal(cases.length,reference.sampling.count*1.5);
const out=path.resolve(output);fs.mkdirSync(out,{recursive:true});
const sha=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
const root=path.resolve('build/oracles/root');
const singular=process.env.SINGULAR_BIN||path.join(root,'usr/bin/Singular');
const env={...process.env,LD_LIBRARY_PATH:`${root}/usr/lib/x86_64-linux-gnu:${process.env.LD_LIBRARY_PATH||''}`,
 SINGULARPATH:`${root}/usr/share/singular/LIB:${root}/usr/lib/x86_64-linux-gnu/singular/MOD`};
const timeoutMs=validateTimeoutMs(Number(process.env.GEORGE_TEST_TIMEOUT_MS??60000));
const report={state:'running',startedAt:new Date().toISOString(),reference:path.resolve(referencePath),
 referenceSha256:sha(fs.readFileSync(referencePath)),engines:reference.engines,singular,timeoutMs,
 method:'Eligible inputs in returned ideal; returned basis in full original ideal; full ideal equivalence additionally recorded. Generating sets are completed in Singular, with Letterplace truncation recorded. This does not certify the requested leading-term order or resolution differentials.',results:[]};
const save=()=>fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2)+'\n');
try{
 for(const c of cases){
  const dir=path.join(out,c.id);fs.mkdirSync(dir,{recursive:true});
  const files=JSON.parse(fs.readFileSync(path.join(path.dirname(referencePath),c.id,'compiled.outputs.json'),'utf8'));
  const basis=parseBasis(files['result.gb']).groups.flatMap(g=>g.polys);
  const form=c.form,comm=form.ring==='comm',p=form.field==='0'?0:form.field==='2'?2:Number(form.modulus);
  const weights=form.vars.map((_,i)=>Number(String(form.weights||'').split(/\s+/)[i]||1));
  const weightMap=new Map(form.vars.map((v,i)=>[v,weights[i]]));
  const a=algebra(form.vars,comm,p,weights),bound=Number(form.maxdeg);
  const homogeneous=form.rels.every(r=>isHomogeneous(parseRelation(r,form.vars),weightMap));
  // A bounded basis may omit homogeneous inputs above MAXDEG or include
  // them without processing higher pairs. They remain valid original inputs.
  const eligible=form.rels.filter(r=>!homogeneous||[...a.parse(r).keys()].every(w=>a.degree(w)<=bound));
  const ignored=form.rels.filter(r=>!eligible.includes(r));
  const allPolys=[...eligible,...basis].map(s=>parseRelation(s,form.vars));
  const maxWordLength=Math.max(1,...allPolys.flatMap(terms=>terms.map(t=>t.factors.reduce((n,f)=>n+f.e,0))));
  const letterplaceBound=Math.max(12,bound,maxWordLength*2);
  const code=[comm?'':'LIB "freealgebra.so";',`ring r=${p},(${(comm?form.vars:[...form.vars].reverse()).join(',')}),Dp;`,
   ...(comm?[]:[`def R=freeAlgebra(r,${letterplaceBound});`,'setring R;']),
   `ideal I=${form.rels.join(',')||'0'};`,`ideal J=${eligible.join(',')||'0'};`,`ideal B=${basis.join(',')||'0'};`,
   `ideal G=${comm?'std':'twostd'}(I);`,`ideal H=${comm?'std':'twostd'}(B);`,
   'print("ORACLE:"+string(size(reduce(J,H)))+":"+string(size(reduce(B,G))));',
   'print("FULL:"+string(size(reduce(I,H))));',
   ...(comm&&c.group==='series'?['print("SERIES:"+string(hilb(G,2)));']:[]),'quit;'].join('\n')+'\n';
  fs.writeFileSync(path.join(dir,'singular.sing'),code);report.activeCase=c.id;save();
  const started=performance.now(),r=spawnSync(singular,['-q'],{input:code,encoding:'utf8',env,timeout:timeoutMs||undefined,killSignal:'SIGKILL',maxBuffer:16e6});
  fs.writeFileSync(path.join(dir,'singular.log'),(r.stdout||'')+(r.stderr||''));
  assert.ifError(r.error);assert.equal(r.status,0,c.id+': Singular exited');assert.doesNotMatch(r.stdout,/^\s*\?/m,c.id+': '+r.stdout);
  assert.match(r.stdout,/ORACLE:0:0/,c.id+': eligible inputs and original-ideal membership: '+r.stdout);
  const full=/^FULL:(\d+)$/m.exec(r.stdout);assert.ok(full,c.id+': full-equivalence diagnostic');
  let hilbertCoefficients;
  if(comm&&c.group==='series'){
   // These sampled quotients contain a power of every variable, so their
   // reduced Hilbert numerator is the complete finite Hilbert polynomial.
   const match=/^SERIES:(.*)$/m.exec(r.stdout);assert.ok(match,c.id+': Singular Hilbert output');
   const singularCoefficients=match[1].split(',').map(Number);
   hilbertCoefficients=Array.from({length:7},(_,i)=>singularCoefficients[i]||0);
   const line=files['result.hs'].split('\n').find(l=>l.startsWith('Hilbert power series:'));
   assert.ok(line,c.id+': printed Hilbert series');const printed=Array(7).fill(0);
   for(const term of parseRelation(line.split(':').slice(1).join(':').trim(),['t'])){
    const degree=term.factors.reduce((n,f)=>n+f.e,0);if(degree<7)printed[degree]+=term.sign*Number(term.coef);
   }
   assert.deepEqual(printed,hilbertCoefficients,c.id+': Singular Hilbert coefficients');
  }
  report.results.push({id:c.id,group:c.group,field:p,commutative:comm,order:form.order,
   homogeneous,degreeBound:bound,weights,eligibleInputCount:eligible.length,omittedAboveDegree:ignored,
   basisSize:basis.length,letterplaceBound:comm?null:letterplaceBound,
   eligibleInputMembership:true,basisInOriginalIdeal:true,fullIdealEquivalence:Number(full[1])===0,
   hilbertCoefficients,basisSha256:sha(files['result.gb']),elapsedMs:performance.now()-started});save();console.log(c.id,'Singular PASS');
 }
 report.state='complete';delete report.activeCase;report.summary={cases:cases.length,
  basisCases:report.results.filter(c=>c.group==='basis').length,seriesCases:report.results.filter(c=>c.group==='series').length,
  resolutionUnderlyingAlgebras:report.results.filter(c=>c.group==='resolution').length,
  commutativeHilbertSeries:report.results.filter(c=>c.hilbertCoefficients).length,
  fullIdealEquivalence:report.results.filter(c=>c.fullIdealEquivalence).length,
  allThreeBackendsHaveIdenticalOracleCheckedOutput:true};
}catch(error){report.state='failed';report.error=String(error.stack||error);console.error(error);process.exitCode=1;}
finally{report.finishedAt=new Date().toISOString();save();}
