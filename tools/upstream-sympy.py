#!/usr/bin/env python3
"""Independent commutative oracle for the imported upstream fixtures."""
import hashlib
import inspect
import pathlib
import itertools
import json
import sys
import sympy as sp
from sympy.polys.groebnertools import is_groebner
from sympy.polys.rings import ring

if sys.argv[1:] == ['--reference-tests']:
    from sympy.polys.tests import test_groebnertools as tests
    assert sp.__version__ == '1.14.0'
    fixture = json.loads((pathlib.Path(__file__).resolve().parents[1] / 'test/fixtures/upstream-cases.json').read_text())
    source = next(s for s in fixture['sources'] if s['repository'] == 'sympy/sympy')
    digest = hashlib.sha256(pathlib.Path(inspect.getsourcefile(tests)).read_bytes()).hexdigest()
    assert digest == source['sha256'], 'The installed upstream test source does not match the pinned file.'
    names = ['test_groebner_buchberger', 'test_groebner_f5b',
             'test_benchmark_minpoly_buchberger', 'test_benchmark_minpoly_f5b',
             'test_benchmark_katsura3_buchberger', 'test_benchmark_katsura3_f5b',
             'test_benchmark_kastura_4_buchberger', 'test_benchmark_kastura_4_f5b',
             'test_benchmark_cyclic_4_buchberger', 'test_benchmark_cyclic_4_f5b']
    for name in names:
        getattr(tests, name)()
    print(json.dumps({'version': sp.__version__, 'tests': names, 'passed': len(names), 'sourceSha256': digest}))
    sys.exit(0)

case = json.load(sys.stdin)
assert sp.__version__ == '1.14.0', 'Use the pinned SymPy 1.14.0 oracle.'
variables = tuple(sp.Symbol(v) for v in case['vars'])
names = dict(zip(case['vars'], variables))
parse = lambda text: sp.sympify(text.replace('^', '**'), locals=names)
domain = sp.GF(case['modulus']) if case['modulus'] else sp.QQ
original = [parse(p) for p in case['rels']]
candidate = [parse(p) for p in case['basis']]
g = sp.groebner(original, *variables, order='grlex', domain=domain, method='buchberger')
f5 = sp.groebner(original, *variables, order='grlex', domain=domain, method='f5b')
h = sp.groebner(candidate, *variables, order='grlex', domain=domain)
assert g.polys == f5.polys, 'Buchberger and F5B disagree.'
assert g.polys == h.polys, 'The Bergman and SymPy ideals differ.'
r, *_ = ring(','.join(case['vars']), domain, order='grlex')
b = [r.from_expr(f).monic() for f in candidate if r.from_expr(f)]
assert is_groebner(b, r), 'The supplied Bergman basis fails SymPy critical pairs.'
leading = [p.monoms(order='grlex')[0] for p in g.polys]
dimensions = []
for degree in range(7):
    normal = 0
    for powers in itertools.product(range(degree + 1), repeat=len(variables)):
        if sum(powers) != degree:
            continue
        if not any(all(a >= b for a, b in zip(powers, mon)) for mon in leading):
            normal += 1
    dimensions.append(normal)
print(json.dumps({'version': sp.__version__, 'algorithms': ['buchberger', 'f5b'],
                  'basisSize': len(g.polys), 'dimensions': dimensions,
                  'idealEquality': True, 'criticalPairs': True}))
