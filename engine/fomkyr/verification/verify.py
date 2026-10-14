#!/usr/bin/env python3
"""Independent exact check of an exported homogeneous NC computation.

Standard-library Python only. Check ideal agreement, all bounded overlap and
inclusion compositions, and the Hilbert prefix. A timeout is INCOMPLETE.
The imported dimension proof is not replayed or required for this check.
"""
import argparse
from collections import defaultdict, deque
from fractions import Fraction
import hashlib
import json
import math
from pathlib import Path
import struct
import sys
import time
import zipfile

class Incomplete(Exception):
    pass

deadline = None
modulus = 0
term_limit = 2000000

def pulse():
    if deadline is not None and time.monotonic() >= deadline:
        raise Incomplete('Time allowance exhausted')

def scalar(c):
    return int(c) % modulus if modulus else Fraction(c)

def inverse(c):
    return pow(int(c), -1, modulus) if modulus else 1 / Fraction(c)

def clean(p):
    if modulus:
        return {w: c % modulus for w, c in p.items() if c % modulus}
    return {w: c for w, c in p.items() if c}

def relation(r):
    p = defaultdict(Fraction if not modulus else int)
    for t in r['terms']:
        w = tuple(t['word'])
        if len(w) != r['degree'] or not w:
            raise ValueError('Invalid homogeneous defining relation')
        p[w] += scalar(t['coefficient'])
    return clean(p)

def context(p, left=(), right=(), factor=1):
    return {left + w + right: factor * c for w, c in p.items()}

def subtract(a, b):
    p = dict(a)
    for w, c in b.items():
        p[w] = p.get(w, 0) - c
    return clean(p)

def normal(p, basis):
    p = clean({w: scalar(c) for w, c in p.items()})
    leaders = [(max(g), g) for g in basis]
    while p:
        pulse()
        if term_limit and len(p) > term_limit:
            raise Incomplete('Normal-form term allowance exhausted')
        changed = False
        for w in sorted(p, reverse=True):
            for lm, g in leaders:
                for j in range(len(w) - len(lm) + 1):
                    if w[j:j + len(lm)] == lm:
                        p = subtract(p, context(g, w[:j], w[j + len(lm):], p[w] * inverse(g[lm])))
                        changed = True
                        break
                if changed:
                    break
            if changed:
                break
        if not changed:
            return p
    return p

def independent_generators(relations, degree):
    # Every row constructed here is visibly in the original defining ideal.
    # A zero reduction against these rows establishes output ideal membership.
    basis = []
    def insert(p):
        r = normal(p, basis)
        if r:
            scale = inverse(r[max(r)])
            basis.append(clean({w: c * scale for w, c in r.items()}))
    for d in range(1, degree + 1):
        pulse()
        for r in relations:
            if r['degree'] == d:
                insert(relation(r))
        older = list(basis)
        for f in older:
            u = max(f)
            for g in older:
                pulse()
                v = max(g)
                k = len(u) + len(v) - d
                if 0 < k < min(len(u), len(v)) and u[-k:] == v[:k]:
                    insert(subtract(context(f, right=v[k:], factor=inverse(f[u])), context(g, left=u[:-k], factor=inverse(g[v]))))
    return basis

def compositions(basis, degree):
    for f in basis:
        u = max(f)
        for g in basis:
            pulse()
            v = max(g)
            for k in range(1, min(len(u), len(v))):
                if len(u) + len(v) - k <= degree and u[-k:] == v[:k]:
                    yield subtract(context(f, right=v[k:], factor=inverse(f[u])), context(g, left=u[:-k], factor=inverse(g[v])))
            for j in range(len(u) - len(v) + 1):
                if len(u) <= degree and u[j:j + len(v)] == v:
                    yield subtract(context(f, factor=inverse(f[u])), context(g, left=u[:j], right=u[j + len(v):], factor=inverse(g[v])))

def records(stream, degree, generators):
    count = 0
    while True:
        pulse()
        header = stream.read(32)
        if not header:
            return
        if len(header) != 32:
            raise ValueError('Truncated record header')
        magic, size, n, d, checksum, reserved = struct.unpack('<IIIIQQ', header)
        if magic != 0x31424e47 or size < 32 + 24*n or n < 1 or not 1 <= d <= degree or reserved:
            raise ValueError('Invalid basis record')
        count += n
        if term_limit and count > term_limit:
            raise Incomplete('Basis term allowance exhausted; raise --max-terms for a larger independent check')
        # Large coefficients are legal; read incrementally so the audit's time
        # allowance is checked before allocating an entire record.
        pieces=[header];remaining=size-32
        while remaining:
            pulse();part=stream.read(min(remaining,1048576))
            if not part:raise ValueError('Truncated basis record')
            pieces.append(part);remaining-=len(part)
        data=b''.join(pieces)
        if len(data) != size:
            raise ValueError('Truncated basis record')
        h = 1469598103934665603
        for i, byte in enumerate(data[32:]):
            h = ((h ^ byte) * 1099511628211) & ((1 << 64) - 1)
            if not i % 65536:
                pulse()
        if h != checksum:
            raise ValueError('Basis record checksum mismatch')
        p, previous = {}, None
        for i in range(n):
            lo, hi, c = struct.unpack_from('<QQQ', data, 32 + 24*i)
            if hi >> 63:
                if d <= 31 or lo < 32 + 24*n or lo + d > size:
                    raise ValueError('Invalid long-word encoding')
                w = tuple(data[lo:lo+d])
            else:
                value = hi << 64 | lo
                if d > 31 or value >> (4*d):
                    raise ValueError('Invalid compact word')
                w = tuple((value >> (4*j)) & 15 for j in reversed(range(d)))
            if any(x >= generators for x in w) or previous is not None and w >= previous:
                raise ValueError('Invalid generator or unsorted record')
            previous = w
            if c & 1:
                offset = c & ~7
                if offset < 32 + 24*n or offset + 8 > size:
                    raise ValueError('Invalid coefficient offset')
                limbs = struct.unpack_from('<I', data, offset)[0]
                if not limbs or offset + 8 + 4*limbs > size:
                    raise ValueError('Invalid coefficient limbs')
                value = int.from_bytes(data[offset+8:offset+8+4*limbs], 'little')
                if c & 2:
                    value = -value
            else:
                value = (c if c < 1 << 63 else c - (1 << 64)) >> 1
            if not value:
                raise ValueError('Zero encoded coefficient')
            p[w] = scalar(value)
        p = clean(p)
        if not p:
            raise ValueError('Basis row vanishes in its stated field')
        yield p

def hilbert(leaders, generators, degree):
    # Independent forbidden-word trie with failure links and exact integer DP.
    edges, failure, bad = [{}], [0], [False]
    for w in leaders:
        state = 0
        for a in w:
            if a not in edges[state]:
                edges[state][a] = len(edges)
                edges.append({});failure.append(0);bad.append(False)
            state = edges[state][a]
        bad[state] = True
    queue = deque(edges[0].values())
    while queue:
        pulse();state = queue.popleft()
        bad[state] |= bad[failure[state]]
        for a, child in edges[state].items():
            f = failure[state]
            while f and a not in edges[f]:
                f = failure[f]
            failure[child] = edges[f].get(a, 0);queue.append(child)
    transitions = []
    for state in range(len(edges)):
        row = []
        for a in range(generators):
            f = state
            while f and a not in edges[f]:
                f = failure[f]
            child = edges[f].get(a, 0);row.append(-1 if bad[child] else child)
        transitions.append(row)
    vector, out = {0: 1}, [1]
    for d in range(degree):
        pulse();new = defaultdict(int)
        for state, c in vector.items():
            for child in transitions[state]:
                if child >= 0:
                    new[child] += c
        vector = new;out.append(sum(vector.values()))
    return out

def verify(path, integrity_only=False):
    with zipfile.ZipFile(path) as archive:
        names = archive.namelist()
        if len(names) != len(set(names)) or any('/' in n or '\\' in n or n in ('.', '..') for n in names):
            raise ValueError('Invalid archive paths')
        manifest = json.loads(archive.read('manifest.json'))
        if manifest.get('schema') != 1 or manifest.get('kind') != 'fomkyr-computation-verification-bundle':
            raise ValueError('Unknown bundle schema')
        if set(names) != set(manifest['files']) | {'manifest.json'}:
            raise ValueError('Payload inventory mismatch')
        for name, record in manifest['files'].items():
            h, size = hashlib.sha256(), 0
            with archive.open(name) as f:
                while True:
                    pulse();b = f.read(1048576)
                    if not b:
                        break
                    h.update(b);size += len(b)
            if h.hexdigest() != record['sha256'] or size != record['bytes']:
                raise ValueError('Payload hash mismatch: ' + name)
        fixture = json.loads(archive.read('presentation.json'))
        variables=fixture['variables']
        if not 1<=len(variables)<=16 or len(set(variables))!=len(variables) or any(not isinstance(v,str) or not v.isascii() or not v.replace('_','a').isalnum() or v[0].isdigit() for v in variables):
            raise ValueError('Invalid generator names')
        for r in fixture['relations']:
            if not isinstance(r['degree'],int) or r['degree']<1 or not r['terms']:
                raise ValueError('Invalid defining relation')
            for t in r['terms']:
                if len(t['word'])!=r['degree'] or any(not isinstance(a,int) or not 0<=a<len(variables) for a in t['word']) or not int(t['coefficient']):
                    raise ValueError('Invalid defining term')
        ident = hashlib.sha256(json.dumps(dict(semantics='fomkyr-homogeneous-degleftlex-v1', variables=fixture['variables'], relations=fixture['relations'], modulus=fixture['modulus']), separators=(',', ':'), ensure_ascii=False).encode()).hexdigest()
        if ident != manifest['presentationSHA256'] or fixture['modulus'] != manifest['modulus'] or fixture['order'] != manifest['order'] or manifest['order'] != 'degleftlex':
            raise ValueError('Presentation/field/order binding mismatch')
        degree = manifest['completedThroughDegree']
        if not isinstance(degree, int) or degree < 1:
            raise ValueError('Invalid completed degree')
        cp = json.loads(archive.read('checkpoint.json'));payload = cp['payload']
        if cp['schema'] != 2 or hashlib.sha256(json.dumps(payload,separators=(',', ':'),ensure_ascii=False).encode()).hexdigest() != cp['sha256'] or payload['identity'] != ident or payload['completedThroughDegree'] != degree or payload.get('partial') or payload['diskBytes'] != manifest['files']['basis.gnb']['bytes'] or payload['basisSize'] != manifest['basisSize']:
            raise ValueError('Checkpoint binding mismatch')
        if manifest['basisSHA256'] != manifest['files']['basis.gnb']['sha256']:
            raise ValueError('Basis digest mismatch')
        profile_hash = hashlib.sha256(b''.join(archive.read(n) for n in ['fk6_q.h','fk6_sectors.h','proof-provenance.json'])).hexdigest()
        if manifest.get('gateProfileId') and profile_hash != manifest['gateProfileId']:
            raise ValueError('Gate profile authority mismatch')
        if integrity_only:
            return dict(passed=True,fileIntegrityPassed=True,independentGroebnerCertificate=False,mathematicalStatus='not-run')
        global modulus
        modulus = int(fixture['modulus'])
        if modulus<0 or modulus>2147483647 or modulus and (modulus < 2 or any(modulus % d == 0 for d in range(2, math.isqrt(modulus)+1))):
            raise ValueError('Characteristic must be zero or prime')
        with archive.open('basis.gnb') as f:
            basis = list(records(f, degree, len(fixture['variables'])))
        if len(basis) != manifest['basisSize']:
            raise ValueError('Basis row count mismatch')
        reference = independent_generators(fixture['relations'], degree)
        for i, row in enumerate(basis):
            if normal(row, reference):
                raise ValueError('Output rule not verified in the original defining ideal: ' + str(i+1))
        for r in fixture['relations']:
            if r['degree'] <= degree and normal(relation(r), basis):
                raise ValueError('Defining relation has nonzero output normal form')
        count = 0
        for p in compositions(basis, degree):
            if normal(p, basis):
                raise ValueError('Nonzero bounded critical composition')
            count += 1
        coefficients = hilbert([max(p) for p in basis], len(fixture['variables']), degree)
        if 'hilbert.json' in names:
            saved = json.loads(archive.read('hilbert.json')).get('coefficients')
            if saved is not None and [str(c) for c in coefficients] != [str(c) for c in saved[:degree+1]]:
                raise ValueError('Hilbert prefix mismatch')
        recount = manifest['finalScalarRecount']
        if recount.get('value') is not None and str(coefficients[degree]) != str(recount['value']):
            raise ValueError('Final scalar recount mismatch')
        return dict(passed=True,fileIntegrityPassed=True,independentGroebnerCertificate=True,mathematicalStatus='verified',completedThroughDegree=degree,rules=len(basis),criticalCompositions=count,hilbert=[str(c) for c in coefficients],profileProofReplayedHere=False,verificationDependsOnImportedDimensions=False,unrestrictedBasisComplete=False)

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('bundle',type=Path);parser.add_argument('--integrity-only',action='store_true')
    parser.add_argument('--time-limit',type=float,default=120,help='seconds; 0 is unlimited')
    parser.add_argument('--max-terms',type=int,default=2000000,help='independent verifier term allowance; 0 is unlimited')
    parser.add_argument('--out',type=Path)
    args = parser.parse_args()
    if args.time_limit < 0 or args.max_terms < 0:
        parser.error('Allowances must be nonnegative')
    global deadline, term_limit
    start = time.monotonic();deadline = start + args.time_limit if args.time_limit else None;term_limit = args.max_terms
    try:
        result = verify(args.bundle,args.integrity_only);code = 0
    except Incomplete as error:
        result = dict(passed=False,independentGroebnerCertificate=False,mathematicalStatus='incomplete',error=str(error));code = 2
    except Exception as error:
        result = dict(passed=False,independentGroebnerCertificate=False,mathematicalStatus='failed',error=str(error));code = 1
    result['elapsedSeconds'] = time.monotonic() - start;text = json.dumps(result,indent=2)+'\n'
    if args.out:
        args.out.write_text(text)
    print(text,end='');return code

if __name__ == '__main__':
    sys.exit(main())
