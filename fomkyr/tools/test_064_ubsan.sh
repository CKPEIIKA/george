#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
backup=$(mktemp); cp dist/libfomkyr.so "$backup"
trap 'cp "$backup" dist/libfomkyr.so; rm -f "$backup"' EXIT
CLANG=${CLANG:-clang};runtime=$("$CLANG" --print-resource-dir)/lib/linux
"$CLANG" -std=c11 -O1 -g -fPIC -shared -ffreestanding -fno-builtin \
 -fsanitize=undefined -shared-libsan -Wl,-rpath,"$runtime" -fno-sanitize-recover=all \
 src/kernel.c tests/host.c -o dist/libfomkyr.so
python3 tests/test_064_native.py
