"""FK6 right-relative star quotient upper bounds, computed over a prime field.

Ported from the project's 2026-10-10 relative_lift_QQ pilot, preserving the
right-module (NOT algebra-quotient) conventions. This is a certificate-generating
research implementation, not a claim of Nichols injectivity or any rational rank.

M = C5 / H_+ C5, H=C4=<a1,a2,a3,a4>, a_i=x_{i6}.
Q-variant: M/QM, with Q central and in C5 (project hypotheses).

For integral presentation relations, rank_Fp(relations) <= rank_Q(relations).
Hence dim_Q(M/QM)_d <= dim_Fp(M/QM)_d, when the supplied relations are
proved to hold in the intended characteristic-zero algebra. Independence of the
finite relation set and its global completeness are separate proof obligations.
"""
from __future__ import annotations
from pathlib import Path
from functools import lru_cache
from collections import Counter, defaultdict
from hashlib import sha256
from time import monotonic
import json
from .coset_pairing import prime_check
from .grade_orbits06 import ID6, orbits, parity

DATA = Path(__file__).resolve().parents[2]/'data'/'starQ-seed.json'
KNOWN_SHA256='a3a1fccc3d907f1bcd4b2c0deed13f1e9a8047284cd515eccdd63cd7a743dd94'
TRANS = []
for i in range(5):
    s=list(range(6));s[i],s[5]=s[5],s[i];TRANS.append(tuple(s))
TRANS=tuple(TRANS)
ZERO6=tuple(range(6))


def compose(a,b):return tuple(a[b[i]] for i in range(6))


@lru_cache(maxsize=1500000)
def word_grade(w:tuple[int,...])->tuple[int,...]:
    g=ZERO6
    for i in w:g=compose(g,TRANS[i])
    return tuple(j+1 for j in g)


def relator_fixture_hash()->str:
    return sha256(DATA.read_bytes()).hexdigest()


def _load_relations(include_q:bool):
    digest=relator_fixture_hash()
    if digest!=KNOWN_SHA256:raise ValueError('Relator fixture changed; must audit mathematical provenance before use')
    data=json.loads(DATA.read_text())
    if data.get('field')!='Q' or data.get('variables')!=['a1','a2','a3','a4','a5']:
        raise ValueError('Unexpected relator conventions')
    counts=Counter();relations=defaultdict(list);q_terms=None
    for rel in data['relations']:
        rid=int(rel['id']);d=int(rel['degree']);counts[d]+=1
        terms=[];seen=set()
        for w,c in rel['primitive_relation']:
            word=tuple(w);z=int(c)
            if len(word)!=d or any(type(i)is not int or i<0 or i>4 for i in word) or z==0 or word in seen:
                raise ValueError('Invalid or duplicate polynomial term in relation')
            seen.add(word);terms.append((word,z))
        if not terms or len({word_grade(w) for w,_ in terms})!=1:
            raise ValueError('Relator must be nonempty and permutation homogeneous')
        if d==14:q_terms=terms
        if d<=12 or (include_q and d==14):relations[d].append((rid,tuple(terms)))
    expected={2:5,3:10,4:20,5:30,6:39,7:40,8:39,9:30,10:20,11:10,12:4,14:1}
    if dict(counts)!=expected or len(data['relations'])!=248 or q_terms is None or len(q_terms)!=134:
        raise ValueError('Unexpected count of 247 star relators plus the 134-term Q polynomial')
    if word_grade(q_terms[0][0])!=ID6:raise ValueError('Q should be group-neutral')
    return dict(relations)


class RelativeUpper06:
    """Sparse incremental quotient by the star relations, over F_p.

    Uses the previous-degree right action and all right-multiples of relators
    after a basis prefix; degree-1 kills the four left boundary generators.
    Bases are chosen from words; they are not asserted to be invariant under S4.
    """
    def __init__(self, prime:int=1000003, include_q:bool=False,
                 max_candidates:int=1000000, max_relation_rows:int=10000000,
                 seconds:float=120):
        prime_check(prime)
        if type(include_q)is not bool:raise ValueError('include_q must be boolean')
        import math
        if max_candidates<1 or max_relation_rows<1 or not math.isfinite(seconds) or seconds<=0:raise ValueError('Positive finite budgets required')
        self.deadline=monotonic()+seconds
        self.prime=prime;self.include_q=include_q;self.rels=_load_relations(include_q)
        self.bases=[((),)];self.actions=[None];self.history=[]
        self.max_candidates=max_candidates;self.max_relation_rows=max_relation_rows

    def _check_time(self):
        if monotonic()>self.deadline:raise RuntimeError('Reference upper time limit; no dimension certified')

    def _right(self,vector,letter,d):
        self._check_time()
        out=defaultdict(int);p=self.prime
        for i,c in vector.items():
            for j,z in self.actions[d][(i,letter)].items():out[j]=(out[j]+c*z)%p
        return {i:x for i,x in out.items() if x}

    def _prefix(self,start,index,word):
        v={index:1};d=start
        for a in word:
            d+=1;v=self._right(v,a,d)
            if not v:break
        return v

    def _relation_rows(self,d,candidate_map):
        p=self.prime
        for k in range(2,min(d,14)+1):
            for _,poly in self.rels.get(k,()):
                for i in range(len(self.bases[d-k])):
                    self._check_time()
                    out=defaultdict(int)
                    for w,coef in poly:
                        for j,z in self._prefix(d-k,i,w[:-1]).items():
                            column=candidate_map[(j,w[-1])]
                            out[column]=(out[column]+coef*z)%p
                    row={j:z for j,z in out.items() if z}
                    if row:yield row

    def degree(self,d:int):
        self._check_time()
        if type(d)is not int or d!=len(self.bases):
            raise ValueError('Only the next homogeneous degree can be computed')
        start=monotonic();prev=self.bases[-1];p=self.prime
        if len(prev)*5>self.max_candidates:
            raise RuntimeError('Candidate budget exhausted; no upper certificate generated')
        candidates=[(w+(i,),j,i) for j,w in enumerate(prev) for i in range(5)]
        candidates.sort(key=lambda entry:(entry[0].count(4),entry[0]))
        words=[entry[0] for entry in candidates]
        columns={(j,i):n for n,(_,j,i) in enumerate(candidates)}
        pivots={};nrows=0
        if d==1:
            # Right ideal H_+S kills a1,...,a4 at the cyclic generator only.
            pivots={columns[(0,i)]:{columns[(0,i)]:1} for i in range(4)}
        else:
            for row in self._relation_rows(d,columns):
                nrows+=1
                if nrows>self.max_relation_rows:
                    raise RuntimeError('Relation-row budget exhausted; no upper certificate generated')
                while row:
                    self._check_time()
                    k=max(row)
                    if k not in pivots:
                        inv=pow(row[k],-1,p)
                        pivots[k]={j:c*inv%p for j,c in row.items()}
                        break
                    coef=row[k]
                    for j,c in pivots[k].items():
                        v=(row.get(j,0)-coef*c)%p
                        if v:row[j]=v
                        else:row.pop(j,None)
        free=[j for j in range(len(words)) if j not in pivots]
        coordinates={j:i for i,j in enumerate(free)}
        @lru_cache(maxsize=None)
        def normal(j):
            self._check_time()
            if j in coordinates:return ((coordinates[j],1),)
            out=defaultdict(int)
            for k,c in pivots[j].items():
                if k==j:continue
                for i,z in normal(k):out[i]=(out[i]-c*z)%p
            return tuple((i,c) for i,c in out.items() if c)
        actions={(j,i):dict(normal(columns[(j,i)])) for j in range(len(prev)) for i in range(5)}
        basis=tuple(words[j] for j in free)
        self.actions.append(actions);self.bases.append(basis)
        record={'degree':d,'dimension_mod_prime':len(basis),'candidate_columns':len(words),
                'relation_rows':nrows,'relation_rank':len(pivots),
                'elapsed_seconds':round(monotonic()-start,3)}
        self.history.append(record)
        return record

    def through(self,d:int):
        if not 0<=d<=30:raise ValueError('Pilot degrees must be 0..30')
        while len(self.bases)<=d:self.degree(len(self.bases))
        return self.certificate(d)

    def certificate(self,d:int):
        if not 0<=d<len(self.bases):raise ValueError('Degree has not been computed')
        counts=Counter(word_grade(w) for w in self.bases[d]);partition=orbits()
        for group in partition:
            if len({counts.get(g,0) for g in group})!=1:
                raise AssertionError('S4-orbit invariance failed; do not export upper bound')
        blocks=[{'grade':list(o[0]),'orbit_size':len(o),'dimension_mod_prime':counts.get(o[0],0)}
                for o in partition if parity(o[0])==d%2]
        total=sum(b['orbit_size']*b['dimension_mod_prime'] for b in blocks)
        assert total==len(self.bases[d])
        return {'claim':'FK6_RELATIVE_MODULAR_UPPER_V1','ambientFK':6,'degree':d,
                'prime':self.prime,'targetField':'Q','quotientSide':'RIGHT_MODULE_Hplus_S',
                'includesQ':self.include_q,'numberOfStarRelators':247,
                'modularDimension':total,'orbits':blocks,
                'inputFixtureSha256':relator_fixture_hash(),
                'relatorMembershipProvenance':'project-supplied; external all-degree theorem/certificate audit required',
                'inequality':'dim_Q <= dimension_mod_prime, if input relator membership holds',
                'basisOverQClaim':False,'nicholsRankClaim':False,
                'degreeHistory':self.history[:d]}


def verify_upper(cert:dict,max_candidates:int=1000000,max_relation_rows:int=10000000,seconds:float=120)->dict:
    """Replay the integer relations from pinned source; do not trust stored ranks."""
    if cert.get('claim')!='FK6_RELATIVE_MODULAR_UPPER_V1' or cert.get('ambientFK')!=6 or cert.get('targetField')!='Q' or cert.get('quotientSide')!='RIGHT_MODULE_Hplus_S':
        raise ValueError('Wrong claim or module direction')
    d=cert.get('degree');p=cert.get('prime');include_q=cert.get('includesQ')
    if type(d)is not int or not 0<=d<=30 or type(include_q)is not bool:
        raise ValueError('Wrong degree or Q flag')
    if cert.get('inputFixtureSha256')!=KNOWN_SHA256:raise ValueError('Unknown relator fixture hash')
    solver=RelativeUpper06(p,include_q,max_candidates,max_relation_rows,seconds)
    expected=solver.through(d)
    for k in ('degree','prime','includesQ','modularDimension','orbits','inputFixtureSha256'):
        if cert.get(k)!=expected[k]:raise ValueError('Upper certificate tampered: '+k)
    return {'passed':True,'degree':d,'prime':p,'modularUpperBound':expected['modularDimension'],
            'gradeOrbitsChecked':len(expected['orbits']),'rationalEqualityClaim':False,
            'provenanceCaveat':expected['relatorMembershipProvenance']}
