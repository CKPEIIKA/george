import {Worker} from 'node:worker_threads';
import {deadline, validateTimeoutMs} from '../../web/src/time-limit.js';
export class BackendClient {
  constructor(directory, {timeoutMs = 60000, onOutput, workerURL = new URL('./backend-worker.mjs', import.meta.url)} = {}) {
    this.timeoutMs = validateTimeoutMs(timeoutMs); this.onOutput = onOutput; this.nextId = 0;
    this.worker = new Worker(workerURL, {workerData: {directory}});
    this.ready = new Promise((resolve, reject) => {
      this.resolveReady = resolve; this.rejectReady = reject;
    });
    this.worker.on('message', data => {
      if (data.event === 'stdout') { this.onOutput?.(data.text); return; }
      if (data.ready) { this.clearStartup(); this.resolveReady(); return; }
      if (data.id === this.pending?.id) {
        const p = this.pending; this.pending = null; p.clearTimer();
        if (data.error) p.reject(new Error(data.error)); else p.resolve(data.result);
      }
    });
    this.worker.on('error', error => this.fail(error));
    this.worker.on('exit', code => { if (code !== 0 && !this.closed) this.fail(new Error(`Engine worker exited (${code}).`)); });
    this.clearStartup = () => {};
    this.clearStartup = deadline(timeoutMs, () => this.fail(new Error('Engine startup timed out.')));
  }
  fail(error) {
    this.clearStartup(); this.rejectReady(error);
    if (this.pending) { this.pending.clearTimer(); this.pending.reject(error); this.pending = null; }
    this.close();
  }
  async run(job) {
    await this.ready;
    if (this.closed) throw new Error('Engine worker is closed.');
    if (this.pending) throw new Error('Engine worker is already running.');
    const id = ++this.nextId;
    return new Promise((resolve, reject) => {
      this.pending = {id, resolve, reject, clearTimer: () => {}};
      const clearTimer = deadline(this.timeoutMs, () => this.fail(new Error(`Computation timed out after ${this.timeoutMs / 1000} seconds.`)));
      if (this.pending?.id === id) {this.pending.clearTimer = clearTimer; this.worker.postMessage({id, job});}
      else clearTimer();
    });
  }
  close() {
    this.closed = true; this.clearStartup();
    const error = new Error('Engine worker is closed.');
    this.rejectReady(error);
    if (this.pending) { this.pending.clearTimer(); this.pending.reject(error); this.pending = null; }
    return this.worker.terminate();
  }
}
