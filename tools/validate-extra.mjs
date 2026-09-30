import fs from 'node:fs';import path from 'node:path';import assert from 'node:assert/strict';import {spawnSync} from 'node:child_process';
import {wasmRuntime} from '../test/support/regression.mjs';
const out=path.resolve(`build/validation/extra-${Date.now()}`);fs.mkdirSync(out,{recursive:true});
const root=path.resolve('vendor/bergman-1.001/tests/test_bergman');
const candidates=fs.readdirSync('build').filter(n=>/^sbcl-/.test(n)&&fs.existsSync(`build/${n}/bin/clisp/unix/bergman`)).sort((a,b)=>fs.statSync(`build/${b}`).mtimeMs-fs.statSync(`build/${a}`).mtimeMs);
assert.ok(process.env.BERGMAN_SBCL||candidates.length,'Build the native reference with npm run sbcl:build.');
const sbcl=path.resolve(process.env.BERGMAN_SBCL||`build/${candidates[0]}/bin/clisp/unix/bergman`);
const cases=[
 {id:'anick_5',script:'(NONCOMMIFY)\n(SETQ ANICKRESOLUTIONOUTPUTFILE "$OUT/res.out")\n(ANICK "$IN/anick_5" "$OUT/res.gb")\n(CALCULATEANICKRESOLUTIONTOLIMIT (GETMAXDEG))\n(ANICKDISPLAY)',outputs:['res.gb','res.out']},
 {id:'anick_w',script:'(NONCOMMIFY)\n(SETQ ANICKRESOLUTIONOUTPUTFILE "$OUT/res.out")\n(ANICK "$IN/anick_w" "$OUT/res.gb")\n(CALCULATEANICKRESOLUTIONTOLIMIT (GETMAXDEG))\n(ANICKDISPLAY)',outputs:['res.gb','res.out']},
 {id:'simp_w_max',script:'(SIMPLE "$IN/simp_w_max" "$OUT/res.gb")',outputs:['res.gb']},
 {id:'homog_c',script:'(DSKIN "$IN/homog_c")\n(PROG (old) (SETQ old (WRS (OPEN "$OUT/res.gb" \'OUTPUT))) (BIGOUTPUT) (CLOSE (WRS old)))',outputs:['res.gb']},
 {id:'tst',script:'(SIMPLE "$IN/tst" "$OUT/res.gb")',outputs:['res.gb']},
 {id:'homog-mode-smoke',script:'(DSKIN "$IN/homog")',outputs:[]},
];
for(const name of ['anick5~','anick_tm~','anick_w~'])cases.push({id:name,script:`(NONCOMMIFY)\n(SETQ ANICKRESOLUTIONOUTPUTFILE "$OUT/res.out")\n(ANICK "$IN/${name}" "$OUT/res.gb")\n(CALCULATEANICKRESOLUTIONTOLIMIT (GETMAXDEG))\n(ANICKDISPLAY)`,outputs:['res.gb','res.out']});
for(const name of ['lin_nc~','lin~','nhom~','simp_w_max~'])cases.push({id:name,expectedError:name==='lin_nc~',script:`(NONCOMMIFY)\n(SETSAFELOWTERMSHANDLING)\n(SIMPLE "$IN/${name}" "$OUT/res.gb")`,outputs:['res.gb']});
for(const name of ['skipcdeg','skipcdegall']) for(const [i,source] of fs.readFileSync(path.join(root,name),'utf8').split(/^-{5,}.*$/m).entries()) {
 if(source.trim())cases.push({id:`${name}-${i+1}`,source,script:'(SIMPLE "$OUT/input.bg" "$OUT/res.gb")',outputs:['res.gb']});
}
const report=[];
try{for(const c of cases){
 const dir=path.join(out,c.id);fs.mkdirSync(dir);
 if(c.source)fs.writeFileSync(path.join(dir,'input.bg'),c.source);
 const source='(SETLEGACYMODE T)\n'+c.script.replaceAll('$IN',root).replaceAll('$OUT',dir)+'\n(CLEARRING)\n(QUIT)\n';
 const native=spawnSync(sbcl,[],{input:source,encoding:'utf8',timeout:60000,killSignal:'SIGKILL',maxBuffer:8e6});
 fs.writeFileSync(path.join(dir,'native.log'),native.stdout+native.stderr);assert.ifError(native.error);
 if(c.expectedError){assert.notEqual(native.status,0);assert.match(native.stdout+native.stderr,/EMSG/);}else assert.equal(native.status,0);
 const files={'/output/.keep':''};for(const n of fs.readdirSync(root))if(fs.statSync(path.join(root,n)).isFile())files['/inputs/'+n]=fs.readFileSync(path.join(root,n),'utf8');
 if(c.source)files['/output/input.bg']=c.source;
 const job={files,script:'(SETLEGACYMODE T)\n'+c.script.replaceAll('$IN','/inputs').replaceAll('$OUT','/output')+'\n(CLEARRING)\n',outputs:Object.fromEntries(c.outputs.map(n=>[n,'/output/'+n]))};
 const rt=await wasmRuntime();
 if(c.expectedError){assert.throws(()=>rt.run(job),e=>{fs.writeFileSync(path.join(dir,'wasm.log'),e.message);return /EMSG|Algin Reader/.test(e.message);});report.push({id:c.id,expectedRejection:'undeclared uppercase X; both engines reject, native EMSG and Wasm reader diagnostics differ'});console.log(c.id,'EXPECTED REJECTION');continue;}
 const r=rt.run(job);fs.writeFileSync(path.join(dir,'wasm.log'),r.stdout);
 for(const n of c.outputs)assert.equal(r.files['/output/'+n],fs.readFileSync(path.join(dir,n),'utf8'),c.id+' '+n);
 report.push({id:c.id,outputs:c.outputs.length,elapsedMs:r.elapsedMs});console.log(c.id,'PASS');
}fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2));}catch(e){console.error(e);process.exitCode=1;}
