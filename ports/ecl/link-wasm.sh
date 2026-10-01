#!/usr/bin/env bash
set -euo pipefail
root=$(cd "$(dirname "$0")/../.." && pwd)
toolchain=${GEORGE_TOOLCHAIN:-$root/build/toolchain}
runtime=${1:-$root/build/ecl-runtime}
source "$toolchain/emsdk/emsdk_env.sh" >/dev/null 2>&1
prefix=${GEORGE_ECL_WASM:-$toolchain/ecl-wasm-neutral-${GEORGE_ECL_OPT:-O2}}
engine=${GEORGE_ENGINE_DIR:-$root/web/engine}
mkdir -p "$engine"
# Link from inside web/engine with a relative output name, so the loader
# refers to "ecl.data" rather than to this checkout's absolute path.
cd "$engine"
profile_flags=()
if [[ ${GEORGE_PROFILE:-0} == 1 ]]; then
  profile_flags=("$root/ports/ecl/profile.c" --profiling-funcs)
fi
longjmp_flags=()
if [[ ${GEORGE_LONGJMP:-emscripten} == wasm ]]; then
  longjmp_flags=(-sSUPPORT_LONGJMP=wasm)
fi
lto_flags=()
case "${GEORGE_LTO:-0}" in
  0) ;;
  1) lto_flags=(-flto) ;;
  *) echo 'GEORGE_LTO must be 0 or 1' >&2; exit 2 ;;
esac
aot_flags=()
if [[ -n ${GEORGE_AOT_LIBRARY:-} ]]; then
  [[ -f "$GEORGE_AOT_LIBRARY" ]] || { echo 'Missing AOT library' >&2; exit 2; }
  aot_flags=(-DGEORGE_AOT "$GEORGE_AOT_LIBRARY")
fi
emcc "$root/ports/ecl/bridge.c" -ffile-prefix-map="$root"=. -I"$prefix" \
  "${profile_flags[@]}" \
  "${longjmp_flags[@]}" \
  "${lto_flags[@]}" \
  "${aot_flags[@]}" \
  -L"$prefix" -lecl -leclgmp -leclgc -lm \
  "${GEORGE_LINK_OPT:--O2}" -DECL_C_COMPATIBLE_VARIADIC_DISPATCH \
  -sBINARYEN_EXTRA_PASSES=--spill-pointers -sSTACK_SIZE=8388608 \
  -sINITIAL_MEMORY=67108864 -sALLOW_MEMORY_GROWTH=1 -sMAXIMUM_MEMORY=4294967296 \
  -sMODULARIZE=1 -sEXPORT_ES6=1 -sEXPORT_NAME=createGeorgeModule \
  -sENVIRONMENT=web,worker,node -sFORCE_FILESYSTEM=1 \
  -sEXPORTED_RUNTIME_METHODS='["ccall","FS","HEAPU8"]' \
  --no-entry --preload-file "$runtime@/george" \
  --exclude-file '*.log' --exclude-file '*.old' --exclude-file '*~' \
  -o ecl.js
