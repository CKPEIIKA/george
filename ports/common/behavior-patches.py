#!/usr/bin/env python3
"""Dated fixes in build copies, retaining legacy algorithm branches."""
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
old = '(DE instableSPolPrepInsertOrProlong (mon itm)\n (PROG\t(osp)'
assert s.count(old) == 1
s = s.replace(old, old + "\n        (COND ((NOT GEORGELEGACYMODE) (REMMONPROP mon 'LRReduced)))")
s = '% Modified by George on 2026-09-30: enforce MAXDEG and invalidate stale critical-pair markers in default itemwise kernels.\n(GLOBAL \'(GEORGELEGACYMODE))\n' + s
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
s = s.replace(old, "(COND (GEORGELEGACYMODE " + old + ") (T (LPUT (Maplst (APol2Lm augredor)) 'GbFactors (CONS (CONS augmon gbf) (LGET (Mplst (APol2Lm augredor)) 'GbFactors))) (REMMONPROP (APol2Lm augredor) 'LRReduced) (RPLACD augSP SPairs) (MonInsert (APol2Lm augredor) augSP) (SETQ SPairs (CDR augSP)) (RPLACD augSP NIL)))")
old = "(GETAUGMONPROP 'GbFactors)"
assert s.count(old) == 1
s = s.replace(old, "(COND (GEORGELEGACYMODE " + old + ") (T (GETMONAUGPROP (APol2Lm augredor) 'GbFactors)))")
old = '(SubtractRedor1 augredor ap (Mpt augmon))'
assert s.count(old) == 1
s = s.replace(old, '(COND (GEORGELEGACYMODE ' + old + ') (T (SubtractRedor1 augredor ap (PPol (Mpt augmon)))))')
old = '(PROG\t(gbf)\n'
assert s.count(old) == 1
s = s.replace(old, old + '        (COND ((AND (NOT GEORGELEGACYMODE) (OR (NOT (PPol augredor)) (Mon!= (APol2Lm augredor) augmon))) (RETURN NIL)))\n')
for old, fixed in [
    ('(PreciseniMonQuotient (PMon mon1) (PMon mon2) 0)', '(GEORGECRITQUOTIENT mon1 mon2 (Mpt mon2) 0)'),
    ('(PreciseniMonQuotient (PMon mon1) (PMon mon3) placeno)', '(GEORGECRITQUOTIENT mon1 mon3 (Mpt mon3) placeno)')]:
    assert s.count(old) == 1
    s = s.replace(old, '(COND (GEORGELEGACYMODE ' + old + ') (T ' + fixed + '))')
old = '(DE FormSPol (mon1 mon2 mon3 placeno)'
assert s.count(old) == 1
s = s.replace(old, """% Preserve the original occurrence in an overlap, then account for a
% shorter current leading word inside the former factor word.
(DE GEORGECRITQUOTIENT (lcm oldmon redor pos)
 (COND ((NonCommP)
        (PreciseniMonQuotient (PMon lcm) (APol2Lpmon redor)
         (BMI!+ (OR pos 0) (MONFACTORP (APol2Lpmon redor) (PMon oldmon)))))
       (T (niMonQuotient (PMon lcm) (APol2Lpmon redor)))))

""" + old)
# Refresh a stale signature against the complete current basis. The original
# eight-loop cache traversal misreads degree blocks and can skip reductors.
# The generation marker still avoids any scan until the basis changes.
old = '(DE MaybeFindGroebF (mon)\n (PROG\t(ip1 ip2 pd td)'
assert s.count(old) == 1
s = s.replace(old, old + """
        (COND ((NOT GEORGELEGACYMODE)
               (SETQ ip1 (OR (FindGroebF (PMon mon))
                             (NewReductSignature (TOTALDEGREE (PMon mon)))))
               (PutMpt mon ip1)
               (RETURN ip1)))
""")
p.write_text('% Modified by George on 2026-09-30: correct reduction calls, schedule inclusions, preserve overlap occurrences after pointer redirection and refresh reduction signatures in default mode; retain original branches in legacy mode.\n' + s)

p = root / 'src/strategy.sl'
s = p.read_text()
old = '(RPLACD rp (CONS (CAAR ip) (CDDAR ip)))'
assert s.count(old) == 1
s = s.replace(old, '(COND (GEORGELEGACYMODE ' + old + ') (T (RPLACD rp (NCONS (CONS (CAAR ip) (CDDAR ip))))))')
# A new leading factor must create an inclusion task, including endpoint factors.
start = s.index('(DE instableitemFixNGbe ()')
end = s.index('%   AUXILIARIES FOR THE UNSTABLE FUNCTIONS.', start)
part = s[start:end]
old = '(SubtractRedor (Mpt (CAR Pek)) mon)'
assert part.count(old) == 1
part = part.replace(old, '(COND (GEORGELEGACYMODE ' + old + ') (T (instableMaybeReduceRedor (Mpt (CAR Pek)) mon)))')
s = s[:start] + part + s[end:]
old = '(SETQ CC (COND ((SelfPointingMon mon)'
assert s.count(old) == 1
s = s.replace(old, """(COND ((AND (NOT GEORGELEGACYMODE) (SelfPointingMon mon)
                    (SETQ CC (LGET (Mplst mon) 'GbFactors)))
           (SETQ AA (CAAR CC)) (SETQ BB (CADAR CC)) (GO It)))
        """ + old)
old = "(DE instablecommSPolInputs (mon)\n (COND\t((SelfPointingMon mon)"
assert s.count(old) == 1
s = s.replace(old, """% Component pruning assumes stable leading words. Redirected reductors do
% not preserve that assumption; process all saved commutative pairs instead.
(DE GEORGEINSTABLECOMMSPOLINPUTS (mon)
 (PROG (pairs factor lst)
  (SETQ pairs (bmstrRetrieveSPData mon))
  (COND ((SelfPointingMon mon)
         (SETQ lst (CDR GBasis))
         (GO Search))
        (T (GO Finish)))
  Search
  (COND ((NOT lst) (GO Finish))
        ((AND (NOT (Mon!= (CAR lst) mon)) (SelfPointingMon (CAR lst))
              (MONFACTORP (PMon (CAR lst)) (PMon mon)))
         (SETQ factor (CAR lst))
         (PutExtraNGroeb factor mon NIL)
         (REMMONPROP mon 'GbFactors)
         (GO Finish)))
  (SETQ lst (CDR lst)) (GO Search)
  Finish
  (COND (pairs (PutMpt mon (Mpt (CAAR pairs)))))
  (RETURN pairs)))

(DE instablecommSPolInputs (mon)
 (COND ((NOT GEORGELEGACYMODE) (GEORGEINSTABLECOMMSPOLINPUTS mon))
       ((SelfPointingMon mon)""")
old = "(SETQ ip (SETQ sp (GETMONAUGPROP mon 'SPairs)))"
assert s.count(old) == 1
s = s.replace(old, old + '\n        (COND ((AND (NOT GEORGELEGACYMODE) (NOT (CDR sp))) (RETURN NIL)))')
old = '(SETQ AA lmon2)'
assert s.count(old) == 1
s = s.replace(old, old + '\n        (COND ((AND (NOT GEORGELEGACYMODE) (NOT AA)) (RETURN NIL)))')
old = '(PutExtraNGroeb mon AA BB)'
assert s.count(old) == 1
s = s.replace(old, '(COND (GEORGELEGACYMODE ' + old + ') (T (PutExtraNGroeb AA mon BB)))')
old = '(SETQ rt (DestructRedor2Redand (CONS NIL (PPol (CAR op)))))'
assert s.count(old) == 1
s = s.replace(old, '(COND (GEORGELEGACYMODE ' + old + ') (T (SETQ rt (CONS NIL (PPol (CAR op)))) (DestructRedor2Redand (PPol rt))))')
old = "(LPUT!-LGET (Maplst mon1) 'ExtraPointers '(CONS op !_IBID))"
assert s.count(old) == 1
s = s.replace(old, "(COND (GEORGELEGACYMODE " + old + ") (T (LPUT (Maplst mon1) 'ExtraPointers (NCONC op (LGET (Mplst mon1) 'ExtraPointers)))))")
old = '(PreciseniMonQuotient (PMon mon2) (PMon mon1) placeno)'
assert s.count(old) == 1
s = s.replace(old, '(COND (GEORGELEGACYMODE ' + old + ') (T (GEORGECRITQUOTIENT mon2 mon1 (Mpt mon1) placeno)))')
old = '(PROG\t(rt op opp)\n'
assert s.count(old) == 1
s = s.replace(old, old + '        (COND ((AND (NOT GEORGELEGACYMODE) (OR (Mon!= mon1 mon2) (EQ (PPol (Mpt mon1)) (PPol (Mpt mon2))))) (RETURN NIL)))\n')
p.write_text('% Modified by George on 2026-09-30: preserve degree lists, process inclusions and empty pair data, and correct reductand conversion and redirected-pointer lists in default mode; retain original legacy branches.\n(GLOBAL \'(GEORGELEGACYMODE))\n' + s)

p = root / 'src/monom.sl'
s = p.read_text()
# TOTALDEGREE aliases PLUSNOEVAL. A one-generator commutative monomial
# has only one exponent, despite the original helper's two-item precondition.
# These boundary cases have the same mathematical meaning in legacy mode.
old = '(DE PLUSNOEVAL (lints)\n (PROG\t(AA BB)'
assert s.count(old) == 1
s = s.replace(old, old + '\n        (COND ((NOT lints) (RETURN 0))\n              ((NOT (CDR lints)) (RETURN (CAR lints))))')
for name in ['commstableMONLESSP', 'LexMONLESSP']:
    old = '(DE ' + name + ' (pmon1 pmon2)\n (PROG\t(AA BB)'
    assert s.count(old) == 1
    s = s.replace(old, old + '\n        (COND ((AND (NOT GEORGELEGACYMODE) (EQUAL pmon1 pmon2)) (RETURN NIL)))')
old = """(COND ((EQ (GETPROCESS) 'ITEMWISE) 'instableMONLESSP)
\t\t     (T 'stableMONLESSP))"""
assert s.count(old) == 1
# Capture the comparator that the original COMMIFY would choose. The new
# wrapper follows subsequent process changes, and legacy restores that copy.
s = s.replace(old, "'GEORGECOMMMONLESSP")
old = '(DE MonCommify ()\n (PROGN'
assert s.count(old) == 1
s = s.replace(old, """(DE GEORGECOMMMONLESSP (pmon1 pmon2)
 (COND (GEORGELEGACYMODE (GEORGELEGACYCOMMMONLESSP pmon1 pmon2))
       ((OR (EQ (GETPROCESS) 'ITEMWISE) (EQ (GETLOWTERMSHANDLING) 'SAFE))
        (instableMONLESSP pmon1 pmon2))
       (T (stableMONLESSP pmon1 pmon2))))

""" + old)
old = "(COPYD 'MONLESSP\n\t       'GEORGECOMMMONLESSP)"
assert s.count(old) == 1
s = s.replace(old, """(COPYD 'GEORGELEGACYCOMMMONLESSP
               (COND ((EQ (GETPROCESS) 'ITEMWISE) 'instableMONLESSP)
                     (T 'stableMONLESSP)))
        (COPYD 'MONLESSP 'GEORGECOMMMONLESSP)""")
p.write_text('% Modified by George on 2026-09-30: follow current commutative processing modes and terminate equal-word comparisons in default mode; preserve original routines in legacy mode.\n(GLOBAL \'(GEORGELEGACYMODE))\n' + s)

p = root / 'src/ncmonom.sl'
s = p.read_text()
# Sorting duplicate input words can call these strict comparators with
# equal arguments. Their prefix loops otherwise continue forever on NIL.
# Returning false on equality is required by every strict monomial order,
# including the legacy order; no unequal-word ordering is changed.
for signature, locals in [
    ('noncommElimLeftLexMONLESSP (pmon1 pmon2)', 'AA BB P1 P2 K I'),
    ('noncommInvElimLeftLexMONLESSP (pmon1 pmon2)', 'AA BB P1 P2 K I N'),
    ('noncommHomElimMONLESSP (pmon1 pmon2)', 'AA BB P1 P2 K I N'),
    ('noncommInvWElimLeftLexMONLESSP (pmon1 pmon2 )', 'lendiff tt'),
    ('orderednoncommInvWElimLeftLexMONLESSP (pmon1 pmon2 lendiff)', 'AA BB P1 P2 K I N WW l'),
]:
    old = '(DE ' + signature + '\n (PROG\t(' + locals + ')'
    assert s.count(old) == 1
    s = s.replace(old, old + '\n        (COND ((EQUAL pmon1 pmon2) (RETURN NIL)))')
# Equal weighted degrees can contain different word lengths. The elimination
# counters used to advance past the shorter word's terminal 0 and then loop
# on NIL forever. Hold each terminal in place until both scans have ended.
for name in ['noncommElimLeftLexMONLESSP', 'noncommInvElimLeftLexMONLESSP']:
    start = s.index('(DE ' + name + ' ')
    end = s.index('(DE ', start + 4)
    part = s[start:end]
    for var in ['P1', 'P2']:
        old = '(SETQ ' + var + ' (CDR ' + var + '))'
        assert part.count(old) == 1
        part = part.replace(old, '(COND ((NOT (EQ (CAR ' + var + ') 0)) ' + old + '))')
    s = s[:start] + part + s[end:]
old = '(DE safenoncommMonTimes (pmon dppmon)\n (COND\t'
assert s.count(old) == 1
s = s.replace(old, old + """((AND (NOT GEORGELEGACYMODE)
                    (NOT (CAR dppmon)) (NOT (CDR dppmon)))
           (noncommMonIntern1 pmon))
        ((AND (NOT GEORGELEGACYMODE) (NOT (CDR pmon)))
           (COND ((NOT (CAR dppmon)) (noncommMonIntern1 (CDR dppmon)))
                 ((NOT (CDR dppmon)) (noncommMonIntern1 (CAR dppmon)))
                 (T (noncommMONTIMES2 (CAR dppmon) (CDR dppmon)))))
        """)
old = '(DE noncommLexMONLESSP (pmon1 pmon2)\n (PROG\t(AA BB)'
assert s.count(old) == 1
s = s.replace(old, old + '\n        (COND ((AND (NOT GEORGELEGACYMODE) (EQUAL pmon1 pmon2)) (RETURN NIL)))')
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
p.write_text('% Modified by George on 2026-09-30: correctly multiply units with empty or nonempty context words and use the full term order for mixed degrees in safe noncommutative mode; preserve original branches in legacy mode.\n(GLOBAL \'(GEORGELEGACYMODE))\n' + s)

# A one-variable proper quotient has a polynomial Hilbert series. The
# commutative Hilbert helper counts exponent degrees, so rescale its finite
# numerator to the generator's weight before printing or reading coefficients.
p = root / 'src/hseries.sl'
s = p.read_text()
start = s.index('(DE commCALCRATHILBERTSERIES ()')
end = s.index('%  Return one Hilbert polynomial value', start)
part = s[start:end]
old = '(GO Ml))) ))'
assert part.count(old) == 1
part = part.replace(old, '''(GO Ml)))
        (COND ((AND (GETWEIGHTS) (EQ (GETVARNO) 1)
                    (ZEROP HILBERTDENOMINATOR))
               (SETQ tmpcff (CAR (GETWEIGHTS)))
               (SETQ denpos HILBERTNUMERATOR))
              (T (RETURN NIL)))
  Scale (COND (denpos
               (RPLACA (CAR denpos) (TIMES2 tmpcff (CAAR denpos)))
               (SETQ denpos (CDR denpos))
               (GO Scale))) ))''')
s = s[:start] + part + s[end:]
p.write_text('% Modified by George on 2026-10-01: preserve generator weights in one-variable finite commutative Hilbert series in both modes.\n' + s)

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
