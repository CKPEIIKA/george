import test from 'node:test';import assert from 'node:assert/strict';
import {buildJob,parseAnick} from '../web/src/bergman-syntax.js';
import {backendAllows} from '../web/src/backend-capabilities.js';
import {parseNativeJob} from '../web/engine/fomkyr/job-adapter.js';
import {computeAnick,anickText,anickCSV} from '../fomkyr/web/anick.js';
import {readResolution} from '../web/src/resolution-data.js';
const form={backend:'fomkyr',task:'anick',ring:'noncomm',order:'degleftlex',field:'0',vars:['a','aa'],rels:['a*aa','aa*a-a^2'],maxdeg:'6',memoryMiB:256,fomkyrOptions:{hilbert:false}};
test('Fomkyr algebra Anick task reaches C while module/inhomogeneous jobs remain restricted',()=>{
 assert.equal(backendAllows('fomkyr','task','anick'),true);const job=buildJob(form);
 assert.equal(job.fomkyrOptions.anick,true);assert.equal(job.fomkyrOptions.hilbert,true);assert.equal(job.outputs.resolution,'resolution.jsonl');
 const parsed=parseNativeJob(job);assert.equal(parsed.target,6);assert.deepEqual(parsed.fixture.variables,['a','aa']);
 assert.throws(()=>parseNativeJob({...job,task:'gb'}),/Missing fomkyr/);
 assert.throws(()=>parseNativeJob({...job,script:job.script.replace('(GEORGEWRITERESOLUTION "resolution.jsonl")','')}),/Missing Anick/);
 assert.throws(()=>buildJob({...form,augmentation:'monoid'}));
 assert.equal(backendAllows('fomkyr','task','rmodule'),false);
});
test('Anick display uses degree offset and leaves uncomputed degrees empty',()=>{
 const data={certifiedThroughDegree:4,coefficients:[{homological:0,internal:0,dimension:'1',chains:'1',differentialRank:'0',incomingRank:'0'},{homological:2,internal:3,dimension:'7',chains:'8',differentialRank:'0',incomingRank:'1'}]};
 const parsed=parseAnick(anickText(data));assert.equal(parsed.table.rows[1].cells[2],'7');assert.equal(parsed.table.rows[1].cells.length,4);
 assert.match(anickCSV(data),/2,3,8,0,1,7,false/);
 assert.match(anickCSV({...data,conditionalOnExternalDimensions:true}),/2,3,8,0,1,7,true/);
});
test('Explicit trivial resolution is accepted; unmarked missing differentials still fail',()=>{
 const header={format:'george-resolution',version:1,generators:['a'],modulus:0,emptyResolution:true};
 assert.equal(readResolution(JSON.stringify(header),['a'],0).top,0);
 assert.throws(()=>readResolution(JSON.stringify({...header,emptyResolution:false}),['a'],0),/no differentials/);
});
test('Anick output budget rejects before C; a failed export always releases C state',()=>{
 let entered=0,released=0;const e={gn_anick(){entered++;return 0;},gn_anick_stat:k=>k===0?1000000:0,gn_anick_release(){released++;}};
 assert.throws(()=>computeAnick(e,['a'],1000,1024,null,1),/output budget/);assert.equal(entered,0);
 assert.throws(()=>computeAnick(e,['a'],5,1024,null,20000),/export exceeds/);assert.equal(entered,1);assert.equal(released,1);
});
