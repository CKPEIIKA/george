#!/usr/bin/env python3
"""Dated fixes in build copies. Each branch preserves legacy behavior."""
from pathlib import Path
import sys
root = Path(sys.argv[1])
p = root / 'src/main.sl'
s = p.read_text()
needle = "\t((NOT (OR SPairs InPols))\n\t (RETURN 'Done))"
assert s.count(needle) == 2
replacement = needle + """
        ((AND (NOT GEORGELEGACYMODE) MAXDEG
              (OR (NOT InPols)
                  (LESSP MAXDEG (TOTALDEGREE (APol2Lpmon (CAR InPols)))))
              (OR (NOT SPairs)
                  (LESSP MAXDEG (TOTALDEGREE (PMon (CAR SPairs))))))
         (RETURN 'MaxDegreeLimit))"""
s = s.replace(needle, replacement)
s = '% Modified by George on 2026-09-30: enforce MAXDEG in itemwise kernels in default mode.\n(GLOBAL \'(GEORGELEGACYMODE))\n' + s
p.write_text(s)

p = root / 'src/reduct.sl'
s = p.read_text()
old = '(MONLESSP (APol2Lpmon ap pm))'
assert s.count(old) == 1
s = s.replace(old, "(COND (GEORGELEGACYMODE (MONLESSP (APol2Lpmon ap pm))) (T (MONLESSP (APol2Lpmon ap) pm)))")
old = '  Fl\t(COND ((COND (GEORGELEGACYMODE'
assert s.count(old) == 1
s = s.replace(old, '  Fl\t(COND ((AND (NOT GEORGELEGACYMODE) (NOT (PolTail ap))) (RETURN NIL))\n\t      ((COND (GEORGELEGACYMODE')
old = """(LPUT!-LGET (Maplst (APol2Lm augredor)
				   'GbFactors
				   '(CONS (CONS augmon gbf) !_IBID)))"""
assert s.count(old) == 1
s = s.replace(old, "(COND (GEORGELEGACYMODE " + old + ") (T (LPUT!-LGET (Maplst (APol2Lm augredor)) 'GbFactors '(CONS (CONS augmon gbf) !_IBID))))")
p.write_text('% Modified by George on 2026-09-30: correct two misplaced parentheses and guard exhausted term traversal in MaybeReduceRedor in default mode; retain original branches in legacy mode.\n' + s)

p = root / 'src/ncmonom.sl'
s = p.read_text()
old = '(DE safenoncommMonTimes (pmon dppmon)\n (COND\t'
assert s.count(old) == 1
s = s.replace(old, old + '''((AND (NOT GEORGELEGACYMODE) (NOT (CDR pmon))
                    (CAR dppmon) (CDR dppmon))
           (noncommMONTIMES2 (CAR dppmon) (CDR dppmon)))
        ''')
p.write_text('% Modified by George on 2026-09-30: correctly multiply left * 1 * right in safe mode; preserve the original branch in legacy mode.\n' + s)
