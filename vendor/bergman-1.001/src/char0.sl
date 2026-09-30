%  The characteristic 0 polynomial procedures.

%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%
%% Copyright (C) 1992,1994,1995,1996,1997,1998,2006 Joergen Backelin
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

% TO BE DONE: - Change the names of all non-exported procedures
% by prefixing Char0. Remove them from the AddTo!&Char0Lists call.
%  - Check existence of irredundant dense and sparce procedures.
% Remove them where found. (Candidate: SparseContentChar0SubtractRedor.)
%  - Check that the interface CONSISTENTLY uses NIL for zero
% coefficients. Suspects: Char0ConcPolNMult; Cf0!?.
%  - Bring RESTORECHAR0 here. Move the setting of REDANDCOEFFONE into
% this. Remove irredundant (DenseSparse)Char0 definitions to NOOPS
% or standard procedures by non-standard COPYD's within RESTORECHAR0.
%  - Fix the doubling of procedures to be set at Char0 restoring:
% Now most new procedures are NOT listed in the DomainInit call to
% AddTo!&Char0Lists, nor added else; thus, they should be set at
% initiation, but never be re-set by RESTORECHAR0!!??

% CHANGES:

%  Removed doublings from AddTo!&Char0Lists./JoeB 2006-08-05

%  Corrected Char0InCoeff2RedandCoeff./JoeB 1998-07-14

%  Fixed ReduceLineStep./JoeB 1998-03-24

%  1997-05-22 (about): Brought (re)turning-to-char0 mode changers,
% RESTORECHAR0 and AddTo!&Char0Lists here./JoeB

%  Changed INTEGERISE (so that it returns but doesn't substitute NIL by 0).
%  Added RedandLine2RedorLine and ReduceLineStep./JoeB 1997-03-21

%  Added REDANDCFNEGATIVE and RATCF!-.
%  Changed (Char0)Cf0!? macro to call EQ instead of ZEROP.
%  Incorporated the quotpolynomial procedures.
%  Updated some commentry and moved some procedure definitions, in
% order to get closer to the protocol.
%   Prepended Char0 to Cf0, Cf1, Cf0!?, Cf1!?, Cf!+, Cf!*, Cf!-, Cf!/,
% CfLinComb, CfSemiLinComb, CfNegate, CfNegP.
%  Started correcting and replacing DestructRedandTermPlus by
% DestructQPolTermPlus.
% /JoeB 1997-03-07

%  Corrected SparseContentChar0PreenRedand.
%  Unified content regularity mode changing and moved it to coeff.sl.
%  Improved dense contents in ReducePolStep, adding
% Char0PolPartNMultContent and some further Dense/Sparse splitting.
%  Made SubtractRed(and!or)1 non-returning.  Made Char0NPolGCD return
% non-negatively.  Added CfNegP and CfNegate.
%  REDANDCFDIVIDE --> REDANDCFDIVISION.
% /JoeB 1996-07-04 -- 07-31

%  Added the REDANDCF operations; REDANDCOEFFONE; RedorCoeff2RedandCoeff;
% CFMONREDANDMULT; DestructChangeRedandSign; DestructRedandTermPlus;
% DestructRedandSimpSemiLinComb.  Introduced the NOOPs for copying.
%  Changed DPLISTCOPY to CopyPPol in Char0ConcPolNMult.  pmon-->mquot.
%  Changed Char0PolNMult to Char0DestructRedandCoeffTimes./JoeB 1996-06-27



% 1994-04-30 -- 1994-05-??:

% Created 1994-05-18, from the greater part of the old (0.8 version)
% groebreductions.sl. The changes compared to the 0.8 version:

%    Changed Cf* to Cf!*, Pol0? to Pol0!?, (EQ ... 1) to (Cf1!? ...),
%   ZEROP to Cf0!?, 1 to (Cf1), 0 to (Cf0).
%    The macros would be read from a separate file ????


% Import: MonTimes, MONLESSP, niMonQuotient, FindGroebF,
%	  NOOFSPOLCALCS, !*IMMEDIATEFULLREDUCTION;
%	  GBasis, Modulus.
% Export: Char0 variants of
%	  ReducePolStep, SubtractRedand1, SubtractRedor1, RedorMonMult,
%	  PreenRedand, PreenRedor, Redand2Redor, DestructRedor2Redand,
%	  InCoeff2RedandCoeff, RedandCoeff2OutCoeff, RedorCoeff2OutCoeff,
%	  RedorCoeff2RedandCoeff, RedandCoeff1!?, RedorCoeff1!?,
%	  CFMONREDANDMULT, DestructRedandSimpSemiLinComb,
%	  DestructChangeRedandSign, DestructQPolTermPlus,
%	  Char0SparseContents, Char0DenseContents, Add2!&Char0Lists,
%	  RESTORECHAR0; NOOFNILREDUCTIONS, REDANDCOEFFONE.
% Available: REDANDCF!+, REDANDCF!-, REDANDCF!-!-, REDANDCF!*, REDANDCF!/,
%	     REDANDCFREMAINDER, REDANDCFDIVISION; REDANDCOEFFONE.

(GLOBAL '(GBasis NOOFSPOLCALCS !*IMMEDIATEFULLREDUCTION
	  NOOFNILREDUCTIONS REDANDCOEFFONE !&Char0RedefList!*
	  !&Char0RemdList!*))

% Macros:
(DM Char0Cf0 (cfs) 0)
(DM Char0Cf1 (cfs) 1)
(DM Char0Cf0!? (cfs) (LIST 'EQ (CADR cfs) 0))
% (DM Char0Cf0!? (cfs) (CONS 'ZEROP (CDR cfs)))
(DM Char0Cf1!? (cfs) (LIST 'EQ (CADR cfs) 1))
% (DM Char0Cf!+ (cfs) (CONS 'PLUS2 (CDR cfs)))
(DM Char0Cf!* (cfs) (CONS 'TIMES2 (CDR cfs)))
% (DM Char0Cf!- (cfs) (CONS 'DIFFERENCE (CDR cfs)))
(DM Char0Cf!/ (cfs) (CONS 'QUOTIENT (CDR cfs)))
(DM Char0CfLinComb (cfs)
    (LIST 'PLUS2 (LIST 'TIMES2 (CADR cfs) (CADDR cfs))
	  (LIST 'TIMES2 (CADDDR cfs) (CAR (CDDDDR cfs)))))
(DM Char0CfSemiLinComb (cfs)
    (LIST 'PLUS2 (CADR cfs)
	  (LIST 'TIMES2 (CADDR cfs) (CADDDR cfs))))
(DM Char0CfNegate (cfs) (CONS 'MINUS (CDR cfs)))
(DM Char0CfNegP (cfs) (CONS 'MINUSP (CDR cfs)))

%  A new coefficient handling may be necessary. Let us represent a
% rational number by an integer OR a dotted pair, depending on the
% denominator. NO: THIS IS BAD IN THE SFCf CASE. So we have a new
% category, and it is up to the coefficient domain handler to provide
% adequate procedures.

%  In fact, we should have as few as possible such procedures.

%   Corresponding "internal" char0 macros:

(DM Char0Cfs2RtCf (cfs) (CONS 'CONS (CDR cfs)))
(DM Char0RtCfNum (cfs) (CONS 'CAR (CDR cfs)))
(DM Char0RtCfDen (cfs) (CONS 'CDR (CDR cfs)))
(DM Char0RplacRtCfNum (cfs) (CONS 'RPLACA (CDR cfs)))
(DM Char0RplacRtCfDen (cfs) (CONS 'RPLACD (CDR cfs)))

(DM Char0PolRtCfNum (rrg) (CONS 'CAAR (CDR rrg)))
(DM Char0PolRtCfDen (rrg) (CONS 'CDAR (CDR rrg)))
(DM Char0PutPolRtCfNum (rrg) (LIST 'RPLACA (LIST 'CAR (CADR rrg)) (CADDR rrg)))
(DM Char0PutPolRtCfDen (rrg) (LIST 'RPLACD (LIST 'CAR (CADR rrg)) (CADDR rrg)))
%(DM mkQPol (rrg) (LIST 'NCONS (LIST 'CONS 'REDANDCOEFFONE 'REDANDCOEFFONE)))
(DM Char0Cfs2QPol (rrg) (LIST 'NCONS (CONS 'CONS (CDR rrg))))
(DM Char0Cfs!&Tm2QPol (rrg)
    (LIST 'LIST (LIST 'CONS (CADR rrg) (CADDR rrg)) (CADDDR rrg)))
%(DM Tm2QPol (rrg)
%    (LIST 'LIST (LIST 'CONS 'REDANDCOEFFONE 'REDANDCOEFFONE) (CADR rrg)))



% This is the module for the default coefficient domain, the rational
% numbers. It contains many general polynomial routines. (They are rather
% specialized, since they only are used for reductions.)
% The polynomial routines uses the monomial ones in 'monom' whenever
% necessary.
% The general philosophy (with few exceptions) is to use a tailored routine
% for each purpose. (Recall that this programme is NOT intended as a
% algebraic manipulation programme kernel but as a one-purpose
% programme!) This means that there are several very similar-looking
% arithmetic routines below, which to the effect but not to the time and
% space efficiency might have been replaced by combinations of a couple of
% basic ones.

% Recall the mnemonics: Pol=polynomial (augmented or not); N=number;
% Mon=monomial (with or without pointer); GCD=greatest common divisor;
% the rest is hopefully self-explanatory. As arguments, apol/pol or mon/pmon
% will tell what kind of Pol or Mon, respectively, is intended.
% In the 0.87 version, I try to achieve a consistent separation between
% REDUCTAND polynomials (which are ephemary entities, about to be reduced,
% and destructively changed in the process), and REDUCER polynomials (which
% are used in the reduction, but normally are not changed). Mnemonics:
% Redand, Redor. Each may be augmented or pure, as denoted by prefixing
% A- or P- .
% Recall that polynomial and numerical inputs MUST be non-zero. (Monomials
% are by definition monic; the monomial 1 is allowed. )
% The mnemonic and argument order is "reverse lexicographic: p,n,m", i.e.,
% Polynomial, Number, Monomial.


%  AVAILABLE (AND EXPORTED) COEFFICIENT PROCEDURES

%   NOTE: These should NOT be used, if there is any sensible way to
%	  avoid it. They are much to slow.

(DE Char0REDANDCF!+ (cf1 cf2)
 (PROG	(rt)
	(COND ((NOT (ZEROP (SETQ rt (PLUS2 cf1 cf2))))
	       (RETURN rt))) ))

(DE Char0REDANDCF!- (cf) (Char0CfNegate cf))

(DE Char0REDANDCF!-!- (cf1 cf2)
 (PROG	(rt)
	(COND ((NOT (ZEROP (SETQ rt (DIFFERENCE cf1 cf2))))
	       (RETURN rt))) ))

(DE Char0REDANDCF!* (cf1 cf2) (TIMES2 cf1 cf2))

(DE Char0REDANDCF!/ (cf1 cf2)
 (PROG	(rt)
	(COND ((NOT (ZEROP (SETQ rt (QUOTIENT cf1 cf2))))
	       (RETURN rt))) ))

(DE Char0REDANDCFREMAINDER (cf1 cf2)
 (PROG	(rt)
	(COND ((NOT (ZEROP (SETQ rt (REMAINDER cf1 cf2))))
	       (RETURN rt))) ))

(DE Char0REDANDCFDIVISION (cf1 cf2)
 (PROG	(rt)
	(COND ((ZEROP (CAR (SETQ rt (DIVISION cf1 cf2))))
	       (RPLACA rt NIL)))
	(COND ((ZEROP (CDR rt))
	       (RPLACD rt NIL)))
	(RETURN rt) ))

(DE Char0REDANDCFNEGATIVE (cf) (Char0CfNegP cf))


%  The following procedures should NOT guarantee a reversibility: automatic
% shortening may or may not occur.

(DE Char0REDANDCF2RATCF (coef) (Char0Cfs2RtCf coef (Char0Cf1)))
(COPYD 'Char0REDANDCFS2RATCF 'CONS)
(COPYD 'Char0RATCF2NUMERATOR 'CAR)
(COPYD 'Char0RATCF2DENOMINATOR 'CDR)

(DE Char0RATCF!- (ratcoef)
 (Char0Cfs2RtCf (Char0CfNegate (Char0RtCfNum ratcoef))
		(Char0RtCfDen ratcoef)) )


%  Destructive. Returns.

(DE Char0SHORTENRATCF (ratcoef)
 (PROG	(cc)
	(COND ((NOT (Char0Cf1!? (SETQ cc (GCDN (Char0RtCfNum ratcoef)
					       (Char0RtCfDen ratcoef)))))
	       (Char0RplacRtCfNum ratcoef
				  (Char0Cf!/ (Char0RtCfNum ratcoef) cc))
	       (Char0RplacRtCfDen ratcoef
				  (Char0Cf!/ (Char0RtCfDen ratcoef) cc))))
	(RETURN ratcoef) ))


%  EXPORTED MATRIX LINE OPERATIONS:

% Each (non-NIL) ratcoeff is replaced by a redandcoeff, representing
% some c times the element which the ratcoeff represents, using the
% same c for the whole list. Returns c. Destructive.

%# Char0INTEGERISE(LRatCoeff) : -
(DE Char0INTEGERISE (lratcf)
 (PROG	(tmp ll ip tp gg) % denominator LCM;input position;temporary;GCD
	(SETQ ll (Char0Cf1))
	(SETQ ip lratcf)
  Fl	(COND (ip
	       (COND ((CAR ip)
		      (SETQ tmp (ABS (Char0RtCfDen (CAR ip))))
		      (COND ((NOT (EQN tmp (SETQ gg (GCDN ll tmp))))
			     (SETQ ll (TIMES2 (QUOTIENT tmp gg) ll))))))
	       (SETQ ip (CDR ip))
	       (GO Fl)))
	(SETQ ip lratcf)
  Sl	(COND (ip
	       (COND ((CAR ip)
		      (RPLACA ip (TIMES2 (QUOTIENT ll (Char0RtCfDen (CAR ip)))
					 (Char0RtCfNum (CAR ip))))))
	       (SETQ ip (CDR ip))
	       (GO Sl)))
	(RETURN ll) ))



(COPYD 'RedandLine2RedorLine 'ONENOOPFCN1)
%%# RedandLine2RedorLine (lgenredandcoeff) : redorcoeff ;
%(DE RedandLine2RedorLine (lredandcf)


%  Meaning of prog variables: First, second line multiplication constant;
% First, second line position; Temporary Coefficient value.

(DE Char0ReduceLineStep (redandl redandlpos redorlpos)
 (PROG	(c1 c2 lp1 lp2 tc)
	(SETQ c1 (CAR (SETQ c2 (Char0CoeffsGCD!:d (CAR redandlpos)
						  (CAR redorlpos)))))
	(SETQ c2 (CDR c2))
	(SETQ lp1 redandl)
  L1	(COND ((NOT (EQ lp1 redandlpos))
	       (COND ((CAR lp1) (RPLACA lp1 (Char0Cf!* (CAR lp1) c1))))
	       (SETQ lp1 (CDR lp1))
	       (GO L1)))
	(SETQ lp2 (CDR redorlpos))
	(RPLACA lp1 NIL)
  L2	(COND ((NOT (SETQ lp1 (CDR lp1)))
	       (RETURN c1))
	      ((NOT (CAR lp2))
	       (COND ((CAR lp1) (RPLACA lp1 (Char0Cf!* (CAR lp1) c1)))))
	      ((NOT (CAR lp1))
	       (RPLACA lp1 (Char0Cf!* (CAR lp2) c2)))
	      ((Char0Cf0!? (SETQ tc (Char0CfLinComb (CAR lp1)
						    c1
						    (CAR lp2)
						    c2)))
	       (RPLACA lp1 NIL))
	      (T
	       (RPLACA lp1 tc)))
	(SETQ lp2 (CDR lp2))
	(GO L2) ))

%	(SETQ i1 i)				% Removed 1997-03-20/JoeB
%        (SETQ nod (GCDN (CAR c) (CAR c1)))
%	(SETQ tm  (QUOTIENT (CAR c) nod))
%	(SETQ tm1 (QUOTIENT (CAR c1) nod))
%	(SETQ c0 (CAR r1))
%  L4_1	(COND ( (LESSP 0 i1)
%		(DECR i1)
%		(COND ( (NEQ (CAR c0) anZERO)
%			(RPLACA c0 (TIMES2 (CAR c0) tm))
%		))
%		(SETQ c0 (CDR c0))
%		(GO L4_1)
%	))
%        (RPLACA c1 anZERO)
%        (SETQ c0 c)
%  L5    (SETQ c1 (CDR c1))
%        (SETQ c0 (CDR c0))
%        (COND ( (NULL c1)
%	(SETQ r1 (CDR r1)) (GO L3) ))
%        (RPLACA c1 (DIFFERENCE  (TIMES2 (CAR c1) tm)
%				(TIMES2 (CAR c0) tm1) ))
%        (GO L5)


%  PROCEDURES COPIED TO EXPORTED ONES
% We get content by factoring out the content of pol (predand or predor):

(DE Char0PolContent!&UnSignLc (pol)
    (COND ((PolTail pol)
	   (Char0PolNQuot pol
		     (COND ((GREATERP (Lc pol) 0) (Char0PolGCD pol))
			   (T (Char0CfNegate (Char0PolGCD pol))))))
	  ((PutLc pol (Char0Cf1)))))

(DE Char0PolContent (pol)
    (COND ((PolTail pol) (PolNQuot pol (PolGCD pol)))
	  ((PutLc pol 1))))


% OTHER EXPORTED PROCEDURES:


% (DE Char0PolNum (qpol) (Char0PolRtCfNum qpol))
(COPYD 'Char0PolNum 'CAAR)


% (DE Char0PolDen (qpol) (Char0PolRtCfDen qpol))
(COPYD 'Char0PolDen 'CDAR)


(DE Char0PutPolNum (qpol coef) (Char0PutPolRtCfNum qpol coef))


(DE Char0PutPolDen (qpol coef) (Char0PutPolRtCfDen qpol coef))


(DE Char0mkQPol () (Char0Cfs2QPol (Char0Cf1) (Char0Cf1)))


(DE Char0Num!&Den2QPol (coef1 coef2) (Char0Cfs2QPol coef1 coef2))


(DE Char0Num!&Den!&Tm2QPol (coef1 coef2 cfmon)
    (Char0Cfs!&Tm2QPol coef1 coef2 cfmon) )


(DE Char0Tm2QPol (cfmon) (Char0Cfs!&Tm2QPol (Char0Cf1) (Char0Cf1) cfmon))


%  A combined converter procedure. Should yield a (RatCf . AugMon) term
% pair, with parts accessible by the ordinary macros for terms.

(DE Char0QPol2LRatTm (qpol)
 (Cf!&Mon2Tm (Char0SHORTENRATCF (CONS (Char0Cf!* (Char0PolRtCfNum qpol)
						 (APol2Lc qpol))
				      (Char0PolRtCfDen qpol)))
	     (QPol2Lm qpol)) )


%	Changes redand. Should be in a direct content and a no direct
%	content variant.

(COPYD 'DenseContentChar0PreenRedand  'NILNOOPFCN1)

(DE SparseContentChar0PreenRedand (augredand)
 (Char0PolContent!&UnSignLc (PPol augredand)) )


%%	Changes redor. Should it be in a direct content and a no
%%	direct content variant?
%
%(COPYD 'DenseContentChar0PreenRedor 'DenseContentChar0PreenRedand)
%
%(COPYD 'SparseContentChar0PreenRedor 'Char0PolContent)

(COPYD 'Char0PreenRedor 'NILNOOPFCN1)


%  Temporary, in order to have no fancy stuff:

(COPYD 'Char0PreenQPol 'IBIDNOOPFCN)


(DE DenseContentChar0ReducePolStep (augredand redandpos pureredor nimonquot)
 (PROG	(aa)
	(SETQ aa (Char0CoeffsGCD!:d (Lc (PolTail redandpos)) (Lc pureredor)))
	(SETQ aa (DenseContentChar0PolLinComb augredand
					      redandpos
					      (PolTail pureredor)
					      (CAR aa)
					      (CDR aa)
					      nimonquot))
	(COND ((PPol!? augredand)
	       (COND ((PolTail (PPol augredand))
		      (Char0PolNQuot (PPol augredand) aa))
		     ((PutLc (PPol augredand) (Char0Cf1))))))
 ))


(DE SparseContentChar0ReducePolStep (augredand redandpos pureredor nimonquot)
 (PROG	(aa)
	(SETQ aa (Char0CoeffsGCD!:d (Lc (PolTail redandpos)) (Lc pureredor)))
	(SparseContentChar0PolLinComb augredand
				      redandpos
				      (PolTail pureredor)
				      (CAR aa)
				      (CDR aa)
				      nimonquot) ))


(DE DenseContentChar0NormalFormStep (qpol qpolpos pureredor nimonquot)
 (PROG	(aa bb cc)
	(SETQ aa (Char0CoeffsGCD!:d (Lc (PolTail qpolpos)) (Lc pureredor)))
	(SETQ bb (DenseContentChar0PolLinComb qpol
					      qpolpos
					      (PolTail pureredor)
					      (CAR aa)
					      (CDR aa)
					      nimonquot))
	(COND ((PPol0!? qpol)
	       (RETURN NIL))
	      ((Pol!? (PolTail (PPol qpol)))
	       (COND ((NOT (Char0Cf1!? bb))
		      (Char0PolNQuot (PPol qpol) bb))))
	      ((Char0CfNegP (APol2Lc qpol))
	       (PutLc (PPol qpol) -1))
	      (T
	       (PutLc (PPol qpol) (Char0Cf1))))
	(COND ((NOT (Char0Cf1!? (SETQ cc (GCDN bb (CAR aa)))))
	       (RPLACA aa (Char0Cf!/ (CAR aa) cc))
	       (SETQ bb (Char0Cf!/ bb cc))))
	(Char0QPolQuotMult qpol bb (CAR aa))
 ))


(DE SparseContentChar0NormalFormStep (qpol qpolpos pureredor nimonquot)
 (PROG	(aa)
	(SETQ aa (Char0CoeffsGCD!:d (Lc (PolTail qpolpos)) (Lc pureredor)))
	(SparseContentChar0PolLinComb qpol
				      qpolpos
				      (PolTail pureredor)
				      (CAR aa)
				      (CDR aa)
				      nimonquot)
	(COND ((PPol!? qpol)
	       (Char0QPolDenMult qpol (CAR aa))))
 ))



%	Changes augredand. Factors out new content.

(DE DenseContentChar0SubtractRedand1 (augredand place pol)
 (PROG	(aa)
	(SETQ aa (Char0CoeffsGCD!:d (Lc (PolTail place)) (Lc pol)))
	(SETQ aa (DenseContentChar0SimpPolLinComb augredand
						  place
						  (PolTail pol)
						  (CAR aa)
						  (CDR aa)))
	(COND ((PPol!? augredand)
	       (COND ((PolTail (PPol augredand))
		      (Char0PolNQuot (PPol augredand) aa))
		     ((PutLc (PPol augredand) (Char0Cf1))))))
 ))

%	Changes augredand.

(DE SparseContentChar0SubtractRedand1 (augredand place pol)
 (PROG	(aa)
	(SETQ aa (Char0CoeffsGCD!:d (Lc (PolTail place)) (Lc pol)))
	(SparseContentChar0SimpPolLinComb augredand
					  place
					  (PolTail pol)
					  (CAR aa)
					  (CDR aa))
 ))


(COPYD 'Char0SubtractRedor1 'DenseContentChar0SubtractRedand1)


%	Changes qpol. Factors out new content.

(DE DenseContentChar0SubtractQPol1 (qpol place pol)
 (PROG	(aa bb cc)
	(SETQ aa (Char0CoeffsGCD!:d (Lc (PolTail place)) (Lc pol)))
	(SETQ bb (DenseContentChar0SimpPolLinComb qpol
						  place
						  (PolTail pol)
						  (CAR aa)
						  (CDR aa)))
	(COND ((PPol0!? qpol)
	       (RETURN NIL))
	      ((Pol!? (PolTail (PPol qpol)))
	       (COND ((NOT (Char0Cf1!? bb))
		      (Char0PolNQuot (PPol qpol) bb))))
	      ((Char0CfNegP (APol2Lc qpol))
	       (PutLc (PPol qpol) -1))
	      (T
	       (PutLc (PPol qpol) (Char0Cf1))))
	(COND ((NOT (Char0Cf1!? (SETQ cc (GCDN bb (CAR aa)))))
	       (RPLACA aa (Char0Cf!/ (CAR aa) cc))
	       (SETQ bb (Char0Cf!/ bb cc))))
	(Char0QPolQuotMult qpol bb (CAR aa))
 ))


%	Changes qpol.

(DE SparseContentChar0SubtractQPol1 (qpol place pol)
 (PROG	(aa)
	(SETQ aa (Char0CoeffsGCD!:d (Lc (PolTail place)) (Lc pol)))
	(SparseContentChar0SimpPolLinComb qpol
					  place
					  (PolTail pol)
					  (CAR aa)
					  (CDR aa))
	(COND ((PPol!? qpol)
	       (Char0QPolDenMult qpol (CAR aa))))
 ))


%	Returns redand := pmon*redor.

(DE Char0RedorMonMult (redor pmon)
 (PROG	(RT)
	(OrdinaryConcPolMonMult (SETQ RT (mkAPol)) (PPol redor) pmon)
	(RETURN RT) ))


(COPYD 'DenseContentChar0Redand2Redor 'NILNOOPFCN1)

(COPYD 'SparseContentChar0Redand2Redor 'Char0PolContent!&UnSignLc)

(COPYD 'Char0DestructRedor2Redand 'NILNOOPFCN1)

% Change 98-07-14: Zero input be represented by NIL/JoeB
(DE Char0InCoeff2RedandCoeff (cf) (COND ((NOT (BMI!= cf 0)) cf)) )

%(COPYD 'Char0InCoeff2RedandCoeff 'IBIDNOOPFCN)

(COPYD 'Char0RedandCoeff2OutCoeff 'IBIDNOOPFCN)

(COPYD 'Char0RedorCoeff2OutCoeff 'IBIDNOOPFCN)

(COPYD 'Char0RedorCoeff2RedandCoeff 'IBIDNOOPFCN)

(DE Char0RedandCoeff1!? (cf) (Char0Cf1!? cf))

(COPYD 'Char0RedorCoeff1!? 'Char0RedandCoeff1!?)


%	EXPORTED FOR ANICK RESOLUTION:


%  Output = coef*pmon*augredand, non-destructively and in this order.
%  Meaning of PROG variables: return value; input polynomial position;
% return position.

(DE Char0CFMONREDANDMULT (coef pmon augredand)
 (PROG	(rt ip rp)
	(SETQ rp (SETQ rt (mkAPol)))
	(SETQ ip (PPol augredand))
  Ml	(ConcPol rp
		 (Cf!&Mon2Pol (Char0Cf!* coef (Lc ip))
			      (MONTIMES2 pmon (Lpmon ip))))
	(COND ((PolDecap ip)
	       (PolDecap rp)
	       (GO Ml)))
	(RETURN rt) ))


%  Returns augredand1 + augredand2 * cf, destroying both input augredands.
%  Meaning of PROG variables: Input position 1 and 2; Temporarily saved
% polynomial tail; New coefficient.

%  TEMPORARY definition 1996-06-23, to get things going:

(DE DenseContentChar0DestructRedandSimpSemiLinComb (augredand1 augredand2
						    redandcf)
 (PROG	(aa)
	(RPLACD augredand1 (CONS NIL (CDR augredand1)))
	(SETQ aa (DenseContentChar0SimpPolLinComb augredand1
						  augredand1
						  (PPol augredand2)
						  1
						  redandcf))
	(COND ((PPol!? augredand1)
	       (COND ((PolTail (PPol augredand1))
		      (Char0PolNQuot (PPol augredand1) aa))
		     ((PutLc (PPol augredand1) (Char0Cf1))))
	       (RETURN  augredand1))) ))
% (PROG	(ip1 ip2 tmp cc)
%	(SETQ ip1 augredand1)
%	(SETQ ip2 (PPol augredand2))
%  Ml	(COND ((Mon!= (Lm ip2) (APol2Lm ip1))
%	       (COND ((Cf!0!? (SETQ cc (Char0CfSemiLinComb (APol2Lc ip1)
%							   (Lc ip2)
%							   redandcf)))
%		      (COND ((Pol0!? (PolTail (RemoveNextTm ip1)))
%			     (ConcPol ip1 (PolTail ip2)))
%			    ((Pol!? (PolDecap ip2))
%			     (GO Ml))))
%		     ((PROGN (PutLc (PolDecap ip1) cc)
%			     (Pol0!? (PolTail (PolDecap ip2))))
%		      ...)))
%	      ((MONLESSP (Lpmon ip2) (APol2Lpmon ip1))
%	       (COND ((Pol0!? (PolTail (PolDecap ip1)))
% WARNING: only works on tail(ip2) (Char0DestructRedandCoeffTimes ip2 redandcf)
%		      (ConcPol ip1 ip2))
%		     (T
%		      (GO Ml))))
%	      ((Pol0!? (SETQ tmp (PolTail ip2)))
%	       (ConcPol ip2 (PolTail ip1))
%	       (RPLACD ip1 ip2)			% No appropriate macro!
%	       (RETURN augredand1))
%	      (T
%	       (RPLACD ip2 (PolTail ip1))
%	       (RPLACD ip1 ip2)
%	       (PolDecap ip1)
%	       (SETQ ip2 tmp)
%	       (GO Ml)))
%	(RETURN (COND ((PPol augredand1) augredand1))) ))


%  TEMPORARY definition 1997-02-25:

(DE SparseContentChar0DestructRedandSimpSemiLinComb (augredand1 augredand2
						    redandcf)
 (PROGN	(RPLACD augredand1 (CONS NIL (CDR augredand1)))
	(SparseContentChar0SimpPolLinComb augredand1
					  augredand1
					  (PPol augredand2)
					  1
					  redandcf)
	(COND ((PPol!? augredand1)
	       augredand1)) ))


%  TEMPORARY definition 1996-07-05, to get things going:

(DE DenseContentChar0DestructQPolSimpSemiLinComb (qpol1 qpol2 ratcoef)
 (PROG	(aa nr dr)
	(RPLACD qpol1 (CONS NIL (CDR qpol1)))
	(SETQ nr (Char0Cf!* (Char0PolRtCfNum qpol2) (Char0RtCfNum ratcoef)))
	(SETQ dr (Char0Cf!* (Char0PolRtCfDen qpol2) (Char0RtCfDen ratcoef)))
	(SETQ aa
	      (DenseContentChar0SimpPolLinComb qpol1
					       qpol1
					       (PPol qpol2)
					       (Char0Cf!* (Char0PolRtCfNum
							   qpol1)
						     dr)
					       (Char0Cf!* (Char0PolRtCfDen
							   qpol1)
						     nr)))
	(COND ((PPol!? qpol1)
	       (Char0PolNQuot (PPol qpol1) aa)
	       (SETQ aa
		     (Char0SHORTENRATCF
			 (Char0Cfs2RtCf aa
					(Char0Cf!* (Char0PolRtCfDen qpol1)
						   dr))))
	       (Char0PutPolRtCfNum qpol1 (Char0RtCfNum aa))
	       (Char0PutPolRtCfDen qpol1 (Char0RtCfDen aa))
	       (RETURN qpol1)))
 ))


%  EVEN WORSE temporary definition 1997-02-25:

(COPYD 'SparseContentChar0DestructQPolSimpSemiLinComb
       'DenseContentChar0DestructQPolSimpSemiLinComb)


%	redand := coef*redand.

(DE Char0DestructRedandCoeffTimes (redand coef)
 (PROG	(AA)
	(COND ((Char0Cf1!? coef) (RETURN T)))
	(SETQ AA (PPol redand))
  Ml	(PutLc AA (Char0Cf!* (Lc AA) coef))
	(COND ((PolDecap AA) (GO Ml)))
 ))


%	redand := ratcoef*redand.

(DE Char0DestructQPolCoeffTimes (qpol ratcoef)
 (COND	((Char0CfNegP (Char0RtCfNum ratcoef))
	 (Char0DestructChangeRedandSign qpol)
	 (Char0QPolQuotMult qpol
			   (Char0CfNegate (Char0RtCfNum ratcoef))
			   (Char0RtCfDen ratcoef)))
	(T
	 (Char0QPolQuotMult qpol
			    (Char0RtCfNum ratcoef)
			    (Char0RtCfDen ratcoef)))) )


%	redand := -redand.

(DE Char0DestructChangeRedandSign (augredand)
 (PROG	(ip)
	(SETQ ip (PPol augredand))
  Ml	(PutLc ip (Char0CfNegate (Lc ip)))
	(COND ((PolDecap ip) (GO Ml)))
	(RETURN augredand)
 ))


%  Replace by ...QPol...; add "last in the list" case.
%(DE DenseContentChar0DestructRedandTermPlus (augredand tm)
% (PROG	(rp mn cc)
%	(SETQ rp augredand)
%	(SETQ mn (Mon tm))
%  Ml	(COND ((Mon!= (APol2Lm rp) mn)
%	       (COND ((Char0Cf0!? (SETQ cc (PLUS2 (APol2Lm rp) (Cf tm))))
%		      (RemoveNextTm rp))
%		     (T
%		      (PutLc (PolTail rp) cc)))
%	       (RETURN (COND ((PPol augredand)
%			      (Char0PolContent augredand)
%			      augredand))))
%	      ((MONLESSP (APol2Lpmon rp) (PMon mn))
%	       (InsertTm rp tm)
%	       (RETURN augredand)))
%	(GO Ml) ))



%  Destructively adds tm to augredand; returns augredand or NIL.
%  Meaning of PROG variables: Return position; (aug)monomial of tm.

%	redand := redand + pmon*redor. NEW; SEEMS UNNECCESSARY??/Joeb940831

%(DE Char0AddPolMonMult (redand redor pmon)
% (PROG	(AA BB)
%	(SETQ AA (PPol redor))
%	(SETQ BB (mkAPol))
%  Ml	(ConcPol BB (Cf!&Mon2Pol (Lc AA) (MonTimes (Lpmon AA) pmon)))
%	(COND ((PolDecap AA) (PolDecap BB) (GO Ml)))
% ))


%	EXPORTED MODE CHANGING PROCEDURES.

%    Called in [DENSE/SPARSE]CONTENTS (in coeff.sl)

(DE Char0DenseContents ()
 (PROGN	(COPYD 'Char0ReducePolStep 'DenseContentChar0ReducePolStep)
	(COPYD 'Char0NormalFormStep 'DenseContentChar0NormalFormStep)
	(COPYD 'Char0SubtractRedand1 'DenseContentChar0SubtractRedand1)
%	(COPYD 'Char0SubtractRedor1 'DenseContentChar0SubtractRedor1)
	(COPYD 'Char0SubtractQPol1 'DenseContentChar0SubtractQPol1)
	(COPYD 'Char0Redand2Redor 'DenseContentChar0Redand2Redor)
	(COPYD 'Char0PreenRedand 'DenseContentChar0PreenRedand)
%	(COPYD 'Char0PreenRedor 'DenseContentChar0PreenRedor)
	(COPYD 'Char0DestructRedandSimpSemiLinComb
	       'DenseContentChar0DestructRedandSimpSemiLinComb)
	(COPYD 'Char0DestructQPolSimpSemiLinComb
	       'DenseContentChar0DestructQPolSimpSemiLinComb)
%	(COPYD 'Char0DestructQPolTermPlus
%	       'DenseContentChar0DestructQPolTermPlus)
	(COND ((OR (NOT Modulus) (EQN Modulus 0))
	       (COPYD 'ReducePolStep 'DenseContentChar0ReducePolStep)
	       (COPYD 'NormalFormStep 'DenseContentChar0NormalFormStep)
	       (COPYD 'SubtractRedand1 'DenseContentChar0SubtractRedand1)
%	       (COPYD 'SubtractRedor1 'DenseContentChar0SubtractRedor1)
	       (COPYD 'SubtractQPol1 'DenseContentChar0SubtractQPol1)
	       (COPYD 'Redand2Redor 'DenseContentChar0Redand2Redor)
	       (COPYD 'PreenRedand 'DenseContentChar0PreenRedand)
%	       (COPYD 'PreenRedor 'DenseContentChar0PreenRedor)
	       (COPYD 'DestructRedandSimpSemiLinComb
		      'DenseContentChar0DestructRedandSimpSemiLinComb)
	       (COPYD 'DestructQPolSimpSemiLinComb
		      'DenseContentChar0DestructQPolSimpSemiLinComb)
%	       (COPYD 'DestructQPolTermPlus
%		      'DenseContentChar0DestructQPolTermPlus)
	       )) ))

(DE Char0SparseContents ()
 (PROGN	(COPYD 'Char0ReducePolStep 'SparseContentChar0ReducePolStep)
	(COPYD 'Char0NormalFormStep 'SparseContentChar0NormalFormStep)
	(COPYD 'Char0SubtractRedand1 'SparseContentChar0SubtractRedand1)
%	(COPYD 'Char0SubtractRedor1 'SparseContentChar0SubtractRedor1)
	(COPYD 'Char0SubtractQPol1 'SparseContentChar0SubtractQPol1)
	(COPYD 'Char0Redand2Redor 'SparseContentChar0Redand2Redor)
	(COPYD 'Char0PreenRedand 'SparseContentChar0PreenRedand)
%	(COPYD 'Char0PreenRedor 'SparseContentChar0PreenRedor)
	(COPYD 'Char0DestructRedandSimpSemiLinComb
	       'SparseContentChar0DestructRedandSimpSemiLinComb)
	(COPYD 'Char0DestructQPolSimpSemiLinComb
	       'SparseContentChar0DestructQPolSimpSemiLinComb)
%	(COPYD 'Char0DestructQPolTermPlus
%	       'SparseContentChar0DestructQPolTermPlus)
	(COND ((OR (NOT Modulus) (EQN Modulus 0))
	       (COPYD 'Char0ReducePolStep 'SparseContentChar0ReducePolStep)
	       (COPYD 'NormalFormStep 'SparseContentChar0NormalFormStep)
	       (COPYD 'SubtractRedand1 'SparseContentChar0SubtractRedand1)
%	       (COPYD 'SubtractRedor1 'SparseContentChar0SubtractRedor1)
	       (COPYD 'SubtractQPol1 'SparseContentChar0SubtractQPol1)
	       (COPYD 'Redand2Redor 'SparseContentChar0Redand2Redor)
	       (COPYD 'PreenRedand 'SparseContentChar0PreenRedand)
%	       (COPYD 'PreenRedor 'SparseContentChar0PreenRedor)
	       (COPYD 'DestructRedandSimpSemiLinComb
		      'SparseContentChar0DestructRedandSimpSemiLinComb)
	       (COPYD 'DestructQPolSimpSemiLinComb
		      'SparseContentChar0DestructQPolSimpSemiLinComb)
%	       (COPYD 'DestructQPolTermPlus
%		      'SparseContentChar0DestructQPolTermPlus)
	       )) ))

% POLYNOMIAL ARITHMETICS ROUTINES. Most of them physically changes one
% argument, the redand. Some of them have rather arbitrary outputs, which
% should not be used! "Returns." below is short for "Returns what the
% mnemonic name indicates." No return indication = undefined output.


%	Changes returnstart by concatenating pol.

(DE Char0ConcPolNMult (returnstart pol coef)
 (PROG	(AA BB)
	(COND ((Char0Cf1!? coef) (ConcPol returnstart (CopyPPol pol))
	       (RETURN NIL)))
	(SETQ AA pol)
	(SETQ BB returnstart)
  Ml	(ConcPol BB (Tm2Pol (Cf!&Mon2Tm (Char0Cf!* (Lc AA) coef) (Lm AA))))
	(COND ((PolDecap AA)
	       (PolDecap BB)
	       (GO Ml)))
 ))


%	Changes redand (before place) by multiplying these addends with coef.

(DE Char0PolPartNMult (redand place coef)
 (PROG	(AA)
	(COND ((Char0Cf1!? coef) (RETURN T)))
	(SETQ AA redand)
  Ml	(PutLc AA (Char0Cf!* (Lc AA) coef))
	(COND ((NOT (EQ (PolDecap AA) place)) (GO Ml)))
 ))


%	Changes redand (before place) by multiplying these addends with coef.
%	Returns new content (before place).

(DE Char0PolPartNMultContent (redand place coef)
 (PROG	(aa bb)
	(SETQ aa redand)
	(SETQ bb (ABS (Lc aa)))
  Ml	(COND ((Char0Cf1!? bb)
	       (Char0PolPartNMult aa place coef)
	       (RETURN coef)))
	(PutLc aa (Char0Cf!* (Lc aa) coef)) % May be performed with coef = 1.
	(COND ((EQ (PolDecap aa) place)
	       (RETURN (Char0Cf!* bb coef))))
	(SETQ bb (GCDN bb (Lc aa)))
	(GO Ml) ))


%	redand := redand/coef.

(DE Char0PolNQuot (redand coef)
 (PROG	(aa)
	(COND ((Char0Cf1!? coef) (RETURN T)))
	(SETQ aa redand)
  Ml	(PutLc aa (Char0Cf!/ (Lc aa) coef))
	(COND ((PolDecap aa) (GO Ml)))
 ))



%	Changes returnstart by concatenating coef*mquot*pol.

(DE Char0ConcPolNMonMult (returnstart pol coef mquot)
 (PROG	(aa BB)
	(COND ((Char0Cf1!? coef)
	       (RETURN (OrdinaryConcPolMonMult returnstart pol mquot))))
	(SETQ aa pol)
	(SETQ BB returnstart)
  Ml	(ConcPol BB
		 (Cf!&Mon2Pol (Char0Cf!* (Lc aa) coef)
			      (MonTimes (Lpmon aa) mquot)))
	(COND ((PolDecap aa)
	       (PolDecap BB)
	       (GO Ml)))
 ))


%	Changes augredand by replacing Cdr(augredand) (effectively) by
%	Cdr(augredand)*coef1 + coef2*mquot*pol2. Cadr(place) is removed.
%	The content of the changed augredand is returned.
%	Meaning of PROG variables: Before augredand position; pol position;
%	mquot*(pol-monomial); new coefficient; pmon of CC.

(DE DenseContentChar0PolLinComb (augredand place pol coef1 coef2 mquot)
 (PROG	(aa bb cc dd ee ff)
	(COND ((NOT (EQ augredand place))
	       (SETQ ff (Char0PolPartNMultContent (PPol augredand)
						  (PolTail place)
						  coef1)))
	      (T
	       (SETQ ff 0)))
	(RemoveNextTm place)
	(SETQ aa place)
	(SETQ bb pol)
	(GO Ml)
  Bgap	(PolDecap aa)
	(PutLc aa (Char0Cf!* (Lc aa) coef1))
	(COND ((NOT (Char0Cf1!? ff))
	       (SETQ ff (GCDN (Lc aa) ff))))
	(COND ((Pol0!? (PolTail aa))
	       (ConcPol aa (Cf!&Mon2Pol (Char0Cf!* (Lc bb) coef2) cc))
	       (COND ((PolTail bb)
		      (Char0ConcPolNMonMult (PolTail aa)
					    (PolTail bb)
					    coef2
					    mquot)))
	       (RETURN (Char0NPolGCD ff (PolTail aa))))
	      ((Mon!= cc (Lm (PolTail aa)))
	       (COND ((Char0Cf0!? (SETQ dd (Char0CfLinComb (Lc (PolTail aa))
							   coef1
							   (Lc bb)
							   coef2)))
		      (RemoveNextTm aa))
		     (T
		      (PolDecap aa)
		      (COND ((NOT (Char0Cf1!? ff)) (SETQ ff (GCDN dd ff))))
		      (PutLc aa dd)))
	       (PolDecap bb)
	       (GO Ml))
	      ((MONLESSP ee (Lpmon (PolTail aa))) (GO Bgap)))
	(InsertTm aa (Cf!&Mon2Tm (Char0Cf!* (Lc bb) coef2) cc))
	(PolDecap aa)
	(COND ((NOT (Char0Cf1!? ff))
	       (SETQ ff (GCDN (Lc aa) ff))))
	(PolDecap bb)
  Ml	(COND ((AND (PolTail aa) bb)
	       (COND ((Mon!= (SETQ cc (MonTimes (Lpmon bb) mquot))
			  (Lm (PolTail aa)))
		      (COND ((Char0Cf0!? (SETQ dd
					       (Char0CfLinComb (Lc (PolTail
								    aa))
							       coef1
							       (Lc bb)
							       coef2)))
			     (RemoveNextTm aa))
			    (T
			     (PolDecap aa)
			     (COND ((NOT (Char0Cf1!? ff))
				    (SETQ ff (GCDN dd ff))))
			     (PutLc aa dd)))
		      (PolDecap bb)
		      (GO Ml))
		     ((MONLESSP (Lpmon (PolTail aa)) (SETQ ee (PMon cc)))
		      (InsertTm aa (Cf!&Mon2Tm (Char0Cf!* (Lc bb) coef2) cc))
		      (PolDecap aa)
		      (COND ((NOT (Char0Cf1!? ff))
			     (SETQ ff (GCDN (Lc aa) ff))))
		      (PolDecap bb)
		      (GO Ml))
		     (T (GO Bgap))))
	      (bb
	       (Char0ConcPolNMonMult aa bb coef2 mquot))
	      ((PolTail aa)
	       (Char0DestructRedandCoeffTimes aa coef1)))
	(RETURN (Char0NPolGCD ff (PolTail aa)))
 ))

%	Changes augredand by replacing Cdr(augredand) (effectively) by
%	Cdr(augredand)*coef1 + coef2*mquot*pol2. Cadr(place) is removed.
%	Meaning of PROG variables: See DenseContentChar0PolLinComb.

(DE SparseContentChar0PolLinComb (augredand place pol coef1 coef2 mquot)
 (PROG	(aa bb cc dd ee)
	(COND ((NOT (EQ augredand place))
	       (Char0PolPartNMult (PPol augredand) (PolTail place) coef1)))
	(RemoveNextTm place)
	(SETQ aa place)
	(SETQ bb pol)
	(GO Ml)
  Bgap	(PolDecap aa)
	(PutLc aa (Char0Cf!* (Lc aa) coef1))
	(COND ((Pol0!? (PolTail aa))
	       (ConcPol aa (Cf!&Mon2Pol (Char0Cf!* (Lc bb) coef2) cc))
	       (RETURN (COND ((PolTail bb)
			      (Char0ConcPolNMonMult (PolTail aa)
					       (PolTail bb)
					       coef2
					       mquot)))))
	      ((Mon!= cc (Lm (PolTail aa)))
	       (COND ((Char0Cf0!? (SETQ dd (Char0CfLinComb (Lc (PolTail aa))
							   coef1
							   (Lc bb)
							   coef2)))
		      (RemoveNextTm aa))
		     (T
		      (PolDecap aa)
		      (PutLc aa dd)))
	       (PolDecap bb)
	       (GO Ml))
	      ((MONLESSP ee (Lpmon (PolTail aa))) (GO Bgap)))
	(InsertTm aa (Cf!&Mon2Tm (Char0Cf!* (Lc bb) coef2) cc))
	(PolDecap aa)
	(PolDecap bb)
  Ml	(COND ((AND (PolTail aa) bb)
	       (COND ((Mon!= (SETQ cc (MonTimes (Lpmon bb) mquot))
			  (Lm (PolTail aa)))
		      (COND ((Char0Cf0!? (SETQ dd
					       (Char0CfLinComb (Lc (PolTail
								    aa))
							       coef1
							       (Lc bb)
							       coef2)))
			     (RemoveNextTm aa))
			    (T
			     (PolDecap aa)
			     (PutLc aa dd)))
		      (PolDecap bb)
		      (GO Ml))
		     ((MONLESSP (Lpmon (PolTail aa)) (SETQ ee (PMon cc)))
		      (InsertTm aa (Cf!&Mon2Tm (Char0Cf!* (Lc bb) coef2) cc))
		      (PolDecap aa)
		      (PolDecap bb)
		      (GO Ml))
		     (T (GO Bgap))))
	      (bb
	       (Char0ConcPolNMonMult aa bb coef2 mquot))
	      ((PolTail aa)
	       (Char0DestructRedandCoeffTimes aa coef1)))
 ))

%	Changes augredand by replacing Cdr(augredand) (effectively) by
%	Cdr(augredand)*coef1 + pol2*coef2. Cadr(place) is removed.
%	The content of the changed augredand is returned.
%	Meaning of PROG variables: See DenseContentChar0PolLinComb.

(DE DenseContentChar0SimpPolLinComb (augredand place pol coef1 coef2)
 (PROG	(aa bb cc dd ee ff)
	(COND ((NOT (EQ augredand place))
	       (SETQ ff (Char0PolPartNMultContent (PPol augredand)
						  (PolTail place)
						  coef1)))
	      (T
	       (SETQ ff 0)))
	(RemoveNextTm place)
	(SETQ aa place)
	(SETQ bb pol)
	(GO Ml)
  Bgap	(PolDecap aa)
	(PutLc aa (Char0Cf!* (Lc aa) coef1))
	(COND ((NOT (Char0Cf1!? ff))
	       (SETQ ff (GCDN (Lc aa) ff))))
	(COND ((Pol0!? (PolTail aa))
	       (Char0ConcPolNMult aa bb coef2)
	       (RETURN (Char0NPolGCD ff (PolTail aa))))
	      ((Mon!= cc (Lm (PolTail aa)))
	       (COND ((Char0Cf0!? (SETQ dd (Char0CfLinComb (Lc (PolTail aa))
							   coef1
							   (Lc bb)
							   coef2)))
		      (RemoveNextTm aa))
		     (T
		      (PolDecap aa)
		      (COND ((NOT (Char0Cf1!? ff)) (SETQ ff (GCDN dd ff))))
		      (PutLc aa dd)))
	       (PolDecap bb)
	       (GO Ml))
	      ((MONLESSP ee (Lpmon (PolTail aa))) (GO Bgap)))
	(InsertTm aa (Cf!&Mon2Tm (Char0Cf!* (Lc bb) coef2) cc))
	(PolDecap aa)
	(COND ((NOT (Char0Cf1!? ff))
	       (SETQ ff (GCDN (Lc aa) ff))))
	(PolDecap bb)
  Ml	(COND ((AND (PolTail aa) bb)
	       (COND ((Mon!= (SETQ cc (Lm bb)) (Lm (PolTail aa)))
		      (COND ((Char0Cf0!? (SETQ dd
					       (Char0CfLinComb (Lc (PolTail
								    aa))
							       coef1
							       (Lc bb)
							       coef2)))
			     (RemoveNextTm aa))
			    (T
			     (PolDecap aa)
			     (COND ((NOT (Char0Cf1!? ff))
				    (SETQ ff (GCDN dd ff))))
			     (PutLc aa dd)))
		      (PolDecap bb)
		      (GO Ml))
		     ((MONLESSP (Lpmon (PolTail aa)) (SETQ ee (PMon cc)))
		      (InsertTm aa (Cf!&Mon2Tm (Char0Cf!* (Lc bb) coef2) cc))
		      (PolDecap aa)
		      (COND ((NOT (Char0Cf1!? ff))
			     (SETQ ff (GCDN (Lc aa) ff))))
		      (PolDecap bb)
		      (GO Ml))
		     (T (GO Bgap))))
	      (bb
	       (Char0ConcPolNMult aa bb coef2))
	      ((PolTail aa)
	       (Char0DestructRedandCoeffTimes aa coef1)))
	(RETURN (Char0NPolGCD ff (PolTail aa)))
 ))

%	Changes augredand by replacing PPol(augredand) (effectively) by
%	coef1*PPol(augredand) + coef2*pol2. Cadr(place) is removed.
%	Meaning of PROG variables: See DenseContentChar0PolLinComb.

(DE SparseContentChar0SimpPolLinComb (augredand place pol coef1 coef2)
 (PROG	(aa bb cc dd ee)
	(COND ((NOT (EQ augredand place))
	       (Char0PolPartNMult (PPol augredand) (PolTail place) coef1)))
	(RemoveNextTm place)
	(SETQ aa place)
	(SETQ bb pol)
	(GO Ml)
  Bgap	(PolDecap aa)
	(PutLc aa (Char0Cf!* (Lc aa) coef1))
	(COND ((Pol0!? (PolTail aa))
	       (RETURN (Char0ConcPolNMult aa bb coef2)))
	      ((Mon!= cc (Lm (PolTail aa)))
	       (COND ((Char0Cf0!? (SETQ dd (Char0CfLinComb (Lc (PolTail aa))
							   coef1
							   (Lc bb)
							   coef2)))
		      (RemoveNextTm aa))
		     (T
		      (PolDecap aa)
		      (PutLc aa dd)))
	       (PolDecap bb)
	       (GO Ml))
	      ((MONLESSP ee (Lpmon (PolTail aa))) (GO Bgap)))
	(InsertTm aa (Cf!&Mon2Tm (Char0Cf!* (Lc bb) coef2) cc))
	(PolDecap aa)
	(PolDecap bb)
  Ml	(COND ((AND (PolTail aa) bb)
	       (COND ((Mon!= (SETQ cc (Lm bb)) (Lm (PolTail aa)))
		      (COND ((Char0Cf0!? (SETQ dd
					       (Char0CfLinComb (Lc (PolTail
								    aa))
							       coef1
							       (Lc bb)
							       coef2)))
			     (RemoveNextTm aa))
			    (T
			     (PolDecap aa)
			     (PutLc aa dd)))
		      (PolDecap bb)
		      (GO Ml))
		     ((MONLESSP (Lpmon (PolTail aa)) (SETQ ee (PMon cc)))
		      (InsertTm aa (Cf!&Mon2Tm (Char0Cf!* (Lc bb) coef2)
					       cc))
		      (PolDecap aa)
		      (PolDecap bb)
		      (GO Ml))
		     (T (GO Bgap))))
	      (bb
	       (Char0ConcPolNMult aa bb coef2))
	      ((PolTail aa)
	       (Char0DestructRedandCoeffTimes aa coef1)))
 ))



%	Quotpolynomial auxiliaries.

%  Multiply PolQuot[qpol] with nr/dr and shorten. nr and dr MUST
% be positive, and Gcd(nr,dr) MUST be 1. Destructive.

(DE Char0QPolQuotMult (qpol nr dr)
 (PROG	(aa bb)
	(SETQ aa (GCDN nr (Char0PolRtCfDen qpol)))
	(SETQ bb (GCDN dr (Char0PolRtCfNum qpol)))
	(Char0PutPolRtCfNum qpol
			    (Char0Cf!* (COND ((Char0Cf1!? bb)
					      (Char0PolRtCfNum qpol))
					     (T
					      (Char0Cf!/ (Char0PolRtCfNum
							  qpol)
							 bb)))
				  (COND ((Char0Cf1!? aa) nr)
					(T (Char0Cf!/ nr aa)))))
	(Char0PutPolRtCfDen qpol
			    (Char0Cf!* (COND ((Char0Cf1!? aa)
					      (Char0PolRtCfDen qpol))
					     (T
					      (Char0Cf!/ (Char0PolRtCfDen
							  qpol)
							 aa)))
				  (COND ((Char0Cf1!? bb) dr)
					(T (Char0Cf!/ dr bb))))) ))

	
%  Multiply PolQuot[qpol] with nr and shorten. nr MUST be positive.
% Destructive.
%  JoeB/1997-02-24: Not used (now), whence I comment it out.

%(DE Char0QPolNumMult (qpol nr)
% (PROG	(aa)
%	(COND ((Char0Cf1!? nr) (RETURN T)))
%	(SETQ aa (GCDN (Char0PolRtCfDen qpol) nr))
%	(COND ((EQN aa (Char0PolRtCfDen qpol))
%	       (Char0PutPolRtCfDen qpol (Char0Cf1)))
%	      ((NOT (Char0Cf1!? aa))
%	       (Char0PutPolRtCfDen qpol (Char0Cf!/ (Char0PolRtCfDen qpol)
%						   aa))))
%	(COND ((NOT (EQN aa nr))
%	       (Char0PutPolRtCfNum qpol (Char0Cf!* (Char0PolRtCfNum qpol)
%						   (Char0Cf!/ nr aa))))) ))
	
%  Divide PolQuot[qpol] by dr and shorten. dr MUST be positive.
% Destructive.

(DE Char0QPolDenMult (qpol dr)
 (PROG	(aa)
	(COND ((Char0Cf1!? dr)
	       (RETURN T)))
	(SETQ aa (GCDN (Char0PolRtCfNum qpol) dr))
	(COND ((EQN aa (Char0PolRtCfNum qpol))
	       (Char0PutPolRtCfNum qpol (Char0Cf1)))
	      ((NOT (Char0Cf1!? aa))
	       (Char0PutPolRtCfNum qpol (Char0Cf!/ (Char0PolRtCfNum qpol)
						   aa))))
	(COND ((NOT (EQN aa dr))
	       (Char0PutPolRtCfDen qpol (Char0Cf!* (Char0PolRtCfDen qpol)
						   (Char0Cf!/ dr aa))))) ))



% COEFFICIENTS; GREATEST COMMON DIVISORS:

%	GCDN is defined as in reduce, for compatibility. This may very well
%	be changed!

(DE GCDN (U V) (COND ((ZEROP V) (ABS U)) ((GCDN V (REMAINDER U V)))))


%	Assumes GCDN to be defined. Returns (-coef2/gcd . coef1/gcd), where
%	gcd=gcd(coef1,coef2). Sign modified to make the Cdr positive.

(DE Char0CoeffsGCD!:d (coef1 coef2)
 (PROG	(AA)
	(SETQ AA (GCDN coef1 coef2))
	(COND ((LESSP coef2 0) (SETQ AA (MINUS AA))))
	(RETURN (CONS (QUOTIENT coef2 AA) (MINUS (QUOTIENT coef1 AA))))
 ))


(DE Char0PolGCD (redand)
 (PROG	(AA bb)
	(SETQ AA (PolTail redand))
	(SETQ bb (ABS (Lc redand)))
  Ml	(COND ((OR (EQ bb 1) (Pol0!? AA))
	       (RETURN bb)))
	(SETQ bb (GCDN bb (Lc AA)))
	(PolDecap AA)
	(GO Ml)
 ))


(DE Char0NPolGCD (coef redand)
 (PROG	(AA BB)
	(SETQ AA redand)
	(SETQ BB (ABS coef))
  Ml	(COND ((OR (EQ BB 1) (Pol0!? AA))
	       (RETURN BB)))
	(SETQ BB (GCDN BB (Lc AA)))
	(PolDecap AA)
	(GO Ml)
 ))


% In order to fix positive signs for the leading coefficients of the
% polynomials in an augmented list.

(DE UNSIGNLC!'S (auglmon)
 (PROG	(AA)
	(SETQ AA (CDR auglmon))
  Ml	(COND (AA 
	       (UNSIGNLC (Mpt (CAR AA)))
	       (SETQ AA (CDR AA))
	       (GO Ml))) ))

(DE UNSIGNLC (augpol)
    (COND ((LESSP (APol2Lc augpol) 0)
	   (Char0DestructRedandCoeffTimes augpol -1)) ))




(DENSECONTENTS)

%% For returning to characteristic zero procedure:
%% (COPYD 'Char0Cf0 'Cf0)
%% (COPYD 'Char0Cf1 'Cf1)
%% (COPYD 'Char0Cf0!? Cf0!?)
%% (COPYD 'Char0Cf1!? 'Cf1!?)
%% (COPYD 'Char0Cf!+ 'Cf!+)
%(COPYD 'Char0Cf!* 'Cf!*)
%% (COPYD 'Char0Cf!- 'Cf!-)
%(COPYD 'Char0Cf!/ 'Cf!/)
%% (COPYD 'Char0CfInv 'CfInv)
%(COPYD 'Char0CfLinComb 'CfLinComb)
%(COPYD 'Char0CfSemiLinComb 'CfSemiLinComb)
%(COPYD 'Char0CfNegP 'CfNegP)
%(COPYD 'Char0CfNegate 'CfNegate)


%  1997-05-22: Collected all (re)turning-to-char0 here.

(DE RESTORECHAR0 ()
 (PROG	(!*REDEFMSG !*USERMODE)
	(SETQ Modulus NIL)
	(SETQ REDANDCOEFFONE 1)
	(MAPC !&Char0RedefList!* (FUNCTION PAIRCOPYD))
	(MAPC !&Char0RemdList!* (FUNCTION REMD)) ))

% Change 19950620: New actions of COMPRESS and EXPLODE, and
% differing in psl and reduce; I hope this patches it./JoeB

(DE AddTo!&Char0Lists (list1 list2)
 (PROGN (COND (list1
	       (PROG (AA)
		     (SETQ AA list1)
		     Ml
		     (COND ((NOT (ASSOC (CAR AA) !&Char0RedefList!*))
			    (SETQ !&Char0RedefList!*
				  (CONS (CONS (CAR AA)
					      (APPENDLCHARTOID
					       (COND ((REDUCE!-SPECIFIC T)
						      '(C !! h !! a !! r !0))
						     (T '(C h a r !0)))
					       (CAR AA)))
					!&Char0RedefList!*))))
		     (COND ((SETQ AA (CDR AA))
			    (GO Ml))))))
	(SETQ !&Char0RemdList!* (UNION list2 !&Char0RemdList!*)) ))

(AddTo!&Char0Lists
      '(% Cf* Cf!/ CfLinComb CfSemiLinComb
	REDANDCF!+ REDANDCF!- REDANDCF!-!- REDANDCF!* REDANDCF!/
	REDANDCFREMAINDER REDANDCFDIVISION REDANDCFNEGATIVE
	RATCF2NUMERATOR RATCF2DENOMINATOR REDANDCF2RATCF
	REDANDCFS2RATCF RATCF!-
	InCoeff2RedandCoeff RedandCoeff2OutCoeff
	RedorCoeff2OutCoeff RedorCoeff2RedandCoeff RedandCoeff1!?
	RedorCoeff1!? SHORTENRATCF INTEGERISE ReduceLineStep PolNum
	PolDen PutPolNum PutPolDen mkQPol Num!&Den2QPol
	Num!&Den!&Tm2QPol Tm2QPol QPol2LRatTm Redand2Redor
	DestructRedor2Redand PreenRedand PreenRedor PreenQPol
	ReducePolStep NormalFormStep SubtractRedand1 SubtractRedor1
	SubtractQPol1 RedorMonMult CFMONREDANDMULT
	DestructRedandSimpSemiLinComb
	DestructQPolSimpSemiLinComb DestructRedandCoeffTimes
	DestructQPolCoeffTimes DestructChangeRedandSign
	% DestructQPolTermPlus
	)
      NIL )

(ON RAISE)

