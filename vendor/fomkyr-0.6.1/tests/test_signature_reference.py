"""Independent ordinary completion validates the research signature prototype.
Turning only syzygy screening off isolates its saved regular reductions; neither
variant is a production-kernel speed comparison.
"""
import sys,json,time
from pathlib import Path
R=Path(__file__).resolve().parents[1];sys.path[:0]=[str(R/'research'),str(R/'tests')]
import signature_reference as sig
import oracle
from physics_cases import cases
out=[]
for f in cases():
 if f['name'].startswith('long-'):continue
 D=3 if f['name']=='FK6-original-order' else min(5,f['testDegree'])
 baseline=oracle.complete(f['relations'],D)
 g,c,t=sig.complete(f['relations'],D)
 h,un,u=sig.complete(f['relations'],D,syzygies=False)
 assert all(not oracle.normal(x,baseline) for x in g+h)
 assert all(not oracle.normal(x,g) for x in baseline)
 assert all(not oracle.normal(x,h) for x in baseline)
 pairs=oracle.certify(g,f['relations'],D)
 entry={'case':f['name'],'degree':D,'passed':True,'independentOrdinaryCompletion':True,'criticalCompositionsChecked':pairs,'withSyzygy':c,'withoutSyzygy':un,'secondsWith':t,'secondsWithout':u}
 out.append(entry);print(json.dumps(entry),flush=True)
(R/'results/0.5/signature-reference-tests.json').write_text(json.dumps({'passed':True,'productionWasm':False,'cases':out},indent=2))
