"""Explicit homogeneous presentations. These are algebra tests, not experiments.
Homogenizing variable t is central, degree 1. No claim of IBP/gauge projection.
"""
import itertools,json,math
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
def rel(*terms):return {'degree':len(terms[0][0]),'terms':[{'word':list(w),'coefficient':str(c)} for w,c in terms if c]}
def case(name,names,rs,d,expected=None):return {'name':name,'variables':names,'relations':rs,'testDegree':d,'expectedHilbert':expected}
def polynomial(n,d):return [math.comb(i+n-1,n-1) for i in range(d+1)]
def fk(n,d):
    edges=list(itertools.combinations(range(n),2));idx={a:i for i,a in enumerate(edges)};rs=[]
    def add(*ts):rs.append(rel(*[((idx[a],idx[b]),c) for a,b,c in ts]))
    for a in edges:add((a,a,1))
    for a,b in itertools.combinations(edges,2):
        if not set(a)&set(b):add((a,b,1),(b,a,-1))
    for i,j,k in itertools.combinations(range(n),3):
        a,b,c=(i,j),(j,k),(i,k);add((a,b,1),(b,c,-1),(c,a,-1));add((b,a,1),(c,b,-1),(a,c,-1))
    expected=None
    if n==4:expected=[1,6,19,42,71,96,106,96,71,42,19,6,1,0]
    return case(f'FK{n}',[f'x{i}{j}' for i,j in edges],rs,d,expected)
def cases():
    out=[]
    n,d=4,8
    out.append(case('commuting-polynomial-4',[f'x{i}' for i in range(n)],[rel(((j,i),1),((i,j),-1)) for j in range(n) for i in range(j)],d,polynomial(n,d)))
    n,d=6,8
    out.append(case('exterior-6',[f'e{i}' for i in range(n)],[rel(((i,i),1)) for i in range(n)]+[rel(((j,i),1),((i,j),1)) for j in range(n) for i in range(j)],d,[math.comb(n,i) if i<=n else 0 for i in range(d+1)]))
    for modes in (1,2):
        n=1+2*modes;names=['t']+sum(([f'b{i}',f'a{i}'] for i in range(modes)),[]);rs=[]
        for j in range(n):
            for i in range(j):
                rs.append(rel(((j,i),1),((i,j),-1),*((((0,0),-1),) if i>0 and i%2==1 and j==i+1 else ())))
        out.append(case(f'homogenized-Weyl-{modes}-mode',names,rs,8,polynomial(n,8)))
    rs=[rel(((i,0),1),((0,i),-1)) for i in range(1,5)]
    rs += [rel(((i,i),1),((0,0),-1)) for i in range(1,5)]
    rs += [rel(((j,i),1),((i,j),1)) for j in range(1,5) for i in range(1,j)]
    out.append(case('homogenized-Clifford-4',['t','g1','g2','g3','g4'],rs,8,[sum(math.comb(4,k) for k in range(min(4,d)+1)) for d in range(9)]))
    rs=[rel(((i,0),1),((0,i),-1)) for i in range(1,4)]
    rs += [rel(((2,1),1),((1,2),-1),((0,1),2)),rel(((3,2),1),((2,3),-1),((0,3),2)),rel(((3,1),1),((1,3),-1),((0,2),-1))]
    out.append(case('homogenized-sl2',['t','f','h','e'],rs,8,polynomial(4,8)))
    for q in (2,1073741827):
        rs=[rel(((2,1),1),((1,2),-q),((0,0),-1)),rel(((1,0),1),((0,1),-1)),rel(((2,0),1),((0,2),-1))]
        out.append(case(f'homogenized-q-oscillator-{q}',['t','b','a'],rs,8,polynomial(3,8)))
    out.append(fk(3,7));out.append(fk(4,13))
    f=json.loads((ROOT/'fixtures/fk6.json').read_text());f.update(name='FK6-original-order',testDegree=4,expectedHilbert=[1,15,125,765,3831]);out.append(f)
    out.append(case('homogeneous-braid-3',['a','b'],[rel(((1,0,1),1),((0,1,0),-1))],7))
    out.append(case('long-word-33',['a','b'],[rel(((1,)*33,1),((0,)*33,-1))],34))
    return out
