import fs from 'node:fs';
import {runJob} from '../../web/engine/runner.js';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
const root = path.resolve('vendor/bergman-1.001/tests');
export function regressionJob(legacy) {
  const text = fs.readFileSync(path.join(root, 'clisp/unix/clisp_list'), 'utf8');
  const names = [...new Set([...text.matchAll(/\.\.\/\.\.\/test_bergman\/clisp\/([^" ]+)/g)].map(m => m[1]))].sort();
  const files = {};
  for (const name of fs.readdirSync(path.join(root, 'test_bergman'))) {
    const file = path.join(root, 'test_bergman', name);
    if (fs.statSync(file).isFile()) files[`/tests/${name}`] = fs.readFileSync(file, 'utf8');
  }
  const script = `(SETLEGACYMODE ${legacy ? 'T' : 'NIL'})\n` + text.replaceAll('../../test_bergman/clisp/', '/results/').replaceAll('../../test_bergman/', '/tests/').replace(/\(quit\)/ig, '');
  files['/results/.keep'] = '';
  const outputs = Object.fromEntries(names.map(n => [n, `/results/${n}`]));
  const expected = Object.fromEntries(names.map(n => [outputs[n], fs.readFileSync(path.join(root, 'test_bergman', !legacy && n === 'ncpbhg.pb' ? 'ncpbhg.pb.old' : `clisp/${n}`), 'utf8')]));
  return { job: { files, script, outputs }, expected };
}
export async function wasmRuntime({onOutput,engineDir=process.env.GEORGE_ENGINE_DIR||'web/engine'}={}) {
  const enginePath=path.resolve(engineDir);
  const { default: create } = await import(pathToFileURL(path.join(enginePath,'ecl.js')));
  let stdout = '';
  const start = performance.now();
  const output = s => { stdout += s + '\n'; onOutput?.(s); };
  const m = await create({ locateFile: p => path.join(enginePath,p), print: output, printErr: output, stdin: () => null });
  const code = m.ccall('george_init', 'number', [], []);
  if (code) throw new Error(`init ${code}: ${stdout}`);
  m.FS.mkdirTree('/work'); m.FS.chdir('/work');
  m.ccall('george_eval', 'number', ['string', 'number'], ['(SETF CL:*DEFAULT-PATHNAME-DEFAULTS* #P"/work/")', 0]);
  const startupMs = performance.now() - start;
  return { m, startupMs, enginePath, run(job) {
    stdout = '';
    const t = performance.now();
    try { return { ...runJob(m,job), elapsedMs:performance.now()-t, stdout, memoryBytes:m.HEAPU8.length }; }
    catch(e) { throw new Error(`${e.message}\n${stdout}`, {cause:e}); }
  }};
}
