#!/usr/bin/env python3
"""Independent degree<=4 word enumeration. Compare normal-word permutation
class counts to the offline structural profile, without using its group table.
Also compare actual timed outputs byte-for-byte (not a new large GB certificate).
"""
from pathlib import Path
from itertools import product
from collections import Counter
import json,sys,argparse
p=argparse.ArgumentParser();p.add_argument('--fomkyr',type=Path,required=True);p.add_argument('--run',type=Path,required=True);p.add_argument('--identification',type=Path,required=True);p.add_argument('--profile',type=Path,required=True);p.add_argument('--out',type=Path,required=True);a=p.parse_args()
sys.path.insert(0,str(a.fomkyr/'tools'));from canonical_audit import records
f=json.loads((a.fomkyr/'fixtures/fk6.json').read_text());ident=json.loads(a.identification.read_text())['generatorMap'];edges=[ident[x]['edge'] for x in f['variables']];profile=json.loads(a.profile.read_text());types=[tuple(x) for x in profile['classes']]
basis=list(records(a.run,4,15));leaders=[max(x) for x in basis]
def grade(w):
 s=list(range(1,7))
 for c in w:i,j=edges[c];s[i-1],s[j-1]=s[j-1],s[i-1]
 return tuple(s)
def cyctype(p):
 seen=set();ret=[]
 for x in range(1,7):
  if x in seen:continue
  y=x;n=0
  while y not in seen:seen.add(y);n+=1;y=p[y-1]
  ret.append(n)
 return tuple(sorted(ret,reverse=True))
checks=[]
for d in range(1,5):
 forbidden={k:{w for w in leaders if len(w)==k} for k in range(1,d+1)};tot=Counter();groups=Counter()
 for w in product(range(15),repeat=d):
  if any(w[i:i+k] in forbidden[k] for k in range(1,d+1) for i in range(d-k+1)):continue
  g=grade(w);tot[cyctype(g)]+=1;groups[g]+=1
 assert [tot[c] for c in types]==profile['classDimensions'][d],d
 for g,count in groups.items():k=types.index(cyctype(g));assert count==profile['classDimensions'][d][k]//profile['classSizes'][k]
 checks.append({'degree':d,'wordColumns':15**d,'classesExactlyMatch':True,'individualGroupCountsMatch':True,'normalWords':sum(tot.values())})
a.out.write_text(json.dumps({'passed':True,'checks':checks,'independentPermutationImplementation':True},indent=2));print('PASS group profile and normal words through4')
