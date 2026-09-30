#!/usr/bin/env bash
# Reproducible ECL -> Wasm build. Downloads and cached tools stay under build/.
#
# Everything whose path ends up inside the published engine files (the Wasm
# ECL library and the compiled bergman runtime) is compiled below a neutral
# directory, GEORGE_NEUTRAL_DIR (default /tmp/george-build), so the engine
# does not contain the builder's home directory.  That directory is never
# deleted by this script; a previous one must be removed by hand or another
# GEORGE_NEUTRAL_DIR given.
set -euo pipefail
root=$(cd "$(dirname "$0")/../.." && pwd)
toolchain=${GEORGE_TOOLCHAIN:-$root/build/toolchain}
revision=59f60e09102961bf5872c672fdd9d200b2e83d6b
emsdk_revision=e566f7bdcc7735f44037911c24b87a58a3c93145
jobs=${JOBS:-4}
neutral=${GEORGE_NEUTRAL_DIR:-/tmp/george-build}
eclwasm=$toolchain/ecl-wasm-neutral
mkdir -p "$toolchain"
if [[ ! -d "$toolchain/emsdk/.git" ]]; then
  git clone https://github.com/emscripten-core/emsdk.git "$toolchain/emsdk"
  git -C "$toolchain/emsdk" checkout "$emsdk_revision"
fi
[[ $(git -C "$toolchain/emsdk" rev-parse HEAD) == "$emsdk_revision" ]] || { echo 'Unexpected emsdk revision' >&2; exit 1; }
if [[ ! -f "$toolchain/emsdk/upstream/emscripten/emcc" ]]; then
  "$toolchain/emsdk/emsdk" install 4.0.12
  "$toolchain/emsdk/emsdk" activate 4.0.12
fi
for name in ecl-src ecl-wasm-src; do
  if [[ ! -d "$toolchain/$name/.git" ]]; then
    git clone https://gitlab.com/embeddable-common-lisp/ecl.git "$toolchain/$name"
    git -C "$toolchain/$name" checkout "$revision"
  fi
  [[ $(git -C "$toolchain/$name" rev-parse HEAD) == "$revision" ]] || { echo "Unexpected ECL revision in $name" >&2; exit 1; }
done
if [[ ! -x "$toolchain/ecl-host/bin/ecl" ]]; then
  (cd "$toolchain/ecl-src"; ./configure --prefix="$toolchain/ecl-host"; make -j"$jobs"; make install) >"$toolchain/ecl-host-build.log" 2>&1
fi
if [[ ! -f "$eclwasm/libecl.a" ]]; then
  [[ ! -e "$neutral/ecl-wasm-src" && ! -e "$neutral/ecl-wasm" ]] || {
    echo "$neutral already holds an ECL build; remove it or set GEORGE_NEUTRAL_DIR" >&2; exit 2; }
  mkdir -p "$neutral"
  git clone -q "$toolchain/ecl-wasm-src" "$neutral/ecl-wasm-src"
  git -C "$neutral/ecl-wasm-src" checkout -q "$revision"
  source "$toolchain/emsdk/emsdk_env.sh" >/dev/null 2>&1
  export ECL_TO_RUN="$toolchain/ecl-host/bin/ecl" EMSDK_PATH="$toolchain/emsdk"
  (cd "$neutral/ecl-wasm-src"
   emconfigure ./configure --host=wasm32-unknown-emscripten --build="$(./src/gmp/config.guess)" \
    --with-cross-config="$neutral/ecl-wasm-src/src/util/wasm32-unknown-emscripten.cross_config" \
    --prefix="$neutral/ecl-wasm" --disable-shared --disable-threads --with-tcp=no --with-cmp=no
   emmake make -j"$jobs"
   emmake make install) >"$toolchain/ecl-wasm-neutral-build.log" 2>&1
  cp -a "$neutral/ecl-wasm" "$eclwasm"
fi
runtime=$neutral/runtime-$(date +%Y%m%d-%H%M%S)-$$
"$root/ports/ecl/build-bergman.sh" "$root/vendor/bergman-1.001" "$runtime" "$toolchain/ecl-host/bin/ecl"
GEORGE_ECL_WASM="$eclwasm" "$root/ports/ecl/link-wasm.sh" "$runtime"
python3 - "$root" "$runtime" <<'PY'
from pathlib import Path
import hashlib,json,sys
root=Path(sys.argv[1]); engine=root/'web/engine'
data={'bergman':'bergman-1.001-fix','upstreamBergman':'1.001','defaultBehavior':'fixed','legacyBehavior':'original','appVersion':json.loads((root/'package.json').read_text())['version'],'ecl':'59f60e09102961bf5872c672fdd9d200b2e83d6b','emscripten':'4.0.12','runtime':sys.argv[2], 'files':{p.name:{'bytes':p.stat().st_size,'sha256':hashlib.sha256(p.read_bytes()).hexdigest()} for p in engine.glob('ecl.*')}}
(root/'build/engine-build.json').write_text(json.dumps(data,indent=2))
del data['runtime']
(engine/'build.json').write_text(json.dumps(data,indent=2))
PY
