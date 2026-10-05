#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
mkdir -p results/pref4.2
memory64_flags=()
if [[ $(node --v8-options) == *--experimental-wasm-memory64* ]]; then memory64_flags+=(--experimental-wasm-memory64); fi
make CC="${CC:-clang}" LDFLAGS="${LDFLAGS:--flto -pthread -fuse-ld=lld}" -j4 > results/pref4.2/build-native.log 2>&1
bash tools/build.sh > results/pref4.2/build-wasm.log 2>&1
bash tools/verify_pref4.sh > results/pref4.2/retained-pref4.log 2>&1
python3 tests/test_word_plan.py > results/pref4.2/word-native.log 2>&1
python3 tests/test_word_plan_frame.py > results/pref4.2/word-frame.log 2>&1
node "${memory64_flags[@]}" tests/test_word_wasm.mjs > results/pref4.2/word-wasm.log 2>&1
python3 tests/test_word_plan_cross.py > results/pref4.2/word-cross.log 2>&1
python3 tests/test_word_plan_budget.py > results/pref4.2/word-budget.log 2>&1
node tests/test_word_controls.mjs > results/pref4.2/word-controls.log
python3 tests/test_installer.py > results/pref4.2/installer.log 2>&1
python3 tests/test_installer_modern.py > results/pref4.2/installer-modern.log 2>&1
make CC="${CC:-clang}" audit-tools > results/pref4.2/build-audit.log 2>&1
python3 tests/test_stream_canonical.py > results/pref4.2/stream-audit.log 2>&1
printf 'PRE-F4.2 EXACT SUITE PASSED\n'
