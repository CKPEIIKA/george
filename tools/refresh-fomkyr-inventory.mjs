// Refresh the curated subproject inventory after intentional source changes.
import fs from 'node:fs';
import path from 'node:path';
import {fomkyrSourceInput} from './fomkyr-source.mjs';
import {digest} from './release-support.mjs';
const file='fomkyr/SOURCE.json',source=JSON.parse(fs.readFileSync(file)),before=source.retainedBuildAndTestFiles,records={};
function visit(directory=''){
 for(const name of fs.readdirSync(path.join('fomkyr',directory)).sort()){
  const relative=path.posix.join(directory,name);
  if(relative==='SOURCE.json'||!fomkyrSourceInput(relative))continue;
  const absolute=path.join('fomkyr',relative);
  if(fs.statSync(absolute).isDirectory())visit(relative);
  else {
   const bytes=fs.readFileSync(absolute),sha256=digest(bytes),original=before[relative]?.originalSha256??before[relative]?.sha256;
   records[relative]={bytes:bytes.length,sha256,...(original&&original!==sha256?{originalSha256:original}:{})};
  }
 }
}
visit();source.version=JSON.parse(fs.readFileSync('fomkyr/package.json')).version;
source.retainedBuildAndTestFiles=records;
source.kernelChanged=Object.entries(records).some(([name,r])=>name.startsWith('src/')&&r.originalSha256&&r.sha256!==r.originalSha256);
fs.writeFileSync(file,JSON.stringify(source,null,2)+'\n');
console.log(`Refreshed ${Object.keys(records).length} curated Fomkyr source files.`);
