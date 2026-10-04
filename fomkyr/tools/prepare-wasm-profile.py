#!/usr/bin/env python3
"""Prepare the portable Wasm profile; native builds do not use this file."""
import hashlib
import json
import os
from pathlib import Path
import re
import shutil
import subprocess
import sys

root = Path(__file__).resolve().parent.parent
mode = os.environ.get("WASM_PGO", "auto")
if mode not in ("auto", "0", "1"):
    raise SystemExit("WASM_PGO must be auto, 0 or 1")
compiler = os.environ.get("CLANG", "clang")
version = subprocess.check_output([compiler, "-dumpversion"], text=True).strip()
major = int(version.split(".")[0])
result = {"optimization": "O3", "lto": True, "pgo": False,
          "compilerVersion": version}

def prepare():
    if mode == "0":
        return "explicitly disabled"
    meta = json.loads((root / "tools/wasm-profile.json").read_text())
    sha = lambda p: hashlib.sha256(p.read_bytes()).hexdigest()
    if major != meta["compilerMajor"]:
        return "compiler version differs from the retained profile"
    for name, expected in meta["sourceHashes"].items():
        if sha(root / name) != expected:
            return "kernel sources differ from the retained profile"
    profile = root / "tools/wasm-profile.proftext"
    if sha(profile) != meta["profileSha256"]:
        raise SystemExit("Wasm profile checksum mismatch")
    candidates = [os.environ.get("LLVM_PROFDATA"), f"llvm-profdata-{major}",
                  "llvm-profdata"]
    executable = next((shutil.which(c) for c in candidates if c and shutil.which(c)), None)
    if not executable:
        return "matching llvm-profdata is unavailable (set LLVM_PROFDATA)"
    tool_version = subprocess.check_output([executable, "--version"], text=True)
    if not re.search(rf"LLVM version {major}\.", tool_version):
        return "llvm-profdata version differs from the compiler"
    subprocess.run([executable, "merge", str(profile), "-o",
                    str(root / "dist/wasm-pgo.profdata")], check=True)
    result.update(pgo=True, profileKind=meta["kind"],
                  profileSha256=meta["profileSha256"])
    return None

reason = prepare()
if reason and mode == "1":
    raise SystemExit("Required Wasm PGO unavailable: " + reason)
if reason:
    print("Wasm O3 + LTO; PGO inactive: " + reason, file=sys.stderr)
else:
    print("Wasm O3 + LTO + browser-trained PGO", file=sys.stderr)
(root / "dist/wasm-compiler.json").write_text(json.dumps(result) + "\n")
