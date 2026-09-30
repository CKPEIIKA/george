// Independent check of d²=0 over the presented algebra, before augmentation.
import assert from 'node:assert/strict';
import {readResolution,chainKey} from '../../web/src/resolution-data.js';
import {algebra} from './algebra.mjs';
export function certifyResolution(text, basis, vars, modulus=0) {
  const a=algebra(vars,false,modulus),gb=a.basis(basis);
  const maps=new Map();let identities=0;
  for(const [degree,rows] of readResolution(text,vars,modulus).diffs){
    const map=new Map();maps.set(degree,map);
    for(const row of rows){
      const value=new Map();map.set(chainKey(row.chain),value);
      for(const term of row.terms){
        const key=chainKey(term.target);
        const f=value.get(key)||new Map();value.set(key,f);
        for(const [w,c] of a.scale(a.parse(term.word.join('*')||'1'),a.q(...term.coefficient)))a.put(f,w,c);
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
