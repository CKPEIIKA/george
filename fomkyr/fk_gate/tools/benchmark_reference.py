#!/usr/bin/env python3
"""Matched native gate-on/off computations, actual recovered fomkyr kernel.
Alternating modes, no reused checkpoint for cold runs, 12 workers by default.
The benchmark never invokes certificate discovery/replay inside the timed run.
"""
from pathlib import Path
import argparse,json,subprocess,os,time,hashlib,statistics
p=argparse.ArgumentParser();p.add_argument('--fomkyr',type=Path,required=True);p.add_argument('--out',type=Path,required=True);p.add_argument('--degrees',type=int,nargs='+',default=[10,12]);p.add_argument('--trials',type=int,default=3);p.add_argument('--workers',type=int,default=12);p.add_argument('--sectors',action='store_true');p.add_argument('--seconds',type=int,default=180);a=p.parse_args()
r=a.fomkyr.resolve();a.out.mkdir(parents=True,exist_ok=True);rows=[]
for d in a.degrees:
 for trial in range(a.trials):
  for enabled in ([False,True] if trial%2==0 else [True,False]):
   tag=f'd{d}-gate{int(enabled)}-r{trial}';run=a.out/tag
   if run.exists():raise SystemExit('Refusing to overwrite '+str(run))
   run.mkdir();cmd=[str(r/'dist/fomkyr'),'-i',str(r/'fixtures/fk6.json'),'-d',str(d),'-j',str(a.workers),'--memory','512M','--workdir',str(run/'job'),'--fresh','--time-limit',str(a.seconds),'--hilbert','-q']
   env=os.environ|{'FOMKYR_HILBERT_GATE':str(int(enabled)),'FOMKYR_HILBERT_SECTORS':str(int(a.sectors and enabled))};start=time.perf_counter()
   with (run/'stdout.json').open('w') as out,(run/'stderr.log').open('w') as err:
    try:proc=subprocess.run(cmd,env=env,stdout=out,stderr=err,timeout=a.seconds+20);code=proc.returncode
    except subprocess.TimeoutExpired:code=124
   elapsed=time.perf_counter()-start
   try:result=json.loads((run/'stdout.json').read_text())
   except (OSError,ValueError):result={'complete':False,'error':'no final JSON'}
   basis=list((run/'job').glob('fomkyr/*/basis.gnb'));bs=basis[0] if basis else None
   report={'degree':d,'enabled':enabled,'sectors':bool(a.sectors and enabled),'trial':trial,'workers':a.workers,'returncode':code,'complete':result.get('complete',False),'outerSeconds':elapsed,'result':result,'basis':str(bs) if bs else None,'basisSHA256':hashlib.sha256(bs.read_bytes()).hexdigest() if bs else None}
   rows.append(report);(a.out/'trials.json').write_text(json.dumps(rows,indent=2));print(tag,code,round(elapsed,6),result.get('hilbertGate'),flush=True)
groups=[]
for d in a.degrees:
 for enabled in [False,True]:
  x=[q for q in rows if q['degree']==d and q['enabled']==enabled];t=[q['outerSeconds'] for q in x if q['complete']]
  groups.append({'degree':d,'enabled':enabled,'trials':len(x),'completed':len(t),'medianOuterSeconds':statistics.median(t) if t else None,'minOuterSeconds':min(t) if t else None,'maxOuterSeconds':max(t) if t else None,'times':t})
(a.out/'summary.json').write_text(json.dumps({'conditions':'Native recovered fomkyr 0.6.5, same patched binary with gate on/off; cold processes, 12 workers, actual CPU quota recorded separately. All source math unchanged. Timed initialization, computation, checkpoints and final Hilbert, not text export. Certificate verified before deployment, not hidden within times.','sectorMode':a.sectors,'sourceHashes':{str(p.relative_to(r)):hashlib.sha256(p.read_bytes()).hexdigest() for p in [r/'src/kernel.c',r/'native/cli.c',r/'dist/fomkyr',r/'fk_gate/adapters/sector_counter.inc',r/'fk_gate/profiles/fk6_sectors.h']},'groups':groups},indent=2));print('DONE',flush=True)
