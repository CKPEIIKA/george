#!/usr/bin/env python3
"""Native/WASM record parity and portable partial checkpoint replay."""
from contextlib import nullcontext
from pathlib import Path
import subprocess,sys,tempfile,json,shutil
R=Path(__file__).resolve().parents[1];(R/'results/gm').mkdir(parents=True,exist_ok=True);sys.path[:0]=[str(R/'tools')]
from canonical_audit import records,canonicalize
out=[]
persistent=R/'results/gm/wasm-test-data';persistent.mkdir(exist_ok=True)
with nullcontext(persistent)as tmp:
 tmp=Path(tmp)
 for child in tmp.iterdir():
  if child.is_dir():shutil.rmtree(child)
 for fixture,D in [('pair-plan-fk4.json',6),('fk6.json',4),('modular-stress-0.json',5)]:
  variables=json.loads((R/'fixtures'/fixture).read_text())['variables'];ref=None
  for mode in ['off','multiply','leading-word','backward','all']:
   dest=tmp/(fixture+mode)
   cmd=[str(R/'dist/fomkyr'),'--wasm','-i',str(R/'fixtures'/fixture),'-d',str(D),'-j','1','--memory','256M','--workdir',str(dest),'--gm',mode,'--quiet','--hilbert','--export','--pair-order','word','--plan-min-degree','2']
   if mode!='off':cmd+=['--no-chain']
   p=subprocess.run(cmd,capture_output=True,text=True,timeout=120);assert not p.returncode,(p.stdout,p.stderr);result=json.loads(p.stdout)
   basis=next((dest/'fomkyr').glob('alg-*/basis.gnb'));b=canonicalize(list(records(basis,D,len(variables))))[0]
   if ref is None:ref=b
   assert b==ref,(fixture,mode);assert result['gm']['mask']=={'off':0,'multiply':1,'leading-word':2,'backward':4,'all':7}[mode]
   out.append(dict(name=fixture,mode=mode,execution=result['executionMode'],passed=True))
 # Complete baseline for the cross-runtime resume, then generate both partials.
 f=R/'fixtures/fk6.json';refdir=tmp/'native-reference';base=[str(R/'dist/fomkyr'),'-i',str(f),'-d','6','-j','1','--memory','256M','--quiet','--pair-order','word','--plan-min-degree','2']
 p=subprocess.run(base+['--workdir',str(refdir)],capture_output=True,text=True,timeout=120);assert not p.returncode,p.stderr
 reference=canonicalize(list(records(next((refdir/'fomkyr').glob('alg-*/basis.gnb')),6,15)))[0]
 for start_wasm in [False,True]:
  dest=tmp/('cross-from-wasm'if start_wasm else'cross-from-native')
  for seconds in [0.02,0.06,0.12,0.25,0.5,1.0]:
   if dest.exists():shutil.rmtree(dest)
   begin=base+['--workdir',str(dest),'--gm','all','--no-chain','--time-limit',str(seconds),'--checkpoint-seconds','0.01']
   if start_wasm:begin+=['--wasm']
   p=subprocess.run(begin,capture_output=True,text=True,timeout=120)
   assert p.returncode in [0,124],(p.stdout,p.stderr)
   cps=[json.loads(q.read_text())['payload']for q in(dest/'fomkyr').glob('alg-*/partial-*.json')]
   cps=[x for x in cps if x['currentDegree']>=3 and x['basisSize']>0]
   if cps:break
  assert cps,(start_wasm,'no partial produced')
  last=max(cps,key=lambda x:x['sequence']);assert int.from_bytes(bytes.fromhex(last['frontier'])[8:16],'little')==6
  resume=[str(R/'dist/fomkyr'),'--resume',str(dest),'-d','6','-j','2','--memory','256M','--quiet','--gm','off']
  if not start_wasm:resume+=['--wasm']
  print('CROSS',start_wasm,last['currentDegree'],last['basisSize'],flush=True)
  p=subprocess.run(resume,capture_output=True,text=True,timeout=120);assert not p.returncode,(p.stdout,p.stderr)
  r=json.loads(p.stdout);basis=canonicalize(list(records(next((dest/'fomkyr').glob('alg-*/basis.gnb')),6,15)))[0];assert basis==reference;assert r['resumedPartial'] if 'resumedPartial'in r else r['resumedFromDegree']>0
  out.append(dict(name='cross-runtime-v6',fromWasm=start_wasm,passed=True,partialCurrentDegree=last['currentDegree']))
(R/'results/gm/gm-wasm-tests.json').write_text(json.dumps(dict(passed=True,cases=out),indent=2));print('GM WASM PASS',len(out),flush=True)
