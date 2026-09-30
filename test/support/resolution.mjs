// Independent check of d²=0 over the presented algebra, before augmentation.
import assert from 'node:assert/strict';
import {parseAnick,parseRelation} from '../../web/src/bergman-syntax.js';
import {algebra} from './algebra.mjs';
export function certifyResolution(text, basis, vars, modulus=0) {
  const a=algebra(vars,false,modulus),gb=a.basis(basis);
  const word=s=>s==='1'?'':parseRelation(s.replace(/^\*/,''),vars)[0].factors.map(f=>f.v.repeat(f.e)).join('');
  const maps=new Map();let identities=0;
  for(const [degree,rows] of parseAnick(text).diffs){
    const map=new Map();maps.set(degree,map);
    for(const row of rows){
      const value=new Map();map.set(word(row.chain),value);
      for(const term of row.image.replaceAll(' ','').match(/[+-]?[^+-]+/g)||[]){
        const m=/^([+-]?)(?:(\d+)(?:\/(\d+))?)?([^.]*)\.(.*)$/.exec(term);
        assert.ok(m,`differential term ${term}`);
        const [,sign,num,den,target,elt]=m,key=word(target||'1');
        const f=value.get(key)||new Map();value.set(key,f);
        for(const [w,c] of a.scale(a.parse(elt),a.q((sign==='-'?-1n:1n)*BigInt(num||1),BigInt(den||1))))a.put(f,w,c);
      }
    }
  }
  for(const [n,map] of maps){if(n===0)continue;
    const previous=maps.get(n-1);assert.ok(previous);
    for(const value of map.values()){
      const composite=new Map();
      for(const [middle,c] of value){const d=previous.get(middle);assert.ok(d,`missing chain ${middle}`);
        for(const [target,b] of d){const f=composite.get(target)||new Map();composite.set(target,f);for(const [w,v] of a.multiply(b,c))a.put(f,w,v);}
      }
      for(const f of composite.values())assert.equal(a.nf(f,gb).size,0,`d² in homological degree ${n+1}`);
      identities++;
    }
  }
  return identities;
}
