#!/usr/bin/env bash
set -euo pipefail
SOURCE=$(cd "$1" && pwd)
OUT=$(cd "$(dirname "$0")/.." && pwd)/evidence
TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT
cd "$SOURCE"
clang -O1 -g -std=c11 -fsanitize=address,undefined -fno-omit-frame-pointer \
  -ffreestanding -fno-builtin -c src/kernel.c -o "$TMP/kernel.o"
clang -O1 -g -std=c11 -fsanitize=address,undefined -fno-omit-frame-pointer \
  native/cli.c native/host.c native/support.c native/fixture.c "$TMP/kernel.o" \
  -pthread -o "$TMP/fomkyr"
ASAN_OPTIONS=detect_leaks=0 FOMKYR_HILBERT_GATE=1 FOMKYR_HILBERT_SECTORS=1 \
 "$TMP/fomkyr" -i fixtures/fk6.json -d 5 -j 12 --memory 128M \
 --fresh --workdir "$TMP/work" --hilbert -q > "$OUT/reference-sanitized.json"
echo 'PASS real gate/sector native execution under address+undefined sanitizers (not leak check)'
