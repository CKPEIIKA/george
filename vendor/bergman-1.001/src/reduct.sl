%  The reduction procedures, used in the Buchberger algorithm
%  or in alternatives/variants.

%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%
%% Copyright (C) 1992,1994,199,1997,2005,2006 Joergen Backelin
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

%  Split ReducePol and NORMALFORM into stable and instable variants.
%  Added MaybeReduceRedor.  Introduced Reduct[Degree/Item]wise, and
% split FindGroebF into two such variants./JoeB 2006-08-08 -- 17

%  Cleaned up variable declarations in ReducePol and NORMALFORM.
% /JoeB 2005-03-14

%  Improved documentation; added type documentation; added NORMALFORM;
% removed FindGroebF from interface procedure lists/JoeB 1997-02-14

%  Removed spurious (re-)definitions of PreciseniMonQuotient/JoeB 1996-08-06

% CREATED 1994-05-18 from part of the old (version 0.8) groebreductions.sl.
%
% The main changes from the old version are that the polynomial
% (coefficient depending) procedures are moved to a new file polynom.sl,
% and that the renewed reduction procedures are coefficient insensitives.

% Further changes:
%     Changed Cf* to Cf!*, Pol0? to Pol0!?, (EQ ... 1) to (Cf1!? ...),
%    ZEROP to Cf0!?, 1 to (Cf1), 0 to (Cf0).
%     Moved the PreciseniMonQuotient handling to the monomials units.


% Import: Redand2Redor, SubtractcRedor, SubtractRedand1, RedorMonMult,
%	  ReducePolStep, MonTimes, MONLESSP, niMonQuotient,
%	  SubtractQPol1, NormalFormStep, PreenQPol;
%	  GBasis, NOOFSPOLCALCS, !*IMMEDIATEFULLREDUCTION, MONONE.
% Export: ReducePol, FormSPol, MaybeReduceRedor;
%	  NOOFNILREDUCTIONS.
% Available: NORMALFORM.

(GLOBAL '(GBasis rGBasis NOOFSPOLCALCS !*IMMEDIATEFULLREDUCTION
	  NOOFNILREDUCTIONS MONONE))

% This is the module for the reduction routines. It uses a limited number
% of (tailored) polynomial routines, and some monomial ones. It is
% (hopefully) completely independent of coefficient and monomial modes.

% Recall the mnemonics: Pol=polynomial (augmented or not); N=number;
% Mon=monomial (with or without pointer); GCD=greatest common divisor;
% the rest is hopefully self-explanatory. As arguments, apol/pol or mon/pmon
% will tell what kind of Pol or Mon, respectively, is intended.
% Recall that polynomial and numerical inputs MUST be non-zero. (Monomials
% are by definition monic; the monomial 1 is allowed.)
% The mnemonic and argument order is "reverse lexicographic: p,n,m", i.e.,
% Polynomial, Number, Monomial.


% MAIN REDUCTIONS (exported):

%	Changes augredand. Returns.

% Changes its argument to a non-zero constant times the normal form
% of its input (with respect to GBasis). Returns NIL if the normal
% form is zero, its changed argument else.

% Note that the result is ASSOCIATED TO a normal form of the input,
% but NOT necessarily EQUAL TO one.

%  Meanings of PROG variables: Augredand Position, ReDuctor, Monomial
% Pointer (of the present monomial).

%  2006-08-11: THE DECLARATION SEEMS WRONG: Isn't genaugredor returned?
%#  ReducePol (augredand) : genaugredand ; RESET
(DE stableReducePol (augredand)
 (PROG	(ap rd)
	(COND ((APol0!? (SETQ ap augredand))
	       (COND ((NUMBERP NOOFNILREDUCTIONS)
		      (SETQ NOOFNILREDUCTIONS (ADD1 NOOFNILREDUCTIONS))))
	       (RETURN NIL)))
  Ml	(COND ((NOT (Mpt!? (APol2Lm ap)))
	       (PutMpt (APol2Lm ap)
		       (OR (FindGroebF (APol2Lpmon ap)) T))))
	(COND ((EQ (Mpt (APol2Lm ap)) T)
	       (PolDecap ap))
	      ((Mon!= (APol2Lm ap)
		      (Lm (SETQ rd (PPol (Mpt (APol2Lm ap))))))
	       (COND ((OR !*IMMEDIATEFULLREDUCTION (EQ ap augredand))
		      (SubtractRedand1 augredand ap rd))
		     (T (PolDecap ap))))
	      (T
	       (ReducePolStep augredand
		      ap
		      rd
		      (niMonQuotient (APol2Lpmon ap)
				     (Lpmon rd)))))
	(COND ((PolTail ap)
	       (GO Ml))
	      ((PPol!? augredand)
	       (Redand2Redor (PPol augredand))
	       (RETURN augredand))) ))

(DE instableReducePol (augredand)
 (PROG	(ap rd mp)
	(COND ((APol0!? (SETQ ap augredand))
	       (COND ((NUMBERP NOOFNILREDUCTIONS)
		      (SETQ NOOFNILREDUCTIONS (ADD1 NOOFNILREDUCTIONS))))
	       (RETURN NIL)))
  Ml	(COND ((NOT (SETQ mp (Mpt (APol2Lm ap))))
	       (PutMpt (APol2Lm ap)
		       (OR (FindGroebF (APol2Lpmon ap))
			   (NewReductSignature
			    (TOTALDEGREE (APol2Lpmon ap)))))
	       (SETQ mp (Mpt (APol2Lm ap))))
	      ((AND (PAIRP (CAR mp)) (CAAR mp) (BMI!< (CAAR mp) (CADR mp)))
	       (PutMpt (APol2Lm ap)
		       (SETQ mp (MaybeFindGroebF (APol2Lm ap))))))

	% Now, mp is either an augredor, or a reductsignature, telling that
	% right now no reduction is possible. The cases are distinguished,
	% here and above, by employing that here the polhead must be an atom.
	% (PRIN2 " -- Before second COND; mp == ") (PRIN2T mp)
	(COND ((PAIRP (CAR mp))
	       % (PRIN2T " -- (PAIRP (CAR mp)) holds.")
	       (PolDecap ap))
	      ((Mon!= (APol2Lm ap)
		      (Lm (SETQ rd (PPol mp))))
	       (COND ((OR !*IMMEDIATEFULLREDUCTION (EQ ap augredand))
		      (SubtractRedand1 augredand ap rd))
		     (T (PolDecap ap))))
	      (T
	       (ReducePolStep augredand
			      ap
			      rd
			      (niMonQuotient (APol2Lpmon ap)
					     (Lpmon rd)))))
	% (PRIN2T " -- At the end.")
	(COND ((PolTail ap)
	       (GO Ml))
	      ((PPol!? augredand)
	       (Redand2Redor (PPol augredand))
	       (RETURN augredand))) ))

%	Changes qpol. Returns.

% Changes its argument to the normal form of its input (with respect
% to GBasis). Returns NIL if the normal form is zero, its changed
% argument else.

%# NORMALFORM (qpol) : genqpol ; RESET
(DE stableNORMALFORM (qpol)
 (PROG	(ap rd)
	(COND ((APol0!? (SETQ ap qpol))
%	       (COND ((NUMBERP NOOFNILREDUCTIONS)
%		      (SETQ NOOFNILREDUCTIONS (ADD1 NOOFNILREDUCTIONS))))
	       (RETURN NIL))
	      ((Mon!= (QPol2Lm qpol) MONONE)
	       (RETURN qpol)))
  Ml	(COND ((NOT (Mpt!? (APol2Lm ap)))
	       (PutMpt (APol2Lm ap)
		       (OR (FindGroebF (APol2Lpmon ap)) T))))
	(COND ((EQ (Mpt (APol2Lm ap)) T)
	       (PolDecap ap))
	      ((Mon!= (APol2Lm ap)
		      (Lm (SETQ rd (PPol (Mpt (APol2Lm ap))))))
	       (SubtractQPol1 qpol ap rd))
	      (T
	       (NormalFormStep qpol
		      ap
		      rd
		      (niMonQuotient (APol2Lpmon ap)
				     (Lpmon rd)))))
	(COND ((PolTail ap)
	       (GO Ml))
	      ((PPol!? qpol)
	       (RETURN (PreenQPol qpol))))
 ))

(DE instableNORMALFORM (qpol)
 (PROG	(ap rd mp)
	(COND ((APol0!? (SETQ ap qpol))
%	       (COND ((NUMBERP NOOFNILREDUCTIONS)
%		      (SETQ NOOFNILREDUCTIONS (ADD1 NOOFNILREDUCTIONS))))
	       (RETURN NIL))
	      ((Mon!= (QPol2Lm qpol) MONONE)
	       (RETURN qpol)))
  Ml	(COND ((NOT (SETQ mp (Mpt (APol2Lm ap))))
	       (PutMpt (APol2Lm ap)
		       (OR (FindGroebF (APol2Lpmon ap))
			   (NewReductSignature
			    (TOTALDEGREE (APol2Lpmon ap)))))
	       (SETQ mp (Mpt (APol2Lm ap))))
	      ((AND (PAIRP (CAR mp)) (CAAR mp) (BMI!< (CAAR mp) (CADR mp)))
	       (SETQ mp (MaybeFindGroebF (APol2Lm ap)))))
	(COND ((PAIRP (CAR mp))
	       (PolDecap ap))
	      ((Mon!= (APol2Lm ap)
		      (Lm (SETQ rd (PPol (Mpt (APol2Lm ap))))))
	       (SubtractQPol1 qpol ap rd))
	      (T
	       (NormalFormStep qpol
		      ap
		      rd
		      (niMonQuotient (APol2Lpmon ap)
				     (Lpmon rd)))))
	(COND ((PolTail ap)
	       (GO Ml))
	      ((PPol!? qpol)
	       (RETURN (PreenQPol qpol))))
 ))


%  May change augredor. Returns augredor (changed or not).

%  If augredor is not a (known) ambiguity (i.e., always, in the stable case),
% then search its tail for a monomial m divisible by augmon (which should be a
% Gbe, in particular with Mpt(augmon) = a reductor with Lm = augmon).  If found,
% reduce augredor; by a simple subtraction, if m = augmon; else by converting
% augredor to an augredand and doing a full reduction, but starting with the
% found position and reduction.  The result is re-converted to a reductor, and
% returned.  If no divisible term is found, the unchanged augredor is returned.

%  Depends on the implication  (mon1 MONLESSP mon2  ==>  mon2 divides not mon1);
% and on the fact that if !*IMMEDIATEFULLREDUCTION, then all Mon-pointers are
% adequately set.

%#  MaybeReduceRedor (augredor, augmon) : augredor ; DESTRUCTIVE, RESET
(DE stableMaybeReduceRedor (augredor augmon)
 (PROG	(ap rd pm)
	(COND ((NOT (AND !*IMMEDIATEFULLREDUCTION
			 (PolTail (SETQ ap (PPol augredor)))))
	       (RETURN NIL)))
	(SETQ pm (PMon augmon))
  Fl	(COND ((MONLESSP (APol2Lpmon ap pm))
	       (RETURN NIL))
	      ((NOT (EQ (Mpt (APol2Lm ap)) T))
	       (PolDecap ap)
	       (GO Fl))
	      ((Mon!= (APol2Lm ap) augmon)
	       (SubtractRedor1 augredor ap (Mpt augmon))
	       (PutredPriority augredor
			       (CALCREDUCTORPRIORITY (APol2Lm augredor)))
	       (RETURN T))
	      ((NOT (MONFACTORP pm (APol2Lpmon ap)))
	       (PolDecap ap)
	       (GO Fl)))

	% augmon is a non-trivial factor of some term, whence full
	% reduction be resumed from this point on. First, convert
	% the coefficients:
	(DestructRedor2Redand (PPol augredor))
	(ReducePolStep augredor
		       ap
		       (PPol (Mpt augmon))
		       (niMonQuotient (APol2Lpmon ap)
				      pm))

  Ml	(COND ((NOT (PolTail ap))
	       (Redand2Redor (PPol augredor))
	       (PutredPriority augredor
			       (CALCREDUCTORPRIORITY (APol2Lm augredor)))
	       (RETURN T))
	      ((NOT (Mpt!? (APol2Lm ap)))
	       (PutMpt (APol2Lm ap)
		       (OR (FindGroebF (APol2Lpmon ap)) T))))
	(COND ((EQ (Mpt (APol2Lm ap)) T)
	       (PolDecap ap))
	      ((Mon!= (APol2Lm ap)
		      (Lm (SETQ rd (PPol (Mpt (APol2Lm ap))))))
	       (COND ((OR !*IMMEDIATEFULLREDUCTION (EQ ap augredor))
		      (SubtractRedand1 augredor ap rd))
		     (T (PolDecap ap))))
	      (T
	       (ReducePolStep augredor
			      ap
			      rd
			      (niMonQuotient (APol2Lpmon ap)
					     (Lpmon rd)))))
	(GO Ml)
 ))

%  NO reduction, if augmon or another Gbe is found/known to factorise
% the lm of augredor; since then we'll anyhow reduce - and - destroy
% this, hopefully in an efficient manner, when we consider augmon as an
% ambiguity.

%  Meaning of PROG variable: Groebner Basis element Factor(s).

(DE instableMaybeReduceRedor (augredor augmon)
 (PROG	(gbf)
	(COND ((SETQ gbf (ALLMONQUOTIENTS (PMon augmon) (APol2Lpmon augredor)))
	       (LPUT!-LGET (Maplst (APol2Lm augredor)
				   'GbFactors
				   '(CONS (CONS augmon gbf) !_IBID))))
	      ((NOT (GETAUGMONPROP 'GbFactors))
	       (RETURN (stableMaybeReduceRedor augredor augmon))))
	(RETURN augredor) ))
	       

%	Returns.

%# FormSPol (augmon, augmon, augmon, ?) : genaugredand ;
(DE FormSPol (mon1 mon2 mon3 placeno)
 (PROG	(RT)
	(COND ((NUMBERP NOOFSPOLCALCS)
	       (SETQ NOOFSPOLCALCS (ADD1 NOOFSPOLCALCS))))
	(SETQ RT (RedorMonMult (Mpt mon2)
			       (PreciseniMonQuotient (PMon mon1) (PMon mon2) 0)))
	(ReducePolStep RT
		       RT
		       (PPol (Mpt mon3))
		       (PreciseniMonQuotient (PMon mon1) (PMon mon3) placeno))
	(COND ((PPol!? RT)
	       (RETURN RT))) ))


%	Auxiliary. (Or should perhaps still be exported?)

%  Meaning of PROG variable: GBasis Position.

%# FindGroebF (puremon) : genaugredor ; RESET
(DE degFindGroebF (pmon)
 (PROG	(gbp)
	(COND ((NOT (SETQ gbp (CDR GBasis))) (RETURN NIL)))
  Ml	(COND ((MONFACTORP (PMon (CAR gbp)) pmon)
	       (RETURN (Mpt (CAR gbp))))
	      ((SETQ gbp (CDR gbp))
	       (GO Ml))) ))

(DE itemFindGroebF (pmon)
 (PROG	(gbp)
	(COND ((OR (NOT (SETQ gbp (CDR GBasis)))
		   (MONLESSP pmon (PMon (CAR gbp))))
	       (RETURN NIL)))
  Ml	(COND ((MONFACTORP (PMon (CAR gbp)) pmon)
	       (RETURN (Mpt (CAR gbp))))
	      ((SETQ gbp (CDR gbp))
	       (GO Ml))) ))

%  A rather different variant, sometimes used in instable situations:
% Use - and update - the reductsignature (which MUST be the monomial
% pointer of the input), in order to test only the absolutely
% necessary Gbe's as potential factors.  Return either the
% (destructively) updated reduction signature, or - if there is one -
% an augmented reductor.  In either case, the return value also
% is the (if necessary reassigned) value of the pointer of the monomial.

%  This is provbably one of the most time sensitive procedures; and
% therefore the code is rather flat and repetitious.  The loops are
% distinguished by what inputs are known to be empty, and what tests
% are necessary to update input2 (which might never be set).  The
% assumption is, that mostly only the reductor signature must be
% investigated.

%  Meaning of PROG variables: InPut 1 (the input reductsignature);
% InPut 2 (from rGBasis); Present Degree; Total Degree.
% Note, that ip1 but not ip2 may be without items from the beginning.
% In fact, rGBasis should have a Caar (Mpt (mon)) item; since else it
% could not have ben set so.

%# MaybeFindGroebF (augmon) : reductdata ; DESTRUCTIVE
(DE MaybeFindGroebF (mon)
 (PROG	(ip1 ip2 pd td)
	(SETQ pd (CAAR (Mpt mon)))
	(SETQ td (CAR (SETQ ip1 (CDAR (Mpt mon)))))

	% First loop.  pd has its original value; ip2 is not set.
	Ml1
	(COND ((NOT (CDR ip1))
	       (SETQ ip2 (CDR rGBasis))
	       (GO Ml7))
	      ((BMI!< (CADR ip1) pd)
	       (SETQ ip1 (CDR ip1))
	       (GO Ml1))
	      ((NOT (BMI!= (CADR ip1) pd))
	       (SETQ ip2 (CDR rGBasis))
	       (GO Ml6)))

	% Second loop.  pd (and predecessors) are found on ip1,
	% whence still ip2 is not set.
	Ml2
	(SETQ ip1 (CDR ip1))
	Sl2
	(COND ((CDDAR ip1)
	       (COND ((MONFACTORP (PMon (CADR (RPLACD (CAR ip1) (CDDAR ip1))))
				  (PMon mon))
		      (RETURN (PutMpt mon (Mpt (CADAR ip1))))))
	       (GO Sl2))
	      ((NOT (CDR ip1))
	       (COND ((BMI!= (ADD1 pd) td)
		      (RETURN (RPLACA (Mpt mon) (CAR rGBasis)))))
	       (SETQ ip2 (CDR rGBasis))
	       (GO Ml7))
	      ((BMI!= (SETQ pd (CAADR ip1)) (ADD1 (CAAR ip1)))
	       (GO Ml2)))
	(SETQ ip2 (CDR rGBasis))

	% Third loop.  Update ip2; (CDR ip1) exists;  pd == (CAADR ip1).
	% Also, (CAAR ip1) is an existing GBasis degree, and WILL
	% be found on ip2.
	Ml3
	(COND ((NOT (BMI!= (CAAR ip2) (CAAR ip1)))
	       (SETQ ip2 (CDR ip2))
	       (GO Ml3))
	      ((BMI!= (CAAR (SETQ ip2 (CDR ip2))) pd)
	       (GO Ml4)))

	% Subloop.  Degree on ip2 but not (yet) on ip1.  However, higher
	% ip1 items exist; whence no test against td is necessary.
	Sl3
	(SETQ ip1 (CDR (RPLACD ip1 (CONS (LIST (CAAR ip2) (CADAR ip2))
					 (CDDR ip1)))))
	(COND ((MONFACTORP (PMon (CADAR ip1)) (PMon mon))
	       (RETURN (PutMpt mon (Mpt (CADAR ip1))))))
	Sl33
	(COND ((CDDAR ip1)
	       (COND ((MONFACTORP (PMon (CADR (RPLACD (CAR ip1) (CDDAR ip1))))
				  (PMon mon))
		      (RETURN (PutMpt mon (Mpt (CADAR ip1))))))
	       (GO Sl33))
	      ((NOT (BMI!= (CAAR (SETQ ip2 (CDR ip2))) pd))
	       (GO Sl3)))

	% Fourth loop.  pd is found on ip1, and ip2 is set, with
	% pd == (CAAR ip2).
	Ml4
	(SETQ ip1 (CDR ip1))
	Sl4
	(COND ((CDDAR ip1)
	       (COND ((MONFACTORP (PMon (CADR (RPLACD (CAR ip1) (CDDAR ip1))))
				  (PMon mon))
		      (RETURN (PutMpt mon (Mpt (CADAR ip1))))))
	       (GO Sl4))
	      ((NOT (CDR ip1))
	       (COND ((BMI!= (ADD1 pd) td)
		      (RETURN (RPLACA (Mpt mon) (CAR rGBasis)))))
	       (GO Ml8))
	      ((NOT (BMI!= (SETQ pd (CAADR ip1)) (ADD1 (CAAR ip1))))
	       (COND ((NOT (BMI!= (CAAR (SETQ ip2 (CDR ip2))) pd))
		      (GO Sl3))
		     (T
		      (GO Ml4)))))

	% Fifth loop.  pd, and some but not all predecessors, are found on
	% ip1, whence ip2 is set, but lower than pd.
	Ml5
	(SETQ ip1 (CDR ip1))
	Sl5
	(COND ((CDDAR ip1)
	       (COND ((MONFACTORP (PMon (CADR (RPLACD (CAR ip1) (CDDAR ip1))))
				  (PMon mon))
		      (RETURN (PutMpt mon (Mpt (CADAR ip1))))))
	       (GO Sl5))
	      ((NOT (CDR ip1))
	       (COND ((BMI!= (ADD1 pd) td)
		      (RETURN (RPLACA (Mpt mon) (CAR rGBasis)))))
	       (SETQ ip2 (CDR ip2))
	       (GO Ml7))
	      ((BMI!= (SETQ pd (CAADR ip1)) (ADD1 (CAAR ip1)))
	       (GO Ml5)))
	(SETQ ip2 (CDR ip2))
	(GO Ml3)

	% Sixth loop.  ip1 misses original pd, but has higher degrees;
	% ip2 initiated.
	Ml6
	(COND ((BMI!= (CAAR ip2) pd)
	       (SETQ pd (CAADR ip1))
	       (GO Sl3)))
	(SETQ ip2 (CDR ip2))
	(GO Ml6)

	% Seventh loop.  (CDR ip1) == NIL; original pd (not on ip1), OR
	% pd == (CAAR ip1) < td-1; ip2 is set, but not necessarily of
	% degree pd.
	Ml7
	(COND ((NOT (BMI!= (CAAR ip2) pd))
	       (SETQ ip2 (CDR ip2))
	       (GO Ml7)))

	% Eight loop.  As the eigth, but now indeed (CAAR ip2) == pd at
	% first.
	Ml8
	(COND ((NOT (AND (SETQ ip2 (CDR ip2)) (BMI!< (CAAR ip2) td)))
	       (RETURN (RPLACA (Mpt mon) (CAR rGBasis)))))
	(SETQ ip1 (CDR (RPLACD ip1 (NCONS (LIST (CAAR ip2) (CADAR ip2))))))
	(COND ((MONFACTORP (PMon (CADAR ip1)) (PMon mon))
	       (RETURN (PutMpt mon (Mpt (CADAR ip1))))))

	% Subloop.  Degree on ip2 but not (yet) on ip1.  Higher ip1
	% items do not exist; whence test against td may become necessary.
	Sl8
	(COND ((CDDAR ip1)
	       (COND ((MONFACTORP (PMon (CADR (RPLACD (CAR ip1) (CDDAR ip1))))
				  (PMon mon))
		      (RETURN (PutMpt mon (Mpt (CADAR ip1))))))
	       (GO Sl8)))
	(GO Ml8) ))


%  Mode setters.

(DE ReductDegreewise ()
 (PROGN	(COPYD 'FindGroebF 'degFindGroebF) ))

(DE ReductItemwise ()
 (PROGN	(COPYD 'FindGroebF 'itemFindGroebF) ))

(DE ReductStabilise ()
 (PROGN	(COPYD 'ReducePol 'stableReducePol)
	(COPYD 'NORMALFORM 'stableNORMALFORM) ))

(DE ReductDestabilise ()
 (PROGN	(COPYD 'ReducePol 'instableReducePol)
	(COPYD 'NORMALFORM 'instableNORMALFORM) ))

(ON RAISE)
