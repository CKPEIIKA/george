// Corresponding-source archives built from one commit, so the published site
// carries exactly the sources of the code it serves. Local and CI builds of the
// same commit produce identical bytes. The ECL archive is fixed and stays in git.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import zlib from 'node:zlib';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {copyFomkyrSource} from './fomkyr-source.mjs';

const GEORGE_PATHS = ['README.md','LICENSE.md','package.json','package-lock.json','.gitignore','.gitattributes','.github',
  'licenses','ports','tools','test','docs','vendor','fomkyr','web'];
// Generated binaries and reports are omitted; build inputs and regression
// fixtures are retained. A pathspec * also matches across directories.
const GEORGE_EXCLUDES = ['web/sources/*','web/engine/ecl.*','web/engine/*/ecl.*','*.wasm','*.so','*.o','*.a',
  'docs/development/validation/*','docs/development/HANDOFF.md','fomkyr/results/*','fomkyr/.cache/*',
  '*.log','*/__pycache__/*','*.pyc'];
const LIMIT = 20 * 1024 * 1024;
const gzip = bytes => zlib.gzipSync(bytes, {level: 9});

export function georgeSourceArchive(commit = 'HEAD') {
  const tar = execFileSync('git', ['archive', '--format=tar', commit, '--', ...GEORGE_PATHS,
    ...GEORGE_EXCLUDES.map(pattern => ':(exclude)' + pattern)], {maxBuffer: 1 << 30});
  const archive = gzip(tar);
  if (archive.length >= LIMIT) throw Error('George source archive exceeds the 20 MiB source-package allowance.');
  return archive;
}

export function fomkyrSourceArchive(commit = 'HEAD') {
  const stage = fs.mkdtempSync(path.join(os.tmpdir(), 'george-fomkyr-source-'));
  try {
    const checkout = path.join(stage, 'checkout'), bundle = path.join(stage, 'bundle');
    fs.mkdirSync(checkout);
    execFileSync('tar', ['-xf', '-', '-C', checkout], {input: execFileSync('git', ['archive', '--format=tar', commit, '--', 'fomkyr'], {maxBuffer: 1 << 30})});
    copyFomkyrSource(path.join(bundle, 'fomkyr'), path.join(checkout, 'fomkyr') + path.sep);
    return gzip(execFileSync('tar', ['--format=gnu', '--sort=name', '--mtime=@0', '--owner=0', '--group=0', '--numeric-owner',
      '-cf', '-', '-C', bundle, 'fomkyr'], {maxBuffer: 1 << 30}));
  } finally { fs.rmSync(stage, {recursive: true, force: true}); }
}

export const SOURCE_ARCHIVES = {'george-source.tar.gz': georgeSourceArchive, 'fomkyr-source.tar.gz': fomkyrSourceArchive};

// Write the archives beside a local site so it serves them as Pages will.
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const directory = process.argv[2] ?? 'web/sources', commit = process.argv[3] ?? 'HEAD';
  fs.mkdirSync(directory, {recursive: true});
  for (const [name, build] of Object.entries(SOURCE_ARCHIVES)) {
    fs.writeFileSync(path.join(directory, name), build(commit));
    console.log(path.join(directory, name));
  }
}
