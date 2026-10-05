// Refresh provenance after intentional changes to the standalone subproject.
import fs from 'node:fs';
import path from 'node:path';
import {digest} from './release-support.mjs';
const root='kircracker',file=root+'/SOURCE.json',source=JSON.parse(fs.readFileSync(file));
const excluded=new Set(['bin','evidence','results-local','kircracker-work','.cache','__pycache__']);
const records={};
function visit(directory=''){
  for(const name of fs.readdirSync(path.join(root,directory)).sort()){
    if(excluded.has(name)||name.endsWith('.pyc'))continue;
    const relative=path.posix.join(directory,name),absolute=path.join(root,relative);
    if(relative==='SOURCE.json')continue;
    if(fs.statSync(absolute).isDirectory())visit(relative);
    else {const bytes=fs.readFileSync(absolute);records[relative]={bytes:bytes.length,sha256:digest(bytes)};}
  }
}
visit();source.retainedFiles=records;
fs.writeFileSync(file,JSON.stringify(source,null,2)+'\n');
console.log(`Refreshed ${Object.keys(records).length} Kircracker inputs.`);
