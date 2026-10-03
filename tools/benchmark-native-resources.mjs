// Add native SBCL/Bergman and Singular/Letterplace to a browser resource report.
// Run after the browser phase so computations remain serial.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {spawn} from 'node:child_process';
import {Sampler} from './linux-resource-sampler.mjs';
import {EnvironmentMonitor} from './benchmark-environment.mjs';
import {buildJob, readInputFile, parseBasis, parseRelation, toBergman} from '../web/src/bergman-syntax.js';

const arg=(name,fallback)=>{const at=process.argv.indexOf(name);return at<0?fallback:process.argv[at+1];};
const out=path.resolve(arg('--out','build/validation/backend-resources-degree8'));
const cap=Number(arg('--timeout-seconds','120'));
const sampleMs=Number(arg('--sample-ms','20'));
let interrupted=false,activeChild;
const interrupt=()=>{interrupted=true;if(activeChild)try{process.kill(-activeChild.pid,'SIGKILL');}catch{}};
process.once('SIGINT',interrupt);process.once('SIGTERM',interrupt);
if(!Number.isFinite(cap)||cap<0)throw new Error('Choose a nonnegative time limit.');
if(cap===0&&!process.argv.includes('--allow-no-timeout'))throw new Error('Unlimited measurement requires --allow-no-timeout.');
if(!Number.isInteger(sampleMs)||sampleMs<0||sampleMs>10000)throw new Error('Choose sampling interval 0..10000 ms.');
const reportFile=path.join(out,'report.json');
const report=JSON.parse(fs.readFileSync(reportFile));
if(report.state!=='complete')throw new Error('Finish the serial browser phase first.');
const memoryMiB=Number(report.memoryMiB);
if(!Number.isInteger(memoryMiB)||memoryMiB<16)throw new Error('Native comparison requires a finite memory allowance of at least 16 MiB.');
const save=()=>fs.writeFileSync(reportFile,JSON.stringify(report,null,2)+'\n');
const {vars,rels}=readInputFile('(ALGFORMINPUT)\n'+JSON.parse(fs.readFileSync(report.inputFile)).inputText);
const sha=file=>crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
if(sha(report.inputFile)!==report.inputSha256)throw new Error('Input changed after browser measurements.');
const sbclRoot=arg('--sbcl-root','build/sbcl-oracle-fixed-v4-04-20261001');
const singularRoot=path.resolve(arg('--singular-root','build/oracles/root'));
const sbcl=path.resolve(sbclRoot+'/bin/clisp/unix/bergman');
const singular=path.join(singularRoot,'usr/bin/Singular');
const allDefinitions=[{id:'sbcl',backend:'sbcl',browser:'native',label:'Bergman / SBCL (native)'},
  {id:'singular',backend:'singular',browser:'native',label:'Singular / Letterplace (native)'}];
const definitions=arg('--configs','sbcl,singular').split(',').map(id=>{const config=allDefinitions.find(c=>c.id===id);if(!config)throw new Error('Unknown native configuration: '+id);return config;});
report.configurations=[...report.configurations.filter(c=>!definitions.some(d=>d.id===c.id)),...definitions];
report.nativeProvenance={sbclLauncher:sbclRoot+'/bin/clisp/unix/bergman',
  sbclImageSha256:sha(sbclRoot+'/bin/clisp/unix/bergman.exe'),
  benchmarkSourceSha256:sha('tools/benchmark-native-resources.mjs'),
  samplerSourceSha256:sha('tools/linux-resource-sampler.mjs'),
  environmentSourceSha256:sha('tools/benchmark-environment.mjs'),
  singularExecutable:path.relative(process.cwd(),singular),singularSha256:sha(singular),
  singularProcDir:path.relative(process.cwd(),path.join(singularRoot,'usr/lib/x86_64-linux-gnu/singular/MOD')),
  singularArithmeticModules:Object.fromEntries(['p_Procs_FieldQ.so','p_Procs_FieldZp.so'].map(name=>[name,sha(path.join(singularRoot,'usr/lib/x86_64-linux-gnu/singular/MOD',name))])),
  order:'Degree left lex; Singular Dp with reversed generator order matches Bergman/Native.',
  orderReference:'https://github.com/Singular/Singular/blob/spielwiese/doc/letterplace.doc',
  ram:`Native process-tree PSS sampled every ${sampleMs/1000} s. Includes runtime startup. No browser baseline.`,
  cpu:'GNU time reports exact aggregate child user+system CPU seconds; /proc sampling retained as a cross-check.',
  budget:`SBCL dynamic space is ${memoryMiB} MiB. Singular runs with a ${memoryMiB} MiB virtual-address limit. Browser memory budgets and these native limits cover different allocations.`,
  singularOptions:['redSB','intStrategy'],degreeBound:'freeAlgebra(r, degree) at each requested degree'};
report.nativeProvenance.degreeOne='Singular requires ring degree >=2; its degree-1 point uses the zero ideal in a bound-2 ring. SBCL uses the zero relation for the empty linear prefix.';
report.state='running-native';save();

async function run(config,degree){
  const key=config.id+'-d'+degree+'-t0';
  const dir=path.join(out,key);fs.mkdirSync(dir,{recursive:true});
  let command,args,source,environment={...process.env};
  if(config.id==='sbcl'){
    // Use the 64-bit form validator for native SBCL's larger heap allowance;
    // the actual native heap is selected by --dynamic-space-size below.
    const job=buildJob({task:'gb',backend:'memory64',ring:'noncomm',order:'degleftlex',field:'0',vars,rels:degree===1?['0']:rels,
      maxdeg:String(degree),memoryMiB,nonhomog:'degreewise',strategy:'default',lowterms:'quick',monomialPruning:true});
    for(const [name,text]of Object.entries(job.files))fs.writeFileSync(path.join(dir,name),text);
    source=job.script+'\n(QUIT)\n';command=sbcl;args=['--dynamic-space-size',String(memoryMiB)];
  }else{
    const names=vars.map((_,i)=>'fk_var_'+i),mapping=Object.fromEntries(vars.map((v,i)=>[v,names[i]]));
    const convert=polynomial=>toBergman(parseRelation(polynomial,vars).map(t=>({...t,factors:t.factors.map(f=>({...f,v:mapping[f.v]}))})));
    source=['LIB "freegb.lib";',`ring fk_r=0,(${[...names].reverse().join(',')}),Dp;`,
      `def fk_a=freeAlgebra(fk_r,${Math.max(2,degree)});`,'setring fk_a;','option(redSB); option(intStrategy);',
      `ideal I=${degree<2?'0':rels.map(convert).join(',')};`,'ideal G=twostd(I);',
      'print("COUNT:"+string(size(G)));',
      'for(int j=1;j<=size(G);j++){if(G[j]!=0){print("LEAD:"+string(lead(G[j])));print("POLY:"+string(G[j]));}}',
      'print("GEORGE_DONE");','quit;',''].join('\n');
    command='/usr/bin/prlimit';args=['--as='+String(memoryMiB*1048576),'--',singular,'-q'];
    environment.LD_LIBRARY_PATH=`${singularRoot}/usr/lib/x86_64-linux-gnu:${singularRoot}/usr/lib/x86_64-linux-gnu/singular/MOD:${process.env.LD_LIBRARY_PATH||''}`;
    environment.SINGULARPATH=`${singularRoot}/usr/share/singular/LIB:${singularRoot}/usr/lib/x86_64-linux-gnu/singular/MOD`;
    environment.SINGULAR_PROCS_DIR=path.join(singularRoot,'usr/lib/x86_64-linux-gnu/singular/MOD');
  }
  fs.writeFileSync(path.join(dir,config.id==='sbcl'?'session.lsp':'session.sing'),source);
  const timing=path.join(dir,'time.txt'),logFile=path.join(dir,'stdout.txt');
  const fd=fs.openSync(logFile,'w');
  const start=performance.now();
  const child=spawn('/usr/bin/time',['-f','%U %S %e %M','-o',timing,'--','/usr/bin/timeout','--signal=KILL',
    String(cap),command,...args],{cwd:dir,env:environment,detached:true,stdio:['pipe',fd,fd]});
  activeChild=child;
  fs.closeSync(fd);
  const sampler=new Sampler(child.pid,{intervalMs:sampleMs});sampler.start();
  const environmentMonitor=new EnvironmentMonitor();environmentMonitor.start();
  child.stdin.on('error',()=>{});child.stdin.end(source);
  console.log(key,'started');
  const exit=await new Promise((resolve,reject)=>{child.on('error',reject);child.on('exit',(code,signal)=>resolve({code,signal}));});
  activeChild=null;
  const measured=sampler.stop(),hostEnvironment=environmentMonitor.stop();
  const wall=(performance.now()-start)/1000;
  const log=fs.readFileSync(logFile,'utf8');
  const timingText=fs.existsSync(timing)?fs.readFileSync(timing,'utf8').trim().split('\n').at(-1):'';
  const timingNumbers=timingText.split(/\s+/).map(Number);
  // KILLing timeout's process group can leave GNU time with only the wrapper's
  // zero CPU count. Preserve the sampled child CPU in that case.
  const cpuSum=timingNumbers[0]+timingNumbers[1];
  const exactCpu=timingNumbers.length===4&&timingNumbers.every(Number.isFinite)&&(exit.code===0||cpuSum>0)?cpuSum:null;
  const row={id:config.id,backend:config.backend,browser:'native',degree,trial:0,timeLimitSeconds:cap,
    singularRingDegreeBound:config.id==='singular'?Math.max(2,degree):undefined,emptyQuadraticPrefix:degree===1,
    status:interrupted?'interrupted':exit.code===0?'complete':cap>0&&wall>=cap-.5?'timeout':'error',coldWallSeconds:wall,...measured,
    memoryMiB,hostEnvironment,
    sampledCpuSeconds:measured.cpuSeconds,cpuSeconds:exactCpu??measured.cpuSeconds,
    cpuSource:exactCpu===null?'sampled process-tree CPU':'GNU time aggregate child CPU',
    averageCpuPercent:100*(exactCpu??measured.cpuSeconds)/wall,
    peakChildRssMiB:timingNumbers.length===4?timingNumbers[3]/1024:null,exitCode:exit.code,signal:exit.signal,
    stdoutFile:key+'/stdout.txt',samplesFile:key+'.samples.json'};
  if(row.status==='complete'){
    if(config.id==='sbcl'){
      const basis=fs.readFileSync(path.join(dir,'result.gb'),'utf8'),parsed=parseBasis(basis);
      row.basisSize=parsed.groups.reduce((n,g)=>n+g.polys.length,0);row.outputHasDone=parsed.done;
      row.basisFile=key+'/result.gb';if(!parsed.done)row.status='error';
    }else{
      row.basisSize=[...log.matchAll(/^LEAD:/gm)].length;
      row.outputHasDone=/^GEORGE_DONE$/m.test(log);
      if(!row.outputHasDone||/^\s*\?|Could not find dynamic library/m.test(log))row.status='error';
    }
  }
  if(row.status==='error'){
    if(/heap exhausted|dynamic space exhausted|out of memory|memory exhausted|cannot allocate memory|insufficient memory|failed to allocate|std::bad_alloc/i.test(log))row.status='oom';
    row.error=log.slice(-4000);
  }
  fs.writeFileSync(path.join(out,row.samplesFile),JSON.stringify(row.samples));delete row.samples;
  report.rows.push(row);save();
  console.log(key,row.status,row.coldWallSeconds.toFixed(2),'s wall,',row.cpuSeconds.toFixed(2),'core-s,',row.peakPssMiB.toFixed(1),'MiB PSS,',row.basisSize,'rules');
}
try{
  measurements: for(const degree of report.degrees)for(const config of definitions){
    if(interrupted)break measurements;
    if(report.finiteCertificate&&degree>report.finiteCertificate.firstZeroDegree)continue;
    if(report.rows.some(r=>r.id===config.id&&r.degree===degree))continue;
    if(process.argv.includes('--skip-censored')&&report.rows.some(r=>r.id===config.id&&r.degree<degree&&['timeout','oom'].includes(r.status))){
      report.skipped??=[];report.skipped.push({id:config.id,degree,trial:0,reason:'A lower degree reached the time or memory limit.'});save();continue;
    }
    await run(config,degree);
  }
  report.state=interrupted?'stopped-by-user':'complete';report.finishedAt=new Date().toISOString();save();
}catch(error){report.state='failed-native';report.errors.push({error:error.stack});save();throw error;}
console.log(out,report.state);
if(interrupted)process.exitCode=130;
