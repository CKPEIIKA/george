"""Load replayed relation upper bounds for optional pairing-search scheduling.

Stopping discovery early does not certify a lower bound: its selected minor
still passes the normal independent integer replay before scalar assembly.
"""
import hashlib
import json
from pathlib import Path


def sha256(path):
    h = hashlib.sha256()
    with Path(path).open('rb') as stream:
        for chunk in iter(lambda: stream.read(4 * 1024**2), b''):
            h.update(chunk)
    return h.hexdigest()


class ReplayedUpperBounds:
    def __init__(self, root, binding):
        self.root = Path(root)
        self.binding = binding
        self.cache = {}

    def read(self):
        bounds, proofs = {}, []
        if not self.root.exists():
            return bounds, proofs
        for receipt in sorted(self.root.glob('g*/VERIFIED.json')):
            raw = receipt.read_bytes()
            key = hashlib.sha256(raw).hexdigest()
            item = self.cache.get(key)
            if item is None:
                record = json.loads(raw)
                if record.get('binding') != self.binding or record.get('replayPassed') is not True:
                    raise ValueError('Unbound or unreplayed relation upper certificate')
                profile = Path(record['profile'])
                trace = Path(record['trace'])
                replay = receipt.parent/'replay/proof'/trace.name
                if sha256(profile) != record['profileSHA256']:
                    raise ValueError('Changed upper profile')
                if not (sha256(trace) == record['traceSHA256'] == sha256(replay)
                        == record['replayedTraceSHA256']):
                    raise ValueError('Relation trace replay mismatch')
                data = json.loads(profile.read_text())
                group, upper = record['group'], record['upper']
                if data['degree'] != 22 or data['prime'] != 2:
                    raise ValueError('Unexpected relation certificate field or degree')
                if type(upper) is not int or upper < 0:
                    raise ValueError('Invalid relation upper bound')
                selected = {}
                for sector in data['sectors']:
                    if sector['representative'] == group:
                        if sector['upper'] != upper or not sector.get('complete'):
                            raise ValueError('Incomplete or inconsistent relation sector')
                        selected[sector['storedOppositeGradeIndex']] = upper
                if not selected:
                    raise ValueError('Empty upper-bound transport orbit')
                item = selected, {**record, 'receipt': str(receipt), 'receiptSHA256': key}
                self.cache[key] = item
            for grade, upper in item[0].items():
                bounds[grade] = min(bounds.get(grade, upper), upper)
            proofs.append(item[1])
        return bounds, proofs
