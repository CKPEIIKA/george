#!/bin/sh
# Portability patches for bergman's Common Lisp build: make it behave on a
# standard Common Lisp (SBCL, ECL) as it did on CLISP. Default-mode behavior
# fixes are applied by behavior-patches.py and george-overlay.sl.
#
#   cl-patches.sh <build-copy-root> <environ.lsp copy>
#
# Applied by the port build scripts to their copy of the tree only, never to
# vendor/.  As the Bergman General Public License (2a) requires, each file
# changed here gets a dated notice.
set -e
bm=$1; env=$2
python3 "$(dirname "$0")/behavior-patches.py" "$bm"
notice() { # file comment-prefix text
  sed -i "1i $2 Modified by George on 2026-09-30 (ports/common/cl-patches.sh): $3" "$1"
}
# 1. Standard CL types *STANDARD-INPUT* as a stream, so it cannot be bound
#    to NIL as CLISP allowed.
sed -i 's/(PROG (\*STANDARD-INPUT\* |sav-raise|)/(PROG ((*STANDARD-INPUT* *STANDARD-INPUT*) |sav-raise|)/' $env
sed -i 's/(PROG (!\*STANDARD!-INPUT!\* rval)/(PROG ((!*STANDARD!-INPUT!* !*STANDARD!-INPUT!*) rval)/' $bm/src/slext.sl
# 2. bergman may write to a channel it already closed (ENDDEGREEOUTPUT closes
#    GBasOutChan without resetting it).  CLISP then wrote to the terminal; a
#    standard CL signals an error.  Treat a closed stream as the terminal in
#    RDS and WRS, and skip FLUSHCHANNEL on it.
sed -i 's/  (when (null stream)$/  (when (or (null stream) (not (open-stream-p stream)))/' $env
sed -i 's/(CL!-SPECIFIC (DE FLUSHCHANNEL (stream) (FORCE-OUTPUT stream)) )/(CL!-SPECIFIC (DE FLUSHCHANNEL (stream) (COND ((OR (NULL stream) (OPEN-STREAM-P stream)) (FORCE-OUTPUT stream)))) )/' $bm/src/slext.sl
notice $env ';' 'bind *STANDARD-INPUT* to a stream in M-LAPIN; RDS/WRS treat a closed stream as the terminal.'
notice $bm/src/slext.sl '%' 'bind *STANDARD-INPUT* to a stream in DSKIN; FLUSHCHANNEL skips closed streams.'
