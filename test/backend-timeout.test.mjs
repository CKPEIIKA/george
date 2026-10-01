import test from 'node:test';
import assert from 'node:assert/strict';
import {BackendClient} from './support/backend-client.mjs';

test('a hung synchronous computation is timed out and a replacement worker runs', async () => {
  const options = {timeoutMs: 1000, workerURL: new URL('./support/timeout-worker.mjs', import.meta.url)};
  const stuck = new BackendClient('', options);
  await assert.rejects(stuck.run({hang: true}), /timed out/);
  assert.equal(stuck.closed, true); assert.equal(stuck.pending, null); await stuck.close();
  const replacement = new BackendClient('', options);
  try { assert.deepEqual(await replacement.run({}), {files: {test: 'ok'}}); }
  finally { await replacement.close(); }
});
test('the backend validation watchdog can be disabled',async()=>{
 const runtime=new BackendClient('',{timeoutMs:0,workerURL:new URL('./support/timeout-worker.mjs',import.meta.url)});
 try {assert.deepEqual(await runtime.run({}),{files:{test:'ok'}});}
 finally{await runtime.close();}
});
