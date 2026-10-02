#!/usr/bin/env bash
# Native UB checks for the same kernel. Restores the release library on exit.
set -euo pipefail
cd "$(dirname "$0")/.."
backup=$(mktemp)
cp dist/libgeorge.so "$backup"
trap 'cp "$backup" dist/libgeorge.so; rm -f "$backup"' EXIT
CLANG=${CLANG:-clang}
RUNTIME=$("$CLANG" --print-resource-dir)/lib/linux
"$CLANG" -std=c11 -O1 -g -fPIC -shared -ffreestanding -fno-builtin \
  -fsanitize=undefined -shared-libsan -Wl,-rpath,"$RUNTIME" -fno-sanitize-recover=all src/kernel.c tests/host.c -o dist/libgeorge.so
python tests/test_native.py
