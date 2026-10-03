// Shared identities, atomic reports and append-only timing for local release work.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {fomkyrSourceInput} from './fomkyr-source.mjs';

export function stableJSON(value) {
  if (Array.isArray(value)) return '[' + value.map(stableJSON).join(',') + ']';
  if (value && typeof value === 'object') return '{' + Object.keys(value).sort()
    .filter(key => value[key] !== undefined).map(key => JSON.stringify(key) + ':' + stableJSON(value[key])).join(',') + '}';
  return JSON.stringify(value);
}
export const digest = value => crypto.createHash('sha256').update(value).digest('hex');
export const fileHash = file => digest(fs.readFileSync(file));
export function inventory(inputs, include = () => true) {
  const files = new Set();
  const visit = (file, ancestors = new Set()) => {
    if (!include(file)) return;
    const stat = fs.statSync(file);
    if (stat.isDirectory()) {
      const real = fs.realpathSync(file);
      if (ancestors.has(real)) throw new Error('Directory cycle in release inputs: ' + file);
      const next = new Set([...ancestors, real]);
      for (const entry of fs.readdirSync(file).sort()) visit(path.join(file, entry), next);
    }
    else if (stat.isFile()) files.add(file);
  };
  inputs.forEach(file => visit(file));
  return Object.fromEntries([...files].sort().map(file => [file, fileHash(file)]));
}
export function writeJSON(file, value) {
  fs.mkdirSync(path.dirname(file), {recursive:true});
  const temporary = file + '.' + process.pid + '.' + crypto.randomUUID() + '.tmp';
  try { fs.writeFileSync(temporary, JSON.stringify(value, null, 2) + '\n'); fs.renameSync(temporary, file); }
  finally { fs.rmSync(temporary, {force:true}); }
}
export function validationSnapshot() {
  return inventory(['package.json', 'package-lock.json', 'web', 'test', 'tools',
    'fomkyr', '.github/workflows/pages.yml'], file =>
    !file.startsWith('web/sources/') && (!file.startsWith('fomkyr/') || fomkyrSourceInput(file.slice('fomkyr/'.length)))
    && !file.endsWith('.so') && !file.includes('/__pycache__') && !file.endsWith('.pyc'));
}
export function engineHashes() {
  return Object.fromEntries(fs.readdirSync('web/engine/fomkyr').filter(name => /\.(js|wasm)$/.test(name)).sort()
    .map(name => [name, fileHash('web/engine/fomkyr/' + name)]));
}

export class CheckTimings {
  constructor(directory) {
    this.directory = directory;
    this.file = path.join(directory, 'timings.json');
    fs.mkdirSync(directory, {recursive:true});
    this.rows = fs.existsSync(this.file) ? JSON.parse(fs.readFileSync(this.file)) : [];
  }
  begin(name) {
    const row = {name, attempt:this.rows.filter(row => row.name === name).length + 1,
      startedAt:new Date().toISOString(), state:'running'};
    this.rows.push(row); writeJSON(this.file, this.rows);
    return {row, start:performance.now()};
  }
  end(check, error) {
    Object.assign(check.row, {finishedAt:new Date().toISOString(),
      elapsedSeconds:(performance.now() - check.start) / 1000, state:error ? 'failed' : 'passed'});
    if (error) check.row.error = String(error.stack || error);
    writeJSON(this.file, this.rows);
  }
  async measure(name, operation) {
    const check = this.begin(name);
    try { const value = await operation(); this.end(check); return value; }
    catch (error) { this.end(check, error); throw error; }
  }
  run(name, command, args, options = {}) {
    const check = this.begin(name), log = path.join(this.directory, name + '.log');
    fs.appendFileSync(log, `\n--- attempt ${check.row.attempt}, ${check.row.startedAt} ---\n`);
    try {
      const result = spawnSync(command, args, {encoding:'utf8', timeout:120000,
        maxBuffer:16 * 1024 * 1024, killSignal:'SIGKILL', ...options});
      fs.appendFileSync(log, (result.stdout || '') + (result.stderr || ''));
      assert.ifError(result.error);
      assert.equal(result.status, 0, name + ': see ' + log);
      this.end(check); return result.stdout;
    } catch (error) { this.end(check, error); throw error; }
  }
}
