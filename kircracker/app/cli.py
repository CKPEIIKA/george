#!/usr/bin/env python3
"""Unix interface for the FK6 certificate frontier. No browser or direct GB solver."""
from __future__ import annotations
import argparse,contextlib,json,math,os,platform,shutil,signal,subprocess,sys,time
from pathlib import Path
from . import __version__
from .util import ROOT,Runner,Invalid,Incomplete,Stopped,load,sha,json_hash,atomic_json,bytes_arg,hardware,resolve_resources,workspace_lock

def common(p):
 p.add_argument('-C','--workdir',type=Path,default=Path('kircracker-work'),help='persistent calculation directory (default: ./kircracker-work)')
 p.add_argument('-j','--jobs',default='auto',help='maximum CPU workers; auto respects affinity/cgroup limits')
 p.add_argument('-m','--memory',type=bytes_arg,default=0,metavar='24GiB',help='total stage memory budget; auto leaves OS headroom')
 p.add_argument('--quiet',action='store_true');p.add_argument('--json-events',action='store_true',help='NDJSON progress to stderr; final JSON remains stdout')

def parser():
 p=argparse.ArgumentParser(prog='kircracker',description='Native FK6/B6 certificate and structural research CLI through degree 22; support-resolved homology/Anick tools included. This does not construct the original-order Groebner basis.')
 p.add_argument('--version',action='version',version=f'kircracker-cli {__version__}')
 s=p.add_subparsers(dest='command',required=True)
 d=s.add_parser('doctor',help='detect CPU/RAM limits, toolchain and package capabilities');common(d)
 b=s.add_parser('build',help='build C++ kernels locally; --native optimizes for this CPU');b.add_argument('--native',action='store_true');b.add_argument('-j','--jobs',type=int,default=2)
 d=s.add_parser('plan',help='show stages, resource budgets and what can be resumed');common(d);d.add_argument('degree',type=int,choices=range(1,23),metavar='DEGREE')
 for cmd in ['run','upper','search','verify']:
  d=s.add_parser(cmd,help={'run':'run/restart the entire bound-and-proof pipeline','upper':'only original/Nichols upper calculations; no exact-dimension claim','search':'discover and independently verify new lower minors','verify':'replay witnesses and inherited Q proof; reassemble without searching'}[cmd]);common(d);d.add_argument('degree',type=int,metavar='DEGREE')
  d.add_argument('--upper-seconds',type=float,default=0,help='time limit per native upper process; 0 is unlimited')
  d.add_argument('--block-seconds',type=float,default=0,help='discovery limit per minor block; 0 is unlimited')
  d.add_argument('--dual-mode',choices=['auto','prepend','both'],default='auto',help='candidate family; auto tries prepend then broadens only if needed')
  d.add_argument('--skip-base-replay',action='store_true',help='diagnostic only: no Q correction or exact FK gate export above degree 13')
  d.add_argument('--force-replay',action='store_true',help='recheck numerical witnesses and Q base instead of reusing local audits')
  if cmd=='search':d.add_argument('--grade',help='one representative grade, e.g. 123465; commits only that verified block')
  if cmd=='upper':d.add_argument('--namespace',choices=['both','FK-original','NICHOLS-only'],default='both')
 d=s.add_parser('status',help='read progress without taking the calculation lock');d.add_argument('-C','--workdir',type=Path,default=Path('kircracker-work'));d.add_argument('--watch',action='store_true');d.add_argument('--json',action='store_true')
 d=s.add_parser('export',help='export exact component profile; refuses unresolved or unverified data');common(d);d.add_argument('degree',type=int);d.add_argument('-o','--out',type=Path,required=True)
 d=s.add_parser('support',help='support-resolved star/T Anick analysis for 1..5 leaves')
 d.add_argument('size',type=int,choices=range(1,6),metavar='K');d.add_argument('--degree',type=int,default=8);d.add_argument('--seconds',type=float,default=0);d.add_argument('--max-terms',type=int,default=5000000);d.add_argument('-o','--out',type=Path)
 d=s.add_parser('support-formula',help='print the proved all-degree support <=2 formulas and residual target')
 d=s.add_parser('degree8-homology',help='report/check the completed degree-8 differential ranks and Betti numbers')
 d.add_argument('-o','--out',type=Path)
 d=s.add_parser('nichols',help='study the transposition Nichols algebra B6 independently of original FK6')
 common(d);d.add_argument('action',choices=['run','upper','search','verify','export']);d.add_argument('degree',type=int);d.add_argument('--upper-seconds',type=float,default=0);d.add_argument('--block-seconds',type=float,default=0);d.add_argument('--dual-mode',choices=['auto','prepend','both'],default='auto');d.add_argument('--force-replay',action='store_true');d.add_argument('--grade');d.add_argument('-o','--out',type=Path)
 d=s.add_parser('check',help='run package tests (including actual native resume and exact verifier)');d.add_argument('--quick',action='store_true',help='omit longer integration checks');
 return p

def ready():
 required=['bin/kir-relative','bin/libverify.so','bin/libtriepair.so','bin/libconvolve.so']
 missing=[x for x in required if not (ROOT/x).is_file()]
 if missing:raise Incomplete('missing native kernels; run make native (or ./kircracker build --native)')

def bind_workspace(work):
 # This mathematical identity excludes worker count, memory budget, requested
 # degree and CPU code generation; those may safely change on continuation.
 token=json_hash({'programSemantics':'fk6-certificate-cli-v1','base':sha(ROOT/'data/base-through13.json'),'Q':sha(ROOT/'data/degree14-radical.json'),'proofArchive':sha(ROOT/'proof/frontier-0.5.0.zip')})
 path=work/'workspace.json'
 if path.exists() and load(path).get('binding')!=token:raise Invalid('workspace belongs to different mathematical inputs; use a new directory')
 atomic_json(path,{'format':'kircracker-workspace-v1','binding':token,'version':__version__,'createdOrOpenedUTC':time.strftime('%Y-%m-%dT%H:%M:%SZ',time.gmtime())})

def run_degree(runner,a,D):
 from .upper import run_upper
 from .lower import lower_prefix,discover,discover_auto,replay_catalog,seed_catalog
 from .assembly import proof_base,assemble
 if a.command=='upper':
  namespaces=['FK-original','NICHOLS-only'] if a.namespace=='both' else [a.namespace]
  return {'status':'UPPER_ONLY','degree':D,'upper':{n:run_upper(runner,D,n,a.upper_seconds) for n in namespaces}}
 if a.command=='search':
  run_upper(runner,D,'NICHOLS-only',a.upper_seconds)
  result=discover_auto(runner,D,a.block_seconds,only=a.grade) if a.dual_mode=='auto' else discover(runner,D,a.dual_mode,a.block_seconds,only=a.grade)
  return {'status':'LOWER_BOUND_ONLY','degree':D,'result':result,'originalFKExactDimension':False}
 # The same native state files are reused at higher target degrees. No action
 # arrays are materialized as Python/JSON objects.
 n=run_upper(runner,D,'NICHOLS-only',a.upper_seconds);e=run_upper(runner,D,'FK-original',a.upper_seconds)
 baseD=min(D,18)
 lower=lower_prefix(runner,baseD,force=a.force_replay or a.command=='verify')
 if D>18:
  for d in range(19,D+1):
   if a.command=='verify':lower.append(replay_catalog(runner,seed_catalog(runner.work,d),force=True))
   else:
    if d<D:
     # Candidate builders bind to the existing degree-d upper state, even when
     # the upper process has already continued to a later target degree.
     pass
    lower.append(discover_auto(runner,d,a.block_seconds) if a.dual_mode=='auto' else discover(runner,d,a.dual_mode,a.block_seconds))
 q=False
 if D>=14 and not a.skip_base_replay:proof_base(runner,force=a.force_replay or a.command=='verify');q=True
 # D<14 uses no nonzero-Q or high-degree quotient theorem assumption.
 report=assemble(runner,D,lower,n,e,withQ=q)
 return report

def exported(runner,a):
 from .upper import run_upper
 from .lower import lower_prefix
 from .assembly import proof_base,assemble
 D=a.degree
 if not 1<=D<=22:raise Invalid('export degree must be 1..22')
 # Rebind source files and accepted audits; do not copy a caller-edited number.
 n=run_upper(runner,D,'NICHOLS-only');e=run_upper(runner,D,'FK-original');l=lower_prefix(runner,D)
 if D>=14:proof_base(runner)
 result=assemble(runner,D,l,n,e,withQ=D>=14)
 if result['exactThroughDegree']<D:raise Incomplete('unresolved components: only bounds are available; no exact gate profile emitted')
 profile={'claim':'FK6_GRADED_DIMENSIONS_IN_PROJECT_PROOF_CHAIN','field':'Q','throughDegree':D,'classes':result['classes'],'classSizes':result['classSizes'],'dimensions':[x['originalUpper'] for x in result['degrees']],'dimensionsPerClass':[x['upperPerPermutation'] for x in result['degrees']],'perClassMeaning':'dimension of ONE permutation-grade component','certificateRunSHA256':sha(runner.work/'results'/f'degree-{D:02d}.json'),'proofStatus':'computational verification plus inherited unreviewed structural arguments; see bundled docs','externalSpecialistReview':False,'fullGroebnerBasisComputed':False}
 # No unchecked narrowing: totals can exceed 2^32, especially class totals.
 if any(v<0 or v>2**64-1 for v in profile['dimensions']):raise Invalid('export counter width exceeded')
 atomic_json(a.out,profile);return {'status':'EXPORTED','path':str(a.out.resolve()),'sha256':sha(a.out),'degree':D}

def main(argv=None):
 a=parser().parse_args(argv)
 if a.command=='build':
  if a.jobs<1 or a.jobs>32:raise Invalid('build jobs must be 1..32')
  if a.native:subprocess.run(['make','clean'],cwd=ROOT,check=True)
  cmd=['make',f'-j{a.jobs}','all','proof-tools']+(['NATIVE=1'] if a.native else [])
  subprocess.run(cmd,cwd=ROOT,check=True);return 0
 if a.command=='check':
  ready();env={**os.environ,'KIR_QUICK_TESTS':'1' if a.quick else '0'}
  return subprocess.run([sys.executable,'-m','unittest','discover','-s','tests','-v'],cwd=ROOT,env=env).returncode
 if a.command=='support-formula':
  from .structural import support_formula
  print(json.dumps(support_formula(),indent=2));return 0
 if a.command=='degree8-homology':
  from .structural import degree8_result
  r=degree8_result();
  if a.out: atomic_json(a.out,r)
  print(json.dumps(r,indent=2));return 0
 if a.command=='support':
  from .structural import support_anick
  r=support_anick(a.size,a.degree,a.seconds,a.max_terms)
  if a.out: atomic_json(a.out,r)
  print(json.dumps(r,indent=2));return 0
 if a.command=='status':
  last=None
  while True:
   p=a.workdir/'status.json';v=load(p) if p.exists() else {'status':'NO_RUN','workdir':str(a.workdir)}
   text=json.dumps(v,indent=2)
   if text!=last:
    if a.json:print(json.dumps(v),flush=True)
    else:print(text,flush=True)
    last=text
   if not a.watch:return 0
   time.sleep(2)
 m,j,h=resolve_resources(a.memory,a.jobs)
 if a.command=='doctor':
  v={**h,'selectedMemoryBytes':m,'selectedJobs':j,'python':platform.python_version(),'system':platform.platform(),'nativeBinaries':{x:(ROOT/'bin'/x).exists() for x in ['kir-relative','libverify.so','libtriepair.so','exact-quotient-audit']},'compiler':shutil.which('g++') or shutil.which('clang++'),'buildForThisCPU':'make native','memoryNote':'OS address-space guard per worker, memory-weighted admission; not a whole-OS RSS guarantee.','noTimeEstimate':'Degree 19-22 may yield unresolved bounds; runtime is not extrapolated.'};print(json.dumps(v,indent=2));return 0
 if a.command=='nichols':
  if not 1<=a.degree<=22:raise Invalid('B6 exact verifier currently supports degrees 1..22')
  ready();work=a.workdir.resolve();runner=Runner(work,m,j,a.quiet,a.json_events)
  from .nichols import run_B6,export_B6
  with workspace_lock(work):
   bind_workspace(work)
   if not math.isfinite(a.upper_seconds) or not math.isfinite(a.block_seconds) or a.upper_seconds<0 or a.block_seconds<0:raise Invalid('limits must be nonnegative')
   oldhandlers={sig:signal.getsignal(sig)for sig in [signal.SIGINT,signal.SIGTERM]}
   for sig in oldhandlers:signal.signal(sig,runner.stop)
   try:
    if a.action=='export':
     if not a.out:raise Invalid('nichols export requires -o/--out')
     result=export_B6(runner,a.degree,a.out)
    else:result=run_B6(runner,a.degree,a.action,a.dual_mode,a.upper_seconds,a.block_seconds,a.force_replay,a.grade)
    print(json.dumps(result,indent=2));return 0 if result.get('status') not in ['BOUNDS_ONLY'] else 2
   finally:
    for sig,v in oldhandlers.items():signal.signal(sig,v)
 if not 1<=a.degree<=22:raise Invalid('this exact prefix verifier supports degrees 1..22; degrees above 22 require new arithmetic bounds')
 if a.command=='plan':
  v={'degree':a.degree,'jobs':j,'memoryBytes':m,'workdir':str(a.workdir.resolve()),'stages':['verify relation library','original and Nichols upper models','replay seed minors through degree18','discover/replay new blocks','replay inherited Q base','assemble intervals or exact profile'],'resumeGranularity':{'upper':'last completed degree; active degree restarts','minors':'last independently verified block; interrupted blocks restart'},'candidates':'source-derived; no supplied h19-h22','outputs':'machine-readable intervals; exact profile only on verified closure','safeToInterrupt':'SIGINT/SIGTERM retain committed work. SIGKILL cannot save an in-flight step.'};print(json.dumps(v,indent=2));return 0
 ready();work=a.workdir.resolve();runner=Runner(work,m,j,a.quiet,a.json_events)
 with workspace_lock(work):
  bind_workspace(work);oldhandlers={s:signal.getsignal(s) for s in [signal.SIGINT,signal.SIGTERM]}
  for s in oldhandlers:signal.signal(s,runner.stop)
  try:
   runner.event('started',command=a.command,degree=a.degree,jobs=j,budgetGiB=round(m/1024**3,2))
   if a.command=='export':result=exported(runner,a)
   else:
    if not math.isfinite(a.upper_seconds) or not math.isfinite(a.block_seconds) or a.upper_seconds<0 or a.block_seconds<0:raise Invalid('limits must be nonnegative')
    result=run_degree(runner,a,a.degree)
   print(json.dumps(result,indent=2));runner.event('finished',status=result.get('status'),degree=a.degree)
   return 0 if result.get('status') not in ['BOUNDS_ONLY'] else 2
  except (Stopped,Incomplete,Invalid) as e:
   status='INVALID' if isinstance(e,Invalid) else 'INTERRUPTED' if isinstance(e,Stopped) else 'INCOMPLETE'
   runner.event('stopped',message=str(e),status=status)
   print(json.dumps({'status':status,'requestedDegree':a.degree,'workdir':str(work),'message':str(e),'verifiedWorkPreserved':True,'exactProfileExported':False},indent=2))
   raise
  finally:
   for s,v in oldhandlers.items():signal.signal(s,v)

def entry():
 try:return main()
 except KeyboardInterrupt:print('kircracker: interrupted',file=sys.stderr);return 130
 except Stopped as e:print('kircracker: '+str(e),file=sys.stderr);return 130
 except Incomplete as e:print('kircracker: '+str(e),file=sys.stderr);return 3
 except (Invalid,ValueError,OSError,subprocess.CalledProcessError,MemoryError) as e:print('kircracker: '+str(e),file=sys.stderr);return 4
if __name__=='__main__':sys.exit(entry())
