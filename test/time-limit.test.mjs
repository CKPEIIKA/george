import test from 'node:test';
import assert from 'node:assert/strict';
import {deadline, timeoutMilliseconds} from '../web/src/time-limit.js';
import {buildJob, validateSettings} from '../web/src/bergman-syntax.js';

test('time limits accept unlimited, fractional minutes and very long computations', () => {
 assert.equal(timeoutMilliseconds(),0);
 assert.equal(timeoutMilliseconds(0.5),30000);
 assert.equal(timeoutMilliseconds(525600),31536000000);
 for(const value of [-1,NaN,Infinity,'bad',Number.MAX_SAFE_INTEGER])assert.throws(()=>timeoutMilliseconds(value),/Time limit/);
 const form={task:'gb',ring:'noncomm',field:'0',order:'degleftlex',vars:['a'],rels:['a^2']};
 assert.equal(buildJob(form).timeoutMs,0);
 assert.equal(buildJob({...form,timeoutMinutes:30}).timeoutMs,1800000);
 assert.ok(validateSettings({...form,timeoutMinutes:-1}).some(s=>s.startsWith('Time limit')));
});
test('long deadlines are chunked instead of overflowing the browser timer', () => {
 const original=globalThis.setTimeout; const calls=[];
 globalThis.setTimeout=(fn,ms)=>{calls.push(ms);return original(()=>{},0);};
 try {
  const clear=deadline(31536000000,()=>assert.fail('expired immediately'));
  assert.deepEqual(calls,[2147483647]); clear();
  deadline(0,()=>assert.fail('unlimited expired'))(); assert.equal(calls.length,1);
 }finally{globalThis.setTimeout=original;}
});
