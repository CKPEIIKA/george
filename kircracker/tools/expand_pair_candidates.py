#!/usr/bin/env python3
"""Expand a pairing row pool without misusing an old-shaped pivot journal.

The verified minor is a prefix of both new candidate streams. Discovery must
start a NEW journal: old pivots lack coordinates for newly added rows.
Free words are optional candidate sources, never assumed independent over Q.
"""
from __future__ import annotations

import argparse
import hashlib
import os
from pathlib import Path
import struct
import sys

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from app.records import EDGE, EDGES, conjugate, grade, orbit, packed, read_minor, unpacked
from app.util import Invalid, atomic_json, json_hash, load, sha


def expand(task_path, audit_path, free_path, out, row_limit):
    task_path, audit_path, free_path, out = map(Path, (task_path, audit_path, free_path, out))
    task, audit = load(task_path), load(audit_path)
    minor = Path(task['minor'])
    if not audit.get('passed') or sha(minor) != audit.get('minorSHA256'):
        raise Invalid('a hash-bound independently verified minor is required')
    meta, old_rows, old_cols = read_minor(minor)
    if meta['degree'] != task['degree'] or meta['grade'] != task['grade']:
        raise Invalid('minor/task scope mismatch')
    if not meta['rank'] < row_limit <= 250000:
        raise Invalid('expanded row limit must exceed retained rank and be <=250000')
    if out.exists():
        raise Invalid('use a fresh output directory; do not replace a live pool')
    for key in ('left', 'right'):
        if sha(Path(task[key])) != task[key+'SHA256']:
            raise Invalid('old candidate stream changed')
    raw = free_path.read_bytes()
    if not raw or len(raw) % 16:
        raise Invalid('invalid free-word candidate stream')
    degree, target = task['degree'], tuple(task['grade'])
    rows, seen = list(old_rows), set(old_rows)
    extras = []
    transport = None
    source_grade = None
    for lo, hi in struct.iter_unpack('<QQ', raw):
        v = lo | (hi << 64)
        letters = [(v >> (4*j)) & 15 for j in reversed(range(degree))]
        if v >> (4*degree) or any(a >= 5 for a in letters):
            raise Invalid('free-word star alphabet/degree')
        word = bytes(EDGE[(a+1, 6)] for a in reversed(letters))
        g = grade(word)
        if source_grade is None:
            source_grade = g
            transport = orbit(g).get(target)
            if transport is None or conjugate(transport, g) != target:
                raise Invalid('free-word sector is outside the required S4 orbit')
        if g != source_grade:
            raise Invalid('mixed free-word sector')
        word = bytes(EDGE[(transport[EDGES[e-1][0]-1], 6)] for e in word)
        if grade(word) != target:
            raise Invalid('transported row grade')
        if word not in seen:
            seen.add(word)
            extras.append(word)
    # A reproducible spread over the entire pool, rather than another lex prefix.
    extras.sort(key=lambda w: (hashlib.sha256(b'pair-expansion-v1'+w).digest(), w))
    rows.extend(extras[:row_limit-len(rows)])
    if len(rows) <= len(old_rows):
        raise Invalid('no new candidate rows')
    old_right = unpacked(Path(task['right']).read_bytes(), degree)
    cols, seen_cols = list(old_cols), set(old_cols)
    for word in old_right:
        if word not in seen_cols:
            cols.append(word)
            seen_cols.add(word)
    out.mkdir(parents=True)
    for name, words in [('left.bin', rows), ('right.bin', cols)]:
        p = out/name
        with p.open('xb') as f:
            f.write(packed(words)); f.flush(); os.fsync(f.fileno())
    manifest = {
        'schema': 'expanded-pair-candidates-v1', 'degree': degree,
        'grade': list(target), 'retainedVerifiedRank': meta['rank'],
        'retainedMinor': str(minor), 'retainedMinorSHA256': sha(minor),
        'retainedAudit': str(audit_path), 'retainedAuditSHA256': sha(audit_path),
        'sourceTask': str(task_path), 'sourceTaskSHA256': sha(task_path),
        'sourceFreeWords': str(free_path), 'sourceFreeWordsSHA256': sha(free_path),
        'sourceGradeAfterReversal': list(source_grade), 'S4Transport': list(transport),
        'availableUnionRows': len(old_rows)+len(extras), 'requestedRows': row_limit,
        'rows': len(rows), 'duals': len(cols),
        'leftSHA256': sha(out/'left.bin'), 'rightSHA256': sha(out/'right.bin'),
        'verifiedMinorPrefixedInBothStreams': True,
        'newJournalRequired': True, 'noDimensionTargetUsed': True,
        'freeWordsAssumedIndependent': False,
    }
    atomic_json(out/'MANIFEST.json', manifest)
    result = {**task, 'rows': len(rows), 'duals': len(cols),
              'left': str(out/'left.bin'), 'right': str(out/'right.bin'),
              'leftSHA256': manifest['leftSHA256'], 'rightSHA256': manifest['rightSHA256'],
              'binding': json_hash(manifest), 'state': str(out/'expanded.pair.state')}
    for key in ('stateBinding', 'fingerprint', 'pending', 'pendingSHA256',
                'verificationCacheBytes'):
        result.pop(key, None)
    for key in list(result):
        if key.startswith('_'):
            result.pop(key)
    atomic_json(out/'task.json', result)
    return manifest


if __name__ == '__main__':
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument('--task', required=True, type=Path)
    p.add_argument('--audit', required=True, type=Path)
    p.add_argument('--free-words', required=True, type=Path)
    p.add_argument('--output', required=True, type=Path)
    p.add_argument('--rows', required=True, type=int)
    args = p.parse_args()
    import json
    print(json.dumps(expand(args.task, args.audit, args.free_words, args.output, args.rows)))
