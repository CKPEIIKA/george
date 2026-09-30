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
# The degreewise shortcut compares words lexicographically without checking
# their degrees. Safe mode permits mixed-degree tails, so that shortcut can
# sort an S-polynomial incorrectly (e.g. the idempotent braid), retain a false
# zero reductor, and make NORMALFORM loop. Use the configured full order in
# safe degreewise mode; select the original comparator dynamically in legacy
# mode so SETLEGACYMODE also works after the ring modes have been set.
old = """(COND ((EQ (GETPROCESS) 'ITEMWISE) 'instableMONLESSP)
		     (T 'stableMONLESSP))"""
assert s.count(old) == 1
s = s.replace(old, """(COND ((EQ (GETPROCESS) 'ITEMWISE) 'instableMONLESSP)
                     ((EQ (GETLOWTERMSHANDLING) 'SAFE) 'GEORGEDEGREEWISESAFEMONLESSP)
		     (T 'stableMONLESSP))""")
old = '(DE MonNonCommify ()'
assert s.count(old) == 1
s = s.replace(old, """(DE GEORGEDEGREEWISESAFEMONLESSP (pmon1 pmon2)
 (COND (GEORGELEGACYMODE (stableMONLESSP pmon1 pmon2))
       (T (instableMONLESSP pmon1 pmon2))))

""" + old)
p.write_text('% Modified by George on 2026-09-30: correctly multiply left * 1 * right and use the full term order for mixed degrees in safe noncommutative mode; preserve original branches in legacy mode.\n(GLOBAL \'(GEORGELEGACYMODE))\n' + s)

# Anick's homogeneous shortcut also orders tensor terms by the chain alone.
# Safe-mode coefficients have mixed degrees: multiplication/reduction and
# addition must restore the order of the complete chain-plus-word monomials.
p = root / 'src/anick/tenspol.sl'
s = p.read_text()
safe = "(AND (NOT GEORGELEGACYMODE) (EQ (GETLOWTERMSHANDLING) 'SAFE))"
old = "(EQ (GETNONCOMMORDER) 'TDEGLEFTLEX) (RETURN rt)"
assert s.count(old) == 1
s = s.replace(old, "(AND (EQ (GETNONCOMMORDER) 'TDEGLEFTLEX) (NOT " + safe + ")) (RETURN rt)")
old = "(COND ((EQ (GETNONCOMMORDER) 'TDEGLEFTLEX)\n"
assert s.count(old) == 1
s = s.replace(old, '(COND (' + safe + ' (GEORGETENSDPTmLESSP sdtm1 sdtm2))\n      ((EQ (GETNONCOMMORDER) \'TDEGLEFTLEX)\n')
old = """(DE anSORTSDTp (sdtp)
 (PROGN (COND ((NOT (OR (anSDP0!? sdtp) (anSDP0!? (anSDPTail sdtp))))
	       (anSORTSDTp (anSDPTail  sdtp))
	       (anRestoreTensorder sdtp)))
	sdtp ))"""
assert s.count(old) == 1
s = s.replace(old, "(DE anSORTSDTp (sdtp)\n (COND (" + safe + " (GEORGESORTSDP sdtp))\n       (T " + old.split('\n', 1)[1].strip()[:-1].rstrip() + ')))')
old = '(PROG (a b c p)\n'
assert s.count(old) == 1
s = s.replace(old, old + ' (COND (' + safe + ' (RETURN (GEORGEADDTENSPOLS sdp1 sdp2 cf))))\n')
helpers = (Path(__file__).parent / 'anick-tensor.sl').read_text()
s = s.replace('(OFF RAISE)', '(OFF RAISE)\n' + helpers + '\n(OFF RAISE)', 1)
p.write_text('% Modified by George on 2026-09-30: order and merge safe-mode Anick tensor terms by their complete words; keep original routines in legacy mode.\n' + s)
