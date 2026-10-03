"""Independent verification of serialized WASM batch output on bounded cases."""
import sys,struct,json
from pathlib import Path
sys.path[:0]=[str(Path(__file__).resolve().parents[1]/'tools')]
from native import decode_record
from oracle import complete,certify,normal
source,fixture,degree=sys.argv[1:];degree=int(degree)
data=Path(source).read_bytes();basis=[];offset=0
while offset<len(data):
 size=struct.unpack_from('<I',data,offset+4)[0]
 assert size>=56 and offset+size<=len(data)
 basis.append(decode_record(data[offset:offset+size]));offset+=size
f=json.loads(Path(fixture).read_text());reference=complete(f['relations'],degree)
assert {max(p) for p in basis}=={max(p) for p in reference}
assert all(not normal(p,reference) for p in basis)
assert all(not normal(p,basis) for p in reference)
count=certify(basis,f['relations'],degree)
print(json.dumps({'degree':degree,'rules':len(basis),'criticalCompositionsChecked':count,'mutualReduction':True}))
