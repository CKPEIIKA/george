#!/usr/bin/env python3
"""Real native -> WASM -> native planned-frontier exchange from a v1 checkpoint."""
from pathlib import Path
import json,subprocess,shutil,time,signal,sys
R=Path(__file__).resolve().parents[1];sys.path.insert(0,str(R/'tools'))
from canonical_audit import records,canonicalize
O=R/'results/pref4.2/cross-word';O.mkdir(parents=True,exist_ok=True);job=O/'job';shutil.rmtree(job,ignore_errors=True)
def latest():
 cps=[]
 for p in job.glob('fomkyr/*/*-?.json'):
  try:c=json.loads(p.read_text())['payload'];cps.append(c)
  except (OSError,ValueError,KeyError):pass
 return max(cps,key=lambda c:(c['completedThroughDegree'],bool(c.get('partial')),c.get('sequence',0)))if cps else None
def stage(mode,wasm,cut_degree):
 previous=latest();minimum_sequence=previous.get('sequence',0) if previous else -1
 args=[str(R/'dist/fomkyr')]+(['--wasm']if wasm else[])+['-i','fixtures/published/affine-q-serre-q3.json','-d','20','-j','4','--memory','256M','--workdir',str(job),'--pair-order',mode,'--plan-min-degree','12','--checkpoint-seconds','0','--quiet']
 with (O/f'{mode}-{wasm}.log').open('w')as log:
  p=subprocess.Popen(args,cwd=R,stdout=log,stderr=log);start=time.monotonic();cp=None
  while p.poll()is None and time.monotonic()-start<40:
   c=latest()
   if c and c.get('sequence',0)>minimum_sequence and c.get('partial') and c['currentDegree']>=cut_degree and c['retainedCommittedPairs']>0 and c['pendingPairs']>0 and int.from_bytes(bytes.fromhex(c['frontier'])[8:16],'little')==(3 if mode=='word' else 2 if mode!='legacy' else 1):cp=c;break
   time.sleep(.003)
  assert cp,(mode,wasm,'no partial');p.send_signal(signal.SIGTERM);rc=p.wait(timeout=15);assert rc==143,(mode,wasm,rc)
  saved=latest();assert saved['partial'];return saved
old=stage('legacy',False,14);assert int.from_bytes(bytes.fromhex(old['frontier'])[8:16],'little')==1
mid=stage('word',True,16);assert int.from_bytes(bytes.fromhex(mid['frontier'])[8:16],'little')==3
assert mid['frontierABI']==3 and mid['minimumReader']=='0.7.2' and mid['pairPlanOrder']==3
assert mid['completedThroughDegree']>=old['completedThroughDegree']
cmd=[str(R/'dist/fomkyr'),'--resume',str(job),'-d','20','-j','2','--memory','256M','--pair-order','word','--plan-min-degree','12','--quiet']
q=subprocess.run(cmd,cwd=R,capture_output=True,text=True,timeout=60);(O/'complete.log').write_text(q.stdout+'\nSTDERR\n'+q.stderr);assert not q.returncode,q.stderr;r=json.loads(q.stdout);assert r['complete'] and r['completedThroughDegree']==20
# Compare against an independent prior Q2 reference is the wrong presentation.
# Use an ordinary cold Q3 computation instead, and label this differential.
cold=O/'cold';shutil.rmtree(cold,ignore_errors=True);q=subprocess.run([str(R/'dist/fomkyr'),'-i','fixtures/published/affine-q-serre-q3.json','-d','20','-j','2','--memory','256M','--workdir',str(cold),'--quiet'],cwd=R,capture_output=True,text=True,timeout=60);assert not q.returncode,q.stderr
b=next(job.glob('fomkyr/*/basis.gnb'));a=next(cold.glob('fomkyr/*/basis.gnb'));assert canonicalize(records(a,20,2))[0]==canonicalize(records(b,20,2))[0]
result=dict(passed=True,oldFrontierVersion=1,newFrontierVersion=3,oldSavedCommitted=old['retainedCommittedPairs'],newSavedCommitted=mid['retainedCommittedPairs'],oldCurrentDegree=old['currentDegree'],newCurrentDegree=mid['currentDegree'],completedThroughDegree=20,canonicalEqualToOrdinaryCold=True,independentFullGroebnerCertificate=False)
(O/'summary.json').write_text(json.dumps(result,indent=2));print(json.dumps(result))
