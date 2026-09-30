#!/usr/bin/env bash
set -euo pipefail
root=$(cd "$(dirname "$0")/../.." && pwd)
toolchain=${GEORGE_TOOLCHAIN:-$root/build/toolchain}
runtime=${1:-$root/build/ecl-runtime}
source "$toolchain/emsdk/emsdk_env.sh" >/dev/null 2>&1
prefix=${GEORGE_ECL_WASM:-$toolchain/ecl-wasm-neutral}
mkdir -p "$root/web/engine"
# Link from inside web/engine with a relative output name, so the loader
# refers to "ecl.data" rather than to this checkout's absolute path.
cd "$root/web/engine"
emcc "$root/ports/ecl/bridge.c" -ffile-prefix-map="$root"=. -I"$prefix" \
  -L"$prefix" -lecl -leclgmp -leclgc -lm \
  "${GEORGE_LINK_OPT:--O2}" -DECL_C_COMPATIBLE_VARIADIC_DISPATCH \
  -sBINARYEN_EXTRA_PASSES=--spill-pointers -sSTACK_SIZE=8388608 \
  -sINITIAL_MEMORY=67108864 -sALLOW_MEMORY_GROWTH=1 \
  -sMODULARIZE=1 -sEXPORT_ES6=1 -sEXPORT_NAME=createGeorgeModule \
  -sENVIRONMENT=web,worker,node -sFORCE_FILESYSTEM=1 \
  -sEXPORTED_RUNTIME_METHODS='["ccall","FS","HEAPU8"]' \
  --no-entry --preload-file "$runtime@/george" \
  --exclude-file '*.log' --exclude-file '*.old' --exclude-file '*~' \
  -o ecl.js
