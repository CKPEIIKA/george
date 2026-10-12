#!/usr/bin/env python3
from pathlib import Path
import ctypes,json,os,shlex,subprocess,tempfile
ROOT=Path(__file__).resolve().parents[1]
with tempfile.TemporaryDirectory(prefix='fomkyr-output-lifecycle-')as folder:
 lib=Path(folder)/'lifecycle.so'
 subprocess.run(shlex.split(os.environ.get('CC','cc'))+['-O2','-std=c11','-fno-builtin','-fPIC','-shared',str(ROOT/'tests/test_output_arena_lifecycle.c'),str(ROOT/'tests/host.c'),'-o',str(lib)],check=True,timeout=120)
 x=ctypes.CDLL(str(lib));x.host_init.argtypes=[ctypes.c_uint64,ctypes.c_char_p];assert x.host_init(256<<20,None)
 x.test_completed_output_retirement.restype=ctypes.c_int;result=x.test_completed_output_retirement();assert result==0,('failing C line',result)
 out=ROOT/'results/output-arena-lifecycle.json';out.parent.mkdir(exist_ok=True);out.write_text(json.dumps({'passed':True,'completedWorkerRestoresArena':True,'completedCommitRestoresArena':True,'alternatingOutputArenas':True,'reusedWorkspaceIsNotAliased':True},indent=2)+'\n')
 print('OUTPUT_ARENA_LIFECYCLE_PASS')
