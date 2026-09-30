%  Coefficient domain = Z/(2) procedures.

%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%
%% Copyright (C) 1992,1994,1996,1997,1998 Joergen Backelin
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


%	Changes:

%  Introduced the anick employed newly documented procedures and
% further NOOPs. Removed Cf macros, replacing with REDANDCF
% procedures (for export)./JoeB 1997-03-14

%  Corrected zero-return of coefficient macros to NIL.
%  Changed argument name auglogpol-->augredor in Char2RedorMonMult.
%  Made !*REDEFMSG and !*USERMODE PROG variables in SetMod2, and
% moved RESTORECHAR0 call from SetMod2 to coeff.sl.
%  Replaced NOOP copying by calls to NILNOOPFCN1 and IBIDNOOPFCN.
%  Removed redundant (?) PROGN in Char2RedandCoeff1!?.
%  Removed redundant (?) PROGN and input examination in
% Char2RedandCoeff2OutCoeff.
%  Removed redundant copies Char2SubtractRedor1 and
% Char2RedorCoeff2OutCoeff, replacing them by copying directly from
% Char2SubtractRedand1 and Char2RedandCoeff2OutCoeff in SetMod2.
%  Added DestructRedandCoeffTimes, DestructChangeRedandSign,
% DestructRedandTermPlus, DestructRedandSimpSemiLinComb,
% CFMONREDANDMULT./JoeB 1996-06-22--24


% Export: Char2 variants of ReducePolStep, SubtractRedand1,
%	  SubtractRedor1, RedorMonMult, PreenRedand, PreenRedor,
%	  Redand2Redor, DestructRedor2Redand,
%	  InCoeff2RedandCoeff, RedandCoeff2OutCoeff,
%	  RedorCoeff2OutCoeff, RedandCoeff1!?,
%	  RedorCoeff1!?, CFMONREDANDMULT, DestructRedandSimpSemiLinComb,
%	  DestructRedandCoeffTimes, DestructChangeRedandSign,
%	  DestructQPolTermPlus; SetMod2.


(OFF RAISE)


(GLOBAL '(GBasis NOOFSPOLCALCS !*IMMEDIATEFULLREDUCTION Modulus
	  NOOFNILREDUCTIONS))


%	EXPORTED COEFFICIENT HANDLING:

%  In most cases, "coefficient" means 1 (since non-zero coefficients
% are disallowed). This makes calculations to noops, in most cases.

%  The sole non-zero ratio coefficient also is represented by 1.

(DE Char2REDANDCFDIVISION (redandcf1 redandcf2) (NCONS 1))


(DE Char2ReduceLineStep (redandl redandlpos redorlpos)
 (PROG	(lp1 lp2)
	(SETQ lp1 redandlpos)
	(SETQ lp2 redorlpos)
	(RPLACA lp1 NIL)
  Ml	(COND ((NOT (SETQ lp1 (CDR lp1)))
	       (RETURN 1))
	      ((CAR (SETQ lp2 (CDR lp2)))
	       (RPLACA lp1 (COND ((NOT (CAR lp1)) 1)))))
	(GO Ml) ))


%	EXPORTED POLYNOMIAL HANDLING:

(DE Char2Num!&Den!&Tm2QPol (cf1 cf2 cfmon) (LIST 1 cfmon))

(DE Char2Tm2QPol (cfmon) (LIST 1 cfmon))


%	MAIN REDUCTIONS (exported):

(DE Char2ReducePolStep (augpol polpos pol nimonquot)
 (PROG	(AA BB CC ee)
	(RemoveNextTm polpos)
	(SETQ AA polpos)
	(SETQ BB pol)
	(GO Ml)
  Bgap	(PolDecap AA)
	(COND ((Pol0!? (PolTail AA))
	       (ConcPol AA (Cf!&Mon2Pol 1 CC))
	       (RETURN (COND ((PolTail BB)
			      (OrdinaryConcPolMonMult (PolTail AA)
						      (PolTail BB)
						      nimonquot)))))
	      ((Mon!= CC (Lm (PolTail AA)))
	       (RemoveNextTm AA)
	       (GO Ml))
	      ((MONLESSP ee (Lpmon (PolTail AA)))
	       (GO Bgap)))
	(InsertTm AA (Cf!&Mon2Tm 1 CC))
	(PolDecap AA)
  Ml	(PolDecap BB)
	(COND ((AND (PolTail AA) BB)
	       (COND ((Mon!= (SETQ CC (MonTimes (Lpmon BB) nimonquot))
			  (Lm (PolTail AA)))
		      (RemoveNextTm AA)
		      (GO Ml))
		     ((MONLESSP (Lpmon (PolTail AA)) (SETQ ee (PMon CC)))
		      (InsertTm AA (Cf!&Mon2Tm 1 CC))
		      (PolDecap AA)
		      (GO Ml))
		     (T (GO Bgap))))
	      (BB
	       (OrdinaryConcPolMonMult AA BB nimonquot)))
 ))


(DE Char2SubtractRedand1 (augpol place pol)
 (PROG	(AA BB ee)
	(RemoveNextTm place)
	(SETQ AA place)
	(SETQ BB pol)
	(GO Ml)
  Bgap	(PolDecap AA)
	(COND ((Pol0!? (PolTail AA))
	       (ConcPol AA (DPLISTCOPY BB))
	       (RETURN augpol))
	      ((Mon!= (Lm BB) (Lm (PolTail AA)))
	       (RemoveNextTm AA)
	       (GO Ml))
	      ((MONLESSP ee (Lpmon (PolTail AA))) (GO Bgap)))
	(InsertTm AA (Cf!&Mon2Tm 1 (Lm BB)))
	(PolDecap AA)
Ml	(PolDecap BB)
	(COND ((AND (PolTail AA) BB)
	       (COND ((Mon!= (Lm BB) (Lm (PolTail AA)))
		      (RemoveNextTm AA)
		      (GO Ml))
		     ((MONLESSP (Lpmon (PolTail AA)) (SETQ ee (Lpmon BB)))
		      (InsertTm AA (Cf!&Mon2Tm 1 (Lm BB)))
		      (PolDecap AA)
		      (GO Ml))
		     (T (GO Bgap))))
	      (BB
	       (ConcPol AA (DPLISTCOPY BB))))
	(RETURN (COND ((PPol!? augpol) augpol)))
 ))



(DE Char2RedorMonMult (augredor nimonquot)
 (PROG	(RT)
	(OrdinaryConcPolMonMult (SETQ RT (mkAPol))
			     (PPol augredor)
			     nimonquot)
	(RETURN RT) ))


(DE Char2InCoeff2RedandCoeff (numb) (COND ((NOT (EVENP numb)) 1)) )


%  Output = pmon*augredand, non-destructively and in this order. (After
% all, redandcf MUST be 1.)
%  Meaning of PROG variables: return value; return position.

(DE Char2CFMONREDANDMULT (redandcf pmon augredand)
 (PROG	(rt rp)
	(ConcPol (SETQ rt (mkAPol)) (SETQ rp (CopyPPol (PPol augredand))))
  Ml	(PutMon (Lt rp) (MONTIMES2 pmon (Lpmon rp)))
	(COND ((Pol!? (PolDecap rp))
	       (GO Ml)))
	(RETURN rt) ))


%  Returns augredand1 + augredand2, destroying both input augredands.
%  Meaning of PROG variables: Input position 1 and 2; Temporarily saved
% polynomial tail.

(DE Char2DestructRedandSimpSemiLinComb (augredand1 augredand2 redandcf)
 (PROG	(ip1 ip2 tmp)
	(SETQ ip1 augredand1)
	(SETQ ip2 (PPol augredand2))
  Ml	(COND ((Mon!= (Lm ip2) (APol2Lm ip1))
	       (COND ((Pol0!? (PolTail (RemoveNextTm ip1)))
		      (ConcPol ip1 (PolTail ip2)))
		     ((Pol!? (PolDecap ip2))
		      (GO Ml))))
	      ((MONLESSP (Lpmon ip2) (APol2Lpmon ip1))
	       (COND ((Pol0!? (PolTail (PolDecap ip1)))
		      (ConcPol ip1 ip2)
		      (RETURN augredand1))
		     (T
		      (GO Ml))))
	      ((Pol0!? (SETQ tmp (PolTail ip2)))
	       (ConcPol ip2 (PolTail ip1))
	       (ReplacePolTail ip1 ip2)
	       (RETURN augredand1))
	      (T
	       (ReplacePolTail ip2 (PolTail ip1))
	       (ReplacePolTail ip1 ip2)
	       (PolDecap ip1)
	       (SETQ ip2 tmp)
	       (GO Ml)))
	(RETURN (COND ((PPol augredand1) augredand1))) ))


%  Destructively adds tm to qpol; returns qpol or NIL.
%  Meaning of PROG variables: Return position; (aug)monomial of tm.

(DE Char2DestructQPolTermPlus (qpol tm)
 (PROG	(rp mn)
	(SETQ rp qpol)
	(SETQ mn (Mon tm))
  Ml	(COND ((Mon!= (APol2Lm rp) mn)
	       (RemoveNextTm rp)
	       (RETURN (COND ((PPol qpol) qpol))))
	      ((MONLESSP (APol2Lpmon rp) (PMon mn))
	       (InsertTm rp tm)
	       (RETURN qpol)))
	(GO Ml) ))


(DE SetMod2 ()
 (PROG	(!*REDEFMSG !*USERMODE)
	(SETQ Modulus 2)
	(COPYD 'REDANDCF!+ 'NILNOOPFCN2)
	(COPYD 'REDANDCF!- 'ONENOOPFCN1)
	(COPYD 'REDANDCF!-!- 'NILNOOPFCN2)
	(COPYD 'REDANDCF!* 'ONENOOPFCN2)
	(COPYD 'REDANDCF!/ 'ONENOOPFCN2)
	(COPYD 'REDANDCFREMAINDER 'NILNOOPFCN2)
	(COPYD 'REDANDCFDIVISION 'LISTONENOOPFCN2)
	(COPYD 'REDANDCFNEGATIVE 'NILNOOPFCN1)
%	(COPYD 'CfLinComb 'NILNOOPFCN4)
%	(COPYD 'CfSemiLinComb 'NILNOOPFCN3)
%	(COPYD 'CfInv 'ONENOOPFCN1)
	(COPYD 'RATCF2NUMERATOR 'ONENOOPFCN1)
	(COPYD 'RATCF2DENOMINATOR 'ONENOOPFCN1)
	(COPYD 'REDANDCF2RATCF 'ONENOOPFCN1)
	(COPYD 'REDANDCFS2RATCF 'ONENOOPFCN2)
	(COPYD 'RATCF!- 'ONENOOPFCN1)
	(COPYD 'InCoeff2RedandCoeff 'Char2InCoeff2RedandCoeff)
	(COPYD 'RedandCoeff2OutCoeff 'ONENOOPFCN1)
	(COPYD 'RedorCoeff2OutCoeff 'ONENOOPFCN1)
	(COPYD 'RedandCoeff1!? 'TNOOPFCN1)
	(COPYD 'RedorCoeff1!? 'TNOOPFCN1)
	(COPYD 'SHORTENRATCF 'ONENOOPFCN1)
	(COPYD 'INTEGERISE 'ONENOOPFCN1)
	(COPYD 'ReduceLineStep 'Char2ReduceLineStep)
	(COPYD 'RedandLine2RedorLine 'ONENOOPFCN1)
	(COPYD 'PolNum 'ONENOOPFCN1)
	(COPYD 'PolDen 'ONENOOPFCN1)
	(COPYD 'PutPolNum 'NILNOOPFCN2)
	(COPYD 'PutPolDen 'NILNOOPFCN2)
	(COPYD 'mkQPol 'LISTONENOOPFCN0)
	(COPYD 'Num!&Den2QPol 'LISTONENOOPFCN2)
	(COPYD 'Num!&Den!&Tm2QPol 'Char2Num!&Den!&Tm2QPol)
	(COPYD 'Tm2QPol 'Char2Tm2QPol)
	(COPYD 'QPol2LRatTm 'CADR)
	(COPYD 'Redand2Redor 'IBIDNOOPFCN)
	(COPYD 'DestructRedor2Redand 'IBIDNOOPFCN)
	(COPYD 'PreenRedand 'NILNOOPFCN1)
	(COPYD 'PreenRedor 'NILNOOPFCN1)
	(COPYD 'PreenQPol 'IBIDNOOPFCN)
	(COPYD 'ReducePolStep 'Char2ReducePolStep)
	(COPYD 'NormalFormStep 'Char2ReducePolStep)
	(COPYD 'SubtractRedand1 'Char2SubtractRedand1)
	(COPYD 'SubtractRedor1 'Char2SubtractRedand1)
	(COPYD 'SubtractQPol1 'Char2SubtractRedand1)
	(COPYD 'RedorMonMult 'Char2RedorMonMult)
	(COPYD 'CFMONREDANDMULT 'Char2CFMONREDANDMULT)
	(COPYD 'DestructRedandSimpSemiLinComb
	       'Char2DestructRedandSimpSemiLinComb)
	(COPYD 'DestructQPolSimpSemiLinComb
	       'Char2DestructRedandSimpSemiLinComb)
	(COPYD 'DestructRedandCoeffTimes 'NILNOOPFCN2)
	(COPYD 'DestructQPolCoeffTimes 'NILNOOPFCN2)
	(COPYD 'DestructChangeRedandSign 'IBIDNOOPFCN)
	(COPYD 'DestructQPolTermPlus 'Char2DestructQPolTermPlus)
 ))


(ON RAISE)
