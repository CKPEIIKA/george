#!/usr/bin/env python3
from pathlib import Path
import argparse,hashlib,json,subprocess,time
R=Path(__file__).resolve().parents[1];a=argparse.ArgumentParser();a.add_argument('--compiler',default='g++');a.add_argument('--flags',default='');x=a.parse_args()
h=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
o={'compiler':subprocess.check_output([x.compiler,'--version'],text=True).splitlines()[0],'flags':x.flags,'createdUTC':time.strftime('%Y-%m-%dT%H:%M:%SZ',time.gmtime()),'binaries':{p.name:h(p) for p in (R/'bin').glob('*') if p.is_file() and p.name!='build.json'},'sources':{p.name:h(p) for p in (R/'src').glob('*') if p.is_file()}}
(R/'bin/build.json').write_text(json.dumps(o,indent=2)+'\n')
