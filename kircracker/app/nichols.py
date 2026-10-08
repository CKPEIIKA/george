"""B6 Nichols-algebra dimension/certificate namespace.

Production support is specifically the transposition Nichols algebra B6 attached to
FK6. The generic rack/Nichols research interface is intentionally not advertised as
implemented mathematics until a second presentation backend is supplied.
"""
from __future__ import annotations
from .upper import run_upper
from .lower import lower_prefix, discover, discover_auto, replay_catalog, seed_catalog
from .assembly import factors, conv, CLASSES, CLASS, SIZES
from .util import Invalid, Incomplete, atomic_json, sha


def _lower_to(runner,D,action,dual_mode,block_seconds,force=False,grade=None):
    base=min(D,18)
    vals=lower_prefix(runner,base,force=force or action=='verify')
    if D>18:
        for d in range(19,D+1):
            if action=='verify': vals.append(replay_catalog(runner,seed_catalog(runner.work,d),force=True))
            elif action=='search' and d==D:
                vals.append(discover_auto(runner,d,block_seconds,only=grade) if dual_mode=='auto' else discover(runner,d,dual_mode,block_seconds,only=grade))
            else:
                vals.append(discover_auto(runner,d,block_seconds) if dual_mode=='auto' else discover(runner,d,dual_mode,block_seconds))
    return vals


def assemble_B6(runner,D,lower,upper):
    H,E5=factors(runner,D)
    lows=[{int(g):n for g,n in v['grades'].items()} for v in lower]
    ups=[{int(g):n for g,n in row.items()} for row in upper['grades']]
    if len(lows)!=D+1: raise Invalid('missing lower prefix')
    for d in range(D+1):
        if any(lows[d].get(g,0)>ups[d].get(g,0) for g in range(720)): raise Invalid(f'Nichols lower exceeds upper in relative degree {d}')
    L=conv(conv(H,lows,D,runner.jobs),E5,D,runner.jobs)
    U=conv(conv(H,ups,D,runner.jobs),E5,D,runner.jobs)
    degrees=[]; exact=-1
    for d in range(D+1):
        lo=[max(L[d].get(g,0) for g in range(720) if CLASS[g]==c) for c in range(11)]
        hi=[min(U[d].get(g,0) for g in range(720) if CLASS[g]==c) for c in range(11)]
        if any(a>b for a,b in zip(lo,hi)): raise Invalid('Nichols component interval inverted')
        eq=lo==hi
        if eq and exact==d-1: exact=d
        degrees.append({'degree':d,'lower':sum(x*y for x,y in zip(lo,SIZES)),'upper':sum(x*y for x,y in zip(hi,SIZES)),
                        'lowerPerPermutation':lo,'upperPerPermutation':hi,'exact':eq,
                        'exactCompatibleGrades':sum(SIZES[c] for c in range(11) if (6-len(CLASSES[c]))%2==d%2 and lo[c]==hi[c]),
                        'relativeLower':sum(lows[d].values()),'relativeUpper':sum(ups[d].values())})
    out={'schema':'kircracker-nichols-B6-v1','algebra':'B6 transposition Nichols algebra','field':'Q','requestedDegree':D,
         'exactThroughDegree':exact,'status':'EXACT' if exact==D else 'BOUNDS_ONLY','degrees':degrees,
         'classes':[list(c) for c in CLASSES],'classSizes':SIZES,
         'method':'independent complementary-pairing lower minors + separately presented Nichols upper model + finite-factor convolution',
         'doesNotAssumeFKEqualsNichols':True,'genericNicholsBackend':False}
    atomic_json(runner.work/'results'/f'nichols-B6-{D:02d}.json',out); return out


def run_B6(runner,D,action='run',dual_mode='auto',upper_seconds=0,block_seconds=0,force=False,grade=None):
    up=run_upper(runner,D,'NICHOLS-only',upper_seconds)
    if action=='upper': return {'status':'UPPER_ONLY','algebra':'B6','degree':D,'upper':up}
    low=_lower_to(runner,D,action,dual_mode,block_seconds,force,grade)
    if action=='search': return {'status':'LOWER_SEARCH_COMPLETE','algebra':'B6','degree':D,'block':low[-1]}
    return assemble_B6(runner,D,low,up)


def export_B6(runner,D,out):
    r=run_B6(runner,D,'verify',force=True)
    if r['exactThroughDegree']<D: raise Incomplete('B6 is not closed through the requested degree')
    p={'claim':'B6_EXACT_GRADED_DIMENSIONS_IN_PROJECT_CERTIFICATE_CHAIN','field':'Q','throughDegree':D,
       'classes':r['classes'],'classSizes':r['classSizes'],'dimensions':[x['upper'] for x in r['degrees']],
       'dimensionsPerClass':[x['upperPerPermutation'] for x in r['degrees']],
       'perClassMeaning':'dimension of one permutation-grade component','FK6EqualityAssumed':False,
       'proofStatus':'exact computational certificates; structural literature/proof dependencies remain separately auditable'}
    atomic_json(out,p); return {'status':'EXPORTED','algebra':'B6','degree':D,'path':str(out),'sha256':sha(out)}
