%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%
%% George overlay for bergman 1.001
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
%%  2026-09-30  NCPBHGROEBNER and NCPBH write the Poincare-Betti
%%      series to their PB file.  Since 2004-04-24 bergman only
%%      writes it when IMMEDIATEASSOCRINGPBDISPLAY is on, which is
%%      off by default, so the PB file stayed empty (as it does in
%%      bergman's own 2007 test runs).  The series written is the
%%      one bergman computes; it equals the pre-2004 reference file
%%      tests/test_bergman/ncpbhg.pb.old.
%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%

(OFF RAISE)

(GLOBAL '(GEORGELEGACYMODE))
(SETQ GEORGELEGACYMODE NIL)

%# SETLEGACYMODE (bool) : bool ;  returns the previous setting
(DE SETLEGACYMODE (flag)
 (PROG (old)
       (SETQ old GEORGELEGACYMODE)
       (SETQ GEORGELEGACYMODE (COND (flag T) (T NIL)))
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
