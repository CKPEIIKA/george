#!/usr/bin/env python3
"""Actual native/WASM job exchange, profile refusal, and canonical comparison."""
import hashlib,io,json,shutil,subprocess,sys,time
from pathlib import Path
R=Path(__file__).resolve().parents[1];sys.path.insert(0,str(R/'tools'))
from canonical_audit import records,canonicalize,canonical_digest
O=R/'results/0.6.8/gate-cli';O.mkdir(parents=True,exist_ok=True)
job=O/'exchange';shutil.rmtree(job,ignore_errors=True);rows=[]
def call(name,extra,expect=0):
 cmd=[str(R/'dist/fomkyr'),*extra];t=time.perf_counter();p=subprocess.run(cmd,cwd=R,text=True,capture_output=True,timeout=90)
 (O/(name+'.stdout')).write_text(p.stdout);(O/(name+'.stderr')).write_text(p.stderr)
 assert (p.returncode==expect if expect==0 else p.returncode!=0),(name,p.returncode,p.stdout,p.stderr)
 result=json.loads(p.stdout) if expect==0 else None
 rows.append({'name':name,'command':cmd,'returncode':p.returncode,'seconds':time.perf_counter()-t,'passed':True,'result':result});return result
fixture=R/'fixtures/fk6.json'
a=call('native-d5',['-i',str(fixture),'-d','5','-j','2','--memory','128M','--workdir',str(job),'--fk-gate','--quiet']);assert a['complete'] and a['completedThroughDegree']==5
record=next(job.glob('fomkyr/*/basis.gnb'));prefix=record.read_bytes();assert a['conditionalOnImportedFkDimensions'];assert a['fkGateProfileVersion']=='0.3.1';assert a['certifiedProfileThroughDegree']==a['completeDimensionThroughDegree']==17
# Retain resume interoperability with identical upstream tables/publicly redacted provenance.
for cp in record.parent.glob('*-?.json'):
 env=json.loads(cp.read_text());env['payload']['fkGateProfileId']='a8d7ec405a7aa566c995b075d45de463dc83940db86891545ee6ea26da665314'
 env['sha256']=hashlib.sha256(json.dumps(env['payload'],separators=(',',':')).encode()).hexdigest();cp.write_text(json.dumps(env))
for name,mode in [('native-missing',[]),('wasm-missing',['--wasm'])]:
 call(name,[*mode,'--resume',str(job),'-d','6','-j','2','--memory','128M','--quiet'],expect=1)
 assert record.read_bytes()==prefix,(name,'mutated dependent job')
readable=subprocess.run([str(R/'dist/fomkyr'),'--resume',str(job),'--status','--fk-gate','--human'],cwd=R,text=True,capture_output=True,timeout=15)
assert readable.returncode==0 and 'Checkpoint:' in readable.stdout and not readable.stdout.lstrip().startswith('{')
b=call('wasm-d6',['--wasm','--resume',str(job),'-d','6','-j','2','--memory','128M','--fk-gate','--quiet']);assert b['complete'] and b['completedThroughDegree']==6 and b['resumedFromDegree']==5
assert record.read_bytes()[:len(prefix)]==prefix
prefix6=record.read_bytes()
c=call('native-d7',['--resume',str(job),'-d','7','-j','4','--memory','128M','--fk-gate','--quiet']);assert c['complete'] and c['completedThroughDegree']==7 and c['resumedFromDegree']==6
assert record.read_bytes()[:len(prefix6)]==prefix6
fresh=O/'fresh';shutil.rmtree(fresh,ignore_errors=True)
d=call('ordinary-d7',['-i',str(fixture),'-d','7','-j','4','--memory','128M','--workdir',str(fresh),'--quiet']);assert d['complete']
f=json.loads(fixture.read_text());streams=[]
for file in (record,next(fresh.glob('fomkyr/*/basis.gnb'))):
 basis,checks=canonicalize(records(file,7,15));buf=io.BytesIO();canonical_digest(basis,f['variables'],0,7,buf);streams.append(buf.getvalue())
assert streams[0]==streams[1]
report={'passed':True,'profileIdRefusedBeforeTruncation':True,'nativeWasmNativeExchange':True,'sameCanonicalAsUngatedNative':True,'checks':rows}
(O/'report.json').write_text(json.dumps(report,indent=2));print(json.dumps({k:v for k,v in report.items() if k!='checks'}))
