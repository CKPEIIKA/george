#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
D=$(mktemp -d); trap 'rm -rf "$D"' EXIT
CLANG=${CLANG:-clang};RT=$($CLANG --print-resource-dir)/lib/linux
"$CLANG" -std=c11 -O1 -g -fPIC -shared -ffreestanding -fno-builtin -fsanitize=undefined -shared-libsan -Wl,-rpath,"$RT" -fno-sanitize-recover=all src/kernel.c tests/host.c -o "$D/libfomkyr.so"
mkdir -p results/0.7.1
FOMKYR_NATIVE_LIBRARY="$D/libfomkyr.so" python3 tests/test_pair_plan.py
FOMKYR_NATIVE_LIBRARY="$D/libfomkyr.so" python3 tests/test_pair_plan_frame.py
