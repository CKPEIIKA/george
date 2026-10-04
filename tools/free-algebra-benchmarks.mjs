// Input conversion shared by regression guards and opt-in stress measurements.
import fs from 'node:fs';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {readInputFile} from '../web/src/bergman-syntax.js';
import {rationalTerms} from '../fomkyr/tools/oracle-format.mjs';

export const BENCHMARK_CATALOG = 'fomkyr/fixtures/benchmarks/catalog.json';
export const sha256 = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const gcd=(a,b)=>{a=a<0n?-a:a;b=b<0n?-b:b;while(b){[a,b]=[b,a%b];}return a;};

export function parseMsolve(text) {
  const lines=text.trim().split(/\r?\n/);
  const vars=lines.shift().split(',').map(v=>v.trim());
  assert.equal(lines.shift().trim(),'0','These literature benchmarks are over Q');
  assert.ok(vars.every(v=>/^[A-Za-z_][A-Za-z_0-9]*$/.test(v))&&new Set(vars).size===vars.length);
  const rels=lines.join('').split(',').map(r=>r.trim()).filter(Boolean);
  assert.ok(rels.length);
  return {vars,rels};
}

export function integerPresentation({vars,rels}) {
  const relations=[],normalized=[],inhomogeneous=[];
  for(const [index,source] of rels.entries()) {
    const terms=rationalTerms(source,vars);
    assert.ok(terms.length,'Zero defining relation');
    const degrees=[...new Set(terms.map(t=>t.word.length))];
    if(degrees.length!==1||!degrees[0])inhomogeneous.push({relation:index+1,degrees:degrees.sort((a,b)=>a-b)});
    const lcm=terms.reduce((d,t)=>d/gcd(d,t.denominator)*t.denominator,1n);
    const coefficients=terms.map(t=>t.numerator*(lcm/t.denominator));
    const content=coefficients.reduce((d,c)=>gcd(d,c),0n);
    const scaled=terms.map((t,i)=>({word:t.word.map(v=>vars.indexOf(v)),coefficient:String(coefficients[i]/content)}));
    for(const term of scaled)assert.ok(BigInt(term.coefficient)<(1n<<62n)&&BigInt(term.coefficient)>-(1n<<62n),'Input coefficient exceeds the C/Wasm integer interchange');
    relations.push({degree:degrees[0],terms:scaled});
    normalized.push(scaled.map((t,i)=>{
      const c=BigInt(t.coefficient),word=t.word.map(k=>vars[k]).join('*');
      return (c<0n?'-':i?'+':'')+(c<0n?-c:c)+(word?'*'+word:'');
    }).join(''));
  }
  return {variables:vars,relations,rels:normalized,inputText:`vars ${vars.join(',')};\n\n${normalized.join(',\n')};\n`,
    homogeneous:inhomogeneous.length===0,inhomogeneous};
}

export function loadBenchmark(entry) {
  const bytes=fs.readFileSync(entry.inputFile);
  assert.equal(sha256(bytes),entry.inputSha256,'Benchmark input changed: '+entry.id);
  const parsed=entry.format==='ms'?parseMsolve(bytes.toString()):readInputFile('(ALGFORMINPUT)\n'+(entry.format==='george-json'?JSON.parse(bytes).inputText:bytes));
  const presentation=integerPresentation(parsed);
  assert.deepEqual(presentation.variables,entry.variables);
  assert.equal(presentation.homogeneous,entry.homogeneous);
  return {...presentation,name:entry.id};
}

export function loadCatalog() {
  const catalog=JSON.parse(fs.readFileSync(BENCHMARK_CATALOG));
  assert.equal(catalog.schema,1);
  assert.equal(new Set(catalog.cases.map(c=>c.id)).size,catalog.cases.length);
  return catalog;
}

export function selectBenchmarks(catalog,suite='priority',ids=null) {
  const selected=ids?ids.map(id=>{const c=catalog.cases.find(c=>c.id===id);assert.ok(c,'Unknown benchmark: '+id);return c;})
    :catalog.cases.filter(c=>c.suites.includes(suite));
  assert.ok(selected.length,'No cases in suite '+suite);
  return selected;
}

export function singularScript(presentation,degree) {
  const names=presentation.variables.map((_,i)=>'bench_v'+i);
  // Keep the generator priority used by f4ncgb's own Singular exporter:
  // the MS header is ascending, and Singular's Dp ring list is reversed.
  const relations=presentation.relations.filter(r=>r.degree<=degree).map(r=>r.terms.map((t,i)=>{
    const c=BigInt(t.coefficient),word=t.word.map(k=>names[k]).join('*');
    return (c<0n?'-':i?'+':'')+(c<0n?-c:c)+(word?'*'+word:'');
  }).join(''));
  return `LIB "freegb.lib";\nring r=0,(${[...names].reverse().join(',')}),Dp;\ndef A=freeAlgebra(r,${Math.max(2,degree)});\nsetring A;\noption(redSB);option(intStrategy);\nideal I=${relations.join(',')||'0'};\nideal G=twostd(I);\nfor(int j=1;j<=size(G);j++){if(G[j]!=0){print("POLY:"+string(G[j]));}}\nprint("BENCHMARK_DONE");\nquit;\n`;
}

export function hilbertOracle(entry,degree) {
  if(entry.hilbertOracle==='polynomial-ring-4')return Array.from({length:degree+1},(_,d)=>String((d+1)*(d+2)*(d+3)/6));
  if(entry.hilbertOracle==='down-up')return Array.from({length:degree+1},(_,d)=>String(Array.from({length:Math.floor(d/2)+1},(_,k)=>d-2*k+1).reduce((a,b)=>a+b,0)));
  return null;
}

export function acceptancePassed(rows,expectedCount=rows.length) {
  return rows.length>0&&rows.length===expectedCount&&rows.every(r=>r.status==='complete'&&r.independentCheck?.status==='passed');
}
