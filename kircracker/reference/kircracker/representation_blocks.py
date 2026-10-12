"""Exact S4 multiplicity spaces for the complementary relative module.

This prototype requires a COMPLETE coset basis: a replayed lower minor matching
an independent published FK6 upper dimension, available here only through degree
10. It is not valid to project arbitrary partial lower-bound data as if it were a
representation. All projection arithmetic is over Q, not approximate characters.
"""
from fractions import Fraction as Q
from itertools import permutations,product
from .core import perm_action,permutation_degree
from .coset_pairing import verify,Pairing,inverse,conjugate
from finitefk.series import known_hilbert,divide,mul
from finitefk.finite_model import star_hilbert,rank

IRREPS={
 '4':(1,(1,1,1,1,1)),
 '31':(3,(3,1,-1,0,-1)),
 '22':(2,(2,0,2,-1,0)),
 '211':(3,(3,-1,-1,0,1)),
 '1111':(1,(1,-1,1,1,-1)),
}
CLASS_REPS=[(1,2,3,4,5,6),(2,1,3,4,5,6),(2,1,4,3,5,6),(2,3,1,4,5,6),(2,3,4,1,5,6)]
CLASS_SIZES=[1,6,3,8,6]
GROUP=[tuple(p)+(5,6) for p in permutations(range(1,5))]
IDENTITY=tuple(range(1,7))
def compose(a,b):return tuple(a[x-1] for x in b)
def parity(p):return (-1)**sum(p[i]>p[j] for i in range(len(p)) for j in range(i+1,len(p)))
def class_index(p):
 seen=set();cy=[]
 for i in range(4):
  if i in seen:continue
  k=i;n=0
  while k not in seen:seen.add(k);n+=1;k=p[k]-1
  cy.append(n)
 return {(1,1,1,1):0,(1,1,2):1,(2,2):2,(1,3):3,(4,):4}[tuple(sorted(cy))]
def inv_matrix(a):
 n=len(a);v=[[Q(x) for x in row]+[Q(i==j) for j in range(n)] for i,row in enumerate(a)]
 for j in range(n):
  k=next((i for i in range(j,n) if v[i][j]),None)
  if k is None:raise ValueError('Singular exact Gram matrix')
  v[j],v[k]=v[k],v[j];c=v[j][j];v[j]=[x/c for x in v[j]]
  for i in range(n):
   if i!=j and v[i][j]:
    c=v[i][j];v[i]=[x-c*y for x,y in zip(v[i],v[j])]
 return [row[n:] for row in v]
def vector_add(a,b,c=1):
 v=dict(a)
 for k,x in b.items():
  z=v.get(k,0)+c*x
  if z:v[k]=z
  else:v.pop(k,None)
 return v

def group_product(a,b):
 out={}
 for g,x in a.items():
  for h,y in b.items():out=vector_add(out,{compose(g,h):x*y})
 return out

def young_element(shape):
 """Row symmetrizer times column antisymmetrizer for a fixed tableau."""
 sizes={'4':[4],'31':[3,1],'22':[2,2],'211':[2,1,1],'1111':[1,1,1,1]}[shape]
 rows=[];k=1
 for n in sizes:rows.append(list(range(k,k+n)));k+=n
 columns=[[row[j] for row in rows if j<len(row)] for j in range(max(sizes))]
 def subgroup(blocks):
  out=[]
  for choices in product(*(list(permutations(block)) for block in blocks)):
   g=list(IDENTITY)
   for block,to in zip(blocks,choices):
    for a,b in zip(block,to):g[a-1]=b
   out.append(tuple(g))
  return out
 a={g:Q(1) for g in subgroup(rows)};b={g:Q(parity(g)) for g in subgroup(columns)}
 y=group_product(a,b);hook=24//IRREPS[shape][0]
 assert group_product(y,y)=={g:c*hook for g,c in y.items()}
 return y,hook

class CompleteRelativeBasis:
 def __init__(self,cert,*,seconds=120,max_calls=10000000):
  if cert.get('ambientFK')!=6 or not 0<=cert.get('degree',-1)<=10:raise ValueError('This representation prototype requires independently known upper dimensions through degree10; user anchors are not enough')
  check=verify(cert,independent=True,seconds=seconds)
  expected=divide(known_hilbert()[6],mul(known_hilbert()[5],star_hilbert(4)))[cert['degree']]
  if check['value']!=expected:raise ValueError('Lower words are not established to span this module')
  self.d=cert['degree'];self.P=Pairing(6,seconds=seconds,max_calls=max_calls,max_cache=500000);self.words=[];self.byword={};self.blocks={}
  for b in cert['blocks']:
   us=[tuple(map(tuple,w)) for w in b['words']];vs=[tuple(map(tuple,w)) for w in b['dualWords']]
   inv=inv_matrix([[self.P.evaluate(u,v) for v in vs] for u in us])
   for g in b.get('transports',[IDENTITY]):
    gs=tuple(g);transU=[perm_action(w,gs) for w in us];transV=[perm_action(w,gs) for w in vs];offset=len(self.words)
    words=[w for w,s in transU];duals=[w for w,s in transV]
    inverseG=[[transV[j][1]*x*transU[i][1] for i,x in enumerate(row)] for j,row in enumerate(inv)]
    grade=conjugate(gs,tuple(b['permutationDegree']));self.blocks[grade]=(offset,words,duals,inverseG)
    self.words.extend(words)
  self.byword={w:i for i,w in enumerate(self.words)}
  if len(self.byword)!=expected:raise ValueError('Basis repeated during transport')
  self.size=expected;self.action_cache={}
 def coords(self,w):
  if len(w)!=self.d:raise ValueError('Wrong homogeneous degree')
  i=self.byword.get(w)
  if i is not None:return {i:Q(1)}
  block=self.blocks.get(permutation_degree(w,6))
  if block is None:return {}
  offset,ws,vs,inv=block;pair=[self.P.evaluate(w,v) for v in vs]
  return {offset+i:z for i in range(len(ws)) if (z:=sum((a*inv[j][i] for j,a in enumerate(pair) if a),Q(0)))}
 def image(self,g,i):
  key=(g,i)
  if key not in self.action_cache:
   w,s=perm_action(self.words[i],g);self.action_cache[key]={k:s*v for k,v in self.coords(w).items()}
  return self.action_cache[key]
 def trace(self,g):
  total=Q(0)
  for grade,(offset,ws,vs,inv) in self.blocks.items():
   if conjugate(g,grade)!=grade:continue
   for j in range(len(ws)):total+=self.image(g,offset+j).get(offset+j,0)
  return total
 def apply(self,g,v):
  out={}
  for i,c in v.items():out=vector_add(out,self.image(g,i),c)
  return out
 def project(self,group_element):
  return [self.project_vector(group_element,{i:Q(1)}) for i in range(self.size)]
 def project_vector(self,group_element,v):
  out={}
  for g,c in group_element.items():out=vector_add(out,self.apply(g,v),c)
  return out
 def character(self):
  tau=[self.trace(g) for g in CLASS_REPS]
  if any(t.denominator!=1 for t in tau):raise ValueError('Noninteger S4 character')
  mult={name:sum(Q(n)*a*b for n,a,b in zip(CLASS_SIZES,chi,tau))/24 for name,(dim,chi) in IRREPS.items()}
  if any(v<0 or v.denominator!=1 for v in mult.values()) or sum(IRREPS[n][0]*v for n,v in mult.items())!=self.size:raise ValueError('Invalid multiplicity decomposition')
  return {'degree':self.d,'dimension':self.size,'classOrder':['1^4','2,1,1','2,2','3,1','4'],'character':[int(x) for x in tau],'multiplicities':{k:int(v) for k,v in mult.items()},'onePrimitiveBlockTotal':int(sum(mult.values())),'scope':'complete relative module using published upper prefix and independently replayed lower minors, Q'}
 def check_actions(self):
  generators=CLASS_REPS[1:2]+[(1,3,2,4,5,6),(1,2,4,3,5,6)]
  for i in range(self.size):
   v={i:Q(1)}
   for g in generators:
    assert self.apply(g,self.apply(g,v))==v
   for g,h in [(generators[0],generators[1]),(generators[1],generators[2]),(generators[0],generators[2])]:
    assert self.apply(g,self.apply(h,v))==self.apply(compose(g,h),v)
   for g,h in zip(generators,generators[1:]):assert self.apply(g,self.apply(h,self.apply(g,v)))==self.apply(h,self.apply(g,self.apply(h,v)))
  return True
 def check_projectors(self):
  character=self.character();report=[]
  for name,(dim,chi) in IRREPS.items():
   y,hook=young_element(name);cols=self.project(y);found=rank(cols)
   assert found==character['multiplicities'][name]
   for col in cols:assert self.project_vector(y,col)=={i:c*hook for i,c in col.items()}
   report.append({'partition':name,'irreducibleDimension':dim,'hookProduct':hook,'rankOfPrimitiveProjector':found,'idempotencyVerified':True})
  return report

def generator_multiplicities(character):
    """Character of V_star tensor L_(d-1), not of anonymous word columns."""
    v=(5,3,1,2,1)
    trace=[x*y for x,y in zip(v,character['character'])]
    mult={name:sum(Q(n)*a*b for n,a,b in zip(CLASS_SIZES,chi,trace))/24 for name,(dim,chi) in IRREPS.items()}
    assert all(m.denominator==1 and m>=0 for m in mult.values())
    return {k:int(m) for k,m in mult.items()}

def check_projected_generation(previous,current):
    """Exact toy multiplication V_star tensor L_(d-1) -> L_d.

    Both source and target bases need their independently established dimensions.
    Check equivariance and ranks on one primitive Young piece of each isotypic
    component. This is not an implementation of high-degree relation discovery.
    """
    if current.d!=previous.d+1:raise ValueError('Adjacent degrees required')
    star=tuple((i,6) for i in range(1,6));a=previous.size;N=5*a
    columns=[current.coords((edge,)+w) for edge in star for w in previous.words]
    assert rank(columns)==current.size
    def multiply(vec):
        out={}
        for i,c in vec.items():out=vector_add(out,columns[i],c)
        return out
    def tensor_action(g,j):
        edge,i=divmod(j,a);newedge=g[edge]-1
        return {newedge*a+k:c for k,c in previous.image(g,i).items()}
    generators=[(2,1,3,4,5,6),(1,3,2,4,5,6),(1,2,4,3,5,6)]
    for g in generators:
        for j in range(N):assert multiply(tensor_action(g,j))==current.apply(g,columns[j])
    source=generator_multiplicities(previous.character());target=current.character()['multiplicities'];blocks=[]
    for name in IRREPS:
        y,hook=young_element(name);projected=[]
        for j in range(N):
            v={}
            for g,c in y.items():v=vector_add(v,tensor_action(g,j),c)
            projected.append(v)
        actual_source=rank(projected);images=[multiply(v) for v in projected];actual_target=rank(images)
        assert actual_source==source[name] and actual_target==target[name]
        blocks.append({'partition':name,'sourceMultiplicity':actual_source,'imageMultiplicity':actual_target,'kernelMultiplicity':actual_source-actual_target,'irrepDimension':IRREPS[name][0]})
    assert sum(b['irrepDimension']*b['kernelMultiplicity'] for b in blocks)==N-current.size
    return {'degree':current.d,'unreducedSourceDimension':N,'targetDimension':current.size,'equivarianceCheckedColumns':3*N,'blocks':blocks,'primitiveSourceDimensionTotal':sum(source.values()),'primitiveTargetDimensionTotal':sum(target.values()),'passed':True}
