#!/usr/bin/env python3
"""Readable reports preserve JSON records, status reads and native/Wasm results."""
import hashlib
import json
from pathlib import Path
import subprocess
import tempfile

root = Path(__file__).resolve().parents[1]
exe = root / "dist/fomkyr"
def run(args):
    result = subprocess.run([str(exe), *args], cwd=root, capture_output=True,
                            text=True, timeout=30)
    assert result.returncode == 0, (args, result.stdout, result.stderr)
    return result
def hashes(job):
    return {str(p.relative_to(job)): hashlib.sha256(p.read_bytes()).hexdigest()
            for p in job.rglob("*") if p.is_file()}
with tempfile.TemporaryDirectory() as temporary:
    for wasm in (False, True):
        prefix = ["--wasm"] if wasm else []
        job = Path(temporary) / ("wasm" if wasm else "native")
        result = run(prefix + ["-i", "fixtures/exterior.json", "-d", "4", "-j", "2",
            "--memory", "128M", "--workdir", str(job), "--human", "--export"])
        assert "Completed through degree" in result.stdout
        assert "Elapsed:" in result.stdout and " s\n" in result.stdout
        assert "Basis file:" in result.stdout
        assert "{\"event\"" not in result.stderr
        metadata = json.loads((job / "job.json").read_text())
        assert metadata["modulus"] == 0
        before = hashes(job)
        status = run(prefix + ["--resume", str(job), "--status", "--human"])
        assert "Checkpoint:" in status.stdout
        assert hashes(job) == before
        status = json.loads(run(prefix + ["--resume", str(job), "--status"]).stdout)
        assert status["completedThroughDegree"] >= 4
        fixture = json.loads(run(prefix + ["-i", "fixtures/exterior.json",
                                        "--dump-fixture", "--human"]).stdout)
        assert fixture["variables"]
print("Native/Wasm readable reports and unchanged JSON persistence passed")
