"""Hash-bound data products; local checkpoint statuses are not mathematical proofs."""
from .core import *
from .fk import *
from .combinatorics import *
from .completion import *
from itertools import permutations
import shlex,subprocess,sys

def export_rows(directory,rows,degree,claim,parents=None,reduced=True):
 out=Path(directory);out.mkdir(parents=True,exist_ok=True);write_gnb(out/'basis.gnb',rows)
 with (out/'relations.jsonl').open('w') as f:
  for i,p in enumerate(rows):
   obj={'id':i,'degree':homogeneous(p),'leadingWord':list(max(p)),'terms':len(p),'polynomial':serial(p)}
   f.write(json.dumps(obj,separators=(',',':'))+'\n')
 atomic(out/'basis-meta.json',{'schema':'kir-proof-basis-v1','field':'Q','order':'degleftlex-last-variable-largest','completedThrough':degree,'rules':len(rows),'basisSHA256':sha(out/'basis.gnb'),'claim':claim,'reduced':reduced,'rationalCoefficients':'GNB primitive integers; relations.jsonl monic rationals'})
 atomic(out/'leading_words_by_degree.json',{'through':degree,'levels':{str(d):[list(max(p)) for p in rows if homogeneous(p)==d] for d in range(1,degree+1)}})
 if parents:atomic(out/'critical_pair_parents.json',parents)
 atomic(out/'orbit_representatives.json',orbit_summary(rows,max((a for p in rows for w in p for a in w),default=0)+1))

def init_project(work,basis,fixture,through,edges=None,n=6,checkpoint=None):
 w=Path(work);f=load(fixture);names=f.get('variables');ng=len(names)
 if f.get('modulus',0)!=0 or f.get('field','Q') not in ('Q','0',0):raise Invalid('proofkit accepts Q only')
 if f.get('order','degleftlex') not in ('degleftlex','degleftlex-last-variable-largest'):raise Invalid('degree-left-lex order required')
 if f.get('weights') is not None and f['weights']!=[1]*ng:raise Invalid('unit generator weights required')
 if f.get('commutative',False):raise Invalid('free noncommutative input required')
 if not isinstance(through,int) or through<1:raise Invalid('positive completed degree required')
 if edges is None:
  if names==GEORGE:edges=GEORGE_EDGES
  elif names==[f'x{i}{j}' for i,j in combinations(range(1,n+1),2)]:edges=FK(n).edges
  else:raise Invalid('supply directed generator edges; names do not determine signs/order')
 fk=FK(n,edges)
 if fk.ng!=ng:raise Invalid('edge/generator count mismatch')
 # Exact canonical relation set equality, not a mere polynomial count.
 canon=lambda p:tuple((a,str(c)) for a,c in sorted(monic(p).items()))
 expected={canon(p) for p in fk.relations()};actual={canon(p) for p in fixture_rows(f)}
 if actual!=expected:raise Invalid('input is not the declared signed FK presentation')
 if checkpoint:
  cp=load(checkpoint);cp=cp.get('payload',cp)
  if cp.get('modulus',0)!=0 or int(cp.get('completedThroughDegree',-1))<through:raise Invalid('checkpoint does not support requested frontier/field')
 binding={'basis':str(Path(basis).resolve()),'basisSHA256':sha(basis),'presentationSHA256':sha(fixture),'field':'Q','order':'degleftlex-last-variable-largest','completedThrough':through,'completionEvidence':'caller-declared frontier; independently run verify-basis or attach the producer proof bundle','n':n,'variables':names,'edges':[list(e) for e in edges]}
 w.mkdir(parents=True,exist_ok=True)
 if (w/'order.json').exists():
  old=load(w/'order.json')
  if old!=binding:raise Invalid('project binding differs: create another work directory')
 atomic(w/'order.json',binding);atomic(w/'generators.json',{'variables':names,'directedEdges':edges,'convention':'x_ji=-x_ij; last declared generator is largest'});atomic(w/'presentation.json',f)
 for d in ['Q14_commutators','Q14_coproduct','kernel','star','star_mod_Q','characters']: (w/d).mkdir(exist_ok=True)
 return binding

class Project:
 def __init__(self,work):
  self.work=Path(work);self.meta=load(self.work/'order.json');self.fk=FK(self.meta['n'],self.meta['edges']);self.ng=self.fk.ng;self.D=self.meta['completedThrough'];self.path=Path(self.meta['basis'])
  if sha(self.path)!=self.meta['basisSHA256']:raise Invalid('ambient basis changed since initialization; refuse stale normal forms/checkpoints')
  self.oracle=NativeOracle(self.path,self.ng,self.D);self.rows=None
 def load_rows(self,degree=None):
  # Caller decides how much input to materialize. No massive normal-word list.
  return list(records(self.path,degree or self.D,self.ng))
 def bind(self):return {'ambientBasisSHA256':self.meta['basisSHA256'],'presentationSHA256':self.meta['presentationSHA256'],'field':'Q','order':self.meta['order'],'declaredCompleteThrough':self.D,'QSourceSHA256':sha(ROOT/'data/Q14-radical-source.json'),'signedEdgeMap':self.meta['edges'],'toolSchema':'kir-proofkit-0.1'}
 def close(self):self.oracle.close()
 def q(self):
  if self.fk.n!=6:raise Invalid('the bundled Q14 is FK6-specific; use an explicit control polynomial for other algebras')
  return source_Q(self.fk)
 def q_export(self,budget=None):
  p=self.q();d=homogeneous(p);atomic(self.work/'Q14.raw.json',{'degree':d,'terms':serial(p),'binding':self.bind(),'source':'saved explicit polynomial, not inferred from dimensions'})
  self.oracle.allow_partial=True
  try:out=self.oracle.nf(p,budget)
  finally:self.oracle.allow_partial=False
  q={'degree':d,'polynomial':serial(out),'canonicalWithinDeclaredOracle':self.D>=d,'nonzero':bool(out),'binding':self.bind(),'normalFormConvention':self.meta['order'],'proofBoundary':'conditional on the supplied ambient GB completion/ideal provenance; no imported dimension used'}
  atomic(self.work/'Q14.normal.json',q)
  names=self.meta['variables'];expr=' + '.join(f'({c})*'+('*'.join(names[a] for a in w) or '1') for w,c in sorted(out.items(),reverse=True)) or '0';(self.work/'Q14.poly').write_text(expr+';\n')
  return {'status':'NORMAL_FORM' if self.D>=d else 'PARTIAL_REDUCTION_NOT_CANONICAL','terms':len(out),**self.bind()}
 def commutator(self,a,budget=None):
  q=self.q();p=add(context(q,right=(a,)),context(q,left=(a,)),-1);self.oracle.allow_partial=True
  try:out=self.oracle.nf(p,budget)
  finally:self.oracle.allow_partial=False
  report={'generator':self.meta['variables'][a],'index':a,'degree':15,'zero':not out,'residual':serial(out),'status':'ZERO_REDUCTION' if not out else 'NONZERO_NORMAL_FORM' if self.D>=15 else 'NONZERO_REMAINDER_INCONCLUSIVE','binding':self.bind(),'meaning':'zero is an explicit reduction using supplied rules; original-ideal provenance of those rules remains required'}
  atomic(self.work/'Q14_commutators'/f'{a:02d}.json',report);return report
 def coproduct(self,k,budget=None):
  b=budget or Budget();q=self.q();degree=homogeneous(q)
  if not 0<k<degree:raise Invalid('proper coproduct split required')
  if max(k,degree-k)>self.D:raise Invalid('coproduct factor exceeds completed oracle bound')
  raw=self.fk.coproduct_slice(q,k,b);red=tensor_normal(raw,self.oracle,b)
  path=self.work/'Q14_coproduct'/f'{k:02d}_{degree-k:02d}.jsonl'
  with path.with_suffix('.tmp').open('w') as f:
   for (u,v),c in sorted(red.items()):f.write(json.dumps({'left':list(u),'right':list(v),'coefficient':str(c)})+'\n')
  os.replace(path.with_suffix('.tmp'),path)
  report={'split':[k,degree-k],'rawTensorTerms':len(raw),'normalTensorTerms':len(red),'zero':not red,'resultSHA256':sha(path),'binding':self.bind(),'status':'CHECKED_SLICE','convention':'Delta(x)=x tensor1+1 tensor x; (u tensor v)(x tensor1)=u(grade(v).x) tensor v'}
  atomic(path.with_suffix('.json'),report);return report
 def verify_basis(self,D,budget=None):
  if D>self.D:raise Invalid('degree above declared frontier')
  b=budget or Budget();rows=self.load_rows(D);a=Avoidance([max(p) for p in rows],self.ng);a.minimal();f=load(self.work/'presentation.json');ni=0;nc=0
  for p in fixture_rows(f):
   if homogeneous(p)<=D:
    if self.oracle.nf(p,b):raise Invalid('original relation has nonzero remainder')
    ni+=1
  for p,parent in criticals(rows,D):
   if self.oracle.nf(p,b):raise Invalid('nonzero critical composition')
   nc+=1
  result={'status':'TRUNCATED_GB_OF_SUPPLIED_GENERATED_IDEAL','throughDegree':D,'inputRelationsChecked':ni,'criticalCompositionsChecked':nc,'normalWordCounts':list(map(str,a.hilbert(D,b))),'originalIdealReverseInclusion':'NOT established by this test; needs rule provenance or separately authenticated dimensions','binding':self.bind()};atomic(self.work/f'ambient-audit-d{D}.json',result);return result
 def star(self,D,budget=None,limit=100000):
  b=budget or Budget();mapping=[self.fk.edge(i,self.fk.n) for i in range(1,self.fk.n)]
  def save(rows,proofs,d,h):export_rows(self.work/'star',rows,d,'exact kernel of subalgebra embedding relative to the supplied faithful ambient NF oracle',{'kind':'ambient linear dependencies, not historical critical pairs','proofs':proofs},reduced=False)
  rows,proof=star_extract(self.oracle,mapping,D,b,limit,save);export_rows(self.work/'star',rows,D,'actual star via injectivity/surjectivity of ambient coordinate map at each checked degree',proof)
  meta=load(self.work/'star/basis-meta.json');meta['actualStarAcceptance']={'method':'exhaustive ambient linear dependencies','throughDegree':D,'ambientOracleBinding':self.bind(),'conditionalOnFaithfulAmbientOracle':True};atomic(self.work/'star/basis-meta.json',meta)
  return {'status':'STAR_EXTRACTED','throughDegree':D,'rules':len(rows),'binding':self.bind(),'canonicalOracleAssumed':True}
 def quotient(self,D,budget=None):
  meta=load(self.work/'star/basis-meta.json')
  if meta['completedThrough']<D or not meta.get('actualStarAcceptance'):raise Invalid('accepted actual star basis through target required; no square-only substitute')
  if sha(self.work/'star/basis.gnb')!=meta['basisSHA256']:raise Invalid('star basis changed since acceptance')
  ng=self.fk.n-1;rows=list(records(self.work/'star/basis.gnb',D,ng));from .producer import qpoly_star;qp=qpoly_star(self)
  if self.fk.n!=6:raise Invalid('default Q is FK6 only; use complete with explicit Q for controls')
  relations=rows+[qp] if D>=14 else rows
  def save(g,h,d,count):export_rows(self.work/'star_mod_Q',g,d,'quotient by explicit Q; bounded reference completion',h,reduced=False)
  out,hist=complete(relations,ng,D,budget,save);export_rows(self.work/'star_mod_Q',out,D,'completed star quotient S/(Q), conditional on authenticated star input',hist)
  return {'status':'QUOTIENT_COMPLETED','degree':D,'rules':len(out),'QUsed':D>=14,'notClaimedEqualToNichols':True}
 def image_kernel(self,d,budget=None,limit=100000,actions=False,fresh=False):
  b=budget or Budget();q=self.q();qd=homogeneous(q);k=d-qd
  if k<0 or d>self.D:raise Invalid('kernel image requires qdeg <= d <= completed ambient degree')
  leaders=[max(x) for x in self.load_rows(k)] if k else []
  words=normal_words(leaders,self.ng,k,limit);E=Echelon(b);basis=[]
  target=self.work/'kernel'/f'K{d}';target.mkdir(parents=True,exist_ok=True)
  path=target/'multiplication_by_Q.jsonl';bind={'binding':self.bind(),'degree':d,'domainWords':[list(w) for w in words]}
  bp=target/'multiplication-binding.json'
  if fresh:path.unlink(missing_ok=True);bp.unlink(missing_ok=True)
  if bp.exists() and load(bp)!=bind:raise Invalid('kernel column cache belongs to a different input/Q/oracle')
  if path.exists() and not bp.exists():raise Invalid('unbound column cache; rerun with --fresh')
  atomic(bp,bind);reused=0
  # Recover a torn final JSONL append; never skip a corrupt interior record.
  valid_bytes=0
  if path.exists():
   with path.open('rb') as scan:
    while True:
     line=scan.readline()
     if not line:break
     try:json.loads(line)
     except ValueError:
      if scan.read(1):raise Invalid('corrupt interior kernel-column record')
      break
     valid_bytes=scan.tell()
   with path.open('r+b') as scan:scan.truncate(valid_bytes)
  path.touch(exist_ok=True)
  with path.open('r') as saved,path.open('a') as f:
   for i,w in enumerate(words):
    line=saved.readline()
    if line:
     old=json.loads(line)
     if old.get('column')!=i or old.get('domainWord')!=list(w):raise Invalid('reordered kernel-column cache')
     p=parse(old['normalForm'],self.ng);reused+=1
     if p and homogeneous(p)!=d:raise Invalid('wrong cached kernel column degree')
    else:
     p=self.oracle.nf(context(q,left=w),b)
     f.write(json.dumps({'column':i,'domainWord':list(w),'normalForm':serial(p),'permutationGrade':list(self.fk.grade(w))})+'\n');f.flush()
     # Do not reread a just-appended column at the next iteration.
     saved.seek(f.tell())
    yes,c=E.append(p)
    if yes:basis.append(p)
  atomic(target/'image_basis.json',{'polynomials':[serial(p) for p in basis]})
  report={'degree':d,'domainDegree':k,'domainDimension':len(words),'matrixRank':len(basis),'multiplicationInjective':len(basis)==len(words),'reusedLocalColumns':reused,'freshReplayCommand':'kernels --fresh --mode image-Q; cached products are not re-reduced from their original source','isEntireNicholsKernel':False,'meaning':'actual computed Q-image subspace; equality with full Nichols kernel requires separate evidence','binding':self.bind()}
  if actions:
   mats=[];invariant=[]
   for s in range(self.fk.n-1):
    sigma=list(range(1,self.fk.n+1));sigma[s],sigma[s+1]=sigma[s+1],sigma[s]
    diff=self.oracle.nf(add(self.fk.perm_poly(q,sigma),q,-1),b);invariant.append(not diff)
    cols=[]
    for w in words:
     mapped=self.fk.perm_poly(context(q,left=w),sigma);v=self.oracle.nf(mapped,b);cols.append([[i,str(c)] for i,c in sorted(E.coordinates(v).items())])
    mats.append(cols)
   source=representation(self.fk,self.oracle,words,b)
   same=len(basis)==len(words) and source['adjacentTranspositionMatrices']==mats
   atomic(target/'S6_action.json',{'imageMatrices':mats,'sourceRepresentation':source,'QInvariantChecks':invariant,'intertwinesExactly':same})
   report['S6IntertwiningChecked']=same
  atomic(target/'summary.json',report);return report
