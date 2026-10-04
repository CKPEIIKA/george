#!/usr/bin/env bash
set -euo pipefail
root=$(cd "$(dirname "$0")/.." && pwd)
fomkyr_stage=${GEORGE_FOMKYR_BUILD:-$root/build/fomkyr-build-$(date +%Y%m%d-%H%M%S)}
mkdir -p "$fomkyr_stage"
node "$root/tools/fomkyr-source.mjs" "$fomkyr_stage"
bash "$fomkyr_stage/tools/build.sh"
# Keep George's host adapters; the hash table follows the rebuilt binaries.
cp "$fomkyr_stage"/dist/fomkyr*.wasm "$fomkyr_stage/web/build-info.js" "$root/web/engine/fomkyr/"
# Standalone and browser distributions must carry the same rebuilt kernel.
cp "$fomkyr_stage"/dist/fomkyr*.wasm "$root/fomkyr/dist/"
cp "$fomkyr_stage"/dist/fomkyr*.wasm "$fomkyr_stage/web/build-info.js" "$root/fomkyr/web/"
cd "$root"
node tools/fomkyr-manifest.mjs
