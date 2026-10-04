#!/usr/bin/env python3
"""Bound one critical-composition reduction using an existing saved job.

The saved basis is opened read-only. The probe never commits a polynomial or
declares a degree complete. An incomplete prefix can give different remainders
under different reduction strategies; this tool diagnoses work and workspace.
"""
import argparse
import ctypes as C
import hashlib
import json
import os
from pathlib import Path
import shlex
import subprocess
import sys
import threading
import time

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "tools"))
from native import Engine, check

def arguments():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--job", type=Path, required=True)
    p.add_argument("--degree", type=int, required=True)
    p.add_argument("--pair", required=True, help="leftRule,rightRule,overlap from progress")
    p.add_argument("--snapshot", type=int, help="immutable rule count; default saved prefix")
    p.add_argument("--seconds", type=float, default=10)
    p.add_argument("--memory-mib", type=int, default=512)
    p.add_argument("--scratch-mib", type=int, default=64)
    p.add_argument("--reserve-mib", type=int, default=128)
    p.add_argument("--big-row-max-terms", type=int, default=0, help="0 = budget-derived; otherwise a power of two")
    p.add_argument("--layout-workers", type=int, default=1, help="match a multi-worker workspace while executing only one row")
    p.add_argument("--cooperative-layout", action="store_true", help="reserve the separate commit arena used by cooperative jobs")
    p.add_argument("--shared-cache-mib", type=int, help="match the immutable record cache allowance")
    p.add_argument("--cache-percent", type=int, default=12, help="worker record cache share, 0..40 percent")
    p.add_argument("--binary", action="store_true", help="use the binary heap queue")
    p.add_argument("--out", type=Path, default=ROOT / ".cache/pair-probe")
    p.add_argument("--worker", action="store_true", help=argparse.SUPPRESS)
    a = p.parse_args()
    try:
        a.pair_ids = [int(x) for x in a.pair.split(",")]
    except ValueError:
        p.error("pair must contain three positive integers")
    if len(a.pair_ids) != 3 or min(a.pair_ids) < 1:
        p.error("pair must contain three positive integers")
    if not 1 <= a.degree <= 0xfffffffe or not 0 < a.seconds <= 120:
        p.error("choose a positive degree and a deadline in (0, 120] seconds")
    if a.memory_mib < 16 or a.scratch_mib < 1 or a.reserve_mib < 0 or a.scratch_mib+a.reserve_mib >= a.memory_mib:
        p.error("workspace and reserve must fit inside the memory allowance")
    if not 1 <= a.layout_workers <= 32 or a.shared_cache_mib is not None and a.shared_cache_mib < 0:
        p.error("layout workers must be 1..32; shared cache must be nonnegative")
    if not 0 <= a.cache_percent <= 40:
        p.error("cache percent must be 0..40")
    if a.snapshot is not None and a.snapshot < max(a.pair_ids[:2]):
        p.error("snapshot must include both rules")
    if a.big_row_max_terms and (a.big_row_max_terms < 128 or a.big_row_max_terms > 1<<30 or a.big_row_max_terms & (a.big_row_max_terms-1)):
        p.error("big-row-max-terms must be 0 or a power of two, 128..1073741824")
    a.job = a.job.resolve(); a.out = a.out.resolve()
    if a.out == a.job or a.job in a.out.parents:
        p.error("keep diagnostic output outside the saved job")
    return a

def saved_prefix(job):
    identity = json.loads((job / "job.json").read_text())["identity"]
    directory = job / "fomkyr" / ("alg-" + identity)
    records = directory / "basis.gnb"
    size = records.stat().st_size
    candidates = []
    for name in ("checkpoint-0.json", "checkpoint-1.json", "partial-0.json", "partial-1.json"):
        file = directory / name
        try:
            envelope = json.loads(file.read_text()); payload = envelope["payload"]
            compact = json.dumps(payload, separators=(",", ":"), ensure_ascii=False).encode()
            if hashlib.sha256(compact).hexdigest() != envelope["sha256"]:
                continue
            if payload["identity"] == identity and payload["diskBytes"] <= size:
                candidates.append((payload, file))
        except (OSError, ValueError, KeyError, TypeError):
            continue
    if not candidates:
        raise ValueError("No valid matching checkpoint; saved data was left untouched")
    payload, file = max(candidates, key=lambda x:(x[0]["completedThroughDegree"], bool(x[0].get("partial")), x[0].get("sequence", 0)))
    return payload, file, records

def build(out):
    # The test host can only pread this basis. An accidental pwrite fails at the OS.
    text = (ROOT / "tests/host.c").read_text()
    anchor = "open(path,O_RDWR|O_CREAT,0600)"
    if anchor not in text:
        raise ValueError("Read-only host preparation no longer matches its source")
    host = out / "read-only-host.c"
    text = text.replace('#include "../src/kernel.h"', '#include "kernel.h"')
    host.write_text(text.replace(anchor, "open(path,O_RDONLY)"))
    library = out / "probe.so"
    command = shlex.split(os.environ.get("CC", "cc")) + ["-O3", "-std=c11", "-shared", "-fPIC", "-ffreestanding", "-fno-builtin",
               "-I" + str(ROOT / "src"), str(ROOT / "tests/probe_pair.c"), str(host), "-o", str(library)]
    with (out / "build.log").open("w") as log:
        subprocess.run(command, stdout=log, stderr=log, check=True, timeout=120)
    return library

def trial(a):
    cp, checkpoint, records = saved_prefix(a.job)
    if a.degree <= cp["completedThroughDegree"]:
        raise ValueError("Choose a degree above the saved completed prefix")
    fixture = json.loads((a.job / "fixture.json").read_text())
    modulus = int(json.loads((a.job / "job.json").read_text())["modulus"])
    os.environ["FOMKYR_NATIVE_LIBRARY"] = str(a.out / "probe.so")
    e = Engine(fixture, a.degree, workers=a.layout_workers, budget=a.memory_mib << 20, scratch=a.scratch_mib << 20,
               row_reserve=a.reserve_mib << 20, shared_cache=None if a.shared_cache_mib is None else a.shared_cache_mib << 20, disk=str(records), modulus=modulus, radix_heap=not a.binary)
    lib = e.lib
    check(lib.gn_tune(3,a.cache_percent,16))
    extended_counters = hasattr(lib, 'gn_big_row_limit')
    if a.cooperative_layout:
        for name,args in [('gn_batch_mode',[1]),('gn_cooperative',[250,128])]:
            fn=getattr(lib,name);fn.argtypes=[C.c_uint32]*len(args);fn.restype=C.c_int;check(fn(*args))
    if hasattr(lib, 'gn_big_row_limit'):
        lib.gn_big_row_limit.argtypes = [C.c_uint32];lib.gn_big_row_limit.restype = C.c_int
        check(lib.gn_big_row_limit(a.big_row_max_terms))
    elif a.big_row_max_terms:
        raise ValueError('Selected kernel lacks the configurable big-row ceiling')
    # Import even a partially committed current-degree prefix without asserting
    # that its degree is complete. Every record is checked by the kernel.
    offset = 0
    with records.open("rb") as source:
        for _ in range(cp["basisSize"]):
            header = source.read(32)
            if len(header) != 32: raise ValueError("Truncated saved prefix")
            size = int.from_bytes(header[4:8], "little")
            if size < 32 or size > lib.gn_import_capacity(): raise ValueError("Record exceeds the probe I/O workspace")
            data = header + source.read(size-32)
            if len(data) != size or offset+size > cp["diskBytes"]: raise ValueError("Truncated saved prefix")
            C.memmove(lib.host_pointer(lib.gn_import_buffer()), data, size)
            check(lib.gn_restore_rule(size, offset)); offset += size
    if offset != cp["diskBytes"]: raise ValueError("Saved prefix length differs")
    snapshot = a.snapshot or cp["basisSize"]
    lib.probe_begin.argtypes = [C.c_uint32]*3; lib.probe_begin.restype = C.c_int
    lib.probe_reduce.argtypes = [C.c_uint32]*4; lib.probe_reduce.restype = C.c_int
    lib.gn_deadline.argtypes = [C.c_double]; lib.gn_deadline.restype = None
    lib.gn_host_clock.restype = C.c_double
    lib.gn_exact_stat.argtypes = [C.c_uint32]*2; lib.gn_exact_stat.restype = C.c_uint64
    lib.probe_result.restype = C.c_uint64; lib.probe_terms.restype = C.c_uint32
    check(lib.probe_begin(a.degree, cp["completedThroughDegree"], snapshot))
    samples = []; stop = threading.Event(); start = time.perf_counter()
    def observe():
        while not stop.is_set():
            samples.append({"seconds":time.perf_counter()-start, "rewrites":int(lib.gn_live_stat(0, 0)),
                "terms":int(lib.gn_live_stat(0, 4)), "tier":int(lib.gn_live_stat(0, 9)),
                "bigRowCapacity":int(lib.gn_live_stat(0,14)),"bigRowPeakTerms":int(lib.gn_live_stat(0,16)),
                "bigRowGrowths":int(lib.gn_live_stat(0,19)),"bigRowCapacityMisses":int(lib.gn_live_stat(0,20)),
                "coefficientPoolMisses":int(lib.gn_live_stat(0,21)),"generalFallbacks":int(lib.gn_live_stat(0,23))})
            stop.wait(.1)
    observer = threading.Thread(target=observe); observer.start()
    lib.gn_deadline(lib.gn_host_clock()+a.seconds*1000)
    try:
        rc = lib.probe_reduce(*a.pair_ids, snapshot)
    finally:
        stop.set(); observer.join()
    elapsed = time.perf_counter()-start
    if not extended_counters:
        for sample in samples:
            for name in ('bigRowCapacity', 'bigRowPeakTerms', 'bigRowGrowths', 'bigRowCapacityMisses', 'coefficientPoolMisses', 'generalFallbacks'):
                sample[name] = None
    result = {"kind":"isolated composition against a frozen prefix", "degreeCompleted":False,
        "completedPrefix":cp["completedThroughDegree"], "checkpointSha256":hashlib.sha256(checkpoint.read_bytes()).hexdigest(),
        "pair":a.pair_ids, "snapshot":snapshot, "modulus":modulus, "queue":"binary" if a.binary else "radix",
        "layoutWorkers":a.layout_workers,"cooperativeLayout":a.cooperative_layout,"sharedCacheMiB":a.shared_cache_mib,"cachePercent":a.cache_percent,
        "memoryMiB":a.memory_mib, "scratchMiB":a.scratch_mib, "reserveMiB":a.reserve_mib,
        "deadlineSeconds":a.seconds, "returnCode":rc, "elapsedSeconds":elapsed, "resultTerms":int(lib.probe_terms()) if rc==0 else None,
        "integerSteps":int(lib.gn_lane_stat(0, 24)), "rationalSteps":int(lib.gn_lane_stat(0, 25)),
        "bigRowMaxTerms":a.big_row_max_terms, "extendedCountersAvailable":extended_counters,
        "bigRowGrowths":int(lib.gn_exact_stat(0,12)) if extended_counters else None,"bigRowCapacity":int(lib.gn_exact_stat(0,14)) if extended_counters else None,
        "bigRowPeakTerms":int(lib.gn_exact_stat(0,13)) if extended_counters else None,"bigRowCapacityMisses":int(lib.gn_exact_stat(0,6)),
        "coefficientPoolMisses":int(lib.gn_exact_stat(0,5)),"arithmeticWorkspaceMisses":int(lib.gn_exact_stat(0,7)),
        "generalFallbacks":int(lib.gn_exact_stat(0,20)) if extended_counters else None,"bigSteps":int(lib.gn_exact_stat(0, 3)), "stats":e.stats(), "samples":samples}
    if rc == 0:
        address = lib.probe_result()
        if address:
            (a.out / "remainder.gnb").write_bytes(C.string_at(lib.host_pointer(address), lib.gn_export_size()))
    (a.out / "report.json").write_text(json.dumps(result, indent=2)+"\n")
    print(json.dumps({k:v for k,v in result.items() if k not in ("samples", "stats")}), flush=True)

if __name__ == "__main__":
    a = arguments(); a.out.mkdir(parents=True, exist_ok=True)
    if a.worker:
        trial(a)
    else:
        for name in ("report.json", "remainder.gnb"):
            (a.out / name).unlink(missing_ok=True)
        build(a.out)
        try:
            result = subprocess.run([sys.executable, str(Path(__file__).resolve()), *sys.argv[1:], "--worker"], timeout=a.seconds+30)
            raise SystemExit(result.returncode)
        except subprocess.TimeoutExpired:
            (a.out / "report.json").write_text(json.dumps({"kind":"isolated composition", "status":"external-watchdog", "degreeCompleted":False})+"\n")
            raise SystemExit("Probe exceeded its external watchdog; saved job was opened read-only")
