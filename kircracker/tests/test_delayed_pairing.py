#!/usr/bin/env python3
"""Actual pairing discovery, independent integer-prefix replay, journal import.
These are bounded ambient-FK pairing controls, not degree-23 rank computations.
"""
from pathlib import Path
import sys, os, json, ctypes as C, random, time, hashlib, subprocess
R=Path(__file__).resolve().parents[1];sys.path.insert(0,str(R))
from app.native import libraries,buffer,verify_words,U64,P64
from app.records import packed
from app.util import sha,json_hash
O=Path(os.environ.get('KIR_BRIDGE_RESULTS',str(R/'results-local/degree23-bridge-local')))/'pairing-tests';O.mkdir(parents=True,exist_ok=True)
rng=random.Random(231023)
new=R/'bin/libtriepair.so'
base=Path(os.environ.get('KIR_BRIDGE_BASELINE_LIBRARY',str(new))).resolve()
legacy_baseline=base!=new.resolve()
if not base.is_file():raise FileNotFoundError('KIR_BRIDGE_BASELINE_LIBRARY must name an existing retained library')
reports=[]
def word(d):
 w=[]
 for _ in range(d):w.append(rng.choice([x for x in [5,9,12,14,15] if not w or x!=w[-1]]))
 return bytes(w)
def words(d,n):
 s=set()
 while len(s)<n:s.add(word(d))
 return sorted(s)
def discover(lib,mode,left,right,d,prime=1000003,cap=None,journal=None,binding=None):
 os.environ['KIR_PAIR_LIBRARY']=str(lib);os.environ['KIR_RANK_MODE']=mode;os.environ['KIR_WORKER_BYTES']=str(256<<20)
 if cap is not None:os.environ['KIR_MINOR_MAX_RANK']=str(cap)
 else:os.environ.pop('KIR_MINOR_MAX_RANK',None)
 if journal is not None:
  os.environ['KIR_PAIR_STATE']=str(journal);os.environ['KIR_PAIR_STATE_BINDING']=binding
 else:os.environ.pop('KIR_PAIR_STATE',None);os.environ.pop('KIR_PAIR_STATE_BINDING',None)
 libraries.cache_clear();p,_=libraries();ctx=p.kp_create(6,prime,100000);assert ctx
 row=(C.c_int*len(left))();col=(C.c_int*len(left))();m=(C.c_int*(len(left)**2))();stats=(U64*6)();t=time.perf_counter()
 try:r=p.kp_minor_trie_wide(ctx,buffer(packed(left)),len(left),buffer(packed(right)),len(right),d,row,col,None if journal else m,stats,20.)
 finally:p.kp_destroy(ctx)
 assert r>=0,(r,lib,mode);elapsed=time.perf_counter()-t
 return {'rank':r,'rows':list(row)[:r],'columns':list(col)[:r],'matrix':None if journal else list(m)[:r*r],'stats':list(stats),'seconds':elapsed}
for d in [4,5,6,7]:
 left=words(d,72);right=list(reversed([w[::-1] for w in left]))+words(d,216)
 answers=[discover(base,'reference',left,right,d),discover(new,'reference',left,right,d),discover(new,'delayed',left,right,d)]
 for a in answers[1:]:
  for k in ['rank','rows','columns','matrix','stats']:assert a[k]==answers[0][k],(d,k)
 a=answers[-1];assert a['rank']>0
 u=packed([left[i] for i in a['rows']]);v=packed([right[i] for i in a['columns']]);matrix=(C.c_int32*(a['rank']**2))(*a['matrix'])
 verified=verify_words({'degree':d,'rank':a['rank'],'prime':1000003},u,v,expected=matrix,threads=2)
 rec={'degree':d,'rows':len(left),'duals':len(right),'rank':a['rank'],'referenceDelayedExactlyEqual':True,'retainedBaselineCompared':legacy_baseline,'independentIntegerPrefixReplay':verified,'timesSeconds':{k:x['seconds'] for k,x in zip(['baseline','newReference','newDelayed'],answers)},'passed':True}
 reports.append(rec);print(json.dumps(rec),flush=True)
# Journal from baseline -> existing importer -> delayed mode. Same candidates;
# NEVER pads/reinterprets old pivots for an enlarged row set.
d=6;left=words(d,96);right=[w[::-1] for w in left]+words(d,288)
lf=O/'left.bin';rf=O/'right.bin';lf.write_bytes(packed(left));rf.write_bytes(packed(right))
task={'degree':d,'rows':len(left),'duals':len(right),'prime':1000003,'left':str(lf),'right':str(rf),'leftSHA256':sha(lf),'rightSHA256':sha(rf)}
shape={k:task[k]for k in ['degree','rows','duals','prime','leftSHA256','rightSHA256']}
oldBinding=json_hash(shape|{'librarySHA256':sha(base)});newBinding=json_hash(shape|{'librarySHA256':sha(new)})
old=O/'old.state';destination=O/'new.state'
assert not old.exists() and not destination.exists(),'Use a fresh result directory to repeat'
first=discover(base,'reference',left,right,d,cap=12,journal=old,binding=oldBinding);assert first['rank']==12
before={str(p.relative_to(O)):sha(p) for p in O.rglob('*')if p.is_file()}
(O/'task.json').write_text(json.dumps(task))
q=subprocess.run([sys.executable,str(R/'tools/import_pair_state.py'),'--source',str(old),'--source-library',str(base),'--destination',str(destination),'--task',str(O/'task.json'),'--library',str(new)],cwd=R,capture_output=True,text=True,timeout=30)
(O/'import.log').write_text(q.stdout+'\nSTDERR\n'+q.stderr);assert q.returncode==0,q.stderr
for p,h in before.items():assert sha(O/p)==h,'source mutated'
restored=discover(new,'delayed',left,right,d,journal=destination,binding=newBinding);cold=discover(new,'delayed',left,right,d)
for k in ['rank','rows','columns']:assert restored[k]==cold[k],k
n=cold['rank'];v=verify_words({'degree':d,'rank':n,'prime':1000003},packed([left[i]for i in cold['rows']]),packed([right[i]for i in cold['columns']]),threads=2)
reports.append(dict(passed=True,case='bound-journal-import-delayed-resume',retainedBaselineCompared=legacy_baseline,sameCandidateFiles=True,originalFilesUnchanged=True,resumedRank=n,coldAndResumedPivotIdsEqual=True,independentMinorReplay=v,changingCandidateRowsSupported=False))
(O/'summary.json').write_text(json.dumps({'passed':True,'degree23FullRun':False,'cases':reports},indent=2))
