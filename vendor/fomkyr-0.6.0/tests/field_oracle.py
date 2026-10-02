"""Tiny independent modular oracle: tuple words and Python integer arithmetic.
For Q use oracle.py's Fraction implementation instead. No kernel data structures.
"""
class ModularOracle:
    def __init__(self,p): self.p=p
    def clean(self,a):return {w:c%self.p for w,c in a.items() if c%self.p}
    def poly(self,r):
        a={}
        for t in r['terms']:
            w=tuple(t['word']);a[w]=a.get(w,0)+int(t['coefficient'])
        return self.clean(a)
    def monic(self,a):
        a=self.clean(a)
        if not a:return a
        inv=pow(a[max(a)],-1,self.p);return {w:c*inv%self.p for w,c in a.items()}
    def context(self,a,l=(),r=(),c=1):return {l+w+r:v*c%self.p for w,v in a.items()}
    def diff(self,a,b):
        a=dict(a)
        for w,c in b.items():a[w]=a.get(w,0)-c
        return self.clean(a)
    def normal(self,a,gs):
        a=self.clean(a);gs=[self.monic(g) for g in gs if self.clean(g)]
        for steps in range(100000):
            found=False
            for w in sorted(a,reverse=True):
                for g in gs:
                    lm=max(g)
                    for j in range(len(w)-len(lm)+1):
                        if w[j:j+len(lm)]==lm:
                            a=self.diff(a,self.context(g,w[:j],w[j+len(lm):],a[w]));found=True;break
                    if found:break
                if found:break
            if not found:return a
        raise RuntimeError('Independent oracle step cap')
    def criticals(self,gs,D):
        gs=[self.monic(g) for g in gs]
        for f in gs:
            u=max(f)
            for g in gs:
                v=max(g)
                for k in range(1,min(len(u),len(v))):
                    if len(u)+len(v)-k<=D and u[-k:]==v[:k]:yield self.diff(self.context(f,r=v[k:]),self.context(g,l=u[:-k]))
                for j in range(len(u)-len(v)+1):
                    if len(u)<=D and u[j:j+len(v)]==v:yield self.diff(f,self.context(g,u[:j],u[j+len(v):]))
    def complete(self,rels,D):
        gs=[]
        def insert(a):
            b=self.normal(a,gs)
            if b:gs.append(self.monic(b))
        for d in range(1,D+1):
            for r in rels:
                if r['degree']==d:insert(self.poly(r))
            for f in list(gs):
                u=max(f)
                for g in list(gs):
                    v=max(g);k=len(u)+len(v)-d
                    if 0<k<min(len(u),len(v)) and u[-k:]==v[:k]:insert(self.diff(self.context(f,r=v[k:]),self.context(g,l=u[:-k])))
        return gs
    def certify(self,gs,rels,D):
        assert all(not self.normal(self.poly(r),gs) for r in rels if r['degree']<=D)
        n=0
        for c in self.criticals(gs,D):assert not self.normal(c,gs);n+=1
        return n
