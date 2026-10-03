// Independent derived-invariant check of a completed deep checkpoint. No GB replay.
import fs from 'node:fs';import os from 'node:os';import path from 'node:path';import assert from 'node:assert/strict';import {spawnSync} from 'node:child_process';
import {setup} from './node-host.mjs';import {FomkyrEngine} from '../web/engine.js';
const [source,degreeArg,out='results/0.6.1/deep-hilbert.json']=process.argv.slice(2),degree=Number(degreeArg);
assert.ok(source&&Number.isSafeInteger(degree)&&degree>0);
const root=fs.mkdtempSync(path.join(os.tmpdir(),'fomkyr-deep-hilbert-'));fs.cpSync(source,root,{recursive:true});setup(root);
const fixture=JSON.parse(fs.readFileSync('fixtures/fk6.json'));let result;
try{
 const e=new FomkyrEngine({bits:32,workers:4,budgetBytes:512*1048576,scratchBytes:128*1048576,resume:true,progress:false,hilbert:true,hilbertRequired:true,hilbertDegree:degree,exportText:false,timeoutMs:120000});
 try{result=await e.compute(fixture,degree,0);}finally{await e.close();}
 assert.ok(result.cacheHit&&result.resumedFromDegree>=degree,'Expected a completed checkpoint, not a GB rerun');
 const input=path.join(root,'fomkyr',result.runKey,'basis.gnb');
 const checked=spawnSync('python3',['-c',`import sys,json\nsys.path[:0]=['tools','tests']\nfrom pathlib import Path\nfrom canonical_audit import records\nfrom oracle import hilbert\ng=list(records(Path(sys.argv[1]),int(sys.argv[2]),15))\nprint(json.dumps([str(x) for x in hilbert([max(r) for r in g],15,int(sys.argv[2]))]))`,input,String(degree)],{encoding:'utf8',timeout:120000,maxBuffer:1048576});
 assert.equal(checked.status,0,checked.stderr);const independent=JSON.parse(checked.stdout);assert.deepEqual(result.hilbert.coefficients,independent);
 fs.mkdirSync(path.dirname(out),{recursive:true});fs.writeFileSync(out,JSON.stringify({passed:true,degree,modulus:0,sourceStorage:source,engineVersion:result.version,cacheHit:result.cacheHit,coefficients:independent,method:'C Hilbert DP versus independently implemented Python forbidden-word automaton and arbitrary-size integers',independentGroebnerCertificate:false},null,2)+'\n');console.log('Deep Hilbert equality PASS',degree,independent);
}finally{fs.rmSync(root,{recursive:true,force:true});}
