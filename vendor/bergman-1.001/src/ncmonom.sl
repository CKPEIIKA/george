%  Internal monomial handling in the non-commmutative case.

%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%
%% Copyright (C) 1992,1994,1995,1996,1997,2002,2003,2004,2006
%% Joergen Backelin
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


%	CHANGES:

%  Corrected mxmaltweightsLCauto./JoeB 2007-08-18

%  Commented out length test in noncommInvElimLeftLexMONLESSP to work
% in non-graded case./ufn 2006-08-16

%  Introduced unstable MONLESSP modifications.  Added
% NCPUREMONLENGTH and NCAUGMONLENGTH./JoeB 2006-08-16

%  Introduced ALLMONQUOTIENTS, downgrading the MONFACTORP output
% to just SOME factor./JoeB 2006-08-15

%  Introduced VarIndex2Weight and MAXDEG modes. Modularised
% safeLC2./JoeB 2006-08-11

% Split noncommMONFACTORP and noncommMonTimes into quick/safe forms;
% and reformed the quick/safe mode setters./JoeB 2006-08-08

% Added weighted invelimorder and corresponding functions. /ufn 2005-06-26

%  LCauto fixed for constant input. Adding (low degree term handling)
% safe versions of MONINTERN), LC2, MONLISPOUT, MonAlgOutprep; and
% the mode changers noncomm(Quick/Safe)LowTms./JoeB 2004-10-10 -- 10-12.

%  HomogVarIndex --> !$!&HomogVarIndex!#./JoeB 2004-05-05

%  Replaced *NONCOMMUTATIVE by ((Non)CommP)./JoeB 2003-08-25

%  Replaced (LENGTH (GETINVARS)) by (InVarNo)./JoeB 2003-08-18

%  (VU & SC added numerous elimination order stuff, July 2002.)

%  Corrected altweightsTOTALDEGREE MONONE action./JoeB 2002-07-06

%  Introduced MonLeastSignifVar./JoeB 2001-08-10

%  Introduced IOWeights2Weights, Weights2IOWeights./JoeB 1999-11-17

%  Changed GETWEIGHTSDPLIST to GETWEIGHTDPS/JoeB 1997-09-18

%  Split noncommMonAlgOutprep in a collectexponents and a spread
% variant. Added mode changer auxiliaries NonCommCollectExps,
% NonCommNoExps, corresponding to the new mode./JoeB 1997-09-17

%  Corrected GETVARNO; added RestOfMon, MonSignifVar, and MONONE,
% and made MONTIMES2 take MONONE as an argument./JoeB 1996-06-24 -- 27

%  Added MONTIMES2./JoeB 1996-06-21

%  Changed niMonInit to MonomialInit./JoeB 1996-06-17

%  Added GETVARNO./JoeB 1996-04-25

%  Introduced alternative weights. Simultaneously, changed handling of
% LCauto, LC2 and EarlyMonFactorP by mode changers by removing their
% noncomm prefix./JoeB 1995-07-27


% Module for handling PureMONOMIALs in non-commutative monomials.
% The 'ncmonomial' module handles ALL routines where the PureMONOMIAL is
% not regarded as an atom, EXCEPT (possibly) for some 'reclaim' macro.

% Import: NOEXPTSPRINTMODE; !*OLDPRINTMODES1,
%	  GBasis, dpOutVars, GETWEIGHTDPS.
% Export: MONINTERN, MonIntern1, MonInsert, MONLESSP, ALLMONQUOTIENTS,
%	  MONFACTORP, MonFactorP1, LeftMonFactorP, ListMonFactorP,
%	  EarlyMonFactorP, MonTimes, MONTIMES2, niMonQuotient,
%	  niMonQuotient1, LCauto, LC2, TOTALDEGREE, MonomialInit, GETVARNO,
%	  RestOfMon, MonSignifVar, MONLISPOUT, MonAlgOutprep,
%	  NonCommCollectExps, NonCommNoExps, NonCommOrdWeights,
%	  NonCommAltWeights, IOWeights2Weights, Weights2IOWeights; MONONE.
% Available: LISTCOPY, NCAUGMONLENGTH, NCPUREMONLENGTH.

(OFF RAISE)

% Meanings of the globals: short form monomial structured list; non-interned
% monomials (2).

(GLOBAL '(MONLIST niMon niMon1 GBasis dpOutVars MAOaux MONONE !$!&HomogVarIndex!#
	  !*OLDPRINTMODES1))
(COND ((NOT MONLIST) (SETQ MONLIST (NCONS NIL))))
(COND ((NOT MAOaux) (SETQ MAOaux (NCONS NIL))))

% Monomials are to be internally represented as lists of indices of its
% variable factors, ordered stright. LAST of the PureMONOMIAL be 0.
% As in the commutative case, MONOMIAL := (POINTER . PureMONOMIAL).
% Each (coefficient free)  monomial is stored UNIQUELY, in order to
% save place and to facilitate reductions.
% A monomial with coefficient is stored as (coeff . monomial); the coefficient
% MUST be in Z\{0}; a polynomial is stored as a list of coeffmonomials, ordered
% lexicographically.

% MONLIST corresponds to OBLIST, and MONINTERN to INTERN. It is used
% for reading in and "interning"  lists of variables.
% It is organized as a tree, where the leaves are the MONOMIALS, and where
% the path from the root to a leaf is given by the PureMONOMIAL.
% lvar=list of variabless; Ml=main loop; Rl=readloop; MkNew=make a new one.

% noncommMONINTERN modifies lvar, adding a 0 at its end.

(DE noncommMONINTERN (lvar)
 (PROG	(AA BB CC)
	(SETQ AA lvar)
	(SETQ BB MONLIST)
  Ml	(SETQ CC (CAR AA))
  Rl	(COND ((OR (NOT (CDR BB)) (BMI!< CC (CAADR BB)))
	       (RPLACD BB (CONS (NCONS CC) (CDR BB))) (GO MkNew))
	      ((NOT (EQ CC (CAADR BB))) (SETQ BB (CDR BB)) (GO Rl))
	      ((NOT (CDR AA))
	       (COND ((NOT (AND (CDR (SETQ BB (CADR BB))) (EQ 0 (CAADR BB))))
		      (RPLACD AA (NCONS 0))
		      (RPLACD BB (CONS (CONS 0 (CONS (NCONS NIL) lvar))
				       (CDR BB)))))
	       (RETURN (CDADR BB))))
	 (SETQ AA (CDR AA))
	 (SETQ BB (CADR BB))
	 (GO Ml)

  MkNew	 (SETQ BB (CADR BB))
	 (COND ((CDR AA)
		(SETQ AA (CDR AA))
		(RPLACD BB (NCONS (NCONS (CAR AA))))
		(GO MkNew)))
	 (RPLACD AA (NCONS 0))
	 (RPLACD BB (NCONS (CONS 0 (CONS (NCONS NIL) lvar))))
	 (RETURN (CDADR BB)) ))

% noncommMonIntern1 does not modify pmon, which must end on 0.

(DE noncommMonIntern1 (pmon)
 (PROG	(AA BB CC)
	(SETQ AA pmon)
	(SETQ BB MONLIST)
  Ml	(SETQ CC (CAR AA))
  Rl	(COND ((OR (NOT (CDR BB)) (BMI!< CC (CAADR BB)))
	       (RPLACD BB (CONS (NCONS CC) (CDR BB))) (GO MkNew))
	      ((NOT (EQ CC (CAADR BB))) (SETQ BB (CDR BB)) (GO Rl))
	      ((SETQ AA (CDR AA)) (SETQ BB (CADR BB)) (GO Ml)))
	(RETURN (CDADR BB))
  MkNew	(SETQ BB (CADR BB))
	(COND ((SETQ AA (CDR AA))
	       (RPLACD BB (NCONS (NCONS (CAR AA))))
	       (GO MkNew)))
	(RPLACD BB (CONS (NCONS NIL) pmon))
	(RETURN (CDR BB)) ))

%% `Intern' expt, starting reading from eplace and starting interning at
%% the node mlnode of MONLIST.
%
%(DE MonIntern1 (lvar eplace mlnode) (PROG (AA BB CC)
% (SETQ AA eplace)
% (SETQ BB mlnode)
%Ml (SETQ CC (CAR AA))
%Rl (COND ((OR (NOT (CDR BB)) (BMI!< (CAADR BB) CC))
%	  (RPLACD BB (CONS (NCONS CC) (CDR BB))) (GO MkNew))
%	 ((NOT (EQ CC (CAADR BB))) (SETQ BB (CDR BB)) (GO Rl))
%	 ((SETQ AA (CDR AA)) (SETQ BB (CADR BB)) (GO Ml)))
% (RETURN (CDADR BB))
%MkNew (SETQ BB (CADR BB))
% (COND ((SETQ AA (CDR AA)) (RPLACD BB (NCONS (NCONS (CAR AA)))) (GO MkNew)))
% (RPLACD BB (CONS (NCONS NIL) lvar))
% (RETURN (CDR BB)) ))
%
%% Just go down a bit in MONLIST, as dictated by exptpart. (This should (?)
%% save some time in case lots of monomials with the same beginnings are to
%% be interned successively.)
%
%(DE PartMonIntern (exptpart) (PROG (AA BB CC)
% (SETQ AA exptpart)
% (SETQ BB MONLIST)
%Ml (SETQ CC (CAR AA))
%Rl (COND ((OR (NOT (CDR BB)) (BMI!< (CAADR BB) CC))
%	  (RPLACD BB (CONS (NCONS CC) (CDR BB))) (GO MkNew))
%	 ((NOT (EQ CC (CAADR BB))) (SETQ BB (CDR BB)) (GO Rl))
%	 ((SETQ AA (CDR AA)) (SETQ BB (CADR BB)) (GO Ml)))
% (RETURN (CADR BB))
%MkNew (SETQ BB (CADR BB))
% (COND ((SETQ AA (CDR AA)) (RPLACD BB (NCONS (NCONS (CAR AA)))) (GO MkNew)))
% (RETURN BB) ))


%  Arithmetic relations and operations of and on monomials:
% Comparing monomials in the eliminating ordering
% where only homogenizing variabel is eliminated.
% Otherwise, works as deglex
%  The arguments
% mustn't be equal!
(DE noncommHomElimMONLESSP (pmon1 pmon2)
 (PROG	(AA BB P1 P2 K I N)
	(SETQ AA pmon1)
	(SETQ BB pmon2)
 (COND ((LESSP (LENGTH AA) (LENGTH BB) ) (RETURN T))
       ((LESSP (LENGTH BB) (LENGTH AA) ) (RETURN NIL)))
  Ml	(COND ((EQ (CAR AA) (CAR BB))
	       (SETQ AA (CDR AA))
	       (SETQ BB (CDR BB))
	       (GO Ml)))
        (SETQ N !$!&HomogVarIndex!#)
        (SETQ K 0)
        (SETQ P1 AA)
        (SETQ P2 BB)
  M3
        (COND ((EQ (CAR P1) N) (SETQ K (ADD1 K))))
        (COND ((EQ (CAR P2) N) (SETQ K (SUB1 K))))
        (SETQ P1 (CDR P1))
        (SETQ P2 (CDR P2))
        (COND ((EQ (CAR P1) 0)
                    (COND ((EQ K 0) (RETURN (BMI!< (CAR AA) (CAR BB))))
                          ( T  (RETURN (LESSP  0 K)))))

               (T (GO M3)))
  ))

% Comparing monomials in the total eliminating ordering
% (uses the PSL fast inum comparer on each
% coefficient). The arguments should be of equal length, but they
% mustn't be equal!
(DE noncommInvElimLeftLexMONLESSP (pmon1 pmon2)
 (PROG	(AA BB P1 P2 K I N)
	(SETQ AA pmon1)
	(SETQ BB pmon2)
% (COND ((LESSP (LENGTH AA) (LENGTH BB) ) (RETURN T)) %commented to work
%       ((LESSP (LENGTH BB) (LENGTH AA) ) (RETURN NIL)))% in non-graded case
  Ml	(COND ((EQ (CAR AA) (CAR BB))
	       (SETQ AA (CDR AA))
	       (SETQ BB (CDR BB))
	       (GO Ml)))
        (SETQ N (InVarNo))
        (SETQ K 0)
        (SETQ I (ADD1 N))
  M2    (SETQ I (SUB1 I))
        (SETQ P1 AA)
        (SETQ P2 BB)
  M3
        (COND ((EQ (CAR P1) I) (SETQ K (ADD1 K))))
        (COND ((EQ (CAR P2) I) (SETQ K (SUB1 K))))
  M4    (SETQ P1 (CDR P1))
        (SETQ P2 (CDR P2))
        (COND ((EQ (CAR P1) (CAR P2))
                   (COND ((EQ (CAR P1) 0)
                              (COND ((EQ K 0)
                                       (COND ((LESSP 1 I ) (GO M2))
                                              ( T (RETURN (BMI!< (CAR AA) (CAR BB))))))
                                    ( T  (RETURN (LESSP  0 K)))))
                          (T (GO M4))))
               (T (GO M3)))
  ))


% Comparing monomials in the total eliminating ordering using weights
% (uses the PSL fast inum comparer on each
% coefficient). The arguments should not be of equal length,
% Use the next procedure.
(DE noncommInvWElimLeftLexMONLESSP (pmon1 pmon2 )
 (PROG	(lendiff tt)

	(SETQ lendiff (BMI- (LENGTH pmon2)(LENGTH pmon1) ))

	(SETQ tt
	      (COND ((LESSP lendiff 0)
		     (NOT (orderednoncommInvWElimLeftLexMONLESSP pmon2
								 pmon1
								 (MINUS lendiff))))
		       (T
			(orderednoncommInvWElimLeftLexMONLESSP pmon1
							       pmon2
							       lendiff))
   ))
%(PRIN2 pmon1)(PRIN2 pmon2)(PRIN2T tt)
	(RETURN tt)
 ))

% Comparing monomials in the total eliminating ordering using weights
% (uses the PSL fast inum comparer on each
% coefficient). The arguments should not be of equal length, but the
%  lenght1-length2 = lendiff should be positive.
(DE orderednoncommInvWElimLeftLexMONLESSP (pmon1 pmon2 lendiff)
 (PROG	(AA BB P1 P2 K I N WW l)
	(SETQ AA pmon1)
	(SETQ BB pmon2)

  Ml	(COND ((EQ (CAR AA) (CAR BB))
	       (SETQ AA (CDR AA))
	       (SETQ BB (CDR BB))
	       (GO Ml)))
	(SETQ N (InVarNo))
	(SETQ K 0)
	(SETQ I (ADD1 N))
  M2	(SETQ I (SUB1 I))
	(SETQ P1 AA)
	(SETQ P2 BB)
	(SETQ l 0)
  M3
	(COND ((EQ (CAR P1) I) (SETQ K (ADD1 K))))
	(COND ((EQ (CAR P2) I) (SETQ K (SUB1 K))))
  M4	(SETQ P1 (CDR P1))
	(SETQ P2 (CDR P2))

%If the second monom is longer we count it only
  M5
	(COND ((AND (EQ (CAR P1) 0) (LESSP l lendiff))
	       (SETQ l (ADD1 l))
	       (COND ((EQ (CAR P2) I) (SETQ K (SUB1 K))))
	       (SETQ P2 (CDR P2))
	       (GO M5)))
	(COND ((EQ (CAR P1) (CAR P2))

	       (COND ((EQ (CAR P1) 0)
		      (COND ((EQ K 0)
			     (COND ((LESSP 1 I ) (GO M2))
				   ( T (RETURN (BMI!< (CAR AA) (CAR BB))))))
			    ( T  (RETURN (LESSP  0 K)))))
		     (T (GO M4))))
	      (T (GO M3)))
  ))

% Additional ordering that is possible. Works like left Lex for comm.momnomials
% But as right deglex if they are equal commutatively. VU 02-07-01
(DE noncommElimLeftLexMONLESSP (pmon1 pmon2)
 (PROG	(AA BB P1 P2 K I)
	(SETQ AA pmon1)
	(SETQ BB pmon2)
% (COND ((LESSP (LENGTH AA) (LENGTH BB) ) (RETURN T))
%       ((LESSP (LENGTH BB) (LENGTH AA) ) (RETURN NIL)))
  Ml	(COND ((EQ (CAR AA) (CAR BB))
	       (SETQ AA (CDR AA))
	       (SETQ BB (CDR BB))
	       (GO Ml)))

        (SETQ K 0)
	(SETQ I 0)
  M2    (SETQ I (ADD1 I))
        (SETQ P1 AA)
	(SETQ P2 BB)
  M3
        (COND ((EQ (CAR P1) I) (SETQ K (ADD1 K))))
	(COND ((EQ (CAR P2) I) (SETQ K (SUB1 K))))
  M4	(SETQ P1 (CDR P1))
        (SETQ P2 (CDR P2))
	(COND ((EQ (CAR P1) (CAR P2))
	       (COND ((EQ (CAR P1) 0)
		      (COND ((EQ K 0)
			     (COND ((LESSP I (InVarNo)) (GO M2))
				   (T (RETURN (BMI!< (CAR AA) (CAR BB))))))
			    (T (RETURN (LESSP  K 0)))))
		     (T (GO M4))))
	      (T (GO M3)))

  ))

% Comparing monomials (using the PSL fast inum comparer on each
% coefficient). The arguments need not be of equal length, but they
% mustn't be equal!

(DE noncommLexMONLESSP (pmon1 pmon2)
 (PROG	(AA BB)
	(SETQ AA pmon1)
	(SETQ BB pmon2)
  Ml	(COND ((EQ (CAR AA) (CAR BB))
	       (SETQ AA (CDR AA))
	       (SETQ BB (CDR BB))
	       (GO Ml)))
	(RETURN (BMI!< (CAR AA) (CAR BB))) ))


% One non-commutative monomial may be the factor of another in several
% different ways, which complicates matters.  We may wish information of ALL
% the ways, or just of ANY of them.  Thus the truth-values of the next two
% procedures are equal, but the first one returns a more complete answer.

(DE noncommALLMONQUOTIENTS (pmon1 pmon2)
  (PROG (AA BB CC DD ee)
	(SETQ AA pmon2)
	(SETQ DD 0)
   Ml	(SETQ BB pmon1) (SETQ CC AA)
   Sl	(COND ((EQ (CAR BB) (CAR CC))
	       (COND ((NOT (CDR (SETQ BB (CDR BB))))
		      (SETQ ee (CONS DD ee)))
		     ((CDR (SETQ CC (CDR CC))) (GO Sl))
		     (T (RETURN ee)))))
	(COND ((NOT (CDR (SETQ AA (CDR AA)))) (RETURN ee)))
	(SETQ DD (ADD1 DD))
	(GO Ml) ))

(DE noncommMONFACTORP (pmon1 pmon2)
  (PROG (AA BB CC DD)
	(SETQ AA pmon2)
	(SETQ DD 0)
   Ml	(SETQ BB pmon1) (SETQ CC AA)
   Sl	(COND ((EQ (CAR BB) (CAR CC))
	       (COND ((CDR (SETQ BB (CDR BB)))
		      (COND ((CDR (SETQ CC (CDR CC))) (GO Sl))
			    ((RETURN NIL))))
		     (T (RETURN DD))))
	      ((CDR (SETQ AA (CDR AA))) (SETQ DD (ADD1 DD)) (GO Ml))) ))

(COPYD 'noncommMonFactorP1 'noncommMONFACTORP)

%% (DE noncommMonFactorP1 (pmon1 pmon2)
%%   (PROG (AA BB CC DD)
%% 	(SETQ AA pmon2)
%% 	(SETQ DD 0)
%%    Ml	(SETQ BB pmon1) (SETQ CC AA)
%%    Sl	(COND ((EQ (CAR BB) (CAR CC))
%% 	       (COND ((CDR (SETQ BB (CDR BB)))
%% 		      (COND ((CDR (SETQ CC (CDR CC))) (GO Sl))
%% 			    ((RETURN NIL))))
%% 		     (T (RETURN DD))))
%% 	      ((CDR (SETQ AA (CDR AA))) (SETQ DD (ADD1 DD)) (GO Ml))) ))

% For the PBseries: Check whether pmon1 is left factor of pmon2. If so,
% return (pmon1)^{-1}*pmon2. We MUST have  pmon1 <> pmon2 .

(DE noncommLeftMonFactorP (pmon1 pmon2)
  (PROG (AA BB)
  %   (PRIN2 "i noncommLeftMonFactor") (PRINT pmon1) (PRINT pmon2)(TERPRI)
	(SETQ AA pmon2)
	(SETQ BB pmon1)
   Ml	(COND ((EQ (CAR BB) (CAR AA))
	       (COND ((NOT (CDR (SETQ BB (CDR BB)))) (RETURN (CDR AA)))
		     ((CDR (SETQ AA (CDR AA))) (GO Ml))))) ))
	
% Like noncommMonFactorP1, but disregards left and right factors.
% We MUST have noncommTOTALDEGREE(pmon2) >= 3 .

(DE noncommInMonFactorP (pmon1 pmon2)
  (PROG (AA BB CC DD)
	(SETQ AA (CDR pmon2))
	(SETQ DD 1)
   Ml	(SETQ BB pmon1) (SETQ CC AA)
   Sl	(COND ((EQ (CAR BB) (CAR CC))
	       (COND ((CDR (SETQ BB (CDR BB)))
		      (COND ((CDDR (SETQ CC (CDR CC))) (GO Sl))
			    ((RETURN NIL))))
		     (T (RETURN DD))))
	      ((CDDR (SETQ AA (CDR AA))) (SETQ DD (ADD1 DD)) (GO Ml))) ))

% Tests if pmon1 is a factor of pmon2, beginning in any of the depth first
% positions. We should have length(pmon2) >= length(pmon1)+depth-1 .

(DE EarlyMonFactorP (pmon1 pmon2 depth)
 (PROG	(EX DP)	% remaining EXponent part,DePth.
	(SETQ EX pmon2)
	(SETQ DP depth)
  Ml	(COND ((noncommLeftMonFactorP pmon1 EX) (RETURN DP))
	      ((NOT (EQ (SETQ DP (SUB1 DP)) 0))
	       (SETQ EX (CDR EX))
	       (GO Ml))) ))

%  Returns the first augmon on lmon which is a proper in-factor of mon,
% if there is one; and NIL else.

%# ListMonFactorP (laugmon, puremon) : genaugmon ; RESET
(DE noncommListMonFactorP (lmon pmon)
 (PROG	(LM)
	(COND ((NOT (SETQ LM lmon)) (RETURN NIL)))
  Ml	(COND ((noncommInMonFactorP (CDAR LM) pmon)
	       (RETURN (CAR LM)))
	      ((SETQ LM (CDR LM))
	       (GO Ml))) ))


(DE noncommMonTimes (pmon dppmon)
 (COND	((NOT (CAR dppmon)) (noncommMonTimes2 pmon (CDR dppmon)))
	((NOT (CDR dppmon)) (noncommMonTimes2 (CAR dppmon) pmon))
	(T (noncommMonTimes3 (CAR dppmon) pmon (CDR dppmon)))) )

(DE noncommMonPartTimes (pmon1 place pmon2)
 (PROG	(AA BB CC)
	(SETQ AA (NCONS (CAR pmon1)))
	(SETQ BB AA)
	(SETQ CC pmon1)
  Ml	(COND ((NOT (EQ (SETQ CC (CDR CC)) place))
	       (RPLACD AA (NCONS (CAR CC)))
	       (SETQ AA (CDR AA))
	       (GO Ml)))
	(RPLACD AA pmon2)
	(RETURN (noncommMonIntern1 BB)) ))

(DE noncommMonTimes2 (pmon1 pmon2)
 (PROG	(AA BB CC)
	(SETQ AA (NCONS (CAR pmon1)))
	(SETQ BB AA)
	(SETQ CC pmon1)
  Ml	(COND ((CDR (SETQ CC (CDR CC)))
	       (RPLACD AA (NCONS (CAR CC)))
	       (SETQ AA (CDR AA))
	       (GO Ml)))
	(RPLACD AA pmon2)
	(RETURN (noncommMonIntern1 BB)) ))

(DE noncommMONTIMES2 (pmon1 pmon2)
  (COND	((EQ pmon1 (CDR MONONE)) (noncommMonIntern1 pmon2))
	(T (noncommMonTimes2 pmon1 pmon2))) )

(DE noncommMonTimes3 (pmon1 pmon2 pmon3)
 (PROG	(AA BB CC)
	(SETQ AA (NCONS (CAR pmon1)))
	(SETQ BB AA)
	(SETQ CC pmon1)
  Ml1	(COND ((CDR (SETQ CC (CDR CC)))
	       (RPLACD AA (NCONS (CAR CC)))
	       (SETQ AA (CDR AA))
	       (GO Ml1)))
	(RPLACD AA (NCONS (CAR pmon2)))
	(SETQ AA (CDR AA))
	(SETQ CC pmon2)
  Ml2	(COND ((CDR (SETQ CC (CDR CC)))
	       (RPLACD AA (NCONS (CAR CC)))
	       (SETQ AA (CDR AA))
	       (GO Ml2)))
	(RPLACD AA pmon3)
	(RETURN (noncommMonIntern1 BB)) ))


% In fact, MONOMIAL quotients will not need to be interned; and furtermore
% they may be of 'bad' degrees. The following are non-interned versions,
% with output of a special type (a structure with the right and left lists
% of indices quotients), used by the non-commutative monomial
% multiplications.

(DE noncommniMonQuotient (pmon1 pmon2)
 (noncommniMonQuotient1 pmon1 pmon2 (noncommMonFactorP1 pmon2 pmon1)) )

(DE noncommniMonQuotient1 (pmon1 pmon2 placeno)
 (PROG	(AA BB CC DD)
	(SETQ AA pmon1)
	(COND ((EQ (SETQ DD placeno) 0)
	       (SETQ BB pmon2)
	       (GO Ml2)))
	(SETQ CC (NCONS (CAR AA)))
	(SETQ BB CC)
  Ml1	(COND ((NOT (EQ (SETQ DD (SUB1 DD)) 0))
	       (RPLACD BB (NCONS (CAR (SETQ AA (CDR AA)))))
	       (SETQ BB (CDR BB))
	       (GO Ml1)))
	(RPLACD BB (NCONS 0))
	(SETQ AA (CDR AA))
	(SETQ BB pmon2)
  Ml2	(SETQ AA (CDR AA))
	(COND ((CDR (SETQ BB (CDR BB))) (GO Ml2))
	      ((NOT (CDR AA)) (SETQ AA NIL)))
	(RETURN (CONS CC AA)) ))


(COPYD 'noncommPreciseniMonQuotient 'noncommniMonQuotient1)



% The "Lowest Common multiples" functions return lists
% of pairs (integer . MONOMIAL), where each MONOMIAL has pmon1 as a left
% and pmon2 as a right factor, and where the integer is the length of
% MONOMIAL/pmon2. MONOMIALs with a shorter MONOMIAL as a strict right or
% left factor are redundant and may be omitted.

%# LCauto (puremon, degree) : l(degree.puremon) ; RESET
(DE LCauto (pmon deg)
 (PROG (AA BB CC DD ee FF)
	(COND ((NOT (AND (SETQ AA (CDR pmon))
			 (CDR AA)))
	       (RETURN NIL)))
	(SETQ DD 1)
  Ml	(COND ((NOT (CDR AA))
	       (RETURN ee))
	      ((AND FF (EQ (REMAINDER DD FF) 0))
	       (SETQ AA (CDR AA))
	       (SETQ DD (ADD1 DD))
	       (GO Ml)))
	(SETQ BB pmon)
	(SETQ CC AA)
  Sl	(COND ((EQ (CAR BB) (CAR CC))
	       (COND ((CDR (SETQ CC (CDR CC))) (SETQ BB (CDR BB)) (GO Sl))
		     (T
		      (COND ((NOT FF) (SETQ FF DD)))
		      (SETQ ee (CONS
				(CONS DD (noncommMonPartTimes pmon AA pmon))
				ee))))))
	(SETQ AA (CDR AA))
	(SETQ DD (ADD1 DD))
	(GO Ml) ))

(DE mxmordweightsLCauto (pmon deg)
 (PROG (AA BB CC DD ee FF mx)
	(COND ((NOT (AND (SETQ AA (CDR pmon))
			 (CDR AA)
			 (BMI!< deg (GETMAXDEG))))
	       (RETURN NIL)))
	(SETQ mx (MIN deg (ADD1 (BMI!- (GETMAXDEG) deg))))
	(SETQ DD 1)
  Ml	(COND ((EQ DD mx) (RETURN ee))
	      ((AND FF (EQ (REMAINDER DD FF) 0))
	       (SETQ AA (CDR AA))
	       (SETQ DD (ADD1 DD))
	       (GO Ml)))
	(SETQ BB pmon)
	(SETQ CC AA)
  Sl	(COND ((EQ (CAR BB) (CAR CC))
	       (COND ((CDR (SETQ CC (CDR CC))) (SETQ BB (CDR BB)) (GO Sl))
		     (T
		      (COND ((NOT FF) (SETQ FF DD)))
		      (SETQ ee (CONS
				(CONS DD (noncommMonPartTimes pmon AA pmon))
				ee))))))
	(SETQ AA (CDR AA))
	(SETQ DD (ADD1 DD))
	(GO Ml) ))

%# LC2 (puremon, puremon, any, any) : any ; RESET
(DE LC2 (pmon1 pmon2 periods1 periods2)
 (PROG	(AA BB CC DD ee FF GG)
	(SETQ AA (CDR pmon1))
	(SETQ DD 1)
  Ml	(SETQ BB pmon2)
	(SETQ CC AA)
  Sl	(COND ((EQ (CAR BB) (CAR CC))
	       (COND ((CDR (SETQ CC (CDR CC))) (SETQ BB (CDR BB)) (GO Sl))))
	      (T (GO Mlend)))
	% The next 7 lines VERY SUSPICIOUS.
	(SETQ FF ee)
  Dl	(COND (FF
	       (COND ((OR (ATSOC (SETQ GG (BMI!- DD (CAAR FF))) periods1)
			  (ATSOC GG periods2))
		      (GO Mlend)))
	       (SETQ FF (CDR FF))
	       (GO Dl)))
	(SETQ ee (CONS (CONS DD (noncommMonPartTimes pmon1 AA pmon2)) ee))
  Mlend	(COND ((CDR (SETQ AA (CDR AA))) (SETQ DD (ADD1 DD)) (GO Ml)))
	(RETURN ee) ))

(DE mxmordweightsLC2 (pmon1 pmon2 periods1 periods2)
 (PROG	(AA BB CC DD ee FF GG mx)
	(COND ((NOT (BMI!< (SETQ mx (ADD1 (BMI!- (GETMAXDEG)
						 (TOTALDEGREE pmon2))))
			   (TOTALDEGREE pmon1)))
	       (RETURN (nomxmLC2 pmon1 pmon2 periods1 periods2))))
	(SETQ AA (CDR pmon1))
	(SETQ DD 1)
  Ml	(COND ((BMI!= DD mx)
	       (RETURN ee)))
	(SETQ BB pmon2)
	(SETQ CC AA)
  Sl	(COND ((EQ (CAR BB) (CAR CC))
	       (COND ((CDR (SETQ CC (CDR CC))) (SETQ BB (CDR BB)) (GO Sl))))
	      (T (GO Mlend)))
	% The next 7 lines VERY SUSPICIOUS.
	(SETQ FF ee)
  Dl	(COND (FF
	       (COND ((OR (ATSOC (SETQ GG (BMI!- DD (CAAR FF))) periods1)
			  (ATSOC GG periods2))
		      (GO Mlend)))
	       (SETQ FF (CDR FF))
	       (GO Dl)))
	(SETQ ee (CONS (CONS DD (noncommMonPartTimes pmon1 AA pmon2)) ee))
  Mlend	(SETQ AA (CDR AA))
	(SETQ DD (ADD1 DD))
	(GO Ml) ))

%# NCPUREMONLENGTH (puremon) : int ;
(DE NCPUREMONLENGTH (pmon) (LENGTH (CDR pmon)))

%# NCAUGMONLENGTH (augmon) : int ;
(DE NCAUGMONLENGTH (amon) (LENGTH (CDDR amon)))

(COPYD 'noncommTOTALDEGREE 'NCPUREMONLENGTH)

(DE noncommMonomialInit ()
 (PROGN	(SETQ MONONE (noncommMonIntern1 (LIST 0)))
 ))

(DE noncommGETVARNO () (PROGN EMBDIM))

(DE noncommMonLeastSignifVar (augmon)
 (PROG	(rt)
	(SETQ rt (PMon augmon))
  Ml	(COND ((BMI!= (CADR rt) 0)
	       (RETURN (CAR rt))))
	(SETQ rt (CDR rt))
	(GO Ml) ))

(DE noncommRestOfMon (augmon) (noncommMonIntern1 (CDDR augmon)))

(DE noncommMONLISPOUT (pmon)
 (PROG	(AA BB CC)
	(SETQ CC (SETQ AA (NCONS (CAR (SETQ BB pmon)))))
  Ml	(COND ((CDR (SETQ BB (CDR BB)))
	       (RPLACD CC (NCONS (CAR BB)))
	       (SETQ CC (CDR CC))
	       (GO Ml)))
	(RETURN AA) ))

% The spread variant below is not quite efficient, since spurious
% units ared CONSed just to fool Alg(First)TermPrint, which expects
% a list of (variable . exponent) pairs. An `exponent free' variant
% ought to be defined.


(DE noncommspreadMonAlgOutprep (pmon)
 (PROG	(aa)
	(RPLACD MAOaux (MONLISPOUT pmon))
	(SETQ aa (CDR MAOaux))
  Ml	(RPLACA aa (CONS (CDR (ATSOC (CAR aa) dpOutVars)) 1))
	(COND ((SETQ aa (CDR aa))
	       (GO Ml)))
	(RETURN (CDR MAOaux)) ))


% A collecting exponents variant:

(DE noncommcollexpMonAlgOutprep (pmon)
 (PROG	(aa vn)		% monomial position; variable number
	(RPLACD MAOaux (MONLISPOUT pmon))
	(SETQ aa (CDR MAOaux))
  Ml	(RPLACA aa (CONS (CDR (ATSOC (SETQ vn (CAR aa)) dpOutVars)) 1))
  Sl	(COND ((CDR aa)
	       (COND ((BMI!= (CADR aa) vn)
		      (RPLACD (CAR aa) (ADD1 (CDAR aa)))
		      (RPLACD aa (CDDR aa))
		      (GO Sl))
		     (T
		      (SETQ aa (CDR aa))
		      (GO Ml)))))
	(RETURN (CDR MAOaux)) ))


%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%
% Alternative Weight Handling.

(DE altweightsEarlyMonFactorP (pmon1 pmon2 depth)
 (PROG	(EX DP)
	(SETQ EX pmon2)
	(COND ((LESSP (SETQ DP (BMI!- (LENGTH pmon2) (LENGTH pmon1))) 2)
	       (RETURN NIL)))
  Ml	(COND ((noncommLeftMonFactorP pmon1 EX) (RETURN DP))
	      ((NOT (EQ (SETQ DP (SUB1 DP)) 1))
	       (SETQ EX (CDR EX))
	       (GO Ml))) ))

(DE mxmaltweightsLCauto (pmon deg)
 (PROG (AA BB CC DD di ee FF mx gw) % ... Degree Increment,... MaXimal di
	(COND ((NOT (BMI!< (SETQ mx (BMI!- (GETMAXDEG) deg)) deg))
	       (RETURN (nomxmLCauto pmon deg)))
	      ((NOT (AND (SETQ AA (CDR pmon))
			 (CDR AA)
			 (BMI!< deg (GETMAXDEG))))
	       (RETURN NIL)))
	(SETQ DD 1)
	(SETQ di (VarIndex2Weight (CAR pmon)))
  Ml	(COND ((BMI!> di mx)
	       (RETURN ee))
	      ((AND FF (EQ (REMAINDER DD FF) 0))
	       (SETQ di (BMI!+ di (VarIndex2Weight (CAR AA))))
	       (SETQ AA (CDR AA))
	       (SETQ DD (ADD1 DD))
	       (GO Ml)))
	(SETQ BB pmon)
	(SETQ CC AA)
  Sl	(COND ((EQ (CAR BB) (CAR CC))
	       (COND ((CDR (SETQ CC (CDR CC))) (SETQ BB (CDR BB)) (GO Sl))
		     (T
		      (COND ((NOT FF) (SETQ FF DD)))
		      (SETQ ee (CONS
				(CONS DD (noncommMonPartTimes pmon AA pmon))
				ee))))))
	(SETQ di (BMI!+ di (VarIndex2Weight (CAR AA))))
	(SETQ AA (CDR AA))
	(SETQ DD (ADD1 DD))
	(GO Ml) ))

(DE mxmaltweightsLC2 (pmon1 pmon2 periods1 periods2)
 (PROG	(AA BB CC DD ee FF GG mx di)
	(COND ((NOT (BMI!< (SETQ mx (BMI!- (GETMAXDEG) (TOTALDEGREE pmon2)))
			   (TOTALDEGREE pmon1)))
	       (RETURN (nomxmLC2 pmon1 pmon2 periods1 periods2))))
	(SETQ DD 1)
	(SETQ AA (CDR pmon1))
	(SETQ di (VarIndex2Weight (CAR pmon1)))
  Ml	(COND ((BMI!> di mx)
	       (RETURN ee)))
	(SETQ BB pmon2)
	(SETQ CC AA)
  Sl	(COND ((EQ (CAR BB) (CAR CC))
	       (COND ((CDR (SETQ CC (CDR CC))) (SETQ BB (CDR BB)) (GO Sl))))
	      (T (GO Mlend)))
	(SETQ FF ee)
  Dl	(COND (FF
	       (COND ((OR (ATSOC (SETQ GG (BMI!- DD (CAAR FF))) periods1)
			  (ATSOC GG periods2))
		      (GO Mlend)))
	       (SETQ FF (CDR FF))
	       (GO Dl)))
	(SETQ ee (CONS (CONS DD (noncommMonPartTimes pmon1 AA pmon2)) ee))
  Mlend	(SETQ di (BMI!+ di (VarIndex2Weight (CAR AA))))
	(SETQ AA (CDR AA))
	(SETQ DD (ADD1 DD))
	(GO Ml) ))

(DE altweightsnoncommTOTALDEGREE (pmon)
 (PROG	(aa rt)
	(SETQ aa pmon)
	(SETQ rt 0)
  Ml	(COND ((CDR aa)
	       (SETQ rt (BMI!+ rt (VarIndex2Weight (CAR aa))))
	       (SETQ aa (CDR aa))
	       (GO Ml)))
	(RETURN rt) ))


%  2004-10-12: "Quick" (sometimes not working) contra "safe" (but slow)
% handling of situations, where constants may not or may be expected.

%  "Safe" forms:

(DE safenoncommMONINTERN (lvar)
 (PROG	(AA BB CC)
	(COND ((NULL (SETQ AA lvar))
	       (RETURN (MonIntern1 (NCONS 0)))))
	(SETQ BB MONLIST)
  Ml	(SETQ CC (CAR AA))
  Rl	(COND ((OR (NOT (CDR BB)) (BMI!< CC (CAADR BB)))
	       (RPLACD BB (CONS (NCONS CC) (CDR BB))) (GO MkNew))
	      ((NOT (EQ CC (CAADR BB))) (SETQ BB (CDR BB)) (GO Rl))
	      ((NOT (CDR AA))
	       (COND ((NOT (AND (CDR (SETQ BB (CADR BB))) (EQ 0 (CAADR BB))))
		      (RPLACD AA (NCONS 0))
		      (RPLACD BB (CONS (CONS 0 (CONS (NCONS NIL) lvar))
				       (CDR BB)))))
	       (RETURN (CDADR BB))))
	 (SETQ AA (CDR AA))
	 (SETQ BB (CADR BB))
	 (GO Ml)

  MkNew	 (SETQ BB (CADR BB))
	 (COND ((CDR AA)
		(SETQ AA (CDR AA))
		(RPLACD BB (NCONS (NCONS (CAR AA))))
		(GO MkNew)))
	 (RPLACD AA (NCONS 0))
	 (RPLACD BB (NCONS (CONS 0 (CONS (NCONS NIL) lvar))))
	 (RETURN (CDADR BB)) ))

%  If pmon1 represents 1, return immediately.

(DE safenoncommMONFACTORP (pmon1 pmon2)
  (PROG (AA BB CC DD)
	(COND ((NOT (CDR pmon1))
	       (RETURN 0)))
	(SETQ AA pmon2)
	(SETQ DD 0)
   Ml	(SETQ BB pmon1) (SETQ CC AA)
   Sl	(COND ((EQ (CAR BB) (CAR CC))
	       (COND ((CDR (SETQ BB (CDR BB)))
		      (COND ((CDR (SETQ CC (CDR CC))) (GO Sl))
			    ((RETURN NIL))))
		     (T (RETURN DD))))
	      ((CDR (SETQ AA (CDR AA))) (SETQ DD (ADD1 DD)) (GO Ml))) ))

(DE safenoncommALLMONQUOTIENTS (pmon1 pmon2)
  (PROG (AA BB CC DD ee)
	(COND ((NOT (CDR pmon1))
	       (RETURN 0)))
	(SETQ AA pmon2)
	(SETQ DD 0)
   Ml	(SETQ BB pmon1) (SETQ CC AA)
   Sl	(COND ((EQ (CAR BB) (CAR CC))
	       (COND ((NOT (CDR (SETQ BB (CDR BB))))
		      (SETQ ee (CONS DD ee)))
		     ((CDR (SETQ CC (CDR CC))) (GO Sl))
		     (T (RETURN ee)))))
	(COND ((NOT (CDR (SETQ AA (CDR AA)))) (RETURN ee)))
	(SETQ DD (ADD1 DD))
	(GO Ml) ))

(DE safenoncommMonTimes (pmon dppmon)
 (COND	((NOT (CAR dppmon)) (noncommMONTIMES2 pmon (CDR dppmon)))
	((NOT (CDR dppmon)) (noncommMonTimes2 (CAR dppmon) pmon))
	(T (noncommMonTimes3 (CAR dppmon) pmon (CDR dppmon)))) )


%  Since either of pmon1 and pmon2 must not divide the other,
% no critical pairs may exist, if either one of the monomials
% has length < 2.

%  2006-08-11: I have to modularise this LC2 variant now. I do not want
% 8 (eight) versions of LC2 around.../JoeB

(DE safeLC2 (pmon1 pmon2 periods1 periods2)
 (COND ((AND (CDR pmon1) (CDDR pmon1) (CDR pmon2) (CDDR pmon2))
	(quickLC2 pmon1 pmon2 periods1 periods2))) )

(DE safenoncommMONLISPOUT (pmon)
 (PROG	(AA BB CC)
	(SETQ CC (SETQ AA (NCONS (CAR (SETQ BB pmon)))))
	(COND ((NULL (CDR BB)) (RETURN NIL)))
  Ml	(COND ((CDR (SETQ BB (CDR BB))) (RPLACD CC (NCONS (CAR BB))) (SETQ CC (CDR CC))
	       (GO Ml)))
	(RETURN AA) ))

(DE safenoncommspreadMonAlgOutprep (pmon)
 (PROG	(aa)
	(RPLACD MAOaux (MONLISPOUT pmon))
	(COND ((NULL (SETQ aa (CDR MAOaux)))
	       (RETURN NIL)))
  Ml	(RPLACA aa (CONS (CDR (ATSOC (CAR aa) dpOutVars)) 1))
	(COND ((SETQ aa (CDR aa))
	       (GO Ml)))
	(RETURN (CDR MAOaux)) ))

(DE safenoncommcollexpMonAlgOutprep (pmon)
 (PROG	(aa vn)		% monomial position; variable number
	(RPLACD MAOaux (MONLISPOUT pmon))
	(COND ((NULL (SETQ aa (CDR MAOaux)))
	       (RETURN NIL)))
  Ml	(RPLACA aa (CONS (CDR (ATSOC (SETQ vn (CAR aa)) dpOutVars)) 1))
  Sl	(COND ((CDR aa)
	       (COND ((BMI!= (CADR aa) vn)
		      (RPLACD (CAR aa) (ADD1 (CDAR aa)))
		      (RPLACD aa (CDDR aa))
		      (GO Sl))
		     (T
		      (SETQ aa (CDR aa))
		      (GO Ml)))))
	(RETURN (CDR MAOaux)) ))


%	Mode changers:

(DE NonCommOrdWeights ()
 (PROGN (COPYD 'EarlyMonFactorP 'ordweightsEarlyMonFactorP)
	(COPYD 'mxmLCauto 'mxmordweightsLCauto)
	(COPYD 'mxmLC2 'mxmordweightsLC2)
	(COND ((GETMAXDEG)
	       (COPYD 'LCauto 'mxmLCauto)
	       (COPYD 'quickLC2 'mxmLC2)
	       (COND ((EQ (GETLOWTERMSHANDLING) 'QUICK)
		      (COPYD 'LC2 'quickLC2)))))
	(COPYD 'noncommTOTALDEGREE 'ordweightsnoncommTOTALDEGREE)
	(COND ((NonCommP)
	       (COPYD 'TOTALDEGREE 'ordweightsnoncommTOTALDEGREE))) ))

(DE NonCommAltWeights ()
 (PROGN (COPYD 'EarlyMonFactorP 'altweightsEarlyMonFactorP)
	(COPYD 'mxmLCauto 'mxmaltweightsLCauto)
	(COPYD 'mxmLC2 'mxmaltweightsLC2)
	(COND ((GETMAXDEG)
	       (COPYD 'LCauto 'mxmLCauto)
	       (COPYD 'quickLC2 'mxmLC2)
	       (COND ((EQ (GETLOWTERMSHANDLING) 'QUICK)
		      (COPYD 'LC2 'quickLC2)))))
	(COPYD 'noncommTOTALDEGREE 'altweightsnoncommTOTALDEGREE)
	(COND ((NonCommP)
	       (COPYD 'TOTALDEGREE 'altweightsnoncommTOTALDEGREE))) ))

(DE NonCommCollectExpts ()
 (PROGN	(COPYD 'noncommMonAlgOutprep 'noncommcollexpMonAlgOutprep)
	(COND ((NonCommP)
	       (COPYD 'MonAlgOutprep 'noncommcollexpMonAlgOutprep))) ))

(DE NonCommPrintNoExpts ()
 (PROGN	(COPYD 'noncommMonAlgOutprep 'noncommspreadMonAlgOutprep)
	(COND ((NonCommP)
	       (COPYD 'MonAlgOutprep 'noncommspreadMonAlgOutprep))) ))

(DE noncommSafeLowTms ()
 (PROG	(!*USERMODE !*REDEFMSG)
	(COPYD 'noncommMONINTERN 'safenoncommMONINTERN)
	(COPYD 'noncommMONFACTORP 'safenoncommMONFACTORP)
	(COPYD 'noncommALLMONQUOTIENTS 'safenoncommALLMONQUOTIENTS)
	(COPYD 'noncommMonTimes 'safenoncommMonTimes)
	(COPYD 'LC2 'safeLC2)
	(COPYD 'noncommMONLISPOUT 'safenoncommMONLISPOUT)
	(COPYD 'noncommspreadMonAlgOutprep 'safenoncommspreadMonAlgOutprep)
	(COPYD 'noncommcollexpMonAlgOutprep 'safenoncommcollexpMonAlgOutprep)
	(COND (!*!&!#PrintNoExpts!* (NonCommPrintNoExpts))
	      (T (NonCommCollectExpts)))
	(COND ((NonCommP) (MonNonCommify))) ))

(DE noncommQuickLowTms ()
 (PROG	(!*USERMODE !*REDEFMSG)
	(COPYD 'noncommMONINTERN 'quicknoncommMONINTERN)
	(COPYD 'noncommMONFACTORP 'quicknoncommMONFACTORP)
	(COPYD 'noncommALLMONQUOTIENTS 'quicknoncommALLMONQUOTIENTS)
	(COPYD 'noncommMonTimes 'quicknoncommMonTimes)
	(COPYD 'LC2 'quickLC2)
	(COPYD 'noncommMONLISPOUT 'quicknoncommMONLISPOUT)
	(COPYD 'noncommspreadMonAlgOutprep 'quicknoncommspreadMonAlgOutprep)
	(COPYD 'noncommcollexpMonAlgOutprep 'quicknoncommcollexpMonAlgOutprep)
	(COND (!*!&!#PrintNoExpts!* (NonCommPrintNoExpts))
	      (T (NonCommCollectExpts)))
	(COND ((NonCommP) (MonNonCommify))) ))

%	Setting the exported functions:
(DE MonNonCommify ()
 (PROGN (COPYD 'MONINTERN 'noncommMONINTERN)
	(COPYD 'MonIntern1 'noncommMonIntern1)
	(COPYD 'stableMONLESSP 'noncommstableMONLESSP)
	(COPYD 'instableMONLESSP 'noncomminstableMONLESSP)
	(COPYD 'MONLESSP
	       (COND ((EQ (GETPROCESS) 'ITEMWISE) 'instableMONLESSP)
		     (T 'stableMONLESSP)))
	(COPYD 'MONFACTORP 'noncommMONFACTORP)
	(COPYD 'ALLMONQUOTIENTS 'noncommALLMONQUOTIENTS)
	(COPYD 'MonFactorP1 'noncommMonFactorP1)
	(COPYD 'LeftMonFactorP 'noncommLeftMonFactorP)
	(COPYD 'ListMonFactorP 'noncommListMonFactorP)
	(COPYD 'MonTimes 'noncommMonTimes)
	(COPYD 'MONTIMES2 'noncommMONTIMES2)
	(COPYD 'niMonQuotient 'noncommniMonQuotient)
	(COPYD 'niMonQuotient1 'noncommniMonQuotient1)
	(COPYD 'PreciseniMonQuotient 'noncommPreciseniMonQuotient)
	(COPYD 'TOTALDEGREE 'noncommTOTALDEGREE)
	(COPYD 'MonomialInit 'noncommMonomialInit)
	(COPYD 'RestOfMon 'noncommRestOfMon)
	(COPYD 'MonSignifVar 'CADR)
	(COPYD 'MonLeastSignifVar 'noncommMonLeastSignifVar)
	(COPYD 'GETVARNO 'noncommGETVARNO)
	(COPYD 'MONLISPOUT 'noncommMONLISPOUT)
	(COPYD 'MonAlgOutprep 'noncommMonAlgOutprep)
	(COPYD 'IOWeights2Weights 'LISTCOPY)
	(COPYD 'Weights2IOWeights 'LISTCOPY)
 ))

% Default settings:

% The DEGLEFTLEX mode is standard:
(COPYD 'noncommstableMONLESSP 'noncommLexMONLESSP)

%  The "quick" forms are defaults:
(COPYD 'quicknoncommMONINTERN 'noncommMONINTERN)
(COPYD 'quicknoncommMONFACTORP 'noncommMONFACTORP)
(COPYD 'quicknoncommALLMONQUOTIENTS 'noncommALLMONQUOTIENTS)
(COPYD 'quicknoncommMonTimes 'noncommMonTimes)
(COPYD 'nomxmLC2 'LC2)
(COPYD 'quickLC2 'LC2)
(COPYD 'quicknoncommMONLISPOUT 'noncommMONLISPOUT)
(COPYD 'quicknoncommspreadMonAlgOutprep 'noncommspreadMonAlgOutprep)
(COPYD 'quicknoncommcollexpMonAlgOutprep 'noncommcollexpMonAlgOutprep)

(COPYD 'noncommMonAlgOutprep 'noncommcollexpMonAlgOutprep)
(COPYD 'noncomminstableMONLESSP 'instableDegMONLESSP)
(COPYD 'ordweightsEarlyMonFactorP 'EarlyMonFactorP)
(COPYD 'nomxmLCauto 'LCauto)
(COPYD 'ordweightsnoncommTOTALDEGREE 'noncommTOTALDEGREE)

(ON RAISE)
