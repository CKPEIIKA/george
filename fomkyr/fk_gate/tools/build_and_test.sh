#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
mkdir -p dist
CC=${CC:-clang}
COMMON=(-std=c11 -Wall -Wextra -Werror)
"$CC" -O3 "${COMMON[@]}" src/fk_gate.c tests/test_core.c -o dist/test_core
"$CC" -O3 "${COMMON[@]}" src/fk_gate.c tests/test_frontier.c -o dist/test_frontier
"$CC" -O1 -g -fsanitize=address,undefined "${COMMON[@]}" src/fk_gate.c tests/test_core.c -o dist/test_core_san
"$CC" -O1 -g -fsanitize=address,undefined "${COMMON[@]}" src/fk_gate.c tests/test_frontier.c -o dist/test_frontier_san
./dist/test_core
./dist/test_frontier
ASAN_OPTIONS=detect_leaks=0 ./dist/test_core_san
ASAN_OPTIONS=detect_leaks=0 ./dist/test_frontier_san
python3 tests/test_profile.py
node tests/test_wide_count.mjs
