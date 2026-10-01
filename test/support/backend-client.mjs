import {Worker} from 'node:worker_threads';
export class BackendClient {
  constructor(directory, {timeoutMs = 60000, onOutput, workerURL = new URL('./backend-worker.mjs', import.meta.url)} = {}) {
    this.timeoutMs = timeoutMs; this.onOutput = onOutput; this.nextId = 0;
    this.worker = new Worker(workerURL, {workerData: {directory}});
    this.ready = new Promise((resolve, reject) => {
      this.resolveReady = resolve; this.rejectReady = reject;
    });
    this.worker.on('message', data => {
      if (data.event === 'stdout') { this.onOutput?.(data.text); return; }
      if (data.ready) { clearTimeout(this.startupTimer); this.resolveReady(); return; }
      if (data.id === this.pending?.id) {
        const p = this.pending; this.pending = null; clearTimeout(p.timer);
        if (data.error) p.reject(new Error(data.error)); else p.resolve(data.result);
      }
    });
    this.worker.on('error', error => this.fail(error));
    this.worker.on('exit', code => { if (code !== 0 && !this.closed) this.fail(new Error(`Engine worker exited (${code}).`)); });
    this.startupTimer = setTimeout(() => this.fail(new Error('Engine startup timed out.')), timeoutMs);
  }
  fail(error) {
    clearTimeout(this.startupTimer); this.rejectReady(error);
    if (this.pending) { clearTimeout(this.pending.timer); this.pending.reject(error); this.pending = null; }
    this.close();
  }
  async run(job) {
    await this.ready;
    if (this.closed) throw new Error('Engine worker is closed.');
    if (this.pending) throw new Error('Engine worker is already running.');
    const id = ++this.nextId;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => this.fail(new Error(`Computation timed out after ${this.timeoutMs / 1000} seconds.`)), this.timeoutMs);
      this.pending = {id, resolve, reject, timer};
      this.worker.postMessage({id, job});
    });
  }
  close() {
    this.closed = true; clearTimeout(this.startupTimer);
    const error = new Error('Engine worker is closed.');
    this.rejectReady(error);
    if (this.pending) { clearTimeout(this.pending.timer); this.pending.reject(error); this.pending = null; }
    return this.worker.terminate();
  }
}
