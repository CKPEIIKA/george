#!/usr/bin/env python3
"""Derive S or S/(Q) sector targets by exact graded group convolution.

This is external-profile postprocessing, not independent dimension discovery.
The FK5 input must supply certified individual S6 grades (fixing vertex 6),
including every degree requested. Missing data are rejected, never set to zero.
"""
import argparse
import hashlib
import itertools
import json
from pathlib import Path

ORDER = "S6-lex-parity-v1"
IDENTITY = tuple(range(1, 7))


def parity(g):
    return sum(g[i] > g[j] for i in range(6) for j in range(i + 1, 6)) % 2


GROUPS = tuple(tuple(g for g in itertools.permutations(IDENTITY) if parity(g) == p)
               for p in range(2))
INDICES = tuple({g: i for i, g in enumerate(gs)} for gs in GROUPS)


def inverse(g):
    return tuple(g.index(i) + 1 for i in IDENTITY)


def compose(g, h):
    """Product of literal words: right append swaps positions of g."""
    return tuple(g[h[i] - 1] for i in range(6))


def cycle_type(g):
    unseen = set(IDENTITY)
    lengths = []
    while unseen:
        x = min(unseen)
        length = 0
        while x in unseen:
            unseen.remove(x)
            length += 1
            x = g[x - 1]
        lengths.append(length)
    return tuple(sorted(lengths, reverse=True))


def integer(x):
    if isinstance(x, bool) or not isinstance(x, (int, str)):
        raise ValueError("Dimensions must be nonnegative integers")
    n = int(x)
    if n < 0 or str(n) != str(x):
        raise ValueError("Dimensions must be canonical nonnegative integers")
    return n


def read_grades(profile, through):
    if profile.get("modulus", 0) != 0 or profile.get("field", "Q") != "Q":
        raise ValueError("Expected characteristic-zero dimension data")
    if "dimensionsPerClass" in profile:
        classes = {tuple(c): i for i, c in enumerate(profile["classes"])}
        rows = profile["dimensionsPerClass"]
        if len(rows) <= through:
            raise ValueError("Class profile does not cover the requested degree")
        result = [[integer(rows[d][classes[cycle_type(g)]]) for g in GROUPS[d % 2]]
                  for d in range(through + 1)]
    else:
        if profile.get("groupOrder") != ORDER:
            raise ValueError("Unrecognized permutation-grade ordering")
        entries = {integer(e["degree"]): e for e in profile["entries"]}
        result = [[1] + [0] * 359]
        for d in range(1, through + 1):
            if d not in entries:
                raise ValueError(f"Missing certified degree {d}; zero extension is forbidden")
            result.append([integer(v) for v in entries[d]["sectorDimensions"]])
            if sum(result[-1]) != integer(entries[d]["dimension"]):
                raise ValueError(f"Inconsistent scalar and sector dimensions at degree {d}")
    if any(len(row) != 360 for row in result):
        raise ValueError("Each parity has exactly 360 individual grades")
    if result[0] != [1] + [0] * 359:
        raise ValueError("Degree zero must be the identity grade, dimension one")
    if "dimensions" in profile:
        for d, row in enumerate(result):
            if sum(row) != integer(profile["dimensions"][d]):
                raise ValueError(f"Class profile total disagrees at degree {d}")
    return result


def fixture_identity(fixture):
    # Use exactly the native fixture's canonical field order.
    rels = []
    for r in fixture["relations"]:
        rels.append({"degree": r["degree"], "terms": [
            {"word": t["word"], "coefficient": str(t["coefficient"])} for t in r["terms"]]})
    payload = {"semantics": "fomkyr-homogeneous-degleftlex-v1",
               "variables": fixture["variables"], "relations": rels, "modulus": 0}
    return hashlib.sha256(json.dumps(payload, separators=(",", ":")).encode()).hexdigest()


def derive(ambient, factor, through, quotient):
    a = read_grades(ambient, through)
    e = read_grades(factor, through)
    nonzero = []
    for d, row in enumerate(e):
        terms = [(g, v) for g, v in zip(GROUPS[d % 2], row) if v]
        if any(g[5] != 6 for g, v in terms):
            raise ValueError("FK5 factor grades must fix vertex 6")
        nonzero.append([(inverse(g), v) for g, v in terms])
    s = []
    # Cache g*h^{-1} indices; these depend only on parity and the FK5 grade.
    products = {}
    for d in range(through + 1):
        row = list(a[d])
        for k in range(1, d + 1):
            previous = s[d - k]
            for invh, value in nonzero[k]:
                key = (d % 2, k % 2, invh)
                if key not in products:
                    products[key] = [INDICES[(d - k) % 2][compose(g, invh)]
                                     for g in GROUPS[d % 2]]
                for i, j in enumerate(products[key]):
                    row[i] -= value * previous[j]
        if any(v < 0 for v in row):
            raise ValueError(f"Negative star dimension at degree {d}; check input/convention")
        s.append(row)
    if quotient:
        t = [[v - (s[d - 14][i] if d >= 14 else 0) for i, v in enumerate(row)]
             for d, row in enumerate(s)]
        if any(v < 0 for row in t for v in row):
            raise ValueError("Negative quotient dimension under the regular-Q assumption")
        return t
    return s


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--ambient", type=Path, required=True)
    parser.add_argument("--fk5", type=Path, required=True)
    parser.add_argument("--fixture", type=Path, required=True)
    parser.add_argument("--through", type=int, default=20)
    parser.add_argument("--quotient", action="store_true", help="Use regular neutral Q of degree 14")
    parser.add_argument("--out", type=Path, required=True)
    args = parser.parse_args()
    if not 1 <= args.through <= 30:
        parser.error("through must be 1..30")
    fixture = json.loads(args.fixture.read_text())
    if fixture["variables"] != [f"a{i}" for i in range(1, 6)]:
        parser.error("fixture must use the packaged star ordering a1,...,a5")
    paths = (args.ambient, args.fk5, args.fixture)
    try:
        rows = derive(json.loads(args.ambient.read_text()), json.loads(args.fk5.read_text()),
                      args.through, args.quotient)
    except (ValueError, KeyError, IndexError) as error:
        parser.error(str(error))
    policy = {"schema": 1, "kind": "external-dimensions", "identity": fixture_identity(fixture),
              "modulus": 0, "groupOrder": ORDER, "generatorEdges": [[i, 6] for i in range(1, 6)],
              "throughDegree": args.through, "object": "T=S/(Q)" if args.quotient else "S",
              "source": "Exact graded group-convolution inversion of imported A=S*FK5 data",
              "independentComputation": False,
              "dependencies": ["all-degree star presentation", "A=S tensor FK5"] +
                              (["Q regular, neutral, degree 14"] if args.quotient else []),
              "sourceSHA256": {str(p.name): hashlib.sha256(p.read_bytes()).hexdigest() for p in paths},
              "entries": [{"degree": d, "dimension": str(sum(row)),
                           "sectorDimensions": list(map(str, row))}
                          for d, row in enumerate(rows) if d]}
    args.out.write_text(json.dumps(policy, separators=(",", ":")) + "\n")
    print(f"Derived {policy['object']} external sectors through degree {args.through}: {args.out}")


if __name__ == "__main__":
    main()
