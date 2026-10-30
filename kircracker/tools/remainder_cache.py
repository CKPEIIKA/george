"""Read a hash-pinned cache from a previously accepted exact replay.

This validates storage and bindings. It does not replace the mathematical replay
which produced the receipt, establish new relations, or certify Nichols coverage.
"""
from fractions import Fraction
import hashlib
import json
import lzma
from pathlib import Path


def digest(path):
    with Path(path).open('rb') as stream:
        return hashlib.file_digest(stream, 'sha256').hexdigest()


def read_verified_cache(receipt_path, *, expected_receipt_sha256,
                        expected_input_sha256, degree=23, generators=5):
    """Yield exact monic pivots, relying on the caller's accepted receipt hash."""
    receipt_path = Path(receipt_path)
    if digest(receipt_path) != expected_receipt_sha256:
        raise ValueError('remainder cache receipt hash mismatch')
    receipt = json.loads(receipt_path.read_text())
    if (receipt.get('schema') != 'kir-replayed-remainder-cache-1'
            or receipt.get('passed') is not True
            or receipt.get('independentExactReplay') is not True
            or receipt.get('inputSHA256') != expected_input_sha256):
        raise ValueError('remainder cache proof/input binding mismatch')
    data = Path(receipt['data'])
    if not data.is_absolute():
        data = receipt_path.parent / data
    if digest(data) != receipt['dataSHA256']:
        raise ValueError('remainder cache data hash mismatch')
    heads, count = set(), 0
    alphabet = set('0123456789abcdef'[:generators])
    with lzma.open(data, 'rt') as stream:
        for line in stream:
            head, entries = json.loads(line)
            row = {}
            for word, coefficient in entries:
                value = Fraction(coefficient)
                if (len(word) != degree or set(word) - alphabet
                        or not value or word in row):
                    raise ValueError('invalid cached polynomial term')
                row[word] = value
            if (not row or head != max(row) or row[head] != 1
                    or head in heads):
                raise ValueError('invalid cached pivot')
            heads.add(head)
            count += 1
            yield head, row
    if count != receipt['rank']:
        raise ValueError('remainder cache rank mismatch')
