#!/usr/bin/env python3
"""Copy a SHA256-bound, zero-footer legacy chart into checksummed KKRMAP01.

This changes only the eight-byte footer. It does not establish that the chart
spans a quotient or that its words are independent. Generic readers stay strict.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import os
from pathlib import Path
import re
import struct
import tempfile


def import_chart(source: Path, output: Path, expected_sha256: str) -> dict:
    if not re.fullmatch(r"[0-9a-f]{64}", expected_sha256):
        raise ValueError("expected SHA256 must be 64 lowercase hexadecimal digits")
    receipt = output.with_name(output.name + ".import.json")
    if output.exists() or receipt.exists():
        raise FileExistsError("output and receipt must both be new paths")
    # Verify the full source, including its legacy footer, before interpreting it.
    with source.open("rb") as f:
        if hashlib.file_digest(f, "sha256").hexdigest() != expected_sha256:
            raise ValueError("source SHA256 differs from the trusted input binding")
        f.seek(0)
        header = f.read(112)
        if len(header) != 112 or header[:8] != b"KKRMAP01":
            raise ValueError("unsupported chart format")
        binding = header[8:72].decode("ascii")
        if not re.fullmatch(r"[0-9a-f]{64}", binding):
            raise ValueError("invalid frame binding")
        degree, generators, prime, flags, previous, words, actions = struct.unpack(
            "<IIIIQQQ", header[72:])
        if not (2 <= degree <= 31 and 1 <= generators <= 5 and prime == 2
                and flags == 0 and actions == 0):
            raise ValueError("expected an action-free legacy F2 word chart")
        prefix_bytes = 112 + 20 * words
        if os.fstat(f.fileno()).st_size != prefix_bytes + 8:
            raise ValueError("word count does not match file size")
        f.seek(prefix_bytes)
        if f.read(8) != b"\0" * 8:
            raise ValueError("only explicitly SHA-bound zero-footer charts may be imported")
        output.parent.mkdir(parents=True, exist_ok=True)
        fd, temp_name = tempfile.mkstemp(prefix=".chart-import-", dir=output.parent)
        temp = Path(temp_name)
        try:
            old_digest = hashlib.sha256()
            new_digest = hashlib.sha256()
            checksum = 1469598103934665603
            f.seek(0)
            remaining = prefix_bytes
            with os.fdopen(fd, "wb") as target:
                while remaining:
                    block = f.read(min(1 << 20, remaining))
                    if not block:
                        raise ValueError("source truncated during import")
                    old_digest.update(block)
                    new_digest.update(block)
                    for byte in block:
                        checksum = ((checksum ^ byte) * 1099511628211) & ((1 << 64) - 1)
                    target.write(block)
                    remaining -= len(block)
                footer = f.read(8)
                old_digest.update(footer)
                if footer != b"\0" * 8 or f.read(1):
                    raise ValueError("source changed during import")
                if old_digest.hexdigest() != expected_sha256:
                    raise ValueError("source changed during import")
                new_footer = struct.pack("<Q", checksum)
                target.write(new_footer)
                new_digest.update(new_footer)
                target.flush()
                os.fsync(target.fileno())
            report = {
                "schema": "kir-legacy-chart-import-1",
                "source": str(source.resolve()), "sourceSHA256": expected_sha256,
                "output": str(output.resolve()), "outputSHA256": new_digest.hexdigest(),
                "binding": binding, "degree": degree, "generators": generators,
                "previousWords": previous, "words": words,
                "preservedPrefixBytes": prefix_bytes, "bytes": prefix_bytes + 8,
                "oldFooter": 0, "newFooter": checksum,
                "transformation": "identical header and word records; replace zero footer with FNV64",
                "mathematicalAuthority": "unchanged; external to this format import",
            }
            # Link publishes atomically without replacing a concurrently created file.
            os.link(temp, output)
            with receipt.open("x") as r:
                json.dump(report, r, indent=2)
                r.write("\n")
                r.flush()
                os.fsync(r.fileno())
            return report
        finally:
            temp.unlink(missing_ok=True)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source", required=True, type=Path)
    parser.add_argument("--out", required=True, type=Path)
    parser.add_argument("--expected-sha256", required=True)
    args = parser.parse_args()
    print(json.dumps(import_chart(args.source, args.out, args.expected_sha256)))


if __name__ == "__main__":
    main()
