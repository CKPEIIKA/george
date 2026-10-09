#!/usr/bin/env python3
"""Rebuild data/star14-leading-words.json from star14.gnb in the proof archive.

The index lists every record of the degree-14 star basis: its leading word,
term count, byte offset, length and stored checksum. It is derived data, so the
repository keeps the archive's checksum instead of the 9 MiB file.
"""
from pathlib import Path
import hashlib, json, struct, sys, zipfile

ROOT = Path(__file__).resolve().parents[1]
MEMBER = 'kircracker-frontier/certificates/representation/star14.gnb'


def index(data, degree=14, generators=5):
    rows, offset = [], 0
    while offset < len(data):
        magic, size, n, d, check, reserved = struct.unpack_from('<IIIIQQ', data, offset)
        if magic != 0x31424e47 or reserved or not n or size < 32 + 24 * n or offset + size > len(data):
            raise SystemExit('invalid GNB record at byte %d' % offset)
        if d > degree:
            break
        # Words are stored in decreasing order: the first is the leading word.
        lo, hi, _ = struct.unpack_from('<QQQ', data, offset + 32)
        if hi >> 63:
            word = list(data[offset + lo:offset + lo + d])
        else:
            value = lo + (hi << 64)
            word = [(value >> (4 * j)) & 15 for j in reversed(range(d))]
        rows.append({'id': len(rows), 'degree': d, 'leadingWord': word, 'terms': n,
                     'offset': offset, 'bytes': size, 'checksum': check})
        offset += size
    return {'sourceBasisSHA256': hashlib.sha256(data).hexdigest(), 'degree': degree,
            'generators': generators, 'rows': rows,
            'scope': 'leading-word data for reproducing chain counts; not original-ideal or completion certification'}


def main():
    archive = Path(sys.argv[1]) if len(sys.argv) > 1 else ROOT / 'proof/frontier-0.5.0.zip'
    target = Path(sys.argv[2]) if len(sys.argv) > 2 else ROOT / 'data/star14-leading-words.json'
    with zipfile.ZipFile(archive) as z:
        data = z.read(MEMBER)
    target.write_text(json.dumps(index(data), indent=2) + '\n')
    print(target)


if __name__ == '__main__':
    main()
