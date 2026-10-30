#!/usr/bin/env python3
"""Import a bound discovery checkpoint into a new journal; no rank is certified."""
import argparse
import ctypes as C
import json
import struct
import sys
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from app.util import ROOT,sha,json_hash,atomic_json,Invalid

p=argparse.ArgumentParser(description=__doc__)
p.add_argument('--source',type=Path,required=True)
p.add_argument('--source-library',type=Path,required=True,help='library whose SHA256 binds the source state')
p.add_argument('--destination',type=Path,required=True)
p.add_argument('--task',type=Path,required=True,help='task with bound left/right candidate paths')
p.add_argument('--library',type=Path,default=ROOT/'bin/libtriepair.so')
a=p.parse_args();task=json.loads(a.task.read_text())
for side in ['left','right']:
 if sha(Path(task[side]))!=task[side+'SHA256']:raise Invalid('candidate SHA256 mismatch')
shape={k:task[k]for k in ['degree','rows','duals','prime','leftSHA256','rightSHA256']}
source_hash=sha(a.source_library);target_hash=sha(a.library)
old=json_hash({**shape,'librarySHA256':source_hash});new=json_hash({**shape,'librarySHA256':target_hash})
with a.source.open('rb')as f:header=f.read(100)
if len(header)!=100 or header[:8]not in {b'FKPAIR01',b'FKPAIR02'}or header[8:72].decode()!=old:raise Invalid('source library/candidate binding mismatch')
n,prime,d,rows,duals,cursor,rank=struct.unpack('<7i',header[72:])
if(n,prime,d,rows,duals)!=(6,task['prime'],task['degree'],task['rows'],task['duals']):raise Invalid('source shape mismatch')
if a.source.resolve()==a.destination.resolve()or a.destination.exists()or Path(str(a.destination)+'.parts').exists():raise Invalid('use a new destination; source must remain unchanged')
a.destination.parent.mkdir(parents=True,exist_ok=True)
lib=C.CDLL(str(a.library.resolve()));fn=lib.kp_import_checkpoint;fn.argtypes=[C.c_char_p]*4+[C.c_int]*5;fn.restype=C.c_int;lib.kp_engine_error.restype=C.c_char_p
source_digest=sha(a.source);rc=fn(str(a.source.resolve()).encode(),old.encode(),str(a.destination.resolve()).encode(),new.encode(),n,prime,d,rows,duals)
if rc:raise Invalid(lib.kp_engine_error().decode())
record={'format':'kircracker-discovery-import-v1','degree':d,'rank':rank,'cursor':cursor,'source':str(a.source.resolve()),'sourceSHA256':source_digest,'sourceLibrarySHA256':source_hash,'sourceBinding':old,'destination':str(a.destination.resolve()),'destinationSHA256':sha(a.destination),'destinationLibrarySHA256':target_hash,'destinationBinding':new,'originalUnchanged':sha(a.source)==source_digest,'isMathematicalCertificate':False,'independentMinorReplayRequired':True}
if not record['originalUnchanged']:raise Invalid('source changed during import')
atomic_json(a.destination.with_suffix(a.destination.suffix+'.import.json'),record)
print(json.dumps(record,indent=2))
