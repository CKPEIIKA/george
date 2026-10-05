"""Bounded exact derivative replay. Exhaustion is never a vanishing result."""
from time import monotonic
from .core import edge
class InconclusiveBudget(RuntimeError):pass

def replay(poly,chain,max_terms=100000,max_operations=50000000,seconds=None):
    if max_terms<1 or max_operations<1:raise ValueError('Positive budgets required')
    start=monotonic();ops=0;peak=len(poly)
    for e in chain:
        i,j=e;out={}
        for w,c in poly.items():
            for k,a in enumerate(w):
                if a!=(i,j):continue
                suffix=[];sign=1
                for x,y in w[k+1:]:
                    x=j if x==i else i if x==j else x;y=j if y==i else i if y==j else y
                    if x>y:x,y=y,x;sign=-sign
                    suffix.append((x,y));ops+=1
                key=w[:k]+tuple(suffix);v=out.get(key,0)+c*sign
                if v:out[key]=v
                else:out.pop(key,None)
                if len(out)>max_terms or ops>max_operations:raise InconclusiveBudget('Exact derivative replay exceeded the working budget; no zero/rank conclusion')
            if seconds is not None and monotonic()-start>seconds:raise InconclusiveBudget('Derivative time budget; no mathematical conclusion')
        poly=out;peak=max(peak,len(poly))
    return poly,{'peakTerms':peak,'suffixLetterOperations':ops,'seconds':monotonic()-start}
