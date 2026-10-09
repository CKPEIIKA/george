// Refresh provenance after intentional changes to the standalone subproject.
import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {digest} from './release-support.mjs';
const root='kircracker',file=root+'/SOURCE.json',source=JSON.parse(fs.readFileSync(file));
// Only files in git are inventoried; the proof archive and the data derived
// from it live outside git and are listed separately under externalFiles.
const tracked=execFileSync('git',['ls-files','-z','--',root],{encoding:'utf8'}).split('\0').filter(Boolean)
  .map(file=>file.slice(root.length+1)).filter(file=>file!=='SOURCE.json').sort();
const records={};
for(const relative of tracked){const bytes=fs.readFileSync(path.join(root,relative));records[relative]={bytes:bytes.length,sha256:digest(bytes)};}
source.retainedFiles=records;
fs.writeFileSync(file,JSON.stringify(source,null,2)+'\n');
console.log(`Refreshed ${Object.keys(records).length} Kircracker inputs.`);
