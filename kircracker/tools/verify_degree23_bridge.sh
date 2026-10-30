#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
OUT="${1:-results-local/degree23-bridge-replay-$(date -u +%Y%m%dT%H%M%S)-$$}"
if test -e "$OUT"; then echo 'Choose a new verification output directory' >&2; exit 2; fi
mkdir -p "$OUT"
export KIR_BRIDGE_RESULTS="$(cd "$OUT" && pwd)"
make -j2 all projection-pilot >"$OUT/build.log" 2>&1
${CXX:-g++} -std=c++20 -O1 -g -fsanitize=undefined -fno-sanitize-recover=all \
  -Isrc tests/test_delayed_rank.cpp -o "$OUT/test-rank"
"$OUT/test-rank" "$OUT/rank-journal" >"$OUT/rank-unit.json"
python3 tests/test_delayed_pairing.py >"$OUT/pairing-tests.log" 2>&1
python3 tests/test_projected_chart.py >"$OUT/projected-tests.log" 2>&1
PYTHONPATH=tests:. python3 -m unittest -v \
 test_engine_numeric.NativeEngine.test_dashboard_reads_native_runner_events \
 test_engine_numeric.NativeEngine.test_gmp_rational_upper_arithmetic \
 test_engine_numeric.NativeEngine.test_partial_minor_is_not_a_completed_search \
 test_engine_numeric.NativeEngine.test_nonzero_degree23_24_prefix_parity \
 test_engine_numeric.NativeEngine.test_numeric_kernels_and_journal \
 test_cli.Basics.test_resource_units test_cli.Basics.test_word_boundaries \
 test_cli.Basics.test_group_convolution test_cli.Basics.test_degree21_22_exact_prefix_verifier \
 test_cli.Basics.test_degree22_discovery_no_dense_matrix test_cli.Basics.test_lock \
 test_cli.Checkpoints test_030_structural.Structural03.test_degree8 \
 test_030_structural.Structural03.test_formula >"$OUT/retained-available.log" 2>&1
printf '{"passed":true,"scope":"bounded available checks; full inherited proof-store tests not claimed"}\n' >"$OUT/PASS.json"
echo "Bridge tests passed: $OUT"
