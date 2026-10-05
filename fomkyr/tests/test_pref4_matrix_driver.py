"""Safety checks for the experiment driver, not a large solver computation."""
from pathlib import Path
import sys,json,subprocess,tempfile,hashlib,fcntl
R=Path(__file__).resolve().parents[1];sys.path.insert(0,str(R/'tools'));from pref4_frontier_matrix import best,read_lock
rows=[]
with tempfile.TemporaryDirectory()as td:
 root=Path(td);job=root/'job';d=job/'fomkyr'/'alg-fixture';d.mkdir(parents=True);(d/'basis.gnb').write_bytes(b'a'*32)
 c=dict(abi=5,completedThroughDegree=15,currentDegree=16,partial=True,frontier='aa',sequence=7,diskBytes=32,basisSize=1,identity='x',runKey='alg-fixture',resolvedOverlaps=123,pairPlanOrder=1)
 def save(c):
  text=json.dumps(c,separators=(',',':'),ensure_ascii=False);(d/'partial-1.json').write_text(json.dumps(dict(schema=2,payload=c,sha256=hashlib.sha256(text.encode()).hexdigest())))
 save(c);assert best(job)[0]==c
 cmd=[sys.executable,str(R/'tools/pref4_frontier_matrix.py'),'--job',str(job),'--out',str(root/'out')]
 q=subprocess.run(cmd,text=True,capture_output=True);assert q.returncode!=0 and 'active saved pair plan' in q.stderr;rows.append('cannot compare another active plan')
 q=subprocess.run(cmd+['--case','commit','--order','overlap'],text=True,capture_output=True);assert not q.returncode and json.loads(q.stdout)['dryRun'];assert not (root/'out').exists();rows.append('dry run does not create experiment jobs')
 q=subprocess.run(cmd+['--case','commit','--order','overlap','--run'],text=True,capture_output=True);assert q.returncode!=0 and '--stopped-native-job' in q.stderr;rows.append('explicit stopped-native assertion required')
 # The lock type must conflict across processes with the solver's F_SETLK lock.
 (job/'cli.lock').touch()
 with (job/'cli.lock').open('w')as f:
  fcntl.lockf(f,fcntl.LOCK_EX|fcntl.LOCK_NB)
  py='import sys;sys.path.insert(0,'+repr(str(R/'tools'))+');from pref4_frontier_matrix import read_lock;from pathlib import Path\nwith read_lock(Path(sys.argv[1])):pass'
  q=subprocess.run([sys.executable,'-c',py,str(job)],text=True,capture_output=True);assert q.returncode!=0;rows.append('live native exclusive lock blocks snapshot reader')
 bad=json.loads((d/'partial-1.json').read_text());bad['payload']['sequence']+=1;(d/'partial-1.json').write_text(json.dumps(bad))
 try:best(job);raise AssertionError('corrupt envelope accepted')
 except ValueError:pass
 rows.append('corrupt envelope is not a valid checkpoint')
(R/'results/pref4/driver-safety.json').write_text(json.dumps(dict(passed=True,checks=rows),indent=2));print(rows)
