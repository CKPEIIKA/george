"""Bounded exact reference completion and ambient-oracle subalgebra extraction.
The reference completion is for controls/fallback; the high-degree producer can
be an external fomkyr executable. Historical provenance is never invented.
"""
from .core import *
from .combinatorics import Avoidance
from itertools import product

def criticals(rows,D,exact_degree=None):
 for i,f in enumerate(rows):
  u=max(f)
  for j,g in enumerate(rows):
   v=max(g)
   # Proper overlaps; then all inclusions (including duplicate-leader cases).
   for k in range(1,min(len(u),len(v))):
    d=len(u)+len(v)-k
    if d<=D and (exact_degree is None or d==exact_degree) and u[-k:]==v[:k]:
     parent={'kind':'overlap','leftRule':i,'rightRule':j,'overlapLength':k,'overlapPosition':len(u)-k,'word':list(u+v[k:])}
     yield add(context(f,right=v[k:],scale=1/f[u]),context(g,left=u[:-k],scale=1/g[v]),-1),parent
   if len(v)<=len(u) and len(u)<=D and (exact_degree is None or len(u)==exact_degree):
    for at in range(len(u)-len(v)+1):
     if u[at:at+len(v)]==v and not(i==j and at==0):
      yield add(context(f,scale=1/f[u]),context(g,u[:at],u[at+len(v):],1/g[v]),-1),{'kind':'inclusion','leftRule':i,'rightRule':j,'position':at,'word':list(u)}

def complete(relations,ng,D,budget=None,checkpoint=None):
 b=budget or Budget();rows=[];origins=[];completed=0;examined=0
 for d in range(1,D+1):
  sources=[(p,{'kind':'input','inputId':i}) for i,p in enumerate(relations) if homogeneous(p)==d]
  for p,parent in sources:
   out,trace=normal(p,rows,b,True)
   if out:
    lead=out[max(out)];rows.append(monic(out));origins.append({'id':len(rows)-1,'degree':d,'parent':parent,'subtract':trace,'divideBy':str(lead),'birthPolynomial':serial(rows[-1])})
  pending=list(criticals(rows,d,d))
  for p,parent in pending:
   b.check();examined+=1;out,trace=normal(p,rows,b,True)
   if out:
    lead=out[max(out)];rows.append(monic(out));origins.append({'id':len(rows)-1,'degree':d,'parent':parent,'subtract':trace,'divideBy':str(lead),'birthPolynomial':serial(rows[-1])})
  completed=d
  if checkpoint:checkpoint(rows,origins,completed,examined)
 # A degree-one input needs elimination; each born leader is already irreducible.
 reduced=[];final=[]
 for i,p in enumerate(rows):
  others=[r for j,r in enumerate(rows) if i!=j];out,trace=normal(p,others,b,True)
  if not out:raise Invalid('unexpected redundant birth rule')
  mapping=[j for j in range(len(rows)) if j!=i]
  for t in trace:t['rule']=mapping[t['rule']]
  reduced.append(monic(out));final.append({'birthId':i,'subtract':trace,'divideBy':str(out[max(out)])})
 return reduced,{'schema':'kir-genealogy-v1','source':'actual reference-completion run','completeThrough':completed,'examined':examined,'births':origins,'finalReductions':final}

def verify_genealogy(relations,rows,genealogy,budget=None):
 b=budget or Budget();born=[]
 if len(rows)!=len(genealogy['births']) or len(rows)!=len(genealogy['finalReductions']):raise Invalid('missing birth or final-reduction certificates')
 if sorted(x['birthId'] for x in genealogy['finalReductions'])!=list(range(len(rows))):raise Invalid('duplicated or missing final certificate')
 for entry in genealogy['births']:
  i=entry['id'];assert i==len(born);parent=entry['parent']
  if parent['kind']=='input':p=relations[parent['inputId']]
  else:
   f=born[parent['leftRule']];g=born[parent['rightRule']];u=max(f);v=max(g)
   if parent['kind']=='overlap':k=parent['overlapLength'];assert u[-k:]==v[:k];p=add(context(f,right=v[k:],scale=1/f[u]),context(g,left=u[:-k],scale=1/g[v]),-1)
   else:at=parent['position'];assert u[at:at+len(v)]==v;p=add(context(f,scale=1/f[u]),context(g,u[:at],u[at+len(v):],1/g[v]),-1)
  for t in entry['subtract']:
   if t['rule']>=i:raise Invalid('future rule in proof')
   p=add(p,context(born[t['rule']],t['left'],t['right'],F(t['coefficient'])),-1);b.check(len(p))
  p={w:c/F(entry['divideBy']) for w,c in p.items()};assert p==parse(entry['birthPolynomial']);born.append(p)
 for target,e in zip(rows,genealogy['finalReductions']):
  p=born[e['birthId']]
  for t in e['subtract']:p=add(p,context(born[t['rule']],t['left'],t['right'],F(t['coefficient'])),-1)
  assert {w:c/F(e['divideBy']) for w,c in p.items()}==target
 return {'passed':True,'verifiedBirths':len(born),'actualHistory':True}

def star_extract(oracle,mapping,D,budget=None,limit=100000,checkpoint=None):
 """Kernel of the actual embedding, degree by degree (no guessed star presentation).
 Candidates avoid earlier leaders. Exact ambient coordinate dependence creates every
 new minimal star leader. Includes proof coordinates for each dependence.
 """
 b=budget or Budget();ng=len(mapping);rows=[];images={():{():F(1)}};levels=[()];proofs=[]
 for d in range(1,D+1):
  if d>oracle.degree:raise Invalid('star target exceeds ambient oracle certification bound')
  e=Echelon(b);basis_words=[];basis_images={};candidates=[];leaders=[max(p) for p in rows]
  for w in levels:
   for a in range(ng):
    v=w+(a,)
    if any(v[j:j+len(l)]==l for l in leaders for j in range(len(v)-len(l)+1)):continue
    candidates.append(v)
    if len(candidates)>limit:raise Incomplete('star candidate budget; completed earlier degrees retained')
  for w in sorted(candidates):
   b.check(len(candidates));idx,sgn=mapping[w[-1]];image=oracle.nf(context(images[w[:-1]],right=(idx,),scale=sgn),b)
   independent,coords=e.append(image)
   if independent:basis_words.append(w);basis_images[w]=image
   else:
    p={w:F(1)}
    for k,c in coords.items():p[basis_words[k[0]]]=p.get(basis_words[k[0]],0)-c
    p=clean(p);assert max(p)==w;rows.append(p);proofs.append({'kind':'ambient-linear-dependence','degree':d,'leader':list(w),'polynomial':serial(p),'image':serial(image),'sourceBasisWords':[list(x) for x in basis_words] if len(basis_words)<100 else None,'coordinates':[[i[0],str(c)] for i,c in coords.items()]})
  images=basis_images;levels=basis_words
  if checkpoint:checkpoint(rows,proofs,d,len(levels))
 reduced=[]
 for i,p in enumerate(rows):reduced.append(monic(normal(p,[r for j,r in enumerate(rows) if i!=j],b)))
 return reduced,{'kind':'actual-ambient-kernel-extraction','throughDegree':D,'proofs':proofs,'dependsOnAmbientNormalFormFaithfulness':True,'fullNormalWordsExported':False}
