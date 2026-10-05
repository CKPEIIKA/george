#!/usr/bin/env python3
"""Parse exported fractions/powers and compare with independent subword reduction."""
import json
from pathlib import Path
import re
import sys
from fractions import Fraction
ROOT = Path(__file__).resolve().parents[1]
sys.path[:0] = [str(ROOT / 'tools'), str(ROOT / 'tests')]
from canonical_audit import records
from test_normalization import expected


def read_text(text, variables, modulus):
    source = re.sub(r'%[^\n]*', '', text).replace('Done', '').strip()
    names = {v: i for i, v in enumerate(variables)}
    out = {}
    for polynomial in source.split(','):
        polynomial = re.sub(r'\s+', '', polynomial)
        if not polynomial:
            continue
        row = {}
        for m in re.finditer(r'([+-]?)([^+-]+)', polynomial):
            scalar = -1 if m[1] == '-' else 1
            body = m[2]
            c = re.match(r'(\d+)(?:/(\d+))?\*', body)
            if c:
                scalar *= Fraction(int(c[1]), int(c[2] or 1))
                body = body[c.end():]
            word = []
            for factor in body.split('*'):
                v = re.fullmatch(r'([A-Za-z_][A-Za-z_0-9]*)(?:\^(\d+))?', factor)
                assert v and v[1] in names, ('invalid factor', factor)
                word.extend([names[v[1]]] * int(v[2] or 1))
            if modulus:
                assert Fraction(scalar).denominator == 1
                scalar = int(scalar) % modulus
            row[tuple(word)] = scalar
        assert row[max(row)] == 1
        assert max(row) not in out
        out[max(row)] = row
    return out


def main():
    for entry in json.loads(Path(sys.argv[1]).read_text()):
        fixture = entry['fixture']
        raw = list(records(Path(entry['record']), entry['degree'], len(fixture['variables'])))
        actual = read_text(Path(entry['text']).read_text(), fixture['variables'], entry['modulus'])
        assert list(actual) == sorted(actual, key=lambda w: (len(w), tuple(-x for x in w))), 'export row order'
        assert actual == expected(raw, entry['modulus']), (fixture.get('name', 'unnamed'), entry.get('bits'), entry.get('execution'))
        print('INDEPENDENT NORMALIZATION', fixture.get('name', 'unnamed'), entry.get('bits'), entry.get('execution'), len(actual))


if __name__ == '__main__':
    main()
