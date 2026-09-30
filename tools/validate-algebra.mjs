import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { buildJob, FAMILIES, parseBasis, parseAnick, parseRelation, isHomogeneous } from '../web/src/bergman-syntax.js';
import { augmentedHomology } from '../web/src/homology.js';
import { algebra } from '../test/support/algebra.mjs';
import { wasmRuntime } from '../test/support/regression.mjs';
import { certifyResolution } from '../test/support/resolution.mjs';
const out=process.argv[2]||`build/validation/algebra-${Date.now()}`;
fs.mkdirSync(out,{recursive:true});
const oracleRoot=path.resolve('build/oracles/root');
const singular=process.env.SINGULAR_BIN||(fs.existsSync(`${oracleRoot}/usr/bin/Singular`)?`${oracleRoot}/usr/bin/Singular`:'Singular');
const env=fs.existsSync(`${oracleRoot}/usr/bin/Singular`)?{...process.env, LD_LIBRARY_PATH:`${oracleRoot}/usr/lib/x86_64-linux-gnu:${process.env.LD_LIBRARY_PATH||''}`,SINGULARPATH:`${oracleRoot}/usr/share/singular/LIB:${oracleRoot}/usr/lib/x86_64-linux-gnu/singular/MOD`}:process.env;
function oracle(c,gb){
  const code=[c.comm?'':'LIB "freealgebra.so";',`ring r=${c.p||0},(${(c.comm?c.vars:[...c.vars].reverse()).join(',')}),Dp;`,...(c.comm?[]:['def R=freeAlgebra(r,12);','setring R;']),`ideal I=${c.rels.join(',')};`,`ideal B=${gb.join(',')||'0'};`,`ideal G=${c.comm?'std':'twostd'}(I);`,'print("ORACLE:"+string(size(reduce(I,B)))+":"+string(size(reduce(B,G))));','quit;'].join('\n')+'\n';
  fs.writeFileSync(`${out}/${c.id}.sing`,code);
  const r=spawnSync(singular,['-q'],{input:code,encoding:'utf8',env,timeout:30000,killSignal:'SIGKILL',maxBuffer:8e6});
  fs.writeFileSync(`${out}/${c.id}.oracle.txt`,r.stdout||r.error?.message||'');
  assert.ifError(r.error);
  assert.equal(r.status,0,`${c.id}: Singular exited`);
  assert.doesNotMatch(r.stdout,/^\s*\?/m,`${c.id}: Singular error`);
  assert.match(r.stdout,/ORACLE:0:0/,`${c.id}: mutual ideal membership`);
  if(c.id==='quantum-plane'){
    const code='ring r=0,(x,y),dp;\ndef A=nc_algebra(2,0);\nsetring A;\nideal I=x^2,y^3;\nideal G=twostd(I);\nprint("PLURAL:"+string(vdim(G)));\nprint(reduce(y*x-2*x*y,G));\nquit;\n';
    fs.writeFileSync(`${out}/quantum-plane.plural.sing`,code);
    const p=spawnSync(singular,['-q'],{input:code,encoding:'utf8',env,timeout:30000,killSignal:'SIGKILL'});
    fs.writeFileSync(`${out}/quantum-plane.plural.txt`,p.stdout||'');assert.ifError(p.error);assert.equal(p.status,0);assert.doesNotMatch(p.stdout,/^\s*\?/m);assert.match(p.stdout,/PLURAL:6/);
  }
}
const cases=[];
for(const p of [0,2,5]){
  cases.push({id:`comm-${p}`,vars:['x','y'],rels:['x*y','x^2-y^2'],comm:true,p});
  cases.push({id:`nc-${p}`,vars:['x','y'],rels:['x*y','x^2-y^2'],p});
  cases.push({id:`exterior-${p}`,...FAMILIES.exterior.build(3),p,dims:[1,3,3,1,0,0,0]});
  cases.push({id:`symmetric-${p}`,...FAMILIES.symmetric.build(3),p,dims:[1,3,6,10,15,21,28]});
}
cases.push({id:'huge-integer',vars:['x','y'],rels:['12157665459056928801*x*y-7*y*x','x^2','y^2']});
cases.push({id:'truncated-cubic',vars:['x'],rels:['x^3'],dims:[1,1,1,0,0,0,0]});
cases.push({id:'quantum-plane',vars:['x','y'],rels:['y*x-2*x*y','x^2','y^3'],dims:[1,2,2,1,0,0,0]});
for(const family of ['plactic','pow','sklyanin','symgroup']) if(FAMILIES[family])cases.push({id:family,...FAMILIES[family].build(3)});
cases.push(
 {id:'singular-freegb-example',vars:['x','y','z'],rels:['-x*y-7*y*y+3*x*x','x*y*x-y*x*y']},
 {id:'original-nhom',vars:['x','y','z'],rels:['x*y-z','y*z-x','z*x-y']},
 {id:'ocaml-mirai',vars:['a','b','c','d','e','f','g'],rels:['a*a*b-a*c*c','c*c*d-f','c*c*e-g','c*g-f*e']},
 {id:'ocaml-ab-e',vars:['a','b','c','d','e'],rels:['a*b-e','b*c-d','a*d-e*c']},
 {id:'ocaml-idempotent',vars:['a'],rels:['a*a-a']},
 {id:'ocaml-idempotent-braid',vars:['a','b'],rels:['a*a-a','b*b-b','a*b*a-b*a*b']},
 {id:'ocaml-ab-ee',vars:['a','b','c','d','e'],rels:['a*b-e*e','b*c-e*d']},
 {id:'ocaml-square-sum',vars:['x','y'],rels:['x*x+x*y+y*x+y*y']},
 {id:'ocaml-square-minus',vars:['x','y'],rels:['x*x-x*y-y*x-y*y']},
 {id:'ocaml-square-difference',vars:['x','y'],rels:['x*x-y*y']},
 {id:'ocaml-symmetric6',...FAMILIES.symmetric.build(6)}
);
let seed=731;
const rand=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed;};
for(let i=0;i<12;i++){
 const rels=Array.from({length:2},()=>['x*x','x*y','y*x','y*y'].map(w=>`${Number(rand()%5)-2}*${w}`).join('+'));
 cases.push({id:`seeded-${i}`,vars:['x','y'],rels,p:[0,2,5][i%3],comm:i%4===0});
}
const report=[];
try{
 for(const c of cases){
  const rt=await wasmRuntime();
  const job=buildJob({task:'gb',ring:c.comm?'comm':'noncomm',order:c.comm?'deglex':'degleftlex',vars:c.vars,rels:c.rels,maxdeg:6,field:c.p?'p':'0',modulus:c.p,nonhomog:'degreewise',lowterms:'safe'});
  const r=rt.run(job),text=r.files['result.gb'];fs.writeFileSync(`${out}/${c.id}.gb`,text);
  const a=algebra(c.vars,!!c.comm,c.p||0),gb=a.basis(text);
  const bound=c.rels.every(s=>isHomogeneous(parseRelation(s,c.vars),new Map()))?6:Infinity;
  const ambiguities=a.certify(c.rels.map(a.parse),gb,bound);
  if(c.dims)assert.deepEqual(a.hilbert(gb,6),c.dims,`${c.id}: Hilbert dimensions`);
  oracle(c,parseBasis(text).groups.flatMap(g=>g.polys));
  const row={id:c.id,basisSize:gb.length,ambiguities,elapsedMs:r.elapsedMs,oracle:c.id==='quantum-plane'?'Singular Letterplace + Plural':'Singular',degreeBound:6,allAmbiguities:bound===Infinity};report.push(row);console.log(row.id,'PASS',ambiguities);
 }
 // Active algebra/resolution cases in smimram/ocaml-alg test/anick0..3.
 const ocaml=[
  {id:'anick0',...FAMILIES.exterior.build(3),maxdeg:10,expected:[1,3,6,10,15,21,28,36,45,55]},
  {id:'anick1',vars:['a','b'],rels:['a^3'],maxdeg:12,chainCounts:[2,1,1,1,1,1,1]},
  {id:'anick2',vars:['x','y','z'],rels:['x^3+y^3+z^3-x*y*z'],maxdeg:12,expected:[1,3,1,0,0,0]},
  {id:'anick3',vars:['x','y'],rels:['x^2-1'],maxdeg:11,augmentation:'monoid',expected:[1,1,0,0,0,0,0,0,0,0,0]},
  {id:'mirai',vars:['g','f','e','d','c','b','a'],rels:['a*a*b-a*c*c','c*c*d-f','c*c*e-g','c*g-f*e'],maxdeg:8,augmentation:'monoid'},
 ];
 const references=JSON.parse(fs.readFileSync('build/validation/ocaml/references.json','utf8')).cases;
 for(const c of ocaml){
  const rt=await wasmRuntime();const j=buildJob({task:'anick',ring:'noncomm',order:'degleftlex',field:'0',...c});const r=rt.run(j);
  const text=r.files['result.anick'];fs.writeFileSync(`${out}/${c.id}.anick`,text);
  const h=r.homology||augmentedHomology(text,c.vars);
  const expected=references[c.id].betti;
  const actual=h.finiteTailZero?Array.from({length:expected.length},(_,i)=>h.betti[i]||0):h.betti.slice(0,expected.length);
  if(expected.length)assert.deepEqual(actual,expected,`${c.id}: OCaml Betti numbers`);
  if(c.chainCounts){const d=parseAnick(text).diffs;assert.deepEqual(c.chainCounts.map((_,i)=>(d.get(i)||[]).length),c.chainCounts);
    const chain=s=>parseRelation(s,c.vars)[0].factors.map(f=>f.v.repeat(f.e)).join('');
    assert.deepEqual(references.anick1.chains.map((_,i)=>(d.get(i)||[]).map(x=>chain(x.chain)).sort()),references.anick1.chains.map(x=>x.slice().sort()));
  }
  const identities=certifyResolution(text,r.files['resolution.gb']||r.files['result.gb'],c.vars);
  report.push({id:c.id,homology:h,identities,comparedBetti:expected.length,elapsedMs:r.elapsedMs});console.log(c.id,'PASS',h.betti);
 }
 for(const p of [2,5])for(const monoid of [false,true]){
  const c=monoid?{vars:['x','y'],rels:['x^2-1'],augmentation:'monoid'}:FAMILIES.exterior.build(3);
  const rt=await wasmRuntime(),r=rt.run(buildJob({task:'anick',ring:'noncomm',order:'degleftlex',field:'p',modulus:p,maxdeg:7,...c}));
  const h=r.homology||augmentedHomology(r.files['result.anick'],c.vars,p),identities=certifyResolution(r.files['result.anick'],r.files['resolution.gb']||r.files['result.gb'],c.vars,p);
  const expected=monoid?[1,p===2?2:1,...Array(5).fill(p===2?1:0)]:[1,3,6,10,15,21,28];
  assert.deepEqual(h.betti.slice(0,7),expected);
  report.push({id:`${monoid?'monoid':'exterior'}-resolution-F${p}`,homology:h,identities,elapsedMs:r.elapsedMs});
 }
 fs.writeFileSync(`${out}/report.json`,JSON.stringify(report,null,2));
}catch(e){fs.writeFileSync(`${out}/partial-report.json`,JSON.stringify(report,null,2));console.error(e);process.exitCode=1;}
