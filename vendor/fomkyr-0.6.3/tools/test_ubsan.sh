#!/usr/bin/env bash
# Native UB checks for the same kernel. Restores the release library on exit.
set -euo pipefail
cd "$(dirname "$0")/.."
backup=$(mktemp)
cp dist/libfomkyr.so "$backup"
trap 'cp "$backup" dist/libfomkyr.so; rm -f "$backup"' EXIT
CLANG=${CLANG:-clang}
RUNTIME=$("$CLANG" --print-resource-dir)/lib/linux
"$CLANG" -std=c11 -O1 -g -fPIC -shared -ffreestanding -fno-builtin \
  -fsanitize=undefined -shared-libsan -Wl,-rpath,"$RUNTIME" -fno-sanitize-recover=all src/kernel.c tests/host.c -o dist/libfomkyr.so
python tests/test_native.py

python tests/test_rational_arithmetic.py
python tests/test_rational_cases.py

python3 tests/test_big_division.py
python3 tests/test_big_fraction.py
