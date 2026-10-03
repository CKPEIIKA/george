#!/usr/bin/env python3
"""Actual POSIX CLI, cross-native/WASM recovery and crash/lock tests."""
from pathlib import Path
import subprocess,json,os,signal,time,shutil,hashlib
R=Path(__file__).resolve().parents[1];exe=R/'dist/fomkyr';out=R/'results/0.6.5/cli-tests';out.mkdir(parents=True,exist_ok=True)
f=R/'fixtures/published/affine-q-serre-q3.json';rows=[]
def cps(job):
 result=[]
 for p in job.glob('fomkyr/*/*-?.json'):
  if not p.name.startswith(('checkpoint-','partial-')):continue
  try:
   j=json.loads(p.read_text());c=j['payload'];c['_file']=str(p);result.append(c)
  except (ValueError,KeyError):pass
 return sorted(result,key=lambda c:(c['completedThroughDegree'],bool(c.get('partial')),c.get('sequence',0)),reverse=True)
def command(job,wasm=False,extra=()):
 return [str(exe)]+(['--wasm']if wasm else[])+['-i',str(f),'-d','20','-j','4','--memory','512M','--workdir',str(job),'--batch-pairs','8','--quiet']+list(extra)
def run(job,wasm=False,extra=(),expect=(0,)):
 q=subprocess.run(command(job,wasm,extra),cwd=R,capture_output=True,text=True,timeout=60)
 (out/(job.name+('-wasm'if wasm else'-native')+'.log')).write_text(q.stdout+'\nSTDERR\n'+q.stderr)
 assert q.returncode in expect,(q.returncode,q.stdout,q.stderr)
 return json.loads(q.stdout.splitlines()[-1])
def interrupt(name,wasm=False,kill=False,after=15):
 job=out/name;shutil.rmtree(job,ignore_errors=True)
 log=(out/(name+'-interrupted.log')).open('w');p=subprocess.Popen(command(job,wasm,['--checkpoint-seconds','0']),cwd=R,stdout=log,stderr=log)
 seen=None;t=time.monotonic()
 while time.monotonic()-t<40 and p.poll()is None:
  for c in cps(job):
   if c.get('partial')and c['currentDegree']>=after and c.get('retainedCommittedPairs',0)>0 and c.get('pendingPairs',0)>0:seen=c;break
  if seen:break
  time.sleep(.001)
 assert seen,('no partial frontier',name,p.poll())
 # A second writer MUST fail while first owns the POSIX lock.
 q=subprocess.run(command(job,not wasm,['--time-limit','.01']),cwd=R,capture_output=True,text=True,timeout=10)
 assert q.returncode!=0 and 'lock' in q.stderr.lower(),q.stderr
 p.send_signal(signal.SIGKILL if kill else signal.SIGTERM);code=p.wait(timeout=20);log.close()
 assert code in ((-9,)if kill else(143,)),(name,code)
 saved=cps(job)[0];assert saved.get('partial') and saved['retainedCommittedPairs']>=seen['retainedCommittedPairs']
 rows.append({'name':name,'interruptedRuntime':'wasm'if wasm else'native','signal':'SIGKILL'if kill else'SIGTERM','checkpointDegree':saved['currentDegree'],'retainedCommittedPairs':saved['retainedCommittedPairs'],'pendingPairs':saved['pendingPairs'],'exclusiveLock':True})
 return job,saved
cold=out/'cold';shutil.rmtree(cold,ignore_errors=True);ref=run(cold);assert ref['completedThroughDegree']==20
refbytes=next(cold.glob('fomkyr/*/basis.gnb')).read_bytes()
for name,wasm,kill in [('native-to-wasm',False,False),('wasm-to-native',True,False),('killed-native-to-wasm',False,True),('killed-wasm-to-native',True,True)]:
 job,cp=interrupt(name,wasm,kill)
 # A lower-bound read must not discard a newer partial checkpoint or basis tail.
 before=next(job.glob('fomkyr/*/basis.gnb')).read_bytes();seq=cp['sequence']
 lower=run(job,not wasm,['--degree','10']);assert lower['complete']
 assert next(job.glob('fomkyr/*/basis.gnb')).read_bytes()==before
 assert cps(job)[0]['sequence']==seq
 result=run(job,not wasm,['--workers','2','--checkpoint-seconds','30'])
 assert result['completedThroughDegree']==20
 assert next(job.glob('fomkyr/*/basis.gnb')).read_bytes()==refbytes,name
 rows[-1].update(completedThroughDegree=20,byteEqualToCold=True,lowerRequestPreservesPartial=True)
 print(rows[-1],flush=True)
# Corrupted latest metadata is not accepted; the older slot is replayed.
job,cp=interrupt('corrupt-latest',False,True)
Path(cp['_file']).write_text('{"broken":true}')
# Extra bytes can be remnants of a killed record append, never certified input.
with next(job.glob('fomkyr/*/basis.gnb')).open('ab')as h:h.write(b'uncertified crash suffix')
r=run(job,True);assert r['completedThroughDegree']==20
assert next(job.glob('fomkyr/*/basis.gnb')).read_bytes()==refbytes
rows[-1].update(corruptLatestRejected=True,tornSuffixDiscarded=True,byteEqualToCold=True)
# Explicit 64-GiB native ceiling is not clamped to the WASM application cap.
bigjob=out/'large-native-address-space';shutil.rmtree(bigjob,ignore_errors=True)
p=subprocess.run([str(exe),'-i',str(f),'-d7','-j4','--memory','64G','--workdir',str(bigjob),'--quiet'],cwd=R,capture_output=True,text=True,timeout=30)
assert p.returncode==0,(p.stdout,p.stderr)
big=json.loads(p.stdout);assert big['budgetBytes']==64<<30 and big['allocatedBytes']>15_000_000_000 and big['complete']
q=subprocess.run([str(exe),'-i',str(f),'--memory','64G','--wasm-limit','--dry-run'],cwd=R,capture_output=True,text=True,check=True)
limited=json.loads(q.stdout);assert limited['budgetBytes']<=15_000_000_000
rows.append({'name':'native-memory-policy','native64GiB':big,'wasmLimitedPlan':limited,'resident64GiBNotClaimed':True})
# Input round trip including the literal user form.
q=subprocess.run([str(exe),'-i','fixtures/user-form.bg','--dump-fixture'],cwd=R,capture_output=True,text=True,check=True)
a=json.loads(q.stdout);b=json.loads((R/'fixtures/fk6.json').read_text());assert a['variables']==b['variables']and a['relations']==b['relations']
q=subprocess.run([str(exe),'--wasm','-i','fixtures/user-form.bg','--dump-fixture'],cwd=R,capture_output=True,text=True,check=True)
a2=json.loads(q.stdout);assert a2['variables']==b['variables']and a2['relations']==b['relations']
rows.append({'name':'George-form','nativeAndWasmParseExactUserForm':True})
(out/'summary.json').write_text(json.dumps({'passed':True,'cases':rows},indent=2));print('CLI SUITE PASS',flush=True)
