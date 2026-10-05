#!/usr/bin/env python3
"""A valid planned frontier must not be rolled back merely for a smaller budget."""
from pathlib import Path
import json,subprocess,shutil,hashlib
R=Path(__file__).resolve().parents[1];O=R/'results/pref4.2/word-memory-guard';O.mkdir(parents=True,exist_ok=True)
source=R/'results/pref4.2/cross-word/job';assert source.exists(),source
reports=[]
for wasm in [False,True]:
 job=O/('wasm'if wasm else'native');shutil.rmtree(job,ignore_errors=True);shutil.copytree(source,job)
 candidates=[]
 for p in job.glob('fomkyr/*/partial-?.json'):
  c=json.loads(p.read_text())['payload']
  if c.get('partial')and int.from_bytes(bytes.fromhex(c['frontier'])[8:16],'little')==3:candidates.append((c,p))
 assert candidates,'cross-runtime test did not retain a v3 partial checkpoint'
 cp,chosen=max(candidates,key=lambda x:x[0]['sequence'])
 for p in job.glob('fomkyr/*/checkpoint-?.json'):
  c=json.loads(p.read_text())['payload']
  if c['completedThroughDegree']>cp['completedThroughDegree']:p.unlink()
 basis=next(job.glob('fomkyr/*/basis.gnb'));before=basis.read_bytes();frames={p.name:p.read_bytes()for p in job.glob('fomkyr/*/partial-?.json')}
 cmd=[str(R/'dist/fomkyr')]+(['--wasm']if wasm else[])+['--resume',str(job),'-d',str(cp['currentDegree']),'--memory','128M','--pair-plan-memory','0','--quiet']
 q=subprocess.run(cmd,cwd=R,capture_output=True,text=True,timeout=20);(O/('wasm.log'if wasm else'native.log')).write_text(q.stdout+'\nSTDERR\n'+q.stderr)
 assert q.returncode!=0,(wasm,q.stdout,q.stderr);assert basis.read_bytes()==before,'lower memory request truncated the saved basis'
 assert all(p.read_bytes()==frames[p.name]for p in job.glob('fomkyr/*/partial-?.json')),'frontier changed on refused restore'
 assert 'plan'in(q.stdout+q.stderr).lower() and 'retain'in(q.stdout+q.stderr).lower(),(q.stdout,q.stderr)
 reports.append(dict(runtime='wasm'if wasm else'native',passed=True,refusedCode=q.returncode,basisBytesRetained=len(before),frontierRetained=True))
(O/'summary.json').write_text(json.dumps(dict(passed=True,reports=reports),indent=2));print('PLANNED MEMORY-GUARD TESTS PASS')
