import fs from 'node:fs';
import assert from 'node:assert/strict';
import { regressionJob, wasmRuntime } from '../test/support/regression.mjs';
const out = process.argv[2] || `build/validation/wasm-${Date.now()}`;
fs.mkdirSync(out, { recursive: true });
const report = [];
try {
  for (const legacy of [true, false]) {
    const { job, expected } = regressionJob(legacy);
    const runtime = await wasmRuntime();
    const result = runtime.run(job);
    fs.writeFileSync(`${out}/${legacy ? 'legacy' : 'fixed'}.log`, result.stdout);
    for (const [file, text] of Object.entries(expected)) assert.equal(result.files[file], text, `${legacy ? 'legacy' : 'fixed'} ${file}`);
    const row = { legacy, outputs: Object.keys(expected).length, startupMs: runtime.startupMs, elapsedMs: result.elapsedMs, memoryBytes: result.memoryBytes };
    report.push(row); console.log(row);
  }
  fs.writeFileSync(`${out}/report.json`, JSON.stringify(report, null, 2));
} catch (e) { console.error(e); process.exitCode = 1; }
