#!/usr/bin/env python3
from pathlib import Path
import sys,json,hashlib,itertools
R=Path(__file__).resolve().parents[1];sys.path[:0]=[str(R),str(R/'reference'),str(R/'tools')]
from app.util import load,sha,json_hash,atomic_json
from star_relations import verify,write_native
from radical import read_polynomial
out=Path(sys.argv[1]);out.mkdir(parents=True,exist_ok=True)
base=load(R/'data/base-through13.json');rows,proof=verify(base['library']);assert proof['passed']
write_native(base['library'],out/'FK-original.rel')
cert=load(R/'data/degree14-radical.json')
if cert.get('claim')!='NICHOLS_PAIRING_RADICAL':raise ValueError('incorrect quotient relation namespace')
q=read_polynomial(cert['polynomial'],6,14);q={tuple(a-1 for a,b in w):c for w,c in q.items()}
extra=[];seen=set()
for s in itertools.permutations(range(5)):
 p={tuple(s[a] for a in w):c for w,c in q.items()};key=tuple(sorted(p.items()))
 if key not in seen:extra.append(p);seen.add(key)
allrows=list(rows)+extra;text=['5 '+str(len(allrows))]
for p in allrows:
 text.append(f'{len(next(iter(p)))} {len(p)}');text.extend(str(c)+' '+' '.join(map(str,w)) for w,c in sorted(p.items()))
(out/'NICHOLS-only.rel').write_text('\n'.join(text)+'\n')
finger=json_hash({'base':sha(R/'data/base-through13.json'),'radical':sha(R/'data/degree14-radical.json'),'proofCode':sha(R/'tools/star_relations.py')})
result={'passed':True,'binding':finger,'proof':proof,'originalRelations':len(rows),'extraNicholsOnlyRelations':len(extra),'nicholsRadicalVerificationRequired':True,'files':{p:sha(out/p) for p in ['FK-original.rel','NICHOLS-only.rel']}}
atomic_json(out/'verified.json',result);print(json.dumps(result))
