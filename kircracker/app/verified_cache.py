"""Optional, hash-bound LU minors produced only by successful exact audits.

Discovery journals are never eligible cache inputs. A rejected/missing cache
causes a fresh independent replay. Cache IO failure cannot discard an audit.
"""
from __future__ import annotations
import contextlib
import ctypes as C
import fcntl
import json
import os
from pathlib import Path
import shutil
import struct
import tempfile
import time
import uuid
from .util import Invalid, atomic_json, load, sha

DEFAULT_CACHE_BYTES = 3 * 1024**3
HEADER = struct.Struct('<8s6I')

def enabled():
    return os.environ.get('KIR_VERIFY_ENTRY_CACHE', '0') == '1'

def describe(path):
    with Path(path).open('rb') as stream:
        head = stream.read(HEADER.size)
        if len(head) != HEADER.size:
            raise Invalid('truncated LU cache header')
        magic, n, degree, prime, rank, det, reserved = HEADER.unpack(head)
        if (magic != b'KIRLU001' or n != 6 or not 0 <= degree <= 24 or
                not 0 < det < prime or not 0 < rank <= 250000 or reserved):
            raise Invalid('invalid LU cache header')
        words = stream.read(32 * rank)
        if len(words) != 32 * rank:
            raise Invalid('truncated LU cache words')
    if Path(path).stat().st_size != HEADER.size + 32 * rank + 4 * rank * rank:
        raise Invalid('LU cache length mismatch')
    import hashlib
    return {'degree': degree, 'prime': prime, 'rank': rank, 'determinant': det,
            'rowWordsSHA256': hashlib.sha256(words[:16*rank]).hexdigest(),
            'columnWordsSHA256': hashlib.sha256(words[16*rank:]).hexdigest()}

def admitted(root, meta, kernel):
    root = Path(root)
    try:
        pointer = load(root/'CURRENT.json')
        generation = pointer['generation']
        if Path(generation).name != generation or not generation.startswith('generation-'):
            raise Invalid('invalid LU cache generation')
        folder = root/generation
        if folder.is_symlink() or (folder/'lu.bin').is_symlink():
            raise Invalid('LU cache symlink')
        receipt = folder/'receipt.json'
        if sha(receipt) != pointer['receiptSHA256']:
            raise Invalid('LU cache receipt digest changed')
        proof = load(receipt)
        if (proof.get('schema') != 'verified-LU-minor-v1' or proof.get('passed') is not True or
                proof.get('verifierLibrarySHA256') != kernel or
                proof.get('degree') != meta['degree'] or proof.get('prime') != meta['prime']):
            raise Invalid('LU cache verifier/scope mismatch')
        data = folder/'lu.bin'
        if sha(data) != proof['dataSHA256'] or describe(data) != proof['minor']:
            raise Invalid('LU cache data digest/word binding changed')
        return data, proof, pointer['receiptSHA256']
    except FileNotFoundError:
        return None, None, None
    except (OSError, ValueError, KeyError, Invalid) as error:
        print(json.dumps({'type': 'verification_cache_rejected', 'reason': str(error)}), flush=True)
        return None, None, None

def verify(meta, left, right, root, fingerprint, threads=1):
    from .native import verify_words
    root = Path(root)
    try:
        root.mkdir(parents=True, exist_ok=True)
        lock = (root/'LOCK').open('a+b')
    except OSError as error:
        print(json.dumps({'type': 'verification_cache_write_disabled', 'reason': str(error)}), flush=True)
        return verify_words(meta, left, right, threads=threads)
    with lock:
        try:
            fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        except BlockingIOError:
            return verify_words(meta, left, right, threads=threads)
        for folder in root.glob('.pending-*'):
            if folder.is_dir() and not folder.is_symlink():
                shutil.rmtree(folder, ignore_errors=True)
        return _verify(meta, left, right, root, fingerprint, threads)

def _verify(meta, left, right, root, fingerprint, threads=1):
    from .native import libraries, library_paths, buffer
    _, library = libraries()
    if not hasattr(library, 'kv_verify_extend128'):
        raise Invalid('cached verifier ABI unavailable; disable KIR_VERIFY_ENTRY_CACHE')
    root = Path(root)
    kernel = sha(library_paths()[1])
    old, proof, proof_hash = admitted(root, meta, kernel)
    capacity = int(os.environ.get('KIR_VERIFY_CACHE_BYTES', str(DEFAULT_CACHE_BYTES)))
    if capacity < 0:
        raise Invalid('negative verification cache allowance')
    stage = None
    try:
        if capacity:
            root.mkdir(parents=True, exist_ok=True)
            if shutil.disk_usage(root).free >= capacity + 1024**3:
                stage = Path(tempfile.mkdtemp(prefix='.pending-', dir=root))
    except OSError as error:
        print(json.dumps({'type': 'verification_cache_write_disabled', 'reason': str(error)}), flush=True)
    output = stage/'lu.bin' if stage else None
    fn = library.kv_verify_extend128
    u64 = C.c_uint64; i32 = C.c_int32; p64 = C.POINTER(u64)
    fn.argtypes = [C.c_int, C.c_int, p64, p64, C.c_int, C.c_int, C.c_int, C.c_int,
                   C.c_char_p, C.c_char_p, u64, C.POINTER(i32), p64]
    fn.restype = C.c_int
    det = i32(); stats = (u64*8)()
    try:
        code = fn(6, meta['degree'], buffer(left), buffer(right), meta['rank'], meta['prime'],
                  threads, 64, os.fsencode(old) if old else None,
                  os.fsencode(output) if output else None, capacity, C.byref(det), stats)
        if code:
            error = library.kv_last_error().decode('utf8', 'replace')
            raise Invalid(f'independent cached minor verification failed (code {code}): {error}')
        if 'determinant' in meta and det.value != meta['determinant']:
            raise Invalid('independent cached determinant mismatch')
        result = {'determinant': det.value, 'entriesReplayed': int(stats[0]),
                  'entriesReused': int(stats[2]), 'cachedRankUsed': int(stats[3]),
                  'independentIntegerPrefixReplay': True,
                  'maxAbsIntegerEntryBits': max(int(stats[1]), (proof or {}).get('maxAbsIntegerEntryBits', 0)),
                  'integerArithmetic': 'signed-128-exact',
                  'entrySeconds': stats[5]/1e6, 'factorizationSeconds': stats[6]/1e6,
                  'verificationMethod': 'independent-exact-entries-and-verified-LU-Schur-extension',
                  'cacheDependencyReceiptSHA256': proof_hash if stats[3] else None}
        if old and stats[3]:
            result['verifiedLUCache'] = {'path': str(old), 'receiptSHA256': proof_hash}
        if output and stats[4]:
            try:
                # All computation has passed before a cache becomes eligible.
                with output.open('rb') as stream:
                    os.fsync(stream.fileno())
                detail = describe(output)
                record = {'schema': 'verified-LU-minor-v1', 'passed': True,
                          'degree': meta['degree'], 'prime': meta['prime'], 'minor': detail,
                          'dataSHA256': sha(output), 'verifierLibrarySHA256': kernel,
                          'verifierFingerprint': fingerprint,
                          'sourceAuditRank': meta['rank'], 'sourceAuditDeterminant': det.value,
                          'maxAbsIntegerEntryBits': result['maxAbsIntegerEntryBits'],
                          'parentReceiptSHA256': proof_hash if stats[3] else None,
                          'scope': 'nonsingular pivot-prefix minor; rows in saved pivot order',
                          'createdUnix': time.time()}
                atomic_json(stage/'receipt.json', record)
                digest = sha(stage/'receipt.json')
                atomic_json(root/'proofs'/(digest+'.json'), record)
                destination = root/('generation-'+uuid.uuid4().hex)
                os.replace(stage, destination)
                stage = None
                atomic_json(root/'CURRENT.json', {'generation': destination.name,
                                                 'receiptSHA256': digest})
                result['verifiedLUCache'] = {'path': str(destination/'lu.bin'),
                                            'receiptSHA256': digest}
                # One writer per block; old bytes are derivable from the saved
                # minor words. Keep the small receipt lineage, not old matrices.
                for folder in root.glob('generation-*'):
                    if folder != destination and not folder.is_symlink():
                        shutil.rmtree(folder)
            except OSError as error:
                result['cachePublishError'] = str(error)
                print(json.dumps({'type': 'verification_cache_write_disabled', 'reason': str(error)}), flush=True)
        return result
    finally:
        if stage is not None:
            shutil.rmtree(stage, ignore_errors=True)
