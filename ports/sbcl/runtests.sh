#!/bin/sh
# Run the CLISP regression list (tests/clisp/unix/clisp_list) against a build
# made by build.sh, and compare with the reference outputs.
#
#   runtests.sh <work-dir> <run-name> [legacy]
#   e.g. ports/sbcl/runtests.sh build/sbcl run1
#
# With "legacy", the run starts with (SETLEGACYMODE T), reproducing bergman
# 1.001 exactly; without it George's fixes (george-overlay.sl) are active.
#
# Outputs go to <work-dir>/tests/<run-name>, which must not exist.  The
# reference files are only read; nothing is deleted.
set -e
[ $# -ge 2 ] || { echo "usage: $0 <work-dir> <run-name> [legacy]"; exit 2; }
bm=$(cd "$1" && pwd); out=$bm/tests/$2
mkdir "$out"
{ [ "$3" = legacy ] && echo '(SETLEGACYMODE T)'; sed "s|\.\./\.\./test_bergman/clisp/|../../$2/|g" $bm/tests/clisp/unix/clisp_list; } > $out/list
cd $bm/tests/clisp/unix
start=$(date +%s.%N)
printf '(OFF GC)\n(DSKIN "../../%s/list")\n(QUIT)\n' "$2" | timeout 900 $bm/bin/clisp/unix/bergman > $out/logfile 2>&1 || { echo "bergman exit status $?"; exit 1; }
python3 -c 'import sys,time; print("run time: %.3fs" % (time.time()-float(sys.argv[1])))' "$start"
cd $bm/tests
for f in $(grep -oE '"\.\./\.\./test_bergman/clisp/[^"]*"' clisp/unix/clisp_list | tr -d '"' | sed 's|.*/||' | sort -u); do
  b=${f%.gb}; cl=-; run07=-; psl=-
  if [ ! -f $out/$f ]; then printf '%-18s MISSING\n' $f; continue; fi
  for r in test_bergman/clisp/$f.old test_bergman/clisp/$b.old; do [ -f $r ] && { cmp -s $out/$f $r && cl=same || cl=DIFF; break; }; done
  [ -f test_bergman/clisp/$f ] && { cmp -s $out/$f test_bergman/clisp/$f && run07=same || run07=DIFF; }
  for r in test_bergman/$f.old test_bergman/$b.old; do [ -f $r ] && { diff -bq $out/$f $r >/dev/null && psl=same || psl=DIFF; break; }; done
  printf '%-18s CLISP-ref: %-5s CLISP-2007-run: %-5s PSL-ref: %s\n' $f $cl $run07 $psl
done
python3 - "$bm" "$out" "${3:-fixed}" <<'PY'
from pathlib import Path
import re,sys
root,out,mode=Path(sys.argv[1]),Path(sys.argv[2]),sys.argv[3]
names=sorted(set(re.findall(r'../../test_bergman/clisp/([^" ]+)',(root/'tests/clisp/unix/clisp_list').read_text())))
for name in names:
    expected=root/'tests/test_bergman'/('ncpbhg.pb.old' if mode!='legacy' and name=='ncpbhg.pb' else 'clisp/'+name)
    assert (out/name).read_bytes()==expected.read_bytes(), 'Regression mismatch: '+name
print(f'{len(names)} exact outputs passed ({mode}).')
PY
