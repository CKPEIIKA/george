// Actual four WASM variants; fs-backed OPFS adapter, not a browser certification.
import fs from 'node:fs';import path from 'node:path';import assert from 'node:assert/strict';import crypto from 'node:crypto';import {spawnSync} from 'node:child_process';
import {setup} from './node-host.mjs';import {FomkyrEngine} from '../web/engine.js';
import {FK_GATE_PROFILE_ID,FK_GATE_UPSTREAM_PROFILE_ID,FK_GATE_LEGACY_PROFILE_IDS} from '../web/fk-gate.js';
const root=path.resolve('results/0.6.8/gate-wasm');fs.rmSync(root,{recursive:true,force:true});fs.mkdirSync(root,{recursive:true});setup(root);
const fixture=JSON.parse(fs.readFileSync('fixtures/fk6.json'));const reports=[];
const base={budgetBytes:256*1048576,workers:4,spill:true,hilbert:true,exportText:false,progress:false,timeoutMs:120000,resume:false,quantumMs:1,lookahead:64,hilbertGate:true,hilbertSectors:true,gateBudgetBytes:64*1048576};
for(const [bits,execution] of [[32,'multicore'],[64,'multicore'],[32,'single'],[64,'single']]){
 const runKey=`fk6-${bits}-${execution}`;const e=new FomkyrEngine({...base,bits,execution,runKey});let r;
 try{r=await e.compute(fixture,6,0);}finally{await e.close();}
 assert.equal(r.fkGateProfileVersion,'0.3.1');assert.equal(r.certifiedProfileThroughDegree,17);assert.equal(r.completeDimensionThroughDegree,17);assert.equal(r.completedThroughDegree,6);assert.equal(r.fkGate.status,3);assert.equal(r.fkGateProfileId,FK_GATE_PROFILE_ID);assert(r.conditionalOnImportedFkDimensions);assert(r.fkGate.sectorSkips>0);assert.equal(r.hilbert.coefficients[6],'64432');
 const record=path.join(root,'fomkyr',runKey,'basis.gnb');reports.push({bits,execution,record,result:r});console.log('FK GATE WASM PASS',bits,execution,r.fkGate);
}
// Profile use cannot become an unconditional cache hit simply by unchecking it.
const runKey='fk6-32-multicore',record=path.join(root,'fomkyr',runKey,'basis.gnb');const before=fs.readFileSync(record);let refused;
// Public provenance redaction keeps identical upstream mathematical authority.
const cacheDir=path.dirname(record);
for(const name of ['checkpoint-0.json','checkpoint-1.json','partial-0.json','partial-1.json']) {
 const file=path.join(cacheDir,name);if(!fs.existsSync(file))continue;
 const envelope=JSON.parse(fs.readFileSync(file));envelope.payload.fkGateProfileId=FK_GATE_LEGACY_PROFILE_IDS[0];
 envelope.sha256=crypto.createHash('sha256').update(JSON.stringify(envelope.payload)).digest('hex');fs.writeFileSync(file,JSON.stringify(envelope));
}

const denied=new FomkyrEngine({...base,hilbertGate:false,runKey,resume:true});try{await denied.compute(fixture,7,0);}catch(e){refused=e;}finally{await denied.close();}
assert.equal(refused?.code,'FK_GATE_PROFILE_REQUIRED');assert.deepEqual(fs.readFileSync(record),before);
// Resume matching bytes with different bitness, concurrency and sector mode.
const resumed=new FomkyrEngine({...base,bits:64,execution:'single',runKey,resume:true,hilbertSectors:false});let r;
try{r=await resumed.compute(fixture,7,0);}finally{await resumed.close();}
assert.equal(r.completedThroughDegree,7);assert.equal(r.fkGate.sectors,false);reports.push({bits:64,execution:'single-resume-total',record,result:r});
// Unavailable count workspace falls back to ordinary reduction, not guessed zero.
const smallKey='counter-unavailable';const small=new FomkyrEngine({...base,runKey:smallKey,gateBudgetBytes:0});let sm;
try{sm=await small.compute(fixture,5,0);}finally{await small.close();}
assert.equal(sm.completedThroughDegree,5);assert.equal(sm.fkGate.sectorSkips,0);reports.push({execution:'counter-fallback',record:path.join(root,'fomkyr',smallKey,'basis.gnb'),result:sm});
// Wrong field disables the aid, while the field itself is retained.
const fp=new FomkyrEngine({...base,runKey:'prime-disabled'});let fr;
try{fr=await fp.compute(fixture,4,2);}finally{await fp.close();}
assert.equal(fr.modulus,2);assert(!fr.fkGateProfileId);reports.push({execution:'F2-disabled',modulus:2,record:path.join(root,'fomkyr/prime-disabled/basis.gnb'),result:fr});
const manifest=path.join(root,'manifest.json');fs.writeFileSync(manifest,JSON.stringify(reports,null,2));
// Separate bounded independent prefix audits retain the per-calculation cap.
// Full degree-7 gated/ungated equivalence is checked by test_fk_gate_cli_068.py.
const audits=[];
for(const [index,item] of reports.entries()){
 const directory=path.join(root,`audit-${index}`);fs.mkdirSync(directory);
 const input=path.join(directory,'manifest.json');fs.writeFileSync(input,JSON.stringify([item]));
 const audit=spawnSync('python3',['tests/audit_fk_gate_wasm_068.py',input],{encoding:'utf8',timeout:120000});assert.equal(audit.status,0,audit.stdout+audit.stderr);console.log(audit.stdout);
 const evidence=JSON.parse(fs.readFileSync(path.join(directory,'independent-audit.json')));assert(evidence.passed);audits.push(...evidence.cases);
}
fs.writeFileSync(path.join(root,'independent-audit.json'),JSON.stringify({passed:true,cases:audits,highDegreeProfileProofReplayed:false},null,2));
fs.writeFileSync('results/0.6.8/gate-wasm.json',JSON.stringify({passed:true,cases:reports,independentAudits:audits,missingProfileRejected:true,bytesPreserved:true},null,2));
