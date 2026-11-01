#!/usr/bin/env python3
"""Independent normalized-bar homology and full differential replay for C Anick.

Small exact oracles only. The production feature has no Python dependency.
"""
from pathlib import Path
from fractions import Fraction as Q
from itertools import product
from functools import lru_cache
import ctypes as C,json,sys,random
ROOT=Path(__file__).resolve().parents[1];sys.path.insert(0,str(ROOT/'tools'))
from native import Engine,parse,U32,U64,check

def bind(l):
    api={'gn_anick':([U32,U64],C.c_int),'gn_anick_release':([],None),'gn_anick_stat':([U32],U64),
      'gn_anick_count':([U32,U32],U32),'gn_anick_rank':([U32,U32],U32),
      'gn_anick_chain_stat':([U32,U32],U32),'gn_anick_chain_letter':([U32,U32],U32),
      'gn_anick_term_stat':([U32,U32,U32],U32),'gn_anick_term_letter':([U32,U32,U32],U32),
      'gn_anick_term_limb':([U32,U32,U32,U32],U32)}
    for name,(args,result)in api.items():getattr(l,name).argtypes=args;getattr(l,name).restype=result

def oracle(basis,modulus):
    def scalar(n,d=1):return n*pow(d,-1,modulus)%modulus if modulus else Q(n,d)
    def put(row,k,c):
        row[k]=scalar(row.get(k,0)+c)
        if not row[k]:del row[k]
    rules=[(max(r),{w:scalar(-c,r[max(r)])for w,c in r.items()if w!=max(r)})for r in basis]
    @lru_cache(None)
    def nf(word):
        for lead,tail in rules:
            for j in range(len(word)-len(lead)+1):
                if word[j:j+len(lead)]==lead:
                    out={}
                    for w,c in tail.items():
                        for v,b in nf(word[:j]+w+word[j+len(lead):]).items():put(out,v,c*b)
                    return out
        return {word:scalar(1)}
    def rank(columns):
        piv={}
        for original in columns:
            row=dict(original)
            while row:
                k=max(row);c=row[k]
                if k not in piv:
                    inv=scalar(1,c);piv[k]={j:scalar(v*inv)for j,v in row.items()};break
                for j,v in piv[k].items():put(row,j,-c*v)
        return len(piv)
    return nf,rank,put,scalar

def bar_betti(ng,D,nf,rank,put):
    normal={d:[w for w in product(range(ng),repeat=d)if nf(w)=={w:1}]for d in range(1,D+1)}
    out={(0,0):1}
    for d in range(1,D+1):
        groups={}
        for p in range(1,d+1):
            rows=[]
            for mask in range(1<<(d-1)):
                if mask.bit_count()!=p-1:continue
                cuts=[0]+[j+1 for j in range(d-1)if mask>>j&1]+[d]
                rows.extend(product(*(normal[b-a]for a,b in zip(cuts,cuts[1:]))))
            groups[p]=rows
        ranks={1:0,d+1:0}
        for p in range(2,d+1):
            target={row:i for i,row in enumerate(groups[p-1])};columns=[]
            for row in groups[p]:
                column={}
                for j in range(p-1):
                    for w,c in nf(row[j]+row[j+1]).items():put(column,target[row[:j]+(w,)+row[j+2:]],(-1)**j*c)
                columns.append(column)
            ranks[p]=rank(columns)
        for p in range(1,d+1):out[p,d]=len(groups[p])-ranks[p]-ranks[p+1]
    return out

def run(name,variables,relations,D,modulus=0,bar=True,disk=None):
    names,rels=parse(variables,relations);e=Engine({'variables':names,'relations':rels},D,budget=256<<20,scratch=32<<20,modulus=modulus,disk=disk);e.run();bind(e.lib);l=e.lib
    basis=e.basis();nf,rank,put,scalar=oracle(basis,modulus);check(l.gn_anick(D,96<<20));n=int(l.gn_anick_stat(0))
    words=[tuple(l.gn_anick_chain_letter(i,j)for j in range(l.gn_anick_chain_stat(i,1)))for i in range(n)]
    differentials=[[]for _ in range(n)]
    def coeff(i,t,den):
        count=l.gn_anick_term_stat(i,t,3 if den else 2);v=sum(int(l.gn_anick_term_limb(i,t,den,j))<<(32*j)for j in range(count))
        return -v if not den and l.gn_anick_term_stat(i,t,4)else v
    for i in range(1,n):
        for t in range(l.gn_anick_chain_stat(i,2)):
            target=l.gn_anick_term_stat(i,t,0);word=tuple(l.gn_anick_term_letter(i,t,j)for j in range(l.gn_anick_term_stat(i,t,1)));c=scalar(coeff(i,t,0),coeff(i,t,1))
            assert len(words[target])+len(word)==len(words[i]);assert nf(word)=={word:1}
            differentials[i].append((target,word,c))
        if l.gn_anick_chain_stat(i,0)>1:
            square={}
            for target,w,c in differentials[i]:
                for end,v,b in differentials[target]:
                    for normal,a in nf(v+w).items():put(square,(end,normal),a*b*c)
            assert not square,(name,i,square)
    got={};cancellations=0
    for p in range(D+1):
        for d in range(D+1):
            c=int(l.gn_anick_count(p,d));r=int(l.gn_anick_rank(p,d));incoming=int(l.gn_anick_rank(p+1,d));got[p,d]=c-r-incoming;cancellations+=r
    if bar:
        expected=bar_betti(len(names),D,nf,rank,put)
        assert all(got.get(k,0)==expected.get(k,0)for k in set(got)|set(expected)),(name,got,expected)
    if name=='cancellation':assert got[2,3]==0 and l.gn_anick_count(2,3)==1 and l.gn_anick_rank(3,3)==1
    if name=='long-cubic':assert got[2,35]==1
    l.gn_anick_release();assert not l.gn_anick_stat(0);assert e.basis()==basis
    assert l.gn_anick(D,1)==1 and not l.gn_anick_stat(0)
    l.gn_cancel(1);assert l.gn_anick(D,96<<20)==5;l.gn_cancel(0)
    check(l.gn_anick(D,96<<20));l.gn_anick_release();assert e.basis()==basis
    return {'name':name,'degree':D,'field':modulus or 'Q','chains':n,'independentFullSquareZero':True,'independentBarHomology':bar,'augmentedRankSum':cancellations}

cases=[('free','a,b','',5),('power','a','a^3',6),('commutative-plane','a,b','b*a-a*b',5),('cancellation','a,b','a*b,b*a-a^2',5),('overlap','a,b','a*b*a,b*a*b',5),('linear','a,b','b-a,a^3',5),('all-linear','a,b','a,b',4),('rational','a,b','7*b*a-11*a*b,b^2',5),('large-rationals','a,b','4000000000000000000*b*a-3999999999999999999*a*b,b^2',4)]
checks=[]
for case in cases:checks.append(run(*case));print('PASS',case[0],flush=True)
for prime in [2,5,101]:checks.append(run('prime-'+str(prime),'a,b','a*b,b*a-a^2',5,prime));print('PASS prime',prime,flush=True)
f=json.loads((ROOT/'fixtures/fk3.json').read_text())
fk3rels=','.join('+'.join(str(t['coefficient'])+'*'+'*'.join(f['variables'][i]for i in t['word'])for t in r['terms']).replace('+-','-')for r in f['relations'])
checks.append(run('fk3-degree6',','.join(f['variables']),fk3rels,6));print('PASS independent FK3 bar homology through 6',flush=True)
checks.append(run('long-cubic','a','a^35',36,bar=False));print('PASS long words',flush=True)
# Independent deterministic small monomial/bar cases exercise tail graphs.
rng=random.Random(23011)
for i in range(8):
    words=[tuple(rng.randrange(2)for _ in range(rng.randrange(2,5)))for _ in range(4)]
    relations=','.join('*'.join('ab'[c]for c in w)for w in words)
    checks.append(run('random-'+str(i),'a,b',relations,5))
print(json.dumps({'passed':True,'checks':checks}))
