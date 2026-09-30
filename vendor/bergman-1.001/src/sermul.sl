 %%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%
%% Copyright (C) 1995,1996,2002,2006 Joergen Backelin,
%% Svetlana Cojocaru, Victor Ufnarovski
%%
%% Bergman is distributed in the hope that it will be useful,
%% but WITHOUT ANY WARRANTY.  No author or distributor
%% accepts responsibility to anyone for the consequences of using it
%% or for whether it serves any particular purpose or works at all,
%% unless (s)he says so in writing.  Refer to the Bergman General
%% Public License for full details.

%% Everyone is granted permission to copy, modify and redistribute
%% bergman, but only under the conditions described in the
%% Bergman General Public License.   A copy of this license is
%% supposed to have been given to you along with bergman so you
%% can know your rights and responsibilities.  It should be in a
%% file named copyright.  Among other things, the copyright notice
%% and this notice must be preserved on all copies.
%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%

%  Macros specific for compilation of Hilbert and Poincare-Betti
% series procedures files.

%       CHANGES:

%  Removed direct access to MAXDEG./JoeB 2006-08-12

%  Removed some declarations of procedures as GLOBALs./JoeB 2002-10-14

%  (VU & SC declared MaxL GLOBAL, 2002-06-30.)


% Exports: NLength, serMaxLength, powChangeSign, RENEWSERIES,
%	   CALCMODHSERIES.

(OFF RAISE)



(GLOBAL '(SERMAXDEG EMBDIM HILBERTSERIES INVHILBERTSERIES
	  OUTINVERSE NMODGEN MaxL))

(FLUID '(OLDHILBERTSERIES))


%  Add pol2 to pol1, destroying both arguments. It is assumed that
% the least pol2 degree is not less than the least pol1 degree, and
% that (the coefficient at) the former doesn't cancel the latter.

%  CHECK: Could it be replaced by e.g. VECTPLUS? YES, or
% by VectPlus2; but these are non-destructive and presumably
% less efficient. HMMM ... I won't use this for a while.

%# serPolAdd0 (srpol, srpol) : - ; DESTRUCTIVE
(DE serPolAdd0 (pol1 pol2)
 (PROG  (np1 np2 np3)
        (COND ((EQ (serPol2FirstDeg (SETQ np1 pol1))
                   (serPol2FirstDeg (SETQ np2 pol2)))
               (serRplacCoeff (serFirstTerm np1)
                                  (PLUS2 (serPol2FirstCoeff np1)
                                         (serPol2FirstCoeff np2)))
               (COND ((serPol0!? (SETQ np2 (serPolTail np2)))
                      (RETURN NIL)))))
  Ml    (COND ((serPol0!? (serPolTail np1))
               (serPolRplacTail np1 np2))
              ((EQ (serPol2SecondDeg np1) (serPol2FirstDeg np2))
               (COND ((ZEROP (serCoeff
                                (serRplacCoeff
                                   (serSecondTerm np1)
                                   (PLUS2 (serPol2SecondCoeff np1)
                                          (serPol2FirstCoeff np2)))))
                      (serPolTermRemove np1))
                     (T
                      (SETQ np1 (serPolTail np1))))
               (COND ((SETQ np2 (serPolTail np2))
                      (GO Ml))))
              ((LESSP (serPol2SecondDeg np1) (serPol2FirstDeg np2))
               (SETQ np1 (serPolTail np1))
               (GO Ml))
              (T
               (SETQ np3 (serPolTail np2))
               (serPolRplacTail np2 (serPolTail np1))
               (SETQ np1 (serPolTail (serPolRplacTail np1 np2)))
               (COND ((serPol!? (SETQ np2 np3))
                      (GO Ml))))) ))


%  Multiply pol with term.

% PROG variables: Return; Polynomial position; Coefficient,
%                 Power of t, in term

%# serPolTimesTerm (srpol, srterm) : srterm ;
(DE serPolTimesTerm (pol term)
 (PROG  (rt np cf pw mdf)
        (SETQ pw (serDeg term))
        (SETQ cf (serCoeff term))
        (COND ((LESSP (SETQ mdf (DIFFERENCE SERMAXDEG pw)) (serPol2FirstDeg pol))
               (RETURN NIL)))
        (SETQ rt
              (TCONC NIL
                     (serCoeff!&Deg2Term (TIMES2 (serPol2FirstCoeff
                                                        pol)
                                                        cf)
                                         (PLUS2 (serPol2FirstDeg pol)
                                                    pw))))
        (COND ((OR (serPol0!? (SETQ np (serPolTail pol)))
                   (LESSP mdf (serPol2FirstDeg np)))
               (RETURN (CAR rt))))
  Ml    (TCONC rt (serCoeff!&Deg2Term (TIMES2 (serPol2FirstCoeff np)
                                                  cf)
                                          (PLUS2 (serPol2FirstDeg np) pw)))
        (COND ((AND (SETQ np (serPolTail np))
                    (NOT (LESSP mdf (serPol2FirstDeg np))))
               (GO Ml)))
        (RETURN (CAR rt)) ))


%  Multiply pol with pol. The (suspectedly) simpler polynomial
% argument should be given as pol1.

%#  serPolTimes2 (srpol, srpol) : srpol ;
(DE serPolTimes2 (pol1 pol2 )
 (PROG  (rt np)
        (SETQ rt (serPolTimesTerm pol2 (serFirstTerm pol1)))
        (SETQ np pol1)
  Ml    (COND ((AND (SETQ np (serPolTail np))
                    (OR (NOT (NUMBERP SERMAXDEG))
                        (NOT (LESSP SERMAXDEG (serPol2FirstDeg np)))))
               (serPolAdd0 rt (serPolTimesTerm pol2
                                                       (serFirstTerm np)))
               (GO Ml)))
        (RETURN rt) ))



(DE NLength (N)
    (COND ( (MINUSP N)   (ADD1 (NLength (MINUS N)))        )
          ( (LESSP N 10) 1                                 )
          ( T            (ADD1 (NLength (QUOTIENT N 10)))  )
    )
)

(DE MaxParaLength (Para )
    (SETQ MaxL (MAX2 MaxL (NLength (CDR Para))) )
)

(DE serMaxLength  (ser)
    (PROGN
     (SETQ MaxL 1)
     (MAPC ser 'MaxParaLength)
     MaxL
    )
)

(DE ChangeSign (para)
        (PROGN (CONS (CAR para) (MINUS (CDR para)))
        )
)

(DE powChangeSign (ser)
         (PROGN     (MAPCAR ser 'ChangeSign))
)


(DE RENEWSERIES ()
 (PROGN (SETQ DOUBLEPBSERIES (LIST (CONS 1 (CONS EMBDIM 1))
                                   (CONS 0 (CONS 1 0))))
        (SETQ INVHILBERTSERIES (LIST (CONS 1 (MINUS EMBDIM))
                                     (CONS 0 1)))
        (SETQ HILBERTSERIES (LIST (CONS 1 EMBDIM)
                                   (CONS 0 1)))
        (SETQ LastDeg 1)
  )
)

(DE   CALCMODHSERIES  (OLDHILBERTSERIES)
  (PROG (H2 H3 H4 H5 H6 )
    (CALCTOLIMIT (GETMAXDEG))
    (TDEGREEHSERIESOUT (GETMAXDEG))
    (SETQ H2 (REVERSE OLDHILBERTSERIES))
    (SETQ H3  (REVERSE HILBERTSERIES))
    (DoubleNewLine)
    (DoublePrint "Here is (1-H)^(-1) for Hilbert series H of the module")
    (DoubleNewLine)
    (SETQ SERMAXDEG (GETMAXDEG))
    (SETQ H4 (serPolTimes2 H2 H3) )
    (PrintSeries H4)
    (SETQ OUTINVERSE (LIST (CONS 0 1)))
    (INVERT-FPSERIES-STEP (GETMAXDEG) H4 'OUTINVERSE NIL)
    (SETQ H5 (powChangeSign OUTINVERSE))
    (DoublePrint "Here is the Hilbert series H of the module")
    (SETQ H6 (CDR (REVERSE H5)) )
    (PrintSeries H6)
  )
)


(ON RAISE)

