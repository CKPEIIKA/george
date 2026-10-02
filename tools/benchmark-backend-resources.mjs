// Serial, cold browser jobs with Linux process-tree CPU/PSS sampling.
// No debugger or profiler is attached to the browser during computations.
// node tools/benchmark-backend-resources.mjs --out build/validation/backend-resources
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import os from 'node:os';
import {spawn, execFileSync} from 'node:child_process';
import {staticServer} from './serve.mjs';
import {buildJob, readInputFile, parseBasis} from '../web/src/bergman-syntax.js';

const arg = (name, fallback) => {
  const at = process.argv.indexOf(name);
  return at < 0 ? fallback : process.argv[at + 1];
};
const out = path.resolve(arg('--out', 'build/validation/backend-resources'));
const degrees = arg('--degrees', '2,3,4,5,6,7,8').split(',').map(Number);
const timeoutSeconds = Number(arg('--timeout-seconds', '120'));
const memoryMiB = Number(arg('--memory-mib', '2048'));
const trials = Number(arg('--trials', '1'));
const sampleMs = 250;
if (process.platform !== 'linux') throw new Error('Resource sampling requires Linux /proc.');
if (degrees.some(d => !Number.isInteger(d) || d < 2 || d > 12)) throw new Error('Choose degrees 2..12.');
if (!Number.isInteger(trials) || trials < 1 || trials > 20) throw new Error('Choose 1..20 trials.');
fs.mkdirSync(out, {recursive: true});
const temporary = path.join(out, 'browser-profiles');
fs.mkdirSync(temporary, {recursive: true});
const clockTicks = Number(execFileSync('getconf', ['CLK_TCK'], {encoding: 'utf8'}));
const inputFile = 'test/fixtures/fomin-kirillov-user.json';
const inputText = JSON.parse(fs.readFileSync(inputFile)).inputText;
const {vars, rels} = readInputFile('(ALGFORMINPUT)\n' + inputText);
const fomkyrVersion = JSON.parse(fs.readFileSync('web/engine/fomkyr/build.json')).version;
const configurations = [
  {id: 'standard', backend: 'standard', browser: 'chromium', label: 'Lisp / ECL O2'},
  {id: 'optimized', backend: 'optimized', browser: 'chromium', label: 'Lisp / ECL O3 + LTO'},
  {id: 'compiled', backend: 'compiled', browser: 'chromium', label: 'C / ECL O3 + LTO'},
  {id: 'memory64', backend: 'memory64', browser: 'chromium', label: 'C / ECL O3 + LTO (memory64)'},
  {id: 'native', backend: 'native', browser: 'chromium', label: 'Native NC (memory64, 4 workers)', workers: 4},
  {id: 'native-firefox', backend: 'native', browser: 'firefox', label: 'Native NC (memory64, Firefox)', workers: 4},
  {id: 'fomkyr', backend: 'fomkyr', browser: 'chromium', label: `fomkyr ${fomkyrVersion} (memory64, Chromium, 4 workers)`, workers: 4},
  {id: 'fomkyr-firefox', backend: 'fomkyr', browser: 'firefox', label: `fomkyr ${fomkyrVersion} (memory64, Firefox, 4 workers)`, workers: 4},
];
const selected = arg('--configs', configurations.map(c => c.id).join(',')).split(',');
const configs = selected.map(id => {
  const c = configurations.find(c => c.id === id);
  if (!c) throw new Error('Unknown configuration: ' + id);
  return c;
});
const reportFile = path.join(out, 'report.json');
const previous = process.argv.includes('--resume') && fs.existsSync(reportFile)
  ? JSON.parse(fs.readFileSync(reportFile)) : null;
const sha = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const sourceFiles = ['web/src/engine.js', 'web/engine/worker.js', 'web/engine/native/engine.js',
  'web/engine/native/runtime.js', 'web/engine/native/george-entry.js', 'web/engine/native/storage.js',
  'web/engine/native/george32.wasm', 'web/engine/native/george64.wasm', 'web/engine/ecl.wasm',
  'web/engine/optimized/ecl.wasm', 'web/engine/compiled/ecl.wasm', 'web/engine/memory64/ecl.wasm', 'web/engine/ecl.data',
  ...fs.readdirSync('web/engine/fomkyr').filter(name=>/\.(?:js|wasm)$/.test(name)).map(name=>'web/engine/fomkyr/'+name)];
const sourceHashes = Object.fromEntries(sourceFiles.map(file => [file, sha(file)]));
if (previous && (JSON.stringify(previous.sourceHashes) !== JSON.stringify(sourceHashes)
  || previous.memoryMiB !== memoryMiB)) throw new Error('Cannot resume across source or memory-setting changes.');
const report = previous ?? {
  state: 'running', startedAt: new Date().toISOString(), version: JSON.parse(fs.readFileSync('package.json')).version,
  inputFile, inputSha256: sha(inputFile), variables: vars.length, relations: rels.length,
  machine: {cpu: fs.readFileSync('/proc/cpuinfo', 'utf8').match(/^model name\s*:\s*(.+)$/m)?.[1],
    logicalCpus: os.cpus().length, totalRamMiB: os.totalmem() / 1048576, platform: process.platform},
  sourceHashes, memoryMiB, sampleIntervalSeconds: sampleMs / 1000,
  method: {
    cpu: 'Sum of process-tree user and system CPU time during engine startup, computation and result delivery; core-seconds, not wall seconds. Linux /proc/<pid>/stat, no debugger or CPU profiler.',
    ram: 'Peak sum of browser-process proportional set sizes (PSS). Shared pages are proportionally counted. Includes browser baseline; allocated Wasm capacity is recorded separately. Sampled every 0.25 seconds, so very brief peaks may be missed.',
    jobs: 'Fresh browser profile and fresh engine per point. No OPFS resume. Serial runs. Bergman and fomkyr use monomial pruning. Specialized engines select memory64 with four requested workers and Hilbert disabled. Legacy Native may fall back to one Firefox worker; fomkyr uses the portable OPFS broker.',
    wall: 'Cold engine wall time includes engine startup, calculation, export and result transfer; browser startup and HTML rendering are excluded.',
    uncertainty: 'One cold run per point unless multiple trials are requested. Host load and filesystem/browser caches can affect timings. No claim of cross-machine performance.',
  }, rows: [], errors: [],
};
report.state = 'running';
report.configurations = configs;
report.degrees = degrees;
report.requestedTrials = trials;
report.timeLimitSeconds = timeoutSeconds;
const save = () => fs.writeFileSync(reportFile, JSON.stringify(report, null, 2) + '\n');
save();

function processTree(root) {
  const all = new Map();
  for (const name of fs.readdirSync('/proc')) {
    if (!/^\d+$/.test(name)) continue;
    try {
      const stat = fs.readFileSync('/proc/' + name + '/stat', 'utf8');
      const f = stat.slice(stat.lastIndexOf(')') + 2).trim().split(/\s+/);
      all.set(Number(name), {pid: Number(name), parent: Number(f[1]),
        ticks: Number(f[11]) + Number(f[12]), identity: name + ':' + f[19]});
    } catch { /* process exited during sampling */ }
  }
  const pids = new Set([root]);
  let changed = true;
  while (changed) {
    changed = false;
    for (const p of all.values()) if (!pids.has(p.pid) && pids.has(p.parent)) {pids.add(p.pid); changed = true;}
  }
  return [...pids].map(pid => all.get(pid)).filter(Boolean);
}

class Sampler {
  constructor(root) {this.root = root; this.previous = new Map(); this.samples = []; this.cpuTicks = 0;}
  sample(initial = false) {
    let pssKiB = 0, rssKiB = 0;
    const tree = processTree(this.root);
    for (const p of tree) {
      const before = this.previous.get(p.identity);
      if (!initial) this.cpuTicks += before === undefined ? p.ticks : Math.max(0, p.ticks - before);
      this.previous.set(p.identity, p.ticks);
      try {
        const rollup = fs.readFileSync('/proc/' + p.pid + '/smaps_rollup', 'utf8');
        pssKiB += Number(rollup.match(/^Pss:\s+(\d+)/m)?.[1] ?? 0);
        rssKiB += Number(rollup.match(/^Rss:\s+(\d+)/m)?.[1] ?? 0);
      } catch { /* process exited or is a zombie */ }
    }
    const point = {seconds: (performance.now() - this.startAt) / 1000,
      cpuSeconds: this.cpuTicks / clockTicks, pssMiB: pssKiB / 1024, rssMiB: rssKiB / 1024, processes: tree.length};
    this.samples.push(point);
    return point;
  }
  start() {this.startAt = performance.now(); this.baseline = this.sample(true); this.timer = setInterval(() => this.sample(), sampleMs);}
  stop() {
    clearInterval(this.timer);
    const end = this.sample();
    return {cpuSeconds: end.cpuSeconds, measuredWallSeconds: end.seconds,
      averageCpuPercent: 100 * end.cpuSeconds / end.seconds,
      peakPssMiB: Math.max(...this.samples.map(s => s.pssMiB)),
      peakRssMiB: Math.max(...this.samples.map(s => s.rssMiB)), baselinePssMiB: this.baseline.pssMiB,
      samples: this.samples};
  }
}

async function browserJob() {
  const {config, job} = await (await fetch('/__resource/data')).json();
  const {EclEngine} = await import('/src/engine.js');
  const post = (kind, data) => fetch('/__resource/' + kind, {method: 'POST', body: JSON.stringify(data)});
  const memory = [];
  let lastDegree = null, lastProgress = null;
  const engine = new EclEngine({backend: config.backend, onMemory: bytes => memory.push(bytes)});
  await post('start', {userAgent: navigator.userAgent, hardwareConcurrency: navigator.hardwareConcurrency,
    isolated: crossOriginIsolated});
  const start = performance.now();
  // The cap includes cold engine startup, rather than starting after init().
  const cap = setTimeout(() => engine.cancel(Object.assign(new Error('Benchmark time limit reached.'),
    {code: 'timeout'})), job.timeoutMs);
  try {
    await engine.init();
    const initialized = performance.now();
    const result = await engine.run(job,event=>{
      if(event.type==='degree'||event.type==='degree-start')lastDegree=event;
      if(event.type==='progress')lastProgress=event;
    });
    const end = performance.now();
    const native = result.fomkyr ?? result.native;
    let basis = result.files['result.gb'];
    if (native?.previewTruncated && native.fullBasisPath) {
      const parts = native.fullBasisPath.split('/');
      let directory = await navigator.storage.getDirectory();
      for (const part of parts.slice(0,-1)) directory = await directory.getDirectoryHandle(part);
      basis = await (await (await directory.getFileHandle(parts.at(-1))).getFile()).text();
    }
    await post('end', {status: 'complete', coldWallSeconds: (end - start) / 1000,
      engineStartupSeconds: (initialized - start) / 1000, jobWallSeconds: (end - initialized) / 1000,
      allocatedWasmMiB: result.memoryBytes / 1048576, peakAllocatedWasmMiB: Math.max(...memory) / 1048576,
      native: native ? {basisSize: native.basisSize, completedThroughDegree: native.completedThroughDegree,
        workers: native.workers, bits: native.bits, storageAccess: native.ioMode ?? native.storageAccess,
        shared: native.shared, version: native.version, storage: native.storage,
        previewTruncated: !!native.previewTruncated, kernelWallSeconds: native.elapsedMs / 1000} : null,
      basis, stdout: result.stdout, lastDegree, lastProgress});
  } catch (error) {
    await post('end', {status: error.code === 'timeout' ? 'timeout' : error.code === 'memory-limit' ? 'oom' : 'error',
      coldWallSeconds: (performance.now() - start) / 1000, error: error.stack || String(error), code: error.code,
      lastDegree, lastProgress,
      peakAllocatedWasmMiB: memory.length ? Math.max(...memory) / 1048576 : null});
  } finally {clearTimeout(cap); engine.cancel();}
}

async function run(config, degree, trial) {
  const job = buildJob({task: 'gb', ring: 'noncomm', order: 'degleftlex', field: '0', vars, rels,
    maxdeg: String(degree), memoryMiB, backend: config.backend, lowterms: 'quick', nonhomog: 'degreewise',
    monomialPruning: config.backend !== 'native', timeoutMinutes: timeoutSeconds / 60});
  if (config.backend === 'native') job.nativeOptions = {workers: config.workers, bits: 64, resume: false};
  if (config.backend === 'fomkyr') job.fomkyrOptions = {...job.fomkyrOptions, workers: config.workers, bits: '64', resume: false, hilbert: false};
  const key = `${config.id}-d${degree}-t${trial}`;
  let finish, browser, sampler, row, watchdog;
  const done = new Promise(resolve => {finish = resolve;});
  const server = staticServer('web', '/', {isolate: true});
  const serve = server.listeners('request')[0]; server.removeAllListeners('request');
  server.on('request', async (req, res) => {
    if (req.url.startsWith('/__resource/')) {
      try {
        res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
        res.setHeader('Cross-Origin-Embedder-Policy', 'require-corp');
        if (req.url === '/__resource/page') {
          res.setHeader('content-type', 'text/html');
          res.end(`<!doctype html><title>George resource benchmark</title><script type="module">(${browserJob})();</script>`); return;
        }
        if (req.url === '/__resource/data') {res.setHeader('content-type', 'application/json'); res.end(JSON.stringify({config, job})); return;}
        let text = ''; for await (const chunk of req) text += chunk;
        const value = JSON.parse(text || '{}');
        if (req.url === '/__resource/start') {
          sampler = new Sampler(browser.pid); sampler.start();
          row = {id: config.id, backend: config.backend, browser: config.browser, degree, trial,
            memoryMiB, timeLimitSeconds: timeoutSeconds, requestedWorkers: config.workers ?? 1, environment: value, hostLoadAtStart: os.loadavg()};
          console.log(key, 'started');
        } else if (req.url === '/__resource/end') {
          if (!sampler) {res.statusCode = 409; res.end('The measurement has not started.'); return;}
          const measured = sampler?.stop(); sampler = null;
          row = {...row, ...value, ...measured};
          if (row.basis) {
            const parsed = parseBasis(row.basis);
            row.basisSize = row.native?.basisSize ?? parsed.groups.reduce((n, g) => n + g.polys.length, 0);
            row.outputHasDone = parsed.done;
            row.basisFile = key + '.gb'; fs.writeFileSync(path.join(out, row.basisFile), row.basis);
          }
          fs.writeFileSync(path.join(out, key + '.stdout.txt'), row.stdout ?? '');
          delete row.stdout; delete row.basis;
          fs.writeFileSync(path.join(out, key + '.samples.json'), JSON.stringify(row.samples));
          row.samplesFile = key + '.samples.json'; delete row.samples;
          report.rows.push(row); save();
          console.log(key, row.status, row.coldWallSeconds?.toFixed(2), 's wall,', row.cpuSeconds?.toFixed(2),
            'core-s,', row.peakPssMiB?.toFixed(1), 'MiB PSS,', row.basisSize, 'rules');
          res.end('ok'); finish(); return;
        }
        res.end('ok');
      } catch (error) {res.statusCode = 500; res.end(String(error)); report.errors.push({key, error: error.stack}); save(); finish();}
      return;
    }
    serve(req, res);
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const profile = fs.mkdtempSync(path.join(temporary, key + '-'));
  const url = `http://127.0.0.1:${server.address().port}/__resource/page`;
  const executable = config.browser === 'firefox'
    ? path.resolve(arg('--firefox', 'build/playwright-browsers/firefox-1543/firefox/firefox')) : '/usr/bin/chromium';
  if (config.browser === 'firefox') fs.writeFileSync(path.join(profile, 'user.js'),
    'user_pref("browser.shell.checkDefaultBrowser", false);\nuser_pref("browser.startup.homepage_override.mstone", "ignore");\nuser_pref("datareporting.policy.dataSubmissionEnabled", false);\nuser_pref("toolkit.telemetry.enabled", false);\n');
  const args = config.browser === 'firefox' ? ['-headless', '--no-remote', '-profile', profile, url]
    : ['--headless=new', '--no-sandbox', '--disable-dev-shm-usage', '--disable-background-networking',
      '--no-first-run', '--no-default-browser-check', `--user-data-dir=${profile}`, url];
  browser = spawn(executable, args, {stdio: ['ignore', 'ignore', 'pipe'], detached: true});
  let stderr = '';
  browser.stderr.on('data', data => {stderr = (stderr + data).slice(-12000);});
  browser.on('error', error => {report.errors.push({key, error: String(error)}); save(); finish();});
  const exited = new Promise(resolve => browser.once('exit', (code, signal) => {
    if (!row?.status) {report.errors.push({key, error: `Browser exited: ${code ?? signal}`, stderr}); save(); finish();}
    resolve();
  }));
  watchdog = setTimeout(() => {
    const measured = sampler?.stop(); sampler = null;
    row = {...row, id: config.id, backend: config.backend, browser: config.browser, degree, trial,
      status: 'watchdog', error: 'Browser watchdog expired', ...measured};
    delete row.samples; report.rows.push(row); save(); finish();
  }, (timeoutSeconds + 120) * 1000);
  try {await done;}
  finally {
    clearTimeout(watchdog); if (sampler) sampler.stop();
    try {process.kill(-browser.pid, 'SIGTERM');} catch {}
    const force = setTimeout(() => {try {process.kill(-browser.pid, 'SIGKILL');} catch {}}, 3000);
    await exited; clearTimeout(force);
    server.closeAllConnections(); await new Promise(resolve => server.close(resolve));
    fs.writeFileSync(path.join(out, key + '.browser.log'), stderr);
    fs.rmSync(profile, {recursive: true, force: true, maxRetries: 5, retryDelay: 200});
  }
}

try {
  // Firefox degree 7 first gives a quick comparison to the reported 25 s.
  const first = configs.find(c => c.id === 'native-firefox');
  if (first && degrees.includes(7) && !report.rows.some(r => r.id === first.id && r.degree === 7 && r.trial === 0)) await run(first, 7, 0);
  for (let trial = 0; trial < trials; trial++) for (const degree of degrees) {
    const rotated = [...configs.slice(degree % configs.length), ...configs.slice(0, degree % configs.length)];
    for (const config of rotated) {
      if (report.rows.some(r => r.id === config.id && r.degree === degree && r.trial === trial)) continue;
      if (process.argv.includes('--skip-censored') && report.rows.some(r=>r.id===config.id&&r.degree===degree&&['timeout','oom'].includes(r.status))) continue;
      await run(config, degree, trial);
    }
  }
  report.state = report.errors.length ? 'errors' : 'complete';
  report.finishedAt = new Date().toISOString(); save();
} catch (error) {report.state = 'failed'; report.errors.push({error: error.stack}); save(); throw error;}
console.log(out, report.state);
