"""Bounded independent reference tools and explicit quotient rank comparison."""
import json
import sys
import resource
from .util import ROOT,Invalid,Incomplete,load,atomic_json


def run(args):
    if getattr(args,'memory',None):
        memory=args.memory
        if memory<64*1024**2:raise Invalid('Reference memory budget must be at least 64MiB')
        soft,hard=resource.getrlimit(resource.RLIMIT_AS)
        limit=memory if hard==resource.RLIM_INFINITY else min(memory,hard)
        resource.setrlimit(resource.RLIMIT_AS,(limit,hard))
    reference=str(ROOT/'reference')
    if reference not in sys.path:sys.path.insert(0,reference)
    command=args.command
    if command=='nichols-star-low':
        from kircracker.nichols_star07 import exact_low_degree
        result=exact_low_degree(args.degree,prime=args.prime)
    elif command=='nichols-star-candidate':
        from kircracker.nichols_star07 import check_candidate_star
        result=check_candidate_star(load(args.input))
    elif command=='relative-upper-reference':
        from kircracker.relative_upper06 import RelativeUpper06
        solver=RelativeUpper06(args.prime,args.with_q,args.max_candidates,args.max_relation_rows,args.seconds)
        result=solver.through(args.degree)
    elif command=='quotient-check':
        from kircracker.rank_sandwich06 import compare
        result=compare(load(args.upper),load(args.lower),replay=not args.diagnostic,
                       max_upper_candidates=args.max_candidates,
                       max_upper_relation_rows=args.max_relation_rows,
                       max_pair_entries=args.max_entries,pair_seconds=args.seconds)
        result['comparison']='C5/(C4^+ C5 + Q C5) upper versus complementary Nichols-relative lower'
        result['fullFK6BasisComputed']=False
        result['regularQProofReplayedHere']=False
    elif command=='sector-orbits':
        from kircracker.grade_orbits06 import representatives,subgroup_stabilizer,orbit,inverse,orbit_representative
        reps=representatives(args.degree)
        result={'degree':args.degree,'parity':args.degree%2,'boundaryGroup':'S4',
                'representatives':[{'grade':list(g),'orbitSize':len(orbit(g)),
                    'stabilizerSize':len(subgroup_stabilizer(g)),
                    'oppositeRepresentative':list(orbit_representative(inverse(g)))}for g in reps]}
    elif command=='sector-projectors':
        from kircracker.stabilizer_blocks import catalog,project_words
        try:grade=tuple(map(int,args.grade))
        except ValueError as e:raise Invalid('grade must be a six-digit permutation')from e
        if args.words:
            data=load(args.words)
            if not isinstance(data,list):raise Invalid('words must be a JSON array of oriented edge words')
            result=project_words(grade,data,prime=args.prime,max_terms=args.max_terms)
        else:result=catalog(grade)
    else:raise Invalid('Unknown alternative reference command')
    if args.out:
        if args.out.exists():raise Invalid('Output exists; choose a new path')
        atomic_json(args.out,result)
    print(json.dumps(result,indent=2))
    return 2 if result.get('status')in ('INCONCLUSIVE','DIAGNOSTIC','INCONCLUSIVE_PARTIAL_RANKS')else 0


def entry(args):
    try:return run(args)
    except (MemoryError,RuntimeError)as error:
        raise Incomplete('Reference calculation incomplete: '+str(error))from error
    except (AssertionError,KeyError,TypeError,IndexError)as error:
        raise Invalid('Reference input or certificate rejected: '+str(error))from error
