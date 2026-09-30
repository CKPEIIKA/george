// Run the pinned upstream executables and export machine-readable oracles.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
const root=path.resolve(process.env.OCAML_ALG_SOURCE||'build/oracles/ocaml-alg');
const out=path.resolve('build/validation/ocaml');fs.mkdirSync(out,{recursive:true});
function run(bin,args,env=process.env){const r=spawnSync(bin,args,{env,encoding:'utf8',timeout:60000,killSignal:'SIGKILL',maxBuffer:32e6});assert.ifError(r.error);assert.equal(r.status,0,r.stderr);return r.stdout;}
const report={revision:'365708af85d2faa50250414247179b3bc2bd13df',cases:{}};
assert.equal(run('git',['-C',root,'rev-parse','HEAD']).trim(),report.revision);
for(const name of ['anick0','anick1','anick2','anick3']){
 const text=run(`${root}/_build/default/test/${name}.exe`,[]);fs.writeFileSync(`${out}/${name}.txt`,text);
 report.cases[name]={betti:[...text.matchAll(/^H\d+ = (\d+)/gm)].map(m=>Number(m[1]))};
 if(name==='anick1')report.cases[name].chains=text.trim().split('\n').map(line=>[...line.matchAll(/\[([^\]]+)\]/g)].map(m=>m[1].replaceAll('|','')));
}
// The active mirai example prints the resolution and contraction, but no
// Betti numbers. Reuse its exact presentation and augmentation, adding only
// a call to upstream's own Betti routine in a separate generated executable.
const src=fs.readFileSync(`${root}/test/mirai.ml`,'utf8').split('  let d,s =')[0]+
 '  let h = P.Anick.betti ~augmentation pres 3 in\n  Array.iteri (fun i n -> Printf.printf "H%d = %d\\n" i n) h\n';
fs.writeFileSync(`${out}/george_mirai.ml`,src);
const local=path.resolve('build/oracles/root/usr'),env={...process.env};
if(fs.existsSync(`${local}/bin/ocamlopt`)){env.PATH=`${path.resolve('build/oracles/bin')}:${local}/bin:${env.PATH}`;env.OCAMLLIB=`${local}/lib/x86_64-linux-gnu/ocaml/5.3.0`;}
run('ocamlopt',['-I',`${root}/_build/default/src/.alg.objs/byte`,'-I',`${root}/_build/default/src/.alg.objs/native`,`${root}/_build/default/src/alg.cmxa`,`${out}/george_mirai.ml`,'-o',`${out}/george_mirai`],env);
const text=run(`${out}/george_mirai`,[]);fs.writeFileSync(`${out}/mirai.txt`,text);
report.cases.mirai={betti:[...text.matchAll(/^H\d+ = (\d+)/gm)].map(m=>Number(m[1]))};
fs.writeFileSync(`${out}/references.json`,JSON.stringify(report,null,2));console.log(report);
