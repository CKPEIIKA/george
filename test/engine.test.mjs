import test from 'node:test';
import assert from 'node:assert/strict';
import {EclEngine} from '../web/src/engine.js';
class WorkerStub {
 static workers=[];
 constructor(){this.messages=[];WorkerStub.workers.push(this);}
 postMessage(message){this.messages.push(message);if(message.command==='init')queueMicrotask(()=>this.reply(message,{ready:true}));}
 reply(message,result){this.onmessage({data:{id:message.id,result}});}
 terminate(){this.terminated=true;}
}
globalThis.Worker=WorkerStub;
const tick=()=>new Promise(r=>setTimeout(r,0));
test('console retains its session; form jobs start fresh',async()=>{
 const e=new EclEngine();let p=e.eval('first');await tick();const w=e.worker;w.reply(w.messages.at(-1),{stdout:'1'});await p;
 p=e.eval('second');await tick();assert.equal(e.worker,w);w.reply(w.messages.at(-1),{});await p;
 p=e.run({});await tick();assert.notEqual(e.worker,w);assert.equal(w.terminated,true);e.worker.reply(e.worker.messages.at(-1),{});await p;e.cancel();
});
test('cancellation rejects a running command and permits restart',async()=>{
 const e=new EclEngine(),p=e.eval('forever');const rejected=assert.rejects(p,{name:'AbortError'});await tick();e.cancel();await rejected;
 const next=e.eval('again');await tick();e.worker.reply(e.worker.messages.at(-1),{stdout:'ok'});assert.equal((await next).stdout,'ok');e.cancel();
});
test('a cancelled initialization cannot mark a replacement command idle',async()=>{
 const e=new EclEngine(),p=e.eval('old'),rejected=assert.rejects(p,{name:'AbortError'});e.cancel();const next=e.eval('new');await rejected;await tick();assert.equal(e.busy,true);e.worker.reply(e.worker.messages.at(-1),{});await next;e.cancel();
});
test('concurrent commands are rejected',async()=>{
 const e=new EclEngine(),p=e.eval('one');await assert.rejects(e.eval('two'),/already running/);await tick();e.worker.reply(e.worker.messages.at(-1),{});await p;e.cancel();
});
test('a Lisp command error retains the worker and permits the next console command',async()=>{
 const e=new EclEngine(),failed=e.eval('(simple)'),rejected=assert.rejects(failed,/Keyboard input is unavailable/);
 await tick();const w=e.worker,request=w.messages.at(-1);
 w.onmessage({data:{id:request.id,error:'Bergman evaluation failed.\nError: Keyboard input is unavailable.'}});
 await rejected;assert.equal(e.worker,w);assert.equal(e.busy,false);assert.equal(e.used,true);
 const next=e.eval('(+ 1 2)');await tick();assert.equal(e.worker,w);w.reply(w.messages.at(-1),{stdout:'3\n'});
 assert.equal((await next).stdout,'3\n');e.cancel();
});
test('worker startup failures reject pending commands',async()=>{
 const e=new EclEngine(),p=e.eval('one'),rejected=assert.rejects(p,/missing engine/);e.worker.onerror({message:'missing engine',preventDefault(){}});await rejected;assert.equal(e.worker,null);assert.equal(e.pending.size,0);
});
test('memory exhaustion keeps partial output and restarts the next command',async()=>{
 const e=new EclEngine(),failed=e.run({}),rejected=assert.rejects(failed,error=>{
  assert.equal(error.code,'memory-limit');assert.equal(error.partialResult.files['result.gb'],'% 2\nx^2,\n');return true;
 });
 await tick();const w=e.worker,request=w.messages.at(-1);
 w.onmessage({data:{id:request.id,error:'memory exhausted',code:'memory-limit',partialResult:{files:{'result.gb':'% 2\nx^2,\n'},interrupted:true}}});
 await rejected;assert.equal(w.terminated,true);assert.equal(e.worker,null);assert.equal(e.pending.size,0);
 const next=e.eval('(+ 1 2)');await tick();assert.notEqual(e.worker,w);e.worker.reply(e.worker.messages.at(-1),{stdout:'3\n'});await next;e.cancel();
});
test('backend changes restart the next command and initialize the selected worker', async () => {
 let backend='standard'; const e=new EclEngine({getBackend:()=>backend});
 let p=e.eval('first'); await tick(); const old=e.worker;
 assert.equal(old.messages[0].backend,'standard');
 backend='compiled'; assert.equal(e.worker,old,'changing the setting preserves the running worker');
 old.reply(old.messages.at(-1),{}); await p;
 p=e.eval('second'); await tick(); assert.equal(old.terminated,true);
 assert.equal(e.worker.messages[0].backend,'compiled'); e.worker.reply(e.worker.messages.at(-1),{}); await p;
 assert.throws(()=>e.setBackend('__proto__'),/Unknown/); e.cancel();
});
