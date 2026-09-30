%	Odd characteristic, without logarithms.
%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%
%% Copyright (C) 1992,1994,1997,1998,1999 Joergen Backelin
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

% Created from (parts of) groebmodulo.sl 1994-08-31./JoeB

%  This file by default is read in and compiled in situ, when
% (SETMODULUS p) is executed for an odd prime p, while the
% MODLOGARITMS flag is OFF. More precisely, the name of this file
% is the default value of ORDINARYMODULARFILE!*. By changing either
% this file, or the value of ORDINARYMODULARFILE!*, the user may
% customise the effects of the (SETMODULUS p) commands.
%  At reading in time, the COMP flag is ON (causing immediate
% compilation of function definitions), and three macros GetcMod,
% GetHalfcMod, and GetPredcMod are defined, with the replace
% values p, (p-1)/2, and p-1, respectively.

%	CHANGES:

%  GETD --> DEFP./JoeB 1999-07-02

%  Declared fluids./JoeB 1999-06-26

%  Corrected DestructRedandSimpSemiLinComb./Joeb 1998-03-26 -- 30.

%  Introduced the NOOPs.  Added the REDANDCF and the ratio
% operations, and other Anick needed procedures.
%  Made SubtractRed(and!or)1 non-returning.  Changed the procedure
% definitions order in accordance with the protocol.
%%  Removed some Cf macro export, and the Mpt macros./JoeB 1997-04-18

(SETQ RUNRDRAISE !*RAISE) (OFF RAISE)


% Import: MonTimes, MONLESSP, niMonQuotient, OrdinaryConcPolMonMult;
%	  GBasis, NOOFSPOLCALCS, !*IMMEDIATEFULLREDUCTION.
% Export: InCoeff2RedandCoeff, RedandCoeff2OutCoeff, RedorCoeff2OutCoeff,
%	  RedandCoeff1!?, RedorCoeff1!?, RedandLine2RedorLine,
%	  ReduceLineStep, PolNum, PolDen, mkQPol, Num!&Den2QPol,
%	  Num!&Den!&Tm2QPol, Tm2QPol, QPol2LRatTm, Redand2Redor,
%	  DestructRedor2Redand, RedorMonMult, PreenRedand, PreenRedor,
%	  PreenQPol, ReducePolStep, NormalFormStep, SubtractRedand1,
%	  SubtractRedor1, SubtractQPol1, DestructRedandSimpSemiLinComb,
%	  DestructQPolSimpSemiLinComb, DestructRedandCoeffTimes,
%	  DestructQPolCoeffTimes, DestructChangeRedandTimes,
%	  DestructQPolTermPlus.
% Available: REDANDCF!+, REDANDCF!-, REDANDCF!-!-, REDANDCF!*, REDANDCF!/,
%            REDANDCFREMAINDER, REDANDCFDIVISION, REDANDCFNEGATIVE,
%	     RATCF2NUMERATOR, RATCF2DENOMINATOR, REDANDCF2RATCF,
%	     REDANDCFS2RATCF, RATCF!-, SHORTENRATCFFF, INTEGERISE,
%	     CFMONREDANDMULT; (REDANDCOEFFONE).

(GLOBAL '(GBasis NOOFSPOLCALCS !*IMMEDIATEFULLREDUCTION
	  NOOFNILREDUCTIONS))
(FLUID '(!*REDEFMSG !*USERMODE !*PWRDS !*MSG))

(OFF REDEFMSG) (OFF USERMODE) (OFF PWRDS) (OFF MSG)

% 91-10-23: The 'general macros' used in this file.
(DM DMaybe (rrrrg) (COND ((NOT (DEFP (CADR rrrrg))) (CONS 'DM (CDR rrrrg)))))

%  Da capo, in order to counter stupid loading resettings:
(OFF PWRDS) (OFF MSG)

(DMaybe Cf (rrg) (CONS 'CAR (CDR rrg)))
(DMaybe Mon (rrg) (CONS 'CDR (CDR rrg)))
(DMaybe APol2Lc (rrg) (CONS 'CAADR (CDR rrg)))
(DMaybe APol2Lm (rrg) (CONS 'CDADR (CDR rrg)))
(DMaybe APol2Lpmon (rrg) (LIST 'CDDR (CONS 'CADR (CDR rrg))))
(DMaybe PMon (mon) (LIST 'CDR (CADR mon))) % Changed from Expts
(DMaybe PPol (rrg) (CONS 'CDR (CDR rrg)))
(DMaybe Lc (rrg) (CONS 'CAAR (CDR rrg)))
(DMaybe Lm (rrg) (CONS 'CDAR (CDR rrg)))
(DMaybe Lpmon (rrg) (CONS 'CDDAR (CDR rrg)))
(DMaybe Cf!&Mon2Tm (rrg) (CONS 'CONS (CDR rrg)))
(DMaybe Tm2Pol (rrg) (LIST 'CONS (CADR rrg) NIL))
(DMaybe Cf!&Mon2Pol (rrg) (LIST 'Tm2Pol (CONS 'Cf!&Mon2Tm (CDR rrg))))
(DMaybe PolTail (rrg) (CONS 'CDR (CDR rrg))) 
(DMaybe PolDecap (rrg) (LIST 'SETQ (CADR rrg) (CONS 'CDR (CDR rrg))))
(DMaybe Pol0!? (rrg) (CONS 'NOT (CDR rrg)))
(DMaybe ConcPol (rrg) (CONS 'RPLACD (CDR rrg)))
(DMaybe PutCf (rrg) (CONS 'RPLACA (CDR rrg)))
(DMaybe PutLc (rrg) (LIST 'RPLACA (LIST 'CAR (CADR rrg)) (CADDR rrg)))
(DMaybe RemoveNextTm (rrg)
    (LIST 'RPLACD (CADR rrg) (CONS 'CDDR (CDR rrg))))
(DMaybe InsertTm (rrg)
    (LIST 'RPLACD
	  (CADR rrg)
	  (LIST 'CONS (CADDR rrg) (LIST 'CDR (CADR rrg)))))
% Added 911225:
(DMaybe Mon!= (rrg) (CONS 'EQ (CDR rrg)))

(DMaybe mkAPol (rrg) (LIST 'CONS 'NIL 'NIL))
(DMaybe PPol!? (rrg) (CONS 'CDR (CDR rrg)))
(DMaybe Pol!? (rrg) (CADR rrg))
(DMaybe APol0!? (rrg) (CONS 'NULL (CDR rrg)))
% Added 970414:
(DMaybe OddGetRatCf (rrg) (CONS 'CAR (CDR rrg)))
(DMaybe OddPutRatCf (rrg) (CONS 'RPLACA (CDR rrg)))

% Macros:

(DM Cf0!? (cfs) (LIST 'EQ (CADR cfs) 0))
(DM Cf1!? (cfs) (LIST 'EQ (CADR cfs) 1))
(DM Cf1 (cfs) 1)
% (DM Cf!+ (cfs) (CONS 'PLUS2 (CDR cfs)))
(DM Cf!* (cfs) (LIST 'REMAINDER (CONS 'TIMES2 (CDR cfs)) (GetcMod)))
(DM Cf!- (cfs) (LIST 'DIFFERENCE (GetcMod) (CADR cfs)))
(DM Cf!-!- (cfs) (LIST 'PROG '(CF!-!-A)
		     (LIST 'SETQ 'CF!-!-A (CONS 'DIFFERENCE (CDR cfs)))
		     '(RETURN (COND ((LESSP CF!-!-A 0) (PLUS2 (GetcMod) CF!-!-A))
				    (T CF!-!-A)))))
%%  Shouldn't we reduce CfLinComb w.r.t. (GetcMod)? Removing, anyhow!
%% (JoeB 970414)
%(DM CfLinComb (cfs)
%    (LIST 'PLUS2 (LIST 'TIMES2 (CADR cfs) (CADDR cfs))
%	  (LIST 'TIMES2 (CADDDR cfs) (CAR (CDDDDR cfs)))))

(DM CfSemiLinComb (cfs)
    (LIST 'REMAINDER
	  (LIST 'PLUS2 (CADR cfs)
		(LIST 'TIMES2 (CADDR cfs) (CADDDR cfs)))
	  (GetcMod)))

(DM Cf!/ (cfs) (LIST 'PROG '(rrtt)
		     (LIST 'COND
			   (LIST
			    (LIST 'Cf0!?
				  (LIST 'CDR
					(LIST 'SETQ 'rrtt
					      (CONS 'DIVIDE (CDR cfs)))))
			    '(RETURN (CAR rrtt))))
		     (LIST 'RETURN
			   (LIST 'CfSemiLinComb '(CAR rrtt) '(CDR rrtt)
				 (CONS 'CfInv (CDDR cfs))))))


% This is by far the potentially most time consuming of the simple
% coefficient domain operations, since it employs Euclid's algorithm.

(DE CfInv (numb)
 (PROG	(AA DD QL RR SG)
	% dividend,2:nd coeff;(quotient.remainder),temp storage;
	% quotient list;remainder,1:st coeff;sign.
	(COND ((Cf1!? numb) (RETURN (Cf1))))
	(SETQ RR numb)
	(SETQ AA (GetcMod))
  Fl	(SETQ DD (DIVIDE AA RR))
	(SETQ QL (CONS (CAR DD) QL))
	(SETQ AA RR)
	(COND ((NOT (Cf1!? (SETQ RR (CDR DD))))
	       (GO Fl)))
	(SETQ AA (CAR QL))
  Sl	(COND ((SETQ QL (CDR QL))
	       (SETQ SG (NOT SG))
	       (SETQ DD (CfSemiLinComb RR AA (CAR QL)))
	       (SETQ RR AA)
	       (SETQ AA DD)
	       (GO Sl))
	      (SG (RETURN AA))
	      (T (RETURN (Cf!- AA)))) ))


% POLYNOMIAL ARITHMETICS ROUTINES. Most of them physically changes one
% argument. Some of them have rather arbitrary outputs, which should not
% be used! "Returns." below is short for "Returns what the mnemonic name
% indicates." No return indication = undefined output.

% Recall that the general philosophy (with few exceptions) is to use a
% tailored routine for each purpose. (Recall that this programme is NOT
% intended as a algebraic manipulation programme kernel but as a
% one-purpose programme!) This means that there are several very
% similar-looking arithmetic routines below, which to the effect but not
% to the time and space efficiency might have been replaced by
% combinations of a couple of basic ones. 

% Recall the mnemonics: Pol=polynomial (augmented or not); N=number;
% Mon=monomial (with or without pointer); GCD=greatest common divisor; the
% rest is hopefully self-explanatory. As arguments, apol/pol or mon/pmon
% will tell what kind of Pol or Mon, respectively, is intended.
% Recall that polynomial and numerical inputs MUST be non-zero. (Monomials
% are by definition monic; the monomial 1 is allowed.)
% The mnemonic and argument order is "reverse lexicographic: p,n,m", i.e.,
% Polynomial, Number, Monomial.


%	Changes pol.

(DE PolNMult (pol numb)
 (PROG	(AA)
	(COND ((Cf1!? numb)
	       (RETURN T)))
	(SETQ AA pol)
  Ml	(PutLc AA (Cf!* (Lc AA) numb))
	(COND ((PolDecap AA)
	       (GO Ml)))
 ))


%	Changes returnstart by concatenating.

(DE ConcPolNMult (returnstart pol numb)
 (PROG	(AA BB)
	(COND ((Cf1!? numb)
	       (ConcPol returnstart (DPLISTCOPY pol))
	       (RETURN NIL)))
	(SETQ AA pol)
	(SETQ BB returnstart)
  Ml	(ConcPol BB (Cf!&Mon2Pol (Cf!* (Lc AA) numb) (Lm AA)))
	(COND ((PolDecap AA)
	       (PolDecap BB)
	       (GO Ml)))
 ))


%	Changes returnstart by concatenating. Destroys pol.

(DE DestructConcPolNMult (returnstart pol numb)
 (PROG	(rp)
	(ConcPol returnstart pol)
	(COND ((Cf1!? numb)
	       (RETURN NIL)))
	(SETQ rp pol)
  Ml	(PutLc rp (Cf!* numb (Lc rp)))
	(COND ((PolDecap rp)
	       (GO Ml)))
 ))


%	Changes returnstart by concatenating.

(DE ConcPolMonMult!- (returnstart pol pmon)
 (PROG	(AA BB)
	(SETQ AA pol)
	(SETQ BB returnstart)
  Ml	(ConcPol BB (Cf!&Mon2Pol (Cf!- (Lc AA))
				 (MonTimes (Lpmon AA) pmon)))
	(COND ((PolDecap AA)
	       (PolDecap BB)
	       (GO Ml)))
 ))


%	Changes returnstart by concatenating.

(DE ConcPolNMonMult (returnstart pol numb pmon)
 (PROG	(AA BB)
	(COND ((Cf1!? numb) % TEMPORARY fix (JoeB 941006):
	       (RETURN (OrdinaryConcPolMonMult returnstart pol pmon))))
	(SETQ AA pol)
	(SETQ BB returnstart)
  Ml	(ConcPol BB
		(Cf!&Mon2Pol (Cf!* (Lc AA) numb)
			     (MonTimes (Lpmon AA) pmon)))
	(COND ((PolDecap AA)
	       (PolDecap BB)
	       (GO Ml)))
 ))


%	Changes augpol by replacing PPol(augpol) (effectively) by
%	PPol(augpol) + pol2*numb*pmon. Cadr(place) is removed.

(DE SemiPolLinComb (augpol place pol numb pmon)
 (PROG	(AA BB CC DD ee)
	(RemoveNextTm place)
	(SETQ AA place)
	(SETQ BB pol)
	(GO Ml)
  Bgap	(PolDecap AA)
	(COND ((Pol0!? (PolTail AA))
	       (ConcPol AA (Cf!&Mon2Pol (Cf!* (Lc BB) numb) CC))
	       (RETURN (COND ((PolTail BB)
			      (ConcPolNMonMult (PolTail AA)
					       (PolTail BB)
					       numb
					       pmon)))))
	      ((Mon!= CC (Lm (PolTail AA)))
	       (COND ((Cf0!? (SETQ DD (CfSemiLinComb (Lc (PolTail AA))
						     (Lc BB) numb)))
		      (RemoveNextTm AA))
		     (T
		      (PolDecap AA)
		      (PutLc AA DD)))
	       (PolDecap BB)
	       (GO Ml))
	      ((MONLESSP ee (Lpmon (PolTail AA)))
	       (GO Bgap)))
	(InsertTm AA (Cf!&Mon2Tm (Cf!* (Lc BB) numb) CC))
	(PolDecap AA)
	(PolDecap BB)
  Ml	(COND ((AND (PolTail AA) BB)
	       (COND ((Mon!= (SETQ CC (MonTimes (Lpmon BB) pmon))
			  (Lm (PolTail AA)))
		      (COND ((Cf0!? (SETQ DD
					  (CfSemiLinComb (Lc (PolTail AA))
							 (Lc BB)
							 numb)))
			     (RemoveNextTm AA))
			    (T
			     (PolDecap AA)
			     (PutLc AA DD)))
		      (PolDecap BB)
		      (GO Ml))
		     ((MONLESSP (Lpmon (PolTail AA)) (SETQ ee (PMon CC)))
		      (InsertTm AA (Cf!&Mon2Tm (Cf!* (Lc BB) numb) CC))
		      (PolDecap AA)
		      (PolDecap BB)
		      (GO Ml))
		     (T (GO Bgap))))
	      (BB
	       (ConcPolNMonMult AA BB numb pmon)))
 ))

%	Changes augpol by replacing PPol(augpol) (effectively) by
%	PPol(augpol) - pol2*pmon. Cadr(place) is removed.

(DE VerysimpSemiPolLinComb (augpol place pol pmon)
 (PROG	(AA BB CC DD ee)
	(RemoveNextTm place)
	(SETQ AA place)
	(SETQ BB pol)
	(GO Ml)
  Bgap	(PolDecap AA)
	(COND ((Pol0!? (PolTail AA))
	       (ConcPol AA (Cf!&Mon2Pol (Cf!- (Lc BB)) CC))
	       (RETURN (COND ((PolTail BB)
			      (ConcPolMonMult!- (PolTail AA)
					       (PolTail BB)
					       pmon)))))
	      ((Mon!= CC (Lm (PolTail AA)))
	       (COND ((Cf0!? (SETQ DD (Cf!-!- (Lc (PolTail AA)) (Lc BB))))
		      (RemoveNextTm AA))
		     (T
		      (PolDecap AA)
		      (PutLc AA DD)))
	       (PolDecap BB)
	       (GO Ml))
	      ((MONLESSP ee (Lpmon (PolTail AA)))
	       (GO Bgap)))
	(InsertTm AA (Cf!&Mon2Tm (Cf!- (Lc BB)) CC))
	(PolDecap AA)
	(PolDecap BB)
  Ml	(COND ((AND (PolTail AA) BB)
	       (COND ((Mon!= (SETQ CC (MonTimes (Lpmon BB) pmon))
			  (Lm (PolTail AA)))
		      (COND ((Cf0!? (SETQ DD (Cf!-!- (Lc (PolTail AA))
						   (Lc BB))))
			     (RemoveNextTm AA))
			    (T
			     (PolDecap AA)
			     (PutLc AA DD)))
		      (PolDecap BB)
		      (GO Ml))
		     ((MONLESSP (Lpmon (PolTail AA)) (SETQ ee (PMon CC)))
		      (InsertTm AA (Cf!&Mon2Tm (Cf!- (Lc BB)) CC))
		      (PolDecap AA)
		      (PolDecap BB)
		      (GO Ml))
		     (T (GO Bgap))))
	      (BB
	       (ConcPolMonMult!- AA BB pmon)))
 ))

%	Changes augpol by replacing PPol(augpol) (effectively) by
%	PPol(augpol) + pol2*numb2. Cadr(place) is removed.

(DE SemiSimpPolLinComb (augpol place pol numb2)
 (PROG	(AA BB DD ee)
	(RemoveNextTm place)
	(SETQ AA place)
	(SETQ BB pol)
	(GO Ml)
  Bgap	(PolDecap AA)
	(COND ((Pol0!? (PolTail AA)) (RETURN (ConcPolNMult AA BB numb2)))
	      ((Mon!= (Lm BB) (Lm (PolTail AA)))
	       (COND ((Cf0!? (SETQ DD (CfSemiLinComb (Lc (PolTail AA))
						     (Lc BB)
						     numb2)))
		      (RemoveNextTm AA))
		     (T
		      (PolDecap AA)
		      (PutLc AA DD)))
	       (PolDecap BB)
	       (GO Ml))
	      ((MONLESSP ee (Lpmon (PolTail AA)))
	       (GO Bgap)))
	(InsertTm AA (Cf!&Mon2Tm (Cf!* (Lc BB) numb2) (Lm BB)))
	(PolDecap AA)
	(PolDecap BB)
Ml	(COND ((AND (PolTail AA) BB)
	       (COND ((Mon!= (Lm BB) (Lm (PolTail AA)))
		      (COND ((Cf0!? (SETQ DD
					  (CfSemiLinComb (Lc (PolTail AA))
							 (Lc BB)
							 numb2)))
			     (RemoveNextTm AA))
			    (T
			     (PolDecap AA)
			     (PutLc AA DD)))
		      (PolDecap BB)
		      (GO Ml))
		     ((MONLESSP (Lpmon (PolTail AA)) (SETQ ee (Lpmon BB)))
		      (InsertTm AA (Cf!&Mon2Tm (Cf!* (Lc BB) numb2)
					       (Lm BB)))
		      (PolDecap AA)
		      (PolDecap BB)
		      (GO Ml))
		     (T (GO Bgap))))
	      (BB
	       (ConcPolNMult AA BB numb2)))
 ))


%	EXPORTED PROCEDURES:

%  AVAILABLE REDUCTAND AND RATIO COEFFICIENT PROCEDURES:

%   NOTE: These should NOT be used, if there is any sensible way to
%	  avoid it. They are much to slow.

(DE REDANDCF!+ (cf1 cf2)
 (PROG	(rt)
	(COND ((NOT (Cf0!? (SETQ rt (REMAINDER (PLUS2 cf1 cf2) (GetcMod)))))
	       (RETURN rt))) ))

(DE REDANDCF!- (cf) (Cf!- cf))

(DE REDANDCF!-!- (cf1 cf2)
 (PROG  (rt)
        (COND ((LESSP (SETQ rt (DIFFERENCE cf1 cf2)) 0)
	       (RETURN (PLUS2 rt (GetcMod))))
	      ((NOT (Cf0!? rt))
	       (RETURN rt))) ))

(DE REDANDCF!* (cf1 cf2) (Cf!* cf1 cf2))

(DE REDANDCF!/ (cf1 cf2) (Cf!/ cf1 cf2))

(DE REDANDCFREMAINDER (cf1 cf2) NIL)

(DE REDANDCFDIVISION (cf1 cf2) (NCONS (REDANDCF!/ cf1 cf2)))

(COPYD 'REDANDCFNEGATIVE 'NILNOOPFCN1)


%  The ratio coefficients are represented by positive integers, with
% implicitly understood numerators all = 1.

(COPYD 'RATCF2NUMERATOR 'IBIDNOOPFCN)

(COPYD 'RATCF2DENOMINATOR 'ONENOOPFCN1)

(COPYD 'REDANDCF2RATCF 'IBIDNOOPFCN)

(COPYD 'REDANDCFS2RATCF 'REDANDCF!/)

(COPYD 'RATCF!- 'REDANDCF!-)


%  OTHER COEFFICIENT DOMAIN AND FIELD ELEMENT PROCEDURES:

(DE InCoeff2RedandCoeff (numb)
 (PROG	(RT)
	(COND ((Cf0!? (SETQ RT (REMAINDER numb (GetcMod))))
	       (RETURN NIL))
	      ((LESSP RT 0)
	       (RETURN (BMI!+ (GetcMod) RT))))
	(RETURN RT) ))

(COPYD 'RedandCoeff2OutCoeff 'IBIDNOOPFCN)

(COPYD 'RedorCoeff2OutCoeff 'IBIDNOOPFCN)

(DE RedandCoeff1!? (cf) (Cf1!? cf))

(COPYD 'RedorCoeff1!? 'RedandCoeff1!?)

(COPYD 'SHORTENRATCF 'IBIDNOOPFCN)


%  MATRIX LINE OPERATIONS:

(COPYD 'INTEGERISE 'IBIDNOOPFCN)

%  Meaning of PROG variables: (Inverted) ReTurn value; List Position.

(DE RedandLine2RedorLine (lcoef)
 (PROG	(rt irt lp)
	(SETQ irt (CfInv (SETQ rt (CAR (SETQ lp lcoef)))))
	(RPLACA lcoef (Cf1))
  Ml	(COND ((SETQ lp (CDR lp))
	       (COND ((CAR lp) (RPLACA lp (Cf!* (CAR lp) irt))))
	       (GO Ml)))
	(RETURN rt) ))

(DE ReduceLineStep (redandl redandlpos redorlpos)
 (PROG	(c2 lp1 lp2 tc)
	(SETQ c2 (Cf!- (CAR (SETQ lp1 redandlpos))))
	(SETQ lp2 (CDR redorlpos))
	(RPLACA lp1 NIL)
  Ml	(COND ((NOT (SETQ lp1 (CDR lp1)))
	       (RETURN (Cf1)))
	      ((CAR lp2)
	       (COND ((NOT (CAR lp1))
		      (RPLACA lp1 (Cf!* (CAR lp2) c2)))
		     ((Cf0!? (SETQ tc (CfSemiLinComb (CAR lp1)
						     (CAR lp2)
						     c2)))
		      (RPLACA lp1 NIL))
		     (T
		      (RPLACA lp1 tc)))))
	(SETQ lp2 (CDR lp2))
	(GO Ml) ))



%  POLYNOMIAL OPERATIONS:

(COPYD 'PolNum 'CAR)

(COPYD 'PolDen 'ONENOOPFCN1)

(COPYD 'mkQPol 'LISTONENOOPFCN0)

(DE Num!&Den2QPol (cf1 cf2) (NCONS (Cf!/ cf1 cf2)))

(DE Num!&Den!&Tm2QPol (cf1 cf2 cfmon) (LIST (Cf!/ cf1 cf2) cfmon))

(DE Tm2QPol (cfmon) (LIST 1 cfmon))

(DE QPol2LRatTm (qpol)
 (Cf!&Mon2Tm (Cf!* (OddGetRatCf qpol) (APol2Lc qpol)) (APol2Lm qpol)) )


(DE Redand2Redor (pol)
    (COND ((PolTail pol) (PolNMult pol (CfInv (Lc pol))))
	  ((PutLc pol (Cf1)))) )


(COPYD 'DestructRedor2Redand 'IBIDNOOPFCN)


(DE RedorMonMult (augredor nimonquot)
 (PROG	(rt)
	(OrdinaryConcPolMonMult (SETQ rt (mkAPol))
			     (PPol augredor)
			     nimonquot)
	(RETURN rt) ))

(COPYD 'PreenRedand 'NILNOOPFCN1)

(COPYD 'PreenRedor 'NILNOOPFCN1)

(DE PreenQPol (qpol)
 (PROGN	(COND ((NOT (Cf1!? (OddGetRatCf qpol)))
	       (PolNMult (PPol qpol) (OddGetRatCf qpol))
	       (OddPutRatCf qpol (Cf1))))
	qpol ))


% Main reductions:

(DE ReducePolStep (augpol polpos pureredor nimonquot)
    (SemiPolLinComb augpol
		    polpos
		    (PolTail pureredor)
		    (Cf!- (Lc (PolTail polpos)))
		    nimonquot) )

(COPYD 'NormalFormStep 'ReducePolStep)

(DE SubtractRedand1 (augpol place pol)
 (SemiSimpPolLinComb augpol place (PolTail pol) (Cf!- (Lc (PolTail place)))) )

(COPYD 'SubtractRedor1 'SubtractRedand1)

(COPYD 'SubtractQPol1 'SubtractRedand1)


% (RedorMonMult = Char0RedorMonMult left unchanged.)


%  Output = coef*pmon*augredand, non-destructively and in this order.
%  Meaning of PROG variables: return value; input polynomial position;
% return position.

(DE CFMONREDANDMULT (coef pmon augredand)
 (PROG	(rt ip rp)
	(SETQ rp (SETQ rt (mkAPol)))
	(SETQ ip (PPol augredand))
  Ml	(ConcPol rp
		 (Cf!&Mon2Pol (Cf!* coef (Lc ip))
			      (MONTIMES2 pmon (Lpmon ip))))
	(COND ((PolDecap ip)
	       (PolDecap rp)
	       (GO Ml)))
	(RETURN rt) ))


%  Returns augredand1 + redandcf*augredand2, destroying both input augredands.
%  Meaning of PROG variables: Input position 1 and 2; Temporarily saved
% coefficient or polynomial tail.

(DE DestructRedandSimpSemiLinComb (augredand1 augredand2 redandcf)
 (PROG	(ip1 ip2 tmp)
	(SETQ ip1 augredand1)
	(SETQ ip2 (PPol augredand2))
  Ml	(COND ((Mon!= (Lm ip2) (APol2Lm ip1))
	       (COND ((Cf0!? (SETQ tmp (CfSemiLinComb (APol2Lc ip1)
						      (Lc ip2)
						      redandcf)))
		      (RemoveNextTm ip1))
		     (T
		      (PutLc (PolDecap ip1) tmp)))
	       (COND ((Pol!? (PolDecap ip2))
		      (COND ((Pol0!? (PolTail ip1))
			     (DestructConcPolNMult ip1 ip2 redandcf))
			    (T
			     (GO Ml))))))
	      ((MONLESSP (Lpmon ip2) (APol2Lpmon ip1))
	       (COND ((Pol0!? (PolTail (PolDecap ip1)))
		      (DestructConcPolNMult ip1 ip2 redandcf)
		      (RETURN augredand1))
		     (T
		      (GO Ml))))
	      ((Pol0!? (SETQ tmp (PolTail ip2)))
	       (PutLc ip2 (Cf!* redandcf (Lc ip2)))
	       (ConcPol ip2 (PolTail ip1))
	       (RPLACD ip1 ip2)		% No appropriate macro (but ConcPol?)!
	       (RETURN augredand1))
	      (T
	       (PutLc ip2 (Cf!* redandcf (Lc ip2)))
	       (RPLACD ip2 (PolTail ip1))
	       (RPLACD ip1 ip2)
	       (PolDecap ip1)
	       (SETQ ip2 tmp)
	       (GO Ml)))
	(RETURN (COND ((PPol!? augredand1) augredand1))) ))


(DE DestructQPolSimpSemiLinComb (qpol1 qpol2 coef)
 (DestructRedandSimpSemiLinComb qpol1
				qpol2
				(Cf!/ (Cf!* (OddGetRatCf qpol2) coef)
				      (OddGetRatCf qpol1))) )


%	redand := coef*redand.

(DE DestructRedandCoeffTimes (redand coef)
 (PROG	(ip)
	(COND ((Cf1!? coef) (RETURN T)))
	(SETQ ip (PPol redand))
  Ml	(PutLc ip (Cf!* (Lc ip) coef))
	(COND ((PolDecap ip) (GO Ml)))
 ))


(DE DestructQPolCoeffTimes (qpol ratcf)
 (OddPutRatCf qpol (Cf!* (OddGetRatCf qpol) ratcf)) )


%	redand := -redand.

(DE DestructChangeRedandSign (augredand)
 (PROG	(ip)
	(SETQ ip (PPol augredand))
  Ml	(PutLc ip (Cf!- (Lc ip)))
	(COND ((PolDecap ip) (GO Ml)))
	(RETURN augredand)
 ))


%  Destructively adds tm to qpol; returns qpol or NIL.
%  Meaning of PROG variables: Return Position; (aug)MoNomial of tm;
% Temporary Coefficient.

%  This version destroys tm; change this or the protocol!

(DE DestructQPolTermPlus (qpol tm)
 (PROG	(rp mn tc)
	(SETQ rp qpol)
	(SETQ mn (Mon tm))
  Ml	(COND ((Mon!= (APol2Lm rp) mn)
	       (COND ((Cf0!? (SETQ tc (CfSemiLinComb (APol2Lc rp)
						     (Cf tm)
						     (CfInv (OddGetRatCf
							     qpol)))))
		      (RemoveNextTm rp))
		     (T
		      (PutLc (PPol rp) tc)))
	       (RETURN (COND ((PPol qpol) qpol))))
	      ((MONLESSP (APol2Lpmon rp) (PMon mn))
	       (PutCf tm (Cf!/ (Cf tm) (OddGetRatCf qpol)))
	       (InsertTm rp tm)
	       (RETURN qpol))
	      ((Pol0!? (PPol (PolDecap rp)))
	       (PutCf tm (Cf!/ (Cf tm) (OddGetRatCf qpol)))
	       (ConcPol rp (Tm2Pol tm))
	       (RETURN qpol)))
	(GO Ml) ))

(ON REDEFMSG) (ON USERMODE) (ON PWRDS) (ON MSG)
(COND (RUNRDRAISE (ON RAISE)))
