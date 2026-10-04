#!/usr/bin/env bash
# Check the integrated gate without retaining a sanitizer-linked release binary.
set -euo pipefail
cd "$(dirname "$0")/.."
sanitized=$(mktemp -d)
trap 'rm -rf "$sanitized"' EXIT
CLANG=${CLANG:-clang}
RUNTIME=$("$CLANG" --print-resource-dir)/lib/linux
"$CLANG" -std=c11 -O1 -g -fPIC -shared -ffreestanding -fno-builtin \
 -fsanitize=undefined -shared-libsan -Wl,-rpath,"$RUNTIME" -fno-sanitize-recover=all \
 src/kernel.c tests/host.c -o "$sanitized/libfomkyr.so"
FOMKYR_NATIVE_LIBRARY="$sanitized/libfomkyr.so" python3 tests/test_fk_gate_068.py
