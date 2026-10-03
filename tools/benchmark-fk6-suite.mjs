// Serial degree 1–9 measurements of the updated fomkyr on both recorded forms.
// Existing baselines remain archived. --all-backends explicitly remeasures them.
import path from 'node:path';
import {VERSION} from '../web/engine/fomkyr/storage.js';
import fs from 'node:fs';
import {spawnSync} from 'node:child_process';
const allBackends=process.argv.includes('--all-backends');
const out=path.resolve(process.argv.slice(2).find(value=>!value.startsWith('--'))??'local/benchmarks/fomkyr-'+VERSION+'-resources');fs.mkdirSync(out,{recursive:true});
const run=(command,args)=>{const result=spawnSync(command,args,{stdio:'inherit'});if(result.error)throw result.error;if(result.status!==0)throw new Error(command+' exited '+result.status);};
const scenarios=[['fk6','test/fixtures/fomin-kirillov-user.json'],['random-fk6','test/fixtures/random-fk6-growing.json']];
for(const [name,input] of scenarios){
  const directory=path.join(out,name);
  run(process.execPath,['tools/benchmark-backend-resources.mjs','--out',directory,'--input-file',input,'--degrees','1,2,3,4,5,6,7,8,9',
    '--configs',allBackends?'standard,optimized,compiled,memory64,fomkyr,fomkyr-firefox':'fomkyr,fomkyr-firefox','--timeout-seconds','120','--skip-censored']);
  if(allBackends)run(process.execPath,['tools/benchmark-native-resources.mjs','--out',directory,'--timeout-seconds','120','--skip-censored']);
}
for(const [name,batch] of [['workers-controlled','32'],['workers-defaults',null]]){
  run(process.execPath,['tools/benchmark-backend-resources.mjs','--out',path.join(out,name),'--degrees','9',
    '--configs','fomkyr,fomkyr-firefox','--workers','1,2,4,6,8,auto','--timeout-seconds','120',...(batch?['--batch-pairs',batch]:[])]);
}
// All certification and plotting happens after the final measured job.
for(const [name] of scenarios){
  run(process.execPath,['tools/audit-backend-resources.mjs',path.join(out,name,'report.json')]);
  run('python3',['tools/plot-backend-resources.py',path.join(out,name,'report.json')]);
}
run(process.execPath,['tools/summarize-fomkyr-workers.mjs',path.join(out,'workers-summary'),path.join(out,'workers-controlled'),path.join(out,'workers-defaults')]);
