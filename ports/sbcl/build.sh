#!/bin/sh
# Build bergman's Common Lisp version with SBCL.
#
#   build.sh <bergman-root> <work-dir>
#   e.g. ports/sbcl/build.sh vendor/bergman-1.001 build/sbcl
#
# <work-dir> must not exist: the bergman tree is copied there, the
# portability patches (ports/common/cl-patches.sh) are applied to that copy,
# the steps of scripts/clisp/unix/mkbergman are replayed with SBCL instead of
# CLISP, and the George overlay (ports/common/george-overlay.sl) is loaded
# into the saved image.
# The original tree is only read.  Result: <work-dir>/bin/clisp/unix/bergman
set -e
[ $# -eq 2 ] || { echo "usage: $0 <bergman-root> <work-dir>"; exit 2; }
here=$(cd "$(dirname "$0")" && pwd)
src=$(cd "$1" && pwd)
[ -e "$2" ] && { echo "$2 already exists; give a new directory"; exit 2; }
mkdir -p "$2"; bmroot=$(cd "$2" && pwd)
(cd "$src" && tar cf - --exclude=./java-shell --exclude=./doc --exclude=./docs --exclude=./bergman-js .) | (cd "$bmroot" && tar xf -)

export bmroot bmsrc=$bmroot/src bmdomains=$bmroot/domains bmaux=$bmroot/auxil bmauxil=$bmroot/auxil
export bmload=$bmroot/lap/clisp/unix bmexe=$bmroot/bin/clisp/unix bmvers=$(cat $bmroot/auxil/version)
clsrc=$bmroot/scripts/clisp/unix; clasrc=$bmaux/clisp
mkdir -p $bmload $bmexe; cd $bmexe
SB="sbcl --noinform --non-interactive --no-userinit --load $here/prelude.lisp"
run() { echo "== $1"; shift; timeout 900 $SB "$@" </dev/null >>bergman.log 2>&1 || { echo "FAILED (see $bmexe/bergman.log)"; tail -30 bergman.log; exit 1; }; }

cp $clsrc/setcmp1.sl speccmp1.sl; cp $clsrc/setcmp2.sl speccmp2.sl; cp $clsrc/setlisp.sl speclisp.sl
cp $clsrc/setmacr.sl specmacr.sl; cp $clsrc/setmode.sl specmode.sl
cp $clasrc/versmacr.sl $clasrc/switches.lsp $clasrc/environ.lsp $clasrc/environ0.lsp .
sh $here/../common/cl-patches.sh $bmroot $bmexe/environ.lsp
# mkenvv equivalent: ENVVARSSET is a no-op, the launcher exports the variables.
printf '\n(defun ENVVARSSET () nil)\n' >> environ0.lsp
cat $clasrc/envhead-cl.lsp $clasrc/compext-cl.lsp > compext-cl.lsp
cat $clasrc/envhead-cl.lsp $clasrc/comphead-cl.lsp $bmaux/compile.sl $clasrc/comptail-cl.lsp > compile-cl.lsp
cat $clasrc/envhead-cl.lsp $clasrc/comphead-cl.lsp $bmaux/compan.sl $clasrc/comptail-cl.lsp > compan.lsp
cat $clasrc/envhead-cl.lsp $clasrc/bmhead-cl.lsp $bmaux/bmtop.sl $here/../common/george-overlay.sl $clasrc/bmtail-cl.lsp > bmtop-cl.lsp
cp $bmsrc/alg2lsp.sl .
cat $bmauxil/fvstart $bmauxil/version $bmauxil/fvend > $bmauxil/fullversion
: > bergman.log
cat > environ-step.lisp <<'EOL'
(compile-file "environ0.lsp") (load "environ0.fas")
(in-package "ENVIRON0")
(compile-file "environ.lsp") (load "environ.fas")
EOL
run environ --load environ-step.lisp
for step in compext-cl compile-cl compan; do run $step --load $step.lsp; done
cp $bmload/* . 2>/dev/null || true; cp $bmload/alg2lsp.fas $bmload/alg2lsp.b
run bmtop --load bmtop-cl.lsp
{ echo '#!/bin/sh'
  for v in bmroot bmsrc bmdomains bmaux bmauxil bmload bmexe bmvers; do eval "echo export $v=\\\"\$$v\\\""; done
  echo "exec $bmexe/bergman.exe --noinform \"\$@\""; } > bergman
chmod +x bergman
echo "Built $bmexe/bergman"
