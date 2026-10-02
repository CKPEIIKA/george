#!/usr/bin/env bash
# Package corresponding sources and component notices beside the static site.
set -euo pipefail
root=$(cd "$(dirname "$0")/.." && pwd)
toolchain=${GEORGE_TOOLCHAIN:-$root/build/toolchain}
mkdir -p "$root/web/sources" "$root/web/licenses"
node "$root/tools/package-ui.mjs"
cp "$root/licenses/BGPL.txt" "$root/licenses/GPL-2.0.txt" "$root/web/licenses/"
cp "$toolchain/ecl-src/LICENSE" "$root/web/licenses/ECL-NOTICE.txt"
cp "$toolchain/ecl-src/COPYING" "$root/web/licenses/LGPL-2.1.txt"
cp "$toolchain/ecl-src/src/gmp/COPYING.LIB" "$root/web/licenses/GMP-LICENSE.txt"
cp "$toolchain/ecl-src/src/bdwgc/README.md" "$root/web/licenses/GC-NOTICE.txt"
cp "$toolchain/emsdk/upstream/emscripten/LICENSE" "$root/web/licenses/EMSCRIPTEN-LICENSE.txt"
cat >"$root/web/licenses/NOTICE.txt" <<'EOF'
George: Copyright 2026 the George contributors. BGPL or GPL-2.0-or-later.
bergman-1.001-fix: patched Bergman 1.001; original behavior via legacy mode.
Bergman 1.001: Copyright 1992-2006 Joergen Backelin and others. BGPL.
ECL 26.5.5 and its bundled GMP 4.2.1: LGPL-2.1-or-later.
Boehm-Demers-Weiser GC: permissive; see GC-NOTICE.txt for copyright holders.
Emscripten runtime: MIT or University of Illinois/NCSA.
MathJax 4.1.3 and New Computer Modern SVG data: Apache-2.0; see ../vendor/mathjax/NOTICE.txt and LICENSE.
fomkyr 0.4.0: MIT; see ../engine/fomkyr/LICENSE.txt.
Historical George Native NC 0.1.0: MIT; see ../engine/native/LICENSE.txt.

Full notices and license texts accompany this file.
Corresponding sources: ../sources/george-source.tar.gz and ecl-source.tar.gz.
Build/relink instructions: ports/ecl/build.sh and tools/build-backends.sh in George source.
No OCaml or Singular implementation is included in the browser engine.
EOF
git -C "$toolchain/ecl-src" archive --format=tar --prefix=ecl/ 59f60e09102961bf5872c672fdd9d200b2e83d6b | gzip -n >"$root/web/sources/ecl-source.tar.gz"
# Only tracked or staged files belong to the release. Concurrent untracked
# work stays in the workspace and cannot enter the downloadable archive.
git -C "$root" ls-files -z -- \
  README.md LICENSE.md package.json package-lock.json .gitignore .gitattributes .github \
  licenses ports tools test docs vendor web | \
  tar -C "$root" --exclude='web/sources/*' --exclude='web/engine/ecl.*' \
    --exclude='web/engine/*/ecl.*' \
    --null -czf "$root/web/sources/george-source.tar.gz" --files-from=-
sha256sum "$root/web/sources/"*.tar.gz >"$root/build/source-archives.sha256"
