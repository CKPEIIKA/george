#!/usr/bin/env python3
"""Compare new native maps with the inherited C++ implementation; not a GB benchmark."""
from pathlib import Path
import tempfile,zipfile,subprocess,json,hashlib,sys,time
R=Path(__file__).resolve().parents[1];out=R/'evidence';out.mkdir(exist_ok=True)
with tempfile.TemporaryDirectory(prefix='kirchecker-baseline-') as tmp:
 t=Path(tmp)
 with zipfile.ZipFile(R/'proof/frontier-0.5.0.zip') as z:
  for n in ['common.hpp','module_builder.cpp']:(t/n).write_bytes(z.read('kircracker-frontier/src/'+n))
 subprocess.run(['g++','-std=c++17','-O3','-flto','-pthread',str(t/'module_builder.cpp'),'-o',str(t/'old')],check=True)
 lib=t/'library';subprocess.run([sys.executable,str(R/'tools/prepare_inputs.py'),str(lib)],stdout=subprocess.DEVNULL,check=True)
 checks=[]
 for field,d in [(0,6),(2,6),(31991,6),(2,10)]:
  streams=[];states=[]
  for exe,label in [(t/'old','old'),(R/'bin/kir-relative','new')]:
   f=t/f'{label}-{field}-{d}.json';args=[exe,'--n','6','--degree',str(d),'--prime',str(field),'--threads','2','--relations',lib/'FK-original.rel','--dump',f,'--dump-degree',str(d),'--max-cols','3000000','--max-terms','180000000','--seconds','120']
   if field==2:args.append('--gf2-packed')
   p=subprocess.run(list(map(str,args)),capture_output=True,text=True,timeout=130);assert p.returncode==0,p.stdout+p.stderr
   streams.append(f.read_bytes());states.append(json.loads(p.stdout.splitlines()[-1]))
  assert streams[0]==streams[1],(field,d,'different actual maps')
  checks.append({'field':field,'degree':d,'allActionMapBytesEqual':True,'relativePrefix':states[1]['relative'],'sha256':hashlib.sha256(streams[1]).hexdigest()})
 (out/'baseline-map-comparison.json').write_text(json.dumps({'passed':True,'scope':'byte equality of complete native module words and action maps; not independent fresh Groebner completion','cases':checks},indent=2));print(json.dumps(checks,indent=2))
