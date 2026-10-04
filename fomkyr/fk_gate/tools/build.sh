#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
mkdir -p dist
CC=${CC:-clang}
"$CC" -O3 -flto -std=c11 -Wall -Wextra -Werror -fuse-ld=lld src/fk_gate.c tests/test_core.c -o dist/test_core
"$CC" -Os -ffreestanding -fno-builtin -std=c11 -c src/fk_gate.c -o dist/fk_gate.o
"$CC" -O2 -g -std=c11 -fsanitize=address,undefined src/fk_gate.c tests/test_core.c -o dist/test_core_sanitized
./dist/test_core
./dist/test_core_sanitized
"$CC" -O3 -flto -std=c11 -Wall -Wextra -Werror -fuse-ld=lld src/fk_gate.c tests/test_frontier.c -o dist/test_frontier
"$CC" -O2 -g -std=c11 -fsanitize=address,undefined src/fk_gate.c tests/test_frontier.c -o dist/test_frontier_sanitized
./dist/test_frontier
./dist/test_frontier_sanitized
python3 tests/test_profile.py
