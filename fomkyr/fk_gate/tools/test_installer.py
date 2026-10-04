#!/usr/bin/env python3
"""Verify dry-run, idempotence and all-or-nothing anchor failure on exact originals."""
from pathlib import Path
import tempfile,subprocess,sys,hashlib,json
src=Path(sys.argv[1]);mod=Path(__file__).resolve().parents[1];files=['src/kernel.c','src/kernel.h','native/cli.c','web/engine.js']
with tempfile.TemporaryDirectory() as tmp:
 r=Path(tmp)
 for name in files:
  p=src/(name+'.before-fkgate');assert p.exists();(r/name).parent.mkdir(parents=True,exist_ok=True);(r/name).write_bytes(p.read_bytes())
 original={name:(r/name).read_bytes() for name in files}
 cmd=['python3',str(mod/'tools/install_reference.py'),str(r)]
 subprocess.run(cmd,check=True,stdout=subprocess.DEVNULL)
 assert all((r/name).read_bytes()==data for name,data in original.items()) and not (r/'fk_gate').exists()
 subprocess.run(cmd+['--apply'],check=True,stdout=subprocess.DEVNULL);after={name:(r/name).read_bytes() for name in files}
 assert b'fg_sector_upper[360]' in after['src/kernel.c']
 subprocess.run(cmd+['--apply'],check=True,stdout=subprocess.DEVNULL);assert all((r/name).read_bytes()==v for name,v in after.items())
 for name,data in original.items():(r/name).write_bytes(data)
 p=r/'src/kernel.c';p.write_text(p.read_text().replace('static int reduce_pair_impl','static int changed_reduce_pair_impl'))
 before={name:(r/name).read_bytes() for name in files};result=subprocess.run(cmd+['--apply'],capture_output=True,text=True)
 assert result.returncode!=0 and all((r/name).read_bytes()==v for name,v in before.items())
report={'passed':True,'checks':['dry-run no writes','exact-source application','idempotent reapplication','changed-anchor refusal before source writes']}
(mod/'evidence/installer.json').write_text(json.dumps(report,indent=2));print('PASS installer')
