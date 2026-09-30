%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%
%% Copyright (C) 1992,1993,1994,1996 Joergen Backelin
%%
%% Bergman is distributed in the hope that it will be useful,
%% but WITHOUT ANY WARRANTY.  No author or distributor
%% accepts responsibility to anyone for the consequences of using it
%% or for whether it serves any particular purpose or works at all,
%% unless he says so in writing.  Refer to the Bergman General Public
%% License for full details.

%% Everyone is granted permission to copy, modify and redistribute
%% bergman, but only under the conditions described in the
%% Bergman General Public License.   A copy of this license is
%% supposed to have been given to you along with bergman so you
%% can know your rights and responsibilities.  It should be in a
%% file named copyright.  Among other things, the copyright notice
%% and this notice must be preserved on all copies.
%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%


%  Changes:

% 1996-04-22: Call AlgFirstRedorTermPrint, AlgPureMonPrint,
% AlgPMonPrint instead of AlgFirstTermPrint/JoeB

(OFF RAISE)
% Debugging utilities for the DEVELOPMENT of the groebner programme.
% Should NOT be loaded in production versions!

(GLOBAL ((!*LastTimeInstance!* OtherTime ReductionTime AutoReductionTime
	  FindSPairsTime EliminateSPairsTime DocumentTime !*DEnTime
	  SHOWTIMEALWAYS !*KindsOfTime!*))

(COND ((NOT !*LastTimeInstance!*)
       (SETQ !*LastTimeInstance!* 0)))

(FLUID '(!*TRBR))

(LOAD ADDR2ID STEP)

% 93-06-15: Added time checking, for debugging and investigation use.
%	    Also added gbe show function. (Used in 'interrupted' version.)

(DE TimeIncr ()
 (PROG	(AA)
	(SETQ AA !*LastTimeInstance!*)
	(RETURN (DIFFERENCE (SETQ !*LastTimeInstance!* (TIME)) AA)) ))

(DE CountTime (id)
 (PROG	(AA)
	(SET id (PLUS2 (EVAL id) (SETQ AA (TimeIncr))))
	(COND (*SHOWTIMEALWAYS
	       (PRIN2 "** ")
	       (PRIN2 id)
	       (PRIN2 " ")
	       (PRINT AA)
	       (SETQ DocumentTime (PLUS2 DocumentTime (TimeIncr))))) ))

(DE ShowGbe (apol)
 (PROGN (PRIN2 "** Resulting gbe: ")
	(PRINT (COND (apol (CDDR (CADR apol)))
		     (T 0))) ))
(DE ShowPair (dpmon)
 (PROGN (TERPRI)
	(PRIN2 "** Am reducing from ")
	(PRINT (CDDAR dpmon))
	(PRIN2 "** and ")
	(PRINT (CDDDR dpmon)) ))

(DE ShowATime (id)
 (PROGN (PRIN2 "* ")
	(PRIN2 id)
	(PRIN2 " total = ")
	(PRINT (EVAL id)) ))
 
(DE EODShowTime ()
 (MAPC !*KindsOfTime!* (FUNCTION ShowATime)) )
% (PROGN (PRIN2 "* OtherTime total = ")
%	(PRINT OtherTime)
%	(PRIN2 "* ReductionTime total = ")
%	(PRINT ReductionTime)
%	(PRIN2 "* AutoReductionTime total = ")
%	(PRINT AutoReductionTime)
%	(PRIN2 "* FindSPairsTime total = ")
%	(PRINT FindSPairsTime)
%	(PRIN2 "* EliminateSPairsTime total = ")
%	(PRINT EliminateSPairsTime)
%	(PRIN2 "* DocumentTime total = ")
%	(PRINT DocumentTime)
%	(PRIN2 "* DEnTime total = ")
%	(PRINT  DEnTime) )

(DE TimingInit NIL
 (PROGN	(MAPC !*KindsOfTime!* (FUNCTION (LAMBDA (id) (SET id 0))))
	(TimeIncr) ))

(SETQ !*KindsOfTime!*
      '(OtherTime ReductionTime AutoReductionTime FindSPairsTime
	EliminateSPairsTime DocumentTime DEnTime))

(DF trp (rrg)
  (COND ((OR (NULL rrg) (NULL (PAIRP rrg))) NIL)
	((EQ (CAR rrg) 'augpol) (PRINTALGOUT augpol))
	((EQ (CAR rrg) 'pol) (PRINTALGOUT (CONS NIL pol)))
	((EQ (CAR rrg) 'cfmon) (AlgFirstRedorTermPrint cfmon))
	((EQ (CAR rrg) 'mon) (AlgPureMonPrint mon))
	((EQ (CAR rrg) 'mon1) (AlgPureMonPrint mon1))
	((EQ (CAR rrg) 'mon2) (AlgPureMonPrint mon2))
	((EQ (CAR rrg) 'expts) (AlgPMonPrint expts)) ))

(DF MYTRACE (ltoTR) (MAPCAR ltoTR 'MYTR1))

(DE MYTR1 (Fknn) (PROG (AA BB)
 (COND ((NOT (AND (IDP Fknn) (SETQ AA (GETD Fknn))))
	(RETURN (LIST 'NOT Fknn))))
 (SETQ BB (GENSYM))
 (PUTD BB (CAR AA) (CDR AA))
 (PUTD Fknn 'FEXPR (LIST 'LAMBDA '(LARGG)
   (LIST 'PROG '(XX)
	 (LIST 'PRINT (LIST 'QUOTE Fknn))
	 (LIST 'MAPC 'LARGG (LIST 'QUOTE 'PRINTX))
	 (NCONS 'IfTRBRbreak)
	 (LIST 'SETQ 'XX (LIST 'EVAL (LIST 'CONS (LIST 'QUOTE BB) 'LARGG)))
	 '(PRIN2 "Exits ") (LIST 'PRINT (LIST 'QUOTE Fknn))
	 (LIST 'PRINTX 'XX)
	 (NCONS 'IfTRBRbreak) '(RETURN XX))))
 (RETURN Fknn)))

(DE IfTRBRbreak () (COND (!*TRBR (CONTINUABLEERROR))))

(DE MONPAIRLISTOUT (ldpmon) (MAPC ldpmon 'MONPAIROUT))
(DE MONPAIROUT (dpmon) (PROG (mon) (SETQ mon (CAR dpmon))
			(AlgPureMonPrint mon)
			(PRIN2 " . ") (SETQ mon (CDR dpmon))
			(AlgPureMonPrint mon) (TERPRI) ))

(DE MP (rrr) (MONPAIRLISTOUT rrr))

(DF SMI (mnrg) (PRINTX (SET (CAR mnrg) (MONINTERN (CDR mnrg)))))

(DE PAIRPCDR (arg) (IF (PAIRP arg) (CDR arg) arg))
(DE MAPCDAR (rrr) (MAPCAR rrr 'PAIRPCDR))
(DE PRINTRECDEF (!*!*xx) (MAPCDAR (LGET (CDAR !*!*xx) 'RecDef)))

(DE DOUBLEPEEK (DPmon)
    (PRIN2 "DOUBLEPEEKing; monomial = ") (PRINTX (CDR DPmon))
    (PRINT 'PRINTRECDEF) (PRINTRECDEF DPmon)
    (PRINT 'PRINTINVRECDEF) (PRINTINVRECDEF DPmon)
    (CONTINUABLEERROR) )

(ON RAISE)
