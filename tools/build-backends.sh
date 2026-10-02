#!/usr/bin/env bash
# Build all four browser backends from one corresponding Bergman package.
# All build directories are fresh; the selected engines are installed in web/.
set -euo pipefail
root=$(cd "$(dirname "$0")/.." && pwd)
destination=${GEORGE_BACKEND_BUILD_DIR:-/tmp/george-backends-$(date +%Y%m%d-%H%M%S)-$$}
[[ $destination == /* && ! -e $destination ]] || {
  echo 'GEORGE_BACKEND_BUILD_DIR must be an unused absolute directory.' >&2; exit 2;
}
mkdir -p "$destination"
cd "$root"
GEORGE_NEUTRAL_DIR="$destination/standard" GEORGE_LTO=0 \
  GEORGE_ECL_OPT=O2 GEORGE_ENGINE_DIR="$root/web/engine" bash ports/ecl/build.sh
runtime=$(python3 -c 'import json; print(json.load(open("build/engine-build.json"))["runtime"])')
GEORGE_PROFILE=0 GEORGE_LTO=1 GEORGE_LINK_OPT=-O3 \
  bash tools/build-runtime-variant.sh O3 "$destination/optimized" "$runtime"
GEORGE_LTO=1 GEORGE_LINK_OPT=-O3 \
  bash tools/build-aot-variant.sh "$destination/compiled" "$runtime" "$destination/optimized/prefix"
node tools/install-runtime-variant.mjs "$destination/optimized" optimized
node tools/install-runtime-variant.mjs "$destination/compiled" compiled
bash tools/build-memory64-backend.sh "$destination/memory64" "$runtime"
node tools/install-runtime-variant.mjs "$destination/memory64/compiled" memory64
