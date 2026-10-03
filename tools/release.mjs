// Local release checks. Publishing remains a separate action on prepared refs.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {spawn, execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {VERSION} from '../web/engine/fomkyr/storage.js';
import {fileHash, digest, stableJSON, inventory, validationSnapshot, writeJSON} from './release-support.mjs';
import {singularIdentity} from './oracle-cache.mjs';

if(process.argv.includes('--help')){
  console.log(`Usage: node tools/release.mjs [options]
  --full                 Include the inherited upstream suites.
  --refresh-oracles      Recompute independent references.
  --out <directory>      Use an explicit resumable release directory.
  --previous-root <dir>  Check upgrades from this saved engine.
  --singular-report <file> Reuse recorded FK6 Singular prefixes.
  --package              Package the last completed checked snapshot.
  --prepare              Prepare committed, checked publication refs.
Checks resume automatically. Packaging and preparation do not run the suites.`);
  process.exit(0);
}
const switches=new Set(['--full','--refresh-oracles','--package','--prepare']);
const valued=new Set(['--out','--previous-root','--singular-report']);
for(let i=2;i<process.argv.length;i++){
  const option=process.argv[i];
  assert.ok(switches.has(option)||valued.has(option),'Unknown release option: '+option);
  if(valued.has(option)){assert.ok(process.argv[i+1]&&!process.argv[i+1].startsWith('--'),'Missing value for '+option);i++;}
}

const repository=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
process.chdir(repository);
const arg=(name,fallback)=>{const at=process.argv.indexOf(name);if(at<0)return fallback;
  assert.ok(process.argv[at+1]&&!process.argv[at+1].startsWith('--'),'Missing value for '+name);return process.argv[at+1];};
const full=process.argv.includes('--full'),refresh=process.argv.includes('--refresh-oracles');
const preparation=process.argv.includes('--prepare'),packaging=process.argv.includes('--package');
assert.ok(!preparation||!packaging,'Choose packaging or preparation.');
const appVersion=JSON.parse(fs.readFileSync('package.json')).version;
const sourceHashes=validationSnapshot();
const latestFile='local/releases/latest.json';
const latest=(preparation||packaging)&&fs.existsSync(latestFile)?JSON.parse(fs.readFileSync(latestFile)):null;
const requestedOut=arg('--out',null)??latest?.directory;
const saved=(preparation||packaging)&&requestedOut&&fs.existsSync(path.join(requestedOut,'report.json'))
  ?JSON.parse(fs.readFileSync(path.join(requestedOut,'report.json'))):null;
if(preparation||packaging)assert.ok(saved,'Run release:check first, or provide --out with a completed release directory.');
const compareVersions=(a,b)=>{const aa=a.split('.').map(Number),bb=b.split('.').map(Number);
  for(let i=0;i<3;i++)if(aa[i]!==bb[i])return aa[i]-bb[i];return 0;};
const automaticPrevious=fs.existsSync('local/baselines')?fs.readdirSync('local/baselines')
  .filter(name=>/^fomkyr-\d+\.\d+\.\d+$/.test(name)&&compareVersions(name.slice(7),VERSION)<0)
  .sort((a,b)=>compareVersions(b.slice(7),a.slice(7)))
  .map(name=>'local/baselines/'+name+'/engine').find(root=>fs.existsSync(path.join(root,'build.json'))):null;
const previousRoot=arg('--previous-root',automaticPrevious);
const protocol=saved?.protocol??{schema:1,appVersion,coreVersion:VERSION,full,refreshOracles:refresh,node:process.version,lhsCases:64,
  singularBuild:digest(stableJSON(singularIdentity(path.resolve('build/oracles/root')))),
  previousEngine:previousRoot?{directory:path.resolve(previousRoot),files:inventory([previousRoot])}:null};
const fingerprint=digest(stableJSON({sourceHashes,protocol}));
const out=path.resolve(requestedOut??`local/releases/${appVersion}-${fingerprint.slice(0,16)}`);
const reportFile=path.join(out,'report.json');
const previous=fs.existsSync(reportFile)?JSON.parse(fs.readFileSync(reportFile)):null;
if(previous)assert.equal(previous.fingerprint,fingerprint,'Release sources or protocol changed; choose a new output directory.');
const report=previous??{state:'running',startedAt:new Date().toISOString(),fingerprint,protocol,sourceHashes,phases:[]};
const save=()=>writeJSON(reportFile,report);
const frozen=()=>assert.deepEqual(validationSnapshot(),sourceHashes,'Release sources changed during checks. Run release:check again for the new snapshot.');
const git=args=>execFileSync('git',args,{encoding:'utf8',maxBuffer:16*1024*1024}).trim();

// The coordinator and the standalone UI runner are not algebra inputs. All
// other sources remain in this deliberately conservative dependency contract.
// Retain the original report and its hashes when borrowing a completed phase.
const initialRunnerHash='5b8c1faf9d665b003e2323c8137e2ea41b4c2086f9411d8a74944783360e6d2b';
function phaseInputs(hashes,name){
  return Object.fromEntries(Object.entries(hashes).filter(([file])=>
    file!=='tools/release.mjs' && (name==='browser'||file!=='tools/validate-correction-release.mjs')));
}
function phaseContract(name,command,args,env){
  return digest(stableJSON({schema:1,name,inputs:phaseInputs(sourceHashes,name),protocol,
    command,args:args.map(value=>String(value).replaceAll(out,'<release-directory>')),env}));
}
function borrowPhase(name,contract,evidence,validate){
  if(!evidence||!fs.existsSync('local/releases')||fs.existsSync(path.dirname(evidence)))return null;
  for(const entry of fs.readdirSync('local/releases',{withFileTypes:true}).filter(row=>row.isDirectory()).reverse()){
    const directory=path.resolve('local/releases',entry.name),file=path.join(directory,'report.json');
    if(directory===out||!fs.existsSync(file))continue;
    const previous=JSON.parse(fs.readFileSync(file));
    if(stableJSON(previous.protocol)!==stableJSON(protocol))continue;
    const row=previous.phases?.find(row=>row.name===name&&row.state==='passed');
    if(!row)continue;
    if(row.contract!==contract){
      if(row.contract||previous.sourceHashes?.['tools/release.mjs']!==initialRunnerHash
        ||stableJSON(phaseInputs(previous.sourceHashes,name))!==stableJSON(phaseInputs(sourceHashes,name)))continue;
    }
    const priorEvidence=path.join(directory,path.relative(out,evidence));
    assert.equal(fileHash(priorEvidence),row.evidenceSha256,'Cached phase evidence changed: '+priorEvidence);
    const data=JSON.parse(fs.readFileSync(priorEvidence));assert.equal(data.state,'complete');validate?.(data);
    fs.symlinkSync(path.relative(path.dirname(path.dirname(evidence)),path.dirname(priorEvidence)),path.dirname(evidence),'dir');
    return {name,state:'passed',contract,evidenceSha256:row.evidenceSha256,elapsedSeconds:0,
      reusedElapsedSeconds:row.reusedElapsedSeconds??row.elapsedSeconds,
      reusedFrom:{directory,fingerprint:previous.fingerprint,reportSha256:fileHash(file)}};
  }
  return null;
}

function preflight(){
  const lock=JSON.parse(fs.readFileSync('package-lock.json'));
  assert.equal(lock.version,appVersion);assert.equal(lock.packages[''].version,appVersion);
  const index=fs.readFileSync('web/index.html','utf8');
  assert.ok(index.includes('<title>George '+appVersion+'</title>'),'Update the page title before checking the release.');
  assert.match(index,new RegExp('class="brand-version">'+appVersion.replaceAll('.','\\.')+'<'));
  const manifest=JSON.parse(fs.readFileSync('web/engine/fomkyr/build.json'));
  assert.equal(manifest.version,VERSION);assert.equal(manifest.appVersion,appVersion);
  for(const [name,record] of Object.entries(manifest.files))
    assert.equal(fileHash('web/engine/fomkyr/'+name),record.sha256,'Stale Fomkyr manifest: '+name+'; regenerate with tools/fomkyr-manifest.mjs.');
  const inventory=JSON.parse(fs.readFileSync('fomkyr/SOURCE.json'));
  assert.equal(inventory.version, VERSION, 'Fomkyr source/runtime version mismatch');
  assert.equal(JSON.parse(fs.readFileSync('fomkyr/package.json')).version, VERSION, 'Fomkyr package/runtime version mismatch');
  assert.equal(manifest.provenance.archiveSha256,inventory.archiveSha256);
  for(const [name,record] of Object.entries(inventory.retainedBuildAndTestFiles))
    assert.equal(fileHash('fomkyr/'+name),record.sha256,'Core source changed: '+name);
  for(const [name,record] of Object.entries(inventory.compatibilityFixtures ?? {}))
    assert.equal(fileHash('fomkyr/'+name),record.sha256,'Compatibility fixture changed: '+name);
}

async function phase(name,command,args,{evidence,validate,timeoutSeconds=900,env={},reuse=true}={}){
  frozen();
  const contract=phaseContract(name,command,args,env);
  const passed=report.phases.find(row=>row.name===name&&row.state==='passed');
  if(passed&&reuse){
    if(evidence){assert.equal(fileHash(evidence),passed.evidenceSha256,'Release evidence changed: '+evidence);validate?.(JSON.parse(fs.readFileSync(evidence)));}
    console.log(name+' reused ('+passed.elapsedSeconds.toFixed(1)+' s recorded)');return;
  }
  if(reuse){
    const borrowed=borrowPhase(name,contract,evidence,validate);
    if(borrowed){report.phases.push(borrowed);save();console.log(name+' reused: checked inputs unchanged ('+borrowed.reusedElapsedSeconds.toFixed(1)+' s recorded)');return;}
  }
  const row={name,contract,attempt:report.phases.filter(row=>row.name===name).length+1,startedAt:new Date().toISOString(),state:'running'};
  report.phases.push(row);save();
  const directory=path.join(out,'logs');fs.mkdirSync(directory,{recursive:true});
  const log=path.join(directory,name+'-'+row.attempt+'.log'),fd=fs.openSync(log,'w');
  const start=performance.now();console.log(name+' started; log '+path.relative(repository,log));
  try{
    await new Promise((resolve,reject)=>{
      const child=spawn(command,args,{cwd:repository,env:{...process.env,FOMKYR_LHS_COUNT:'64',...env},stdio:['ignore',fd,fd],detached:true});
      const stop=()=>{try{process.kill(-child.pid,'SIGKILL');}catch{}};
      const timer=setTimeout(()=>{stop();reject(new Error(name+' exceeded '+timeoutSeconds+' seconds; see '+log));},timeoutSeconds*1000);
      const heartbeat=setInterval(()=>console.log(name+': '+((performance.now()-start)/1000).toFixed(0)+' s'),30000);
      const interrupted=()=>{stop();reject(new Error('Release interrupted during '+name));};
      process.once('SIGINT',interrupted);process.once('SIGTERM',interrupted);
      const cleanup=()=>{clearTimeout(timer);clearInterval(heartbeat);process.removeListener('SIGINT',interrupted);process.removeListener('SIGTERM',interrupted);};
      child.once('error',error=>{cleanup();reject(error);});
      child.once('exit',(code,signal)=>{cleanup();code===0?resolve():reject(new Error(name+' exited '+(signal||code)+'; see '+log));});
    });
    frozen();
    if(evidence){const data=JSON.parse(fs.readFileSync(evidence));assert.equal(data.state,'complete',name+' did not finish');validate?.(data);row.evidenceSha256=fileHash(evidence);}
    row.state='passed';
  }catch(error){row.state='failed';row.error=String(error.stack||error);throw error;}
  finally{fs.closeSync(fd);row.finishedAt=new Date().toISOString();row.elapsedSeconds=(performance.now()-start)/1000;save();
    console.log(name+' '+row.state+' ('+row.elapsedSeconds.toFixed(1)+' s)');}
}

function retainedPrefixes(){
  const explicit=arg('--singular-report',null);if(explicit)return path.resolve(explicit);
  const candidates=[];
  const visit=(directory,depth)=>{
    if(!fs.existsSync(directory))return;
    for(const entry of fs.readdirSync(directory,{withFileTypes:true})){
      const file=path.join(directory,entry.name);
      if(entry.isDirectory()&&depth>0&&!['storage','upstream','source'].includes(entry.name))visit(file,depth-1);
      else if(entry.name==='report.json'&&file!==path.join(out,'fk6-prefixes/report.json')){
        try{const data=JSON.parse(fs.readFileSync(file));
          if(data.state==='complete'&&data.inputSha256===fileHash('test/fixtures/fomin-kirillov-user.json')&&data.cases?.length===9
            &&data.cases.every(row=>row.singular&&(row.singular.passed?fs.existsSync(path.join(directory,'degree-'+row.degree,'singular.log')):row.singular.status==='timeout'||row.singular.status==='skipped')))
            candidates.push(file);
        }catch{}
      }
    }
  };
  visit('local/validation',1);visit('local/releases',2);visit('build/validation',1);
  return candidates.sort((a,b)=>fs.statSync(b).mtimeMs-fs.statSync(a).mtimeMs)[0]??null;
}

preflight();
if(preparation){
  assert.equal(report.state,'complete','Run release:check before preparation.');
  assert.ok(report.phases.some(row=>row.name==='sources'&&row.state==='passed'),'Run release:package before preparation.');
  assert.equal(fileHash('web/sources/george-source.tar.gz'),report.sourceArchiveSha256,'Source archive changed since packaging.');
  assert.equal(git(['status','--porcelain','--untracked-files=normal']),'','Commit the checked files and source archive before preparing publication.');
  await phase('prepare',process.execPath,['tools/prepare-publication.mjs','--update','--fast-forward'],{timeoutSeconds:120,reuse:false});
  console.log('Prepared. Publish with: bash build/publication/publish.sh [ssh-key]');
}else if(packaging){
  assert.equal(report.state,'complete','Run release:check before packaging.');
  const tracked=new Set(git(['ls-files']).split('\n'));
  assert.ok(Object.keys(sourceHashes).every(file=>tracked.has(file)), 'Stage new source files before packaging so they enter the source archive.');
  await phase('sources','bash',['tools/package-sources.sh'],{timeoutSeconds:120,reuse:false});
  report.sourceArchiveSha256=fileHash('web/sources/george-source.tar.gz');save();
  console.log('Packaged. Commit the checked files, then run release:prepare.');
}else{
  report.state='running';save();
  try{
    await phase('units',process.execPath,['--test','--experimental-test-isolation=none',...fs.readdirSync('test').filter(n=>n.endsWith('.test.mjs')).sort().map(n=>'test/'+n)],{timeoutSeconds:120});
    const matrix=path.join(out,'matrix'),exact=path.join(out,'exact');
    const refreshArgs=refresh?['--refresh-oracles']:[];
    const matrixArgs=['tools/validate-fomkyr.mjs',matrix,'--resume',...refreshArgs,...(full?[]:['--matrix-only'])];
    // The full runner contains the exact suites; the exact runner reuses those
    // production-host results and adds only its remaining property checks.
    if(full)await phase('matrix',process.execPath,matrixArgs,{evidence:path.join(matrix,'report.json'),timeoutSeconds:3600,validate:r=>assert.equal(r.cases.length,95)});
    await phase('exact',process.execPath,['tools/validate-fomkyr-exact.mjs',exact,'--resume',...(full?['--upstream-report',path.join(matrix,'report.json')]:[])],{
      evidence:path.join(exact,'report.json'),timeoutSeconds:900,env:{GEORGE_REFRESH_ORACLES:refresh?'1':'0'},validate:r=>assert.ok(r.tests.length>=10&&r.tests.every(test=>test.passed))});
    if(!full)await phase('matrix',process.execPath,matrixArgs,{evidence:path.join(matrix,'report.json'),validate:r=>assert.equal(r.cases.length,95)});
    const published=path.join(out,'published');
    await phase('published',process.execPath,['tools/validate-fomkyr-published.mjs',published,'--resume',...refreshArgs],{
      evidence:path.join(published,'report.json'),validate:r=>assert.equal(r.cases.length,5)});
    const prefixes=path.join(out,'fk6-prefixes'),retained=refresh?null:retainedPrefixes();
    await phase('fk6-prefixes',process.execPath,['tools/validate-fk6-degrees.mjs',prefixes,'--resume',...(retained?['--singular-report',retained]:[])],{
      evidence:path.join(prefixes,'report.json'),validate:r=>assert.equal(r.cases.length,9)});
    const browser=path.join(out,'browser');
    await phase('browser',process.execPath,['tools/validate-correction-release.mjs',browser,'--defaults-case','--coefficient-case'],{
      evidence:path.join(browser,'report.json'),timeoutSeconds:600,validate:r=>assert.equal(r.checks.length,2)});
    for(const name of ['chromium','firefox']){
      const directory=path.join(out,'static-'+name);
      await phase('static-'+name,process.execPath,['tools/validate-static-isolation.mjs',directory,...(name==='firefox'?['--firefox']:[])],{
        evidence:path.join(directory,'report.json'),timeoutSeconds:300,validate:r=>assert.equal(r.checks.length,4)});
    }
    if(protocol.previousEngine){
      const previousRoot=protocol.previousEngine.directory;
      const previousFiles=Object.fromEntries(Object.entries(protocol.previousEngine.files)
        .map(([file,hash])=>[path.resolve(file),hash]));
      assert.deepEqual(inventory([previousRoot]),previousFiles,'Previous engine changed during release checks.');
      const previousVersion=JSON.parse(fs.readFileSync(path.join(previousRoot,'build.json'))).version;
      const directory=path.join(out,'upgrade');
      await phase('upgrade',process.execPath,['tools/validate-fomkyr-upgrade.mjs',directory,'--previous='+previousVersion,'--previous-root='+path.resolve(previousRoot)],{
        evidence:path.join(directory,'report.json'),timeoutSeconds:300,validate:r=>assert.equal(r.checks.length,4)});
    }
    report.state='complete';report.finishedAt=new Date().toISOString();save();
    writeJSON(latestFile,{directory:out,fingerprint});
    console.log('Release checks complete: '+path.relative(repository,reportFile));
  }catch(error){report.state='failed';report.error=String(error.stack||error);save();throw error;}
}
