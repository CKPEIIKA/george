import { getBackend } from './backends.js';
import { deadline, validateTimeoutMs } from './time-limit.js';

// Form computations start in independent Bergman sessions. Console commands
// share the current session. Stop terminates Wasm; the next call restarts it.
export class EclEngine {
  constructor({backend = 'standard', getBackend: readBackend, getTimeoutMs, onReady} = {}) {
    getBackend(backend);
    this.backend = backend;
    this.readBackend = readBackend;
    this.readTimeoutMs = getTimeoutMs;
    this.onReady = onReady;
    this.nextId = 0;
    this.pending = new Map();
    this.generation = 0;
    this.used = false;
    this.busy = false;
  }

  init() {
    if (!this.busy) this.setBackend(this.readBackend?.() ?? this.backend);
    if (this.initializing) return this.initializing;
    const worker = this.worker = new Worker(new URL('../engine/worker.js', import.meta.url), { type: 'module' });
    worker.onmessage = ({ data }) => {
      const p = this.pending.get(data.id);
      if (!p) return;
      if (data.event) { p.onEvent?.(data.event); return; }
      this.pending.delete(data.id);
      if (data.error) {
        const error = Object.assign(new Error(data.error), {code: data.code, partialResult: data.partialResult});
        if (data.code === 'memory-limit') this.cancel(error);
        p.reject(error);
      } else p.resolve(data.result);
    };
    worker.onerror = (event) => {
      event.preventDefault();
      if (worker === this.worker) this.cancel(new Error(event.message || 'Cannot load the WebAssembly engine. Run npm run wasm:build.'));
    };
    this.initializing = this.request('init', {backend: this.backend}).then((info) => {
      if (worker === this.worker) this.onReady?.(info);
      return info;
    }).catch((error) => {
      if (worker === this.worker) this.cancel(error);
      throw error;
    });
    return this.initializing;
  }

  request(command, payload = {}, onEvent) {
    const id = ++this.nextId;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject, onEvent });
      this.worker.postMessage({ id, command, ...payload });
    });
  }

  async execute(command, payload, onEvent, fresh) {
    if (this.busy) throw new Error('A computation is already running.');
    const timeoutMs = validateTimeoutMs(payload.job?.timeoutMs ?? this.readTimeoutMs?.() ?? 0);
    this.setBackend(this.readBackend?.() ?? payload.job?.backend ?? this.backend);
    if (fresh && this.used) this.cancel();
    this.busy = true;
    const generation = this.generation;
    try {
      await this.init();
      if (generation !== this.generation) throw new DOMException('Stopped.', 'AbortError');
      this.used = true;
      const result = this.request(command, payload, onEvent);
      const clearDeadline = deadline(timeoutMs, () => {
        if (generation === this.generation) this.cancel(Object.assign(
          new Error('Computation time limit reached.'), {code: 'timeout', timeoutMs}));
      });
      if (generation === this.generation) this.clearDeadline = clearDeadline;
      else clearDeadline();
      return await result;
    } finally {
      if (generation === this.generation) {
        this.clearDeadline?.();
        this.clearDeadline = null;
        this.busy = false;
      }
    }
  }

  run(job, onEvent) { return this.execute('run', { job }, onEvent, true); }
  eval(source, onEvent) { return this.execute('eval', { source }, onEvent, false); }

  setBackend(id) {
    getBackend(id);
    if (id === this.backend) return;
    if (this.busy) throw new Error('A computation is already running.');
    this.cancel();
    this.backend = id;
  }

  cancel(error = new DOMException('Stopped.', 'AbortError')) {
    this.clearDeadline?.();
    this.clearDeadline = null;
    this.generation++;
    this.worker?.terminate();
    this.worker = null;
    this.initializing = null;
    this.used = this.busy = false;
    for (const p of this.pending.values()) p.reject(error);
    this.pending.clear();
  }
}
