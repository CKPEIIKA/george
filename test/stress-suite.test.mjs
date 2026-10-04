import test from 'node:test';
import assert from 'node:assert/strict';
import {loadCatalog,loadBenchmark,selectBenchmarks,integerPresentation,parseMsolve,singularScript,hilbertOracle,acceptancePassed} from '../tools/free-algebra-benchmarks.mjs';
import {FK6_REGRESSION_MAX_DEGREE,NATIVE_REGRESSION_CHECKS} from '../tools/suite-profiles.mjs';
import {algebra} from './support/algebra.mjs';

test('Literature fixtures are pinned, parsed, and homogeneous inputs retain their words',()=>{
 const catalog=loadCatalog();assert.equal(catalog.cases.length,20);
 for(const entry of catalog.cases){const p=loadBenchmark(entry);assert.ok(p.relations.length);assert.ok(p.variables.length<=16);
  if(entry.homogeneous)for(const r of p.relations)assert.ok(r.terms.every(t=>t.word.length===r.degree));
 }
 const malle=loadBenchmark(catalog.cases.find(c=>c.id==='malle_G12h'));
 assert.equal(malle.homogeneous,false);assert.ok(malle.inhomogeneous.some(r=>r.degrees.join(',')==='2,3,4'));
});
test('Stress ladder retains exact target bounds and FK6 9–11 is outside routine regressions',()=>{
 const c=loadCatalog();
 assert.deepEqual(selectBenchmarks(c,'priority').map(r=>[r.id,r.targetDegree]),[['4nilp5s',10],['braid3',16],['lp1',15],['serre-e6',17]]);
 for(const [id,d] of [['braidX',18],['braidXY',12],['serre-ha11',17],['holt_G3562h',17],['lv2d10',100],['malle_G12h',100]])assert.equal(c.cases.find(r=>r.id===id).targetDegree,d);
 assert.deepEqual(selectBenchmarks(c,'fk6').filter(r=>r.id.startsWith('fk6-')).map(r=>r.targetDegree),[9,10,11]);
 assert.equal(FK6_REGRESSION_MAX_DEGREE,6);
 assert.ok(!NATIVE_REGRESSION_CHECKS.includes('cli-resume'));assert.ok(NATIVE_REGRESSION_CHECKS.includes('native-frontier'));
 assert.throws(()=>selectBenchmarks(c,'missing'));assert.throws(()=>selectBenchmarks(c,'priority',['missing']));
});
test('Rational fixtures clear scalar denominators exactly and retain generator priority',()=>{
 const parsed=parseMsolve('z,y,x\n0\n1/2*x*y-3/4*y*x,\nx^2+y^2\n');
 const p=integerPresentation(parsed);
 assert.deepEqual(p.relations[0].terms,[{word:[2,1],coefficient:'2'},{word:[1,2],coefficient:'-3'}]);
 assert.match(singularScript(p,5),/\(bench_v2,bench_v1,bench_v0\),Dp/);
 assert.throws(()=>parseMsolve('a,b\n101\na*b-b*a'));
 assert.throws(()=>integerPresentation(parseMsolve('a,b\n0\na*b-unknown*a')));
});
test('Four-dimensional Sklyanin and cubic down-up have independent dimension formulas',()=>{
 const catalog=loadCatalog();
 assert.deepEqual(hilbertOracle(catalog.cases.find(c=>c.id==='sklyanin4-2-3'),6),['1','4','10','20','35','56','84']);
 assert.deepEqual(hilbertOracle(catalog.cases.find(c=>c.id==='down-up-3-minus2'),6),['1','2','4','6','9','12','16']);
 // alpha=2, beta=3, gamma=-5/7: 7*(alpha+beta+gamma+alpha*beta*gamma)=0.
 assert.equal(14+21-5-30,0);
});
test('Hard acceptance requires completed computations and independent passing checks',()=>{
 const complete={status:'complete',independentCheck:{status:'passed'}};
 assert.equal(acceptancePassed([complete]),true);assert.equal(acceptancePassed([]),false);
 assert.equal(acceptancePassed([complete],2),false);
 for(const status of ['timeout','oom','unsupported','error'])assert.equal(acceptancePassed([complete,{...complete,status}]),false);
 for(const status of ['not-run','incomplete','failed'])assert.equal(acceptancePassed([{...complete,independentCheck:{status}}]),false);
});
function associatedMap(entry){
 const p=loadBenchmark(entry),r=new Map();
 for(let a=0;a<4;a++)for(let b=0;b<4;b++)r.set(a+','+b,[a,b]);
 for(const relation of p.relations){assert.equal(relation.terms.length,2);const [a,b]=relation.terms.map(t=>t.word);r.set(a.join(','),b);r.set(b.join(','),a);}
 return r;
}
function satisfiesYBE(r){
 const apply=(w,i)=>{const pair=r.get(w.slice(i,i+2).join(','));return [...w.slice(0,i),...pair,...w.slice(i+2)];};
 for(let a=0;a<4;a++)for(let b=0;b<4;b++)for(let c=0;c<4;c++){
  const w=[a,b,c],left=apply(apply(apply(w,0),1),0),right=apply(apply(apply(w,1),0),1);
  if(left.join(',')!==right.join(','))return false;
 }return true;
}
test('Quantum-binomial counterexample and actual Yang–Baxter guard are distinguished',()=>{
 const c=loadCatalog();
 assert.equal(satisfiesYBE(associatedMap(c.cases.find(e=>e.id==='quantum-binomial-non-pbw'))),false);
 assert.equal(satisfiesYBE(associatedMap(c.cases.find(e=>e.id==='yang-baxter'))),true);
 const p=loadBenchmark(c.cases.find(e=>e.id==='quantum-binomial-non-pbw'));
 const permutations=xs=>xs.length?xs.flatMap((x,i)=>permutations(xs.filter((_,j)=>j!==i)).map(t=>[x,...t])):[[]];
 for(const vars of permutations(p.variables)){const a=algebra(vars);assert.throws(()=>a.certify(p.rels.map(a.parse),p.rels.map(a.parse).map(a.monic),3));}
});
