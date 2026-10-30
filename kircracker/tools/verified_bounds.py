"""Display an explicitly adopted upper certificate without changing a live job.

The adoption pointer pins a previously replayed certificate by SHA256. This is a
read-only presentation step, not a substitute for the certificate's verifier.
"""
import hashlib
import json
from pathlib import Path


def apply_upper_overlay(root, result):
    pointer = Path(root) / 'VERIFIED_UPPER_OVERLAY.json'
    if not pointer.exists():
        return result
    updated = dict(result)
    try:
        adoption = json.loads(pointer.read_text())
        path = Path(adoption['path'])
        if not path.is_absolute():
            path = pointer.parent / path
        raw = path.read_bytes()
        if hashlib.sha256(raw).hexdigest() != adoption['sha256']:
            raise ValueError('certificate hash mismatch')
        proof = json.loads(raw)
        if (proof.get('schema') != 'kir-certified-bound-overlay-1'
                or proof.get('passed') is not True
                or proof.get('degree') != result.get('degree')):
            raise ValueError('certificate scope/status mismatch')
        savings = {}
        for name in ('B6', 'FK6'):
            bound = result.get(name, {})
            upper = proof.get(name, {}).get('upper')
            lower, current = bound.get('lower'), bound.get('upper')
            if any(type(x) is not int for x in (upper, lower, current)):
                raise ValueError('integer bounds required')
            if not 0 <= lower <= upper or lower > current:
                raise ValueError('certificate contradicts current lower bound')
            best = min(upper, current)
            updated[name] = dict(bound, upper=best, gap=best-lower)
            savings[name] = current-best
        updated['upperBoundOverlay'] = {
            'path': str(path), 'sha256': adoption['sha256'],
            'upperReduction': savings,
        }
        updated['boundObservationSource'] = (
            'audited RESULT.json lower bounds plus explicitly adopted, '
            'hash-pinned independently replayed upper certificate')
    except (OSError, ValueError, TypeError, KeyError) as error:
        # Apply atomically: never show one half of a rejected overlay.
        updated = dict(result)
        updated['upperBoundOverlayError'] = str(error)
    return updated
