// Add native SBCL/Bergman and Singular/Letterplace to a browser resource report.
// Run after the browser phase so computations remain serial.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {spawn} from 'node:child_process';
import {Sampler} from './linux-resource-sampler.mjs';
import {buildJob, readInputFile, parseBasis, parseRelation, toBergman} from '../web/src/bergman-syntax.js';

const arg=(name,fallback)=>{const at=process.argv.indexOf(name);return at<0?fallback:process.argv[at+1];};
const out=path.resolve(arg('--out','build/validation/backend-resources-degree8'));
const cap=Number(arg('--timeout-seconds','120'));
const reportFile=path.join(out,'report.json');
const report=JSON.parse(fs.readFileSync(reportFile));
if(report.state!=='complete')throw new Error('Finish the serial browser phase first.');
const save=()=>fs.writeFileSync(reportFile,JSON.stringify(report,null,2)+'\n');
const {vars,rels}=readInputFile('(ALGFORMINPUT)\n'+JSON.parse(fs.readFileSync(report.inputFile)).inputText);
const sha=file=>crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const sbclRoot='build/sbcl-oracle-fixed-v4-04-20261001';
const singularRoot=path.resolve('build/oracles/root');
const sbcl=path.resolve(sbclRoot+'/bin/clisp/unix/bergman');
const singular=path.join(singularRoot,'usr/bin/Singular');
const definitions=[{id:'sbcl',backend:'sbcl',browser:'native',label:'Bergman / SBCL (native)'},
  {id:'singular',backend:'singular',browser:'native',label:'Singular / Letterplace (native)'}];
report.configurations=[...report.configurations.filter(c=>!definitions.some(d=>d.id===c.id)),...definitions];
report.nativeProvenance={sbclLauncher:sbclRoot+'/bin/clisp/unix/bergman',
  sbclImageSha256:sha(sbclRoot+'/bin/clisp/unix/bergman.exe'),
  singularExecutable:'build/oracles/root/usr/bin/Singular',singularSha256:sha(singular),
  order:'Degree left lex; Singular Dp with reversed generator order matches Bergman/Native.',
  orderReference:'https://github.com/Singular/Singular/blob/spielwiese/doc/letterplace.doc',
  ram:'Native process-tree PSS sampled every 0.02 s. Includes runtime startup. No browser baseline.',
  cpu:'GNU time reports exact aggregate child user+system CPU seconds; /proc sampling retained as a cross-check.',
  budget:'SBCL dynamic space is 2048 MiB. Singular runs with a 2 GiB virtual-address limit. Browser memory budgets and these native limits cover different allocations.',
  singularOptions:['redSB','intStrategy'],degreeBound:'freeAlgebra(r, degree) at each requested degree'};
report.state='running-native';save();

async function run(config,degree){
  const key=config.id+'-d'+degree+'-t0';
  const dir=path.join(out,key);fs.mkdirSync(dir,{recursive:true});
  let command,args,source,environment={...process.env};
  if(config.id==='sbcl'){
    const job=buildJob({task:'gb',ring:'noncomm',order:'degleftlex',field:'0',vars,rels,
      maxdeg:String(degree),memoryMiB:2048,nonhomog:'degreewise',strategy:'default',lowterms:'quick',monomialPruning:true});
    for(const [name,text]of Object.entries(job.files))fs.writeFileSync(path.join(dir,name),text);
    source=job.script+'\n(QUIT)\n';command=sbcl;args=['--dynamic-space-size','2048'];
  }else{
    const names=vars.map((_,i)=>'fk_var_'+i),mapping=Object.fromEntries(vars.map((v,i)=>[v,names[i]]));
    const convert=polynomial=>toBergman(parseRelation(polynomial,vars).map(t=>({...t,factors:t.factors.map(f=>({...f,v:mapping[f.v]}))})));
    source=['LIB "freegb.lib";',`ring fk_r=0,(${[...names].reverse().join(',')}),Dp;`,
      `def fk_a=freeAlgebra(fk_r,${degree});`,'setring fk_a;','option(redSB); option(intStrategy);',
      `ideal I=${rels.map(convert).join(',')};`,'ideal G=twostd(I);',
      'print("COUNT:"+string(size(G)));',
      'for(int j=1;j<=size(G);j++){print("LEAD:"+string(lead(G[j])));}',
      'print("GEORGE_DONE");','quit;',''].join('\n');
    command='/usr/bin/prlimit';args=['--as=2147483648','--',singular,'-q'];
    environment.LD_LIBRARY_PATH=`${singularRoot}/usr/lib/x86_64-linux-gnu:${singularRoot}/usr/lib/x86_64-linux-gnu/singular/MOD:${process.env.LD_LIBRARY_PATH||''}`;
    environment.SINGULARPATH=`${singularRoot}/usr/share/singular/LIB:${singularRoot}/usr/lib/x86_64-linux-gnu/singular/MOD`;
  }
  fs.writeFileSync(path.join(dir,config.id==='sbcl'?'session.lsp':'session.sing'),source);
  const timing=path.join(dir,'time.txt'),logFile=path.join(dir,'stdout.txt');
  const fd=fs.openSync(logFile,'w');
  const start=performance.now();
  const child=spawn('/usr/bin/time',['-f','%U %S %e %M','-o',timing,'--','/usr/bin/timeout','--signal=KILL',
    String(cap),command,...args],{cwd:dir,env:environment,detached:true,stdio:['pipe',fd,fd]});
  fs.closeSync(fd);
  const sampler=new Sampler(child.pid);sampler.start();
  child.stdin.on('error',()=>{});child.stdin.end(source);
  console.log(key,'started');
  const exit=await new Promise((resolve,reject)=>{child.on('error',reject);child.on('exit',(code,signal)=>resolve({code,signal}));});
  const measured=sampler.stop();
  const wall=(performance.now()-start)/1000;
  const log=fs.readFileSync(logFile,'utf8');
  const timingText=fs.existsSync(timing)?fs.readFileSync(timing,'utf8').trim().split('\n').at(-1):'';
  const timingNumbers=timingText.split(/\s+/).map(Number);
  const exactCpu=timingNumbers.length===4&&timingNumbers.every(Number.isFinite)?timingNumbers[0]+timingNumbers[1]:null;
  const row={id:config.id,backend:config.backend,browser:'native',degree,trial:0,timeLimitSeconds:cap,
    status:exit.code===0?'complete':wall>=cap-.5?'timeout':'error',coldWallSeconds:wall,...measured,
    sampledCpuSeconds:measured.cpuSeconds,cpuSeconds:exactCpu??measured.cpuSeconds,
    averageCpuPercent:100*(exactCpu??measured.cpuSeconds)/wall,
    peakChildRssMiB:timingNumbers.length===4?timingNumbers[3]/1024:null,exitCode:exit.code,signal:exit.signal,
    stdoutFile:key+'/stdout.txt',samplesFile:key+'.samples.json'};
  if(row.status==='complete'){
    if(config.id==='sbcl'){
      const basis=fs.readFileSync(path.join(dir,'result.gb'),'utf8'),parsed=parseBasis(basis);
      row.basisSize=parsed.groups.reduce((n,g)=>n+g.polys.length,0);row.outputHasDone=parsed.done;
      row.basisFile=key+'/result.gb';if(!parsed.done)row.status='error';
    }else{
      row.basisSize=Number(log.match(/^COUNT:(\d+)$/m)?.[1]);
      row.outputHasDone=/^GEORGE_DONE$/m.test(log);
      if(!row.outputHasDone||/^\s*\?/m.test(log))row.status='error';
    }
  }
  if(row.status==='error')row.error=log.slice(-4000);
  fs.writeFileSync(path.join(out,row.samplesFile),JSON.stringify(row.samples));delete row.samples;
  report.rows.push(row);save();
  console.log(key,row.status,row.coldWallSeconds.toFixed(2),'s wall,',row.cpuSeconds.toFixed(2),'core-s,',row.peakPssMiB.toFixed(1),'MiB PSS,',row.basisSize,'rules');
}
try{
  for(const degree of report.degrees)for(const config of definitions){
    if(report.rows.some(r=>r.id===config.id&&r.degree===degree))continue;
    await run(config,degree);
  }
  report.state='complete';report.finishedAt=new Date().toISOString();save();
}catch(error){report.state='failed-native';report.errors.push({error:error.stack});save();throw error;}
console.log(out,report.state);
