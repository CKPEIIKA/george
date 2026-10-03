#!/usr/bin/env python3
from pathlib import Path
import subprocess,json,hashlib,shutil,signal,time
R=Path(__file__).resolve().parents[1];exe=R/'dist/fomkyr';out=R/'results/0.6.5/cli-edges';out.mkdir(exist_ok=True);results=[]
def run(args,stdin=None,ok=(0,)):
 p=subprocess.run([str(exe),*args],cwd=R,input=stdin,capture_output=True,text=True,timeout=40)
 assert p.returncode in ok,(args,p.returncode,p.stdout,p.stderr)
 return json.loads(p.stdout)
for wasm in [False,True]:
 w=['--wasm']if wasm else[];job=out/('wasm'if wasm else'native');shutil.rmtree(job,ignore_errors=True)
 r=run(w+['-i','fixtures/exterior.json','--field','101','-d4','--memory','128M','--workdir',str(job),'--quiet']);
 opposite=[]if wasm else['--wasm']
 r=run(opposite+['--resume',str(job),'-d9','--memory','128M','--hilbert','--quiet'])
 h=json.loads(next(job.glob('fomkyr/*/hilbert.json')).read_text());assert (h.get('modulus')==101 or h.get('field')=='F_101') and h['coefficients'][:5]==['1','3','3','1','0']
 before={str(p.relative_to(job)):hashlib.sha256(p.read_bytes()).hexdigest()for p in job.rglob('*')if p.is_file()}
 run(w+['--resume',str(job),'--status'])
 after={str(p.relative_to(job)):hashlib.sha256(p.read_bytes()).hexdigest()for p in job.rglob('*')if p.is_file()};assert before==after
 p=subprocess.run([str(exe),*w,'--resume',str(job),'--field','2','--quiet'],cwd=R,capture_output=True,text=True);assert p.returncode!=0 and 'differs' in p.stderr
 results.append(dict(test='saved-field-and-read-only-status',start='wasm'if wasm else'native',passed=True))
 j=out/('stdin-'+('wasm'if wasm else'native'));shutil.rmtree(j,ignore_errors=True)
 r=run(w+['-i','-','-d0','--memory','128M','--workdir',str(j),'--quiet'],stdin='vars a,b; b*a-a*b;\n')
 assert r.get('complete',r.get('completedThroughDegree',0)>0);assert r['basisSize']==1
 results.append(dict(test='stdin-unbounded-complete-algebra',runtime='wasm'if wasm else'native',passed=True))
# SIGUSR1 requests durable progress without interrupting the computation.
job=out/'usr1';shutil.rmtree(job,ignore_errors=True)
with (out/'usr1.log').open('w')as log:
 p=subprocess.Popen([str(exe),'-i','fixtures/published/affine-q-serre-q3.json','-d22','--memory','512M','--workdir',str(job),'--checkpoint-seconds','3600','--batch-pairs','8'],cwd=R,stdout=log,stderr=log)
 start=time.monotonic();found=False
 while p.poll()is None and time.monotonic()-start<20:
  if list(job.glob('fomkyr/*/checkpoint-*.json')):
   p.send_signal(signal.SIGUSR1)
   time.sleep(.015)
   if list(job.glob('fomkyr/*/partial-*.json')):found=True;break
  time.sleep(.01)
 assert found,'No requested partial checkpoint';p.send_signal(signal.SIGTERM);code=p.wait(timeout=10);assert code==143
 results.append(dict(test='SIGUSR1-request-not-cancel',passed=True))
(out/'summary.json').write_text(json.dumps(dict(passed=True,tests=results),indent=2));print('CLI EDGE TESTS PASSED',flush=True)
