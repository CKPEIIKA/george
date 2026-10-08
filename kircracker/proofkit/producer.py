"""Original-ideal seed authentication, producer handoff, and exact star acceptance."""
from .core import *
from .project import export_rows
from .fk import FK,source_Q
from .combinatorics import Avoidance
import importlib.util,subprocess,shlex

def star_seed(project,degree,library=None):
 path=Path(library or ROOT/'data/proved-star-library.json');obj=load(path)
 spec=importlib.util.spec_from_file_location('kir_original_library',ROOT/'vendor/star_relations.py');m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
 polys,proof=m.verify(obj)
 if obj['n']!=project.fk.n:raise Invalid('library vertex count differs')
 polys=[clean(p) for p in polys if homogeneous(p)<=degree]
 fixture=fixture_from_polys([f'a{i}' for i in range(1,project.fk.n)],polys)
 atomic(project.work/'star/proved-seed.json',fixture)
 atomic(project.work/'star/seed-provenance.json',{'librarySHA256':sha(path),'field':'Q','verifiedOriginalFKConsequences':True,'verification':proof,'seedIsNotACompletePresentation':True,'embedding':[list(project.fk.edge(i,project.fk.n)) for i in range(1,project.fk.n)],'binding':project.bind()})
 return {'status':'PROVED_SEED_READY','relations':len(polys),'maxRelationDegree':max(map(homogeneous,polys),default=0),'fixture':str(project.work/'star/proved-seed.json'),'completeStarPresentation':False}

def run_producer(project,D,command,seconds=0,jobs=1,memory='24G',quotient=False):
 out=project.work/('star_mod_Q' if quotient else 'star')/'producer';out.mkdir(parents=True,exist_ok=True)
 fixture=project.work/('star_mod_Q/proved-seed.json' if quotient else 'star/proved-seed.json')
 if not fixture.exists():raise Invalid('seed input missing')
 params={'input':str(fixture.resolve()),'out':str(out.resolve()),'degree':str(D),'jobs':str(jobs),'memory':memory,'seconds':str(int(seconds))}
 argv=[s.format(**params) for s in shlex.split(command)]
 if not argv:raise Invalid('empty producer command')
 # argv substitution, no shell execution. A log does not attest completion.
 with (out/'console.log').open('ab') as log:
  try:p=subprocess.run(argv,stdout=log,stderr=subprocess.STDOUT,timeout=seconds+15 if seconds else None,env={**os.environ,'KIR_GENEALOGY':str((out/'critical-pair-events.jsonl').resolve())});code=p.returncode
  except subprocess.TimeoutExpired:code=124
 report={'argv':argv,'returncode':code,'status':'PRODUCER_RETURNED' if code==0 else 'INCOMPLETE_OR_ERROR','mathematicalAcceptanceStillRequired':True,'genealogyRequested':True,'genealogyPresent':(out/'critical-pair-events.jsonl').exists(),'inputSHA256':sha(fixture),'binding':project.bind()};atomic(out/'run.json',report);return report

def qpoly_star(project):
 q=project.q();rev={project.fk.edge(i,project.fk.n)[0]:(i-1,project.fk.edge(i,project.fk.n)[1]) for i in range(1,project.fk.n)}
 out={}
 for w,c in q.items():
  v=[]
  for a in w:
   if a not in rev:raise Invalid('Q is not in the requested star')
   i,s=rev[a];v.append(i);c*=s
  out[tuple(v)]=c
 return out

def quotient_seed(project,D):
 meta=load(project.work/'star/basis-meta.json')
 if meta['completedThrough']<D:raise Invalid('certified actual star through target required')
 if not meta.get('actualStarAcceptance'):raise Invalid('star basis has not passed actual-algebra acceptance')
 if sha(project.work/'star/basis.gnb')!=meta['basisSHA256']:raise Invalid('star basis changed since acceptance')
 ng=project.fk.n-1;rows=list(records(project.work/'star/basis.gnb',D,ng));rows.append(qpoly_star(project))
 f=fixture_from_polys([f'a{i}' for i in range(1,ng+1)],[p for p in rows if homogeneous(p)<=D])
 atomic(project.work/'star_mod_Q/proved-seed.json',f);return {'status':'ACTUAL_STAR_QUOTIENT_INPUT','relations':len(f['relations']),'notNicholsEquality':True}

def poly_product(a,b,D):
 out=[0]*(D+1)
 for i,c in enumerate(a):
  for j,d in enumerate(b):
   if i+j<=D:out[i+j]+=c*d
 return out

def finite_fk_hilbert(n,D):
 factors={2:[(2,1)],3:[(2,2),(3,1)],4:[(2,2),(3,2),(4,2)],5:[(4,4),(5,2),(6,4)]}
 if n not in factors:raise Invalid('finite factor known only for n=2..5')
 h=[1]+[0]*D
 for k,p in factors[n]:
  for _ in range(p):h=poly_product(h,[1]*k,D)
 return h

def accept_star(project,path,D,budget=None,canonical=True):
 """Membership + dimension sandwich uses actual ambient GB counts, not targets.
 Proof depends on the supplied ambient oracle being faithful through D.
 """
 if D>project.D:raise Invalid('cannot accept star beyond complete ambient degree')
 b=budget or Budget();ng=project.fk.n-1;path=Path(path);rows=list(records(path,D,ng));a=Avoidance([max(p) for p in rows],ng);a.minimal();mapping=[project.fk.edge(i,project.fk.n) for i in range(1,project.fk.n)]
 for r in rows:
  image={}
  for w,c in r.items():
   v=[]
   for x in w:i,s=mapping[x];v.append(i);c*=s
   image[tuple(v)]=c
  if project.oracle.nf(image,b):raise Invalid('a purported star relation is nonzero in the ambient oracle')
 full=Avoidance([x['leadingWord'] for x in leader_records(project.path,D,project.ng)],project.ng).hilbert(D,b)
 hsmall=finite_fk_hilbert(project.fk.n-1,D);target=[]
 for d in range(D+1):target.append(full[d]-sum(hsmall[j]*target[d-j] for j in range(1,min(len(hsmall),d+1))))
 observed=a.hilbert(D,b)
 if observed!=target:
  atomic(project.work/'star/acceptance-incomplete.json',{'status':'MISSING_STAR_RELATIONS_OR_BAD_ORACLE','upper':list(map(str,observed)),'actualFromAmbientFactorization':list(map(str,target)),'binding':project.bind()})
  raise Incomplete('star library/basis has not reached the actual star dimension')
 if canonical:
  oracle=NativeOracle(path,ng,D)
  try:rows=[monic(oracle.nf(r,b,skip=i)) for i,r in enumerate(rows)]
  finally:oracle.close()
 export_rows(project.work/'star',rows,D,'original membership and exact dimension sandwich against ambient factorization',reduced=canonical)
 meta=load(project.work/'star/basis-meta.json');meta['actualStarAcceptance']={'relationMembership':True,'dimensionsMatchAmbient':True,'ambientOracleBinding':project.bind(),'knownFiniteFactor':'BLM complement E_(n-1)','throughDegree':D,'originalCompletionIsConditionalOnAmbientOracle':True};atomic(project.work/'star/basis-meta.json',meta)
 atomic(project.work/'star/hilbert.json',{'observed':list(map(str,observed)),'targetFromAmbient':list(map(str,target))})
 return {'status':'ACTUAL_STAR_ACCEPTED','degree':D,'rules':len(rows),'membershipChecks':len(rows),'canonical':canonical,'binding':project.bind()}

def quotient_ideal(oracle,leaders,ng,Q,D,budget=None,limit=100000):
 """Actual degree-wise two-sided ideal (Q) inside a faithful star oracle.
 Only normal words of degrees <= D-degQ are enumerated, not S_D.
 No centrality/regularity/known dimension or Nichols hypothesis is used.
 """
 b=budget or Budget();qdegree=homogeneous(Q)
 if qdegree<1:raise Invalid('nonzero positive-degree Q required')
 normals={0:[()]};spaces={};columns={}
 for k in range(1,max(0,D-qdegree)+1):normals[k]=normal_words(leaders,ng,k,limit)
 for d in range(qdegree,D+1):
  k=d-qdegree;E=Echelon(b);bs=[];cols=[];count=0
  for a in range(k+1):
   for u in normals[a]:
    for v in normals[k-a]:
     count+=1;b.check(count)
     if count>limit:raise Incomplete('Q-context enumeration cap; no quotient dimension accepted')
     image=oracle.nf(context(Q,u,v),b);ind,c=E.append(image)
     if ind:bs.append(image)
     cols.append({'left':list(u),'right':list(v),'coordinates':[[i,str(c)] for i,c in sorted(E.coordinates(image).items())]})
  spaces[d]=(E,bs);columns[d]=cols
 return spaces,columns

def accept_quotient(project,path,D,budget=None,limit=100000,qpath=None,canonical=True):
 """Check actual S/(Q) against candidate leaders via explicit ideal coordinates.
 This is not a Nichols comparison and does not assume a polynomial factor.
 """
 b=budget or Budget();meta=load(project.work/'star/basis-meta.json');spath=project.work/'star/basis.gnb';ng=project.fk.n-1
 if meta['completedThrough']<D or not meta.get('actualStarAcceptance') or sha(spath)!=meta['basisSHA256']:raise Invalid('a frozen accepted actual-star basis through the requested degree is required')
 if sha(path)==sha(spath) and D>=14:pass # Not a proof failure; the dimension/membership tests decide.
 Q=parse(load(qpath),ng) if qpath else qpoly_star(project)
 srows=list(records(spath,D,ng));trows=list(records(path,D,ng));SA=Avoidance([max(r) for r in srows],ng);TA=Avoidance([max(r) for r in trows],ng);SA.minimal();TA.minimal()
 so=NativeOracle(spath,ng,D);to=NativeOracle(path,ng,D)
 try:
  spaces,columns=quotient_ideal(so,SA.leaders,ng,Q,D,b,limit)
  # Each proposed T-relation has an explicitly computed coordinate expression in (Q) modulo S.
  membership=[]
  for i,g in enumerate(trows):
   rem=so.nf(g,b);d=homogeneous(g)
   if d not in spaces:
    if rem:raise Invalid('candidate contains an extra relation below deg Q')
    c={}
   else:c=spaces[d][0].coordinates(rem)
   membership.append({'ruleId':i,'degree':d,'idealBasisCoordinates':[[j,str(c)] for j,c in sorted(c.items())]})
  # Reverse inclusion: generators of the true quotient ideal reduce to zero.
  for g in srows+([Q] if homogeneous(Q)<=D else []):
   if to.nf(g,b):raise Invalid('candidate does not contain the required star/Q input relations')
  hs=SA.hilbert(D,b);ht=TA.hilbert(D,b);target=[hs[d]-(spaces[d][0].n if d in spaces else 0) for d in range(D+1)]
  if ht!=target:raise Incomplete('candidate quotient GB has not reached exact quotient dimensions')
  if canonical:trows=[monic(to.nf(g,b,skip=i)) for i,g in enumerate(trows)]
 finally:so.close();to.close()
 out=project.work/'star_mod_Q';export_rows(out,trows,D,'actual S/(Q) via explicit two-sided ideal spans and exact normal-word counts',reduced=canonical)
 atomic(out/'Q.json',{'polynomial':serial(Q)})
 for d,(E,bs) in spaces.items():atomic(out/f'Q-ideal-degree{d}.json',{'degree':d,'polynomials':[serial(p) for p in bs],'allContextColumns':columns[d],'rank':E.n,'spansEntireTwoSidedIdealComponentInStar':True,'notANicholsKernelClaim':True})
 report={'status':'ACTUAL_STAR_QUOTIENT_ACCEPTED','throughDegree':D,'rules':len(trows),'relationMembership':membership,'starHilbert':list(map(str,hs)),'quotientHilbert':list(map(str,ht)),'twoSidedIdealRanks':{str(d):E.n for d,(E,bs) in spaces.items()},'usesNoRegularityOrCentralityAssumption':True,'notClaimedEqualToNichols':True,'binding':project.bind()};atomic(out/'quotient-acceptance.json',report);return {k:v for k,v in report.items() if k!='relationMembership'}
