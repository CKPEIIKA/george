// Keep synchronous Wasm computation off the test controller's thread, so a
// genuine hang can be timed out and its partial log retained.
import {parentPort, workerData} from 'node:worker_threads';
import {wasmRuntime} from './regression.mjs';
const runtime = await wasmRuntime({engineDir: workerData.directory,
  onOutput: text => parentPort.postMessage({event: 'stdout', text})});
parentPort.postMessage({ready: true});
parentPort.on('message', ({id, job}) => {
  try { parentPort.postMessage({id, result: runtime.run(job)}); }
  catch (error) { parentPort.postMessage({id, error: error.message}); }
});
