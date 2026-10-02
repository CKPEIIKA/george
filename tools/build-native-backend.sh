#!/usr/bin/env bash
set -euo pipefail
root=$(cd "$(dirname "$0")/.." && pwd)
native_stage=${GEORGE_NATIVE_BUILD:-$root/build/native-build-$(date +%Y%m%d-%H%M%S)}
mkdir -p "$native_stage"
cp -R "$root/vendor/george-native-0.1.0/." "$native_stage/"
bash "$native_stage/tools/build.sh"
# Keep George's adapted worker, UI bridge and memory reporting.
cp "$native_stage/dist/george32.wasm" "$native_stage/dist/george64.wasm" "$root/web/engine/native/"
cd "$root"
node tools/native-manifest.mjs
