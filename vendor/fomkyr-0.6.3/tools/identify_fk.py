#!/usr/bin/env python3
"""Identify the submitted presentation, including signs, not just relation counts.
Optional audit utility requires networkx. Does not change the computational fixture.
"""
import json,itertools
from pathlib import Path
import networkx as nx
ROOT=Path(__file__).resolve().parents[1];f=json.loads((ROOT/'fixtures/fk6.json').read_text())
vs=f['variables'];rels=f['relations'];comm=nx.Graph();comm.add_nodes_from(range(15))
for r in rels:
    t=r['terms']
    if len(t)==2 and t[0]['word']==list(reversed(t[1]['word'])):comm.add_edge(*t[0]['word'])
intersection=nx.complement(comm);line=nx.line_graph(nx.complete_graph(6));gm=nx.isomorphism.GraphMatcher(intersection,line)
assert gm.is_isomorphic();edge={i:tuple(sorted(e)) for i,e in gm.mapping.items()}
canonical=[]
for e in itertools.combinations(range(6),2):canonical.append({(e,e):1})
for i,j,k in itertools.combinations(range(6),3):
    a,b,c=(i,j),(j,k),(i,k)
    canonical.extend([{(a,b):1,(b,c):-1,(c,a):-1},{(b,a):1,(c,b):-1,(a,c):-1}])
for e,g in itertools.combinations(list(itertools.combinations(range(6),2)),2):
    if not set(e)&set(g):canonical.append({(e,g):1,(g,e):-1})
by_support={frozenset(p):p for p in canonical};equations=[]
for r in rels:
    terms=r['terms'];words=[tuple(edge[i] for i in t['word']) for t in terms];p=by_support[frozenset(words)]
    first=terms[0];fw=words[0]
    for t,w in zip(terms[1:],words[1:]):
        mask=0
        for i in first['word']+t['word']:mask^=1<<i
        rhs=(int(first['coefficient'])<0)^(p[fw]<0)^(int(t['coefficient'])<0)^(p[w]<0)
        equations.append([mask,int(rhs)])
pivots={}
for mask,rhs in equations:
    while mask:
        bit=mask.bit_length()-1
        if bit not in pivots:pivots[bit]=(mask,rhs);break
        a,b=pivots[bit];mask^=a;rhs^=b
    if not mask:assert not rhs
solution=0
for bit,(mask,rhs) in sorted(pivots.items()):
    if (mask&solution).bit_count()%2 != rhs:solution|=1<<bit
seen=set()
for r in rels:
    p={}
    for t in r['terms']:
        w=tuple(edge[i] for i in t['word']);c=int(t['coefficient'])*(-1)**sum((solution>>i)&1 for i in t['word']);p[w]=c
    canonical_p=by_support[frozenset(p)];scale=p[next(iter(p))]/canonical_p[next(iter(p))]
    assert all(p[w]==scale*canonical_p[w] for w in p);seen.add(frozenset(p))
assert len(seen)==len(canonical)==100
out={'identified':'Fomin-Kirillov algebra FK_6 over Q','checkedRelations':100,'generatorMap':{vs[i]:{'edge':[x+1 for x in edge[i]],'sign':-1 if (solution>>i)&1 else 1} for i in range(15)}}
(ROOT/'results/fk-identification.json').write_text(json.dumps(out,indent=2));print(json.dumps(out,indent=2))
