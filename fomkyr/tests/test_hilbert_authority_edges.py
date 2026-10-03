#!/usr/bin/env python3
"""Reject a modular-only nullspace as a Q lower bound; accept a strict lower bound.
A certificate's `dimension` need not be exact: a smaller independent subspace must
not cause early closure while the current upper bound is larger.
"""
from pathlib import Path
import json,copy,subprocess,sys,shutil
R=Path(__file__).resolve().parents[1];sys.path.insert(0,str(R/'tools'))
from hilbert_certificate import identity
O=R/'results/0.6.6/authority-edges';O.mkdir(parents=True,exist_ok=True)
f=dict(variables=['x'],relations=[dict(degree=1,terms=[dict(word=[0],coefficient='2')])])
e=dict(schema=1,kind='integer-duals',identity=identity(f),modulus=0,source='Deliberately wrong: valid only modulo 2',entries=[dict(degree=1,dimension='1',pivots=[0],vectors=[[[0,'1']]])])
(O/'input.json').write_text(json.dumps(f));(O/'wrong.json').write_text(json.dumps(e));job=O/'wrong-job';shutil.rmtree(job,ignore_errors=True)
q=subprocess.run([str(R/'dist/fomkyr'),'-i',str(O/'input.json'),'-d','2','--memory','128M','--workdir',str(job),'--hilbert-certificate',str(O/'wrong.json')],capture_output=True,text=True,timeout=15)
assert q.returncode!=0,(q.stdout,q.stderr)
assert not list(job.glob('fomkyr/*/checkpoint-?.json'))
(O/'wrong.log').write_text(q.stdout+'\nSTDERR\n'+q.stderr)
f=json.loads((R/'fixtures/fk3.json').read_text());e=json.loads((R/'fixtures/hilbert/fk3-duals.json').read_text());e=copy.deepcopy(e);e['entries']=e['entries'][:1];z=e['entries'][0];z['dimension']='1';z['pivots']=z['pivots'][:1];z['vectors']=z['vectors'][:1]
(O/'lower.json').write_text(json.dumps(e));job=O/'lower-job';shutil.rmtree(job,ignore_errors=True)
q=subprocess.run([str(R/'dist/fomkyr'),'-i',str(R/'fixtures/fk3.json'),'-d','4','--memory','128M','--workdir',str(job),'--hilbert-certificate',str(O/'lower.json'),'--quiet'],capture_output=True,text=True,timeout=15)
assert not q.returncode,(q.stdout,q.stderr);result=json.loads(q.stdout);assert result['complete'] and not result['hilbertClosureEvents']
(O/'lower.log').write_text(q.stdout+'\nSTDERR\n'+q.stderr)
(O/'summary.json').write_text(json.dumps(dict(passed=True,modularNullspaceCannotCertifyRationalQuotient=True,strictLowerBoundDoesNotCloseBeforeEquality=True),indent=2))
print('AUTHORITY EDGE CHECKS PASS')
