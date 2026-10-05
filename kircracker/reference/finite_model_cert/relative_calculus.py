"""Non-direct FK6 operator search using exact finite proper-star blocks.

Words are decomposed into H-blocks separated by the fifth edge b. H is a
known finite star; only its proven internal identities and b^2=0 are used to
compress intermediate polynomials. This is NOT a normal form for FK6, not a
five-letter Nichols identification, and not a zero test from failed derivatives.
"""
from fractions import Fraction as Q
from itertools import product
from time import monotonic
from .finite_model import FiniteStar,plus
from .deletion import all_derivatives,reference
from .core import serialize,deserialize
from .budgeted import InconclusiveBudget

class RelativeCalculus:
    def __init__(self,leaves=5,independent_model=False):
        if leaves not in [3,4,5]:raise ValueError('Finite proper star requires total leaves3..5')
        self.leaves=leaves;self.n=leaves+1;self.H=FiniteStar(leaves-1,independent=independent_model);self.b=(leaves,self.n);self.cache={}
    def _word_normalize(self,w,max_terms=20000):
        if w in self.cache:
            if len(self.cache[w])>max_terms:raise InconclusiveBudget("Relative block-product budget")
            return self.cache[w]
        if any(e[1]!=self.n or not 1<=e[0]<self.n for e in w):raise ValueError('Requires actual star words; full ambient derivative labels are retained')
        chunks=[[]]
        for e in w:
            if e==self.b:chunks.append([])
            else:chunks[-1].append((e[0],self.leaves))
        if any(not x for x in chunks[1:-1]):return {}
        choices=[]
        for chunk in chunks:
            coords=self.H.coordinates(tuple(chunk))
            if not coords:return {}
            choices.append([(tuple((e[0],self.n) for e in self.H.basis[len(chunk)][i]),c) for i,c in coords.items()])
        out={}
        for number,terms in enumerate(product(*choices)):
            if number>max_terms*4:raise InconclusiveBudget("Relative tensor expansion budget")
            word=();coef=Q(1)
            for j,(part,c) in enumerate(terms):
                if j:word+=(self.b,)
                word+=part;coef*=c
            out[word]=out.get(word,0)+coef
        out={w:c for w,c in out.items() if c}
        if len(self.cache)<100000:self.cache[w]=out
        return out
    def normalize(self,p,max_terms=10000):
        out={}
        for w,c in p.items():
            plus(out,self._word_normalize(w,max_terms),c)
            if len(out)>max_terms:raise InconclusiveBudget('Relative polynomial support budget')
        return out
    def derivatives(self,p,max_terms=10000):
        return {e:q for e,r in all_derivatives(p,self.n).items() if (q:=self.normalize(r,max_terms))}
    def replay(self,p,chain,*,max_terms=20000,seconds=30,independent=False):
        start=monotonic();p=self.normalize(p,max_terms);peak=len(p)
        for e in chain:
            if monotonic()-start>seconds:raise InconclusiveBudget('Relative replay budget')
            raw=reference(p,tuple(e),self.n,True) if independent else all_derivatives(p,self.n).get(tuple(e),{})
            p=self.normalize(raw,max_terms);peak=max(peak,len(p))
        return p,{'steps':len(chain),'peakRelativeTerms':peak,'seconds':monotonic()-start,'compression':'Only known finite proper-star identities and b^2=0','independentSuffixEvaluator':independent}
    def search(self,poly,*,max_states=1000,max_terms=3000,seconds=10):
        original=poly;poly=self.normalize(poly,max_terms);start=monotonic();seen=set();states=0;peak=0
        def go(p):
            nonlocal states,peak
            states+=1;peak=max(peak,len(p))
            if states>max_states or len(p)>max_terms or monotonic()-start>seconds:raise InconclusiveBudget('Relative witness search budget')
            if not p:return None
            if set(p)=={()}:return [],p[()]
            key=tuple(sorted(p.items()))
            if key in seen:return None
            seen.add(key)
            for e,q in sorted(self.derivatives(p,max_terms).items(),key=lambda v:(len(v[1]),max(abs(c) for c in v[1].values()),v[0])):
                if len(q)>max_terms:continue
                ans=go(q)
                if ans is not None:chain,c=ans;return [e]+chain,c
            return None
        try:ans=go(poly)
        except InconclusiveBudget:ans=None
        stats={'states':states,'peakRelativeTerms':peak,'searchSeconds':monotonic()-start}
        if ans is None:return {'claim':'INCONCLUSIVE',**stats,'zeroNotInferred':True}
        chain,c=ans
        if c.denominator!=1:raise ValueError('An integer input/derivative chain gave noninteger scalar')
        return {'claim':'RELATIVE_NABLA_NONZERO','n':self.n,'properStarLeaves':self.leaves-1,'polynomial':serialize(original),'derivatives':[list(e) for e in chain],'scalar':str(c.numerator),'finiteModelHilbert':self.H.expected,'finiteModelRanks':self.H.audit,**stats}

def check_relative_witness(cert,independent=True,**limits):
    if cert.get('claim')!='RELATIVE_NABLA_NONZERO':raise ValueError('Wrong claim')
    n=int(cert['n']);R=RelativeCalculus(n-1,independent_model=independent)
    if cert['properStarLeaves']!=n-2 or cert['finiteModelHilbert']!=R.H.expected or cert['finiteModelRanks']!=R.H.audit:raise ValueError('Improper finite-model assumptions')
    p=deserialize(cert['polynomial']);ch=cert['derivatives'];scalar=int(cert['scalar'])
    if not scalar or any(len(w)!=len(ch) for w in p) or any(not 1<=e[0]<e[1]<=n for e in ch):raise ValueError('Bad full-degree witness')
    out,stats=R.replay(p,ch,independent=independent,**limits)
    if out!={():scalar}:raise ValueError('Wrong relative scalar')
    return {'passed':True,'claim':'NONZERO','degree':len(ch),'scalar':scalar,'assumptions':'published finite proper-star dimensions and well-defined BLM nabla; no FK6 nondegeneracy',**stats}
