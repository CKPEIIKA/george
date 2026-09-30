%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%
%% Copyright (C) 1992,1993,1994,1995,1996,1999,2003 Joergen Backelin
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


% CHANGES:

%  Removed *NONCOMMUTATIVE./JoeB 2003-08-25

%  GETD --> DEFP./JoeB

%  Declared more fluids./JoeB 1999-06-26

%  Introduced the NOOPs.
%  Made SubtractRed(and!or)1 non-returning and removed spurious double
% definition of SubtractRedor1.

%  Changed GETV to FASTGETV/JoeB 1996-07-01

% CREATED 1994-05-18 from the old (version 0.8) groeblgexmodulo.sl.
% Main changes from the old version:
%     Removed the now (hopefully) coefficient independent procedures
%    ReducePol, FormSPol, (comm)FSPniMQ,

% COMMENT: Uses the logarithm method: the non-zero elements in Z/pZ
% may be represented by "logarithms", i. e., their exponents
% (unique mod p-1) with respect to some generator
% of the (cyclic) multiplicative group. In this variant, we keep
% reductands on ordinary ("pol") form, but reductor coefficients on
% logarithm ("logpol") form.
% The file is intended to be loaded and compiled in run time.

% Import: MonTimes, MONLESSP, niMonQuotient, DPLISTCOPY, FindGroebF,
%	  GetcMod, GetPredcMod, SPolPrep, SPolAutoPrep, MonInsert,
%	  MONINTERN, TermInsert, MONLISPOUT, MonAlgOutPrep, AlgInxPrint,
%	  MONQUOTIENT, STAGGERENDDEGREEOUTPUT,
%	  AUTOREDUCESTAGGEROUTPUT, DEGREEBIGOUTPUT;
%	  GBasis, NOOFSPOLCALCS, NOOFNILREDUCTIONS,
%	  !*IMMEDIATEFULLREDUCTION, !*IMMEDIATECRIT, LOGVECT, EXPVECT,
%	  AO!+, AO!*, AO!^, AObop!+, cPolSubsPri, !*SAVEDEGREE,
%	  !&!*StgFinalOutputChan, !*DEGREEPRINTOUTPUT, DegGBasis,
%	  !*PBSERIES.
% Export: ReducePolStep, SubtractRedand1, SubtractRedor1, RedorMonMult,
%	  PreenRedand, PreenRedor, Redand2Redor, DestructRedor2Redand,
%	  InCoeff2RedandCoeff, RedandCoeff2OutCoeff, RedorCoeff2OutCoeff,
%	  RedorCoeff2RedandCoeff, RedandCoeff1!?, RedorCoeff1!?.

(SETQ RUNRDRAISE !*RAISE)
(OFF RAISE)

(GLOBAL '(GBasis cGBasis NOOFSPOLCALCS !*IMMEDIATEFULLREDUCTION LOGVECT
	  EXPVECT !*IMMEDIATECRIT NOOFNILREDUCTIONS
	  !*SAVEDEGREE !&!*StgFinalOutputChan !*DEGREEPRINTOUTPUT
	  DegGBasis !*PBSERIES cPolSubsPri))
(FLUID '(Pek AO!+ AO!* AO!^ AObop!+ !*REDEFMSG !*USERMODE !*PWRDS !*MSG))

(OFF REDEFMSG) (OFF USERMODE) (OFF PWRDS) (OFF MSG)


% 91-10-23: The 'general macros' used in this file.
(DM DMaybe (rrrrg) (COND ((NOT (DEFP (CADR rrrrg))) (CONS 'DM (CDR rrrrg)))))

%  Da capo, in order to counter stupid loading resettings:
(OFF PWRDS) (OFF MSG)

(DMaybe PMon (mon) (LIST 'CDR (CADR mon))) % Changed from Expts
(DMaybe Cf (rrg) (CONS 'CAR (CDR rrg)))
(DMaybe Mpt (rrg) (CONS 'CAAR (CDR rrg)))
(DMaybe Mpt!? (rrg) (CONS 'CAAR (CDR rrg)))
(DMaybe PPol (rrg) (CONS 'CDR (CDR rrg)))
(DMaybe Lc (rrg) (CONS 'CAAR (CDR rrg)))
(DMaybe Lm (rrg) (CONS 'CDAR (CDR rrg)))
(DMaybe Lpmon (rrg) (CONS 'CDDAR (CDR rrg)))
(DMaybe Tm2PMon (rrg) (CONS 'CDDR (CDR rrg)))
(DMaybe Cf!&Mon2Tm (rrg) (CONS 'CONS (CDR rrg)))
(DMaybe Tm2Pol (rrg) (LIST 'CONS (CADR rrg) NIL))
(DMaybe Cf!&Mon2Pol (rrg) (LIST 'Tm2Pol (CONS 'Cf!&Mon2Tm (CDR rrg))))
(DMaybe PolTail (rrg) (CONS 'CDR (CDR rrg))) 
(DMaybe PolDecap (rrg) (LIST 'SETQ (CADR rrg) (CONS 'CDR (CDR rrg))))
(DMaybe PutredPriority (rrg) (CONS 'RPLACA (CDR rrg)))
(DMaybe ConcPol (rrg) (CONS 'RPLACD (CDR rrg)))
%(DMaybe PutMpt (rrg) (CONS 'RPLACA (CDR rrg)))
(DMaybe PutMpt (rrg) (LIST 'RPLACA (LIST 'CAR (CADR rrg)) (CADDR rrg)))
(DMaybe PutLc (rrg) (LIST 'RPLACA (LIST 'CAR (CADR rrg)) (CADDR rrg)))
(DMaybe RemoveNextTm (rrg)
    (LIST 'RPLACD (CADR rrg) (CONS 'CDDR (CDR rrg))))
(DMaybe InsertTm (rrg)
    (LIST 'RPLACD
	  (CADR rrg)
	  (LIST 'CONS (CADDR rrg) (LIST 'CDR (CADR rrg)))))
% Added 911224:
(DMaybe Mon!= (rrg) (CONS 'EQ (CDR rrg)))

(DMaybe mkAPol (rrg) (LIST 'CONS 'NIL 'NIL))
(DMaybe PPol!? (rrg) (CONS 'CDR (CDR rrg)))
(DMaybe Pol!? (rrg) (CADR rrg))
(DMaybe APol0!? (rrg) (CONS 'NULL (CDR rrg)))
(DMaybe Pol0!? (rrg) (CONS 'NOT (CDR rrg)))

% Stag macros added 920531:
(DMaybe SubsPri2Subs (rrg) (CONS 'CDR (CDR rrg)))
(DMaybe SubsPri2Pri (rrg) (CONS 'CAAR (CDR rrg)))
(DMaybe Subs!= (rrg) (CONS 'EQ (CDR rrg)))
(DMaybe GetStaggerStuff (rrg) (LIST 'LGET (CONS 'CDAR (CDR rrg)) ''StgStf))
(DMaybe GetMonSubs (rrg) (LIST 'CDADR (CONS 'GetStaggerStuff (CDR rrg))))
(DMaybe Pri!< (rrg) (CONS 'BMI!< (CDR rrg)))
(DMaybe GetMonSubs!-AccPri (rrg) (LIST 'CAR (CONS 'GetStaggerStuff (CDR rrg))))
(DMaybe GetMonPri (rrg) (LIST 'CAR (CONS 'GetMonSubs!-AccPri (CDR rrg))))
(DMaybe Subs!< (rrg) (CONS 'MONLESSP (CDR rrg)))
(DMaybe Subs!-AccPri!<3 (rrg)
    (LIST 'COND
	  (LIST (LIST 'Subs!=
		      (LIST 'Subs!-AccPri2Subs!-Acc (CADR rrg))
		      (CADDR rrg))
		(LIST 'Pri!<
		      (LIST 'Subs!-AccPri2Pri (CADR rrg))
		      (CADDDR rrg)))
	  (LIST T
		(LIST 'Subs!<
		      (LIST 'Subs!-AccPri2Subs!-Acc (CADR rrg))
		      (CADDR rrg)))))
(DMaybe PMon2Subs (rrg) (CADR rrg))
(DMaybe Mon2Subs (rrg) (LIST 'PMon2Subs (CONS 'PMon (CDR rrg))))
(DMaybe Subs!- (rrg) (LIST 'Mon2Subs (CONS 'MONQUOTIENT (CDR rrg))))
(DMaybe Subs!&Mon2Subs!-Acc (rrg)
    (LIST 'Subs!- (CADR rrg) (CONS 'Mon2Subs (CDDR rrg))))
(DMaybe Subs!-AccPri2Subs!-Acc (rrg) (CONS 'CDR (CDR rrg)))
(DMaybe Subs!-AccPri2Pri (rrg) (CONS 'CAR (CDR rrg)))

% Macros:
% NOTE: The input to multiplications should always be logarithms. This
% influences Cf!*, CfLinComb, and CfSemiLinComb, in particular.
% Also, the inputs to Cf!-!- be logarithms.
% However, all outputs be ordinary coefficients.
%  For the checks for correct result sizes, a LET construction should
% be optimal. Here I do something not so good; I assume that EVERY
% time Cf!+ or Cf!-!- is directly or indirectly called, a prog variable Indly
% exists. I'll see if the compiler swallows this!

% Added 91-09-06: Sometimes the semilincomb should be taken with all inputs
% and output on log form. Then the 'logadd1' table method should be
% efficient. Now, I make a less efficient LogCfSemiLinComb variant.

%  The macro explanations note wether or not the coefficients are
% represented on log form. The operations are on the ordinary
% coefficients. Thus,  log*log : cf  signifies: "Perform an operation
% corresponding to a multiplication on inputs on log form (i. e., add
% the logarithms!), and convert the output to ordinary form (i. e.,
% exponentiate it, e. g. by means of an EXPVECT table).

%  Changed GETV to FASTGETV/JoeB 1996-07-01

% cf : log
(DM Cf2Log (acf) (LIST 'FASTGETV 'LOGVECT (CADR acf)) )

% log : cf
(DM Log2Cf (anumb) (LIST 'FASTGETV 'EXPVECT (CADR anumb)) )

% cf+cf : cf
(DM Cf!+ (cfs) (LIST 'COND
		    (LIST (LIST 'BMI!< (GetPredcMod)
				(LIST 'SETQ 'Indly
				      (CONS 'BMI!+ (CDR cfs))))
			  (LIST 'BMI!- 'Indly (GetcMod)))
		    (LIST T 'Indly)))

% log*log : cf
(DM Cf!* (cfs) (LIST 'Log2Cf (CONS 'BMI!+ (CDR cfs))))

% -cf : cf
(DM Cf!- (cfs) (LIST 'BMI!- (GetcMod) (CADR cfs)))

% log-log : cf
(DM Cf!-!- (cfs) (LIST 'COND
		     (LIST (LIST 'BMI!> 0
				 (LIST 'SETQ 'Indly
				       (LIST 'BMI!-
					     (LIST 'Log2Cf (CADR cfs))
					     (LIST 'Log2Cf (CADDR cfs)))))
			   (LIST 'BMI!+ 'Indly (GetcMod)))
		     (LIST T 'Indly)))

% log*log+log*log : cf
(DM CfLinComb (cfs)
    (LIST 'Cf!+ (LIST 'Cf!* (CADR cfs) (CADDR cfs))
	  (CONS 'Cf!* (CDDDR cfs))))

% cf+log*log : cf
(DM CfSemiLinComb (cfs)
    (LIST 'Cf!+ (CADR cfs)
	  (CONS 'Cf!* (CDDR cfs))))

% cf=0 : NIL/T
(DM Cf0!? (cfs) (LIST 'BMI!= (CADR cfs) 0))

% cf=1 : NIL/T
(DM Cf1!? (cfs) (LIST 'BMI!= (CADR cfs) 1))

% log=1 : NIL/T
(DM Log1!? (logs) (LIST 'BMI!= (CADR logs) 0))

% -log : log
(DM Log!- (cfs) (LIST 'Cf2Log (LIST 'Cf!- (CONS 'Log2Cf (CDR cfs)))))

% log*log : log
(DM Log!* (cfs) (LIST 'COND
		    (LIST (LIST 'NOT
				(LIST 'BMI!> (GetPredcMod)
				      (LIST 'SETQ 'Indly
					    (CONS 'BMI!+ (CDR cfs)))))
			  (LIST 'BMI!- 'Indly (GetPredcMod)))
		    (LIST T 'Indly)))

% log+log*log : log . May return NIL ( = log(0) ).
(DM LogSemiLinComb (cfs)
    (LIST 'Cf2Log (LIST 'BMI!+ (LIST 'Log2Cf (CADR cfs))
			(CONS 'Cf!* (CDDR cfs)))))

% log/log : log
(DM Log!/ (cfs)
    (LIST 'COND
	  (LIST (LIST 'BMI!> 0
		      (LIST 'SETQ 'Indly
			    (CONS 'BMI!- (CDR cfs))))
		(LIST 'BMI!+ 'Indly (GetPredcMod)))
	  (LIST T 'Indly)))

% log/log : cf
(DM Cf!/ (cfs)
    (LIST 'Log2Cf (CONS 'Log!/ (CDR cfs))))

% Recall the mnemonics: Pol=polynomial (augmented or not); N=number;
% Mon=monomial (with or without pointer); GCD=greatest common divisor; the
% rest is hopefully self-explanatory. As arguments, augpol/pol or mon/expts
% will tell what kind of Pol or Mon, respectively, is intended.
%  IN THIS VARIANT, "Log" signifies that coefficients be represented by
% their logarithms (with respect to a primitive root of unity).

%%% PARTICULAR LOG-EXP-METHOD MODULO ROUTINES.

% Should be unnecessary, since CfInv is not used here and SHOULD not
% be used elsewhere.

% 1/cf : cf
(DE CfInv (numb)
  (COND ((BMI!= numb 1) 1)
	(T (Log2Cf (BMI!- (GetPredcMod) (Cf2Log numb))))) )

% Transforming ALL coefficients of a polynomial to logarithms, or vice
% versa. (Destructive; combine with DPLISTCOPY if you want to save the
% original.)

%  pol : logpol
(DE Coeffs2Logs (pol)
 (PROG	(AA)
	(SETQ AA pol)
  Ml	(COND (AA
	       (RPLACA (CAR AA) (Cf2Log (CAAR AA)))
	       (SETQ AA (CDR AA))
	       (GO Ml))) ))

%  logpol : pol
(DE Logs2Coeffs (logpol)
 (PROG	(AA)
	(SETQ AA logpol)
  Ml	(COND (AA
	       (RPLACA (CAR AA) (Log2Cf (CAAR AA)))
	       (SETQ AA (CDR AA))
	       (GO Ml))) ))


%   EXPORTED PROCEDURES:

(DE ReducePolStep (augpol polpos purelogpol nimonquot)
 (PROG	()
	(SemiPolLinComb augpol
			polpos
			(PolTail purelogpol)
			(Cf!- (Lc (PolTail polpos)))
			nimonquot) ))


%	Changes augpol. Returns.

(DE SubtractRedand1 (augpol place logpol)
 (SemiSimpPolLinComb place (PolTail logpol) (Cf!- (Lc (PolTail place)))) )


%	Changes augpol. Returns.

(DE SubtractRedor1 (auglogpol place logpol)
 (LogSemiSimpPolLinComb place (PolTail logpol) (Log!- (Lc (PolTail place)))) )


(DE RedorMonMult (auglogpol nimonquot)
 (PROG	(RT)
	(ConcPolMonMult (SETQ RT (mkAPol)) (PPol auglogpol) nimonquot)
	(RETURN RT) ))


(COPYD 'PreenRedand 'NILNOOPFCN1)

(COPYD 'PreenRedor 'NILNOOPFCN1)


%	pol : logpol

(DE Redand2Redor (pol)
    (COND ((Pol0!? (PolTail pol))
	   (PutLc pol 0))
	  ((BMI!= (Lc pol) 1)
	   (Coeffs2Logs pol))
	  ((PROG (AA BB Indly)
		 (SETQ AA (Cf2Log (Lc pol)))
		 (PutLc pol 0)
		 (SETQ BB (PolTail pol))
	     Ml	 (COND ((BMI!< (SETQ Indly (BMI!- (Cf2Log (Lc BB))
						  AA))
			       0)
			(PutLc BB (BMI!+ (GetPredcMod) Indly)))
		       ((PutLc BB Indly)))
		 (COND ((PolDecap BB)
			(GO Ml))) ))) )


%	logpol : pol

(DE DestructRedor2Redand (redor) (Logs2Coeffs (PPol redor)))


(DE InCoeff2RedandCoeff (numb)
 (PROG	(RT)
	(COND ((Cf0!? (SETQ RT (REMAINDER numb (GetcMod))))
	       (RETURN NIL))
	      ((LESSP RT 0)
	       (RETURN (BMI!+ (GetcMod) RT))))
	(RETURN RT) ))
	      

(COPYD 'RedandCoeff2OutCoeff 'IBIDNOOPFCN)

(DE RedorCoeff2OutCoeff (log) (Log2Cf log))

(COPYD 'RedorCoeff2RedandCoeff 'RedorCoeff2OutCoeff)

(DE RedandCoeff1!? (cf) (Cf1!? cf))

(DE RedorCoeff1!? (log) (Log1!? log))


% POLYNOMIAL ARITHMETICS ROUTINES. Most of them physically changes one
% argument. Some of them have rather arbitrary outputs, which should not
% be used! "Returns." below is short for "Returns what the mnemonic name
% indicates." No return indication = undefined output.



%	The 'ConcPol' procedures all start return at the end
%	of an ordinary or logform polynomial, but use a logpol and
%	possibly a lognumber as source for the concatenation.

%	Changes returnstart by concatenating.
%	Appends logpol*mon to pol.

(DE ConcPolMonMult (returnstart logpol pmon)
 (PROG	(AA BB)
	(SETQ AA logpol)
	(SETQ BB returnstart)
  Ml	(ConcPol BB (Cf!&Mon2Pol (Log2Cf (Lc AA))
				 (MonTimes (Lpmon AA) pmon)))
	(COND ((PolDecap AA)
	       (PolDecap BB)
	       (GO Ml)))
 ))


%	Changes returnstart by concatenating.
%	Appends logpol*lognumb to pol.
%	USES THE STRUCTURE OF A logpol AS AN alist!?

(DE ConcPolNMult (returnstart logpol lognumb)
 (PROG	(AA BB Indly)
	(COND ((Log1!? lognumb)
	       (ConcPol returnstart (DPLISTCOPY logpol))
	       (Logs2Coeffs (CDR returnstart))
	       (RETURN NIL)))
	(SETQ AA logpol)
	(SETQ BB returnstart)
  Ml	(ConcPol BB (Cf!&Mon2Pol (Cf!* (Lc AA) lognumb) (Lm AA)))
	(COND ((PolDecap AA)
	       (PolDecap BB)
	       (GO Ml)))
 ))

%	Changes returnstart by concatenating.
%	Appends logpol*lognumb*mon to logpol.

(DE LogConcPolNMult (returnstart logpol lognumb)
 (PROG	(AA BB Indly)
	(COND ((Log1!? lognumb)
	       (ConcPol returnstart (DPLISTCOPY logpol))
	       (RETURN NIL)))
	(SETQ AA logpol)
	(SETQ BB returnstart)
  Ml	(ConcPol BB (Cf!&Mon2Pol (Log!* (Lc AA) lognumb) (Lm AA)))
	(COND ((PolDecap AA)
	       (PolDecap BB)
	       (GO Ml)))
 ))


%	Changes returnstart by concatenating.
%	Appends -logpol*mon to pol.

(DE ConcPolMonMult!- (returnstart logpol pmon)
 (PROG	(AA BB)
	(SETQ AA logpol)
	(SETQ BB returnstart)
  Ml	(ConcPol BB (Cf!&Mon2Pol (Cf!- (Log2Cf (Lc AA)))
				 (MonTimes (Lpmon AA) pmon)))
	(COND ((PolDecap AA)
	       (PolDecap BB)
	       (GO Ml)))
 ))


%	Changes returnstart by concatenating.
%	Appends logpol*lognumb*mon to pol.

(DE ConcPolNMonMult (returnstart logpol lognumb pmon)
 (PROG	(AA BB Indly)
	(COND ((Log1!? lognumb)
	       (RETURN (ConcPolMonMult returnstart
				       logpol
				       pmon))))
	(SETQ AA logpol)
	(SETQ BB returnstart)
  Ml	(ConcPol BB
		(Cf!&Mon2Pol (Cf!* (Lc AA) lognumb)
			     (MonTimes (Lpmon AA) pmon)))
	(COND ((PolDecap AA)
	       (PolDecap BB)
	       (GO Ml)))
 ))


%	Changes augpol by replacing Cdr(augpol) (effectively) by
%	Cdr(augpol) + pol*numb*pmon. Cadr(place) is removed.
%	Augpol remains an ordinary redand.

(DE SemiPolLinComb (augpol place logpol numb pmon)
 (PROG	(AA BB CC DD ee Indly FF)
	(RemoveNextTm place)
	(SETQ AA place)
	(SETQ BB logpol)
	(SETQ FF (Cf2Log numb))
	(GO Ml)
  Bgap	(PolDecap AA)
	(COND ((Pol0? (PolTail AA))
	       (ConcPol AA (Cf!&Mon2Pol (Cf* (Lc BB) FF) CC))
	       (RETURN (COND ((PolTail BB)
			      (ConcPolNMonMult (PolTail AA)
					       (PolTail BB)
					       FF
					       pmon)))))
	      ((Mon!= CC (Lm (PolTail AA)))
	       (COND ((Cf0!? (SETQ DD (CfSemiLinComb (Lc (PolTail AA))
						     (Lc BB) FF)))
		      (RemoveNextTm AA))
		     (T
		      (PolDecap AA)
		      (PutLc AA DD)))
	       (PolDecap BB)
	       (GO Ml))
	      ((MONLESSP ee (Lpmon (PolTail AA)))
	       (GO Bgap)))
	(InsertTm AA (Cf!&Mon2Tm (Cf* (Lc BB) FF) CC))
	(PolDecap AA)
	(PolDecap BB)
  Ml	(COND ((AND (PolTail AA) BB)
	       (COND ((Mon!= (SETQ CC (MonTimes (Lpmon BB) pmon))
			  (Lm (PolTail AA)))
		      (COND ((Cf0!? (SETQ DD
					  (CfSemiLinComb (Lc (PolTail
							      AA))
							 (Lc BB)
							 FF)))
			     (RemoveNextTm AA))
			    (T
			     (PolDecap AA)
			     (PutLc AA DD)))
		      (PolDecap BB)
		      (GO Ml))
		     ((MONLESSP (Lpmon (PolTail AA)) (SETQ ee (PMon CC)))
		      (InsertTm AA (Cf!&Mon2Tm (Cf* (Lc BB) FF) CC))
		      (PolDecap AA)
		      (PolDecap BB)
		      (GO Ml))
		     (T (GO Bgap))))
	      (BB
	       (ConcPolNMonMult AA BB FF pmon)))
 ))

%	Does NOT change its inputs, but forms the (ordinary)
%	polynomial logpol1*expt1 - logpol2*expt2. (Used by FormSPol.)
%	Returns!
%	Prog variables: logpol1place, logpol2place, new mon*pmon2,
%	new mon*pmon1, pmon of CC, Formed pol place,
%	ReTurn (the newformed pol), Incidentally saved.

(DE FormDoubleSemiPolLinComb (logpol1 logpol2 pmon1 pmon2)
 (PROG	(AA BB CC DD ee FF RT Indly)
	(SETQ FF (SETQ RT (mkAPol)))
	(SETQ AA logpol1)
	(SETQ BB logpol2)
	(GO Ml)
  Ml	(COND ((AND AA BB)
	       (COND ((Mon!= (SETQ DD (MonTimes (Lpmon AA) pmon1))
			  (SETQ CC (MonTimes (Lpmon BB) pmon2)))
		      (COND ((NOT (BMI!= (Lc AA) (Lc BB)))
			     (ConcPol FF
				      (Cf!&Mon2Pol (Cf!-!- (Lc AA) (Lc BB))
						   CC))
			     (PolDecap FF)))
		      (PolDecap AA)
		      (PolDecap BB)
		      (GO Ml))
		     ((MONLESSP (PMon DD) (SETQ ee (PMon CC)))
		      (ConcPol FF (Cf!&Mon2Pol (Cf!- (Log2Cf (Lc BB))) CC))
		      (PolDecap FF)
		      (PolDecap BB)
		      (GO Ml))
		     (T
		      (ConcPol FF (Cf!&Mon2Pol (Log2Cf (Lc AA)) DD))
		      (PolDecap FF)
		      (PolDecap AA)
		      (GO Ml))))
	      (BB
	       (ConcPolMonMult!- FF BB pmon2))
	      (AA
	       (ConcPolMonMult FF AA pmon1)))
  (RETURN (COND ((PPol!? RT) RT)))
 ))

%	Changes augpol by replacing Cdr(augpol) (effectively) by
%	Cdr(augpol) + logpol*numb2. Cadr(place) is removed.

(DE SemiSimpPolLinComb (place logpol numb2)
 (PROG	(AA BB DD ee Indly CC)
	(RemoveNextTm place)
	(SETQ AA place)
	(SETQ BB logpol)
	(SETQ CC (Cf2Log numb2))
	(GO Ml)
  Bgap	(PolDecap AA)
	(COND ((Pol0!? (PolTail AA)) (RETURN (ConcPolNMult AA BB CC)))
	      ((Mon!= (Lm BB) (Lm (PolTail AA)))
	       (COND ((Cf0!? (SETQ DD (CfSemiLinComb (Lc (PolTail AA))
						     (Lc BB)
						     CC)))
		      (RemoveNextTm AA))
		     (T
		      (PolDecap AA)
		      (PutLc AA DD)))
	       (PolDecap BB)
	       (GO Ml))
	      ((MONLESSP ee (Lpmon (PolTail AA))) (GO Bgap)))
	(InsertTm AA (Cf!&Mon2Tm (Cf!* (Lc BB) CC) (Lm BB)))
	(PolDecap AA)
	(PolDecap BB)
  Ml	(COND ((AND (PolTail AA) BB)
	       (COND ((Mon!= (Lm BB) (Lm (PolTail AA)))
		      (COND ((Cf0!? (SETQ DD
					  (CfSemiLinComb (Lc (PolTail AA))
							 (Lc BB)
							 CC)))
			     (RemoveNextTm AA))
			    (T
			     (PolDecap AA)
			     (PutLc AA DD)))
		      (PolDecap BB)
		      (GO Ml))
		     ((MONLESSP (Lpmon (PolTail AA)) (SETQ ee (Lpmon BB)))
		      (InsertTm AA (Cf!&Mon2Tm (Cf!* (Lc BB) CC)
					       (Lm BB)))
		      (PolDecap AA)
		      (PolDecap BB)
		      (GO Ml))
		     (T (GO Bgap))))
	      (BB
	       (ConcPolNMult AA BB CC)))
  ))

%	auglogpol+logpol*lognumb : auglogpol
(DE LogSemiSimpPolLinComb (place logpol lognumb)
 (PROG	(AA BB DD ee Indly)
	(RemoveNextTm place)
	(SETQ AA place)
	(SETQ BB logpol)
	(GO Ml)
  Bgap	(PolDecap AA)
	(COND ((Pol0!? (PolTail AA))
	       (RETURN (LogConcPolNMult AA BB lognumb)))
	      ((Mon!= (Lm BB) (Lm (PolTail AA)))
	       (COND ((NOT (SETQ DD (LogSemiLinComb (Lc (PolTail AA))
						    (Lc BB)
						    lognumb)))
		      (RemoveNextTm AA))
		     (T
		      (PolDecap AA)
		      (PutLc AA DD)))
	       (PolDecap BB)
	       (GO Ml))
	      ((MONLESSP ee (Lpmon (PolTail AA)))
	       (GO Bgap)))
	(InsertTm AA (Cf!&Mon2Tm (Log!* (Lc BB) lognumb) (Lm BB)))
	(PolDecap AA)
	(PolDecap BB)
  Ml	(COND ((AND (PolTail AA) BB)
	       (COND ((Mon!= (Lm BB) (Lm (PolTail AA)))
		      (COND ((NOT (SETQ DD
					(LogSemiLinComb (Lc (PolTail AA))
							(Lc BB)
							lognumb)))
			     (RemoveNextTm AA))
			    (T
			     (PolDecap AA)
			     (PutLc AA DD)))
		      (PolDecap BB)
		      (GO Ml))
		     ((MONLESSP (Lpmon (PolTail AA)) (SETQ ee (Lpmon BB)))
		      (InsertTm AA (Cf!&Mon2Tm (Log!* (Lc BB) lognumb)
					       (Lm BB)))
		      (PolDecap AA)
		      (PolDecap BB)
		      (GO Ml))
		     (T (GO Bgap))))
	      (BB
	       (LogConcPolNMult AA BB lognumb)))
  ))








(AddTo!&Char0Lists
 NIL
 '(Cf2Log Log2Cf Coeffs2Logs Logs2Coeffs Cf!+ Cf!- Cf!-!- Log!*
	  CfLinComb CfSemiLinComb Cf0!? Cf1!? Log1!? Log!-!/
	  LogSemiLinComb Log!/ CfInv LogConcPolNMult ConcPolMonMult
	  ConcPolMonMult!- ConcPolNMult ConcPolNMonMult
	  SemiPolLinComb
	  FormDoubleSemiPolLinComb VerysimpSemiPolLinComb
	  SemiSimpPolLinComb LogSemiSimpPolLinComb))


(ON REDEFMSG) (ON USERMODE) (ON PWRDS) (ON MSG)

(COND (RUNRDRAISE (ON RAISE)))
