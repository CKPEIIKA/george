#!/usr/bin/env bash
# Build an isolated C / ECL O3 + LTO memory64 engine. Install after validation.
# Usage: bash tools/build-memory64-backend.sh DESTINATION BERGMAN_RUNTIME
set -euo pipefail
root=$(cd "$(dirname "$0")/.." && pwd)
destination=${1:?Supply a fresh absolute build directory}
runtime=${2:?Supply the existing Bergman bytecode runtime}
[[ $destination == /* && ! -e $destination ]] || {
  echo 'The build directory must be absolute and must not exist.' >&2; exit 2;
}
[[ -f "$runtime/bin/ecl/boot.lisp" ]] || { echo 'Missing Bergman runtime' >&2; exit 2; }
revision=fc6a7977cccea66c7d78f3d86eb0cdac9f37cbdb
archive_sha=279890263304a158a947a4b9989f4d0e112d3a820e57d5bf5fad8af21866216d
mkdir -p "$destination"
if [[ -n ${GEORGE_BINARYEN_SOURCE_ARCHIVE:-} ]]; then
  cp "$GEORGE_BINARYEN_SOURCE_ARCHIVE" "$destination/binaryen.tar.gz"
else
  curl --fail --location --retry 3 \
    "https://codeload.github.com/WebAssembly/binaryen/tar.gz/$revision" \
    -o "$destination/binaryen.tar.gz"
fi
python3 - "$destination/binaryen.tar.gz" "$archive_sha" <<'PY'
import hashlib, pathlib, sys
assert hashlib.sha256(pathlib.Path(sys.argv[1]).read_bytes()).hexdigest() == sys.argv[2], 'Binaryen archive checksum mismatch'
PY
mkdir "$destination/binaryen-source"
tar -xzf "$destination/binaryen.tar.gz" --strip-components=1 -C "$destination/binaryen-source"
patch -d "$destination/binaryen-source" -p1 < "$root/ports/ecl/binaryen-memory64-stack.patch"
# Host compiler optimization does not affect the engine's O3 + LTO flags.
cmake -S "$destination/binaryen-source" -B "$destination/binaryen-build" -G Ninja \
  -DCMAKE_BUILD_TYPE=Release -DCMAKE_C_FLAGS_RELEASE='-O1 -DNDEBUG' \
  -DCMAKE_CXX_FLAGS_RELEASE='-O1 -DNDEBUG' -DENABLE_WERROR=OFF -DBUILD_TESTS=OFF
cmake --build "$destination/binaryen-build" --parallel "${JOBS:-3}" \
  --target wasm-opt wasm-metadce wasm-emscripten-finalize
export EM_BINARYEN_ROOT="$destination/binaryen-build"
export GEORGE_MEMORY64=1 GEORGE_LTO=1 GEORGE_LINK_OPT=-O3 GEORGE_PROFILE=0
bash "$root/tools/build-runtime-variant.sh" O3 "$destination/lisp" "$runtime"
# ECL records Lisp source locations in compiled function metadata. Compile
# under a neutral path even when the toolchain build lives in a home directory.
neutral_aot=$(mktemp -d /tmp/george-memory64-aot.XXXXXX)
bash "$root/tools/build-aot-variant.sh" "$neutral_aot/compiled" "$runtime" "$destination/lisp/prefix"
mv "$neutral_aot/compiled" "$destination/compiled"
rmdir "$neutral_aot"
python3 - "$destination/compiled/build.json" "$root/ports/ecl/binaryen-memory64-stack.patch" "$revision" <<'PY'
import hashlib, json, pathlib, sys
p = pathlib.Path(sys.argv[1]); d = json.loads(p.read_text())
d['binaryen'] = {'revision': sys.argv[3], 'memory64StackPatchSha256': hashlib.sha256(pathlib.Path(sys.argv[2]).read_bytes()).hexdigest()}
p.write_text(json.dumps(d, indent=2)+'\n')
PY
echo "$destination/compiled/engine"
