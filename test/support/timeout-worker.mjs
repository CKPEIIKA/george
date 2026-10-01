import {parentPort} from 'node:worker_threads';
parentPort.postMessage({ready: true});
parentPort.on('message', ({id, job}) => {
  if (job.hang) for (;;) { /* exercise the external watchdog */ }
  parentPort.postMessage({id, result: {files: {test: 'ok'}}});
});
