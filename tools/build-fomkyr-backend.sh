#!/usr/bin/env bash
set -euo pipefail
root=$(cd "$(dirname "$0")/.." && pwd)
fomkyr_stage=${GEORGE_FOMKYR_BUILD:-$root/build/fomkyr-build-$(date +%Y%m%d-%H%M%S)}
mkdir -p "$fomkyr_stage"
node "$root/tools/fomkyr-source.mjs" "$fomkyr_stage"
bash "$fomkyr_stage/tools/build.sh"
# The Wasm binaries are stored once, in fomkyr/dist. The standalone page and
# George's engine directory link to them; publishing replaces links by files.
cp "$fomkyr_stage"/dist/fomkyr*.wasm "$root/fomkyr/dist/"
for wasm in "$root"/fomkyr/dist/fomkyr*.wasm; do
  name=$(basename "$wasm")
  ln -sfn "../../../fomkyr/dist/$name" "$root/web/engine/fomkyr/$name"
  ln -sfn "../dist/$name" "$root/fomkyr/web/$name"
done
# Keep George's host adapters; the hash table follows the rebuilt binaries.
cp "$fomkyr_stage/web/build-info.js" "$root/web/engine/fomkyr/"
cp "$fomkyr_stage/web/build-info.js" "$root/fomkyr/web/"
cd "$root"
node tools/fomkyr-manifest.mjs
