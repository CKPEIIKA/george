// Stage the current subproject without copying local reports or native products.
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

export const FOMKYR_SOURCE = 'fomkyr';
export function fomkyrSourceInput(relative) {
  return !/^fk_gate\/(?:evidence|dist)(?:\/|$)/.test(relative)
    && !/^(?:results|\.cache)(?:\/|$)/.test(relative)
    && !(relative.startsWith('dist/') && !relative.endsWith('.wasm'))
    && !/^fomkyr-job(?:\/|$)/.test(relative)
    && !/(?:^|\/)__pycache__(?:\/|$)/.test(relative)
    && !/\.(?:so|o|a|pyc|log|gcda|gcno|profraw|profdata)$/.test(relative);
}
export function copyFomkyrSource(destination) {
  const source = fileURLToPath(new URL('../fomkyr/',import.meta.url));
  fs.cpSync(source,destination,{recursive:true,
    filter:file=>fomkyrSourceInput(path.relative(source,file).split(path.sep).join('/'))});
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (!process.argv[2]) throw new Error('Usage: node tools/fomkyr-source.mjs <staging-directory>');
  copyFomkyrSource(process.argv[2]);
}
