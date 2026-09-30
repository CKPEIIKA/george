%  The specific procedures for coefficients being arbitrary Reduce
% standard forms.

%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%
%% Copyright (C) 1995,1996,1997 Joergen Backelin
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


(OFF RAISE)

% CHANGES:

%  Introduced NOOPs. Removed the NOOPs PreenRedor,
% DestructRedor2Redand, InCoeff2RedandCoeff,
% RedandCoeff2OutCoeff, RedorCoeff2OutCoeff (as being equal
% to Char0 variants). /JoeB 1999-06-24

%  Changed *TakeDenseContents from GLOBAL to FLUID. Corrected call
% to SFCfSparseContents. /JoeB 1997-10-27

%  Corrected SparseContentSFCfPreenRedand.
%  Unified content regularity mode changing and moved it to coeff.sl.
% /JoeB 1996-07-04

% Created 1995-07-08, from a copy of char0.sl.

%    The macros would be read from a separate file ????


% Import: MonTimes, MONLESSP, niMonQuotient, FindGroebF,
%	  NOOFSPOLCALCS, !*IMMEDIATEFULLREDUCTION;
%	  GBasis, Modulus, NOOFNILREDUCTIONS, !*TakeDenseContents.
% Export: ReducePolStep, SubtractRedand1, SubtractRedor1, RedorMonMult,
%	  PreenRedand, PreenRedor, Redand2Redor, DestructRedor2Redand,
%	  InCoeff2RedandCoeff, RedandCoeff2OutCoeff,
%	  RedorCoeff2OutCoeff,
%	  RedandCoeff1!?, RedorCoeff1!?;
%	  SFCfDenseContents, SFCfSparseContents;
% Available:

(GLOBAL '(GBasis NOOFSPOLCALCS !*IMMEDIATEFULLREDUCTION
	  NOOFNILREDUCTIONS Modulus))

(FLUID '(!*TakeDenseContents))

% Macros:
(DM Cf0 (cfs) NIL)
(DM Cf1 (cfs) 1)
% (DM Cf0!? (cfs) (LIST 'EQ (CADR cfs) 0))
(DM Cf0!? (cfs) (CONS 'NULL (CDR cfs)))
(DM Cf1!? (cfs) (LIST 'EQ (CADR cfs) 1))
% (DM Cf+ (cfs) (CONS 'ADDF (CDR cfs)))
(DM Cf!* (cfs) (CONS 'MULTF (CDR cfs)))
% (DM Cf- (cfs) (CONS 'DIFFERENCE (CDR cfs)))
(DM Cf!/ (cfs) (CONS 'QUOTF (CDR cfs)))
(DM CfLinComb (cfs)
    (LIST 'ADDF (LIST 'MULTF (CADR cfs) (CADDR cfs))
	  (LIST 'MULTF (CADDDR cfs) (CAR (CDDDDR cfs)))))
(DM CfSemiLinComb (cfs)
    (LIST 'ADDF (CADR cfs)
	  (LIST 'MULTF (CADDR cfs) (CADDDR cfs))))
(DM CfNegP (cfs) (CONS 'MINUSF (CDR cfs)))
(DM CfNegate (cfs) (CONS 'NEGF (CDR cfs)))

% This is the module for the most general Reduce context (commutative)
% coefficient domain, the standard quotients. These roughly correspond
% to the polynomials in variables (to be precise: Reduce kernels) not
% listed as input variables. (Note the particular form of input variables
% when Reduce communicating in non-commutative mode!)
%  The polynomial arithmetic shares many thing with the rational field Q
% arithmetics, like using denominator representation ('pseudo reductions')
% and performing numerous GCD calculations. Hence, this file is copied
% almost verbatim from the Q-as-domain file, char0.sl. In particular, two
% mode changers DENSESFCONTENTS and SPARSESFCONTENTS are available,
% setting submodes deciding how often contents should be factored out of
% reductands.

%  See char0.sl for further comments.


% PROCEDURES COPIED TO EXPORTED ONES

% We get content by factoring out the content of pol (predand or predor):

(DE SFCfPolContent!&UnSignLc (pol)
    (COND ((PolTail pol)
	   (SFCfPolNQuot pol
		     (COND ((NOT (CfNegP (Lc pol))) (SFCfPolGCD pol))
			   (T (CfNegate (SFCfPolGCD pol))))))
	  ((PutLc pol (Cf1)))) )

(DE SFCfPolContent (pol)
    (COND ((PolTail pol) (PolNQuot pol (PolGCD pol)))
	  ((PutLc pol (Cf1)))) )


% EXPORTED PROCEDURES:

(DE SFCfReducePolStep (augredand redandpos pureredor nimonquot)
 (PROG	(gcdcfs)
	(SETQ gcdcfs (SFCfCoeffsGCD!:d (Lc (PolTail redandpos)) (Lc pureredor)))
	(SFCfPolLinComb augredand
		    redandpos
		    (PolTail pureredor)
		    (CAR gcdcfs)
		    (CDR gcdcfs)
		    nimonquot) ))

%	redand := redand + pmon*redor.

%(DE SFCfAddPolMonMult (redand redor pmon)
% (PROG	(AA BB)
%	(SETQ AA (PPol redor))
%	(SETQ BB (mkAPol))
%  Ml	(ConcPol BB (Cf!&Mon2Pol (Lc AA) (MonTimes (Lpmon AA) pmon)))
%	(COND ((PolDecap AA) (PolDecap BB) (GO Ml)))
% ))



%	Changes augredand. Returns.

(DE SparseContentSFCfSubtractRedand1 (augredand place pol)
 (PROG	(AA)
	(SETQ AA (SFCfCoeffsGCD!:d (Lc (PolTail place)) (Lc pol)))
	(SparseContentSFCfSimpPolLinComb augredand
					  place
					  (PolTail pol)
					  (CAR AA)
					  (CDR AA))
	(RETURN (COND ((PPol!? augredand) augredand)))
 ))


%	Changes augredand. Returns. Factors out new content.

(DE DenseContentSFCfSubtractRedand1 (augredand place pol)
 (PROG	(AA)
	(SETQ AA (SFCfCoeffsGCD!:d (Lc (PolTail place)) (Lc pol)))
	(SETQ AA (DenseContentSFCfSimpPolLinComb augredand
						  place
						  (PolTail pol)
						  (CAR AA)
						  (CDR AA)))
	(COND ((PPol!? augredand)
	       (COND ((PolTail (PPol augredand))
		      (SFCfPolNQuot (PPol augredand) AA))
		     ((PutLc (PPol augredand) (Cf1))))
	       (RETURN  augredand)))
 ))

(COPYD 'SFCfSubtractRedor1 'DenseContentSFCfSubtractRedand1)


%	Changes redand. Should be in a direct content and a no direct
%	content variant.

(COPYD 'DenseContentSFCfPreenRedand 'NILNOOPFCN1)

(DE SparseContentSFCfPreenRedand (augredand)
 (SFCfPolContent!&UnSignLc (PPol augredand)) )


%%	Changes redor. Should it be in a direct content and a no
%%	direct content variant?
%
%(COPYD 'DenseContentSFCfPreenRedor 'DenseContentSFCfPreenRedand)
%
%(COPYD 'SparseContentSFCfPreenRedor 'SFCfPolContent)

% (COPYD 'SFCfPreenRedor 'NILNOOPFCN1)


%	Returns redand := pmon*redor.

(DE SFCfRedorMonMult (redor pmon)
 (PROG	(RT)
	(OrdinaryConcPolMonMult (SETQ RT (mkAPol)) (PPol redor) pmon)
	(RETURN RT) ))


(COPYD 'DenseContentSFCfRedand2Redor 'NILNOOPFCN1)

(COPYD 'SparseContentSFCfRedand2Redor 'SFCfPolContent!&UnSignLc)


% (COPYD 'SFCfDestructRedor2Redand 'NILNOOPFCN1)

% (COPYD 'SFCfInCoeff2RedandCoeff 'IBIDNOOPFCN)

% (COPYD 'SFCfRedandCoeff2OutCoeff 'IBIDNOOPFCN)

% (COPYD 'SFCfRedorCoeff2OutCoeff 'IBIDNOOPFCN)

(DE SFCfRedandCoeff1!? (cf) (Cf1!? cf))

(DE SFCfRedorCoeff1!? (cf) (Cf1!? cf))


%	EXTRA EXPORTED PROCEDURES.


%    Mode changers for taking contents as densely as possible, or
%    just after finished reductions.

(DE SFCfDenseContents ()
 (PROGN	(COPYD 'SFCfSubtractRedand1 'DenseContentSFCfSubtractRedand1)
%	(COPYD 'SFCfSubtractRedor1 'DenseContentSFCfSubtractRedor1)
	(COPYD 'SFCfRedand2Redor 'DenseContentSFCfRedand2Redor)
	(COPYD 'SFCfPreenRedand 'DenseContentSFCfPreenRedand)
%	(COPYD 'SFCfPreenRedor 'DenseContentSFCfPreenRedor)
	(COND ((EQ Modulus 'SF)
	       (SETREDUCESFCOEFFS))) ))

(DE SFCfSparseContents ()
 (PROGN	(COPYD 'SFCfSubtractRedand1 'SparseContentSFCfSubtractRedand1)
%	(COPYD 'SFCfSubtractRedor1 'SparseContentSFCfSubtractRedor1)
	(COPYD 'SFCfRedand2Redor 'SparseContentSFCfRedand2Redor)
	(COPYD 'SFCfPreenRedand 'SparseContentSFCfPreenRedand)
%	(COPYD 'SFCfPreenRedor 'SparseContentSFCfPreenRedor)
	(COND ((EQ Modulus 'SF)
	       (SETREDUCESFCOEFFS))) ))



% POLYNOMIAL ARITHMETICS ROUTINES. Most of them physically changes one
% argument, the redand. Some of them have rather arbitrary outputs, which
% should not be used! "Returns." below is short for "Returns what the
% mnemonic name indicates." No return indication = undefined output.


%	redand := coef*redand.

(DE SFCfPolNMult (redand coef)
 (PROG	(AA)
	(COND ((Cf1!? coef) (RETURN T)))
	(SETQ AA redand)
  Ml	(PutLc AA (Cf!* (Lc AA) coef))
	(COND ((PolDecap AA) (GO Ml)))
 ))


%	Changes returnstart by concatenating pol.
% Call to DPLISTCOPY should be replaced by macro Redor2Redand (e.g.), doing
% the same.

(DE SFCfConcPolNMult (returnstart pol coef)
 (PROG	(AA BB)
	(COND ((Cf1!? coef) (ConcPol returnstart (DPLISTCOPY pol))
	       (RETURN NIL)))
	(SETQ AA pol)
	(SETQ BB returnstart)
  Ml	(ConcPol BB (Tm2Pol (Cf!&Mon2Tm (Cf!* (Lc AA) coef) (Lm AA))))
	(COND ((PolDecap AA)
	       (PolDecap BB)
	       (GO Ml)))
 ))


%	Changes redand (before place) by multiplying these addends with coef.

(DE SFCfPolPartNMult (redand place coef)
 (PROG	(AA)
	(COND ((Cf1!? coef) (RETURN T)))
	(SETQ AA redand)
  Ml	(PutLc AA (Cf!* (Lc AA) coef))
	(COND ((NOT (EQ (PolDecap AA) place)) (GO Ml)))
 ))


%	redand := redand/coef.

(DE SFCfPolNQuot (redand coef)
 (PROG	(AA)
	(COND ((Cf1!? coef) (RETURN T)))
	(SETQ AA redand)
  Ml	(PutLc AA (Cf!/ (Lc AA) coef))
	(COND ((PolDecap AA) (GO Ml)))
 ))



%	Changes returnstart by concatenating coef*pmon*pol.

(DE SFCfConcPolNMonMult (returnstart pol coef pmon)
 (PROG	(AA BB)
	(COND ((Cf1!? coef)
	       (RETURN (OrdinaryConcPolMonMult returnstart pol pmon))))
	(SETQ AA pol)
	(SETQ BB returnstart)
  Ml	(ConcPol BB
		 (Cf!&Mon2Pol (Cf!* (Lc AA) coef)
			      (MonTimes (Lpmon AA) pmon)))
	(COND ((PolDecap AA)
	       (PolDecap BB)
	       (GO Ml)))
 ))


%	Changes augredand by replacing Cdr(augredand) (effectively) by
%	Cdr(augredand)*coef1 + coef2*pmon*pol2. Cadr(place) is removed.
%	Meaning of PROG variables: Before augredand position; pol position;
%	pmon*(pol-monomial); new coefficient; pmon of CC.

(DE SFCfPolLinComb (augredand place pol coef1 coef2 pmon)
 (PROG	(AA BB CC DD ee)
	(COND ((NOT (EQ augredand place))
	       (SFCfPolPartNMult (PPol augredand) (PolTail place) coef1)))
	(RemoveNextTm place)
	(SETQ AA place)
	(SETQ BB pol)
	(GO Ml)
  Bgap	(PolDecap AA)
	(PutLc AA (Cf!* (Lc AA) coef1))
	(COND ((Pol0!? (PolTail AA))
	       (ConcPol AA (Cf!&Mon2Pol (Cf!* (Lc BB) coef2) CC))
	       (RETURN (COND ((PolTail BB)
			      (SFCfConcPolNMonMult (PolTail AA)
					       (PolTail BB)
					       coef2
					       pmon)))))
	      ((Mon!= CC (Lm (PolTail AA)))
	       (COND ((Cf0!? (SETQ DD (CfLinComb (Lc (PolTail AA)) coef1
						 (Lc BB) coef2)))
		      (RemoveNextTm AA))
		     (T (PolDecap AA) (PutLc AA DD)))
	       (PolDecap BB)
	       (GO Ml))
	      ((MONLESSP ee (Lpmon (PolTail AA))) (GO Bgap)))
	(InsertTm AA (Cf!&Mon2Tm (Cf!* (Lc BB) coef2) CC))
	(PolDecap AA)
	(PolDecap BB)
  Ml	(COND ((AND (PolTail AA) BB)
	       (COND ((Mon!= (SETQ CC (MonTimes (Lpmon BB) pmon))
			  (Lm (PolTail AA)))
		      (COND ((Cf0!? (SETQ DD
					  (CfLinComb (Lc (PolTail AA)) coef1
						     (Lc BB) coef2)))
			     (RemoveNextTm AA))
			    (T (PolDecap AA) (PutLc AA DD)))
		      (PolDecap BB)
		      (GO Ml))
		     ((MONLESSP (Lpmon (PolTail AA)) (SETQ ee (PMon CC)))
		      (InsertTm AA (Cf!&Mon2Tm (Cf!* (Lc BB) coef2) CC))
		      (PolDecap AA)
		      (PolDecap BB)
		      (GO Ml))
		     (T (GO Bgap))))
	      (BB (SFCfConcPolNMonMult AA BB coef2 pmon))
	      ((PolTail AA) (SFCfPolNMult (PolTail AA) coef1)))
 ))

%	Changes augredand by replacing PPol(augredand) (effectively) by
%	coef1*PPol(augredand) + coef2*pol2. Cadr(place) is removed.

(DE SparseContentSFCfSimpPolLinComb (augredand place pol coef1 coef2)
 (PROG	(AA BB DD ee)
	(COND ((NOT (EQ augredand place))
	       (SFCfPolPartNMult (PPol augredand) (PolTail place) coef1)))
	(RemoveNextTm place)
	(SETQ AA place)
	(SETQ BB pol)
	(GO Ml)
  Bgap	(PolDecap AA)
	(PutLc AA (Cf!* (Lc AA) coef1))
	(COND ((Pol0!? (PolTail AA)) (RETURN (SFCfConcPolNMult AA BB coef2)))
	      ((Mon!= (Lm BB) (Lm (PolTail AA)))
	       (COND ((Cf0!? (SETQ DD (CfLinComb (Lc (PolTail AA)) coef1
						 (Lc BB) coef2)))
		      (RemoveNextTm AA))
		     (T
		      (PolDecap AA)
		      (PutLc AA DD)))
	       (PolDecap BB)
	       (GO Ml))
	      ((MONLESSP ee (Lpmon (PolTail AA))) (GO Bgap)))
	(InsertTm AA (Cf!&Mon2Tm (Cf!* (Lc BB) coef2) (Lm BB)))
	(PolDecap AA)
	(PolDecap BB)
	Ml
	(COND ((AND (PolTail AA) BB)
	       (COND ((Mon!= (Lm BB) (Lm (PolTail AA)))
		      (COND ((Cf0!? (SETQ DD
					  (CfLinComb (Lc (PolTail AA)) coef1
						     (Lc BB) coef2)))
			     (RemoveNextTm AA))
			    (T
			     (PolDecap AA)
			     (PutLc AA DD)))
		      (PolDecap BB)
		      (GO Ml))
		     ((MONLESSP (Lpmon (PolTail AA)) (SETQ ee (Lpmon BB)))
		      (InsertTm AA (Cf!&Mon2Tm (Cf!* (Lc BB) coef2)
					       (Lm BB)))
		      (PolDecap AA)
		      (PolDecap BB)
		      (GO Ml))
		     (T (GO Bgap))))
	      (BB
	       (SFCfConcPolNMult AA BB coef2))
	      ((PolTail AA)
	       (SFCfPolNMult (PolTail AA) coef1)))
 ))



%	Changes augredand by replacing Cdr(augredand) (effectively) by
%	Cdr(augredand)*coef1 + pol2*coef2. Cadr(place) is removed.
%	The content of the changed augredand is returned.

(DE DenseContentSFCfSimpPolLinComb (augredand place pol coef1 coef2)
 (PROG	(AA BB DD ee FF)
	(SETQ BB pol)
	(SETQ FF (Cf0))
	(RemoveNextTm place)
	(COND ((EQ augredand place)
	       (SETQ AA place)
	       (GO Ml)))
	(SETQ AA (PPol augredand))
  Fl	(COND ((NOT (Cf1!? FF)) (SETQ FF (GCDF FF (Lc AA)))))
	(PutLc AA (Cf!* (Lc AA) coef1))
	(COND ((NOT (EQ AA place))
	       (PolDecap AA)
	       (GO Fl)))
	(SETQ FF (Cf!* coef1 FF))
	(GO Ml)
  Bgap	(PolDecap AA)
	(PutLc AA (Cf!* (Lc AA) coef1))
	(COND ((NOT (Cf1!? FF)) (SETQ FF (GCDF (Lc AA) FF))))
	(COND ((Pol0!? (PolTail AA))
	       (SFCfConcPolNMult AA BB coef2)
	       (RETURN (SFCfNPolGCD FF (PolTail AA))))
	      ((Mon!= (Lm BB) (Lm (PolTail AA)))
	       (COND ((Cf0!? (SETQ DD (CfLinComb (Lc (PolTail AA)) coef1
						 (Lc BB) coef2)))
		      (RemoveNextTm AA))
		     (T
		      (PolDecap AA)
		      (COND ((NOT (Cf1!? FF)) (SETQ FF (GCDF DD FF))))
		      (PutLc AA DD)))
	       (PolDecap BB)
	       (GO Ml))
	      ((MONLESSP ee (Lpmon (PolTail AA))) (GO Bgap)))
	(InsertTm AA (Cf!&Mon2Tm (Cf!* (Lc BB) coef2) (Lm BB)))
	(PolDecap AA)
	(COND ((NOT (Cf1!? FF)) (SETQ FF (GCDF (Lc AA) FF))))
	(PolDecap BB)
  Ml	(COND ((AND (PolTail AA) BB)
	       (COND ((Mon!= (Lm BB) (Lm (PolTail AA)))
		      (COND ((Cf0!? (SETQ DD
					  (CfLinComb (Lc (PolTail AA)) coef1
						     (Lc BB) coef2)))
			     (RemoveNextTm AA))
			    (T
			     (PolDecap AA)
			     (COND ((NOT (Cf1!? FF)) (SETQ FF (GCDF DD FF))))
			     (PutLc AA DD)))
		      (PolDecap BB)
		      (GO Ml))
		     ((MONLESSP (Lpmon (PolTail AA)) (SETQ ee (Lpmon BB)))
		      (InsertTm AA (Cf!&Mon2Tm (Cf!* (Lc BB) coef2)
					       (Lm BB)))
		      (PolDecap AA)
		      (COND ((NOT (Cf1!? FF)) (SETQ FF (GCDF (Lc AA) FF))))
		      (PolDecap BB)
		      (GO Ml))
		     (T (GO Bgap))))
	      (BB
	       (SFCfConcPolNMult AA BB coef2))
	      ((PolTail AA)
	       (SFCfPolNMult (PolTail AA) coef1)))
	(RETURN (SFCfNPolGCD FF (PolTail AA)))
 ))




% COEFFICIENTS; GREATEST COMMON DIVISORS:

%	Assumes GCDF to be defined and to return 1 whenever no proper
%	common divisor exists. Returns (-coef2/gcd . coef1/gcd), where
%	gcd=gcd(coef1,coef2). Sign modified to make the Cdr positive.

(DE SFCfCoeffsGCD!:d (coef1 coef2)
 (PROG	(AA)
	(SETQ AA (GCDF coef1 coef2))
	(COND ((CfNegP coef2) (SETQ AA (CfNegate AA))))
	(RETURN (CONS (Cf!/ coef2 AA) (CfNegate (Cf!/ coef1 AA))))
 ))


(DE SFCfPolGCD (redand)
 (PROG	(AA BB)
	(SETQ AA (PolTail redand))
	(SETQ BB (ABS (Lc redand)))
  Ml	(COND ((OR (Cf1!? BB) (Pol0!? AA))
	       (RETURN BB)))
	(SETQ BB (GCDF BB (Lc AA)))
	(PolDecap AA)
	(GO Ml)
 ))

(DE SFCfNPolGCD (coef redand)
 (PROG	(AA BB)
	(SETQ AA redand)
	(SETQ BB coef)
  Ml	(COND ((OR (Cf1!? BB) (Pol0!? AA))
	       (RETURN BB)))
	(SETQ BB (GCDF BB (Lc AA)))
	(PolDecap AA)
	(GO Ml)
 ))


% Removed UNSIGNLC!'S and UNSIGNLC.



(COND (!*TakeDenseContents (SFCfDenseContents))
      (T (SFCfSparseContents)))

% For mode changing:
% (COPYD 'SFCfCf0 'Cf0)
% (COPYD 'SFCfCf1 'Cf1)
% (COPYD 'SFCfCf0!? Cf0!?)
% (COPYD 'SFCfCf1!? 'Cf1!?)
% (COPYD 'SFCfCf!+ 'Cf!+)
(COPYD 'SFCfCf!* 'Cf!*)
% (COPYD 'SFCfCf- 'Cf-)
(COPYD 'SFCfCf!/ 'Cf!/)
% (COPYD 'SFCfCfInv 'CfInv)
(COPYD 'SFCfCfLinComb 'CfLinComb)
(COPYD 'SFCfCfSemiLinComb 'CfSemiLinComb)
(COPYD 'SFCfNegP 'CfNegP)
(COPYD 'SFCfNegate 'CfNegate)

% Change 19950620: New actions of COMPRESS and EXPLODE, and
% differing in psl and reduce; I hope this patches it./JoeB

(DE SETREDUCESFCOEFFS()
 (PROG	(!*REDEFMSG !*USERMODE)
   (RESTORECHAR0)
   (SETQ Modulus 'SF)
   (MAPC '(ReducePolStep SubtractRedand1 SubtractRedor1 Redand2Redor
	   RedorMonMult PreenRedand Redand2Redor % PreenRedor
	   % DestructRedor2Redand InCoeff2RedandCoeff RedandCoeff2OutCoeff
	   % RedorCoeff2OutCoeff
	   RedandCoeff1!? RedorCoeff1!?)
	 (FUNCTION (LAMBDA (uu)
			   (COPYD uu
				  (APPENDLCHARTOID (COND ((REDUCE!-SPECIFIC
							   T)
							  '(S F C !! f))
							 (T '(S F C f)))
						   uu))))) ))

(ON RAISE)
