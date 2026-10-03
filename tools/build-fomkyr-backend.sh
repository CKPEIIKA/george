#!/usr/bin/env bash
set -euo pipefail
root=$(cd "$(dirname "$0")/.." && pwd)
fomkyr_stage=${GEORGE_FOMKYR_BUILD:-$root/build/fomkyr-build-$(date +%Y%m%d-%H%M%S)}
mkdir -p "$fomkyr_stage"
fomkyr_version=$(node --input-type=module -e "import {VERSION} from '$root/web/engine/fomkyr/storage.js'; process.stdout.write(VERSION)")
cp -R "$root/vendor/fomkyr-$fomkyr_version/." "$fomkyr_stage/"
bash "$fomkyr_stage/tools/build.sh"
# Keep George's host adapters; the hash table follows the rebuilt binaries.
cp "$fomkyr_stage"/dist/fomkyr*.wasm "$fomkyr_stage/web/build-info.js" "$root/web/engine/fomkyr/"
cd "$root"
node tools/fomkyr-manifest.mjs
