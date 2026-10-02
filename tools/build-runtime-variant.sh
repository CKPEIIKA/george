#!/usr/bin/env bash
# Build a complete ECL/GMP/GC variant without replacing the published engine.
# Usage: bash tools/build-runtime-variant.sh O2 /tmp/george-perf/O2 /tmp/runtime [emscripten|wasm]
set -euo pipefail
root=$(cd "$(dirname "$0")/.." && pwd)
opt=${1:?Supply O0, O1, O2 or O3}
destination=${2:?Supply a fresh absolute build directory}
runtime=${3:?Supply an existing Bergman bytecode runtime directory}
longjmp=${4:-emscripten}
lto=${GEORGE_LTO:-0}
link_opt=${GEORGE_LINK_OPT:--O2}
memory64=${GEORGE_MEMORY64:-0}
case "$opt" in O0|O1|O2|O3) ;; *) echo "Unsupported optimization: $opt" >&2; exit 2;; esac
case "$longjmp" in emscripten|wasm) ;; *) echo "Unsupported longjmp mode: $longjmp" >&2; exit 2;; esac
case "$lto" in 0|1) ;; *) echo 'GEORGE_LTO must be 0 or 1' >&2; exit 2;; esac
case "$link_opt" in -O0|-O1|-O2|-O3) ;; *) echo 'Unsupported link optimization' >&2; exit 2;; esac
case "$memory64" in 0|1) ;; *) echo 'GEORGE_MEMORY64 must be 0 or 1' >&2; exit 2;; esac
[[ $destination == /* && ! -e $destination ]] || {
  echo 'The build directory must be absolute and must not exist.' >&2; exit 2;
}
[[ -f "$runtime/bin/ecl/boot.lisp" ]] || { echo 'Missing Bergman runtime' >&2; exit 2; }
toolchain=${GEORGE_TOOLCHAIN:-$root/build/toolchain}
revision=59f60e09102961bf5872c672fdd9d200b2e83d6b
mkdir -p "$destination"
git clone -q "$toolchain/ecl-wasm-src" "$destination/source"
git -C "$destination/source" checkout -q "$revision"
python3 "$root/ports/ecl/configure-runtime.py" "$destination/source" "$opt" "$longjmp" "$lto" "$memory64"
source "$toolchain/emsdk/emsdk_env.sh" >/dev/null 2>&1
export ECL_TO_RUN="$toolchain/ecl-host/bin/ecl" EMSDK_PATH="$toolchain/emsdk"
export LD_LIBRARY_PATH="$toolchain/ecl-host/lib64:$toolchain/ecl-host/lib${LD_LIBRARY_PATH:+:$LD_LIBRARY_PATH}"
for host_library in "$toolchain/ecl-host"/lib{,64}/ecl-*; do
  if [[ -x "$host_library/ecl_min" ]]; then export ECLDIR="$host_library/"; break; fi
done
export PATH="$toolchain/ecl-host/bin:$PATH"
target=wasm32-unknown-emscripten
cross_config="$destination/source/src/util/$target.cross_config"
if [[ $memory64 == 1 ]]; then
  target=wasm64-unknown-emscripten
  cross_config="$root/ports/ecl/wasm64-unknown-emscripten.cross_config"
  export CFLAGS="${CFLAGS:-} -std=gnu17 -sMEMORY64=1" CXXFLAGS="${CXXFLAGS:-} -sMEMORY64=1"
  export LDFLAGS="${LDFLAGS:-} -sMEMORY64=1"
fi
(
  cd "$destination/source"
  emconfigure ./configure --host="$target" --build="$(./src/gmp/config.guess)" \
    --with-cross-config="$cross_config" \
    --prefix="$destination/prefix" --disable-shared --disable-threads --with-tcp=no --with-cmp=no
  if [[ $memory64 == 1 ]]; then
    python3 "$root/ports/ecl/prepare-memory64-paths.py" "$destination/source" "$destination/prefix"
  fi
  emmake make -j"${JOBS:-3}"
  emmake make install
) >"$destination/build.log" 2>&1
GEORGE_ECL_WASM="$destination/prefix" GEORGE_ENGINE_DIR="$destination/engine" \
  GEORGE_PROFILE="${GEORGE_PROFILE:-1}" GEORGE_LONGJMP="$longjmp" GEORGE_LTO="$lto" \
  GEORGE_LINK_OPT="$link_opt" "$root/ports/ecl/link-wasm.sh" "$runtime" >"$destination/link.log" 2>&1
python3 - "$destination" "$opt" "$runtime" "$longjmp" "${GEORGE_PROFILE:-1}" "$lto" "$link_opt" "$memory64" <<'PY'
from pathlib import Path
import hashlib, json, sys
out = Path(sys.argv[1])
report = {'optimization':sys.argv[2], 'linkOptimization':sys.argv[7].removeprefix('-'),
          'lto':sys.argv[6]=='1', 'profile':sys.argv[5]=='1', 'longjmp':sys.argv[4],
          'ecl':'59f60e09102961bf5872c672fdd9d200b2e83d6b', 'emscripten':'4.0.12',
          'runtime':sys.argv[3], 'files':{p.name:{'bytes':p.stat().st_size,
          'sha256':hashlib.sha256(p.read_bytes()).hexdigest()} for p in (out/'engine').glob('ecl.*')}}
report['memory64'] = sys.argv[8] == '1'
(out/'build.json').write_text(json.dumps(report, indent=2)+'\n')
PY
echo "$destination/engine"
