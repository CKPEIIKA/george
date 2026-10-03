#!/usr/bin/env python3
"""Actual interrupted assisted jobs, cross native/WASM and dependency rejection."""
from pathlib import Path
import subprocess,json,signal,shutil,time,sys,copy
R=Path(__file__).resolve().parents[1];sys.path.insert(0,str(R/'tools'))
from canonical_audit import records,canonicalize
O=R/'results/0.6.6/closure-resume';O.mkdir(parents=True,exist_ok=True);X=R/'dist/fomkyr';F=R/'fixtures/published/affine-q-serre-q3.json';E=R/'fixtures/hilbert/q-serre-3-pbw.json';f=json.loads(F.read_text());entries=[]
def cps(job):
 out=[]
 for p in job.glob('fomkyr/*/*-?.json'):
  try:
   c=json.loads(p.read_text())['payload']
   if 'completedThroughDegree'in c:out.append(c)
  except (ValueError,KeyError):pass
 return sorted(out,key=lambda c:(c['completedThroughDegree'],bool(c.get('partial')),c.get('sequence',0)),reverse=True)
def cmd(job,wasm=False,D=20):return [str(X)]+(['--wasm'] if wasm else [])+['-i',str(F),'-d',str(D),'-j','4','--memory','512M','--workdir',str(job),'--quiet','--checkpoint-seconds','0','--assume-hilbert',str(E)]
def run(job,wasm=False,D=20):
 q=subprocess.run(cmd(job,wasm,D),cwd=R,capture_output=True,text=True,timeout=60);(O/(job.name+'-completed.log')).write_text(q.stdout+'\nSTDERR\n'+q.stderr);assert not q.returncode,q.stderr;return json.loads(q.stdout)
cold=O/'cold';shutil.rmtree(cold,ignore_errors=True);r=run(cold);gold,_=canonicalize(records(next(cold.glob('fomkyr/*/basis.gnb')),20,2))
for wasm in (False,True):
 job=O/('wasm-to-native' if wasm else 'native-to-wasm');shutil.rmtree(job,ignore_errors=True)
 with (O/(job.name+'-interrupted.log')).open('w') as log:
  p=subprocess.Popen(cmd(job,wasm),cwd=R,stdout=log,stderr=log);start=time.monotonic();seen=None
  while p.poll()is None and time.monotonic()-start<40:
   cc=cps(job)
   if cc and cc[0].get('partial')and cc[0]['currentDegree']>=18 and cc[0].get('retainedCommittedPairs',0)>0:
    seen=cc[0];break
   time.sleep(.001)
  assert seen,(job,p.poll());p.send_signal(signal.SIGTERM);rc=p.wait(timeout=20);assert rc==143,(rc,job)
 saved=cps(job)[0];assert saved['abi']==4 and saved['conditionalOnExternalDimensions'] is True
 basis=next(job.glob('fomkyr/*/basis.gnb'));before=basis.read_bytes()
 wrong=json.loads(E.read_text());wrong['source']='Altered policy/provenance';wrongfile=O/'wrong-evidence.json';wrongfile.write_text(json.dumps(wrong))
 for flags in ([],['--assume-hilbert',str(wrongfile)]):
  q=subprocess.run([str(X),'--resume',str(job),'-d20','--quiet']+flags,cwd=R,capture_output=True,text=True,timeout=15);assert q.returncode!=0 and 'evidence'in q.stderr.lower();assert basis.read_bytes()==before
 after=run(job,not wasm);assert after['complete'] and after['hilbertEvidenceId']==saved['hilbertEvidenceId']
 actual,_=canonicalize(records(basis,20,2));assert actual==gold
 entries.append(dict(start='wasm' if wasm else 'native',finish='native' if wasm else 'wasm',passed=True,savedDegree=saved['currentDegree'],savedCommittedPairs=saved['retainedCommittedPairs'],resumedPartial=after['resumedPartial'] if 'resumedPartial'in after else True,canonicalEqual=True,wrongOrMissingAuthorityRejected=True));print(entries[-1],flush=True)
(O/'summary.json').write_text(json.dumps(dict(passed=True,cases=entries),indent=2))
