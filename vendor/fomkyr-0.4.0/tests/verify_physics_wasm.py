import sys,json,struct,time
from pathlib import Path
R=Path(__file__).resolve().parents[1];sys.path[:0]=[str(R/'tools'),str(R/'tests')]
from native import decode_record
from oracle import complete,normal,certify,hilbert
from field_oracle import ModularOracle
out=[]
for e in json.loads(Path(sys.argv[1]).read_text()):
 t=time.perf_counter();data=Path(e['record']).read_bytes();at=0;b=[]
 while at<len(data):
  size=struct.unpack_from('<I',data,at+4)[0];assert size>=56 and at+size<=len(data);b.append(decode_record(data[at:at+size]));at+=size
 oracle=ModularOracle(e['modulus']) if e['modulus'] else None
 comp=oracle.complete if oracle else complete;nf=oracle.normal if oracle else normal;cert=oracle.certify if oracle else certify
 g=comp(e['fixture']['relations'],e['degree']);assert {max(p) for p in b}=={max(p) for p in g};assert all(not nf(p,g) for p in b);assert all(not nf(p,b) for p in g)
 n=cert(b,e['fixture']['relations'],e['degree']);assert list(map(int,e['hilbert']))==hilbert([max(p) for p in b],len(e['fixture']['variables']),e['degree'])
 out.append({k:e[k] for k in ['name','modulus','degree','bits','workers','shared','progressError']});out[-1].update(passed=True,independentCompletion=True,mutualReduction=True,criticalCompositionsChecked=n,seconds=time.perf_counter()-t)
 print(json.dumps(out[-1]),flush=True)
(R/'results/physics-wasm-matrix.json').write_text(json.dumps({'passed':True,'mode':'Actual shared WASM32/4 workers; Node filesystem emulates OPFS, no browser conformance claim','cases':out},indent=2))
