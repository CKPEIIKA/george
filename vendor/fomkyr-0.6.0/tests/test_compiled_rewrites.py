"""Independent exact checks for bounded compiled rewrites and cache fallbacks.

The independent Fraction/prime-field implementation neither reads the kernel
matcher nor reuses its compilation algorithm. Audit every exported identity.
"""
from __future__ import annotations
import ctypes as C,functools,itertools,json,random,sys,time
from fractions import Fraction
from pathlib import Path
R=Path(__file__).resolve().parents[1];sys.path[:0]=[str(R/'tools'),str(R/'tests')]
from native import Engine,check,decode_record
from oracle import complete,normal,certify
from field_oracle import ModularOracle
from physics_cases import rel,cases

reports=[]

def word_normalizer(basis,p):
    """Different divisor convention from C: longest leading word first."""
    gs=sorted(basis,key=lambda g:(len(max(g)),max(g)),reverse=True)
    leads=[(max(g),g) for g in gs]
    @functools.lru_cache(maxsize=None)
    def nf(w):
        for lm,g in leads:
            for at in range(len(w)-len(lm)+1):
                if w[at:at+len(lm)]!=lm:continue
                out={};lead=g[lm]
                for v,c in g.items():
                    if v==lm:continue
                    scale=(-c*pow(int(lead),-1,p))%p if p else -Fraction(c,lead)
                    for a,b in nf(w[:at]+v+w[at+len(lm):]).items():
                        out[a]=((out.get(a,0)+scale*b)%p if p else out.get(a,0)+scale*b)
                return {a:b for a,b in out.items() if b}
        return {w:1}
    return nf

def audit_table(e,basis,modulus):
    d=int(e.lib.gn_stat(41));status=int(e.lib.gn_stat(46))
    if status!=1:return 0
    nf=word_normalizer(basis,modulus);n=0
    for w in itertools.product(range(len(e.fixture['variables'])),repeat=d):
        key=0
        for c in w:key=(key<<4)|c
        off=int(e.lib.gn_local_rule(key))
        if not off:continue
        size=int(e.lib.gn_export_size());identity=decode_record(C.string_at(e.lib.host_pointer(off),size))
        assert max(identity)==w and identity[w]==1
        total={}
        for v,c in identity.items():
            for a,b in nf(v).items():total[a]=((total.get(a,0)+c*b)%modulus if modulus else total.get(a,0)+c*b)
        assert not any(total.values()),('invalid compiled identity',w,identity)
        n+=1
    assert n==int(e.lib.gn_stat(44)),(n,e.lib.gn_stat(44))
    return n

def run(f,D,p=0,**opts):
    t=time.perf_counter();oracle=ModularOracle(p) if p else None
    comp=oracle.complete if oracle else complete;nf=oracle.normal if oracle else normal;cert=oracle.certify if oracle else certify
    b=comp(f['relations'],D)
    e=Engine(f,D,budget=96<<20,scratch=16<<20,modulus=p,**opts);check(e.lib.gn_tune(3,12,1));e.run();g=e.basis()
    assert {max(x) for x in b}=={max(x) for x in g}
    assert all(not nf(x,g) for x in b) and all(not nf(x,b) for x in g)
    criticals=cert(g,f['relations'],D);hits=sum(int(e.lib.gn_lane_stat(i,26)) for i in range(e.workers))
    counts={k:int(e.lib.gn_stat(v)) for k,v in [('entries',44),('declined',45),('usedBytes',42),('status',46)]}
    audited=audit_table(e,b,p)
    entry={'case':f.get('name','case'),'degree':D,'field':p,'options':opts,'passed':True,'independentCompletion':True,'criticalCompositions':criticals,'compiledIdentitiesAudited':audited,'macroHits':hits,**counts,'seconds':time.perf_counter()-t}
    reports.append(entry);print(json.dumps(entry),flush=True)

if __name__=='__main__':
    if '--fk6' in sys.argv:
        f=json.loads((R/'fixtures/fk6.json').read_text());run(f,5)
        output='compiled-fk6-certificate.json'
    else:
        physics=[f for f in cases() if f['name']!='FK6-original-order' and f['testDegree']<30]
        for f in physics:
            for p in [0,101]:run(f,max(5,min(f['testDegree'],6)),p)
        # Force local macro use on long redundant relations; the small final
        # basis alone might complete before the compilation phase is reached.
        basic=rel(((1,0),1),((0,1),-2));redundant=rel(((1,)*3+(0,)*3,1),((0,)*3+(1,)*3,-512))
        quantum={'name':'quantum-plane-redundant-six','variables':['a','b'],'relations':[basic,redundant]}
        for opts in [dict(rewrite_degree=2),dict(rewrite_degree=3),dict(rewrite_degree=4,rewrite_support=1),dict(rewrite_budget=0),dict(rewrite_budget=16),dict(compiled_rewrites=False)]:run(quantum,6,optimize=47,**opts)
        for p in [2,2147483647]:run(quantum,6,p,optimize=47)
        # A non-monic pivot and large multiplier must decline the compact table,
        # never divide in integers or wrap a product.
        huge={'name':'large-local-coefficient','variables':['a','b'],'relations':[rel(((1,0),1),((0,1),-(1<<40)))]}
        run(huge,5);nonmonic={'name':'nonmonic-local','variables':['a','b'],'relations':[rel(((1,0),3),((0,1),-2))]};run(nonmonic,5)
        rng=random.Random(6062026)
        for i in range(12):
            rs=[rel(*[(tuple(rng.randrange(3) for _ in range(d)),rng.choice([-5,-2,-1,1,2,3])) for _ in range(3)]) for d in [2,2,3]]
            run({'name':f'random-mixed-{i}','variables':['a','b','c'],'relations':rs},5,rewrite_degree=3 if i%2 else 4,rewrite_support=1 if i%3==0 else 8)
        output='compiled-edge-tests.json'
    (R/'results/0.6'/output).write_text(json.dumps({'passed':True,'checks':reports},indent=2))
