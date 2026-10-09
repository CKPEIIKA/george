#!/usr/bin/env python3
"""Native regression checks for fraction scratch lifetime and divisor validity."""
from pathlib import Path
import ctypes as C,subprocess,tempfile,os,shlex,json
root=Path(__file__).resolve().parents[1]
with tempfile.TemporaryDirectory(prefix='fomkyr-fraction-workspace-')as temp:
 lib=Path(temp)/'test.so';subprocess.run(shlex.split(os.environ.get('CC','cc'))+['-std=c11','-O3','-fno-builtin','-fPIC','-shared','-fvisibility=default',str(root/'tests/test_fraction_workspace.c'),str(root/'tests/host.c'),'-o',str(lib)],check=True,timeout=120)
 e=C.CDLL(str(lib));e.host_init.argtypes=[C.c_uint64,C.c_char_p];assert e.host_init(64<<20,None)
 rows=[]
 for name in ['test_division_invalid_magnitude','test_fraction_workspace']:
  f=getattr(e,name);f.restype=C.c_int;code=f();assert code==0,(name,'line',code);rows.append({'test':name,'passed':True})
 p=root/'results/fraction-workspace/report.json';p.parent.mkdir(parents=True,exist_ok=True);p.write_text(json.dumps({'passed':True,'cases':rows},indent=2)+'\n');print('FRACTION WORKSPACE CHECKS PASSED')
