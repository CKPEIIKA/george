#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
CLANG=${CLANG:-clang}
mkdir -p dist
COMMON=(-std=c11 -O3 -flto -ffreestanding -fno-builtin -fvisibility=hidden -Wall -Wextra)
for bits in 32 64; do
  max=4294901760
  [[ $bits == 64 ]] && max=14999945216
  "$CLANG" --target=wasm${bits} "${COMMON[@]}" -matomics -mbulk-memory -nostdlib \
    src/kernel.c -o dist/george${bits}.wasm \
    -Wl,--no-entry,--import-memory,--shared-memory,--export-dynamic,--export=__stack_pointer \
    -Wl,--initial-memory=2097152,--max-memory="$max",-z,stack-size=131072,--lto-O3
 done
"$CLANG" "${COMMON[@]}" -fvisibility=default -fPIC -shared src/kernel.c tests/host.c -o dist/libgeorge.so -fuse-ld=lld

cp dist/george32.wasm dist/george64.wasm web/
