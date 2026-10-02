// Production Native NC coordinator/lane code with upstream's test-only OPFS adapter.
import {parentPort, workerData} from 'node:worker_threads';
import {setup} from '../../vendor/george-native-0.1.0/tests/node-host.mjs';
import {NativeEngine} from '../../web/engine/native/engine.js';
import {parseNativeJob} from '../../web/engine/native/job-adapter.js';
setup(workerData.directory);
parentPort.postMessage({ready: true});
parentPort.on('message', async ({id, job}) => {
  let engine;
  try {
    const {fixture, target, modulus} = parseNativeJob(job);
    engine = new NativeEngine({budgetBytes: job.memoryMiB * 1048576,
      timeoutMs: job.timeoutMs, resume: false, previewBytes: 1048576,
      ...job.nativeOptions});
    const result = await engine.compute(fixture, target, modulus);
    await engine.close();
    parentPort.postMessage({id, result: {...result, files: {'result.gb': result.preview}, memoryBytes: engine.memory.buffer.byteLength}});
  } catch (error) {
    await engine?.close();
    parentPort.postMessage({id, error: error.stack || error.message});
  }
});
