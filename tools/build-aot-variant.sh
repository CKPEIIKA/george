#!/usr/bin/env bash
# Compile Bergman's existing Lisp functions to C and link an isolated engine.
# Usage: bash tools/build-aot-variant.sh DESTINATION RUNTIME [ECL_WASM_PREFIX]
set -euo pipefail
root=$(cd "$(dirname "$0")/.." && pwd)
destination=${1:?Supply a fresh absolute build directory}
runtime=${2:?Supply a Bergman runtime directory}
toolchain=${GEORGE_TOOLCHAIN:-$root/build/toolchain}
prefix=${3:-$toolchain/ecl-wasm-neutral-O2}
case "${GEORGE_LINK_OPT:--O2}" in -O0|-O1|-O2|-O3) ;; *) echo 'Unsupported link optimization' >&2; exit 2;; esac
[[ $destination == /* && ! -e $destination ]] || {
  echo 'The build directory must be absolute and must not exist.' >&2; exit 2;
}
[[ -f "$runtime/bin/ecl/boot.lisp" && -f "$prefix/target-info.lsp" ]] || {
  echo 'Missing runtime or ECL target information.' >&2; exit 2;
}
mkdir -p "$destination"
cp -a "$runtime" "$destination/runtime"
cp -a "$runtime" "$destination/host-runtime"
source "$toolchain/emsdk/emsdk_env.sh" >/dev/null 2>&1
export LD_LIBRARY_PATH="$toolchain/ecl-host/lib64:$toolchain/ecl-host/lib${LD_LIBRARY_PATH:+:$LD_LIBRARY_PATH}"
for host_library in "$toolchain/ecl-host"/lib{,64}/ecl-*; do
  if [[ -x "$host_library/ecl_min" ]]; then export ECLDIR="$host_library/"; break; fi
done
export GEORGE_AOT_DIRECTORY="$destination" GEORGE_AOT_RUNTIME="$destination/host-runtime"
export GEORGE_ECL_WASM="$prefix" GEORGE_AOT_CC_FLAGS="${GEORGE_LINK_OPT:--O2}"
case "${GEORGE_MEMORY64:-0}" in
  0) ;;
  1) GEORGE_AOT_CC_FLAGS+=' -sMEMORY64=1' ;;
  *) echo 'GEORGE_MEMORY64 must be 0 or 1' >&2; exit 2 ;;
esac
case "${GEORGE_LTO:-0}" in
  0) ;;
  1) GEORGE_AOT_CC_FLAGS+=' -flto' ;;
  *) echo 'GEORGE_LTO must be 0 or 1' >&2; exit 2 ;;
esac
export bmroot=$GEORGE_AOT_RUNTIME bmsrc=$GEORGE_AOT_RUNTIME/src
export bmdomains=$GEORGE_AOT_RUNTIME/domains bmaux=$GEORGE_AOT_RUNTIME/auxil
export bmauxil=$bmaux bmload=$GEORGE_AOT_RUNTIME/lap/ecl bmexe=$GEORGE_AOT_RUNTIME/bin/ecl
export bmvers=1.001
(
  cd "$bmexe"
  timeout 900 "$toolchain/ecl-host/bin/ecl" --norc \
    --eval '(SETF *DEBUGGER-HOOK* (LAMBDA (C H) (DECLARE (IGNORE H)) (FORMAT *ERROR-OUTPUT* "~&~A~%" C) (EXT:QUIT 1)))' \
    --load "$root/ports/ecl/aot.lisp" </dev/null
) >"$destination/compile.log" 2>&1
GEORGE_AOT_LIBRARY="$destination/libgeorge-aot.a" GEORGE_ENGINE_DIR="$destination/engine" \
  GEORGE_PROFILE=0 "$root/ports/ecl/link-wasm.sh" "$destination/runtime" >"$destination/link.log" 2>&1
python3 - "$destination" "$prefix" "${GEORGE_LINK_OPT:--O2}" "${GEORGE_LTO:-0}" <<'PY'
from pathlib import Path
import hashlib, json, sys
out = Path(sys.argv[1])
prefix = Path(sys.argv[2])
metadata = prefix/'george-runtime.json'
if not metadata.exists(): metadata = prefix.parent/'build.json'
library = json.loads(metadata.read_text())
report = {'aot': True, 'prefix': sys.argv[2], 'optimization': library['optimization'],
          'memory64': bool(library.get('memory64', False)),
          'linkOptimization': sys.argv[3].removeprefix('-'),
          'libraryLto': bool(library.get('lto', False)),
          'lto': sys.argv[4] == '1', 'profile': False,
          'compilation': json.loads((out/'compile.json').read_text()),
          'files': {p.name: {'bytes': p.stat().st_size,
                            'sha256': hashlib.sha256(p.read_bytes()).hexdigest()}
                    for p in (out/'engine').glob('ecl.*')}}
(out/'build.json').write_text(json.dumps(report, indent=2)+'\n')
PY
echo "$destination/engine"
