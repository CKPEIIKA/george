import { getBackend, memory64Supported } from '../src/backends.js';
import { runJob, setMemoryLimit } from './runner.js';
import { observeWasmMemory } from '../src/memory-monitor.js';

let runtime;
let activeBackend;
let output = '';
let pending = '';
let activeId;
let reportedMemoryBytes;
function reportMemory(bytes) {
  if (activeId !== undefined && bytes !== reportedMemoryBytes) {
    reportedMemoryBytes = bytes;
    postMessage({id: activeId, event: {type: 'memory', bytes}});
  }
}
function flush() {
  if (pending && activeId !== undefined) postMessage({ id: activeId, event: { type: 'stdout', text: pending } });
  pending = '';
}
function print(line) {
  const text = `${line}\n`;
  output += text;
  pending += text;
  if (pending.length >= 8192) flush();
}

onmessage = async ({ data: { id, command, job, source, backend = 'standard' } }) => {
  activeId = id;
  reportedMemoryBytes = undefined;
  output = pending = '';
  const start = performance.now();
  try {
    if (command === 'init') {
      if (getBackend(backend).memory64 && !memory64Supported()) throw new Error('This browser does not support the memory64 engine. Select a 32-bit engine.');
      activeBackend = backend;
      const assets = new URL(getBackend(backend).directory, new URL('../src/backends.js', import.meta.url));
      const {default: createGeorgeModule} = await import(new URL('ecl.js', assets).href);
      const [data, wasm] = await Promise.all(['ecl.data','ecl.wasm'].map(async name => {
        // Both engines use the identical Bergman bytecode package.
        const url = name === 'ecl.data' ? new URL(name, import.meta.url) : new URL(name, assets);
        const response=await fetch(url, {signal:AbortSignal.timeout(45000)});
        if (!response.ok) throw new Error(`Cannot load ${name}: HTTP ${response.status}. Run npm run wasm:build.`);
        return response.arrayBuffer();
      }));
      runtime = await createGeorgeModule(observeWasmMemory({ print, printErr: print, stdin: () => null, wasmBinary:wasm, getPreloadedPackage:()=>data, locateFile: (p) => new URL(p, assets).href }, reportMemory));
      const status = runtime.ccall('george_init', 'number', [], []);
      if (status) throw new Error(`Bergman initialization failed (${status}). ${output}`);
      setMemoryLimit(runtime, undefined, activeBackend);
      runtime.FS.mkdirTree('/work');
      runtime.FS.chdir('/work');
      if (runtime.ccall('george_eval', 'number', ['string', 'number'], ['(SETF CL:*DEFAULT-PATHNAME-DEFAULTS* #P"/work/")', 0])) throw new Error('Cannot set the working directory.');
      flush();
      postMessage({ id, result: { name: 'ECL / WebAssembly', version: 'bergman-1.001-fix', backend, ready: true, startupMs: performance.now() - start } });
      return;
    }
    if (!runtime) throw new Error('Engine has not initialized.');
    reportMemory(runtime.HEAPU8.byteLength);
    let result;
    if (job) result = runJob(runtime,{...job, backend: activeBackend});
    else {
      const status = runtime.ccall('george_eval','number',['string','number'],[source,1]);
      if (status) {
        const error = new Error(status === 2 ? 'The computation exhausted its memory limit. Increase Memory limit under More settings or set a maximal degree.' : 'Bergman evaluation failed.');
        if (status === 2) error.code = 'memory-limit';
        throw error;
      }
      result={files:{}};
    }
    flush();
    postMessage({ id, result: { ...result, stdout: output, connected: true, elapsedMs: performance.now() - start, memoryBytes: runtime.HEAPU8.length } });
  } catch (error) {
    flush();
    postMessage({ id, error: `${error.message || String(error)}\n${output.trim().split('\n').slice(-8).join('\n')}`, code: error.code, partialResult: error.partialResult });
  } finally {
    activeId = undefined;
  }
};
