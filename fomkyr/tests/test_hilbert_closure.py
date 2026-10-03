#!/usr/bin/env python3
"""Independent certificate replay, assisted-completion and rejection tests.
Small matrix witnesses are not claimed scalable to FK6 degree 14.
"""
from pathlib import Path
import sys,json,subprocess,shutil,copy,hashlib,random,time
R=Path(__file__).resolve().parents[1];sys.path[:0]=[str(R/'tools'),str(R/'tests')]
from hilbert_certificate import construct,verify,identity
from physics_cases import fk
from canonical_audit import records,canonicalize,canonical_digest
from oracle import complete,normal,certify
from field_oracle import ModularOracle
O=R/'results/0.6.6/certificate-tests';O.mkdir(parents=True,exist_ok=True);EXE=R/'dist/fomkyr';checks=[];config=[]
def save(p,data):p.parent.mkdir(parents=True,exist_ok=True);p.write_text(json.dumps(data,separators=(',',':'))+'\n');return p
def run(name,f,D,policy,p=0,flag='--hilbert-certificate',expect=0,workers=4):
 job=O/name;shutil.rmtree(job,ignore_errors=True);inp=save(O/(name+'-input.json'),f);pol=save(O/(name+'-evidence.json'),policy)
 args=[str(EXE),'-i',str(inp),'-d',str(D),'-j',str(workers),'--field',str(p),'--memory','128M','--workdir',str(job),'--hilbert','--export','--quiet',flag,str(pol)]
 t=time.perf_counter();q=subprocess.run(args,cwd=R,text=True,capture_output=True,timeout=120)
 (O/(name+'.log')).write_text(q.stdout+'\nSTDERR\n'+q.stderr)
 if expect:
  assert q.returncode!=0,(name,q.stdout)
  published=[json.loads(p.read_text())['payload']['completedThroughDegree'] for p in job.glob('fomkyr/*/checkpoint-?.json')]
  assert (not published if flag=='--hilbert-certificate' else max(published,default=0)<2),(name,'published degree beyond rejected bound')
  checks.append(dict(name=name,passed=True,rejected=True,code=q.returncode));return
 assert q.returncode==0,(name,q.stdout,q.stderr);res=json.loads(q.stdout)
 file=next(job.glob('fomkyr/*/basis.gnb'));bs=list(records(file,D,len(f['variables'])))
 oo=ModularOracle(p) if p else None;comp=oo.complete if oo else complete;nf=oo.normal if oo else normal;cert=oo.certify if oo else certify
 ref=comp(f['relations'],D);n=cert(bs,f['relations'],D)
 assert all(not nf(row,ref) for row in bs) and all(not nf(row,bs) for row in ref)
 a,_=canonicalize(bs,p);b,_=canonicalize(ref,p);assert a==b
 assert res['conditionalOnExternalDimensions']==(flag=='--assume-hilbert')
 if flag=='--hilbert-certificate':assert res['hilbertEvidenceMode']=='replayed-integer-duals'
 for cp in job.glob('fomkyr/*/checkpoint-?.json'):
  data=json.loads(cp.read_text())['payload'];assert data['abi']==4 and data['hilbertEvidenceId']==res['hilbertEvidenceId']
 for e in res['hilbertClosureEvents']:
  assert e['overlapsBypassed']==e['notYetEnumerated']+e['scheduledNotCommitted']
 # Refuse an ordinary resume BEFORE file changes. No assumption laundering.
 before=file.read_bytes();q2=subprocess.run([str(EXE),'--resume',str(job),'-d',str(D+1),'--quiet'],capture_output=True,text=True,timeout=10)
 assert q2.returncode!=0 and 'evidence' in q2.stderr.lower();assert file.read_bytes()==before
 ev=dict(name=name,degree=D,modulus=p,passed=True,independentCompletion=True,criticalCompositionsChecked=n,mutualInclusions=True,canonicalEqual=True,closureEvents=res['hilbertClosureEvents'],plainResumeRejected=True,seconds=time.perf_counter()-t)
 checks.append(ev);config.append(dict(name=name,fixture=f,degree=D,modulus=p,evidence=policy,mode='assume' if flag=='--assume-hilbert' else 'certificate',record=str(file)))
 print(json.dumps(ev),flush=True);return res
fixtures=[('fk3',json.loads((R/'fixtures/fk3.json').read_text()),5,7),('fk4',fk(4,5),4,5),('fk6-prefix',json.loads((R/'fixtures/fk6.json').read_text()),3,4),('weyl',json.loads((R/'fixtures/homogenized-weyl.json').read_text()),4,5)]
for name,f,through,D in fixtures:
 t=time.perf_counter();ev=dict(schema=1,kind='integer-duals',identity=identity(f),modulus=0,source='Exact independently generated integer covectors',entries=[construct(f,d) for d in range(min(x['degree'] for x in f['relations']),through+1)])
 valid=verify(f,ev);valid['constructionAndIndependentReplaySeconds']=time.perf_counter()-t;save(O/(name+'-proof.json'),ev);checks.append(dict(name=name+'-independent-duals',**valid))
 run(name,f,D,ev)
 if name=='fk3':
  for p in (2,101):
   ep=copy.deepcopy(ev);ep['identity']=identity(f,p);ep['modulus']=p;run(name+'-F'+str(p),f,D,ep,p=p)
  for bad in ('wrong-field','wrong-input','zero-minor','nonzero-context','rank-in-wrong-direction'):
   x=copy.deepcopy(ev)
   if bad=='wrong-field':x['modulus']=101
   elif bad=='wrong-input':x['identity']='0'*64
   elif bad=='zero-minor':x['entries'][0]['vectors'][0]=[]
   elif bad=='nonzero-context':x['entries'][0]['vectors'][0].append([0,'1'])
   else:x['kind']='modular-relation-rank'
   run(bad,f,D,x,expect=1)
  x=copy.deepcopy(ev);x['kind']='external-dimensions';x['entries']=[dict(degree=2,dimension=str(len(f['variables'])**2+1))]
  run('impossible-external-upper',f,D,x,flag='--assume-hilbert',expect=1)
  # Changing non-leading input coefficients prevents mistaken proof reuse.
  changed=copy.deepcopy(f);changed['relations'][0]['terms'][0]['coefficient']='2'
  run('changed-coefficients',changed,D,ev,expect=1)
# An external statement is explicitly conditional, even when a separate oracle agrees.
f=json.loads((R/'fixtures/fk6.json').read_text());ev=json.loads((R/'fixtures/hilbert/fk6-kirillov.json').read_text());run('FK6-external-d5',f,5,ev,flag='--assume-hilbert')
# Signed-128 exact arithmetic, including overflow refusal.
exe=O/'lower-arithmetic';q=subprocess.run(['clang','-O1','-g','-fsanitize=undefined','-fno-sanitize-recover=all','tests/lower_bound_arithmetic.c','tests/host.c','-o',str(exe)],cwd=R,capture_output=True,text=True);assert not q.returncode,q.stderr
rng=random.Random(660);edge=[-(1<<63),-(1<<63)+1,-1,0,1,(1<<63)-1];cs=[]
for i in range(12000):cs.append(tuple(rng.choice(edge) if i<1000 else rng.randrange(-(1<<63),1<<63) for _ in range(4)))
q=subprocess.run([str(exe)],input=''.join(' '.join(map(str,c))+'\n' for c in cs),text=True,capture_output=True,timeout=30);assert not q.returncode,q.stderr
for v,c in zip(q.stdout.splitlines(),cs):
 x,ok,z=v.split();a,b,cc,d=c;prod=a*b;total=prod+cc*d;valid=-(1<<127)<=total<(1<<127);assert int(x,16)==prod% (1<<128) and bool(int(ok))==valid
 if valid:assert int(z,16)==total%(1<<128)
assert len(q.stdout.splitlines())==len(cs);checks.append(dict(name='signed128-witness-arithmetic',passed=True,cases=len(cs),ubsan=True))
save(O/'wasm-cases.json',config);save(O/'summary.json',dict(passed=True,checks=checks));print('HILBERT CERTIFICATE TESTS PASS')
