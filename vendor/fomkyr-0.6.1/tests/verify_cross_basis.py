"""Differential exact check of larger outputs; not a fresh GB computation."""
import sys,struct,json,time
from fractions import Fraction
from pathlib import Path
R=Path(__file__).resolve().parents[1];sys.path[:0]=[str(R/'tools'),str(R/'tests')]
from native import decode_record
from oracle import normal,diff,hilbert

def read(path):
    b=Path(path).read_bytes();at=0;out={}
    while at<len(b):
        size=struct.unpack_from('<I',b,at+4)[0];assert size>=56 and at+size<=len(b)
        g=decode_record(b[at:at+size]);at+=size;lm=max(g);assert lm not in out;lc=g[lm];out[lm]={w:Fraction(c,lc) for w,c in g.items()}
    return out

def verify(a,b,D):
    A=read(a);B=read(b);assert A.keys()==B.keys();changed=0;t=time.perf_counter()
    for lm,p in A.items():
        r=diff(p,B[lm])
        if r:
            changed+=1;assert not normal(r,list(A.values())),('new to old',lm);assert not normal(r,list(B.values())),('old to new',lm)
    report={'throughDegree':D,'rules':len(A),'equalLeadingSets':True,'differentUnreducedTails':changed,'mutualExactReduction':True,'seconds':time.perf_counter()-t,'scope':'Differential against previous exact engine, not independent completion to this degree'}
    return report
if __name__=='__main__':
    a,b,out,D=sys.argv[1:];report=verify(a,b,int(D));Path(out).write_text(json.dumps(report,indent=2));print(json.dumps(report))
