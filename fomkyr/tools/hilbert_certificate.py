#!/usr/bin/env python3
"""Build/replay small exact LOWER bounds without using fomkyr's basis.

Rows are all degree-d two-sided contexts of the original homogeneous relations.
Their rational nullspace supplies integer covectors with a diagonal nonzero minor.
Construction is intentionally bounded and is NOT a scalable FK6 degree-14 oracle.
"""
from __future__ import annotations
import argparse, hashlib, itertools, json, math, time
from fractions import Fraction
from pathlib import Path

def identity(f,modulus=0):
    obj=dict(semantics='fomkyr-homogeneous-degleftlex-v1',variables=f['variables'],relations=f['relations'],modulus=modulus)
    return hashlib.sha256(json.dumps(obj,separators=(',',':'),ensure_ascii=False).encode()).hexdigest()

def contexts(f,d):
    n=len(f['variables'])
    for rel in f['relations']:
        r=rel['degree']
        if r>d: continue
        ts=[]
        for t in rel['terms']:
            col=0
            for x in t['word']: col=col*n+x
            ts.append((col,Fraction(t['coefficient'])))
        for left in range(d-r+1):
            nr=n**(d-r-left)
            for a in range(n**left):
                for b in range(nr):
                    row={}
                    for w,c in ts:
                        j=(a*n**r+w)*nr+b
                        row[j]=row.get(j,Fraction(0))+c
                    yield {j:v for j,v in row.items() if v}

def construct(f,d,max_columns=20000):
    n=len(f['variables']);N=n**d
    if N>max_columns: raise ValueError(f'{N} columns exceed bounded certificate-construction budget')
    basis={}
    for row in contexts(f,d):
        while row:
            p=max(row);c=row[p]
            if p not in basis:
                basis[p]={j:v/c for j,v in row.items()};break
            for j,v in basis[p].items():
                z=row.get(j,Fraction(0))-c*v
                if z: row[j]=z
                else: row.pop(j,None)
    free=[j for j in range(N) if j not in basis]
    expr={j:{i:Fraction(1)} for i,j in enumerate(free)}
    for p in sorted(basis):
        v={}
        for j,c in basis[p].items():
            if j==p:continue
            for k,x in expr[j].items():
                z=v.get(k,Fraction(0))-c*x
                if z:v[k]=z
                else:v.pop(k,None)
        expr[p]=v
    vectors=[{} for _ in free]
    for col,v in expr.items():
        for k,x in v.items(): vectors[k][col]=x
    packed=[]
    for v in vectors:
        den=1
        for x in v.values(): den=math.lcm(den,x.denominator)
        ints={j:int(x*den) for j,x in v.items()}
        if any(abs(x)>2**63-1 for x in ints.values()): raise ValueError('witness exceeds exact signed-64 replay format')
        packed.append([[j,str(x)] for j,x in sorted(ints.items())])
    return {'degree':d,'dimension':str(len(free)),'pivots':free,'vectors':packed}

def verify(f,cert):
    if cert.get('schema')!=1 or cert.get('kind')!='integer-duals' or cert.get('modulus')!=0 or cert.get('identity')!=identity(f):raise ValueError('wrong certificate/input/field')
    previous=0;checked=0
    for e in cert['entries']:
        d=e['degree'];L=int(e['dimension']);p=e['pivots'];N=len(f['variables'])**d
        if d<=previous or len(p)!=L or sorted(set(p))!=p or (p and (p[0]<0 or p[-1]>=N)):raise ValueError('bad pivots/degrees')
        previous=d
        if len(e['vectors'])!=L:raise ValueError('bad vector count')
        rows=list(contexts(f,d))
        for k,pairs in enumerate(e['vectors']):
            v={}
            for col,x in pairs:
                if col in v or not 0<=col<N or not int(x):raise ValueError('invalid sparse covector')
                v[col]=int(x)
            if not v.get(p[k]) or any(v.get(p[j],0) for j in range(L) if j!=k):raise ValueError('minor is not diagonal/nonzero')
            for row in rows:
                if sum(c*v.get(j,0) for j,c in row.items()):raise ValueError('covector fails an original relation context')
                checked+=1
    return dict(passed=True,exact=True,direction='lower bound on rational quotient dimension',relationContextEvaluations=checked)

def main():
    p=argparse.ArgumentParser(description=__doc__);p.add_argument('fixture',type=Path);p.add_argument('--through',type=int);p.add_argument('--out',type=Path);p.add_argument('--verify',type=Path);a=p.parse_args();f=json.loads(a.fixture.read_text());t=time.perf_counter()
    if a.verify: c=json.loads(a.verify.read_text())
    else:
        if not a.through or not a.out:p.error('--through and --out are required for construction')
        c=dict(schema=1,kind='integer-duals',identity=identity(f),modulus=0,source='Exact original-relation nullspace; independently replayable integer duals',entries=[construct(f,d) for d in range(min(r['degree'] for r in f['relations']),a.through+1)])
        a.out.parent.mkdir(parents=True,exist_ok=True);a.out.write_text(json.dumps(c,separators=(',',':'))+'\n')
    result=verify(f,c);result['elapsedSeconds']=time.perf_counter()-t;print(json.dumps(result))
if __name__=='__main__':main()
