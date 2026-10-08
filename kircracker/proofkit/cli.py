#!/usr/bin/env python3
"""kircracker proof: exact structural data, with explicit certificate boundaries."""
from .core import *
from .fk import *
from .project import *
from .producer import *
from .combinatorics import *
from .completion import *
import argparse,time,os,sys,concurrent.futures,multiprocessing

def options(p,work=True):
 if work:p.add_argument('-C','--workdir',type=Path,default=Path('fk6-proof-data'))
 p.add_argument('--seconds',type=float,default=600,help='budget per job; 0 unlimited')
 p.add_argument('--max-terms',type=int,default=1000000)
 p.add_argument('--memory-mib',type=int,default=0,help='POSIX process virtual-memory guard; 0 no additional guard')

def parser():
 p=argparse.ArgumentParser(prog='kircracker proof',description=__doc__);p.add_argument('--version',action='version',version='kircracker-proofkit 0.1.0');s=p.add_subparsers(dest='cmd',required=True)
 a=s.add_parser('init',help='bind a frozen ambient GNB basis, exact FK input, order and declared degree');options(a);a.add_argument('--basis',type=Path,required=True);a.add_argument('--fixture',type=Path,default=ROOT/'data/fk6-george.json');a.add_argument('--through',type=int,required=True);a.add_argument('--n',type=int,default=6);a.add_argument('--edges',type=Path);a.add_argument('--checkpoint',type=Path)
 a=s.add_parser('status');options(a)
 a=s.add_parser('verify-basis',help='independent reductions/compositions; not reverse ideal provenance');options(a);a.add_argument('--degree',type=int,required=True)
 a=s.add_parser('q',help='export raw Q and its current normal form');options(a)
 a=s.add_parser('commutators',help='exact NF of each Q*x-x*Q');options(a);a.add_argument('-j','--jobs',type=int,default=1);a.add_argument('--generators',type=int,nargs='*');a.add_argument('--force',action='store_true')
 a=s.add_parser('coproduct',help='direct braided coproduct in every proper bidegree');options(a);a.add_argument('-j','--jobs',type=int,default=1);a.add_argument('--slices',type=int,nargs='*',default=list(range(1,14)));a.add_argument('--force',action='store_true')
 a=s.add_parser('star',help='true ambient-coordinate kernel extraction; finite candidate budget');options(a);a.add_argument('--degree',type=int,required=True);a.add_argument('--max-candidates',type=int,default=100000)
 a=s.add_parser('star-seed',help='authenticate inherited relations from original quadratics');options(a);a.add_argument('--degree',type=int,default=17);a.add_argument('--library',type=Path)
 a=s.add_parser('produce',help='invoke an explicit external exact producer, not silently certify its output');options(a);a.add_argument('--degree',type=int,default=17);a.add_argument('--command',required=True,help='argv template {input} {out} {degree} {jobs} {memory} {seconds}; no shell');a.add_argument('-j','--jobs',type=int,default=6);a.add_argument('--producer-memory',default='24G');a.add_argument('--quotient',action='store_true')
 a=s.add_parser('star-accept',help='check every relation in the actual ambient oracle + dimension sandwich');options(a);a.add_argument('--degree',type=int,default=17);a.add_argument('--basis',type=Path,required=True);a.add_argument('--no-canonical',action='store_true')
 a=s.add_parser('quotient-seed',help='prepare actual S/(Q), never assume equality to Nichols');options(a);a.add_argument('--degree',type=int,default=17)
 a=s.add_parser('quotient',help='reference completion for small S/(Q); large runs use produce');options(a);a.add_argument('--degree',type=int,required=True)
 a=s.add_parser('quotient-accept',help='exact S/(Q) by explicit uQv subspaces, no regularity assumption');options(a);a.add_argument('--degree',type=int,default=17);a.add_argument('--basis',type=Path,required=True);a.add_argument('--q',type=Path);a.add_argument('--max-contexts',type=int,default=100000);a.add_argument('--no-canonical',action='store_true')
 a=s.add_parser('anick',help='chain counts by homological/internal degree, exact Euler check');options(a);a.add_argument('--basis',type=Path,required=True);a.add_argument('--generators',type=int,default=5);a.add_argument('--degree',type=int,default=17);a.add_argument('--out',type=Path,required=True)
 a=s.add_parser('orbits',help='descriptive LM or exact projective polynomial orbits, not an invariant GB');options(a);a.add_argument('--polynomials',action='store_true');a.add_argument('--basis',type=Path,required=True);a.add_argument('--generators',type=int,default=5);a.add_argument('--degree',type=int,default=17);a.add_argument('--out',type=Path,required=True)
 a=s.add_parser('characters',help='actual matrices and characters of a bounded ambient degree');options(a);a.add_argument('--degree',type=int,required=True);a.add_argument('--max-words',type=int,default=10000)
 a=s.add_parser('kernels',help='explicit Q-image, or complete pairing kernel only when enumeration fits');options(a);a.add_argument('--degree',type=int,nargs='+',default=[14,15,16,17]);a.add_argument('--mode',choices=['image-Q','full-pairing'],default='image-Q');a.add_argument('--max-words',type=int,default=100000);a.add_argument('--characters',action='store_true');a.add_argument('--fresh',action='store_true',help='discard reusable product columns and recompute them')
 a=s.add_parser('compare-kernel',help='compare two explicitly supplied polynomial subspace bases');options(a);a.add_argument('--left',type=Path,required=True);a.add_argument('--right',type=Path,required=True);a.add_argument('--out',type=Path,required=True)
 a=s.add_parser('genealogy',help='join actual producer events to frozen basis; no fabricated parents');options(a);a.add_argument('--basis',type=Path,required=True);a.add_argument('--log',type=Path,required=True);a.add_argument('--degree-from',type=int,default=12);a.add_argument('--degree',type=int,default=17);a.add_argument('--generators',type=int,default=5);a.add_argument('--out',type=Path,required=True)
 a=s.add_parser('reference-complete',help='small exact controls with full relation/overlap provenance');options(a,False);a.add_argument('--fixture',type=Path,required=True);a.add_argument('--degree',type=int,required=True);a.add_argument('--out',type=Path,required=True)
 return p

_WORK=None

def _init_worker(work):
 global _WORK;_WORK=Project(work)
def _worker(task):
 cmd,index,seconds,terms=task;b=Budget(seconds,terms)
 try:
  out=_WORK.commutator(index,b) if cmd=='commutators' else _WORK.coproduct(index,b)
  return {'task':index,'status':'DONE','result':out}
 except (Incomplete,Invalid) as e:return {'task':index,'status':'INCOMPLETE' if isinstance(e,Incomplete) else 'ERROR','error':str(e)}

def batch(a):
 if a.jobs<1 or a.jobs>64:raise Invalid('worker count must be 1..64')
 m=load(a.workdir/'order.json');
 if sha(m['basis'])!=m['basisSHA256']:raise Invalid('ambient basis changed; refuse stale cached proof results')
 fullbinding={'ambientBasisSHA256':m['basisSHA256'],'presentationSHA256':m['presentationSHA256'],'field':'Q','order':m['order'],'declaredCompleteThrough':m['completedThrough'],'QSourceSHA256':sha(ROOT/'data/Q14-radical-source.json'),'signedEdgeMap':m['edges'],'toolSchema':'kir-proofkit-0.1'}
 n=len(m['variables']);indices=(list(range(n)) if a.generators is None else a.generators) if a.cmd=='commutators' else a.slices
 if not indices or len(indices)!=len(set(indices)):raise Invalid('select a nonempty set of distinct tasks')
 if a.cmd=='coproduct' and any(x<1 or x>13 for x in indices):raise Invalid('proper Q14 slices are 1..13')
 if any(x<0 or x>=n for x in indices) and a.cmd=='commutators':raise Invalid('generator outside range')
 tasks=[];results=[];directory=a.workdir/('Q14_commutators' if a.cmd=='commutators' else 'Q14_coproduct')
 for i in indices:
  file=directory/(f'{i:02d}.json' if a.cmd=='commutators' else f'{i:02d}_{14-i:02d}.json')
  if file.exists() and not a.force:
   r=load(file)
   payload=file.with_suffix('.jsonl');intact=a.cmd!='coproduct' or payload.exists() and sha(payload)==r.get('resultSHA256')
   if intact and r.get('binding')==fullbinding:results.append({'task':i,'status':'REUSED','result':r});continue
  tasks.append((a.cmd,i,a.seconds,a.max_terms))
 if a.jobs==1:
  _init_worker(a.workdir)
  try:
   for t in tasks:
    r=_worker(t);results.append(r);print(json.dumps({'task':r['task'],'status':r['status']}),file=sys.stderr,flush=True)
  finally:_WORK.close()
 else:
  with concurrent.futures.ProcessPoolExecutor(max_workers=a.jobs,initializer=_init_worker,initargs=(a.workdir,),mp_context=multiprocessing.get_context('spawn')) as pool:
   for r in pool.map(_worker,tasks):results.append(r);print(json.dumps({'task':r['task'],'status':r['status']}),file=sys.stderr,flush=True)
 passed=all(r['status'] in ['DONE','REUSED'] and r['result'].get('zero') for r in results)
 report={'status':'ALL_ZERO' if passed else 'INCOMPLETE_OR_NONZERO','jobs':results,'binding':fullbinding,'requestedIndices':indices,'allGeneratorsOrProperSlicesRequested':set(indices)==set(range(n) if a.cmd=='commutators' else range(1,14)),'originalIdealProvenanceDependency':True}
 atomic(directory/'summary.json',report);return report

def genealogy(log,basis,ng,start,D,out):
 indexed={r['id']+1:r for r in leader_records(basis,D,ng)};events={};unmatched=[]
 for line in Path(log).read_text().splitlines():
  e=json.loads(line)
  if e.get('event')!='rule':continue
  i=e['id'];r=indexed.get(i)
  if not r:continue
  if list(r['leadingWord'])!=e['leadingWord'] or r['terms']!=e['terms'] or str(r['checksum'])!=str(e.get('recordChecksum')):
   unmatched.append({'id':i,'reason':'abandoned/replaced producer row or changed record; not attributed'});continue
  if e.get('kind')=='overlap':
   f=indexed.get(e['leftRule']);g=indexed.get(e['rightRule']);k=e['overlapLength']
   if not f or not g or not 0<k<min(f['degree'],g['degree']) or tuple(f['leadingWord'][-k:])!=tuple(g['leadingWord'][:k]):raise Invalid('invalid recorded overlap')
   if f['degree']+g['degree']-k!=r['degree']:raise Invalid('overlap degree mismatch')
   e['overlapPosition']=f['degree']-k
   renaming={};words=[]
   for w in [f['leadingWord'],g['leadingWord'],r['leadingWord']]:words.append([renaming.setdefault(x,len(renaming)) for x in w])
   e['jointAlphabetRenamingMotif']={'parentLeft':words[0],'parentRight':words[1],'child':words[2],'overlapLength':k,'mathematicalGroup':'S5 on star letters only; otherwise descriptive alphabet renaming'}
  # A resumed-prefix marker must not overwrite an earlier true provenance event.
  if i not in events or e['kind']!='restored':events[i]=e
 selected=[];groups=defaultdict(list)
 for i,r in indexed.items():
  if r['degree']<start:continue
  e=events.get(i,{'id':i,'kind':'unavailable-from-saved-basis','degree':r['degree']});selected.append(e)
  groups[(r['degree'],rename_orbit_word(tuple(r['leadingWord'])))].append(i)
 result={'source':'recorded producer append events, not inferred history','events':selected,'unmatchedEvents':unmatched,'missingHistory':[x['id'] for x in selected if x['kind'] in ['restored','unavailable-from-saved-basis']],'basisSHA256':sha(basis),'logSHA256':sha(log),'degreeRange':[start,D],'orbitBuckets':[{'degree':d,'wordPattern':list(w),'ids':ids} for (d,w),ids in sorted(groups.items())],'orbitBucketsAreNotEquivariantGraphQuotient':True,'reductionDerivationsNotContained':True}
 atomic(out,result);return {'status':'GENEALOGY_EXPORTED','rules':len(selected),'missingHistory':len(result['missingHistory'])}

def entry(argv=None):
 a=parser().parse_args(argv);start=time.monotonic()
 if a.memory_mib:
  import resource
  cap=a.memory_mib*(1<<20);resource.setrlimit(resource.RLIMIT_AS,(cap,cap))
 project=None
 try:
  if not __import__("math").isfinite(a.seconds) or a.seconds<0 or a.max_terms<1:raise Invalid('nonnegative seconds and positive term cap required')
  if hasattr(a,'degree') and isinstance(a.degree,int) and a.degree<0:raise Invalid('nonnegative degree required')
  b=Budget(a.seconds,a.max_terms)
  if a.cmd=='init':r=init_project(a.workdir,a.basis,a.fixture,a.through,load(a.edges) if a.edges else None,a.n,a.checkpoint)
  elif a.cmd=='status':r={'binding':load(a.workdir/'order.json'),'products':[str(p.relative_to(a.workdir)) for p in a.workdir.rglob('*.json')],'note':'Existing result files include explicit incomplete/conditional statuses; presence alone is not proof.'}
  elif a.cmd in ['commutators','coproduct']:r=batch(a)
  elif a.cmd in ['anick','orbits']:
   ls=[x['leadingWord'] for x in leader_records(a.basis,a.degree,a.generators)]
   r=anick(ls,a.generators,a.degree,b) if a.cmd=='anick' else polynomial_orbits(records(a.basis,a.degree,a.generators),a.generators,b) if a.polynomials else orbit_summary([{w:F(1)} for w in ls],a.generators)
   r['basisSHA256']=sha(a.basis);r['algebraConclusionRequiresCompleteGroebnerBasis']=True;r['givenLeaderSetIsNotIndependentlyCertified']=True;atomic(a.out,r)
   r={k:v for k,v in r.items() if k not in ['counts','graph','groups']}
  elif a.cmd=='genealogy':r=genealogy(a.log,a.basis,a.generators,a.degree_from,a.degree,a.out)
  elif a.cmd=='reference-complete':
   f=load(a.fixture);ps=fixture_rows(f)
   def checkpoint(rows,hist,d,n):export_rows(a.out,rows,d,'reference completion checkpoint; earlier tails not necessarily fully reduced',{'births':hist,'historical':True},reduced=False)
   rows,h=complete(ps,len(f['variables']),a.degree,b,checkpoint);export_rows(a.out,rows,a.degree,'reference completion with full replayable birth/reduction provenance',h);r=verify_genealogy(ps,rows,h,b);atomic(a.out/'genealogy-check.json',r)
  elif a.cmd=='compare-kernel':
   p=load(a.left);q=load(a.right);left=[parse(x) for x in p.get('polynomials',p.get('basis'))];right=[parse(x) for x in q.get('polynomials',q.get('basis'))];A=Echelon();B=Echelon()
   for x in left:A.append(x)
   for x in right:B.append(x)
   maps={'leftInRight':[[[i,str(c)] for i,c in B.coordinates(x).items()] for x in left],'rightInLeft':[[[i,str(c)] for i,c in A.coordinates(x).items()] for x in right]};r={'exactSubspacesEqual':True,'leftRank':A.n,'rightRank':B.n,'coordinates':maps,'notProofEitherIsFullNicholsKernel':True};atomic(a.out,r)
  else:
   project=Project(a.workdir)
   if a.cmd=='q':r=project.q_export(b)
   elif a.cmd=='verify-basis':r=project.verify_basis(a.degree,b)
   elif a.cmd=='star':r=project.star(a.degree,b,a.max_candidates)
   elif a.cmd=='star-seed':r=star_seed(project,a.degree,a.library)
   elif a.cmd=='produce':r=run_producer(project,a.degree,a.command,a.seconds,a.jobs,a.producer_memory,a.quotient)
   elif a.cmd=='star-accept':r=accept_star(project,a.basis,a.degree,b,not a.no_canonical)
   elif a.cmd=='quotient-seed':r=quotient_seed(project,a.degree)
   elif a.cmd=='quotient':r=project.quotient(a.degree,b)
   elif a.cmd=='quotient-accept':r=accept_quotient(project,a.basis,a.degree,b,a.max_contexts,a.q,not a.no_canonical)
   elif a.cmd=='characters':
    if a.degree>project.D:raise Invalid('character degree exceeds oracle')
    ls=[x['leadingWord'] for x in leader_records(project.path,a.degree,project.ng)];words=normal_words(ls,project.ng,a.degree,a.max_words);r=representation(project.fk,project.oracle,words,b);atomic(a.workdir/'characters'/f'E{a.degree}.json',r);r={k:v for k,v in r.items() if k not in ['basis','adjacentTranspositionMatrices']}
   elif a.cmd=='kernels':
    r=[]
    for d in a.degree:
     if a.mode=='image-Q':r.append(project.image_kernel(d,b,a.max_words,a.characters,a.fresh))
     else:
      # Count first, to refuse infeasible ambient spaces without enumerating them.
      ls=[x['leadingWord'] for x in leader_records(project.path,d,project.ng)];h=Avoidance(ls,project.ng).hilbert(d,b)[-1]
      if h>a.max_words:raise Incomplete(f'full kernel needs {h} ambient columns > cap {a.max_words}; use image-Q mode (does not claim full equality)')
      project.oracle.leaders=ls;out=full_radical(project.fk,project.oracle,d,a.max_words,b);atomic(a.workdir/'kernel'/f'full-K{d}.json',out);r.append({k:v for k,v in out.items() if k!='basis'})
  print(json.dumps({'command':a.cmd,'elapsedSeconds':time.monotonic()-start,'result':r},indent=2))
  if a.cmd in ['commutators','coproduct'] and r['status']!='ALL_ZERO':
   if any(x['status']=='ERROR' for x in r['jobs']):return 2
   if any(x['status']=='INCOMPLETE' or 'INCONCLUSIVE' in x.get('result',{}).get('status','') for x in r['jobs']):return 77
   return 1
  if a.cmd=='produce' and r['returncode']!=0:return 77 if r['returncode']==124 else 2
  return 0
 except (Incomplete,MemoryError,KeyboardInterrupt) as e:
  report={'status':'INCOMPLETE','command':a.cmd,'error':str(e),'elapsedSeconds':time.monotonic()-start}
  if hasattr(a,'workdir') and a.workdir.exists():atomic(a.workdir/f'incomplete-{a.cmd}.json',report)
  print(json.dumps(report),file=sys.stderr);return 77
 except (Invalid,ValueError,KeyError,OSError,AssertionError) as e:
  print(json.dumps({'status':'ERROR','command':a.cmd,'error':str(e)}),file=sys.stderr);return 2
 finally:
  if project:project.close()
if __name__=='__main__':sys.exit(entry())
