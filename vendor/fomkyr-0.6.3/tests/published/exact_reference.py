"""Independent sparse Fraction polynomial arithmetic, extracted verbatim from audit_one.py.
No compiled/native engine is called. All degrees are homogeneous.
"""
from fractions import Fraction
import heapq
D=10**6 # callers explicitly supply the finite composition bound

def monic(row):
    if not row:
        return {}
    lm = max(row)
    c = row[lm]
    return {w: Fraction(v, c) for w, v in row.items() if v}

class Reducer:

    def __init__(self, gs):
        self.rules = []
        self.cache = {}
        self.steps = 0
        for g in gs:
            if not g:
                continue
            lm = max(g)
            assert all((len(w) == len(lm) for w in g))
            lc = Fraction(g[lm])
            self.rules.append((lm, tuple(((w, Fraction(c) / lc) for w, c in g.items() if w != lm))))

    def match(self, w):
        if w in self.cache:
            return self.cache[w]
        ans = None
        for u, tail in self.rules:
            for j in range(len(w) - len(u) + 1):
                if w[j:j + len(u)] == u:
                    ans = (w[:j], w[j + len(u):], tail)
                    break
            if ans is not None:
                break
        if len(self.cache) < 200000:
            self.cache[w] = ans
        return ans

    def nf(self, row):
        data = {w: Fraction(c) for w, c in row.items() if c}
        heap = [(tuple((-a for a in w)), w) for w in data]
        heapq.heapify(heap)
        res = {}
        while heap:
            _, w = heapq.heappop(heap)
            c = data.pop(w, None)
            if c is None:
                continue
            rule = self.match(w)
            if rule is None:
                res[w] = c
                continue
            left, right, tail = rule
            self.steps += 1
            if self.steps > 5000000:
                raise RuntimeError('independent reduction work limit, not a completed audit')
            for v, b in tail:
                ww = left + v + right
                assert ww < w
                old = data.get(ww, 0)
                val = old - c * b
                if val:
                    data[ww] = val
                    if not old:
                        heapq.heappush(heap, (tuple((-a for a in ww)), ww))
                else:
                    data.pop(ww, None)
        return res

def sub(a, b):
    p = dict(a)
    for w, c in b.items():
        v = p.get(w, 0) - c
        if v:
            p[w] = v
        else:
            p.pop(w, None)
    return p

def context(p, l=(), r=(), scale=1):
    return {l + w + r: scale * c for w, c in p.items()}

def compositions(gs, degree=None, bound=D, include=True):
    for f in gs:
        u = max(f)
        for g in gs:
            v = max(g)
            for k in range(1, min(len(u), len(v))):
                d = len(u) + len(v) - k
                if d <= bound and (degree is None or d == degree) and (u[-k:] == v[:k]):
                    yield sub(context(f, r=v[k:], scale=1 / Fraction(f[u])), context(g, l=u[:-k], scale=1 / Fraction(g[v])))
            if include:
                for j in range(len(u) - len(v) + 1):
                    if len(u) <= bound and (degree is None or len(u) == degree) and (u[j:j + len(v)] == v):
                        yield sub(context(f, scale=1 / Fraction(f[u])), context(g, l=u[:j], r=u[j + len(v):], scale=1 / Fraction(g[v])))

def hseries(gs, n, bound):
    leaders = set(map(max, gs))
    states = {()}
    for w in leaders:
        for k in range(1, len(w)):
            states.add(w[:k])
    states = sorted(states)
    index = {s: i for i, s in enumerate(states)}
    edges = []
    for s in states:
        row = []
        for c in range(n):
            w = s + (c,)
            if any((w[-len(v):] == v for v in leaders if len(v) <= len(w))):
                row.append(-1)
                continue
            while w not in index:
                w = w[1:]
            row.append(index[w])
        edges.append(row)
    counts = [0] * len(states)
    counts[index[()]] = 1
    hs = [1]
    for _ in range(bound):
        nxt = [0] * len(states)
        for i, c in enumerate(counts):
            if c:
                for j in edges[i]:
                    if j >= 0:
                        nxt[j] += c
        counts = nxt
        hs.append(sum(counts))
    return hs
