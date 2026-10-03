// Production Fomkyr coordinator/lanes; only OPFS is emulated in Node.
import {parentPort, workerData} from 'node:worker_threads';
import fs from 'node:fs';
import path from 'node:path';
import {setup} from '../../fomkyr/tests/node-host.mjs';
import {FomkyrEngine} from '../../web/engine/fomkyr/engine.js';
import {parseNativeJob} from '../../web/engine/fomkyr/job-adapter.js';
setup(workerData.directory);
parentPort.postMessage({ready: true});
parentPort.on('message', async ({id, job}) => {
  let engine;
  try {
    const {fixture, target, modulus} = parseNativeJob(job);
    engine = new FomkyrEngine({budgetBytes: job.memoryMiB * 1048576,
      timeoutMs: job.timeoutMs, resume: false, previewBytes: 1048576, ...job.fomkyrOptions});
    const result = await engine.compute(fixture, target, modulus);
    await engine.close();
    const basis=result.previewTruncated&&result.fullBasisPath?fs.readFileSync(path.join(workerData.directory,result.fullBasisPath),'utf8'):result.preview;
    parentPort.postMessage({id, result: {...result, files: {'result.gb': basis}, memoryBytes: engine.memory.buffer.byteLength}});
  } catch (error) {
    await engine?.close();
    parentPort.postMessage({id, error: error.stack || error.message});
  }
});
