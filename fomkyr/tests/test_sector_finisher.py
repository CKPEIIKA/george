#!/usr/bin/env python3
"""Bounded checkpoint-coverage and scheduler-flow properties."""
from pathlib import Path
import ctypes as C
import json
import os
import shlex
import subprocess
import tempfile
ROOT=Path(__file__).resolve().parents[1]
with tempfile.TemporaryDirectory(prefix='fomkyr-sector-properties-')as folder:
 library=Path(folder)/'properties.so'
 subprocess.run(shlex.split(os.environ.get('CC','cc'))+['-std=c11','-O2','-fPIC','-shared','-fvisibility=default',str(ROOT/'tests/test_sector_finisher.c'),str(ROOT/'tests/host.c'),'-o',str(library)],check=True,timeout=120)
 lib=C.CDLL(str(library));lib.host_init.argtypes=[C.c_uint64,C.c_char_p];assert lib.host_init(256<<20,None)
 rows=[]
 for name,args in [('test_sector_frontier',(0,)),('test_sector_frontier',(7,)),('test_sector_max_pending',()),('test_sector_flow',()),('test_sector_cooldown',()),('test_sector_gap_range',())]:
  fn=getattr(lib,name);fn.argtypes=[C.c_uint32]*len(args);fn.restype=C.c_int;result=fn(*args);assert result==0,(name,args,'failing C line',result);rows.append({'name':name,'arguments':args,'passed':True})
 out=ROOT/'results/sector-finisher/properties.json';out.parent.mkdir(parents=True,exist_ok=True);out.write_text(json.dumps({'passed':True,'cases':rows},indent=2)+'\n');print('SECTOR FINISHER PROPERTIES PASS',len(rows))
