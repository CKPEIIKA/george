#!/bin/sh
# Build Bergman's CLISP/Common Lisp sources with native ECL.
#
#   build-bergman.sh <bergman-root> <work-dir> [ecl-executable]
#
# The upstream tree is read-only. All generated and patched files stay in the
# fresh work directory. The resulting tree can be loaded by the ECL Wasm build.
set -eu

[ "$#" -ge 2 ] && [ "$#" -le 3 ] || {
  echo "usage: $0 <bergman-root> <work-dir> [ecl-executable]" >&2
  exit 2
}

here=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
src=$(CDPATH= cd -- "$1" && pwd)
work=$2
ecl=${3:-${ECL_BIN:-ecl}}
[ ! -e "$work" ] || { echo "$work already exists; choose a new directory" >&2; exit 2; }
case "$ecl" in
  */*) case "$ecl" in /*) ;; *) ecl=$(CDPATH= cd -- "$(dirname -- "$ecl")" && pwd)/$(basename -- "$ecl");; esac ;;
  *) ecl=$(command -v "$ecl") ;;
esac
mkdir -p "$work"
bmroot=$(CDPATH= cd -- "$work" && pwd)

(cd "$src" && tar cf - \
  --exclude=./java-shell --exclude=./doc --exclude=./docs \
  --exclude=./tests --exclude=./bergman-js .) | (cd "$bmroot" && tar xf -)

export bmroot bmsrc=$bmroot/src bmdomains=$bmroot/domains
export bmaux=$bmroot/auxil bmauxil=$bmroot/auxil
export bmload=$bmroot/lap/ecl bmexe=$bmroot/bin/ecl
export bmvers
bmvers=$(cat "$bmroot/auxil/version")
clsrc=$bmroot/scripts/clisp/unix
clasrc=$bmroot/auxil/clisp
mkdir -p "$bmload" "$bmexe"
cd "$bmexe"

run() {
  label=$1
  shift
  echo "== $label"
  timeout 900 "$ecl" --norc --load "$here/prelude.lisp" "$@" \
    </dev/null >>bergman.log 2>&1 || {
      echo "FAILED during $label (see $bmexe/bergman.log)" >&2
      tail -60 bergman.log >&2
      exit 1
    }
}

cp "$clsrc"/setcmp1.sl speccmp1.sl
cp "$clsrc"/setcmp2.sl speccmp2.sl
cp "$clsrc"/setlisp.sl speclisp.sl
cp "$clsrc"/setmacr.sl specmacr.sl
cp "$clsrc"/setmode.sl specmode.sl
cp "$clasrc"/versmacr.sl "$clasrc"/switches.lsp "$clasrc"/environ.lsp "$clasrc"/environ0.lsp .
"$here/../common/cl-patches.sh" "$bmroot" "$bmexe/environ.lsp"
python3 "$here/source-patches.py" "$bmroot"
printf '\n(defun ENVVARSSET () nil)\n' >>environ0.lsp
cat "$clasrc"/envhead-cl.lsp "$clasrc"/compext-cl.lsp >compext-cl.lsp
cat "$clasrc"/envhead-cl.lsp "$clasrc"/comphead-cl.lsp "$bmroot"/auxil/compile.sl "$clasrc"/comptail-cl.lsp >compile-cl.lsp
cat "$clasrc"/envhead-cl.lsp "$clasrc"/comphead-cl.lsp "$bmroot"/auxil/compan.sl "$clasrc"/comptail-cl.lsp >compan.lsp
cp "$bmroot/src/alg2lsp.sl" .
: >bergman.log

cp environ0.lsp environ0.fas
cp environ.lsp environ.fas
cat >environ-step.lisp <<'EOF'

(load "environ0.fas")

(load "environ.fas")
(EXT:QUIT)
EOF
run environ --load environ-step.lisp
for step in compext-cl compile-cl compan; do
  run "$step" --load "$step.lsp" --eval '(EXT:QUIT)'
done
cp "$bmload"/* . 2>/dev/null || true
cp "$bmload/alg2lsp.fas" "$bmload/alg2lsp.b"
{
  cat "$clasrc"/envhead-cl.lsp "$clasrc"/bmhead-cl.lsp
  printf '\n(OFF RAISE)\n(LAPIN (MKBMPATHEXPAND "$bmsrc/macros.sl"))\n(OFF RAISE)\n'
  cat "$bmroot/auxil/bmtop.sl"
  cat "$here/../common/george-overlay.sl"
  sed '/^(SAVEINITMEM /d; /^[(]QUIT[)]/d' "$clasrc"/bmtail-cl.lsp
} >bmtop-cl.lsp
sed -i '1i;; Modified by George on 2026-09-30: ECL loads this program in-process; no CLISP image is saved.' bmtop-cl.lsp
cp "$here/boot.lisp" "$bmexe/boot.lisp"
cp "$here/prelude.lisp" "$bmexe/prelude.lisp"
run bmtop --eval '(SETF *DEBUGGER-HOOK* (LAMBDA (C H) (DECLARE (IGNORE H)) (FORMAT *ERROR-OUTPUT* "~&~A~%" C) (EXT:QUIT 1)))' --load bmtop-cl.lsp --eval '(EXT:QUIT)'

echo "Built ECL Bergman runtime at $bmroot"
