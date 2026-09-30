%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%
%% bergman-1.001-fix overlay for the original bergman 1.001
%% Copyright (C) 2026 the George contributors.
%%
%% This file changes the behaviour of bergman 1.001 (Copyright (C)
%% 1992-2006 Joergen Backelin).  It is distributed under the Bergman
%% General Public License (vendor/bergman-1.001/doc/copyright), and
%% like the rest of George also under GPL-2.0-or-later.
%%
%% Loaded after bergman when the image is built.  Every change is
%% listed here, dated, and can be switched off with legacy mode:
%%    (SETLEGACYMODE T)   preserve bergman 1.001 computation behavior
%%    (SETLEGACYMODE NIL) George's behaviour (the default)
%%    (GETLEGACYMODE)     current setting
%%
%% Changes:
%%  2026-09-30  Companion behavior-patches.py fixes itemwise degree limits,
%%      malformed MaybeReduceRedor calls, exhausted term traversal, and
%%      left * 1 * right multiplication in safe noncommutative mode.
%%  2026-09-30  Companion behavior-patches.py uses the full monomial order
%%      for safe degreewise noncommutative reductions. The original
%%      lexicographic shortcut can create a false zero reductor for the
%%      idempotent braid and make its Anick resolution stall in degree 4.
%%      The safe-mode Anick tensor routines also compare complete words and
%%      restore their order after multiplication and addition, preventing
%%      a later selection of an unprolongable constant coefficient term.
%%  2026-09-30  Companion behavior-patches.py repairs the itemwise cached
%%      reduction signature's degree-list construction and generation refresh.
%%      Singular's Lie quotients exposed the original malformed-list crash,
%%      missing inclusions and stale critical-pair quotients. Default mode
%%      schedules inclusions, preserves overlap occurrences after redirecting
%%      reductors, keeps converted reductands and flat redirected-pointer lists,
%%      and handles structural units and equal-word comparisons. Commutative
%%      comparison follows subsequent process changes in fixed mode. Legacy
%%      retains the original routines and their behavior.
%%  2026-09-30  NCPBHGROEBNER and NCPBH write the Poincare-Betti
%%      series to their PB file.  Since 2004-04-24 bergman only
%%      writes it when IMMEDIATEASSOCRINGPBDISPLAY is on, which is
%%      off by default, so the PB file stayed empty (as it does in
%%      bergman's own 2007 test runs).  The series written is the
%%      one bergman computes; it equals the pre-2004 reference file
%%      tests/test_bergman/ncpbhg.pb.old.
%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%

(OFF RAISE)

(GLOBAL '(GEORGELEGACYMODE BMVERSIONSTRING GEORGEORIGINALVERSION GEORGEORIGINALBMVERSION !*BMVersion!*))
(SETQ GEORGEORIGINALVERSION BMVERSIONSTRING)
(SETQ GEORGEORIGINALBMVERSION !*BMVersion!*)
(SETQ !*BMVersion!* "1.001-fix")
(SETQ BMVERSIONSTRING "bergman-1.001-fix")
(SETQ GEORGELEGACYMODE NIL)

%# SETLEGACYMODE (bool) : bool ;  returns the previous setting
(DE SETLEGACYMODE (flag)
 (PROG (old)
       (SETQ old GEORGELEGACYMODE)
       (SETQ GEORGELEGACYMODE (COND (flag T) (T NIL)))
       (SETQ BMVERSIONSTRING (COND (GEORGELEGACYMODE GEORGEORIGINALVERSION)
                                 (T "bergman-1.001-fix")))
       (SETQ !*BMVersion!* (COND (GEORGELEGACYMODE GEORGEORIGINALBMVERSION)
                                 (T "1.001-fix")))
       (RETURN old)))

%# GETLEGACYMODE () : bool ;
(DE GETLEGACYMODE () GEORGELEGACYMODE)

% Run fn on args with IMMEDIATEASSOCRINGPBDISPLAY on, restoring it after.
(DE GEORGEWITHPBDISPLAY (fn args)
 (PROG (old)
       (SETQ old (GETIMMEDIATEASSOCRINGPBDISPLAY))
       (SETIMMEDIATEASSOCRINGPBDISPLAY T)
       (RETURN (UNWIND-PROTECT (APPLY fn args)
                               (SETIMMEDIATEASSOCRINGPBDISPLAY old)))))

(COPYD 'GEORGEORIGNCPBHGROEBNER 'NCPBHGROEBNER)
(DE NCPBHGROEBNER (infile gbfile PBfile Hfile)
 (COND (GEORGELEGACYMODE (GEORGEORIGNCPBHGROEBNER infile gbfile PBfile Hfile))
       (T (GEORGEWITHPBDISPLAY 'GEORGEORIGNCPBHGROEBNER (LIST infile gbfile PBfile Hfile)))))

(COPYD 'GEORGEORIGNCPBH 'NCPBH)
(DE NCPBH (infile PBfile Hfile)
 (COND (GEORGELEGACYMODE (GEORGEORIGNCPBH infile PBfile Hfile))
       (T (GEORGEWITHPBDISPLAY 'GEORGEORIGNCPBH (LIST infile PBfile Hfile)))))

(FLAG '(SETLEGACYMODE GETLEGACYMODE NCPBHGROEBNER NCPBH) 'USER)

(ON RAISE)

% 2026-09-30: Explicit structural export for ordinary algebra Anick chains.
% Read the original access macros; no printed chain text is parsed here.
% This opt-in command leaves ANICKDISPLAY and historical output unchanged.
(LAPIN (MKBMPATHEXPAND "$bmsrc/macros.sl"))
(DSKIN (MKBMPATHEXPAND "$bmsrc/anick/anmacros.sl"))
(OFF RAISE)

% Noncommutative generator indices, in order; MONONE is the empty word.
(DE GEORGEWORD (mon)
 (COND ((Mon!= mon MONONE) NIL) (T (MONLISPOUT (PMon mon)))))

(DE GEORGECHAINWORD (chn)
 (PROG (vertices pc result)
  (COND ((anChn!= chn anUNITCHAIN) (RETURN NIL)))
  (SETQ pc chn)
  (SETQ vertices (NCONS (anChn2LastVx pc)))
  Loop (COND ((NOT (ZEROP (anChn2Length pc)))
              (SETQ pc (anChn2LowerChn pc))
              (SETQ vertices (CONS (anChn2LastVx pc) vertices))
              (GO Loop)))
  (MAPC vertices (FUNCTION (LAMBDA (mon)
    (SETQ result (APPEND result (GEORGEWORD mon))))))
  (RETURN result)))

% Names admitted by George's form and integer coefficients need no escaping.
% Coefficients are JSON strings, so JavaScript never rounds large integers.
(DE GEORGEJSONSTRING (value)
 (PROGN (PRIN2 (CODE-CHAR 34)) (PRIN2 value) (PRIN2 (CODE-CHAR 34))))

(DE GEORGEJSONWORD (indices)
 (PROG (first)
  (SETQ first T) (PRIN2 "[")
  (MAPC indices (FUNCTION (LAMBDA (index)
    (COND ((NOT first) (PRIN2 ",")))
    (SETQ first NIL) (PRIN2 index))))
  (PRIN2 "]")))

(DE GEORGEJSONDIFFERENTIAL (chn)
 (PROG (sdp qpol pol coefficient first)
  (COND ((NULL (anChn2Diff chn)) (ERROR 99 "Cannot export an uncalculated differential")))
  (PRIN2 "{") (GEORGEJSONSTRING "degree") (PRIN2 ":")
  (PRIN2 (anChn2Length chn))
  (PRIN2 ",") (GEORGEJSONSTRING "chain") (PRIN2 ":")
  (GEORGEJSONWORD (GEORGECHAINWORD chn))
  (PRIN2 ",") (GEORGEJSONSTRING "terms") (PRIN2 ":[")
  (SETQ first T)
  (SETQ sdp (CDR (anChn2Diff chn)))
  NextTarget (COND ((NULL sdp) (GO Done)))
  (SETQ qpol (anSDP2FirstQPol sdp))
  (SETQ pol (PPol qpol))
  NextTerm (COND ((NULL pol) (GO DoneTarget)))
  (SETQ coefficient (SHORTENRATCF
    (REDANDCFS2RATCF (TIMES2 (PolNum qpol) (Lc pol)) (PolDen qpol))))
  (COND ((NOT first) (PRIN2 ","))) (SETQ first NIL)
  (PRIN2 "{") (GEORGEJSONSTRING "target") (PRIN2 ":")
  (GEORGEJSONWORD (GEORGECHAINWORD (anSDP2FirstChn sdp)))
  (PRIN2 ",") (GEORGEJSONSTRING "coefficient") (PRIN2 ":[")
  (GEORGEJSONSTRING (RedandCoeff2OutCoeff (RATCF2NUMERATOR coefficient)))
  (PRIN2 ",")
  (GEORGEJSONSTRING (RedandCoeff2OutCoeff (RATCF2DENOMINATOR coefficient)))
  (PRIN2 "],") (GEORGEJSONSTRING "word") (PRIN2 ":")
  (GEORGEJSONWORD (GEORGEWORD (Lm pol))) (PRIN2 "}")
  (PolDecap pol) (GO NextTerm)
  DoneTarget (SETQ sdp (CDR sdp)) (GO NextTarget)
  Done (PRIN2 "]}") (TERPRI)))

(DE GEORGEWRITERESOLUTION (file)
 (PROG (channel old oldLL first)
  (COND ((CommP) (ERROR 99 "Structural Anick export requires a noncommutative algebra")))
  (SETQ channel (OPEN file 'OUTPUT))
  (SETQ old (WRS channel)) (SETQ oldLL (LINELENGTH 1000000))
  (UNWIND-PROTECT
   (PROGN
    (PRIN2 "{") (GEORGEJSONSTRING "format") (PRIN2 ":")
    (GEORGEJSONSTRING "george-resolution")
    (PRIN2 ",") (GEORGEJSONSTRING "version") (PRIN2 ":1,")
    (GEORGEJSONSTRING "modulus") (PRIN2 ":") (PRIN2 (OR (GETMODULUS) 0))
    (PRIN2 ",") (GEORGEJSONSTRING "generators") (PRIN2 ":[")
    (SETQ first T)
    (MAPC (GETINVARS) (FUNCTION (LAMBDA (name)
      (COND ((NOT first) (PRIN2 ",")))
      (SETQ first NIL) (GEORGEJSONSTRING name))))
    (PRIN2 "]}") (TERPRI)
    (MAPC anCHAINS (FUNCTION (LAMBDA (degree)
      (MAPC (CDR degree) (FUNCTION GEORGEJSONDIFFERENTIAL))))))
   (PROGN (WRS old) (LINELENGTH oldLL) (CLOSE channel)))))
(ON RAISE)

% 2026-09-30: Export the final basis for itemwise computations. The original
% SIMPLE degree-output file is empty in that mode. This explicit command does
% not change the historical procedures or their legacy output.
(OFF RAISE)
(DE GEORGEWRITEBASIS (file)
 (PROG (channel old mon)
  (COND ((AND GBasOutChan (OPEN-STREAM-P GBasOutChan)) (CLOSE GBasOutChan)))
  (SETQ channel (OPEN file 'OUTPUT))
  (SETQ old (WRS channel))
  (UNWIND-PROTECT
   (PROGN
    (MAPC (CDR GBasis)
      (FUNCTION (LAMBDA (mon)
        (PRIN2 "% ") (PRINT (TOTALDEGREE (PMon mon)))
        (PointerPrint mon) (TERPRI))))
    % With a bound, Bergman may omit higher overlaps. Certify completion
    % conservatively only when even the largest possible overlap fits.
    (COND ((AND (NOT (OR InPols SPairs))
                (OR (NOT MAXDEG)
                    (EVERY (FUNCTION (LAMBDA (mon)
                        (NOT (LESSP MAXDEG (TIMES 2 (TOTALDEGREE (PMon mon)))))))
                      (CDR GBasis))))
           (PRIN2 "Done") (TERPRI))))
   (PROGN (WRS old) (CLOSE channel)))))
(ON RAISE)
