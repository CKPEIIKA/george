#!/usr/bin/env bash
# Reproducible ECL -> Wasm build. Downloads and outputs stay under build/.
set -euo pipefail
root=$(cd "$(dirname "$0")/../.." && pwd)
toolchain=${GEORGE_TOOLCHAIN:-$root/build/toolchain}
revision=59f60e09102961bf5872c672fdd9d200b2e83d6b
emsdk_revision=e566f7bdcc7735f44037911c24b87a58a3c93145
jobs=${JOBS:-4}
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
if [[ ! -f "$toolchain/ecl-wasm/libecl.a" ]]; then
  source "$toolchain/emsdk/emsdk_env.sh" >/dev/null 2>&1
  export ECL_TO_RUN="$toolchain/ecl-host/bin/ecl" EMSDK_PATH="$toolchain/emsdk"
  (cd "$toolchain/ecl-wasm-src"
   emconfigure ./configure --host=wasm32-unknown-emscripten --build="$(./src/gmp/config.guess)" \
    --with-cross-config="$toolchain/ecl-wasm-src/src/util/wasm32-unknown-emscripten.cross_config" \
    --prefix="$toolchain/ecl-wasm" --disable-shared --disable-threads --with-tcp=no --with-cmp=no
   emmake make -j"$jobs"
   emmake make install) >"$toolchain/ecl-wasm-build.log" 2>&1
fi
runtime=$root/build/ecl-runtime-$(date +%Y%m%d-%H%M%S)-$$
"$root/ports/ecl/build-bergman.sh" "$root/vendor/bergman-1.001" "$runtime" "$toolchain/ecl-host/bin/ecl"
"$root/ports/ecl/link-wasm.sh" "$runtime"
python3 - "$root" "$runtime" <<'PY'
from pathlib import Path
import hashlib,json,sys
root=Path(sys.argv[1]); engine=root/'web/engine'
data={'bergman':'1.001','ecl':'59f60e09102961bf5872c672fdd9d200b2e83d6b','emscripten':'4.0.12','runtime':sys.argv[2], 'files':{p.name:{'bytes':p.stat().st_size,'sha256':hashlib.sha256(p.read_bytes()).hexdigest()} for p in engine.glob('ecl.*')}}
(root/'build/engine-build.json').write_text(json.dumps(data,indent=2))
del data['runtime']
(engine/'build.json').write_text(json.dumps(data,indent=2))
PY
