%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%
%% Copyright (C) 1992,1994,1995,1996,1998,1999,2002,2003,2004,
%% 2005 Joergen Backelin
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


%  Created from old pbseries.sl 1995 -- 1999, by adding commutative
% Hilbert series handling and some Hilbert series limit submode
% auxiliaries, and by making a non-commutative variant out of some
% of the old procedures.

%  Now (1999-11-04) it hopefully incorporates all positive changes
% made the last years in the commutative or the non-commutative
% series handling files, whence now it should be a fully merged
% ring series source file.

%  However, the module series handling still is separate. Moreover,
% mode changes probably are not quite transparent with respect to
% commutativity; and not at all with respect to non-standard weights.
% /JoeB


%	CHANGES (after 1999-11-04):

%  Introduced VarIndex2Weight./JoeB 2007-08-18

%  Introduced IGNORECDEG as synonym of SKIPCDEG./JoeB 2005-07-29

%  Made the TDEGREECALCULATEPBSERIES  call to DEGREEPBSERIESDISPLAY
% depend on GETIMMEDIATEASSOCRINGPBDISPLAY./JoeB 2004-04-24

%  Replaced *NONCOMMUTATIVE by ((Non)CommP)./JoeB 2003-08-25

%  Moved TCONCPTRCLEAR to slext.sl./JoeB 2002-10-14

%  SKIPCDEG --> IGNORECDEG; but added new meaning of SKIPCDEG as
% a Hilbert series limitation strategy alternative.
%  Corrected noncommTDEGREEHSERIESOUT calculation continuation.
%  Started introducing !*PrintSerStep series printing dependence.
%  Added REVERTSERIESCALC and REMLASTSERIESCALC , whereby the
% Hilbert series limitation strategy now should work with the
% ordinary (non-weighted) non-commutative ring mode.

%  Modernising some old pbseries procedures, and starting weights
% handling incorporation:
% - COPY --> DPLISTCOPY in RECEVLIS.
% - Changed the DELTA1 handling. Instead of being stored as an
%  identifier with a function definition, store (DELTA . value),
%  where value (NIL) be returned if the relevant argument (i.e.,
%  mostly tDeg) is 1 (is not 1, respectively). (Should be faster
%  anyhow; and compatible with weights settings.)
%  Thus changed FindNewTor2RMF and RECEVAL.
% - Introduced HSeriesOrdWeights, HSeriesAltWeights
% /JoeB 2002-07-06 -- 2002-07-09

%  commHlbPMon2HlbMon --> commPMon2HlbMon. /JoeB 2002-06-26

%  Moved the dependency of the commMONORDER to modes.sl.  Thus
% commHlbRevlexPMon2HlbMon and commHlbLexPMon2HlbMon are replaced
% by PMon2HlbMon, now imported; and commHlbRevlexInitMonId and
% commHlbLexInitMonId are merged to commHlbInitMonId./JoeB 1999-12-06


%	OLD CHANGES (in some or all of the files pbseries.sl,
%	hseries.sl, and newhseries.sl):

%  Introduced commHlbMonCopy, commHlbMonTail. Corrected the HSDEG
% handling in SETHSERIESMINIMUMDEFAULT./JoeB 1999-11-03

%  Introduced NonCommify and (noncomm)CALCPOLRINGHSERIES (to
% pbseries.sl)./JoeB 1999-11-03

%  Removed the duplicate of the LPUT!-LGET definition (which does
% belong to monom.sl) from pbseries.sl. Introduced
% AlgOutModeSwitch./JoeB 1999-11-01

%  Removed the comm prefix from SETs and GETs of minima (in
% newhseries.sl)./JoeB 1999-11-01

%  CDG --> HSDEG./JoeB 1999-11-01

%  MONP --> Mon!?; introduced Mplst, Maplst (to pbseries.sl).
% /JoeB 1999-10-28

%  BPOUT --> PBOUT./JoeB 1999-10-25

%  GETD --> DEFP./JoeB 1999-07-02

%  Declared more fluids, and made switches PROG variables.
%  Moved up WInsert./JoeB 1999-06-26

%  Removed erroneous argument of GETHSERIESMINIMA/JoeB 1997-06-03

%  Moved LPUT!-LGET to monom.sl/JoeB 1996-10-11


(OFF RAISE)

% Imports: LPUT!-LGET, LGET, MONFACTORP, LeftMonFactorP, CDRADD1,
%	   TOTALDEGREE, MonIntern1, PMon2HlbMon,
%	   GETIMMEDIATEASSOCRINGPBDISPLAY; cDeg, GBasis, cGBasis,
%	   !_IBID, BigNumbFile, GETVARNO.
% Exports: HSeries(Non)Commify, GETHSERIESMINIMUM, GETHSERIESMINIMA,
%	   SETHSERIESMINIMUMDEFAULT, SETHSERIESMINIMA, CLEARHSERIESMINIMA,
%	   DEGREEPBSERIESDISPLAY, PutRecDef, PBINIT, TDEGREEHSERIESOUT,
% 	   TDEGREECALCULATEPBSERIES, REMLASTSERIESCALC, CALCTOLIMIT;
%	   !*IMMEDIATERECDEFINE, !*PBSERIES.
% Available: GBASIS2HSERIESMONID, CALCRATHILBERTSERIES, CALCPOLRINGHSERIES,
%	    VECTPLUS, ALGOUTLIST,
%	   RECEVAL, RECEVLIS, CLEARPBSERIES,
%	   INVERT-FPSERIES-STEP, REVERTSERIESCALC; HDEGVARIABLE,
%	   TDEGVARIABLE, !*NOBIGNUM.

(GLOBAL '(HILBERTNUMERATOR HILBERTDENOMINATOR IGNORECDEG SKIPCDEG
	  HILBERTSERIES SIMPLEPBSERIES DOUBLEPBSERIES !*PBSERIES
	  !*SAVERECVALUES !*IMMEDIATERECDEFINE RIGHTMONFACTORS
	  cRightMonFactors RMFplace cDeg GBasis cGBasis PBOUT AOModes
	  INVHILBERTSERIES InVars OutVars EMBDIM LastDeg !*PrintSerSteps
	  !*NOBIGNUM BigNumbFile commMONORDER))
(FLUID '(HSDEG
	 TotDeg !_IBID HDEGVARIABLE TDEGVARIABLE tDeg OutItem Vars
	  AO!+ AO!- AO!* AO!^ AObop!+ AObop!- AOeop AObol AOeol
	  !_savedvalue !_mon !_item !*EOLINSTRINGOK))

(ON SAVERECVALUES)
(COND ((NOT TDEGVARIABLE) (SETQ TDEGVARIABLE '!t)))
(COND ((NOT HDEGVARIABLE) (SETQ HDEGVARIABLE '!z)))

		%%%%%%%%%%%%%%%%%%%%%%%%%%%
		%%%			%%%
		%%% High and Low Level	%%%
		%%% Conversion		%%%
		%%%			%%%
		%%%%%%%%%%%%%%%%%%%%%%%%%%%


%  Routines for converting a given sequence of augmented monomials into
% the special `FMon' (flagged monomials) form and the ordering used in
% this module. These are highly dependent on the monomial representation,
% monoid order, and strategy modes. They should be non-destructive, and
% completely copy the input information (since the lists and the FMons
% themselves are destroyed in the Hilbert series calculation process).

%  In this first approach, I assume natural grading (all variable degrees
% equal to 1), only ordered (partial or complete) Groebner bases
% (represented as lists of their leading monomials) as input, and either
% lex or revlex order. To be precise, commMONORDER should either be
% TDEGREVLEX, or one of TDEGLEX and PURELEX. We use a fixed strategy for
% finding a `splitting variable', taking the lowest variable in the
% support of the generating set. In the FMon MonId (monomial ideal)
% representations, we maintain the monomials as lists of exponents of
% variables of increasing order, ordered lexicographically descending.
% In this way, the splitting variable always corresponds to the first
% non-zero entry in the first monomial of the MonId.
%  In the TDEGREVLEX case, we assume the input pure monomials to be lists
% of exponents, with the most significant = (the one corresponding to the
% lowest variable) first. Thus we only have to copy these lists to get
% the Mon part of the FMon representation. (If the input were sorted
% purerevlex, the correct MonId order is just the opposit of the input
% one.) In the TDEGLEX and the PURELEX orders alike, the pure monomial
% inputs should be lists of exponents with the highest variable first;
% thus we copy them in reverse orders.
%  In any case, we are forced to make a complete new sorting of the
% resulting list of FMons.

%  The Flag part of the FMon is initiated to NIL, and the FMon is stored
% as a dotted pair (Flag . Mon).


%  Main initialiser (available). Inputs the presently saved (partial)
% Groebner basis. Returns a MonId, as specified above.

%# commGBASIS2HSERIESMONID () : - ;
(DE commGBASIS2HSERIESMONID ()
  (COND	((CDR GBasis)
	 (commHlbInitMonId))) )


%%# commHlbRevlexPMon2HlbMon (revlexpuremon) : hsmon ;
%(COPYD 'commHlbRevlexPMon2HlbMon 'COPY)
%
%
%%# commHlbLexPMon2HlbMon (lexpuremon) : hsmon ;
%(COPYD 'commHlbLexPMon2HlbMon 'REVERSE)


% PROG variables: Return value; input, output monomial list positions;
%		  New Monomial

%# commHlbInitMonId () : hsmonid ;
(DE commHlbInitMonId ()
 (PROG	(rt mp1 mp2 nm)
	(SETQ mp1 (CDR GBasis))
	(SETQ rt (NCONS NIL))

	% First loop: Copy-convert each Gbe to a (pure) Hseries
	% monomial, and sort it into position in rt.
  Ml1	(SETQ nm (commPMon2HlbMon (PMon (CAR mp1))))
	(SETQ mp2 rt)
  Sl	(COND ((NULL (CDR mp2))
	       (RPLACD mp2 (NCONS nm)))
	      ((commHlbMonGreaterP (CADR mp2) nm)
	       (SETQ mp2 (CDR mp2))
	       (GO Sl))
	      (T
	       (RPLACD mp2 (CONS nm (CDR mp2)))))
	(COND ((SETQ mp1 (CDR mp1))
	       (GO Ml1)))

	% Second loop: Insert flags into the rt items.
	(SETQ mp1 (CDR rt))
  Ml2	(RPLACA mp1 (commHlbFlag!&Mon2FMon NIL (CAR mp1)))
	(COND ((SETQ mp1 (CDR mp1))
	       (GO Ml2)))

	(RETURN (CDR rt)) ))


		%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%
		%%%				%%%
		%%% Low Level Polynomial	%%%
		%%% Representation		%%%
		%%%				%%%
		%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%

%  We work with Hilbert series represented by NumDenDeg's, presently
% represented as dotted pairs (dendeg . num), where num is the
% numerator and where the denominator is (1-t)^dendeg.
%  In a numerator, the term (summands) are represented as dotted
% pairs (coeff . t-degree).


%  In order to be able to add and subtract numerators, we might have to be
% able to prolong them (with (1-t)^ddeg).
%  ddeg MUST be a non-negative integer; num MUST be non-empty.

% PROG variables: Return value; Denominator degree; Numerator position;
%		  Memorised numbers 1, 2; Homological degree.

%# commHlbProlongNum (hsnum, hsdendeg) : hsnum ;
(DE commHlbProlongNum (num ddeg)
 (PROG	(rt Dd Np Mn1 Mn2)
	(SETQ Dd ddeg)
	(SETQ rt (commHlbCopyNum num))
  Ml	(COND ((ZEROP Dd)
	       (commHlbPreenZeroes rt)
	       (RETURN rt)))
	(SETQ Dd (SUB1 Dd))
	(SETQ Np rt)
  Sl	(COND ((commHlbNum0!? (commHlbNumTail Np))
	       (commHlbNumTermAppend
		   Np
		   (commHlbCoeff!&Deg2Term (MINUS (commHlbNum2FirstCoeff Np))
					   (ADD1 (commHlbNum2FirstDeg Np))))
	       (GO Ml))
	      ((EQN (commHlbNum2SecondDeg Np) (ADD1 (commHlbNum2FirstDeg Np)))
	       (SETQ Mn1 (commHlbNum2FirstCoeff Np))
	       (SETQ Np (commHlbNumTail Np))
	       (GO Tl)))
	(commHlbNumTermInsert
	    Np
	    (commHlbCoeff!&Deg2Term (MINUS (commHlbNum2FirstCoeff Np))
				    (ADD1 (commHlbNum2FirstDeg Np))))
	(SETQ Np (commHlbNumTail (commHlbNumTail Np)))
	(GO Sl)
  Tl	(SETQ Mn2 (commHlbNum2FirstCoeff Np))
	(commHlbRplacCoeff (commHlbFirstTerm Np) (DIFFERENCE Mn2 Mn1))
	(COND ((commHlbNum0!? (commHlbNumTail Np))
	       (commHlbNumTermAppend
		   Np
		   (commHlbCoeff!&Deg2Term (MINUS Mn2)
					   (ADD1 (commHlbNum2FirstDeg Np))))
	       (GO Ml))
	      ((NOT (EQN (commHlbNum2SecondDeg Np)
			 (ADD1 (commHlbNum2FirstDeg Np))))
	       (commHlbNumTermInsert
		   Np
		   (commHlbCoeff!&Deg2Term (MINUS Mn2)
					   (ADD1 (commHlbNum2FirstDeg Np))))
	       (SETQ Np (commHlbNumTail (commHlbNumTail Np)))
	       (GO Sl)))
	(SETQ Mn1 Mn2)
	(SETQ Np (commHlbNumTail Np))
	(GO Tl) ))


%  Destructively remove zero coefficient terms from a numerator (assuming
% first term non-zero). Should perhaps be done automatically.

%# commHlbPreenZeroes (hsnum) : - ; DESTRUCTIVE
(DE commHlbPreenZeroes (num)
 (PROG	(Np)
	(SETQ Np num)
  Ml	(COND ((commHlbNum0!? (commHlbNumTail Np))
	       (RETURN NIL))
	      ((ZEROP (commHlbNum2SecondCoeff Np))
	       (commHlbNumTermRemove Np))
	      (T
	       (SETQ Np (commHlbNumTail Np))))
	(GO Ml) ))


%  Is (1-t) a factor in a numerator?

%# commHlb!1!-tFactorP (hsnum) : bool ;
(DE commHlb!1!-tFactorP (num)
 (PROG 	(Np Mn)
	(SETQ Np num)
	(SETQ Mn (commHlbNum2FirstCoeff Np))
  Ml	(COND ((SETQ Np (commHlbNumTail Np))
	       (SETQ Mn (PLUS2 (commHlbNum2FirstCoeff Np) Mn))
	       (GO Ml)))
	(RETURN (ZEROP Mn)) ))


%  Factor out the maximal (1-t) power factor (non-destructively).
% Return (quotient . power of (1-t)).

%# commHlbShortenNum (hsnum) : hssplitnum ; 
(DE commHlbShortenNum (num)
 (PROG	(rt dd)
	(SETQ dd 0)
	(SETQ rt (commHlbCopyNum num))
  Ml	(COND ((NOT (commHlb!1!-tFactorP rt))
	       (RETURN (commHlbNum!&DenDeg2SplitNum rt dd))))
	(SETQ dd (ADD1 dd))
	(commHlbNumQuotient!1!-t rt)
	(GO Ml) ))


%  Factor out (1-t) destructively. Fails ungracefully if (1-t) is
% not a factor of num, or if num contains zero coefficients.

%# commHlbNumQuotient!1!-t (hsnum) : - ; DESTRUCTIVE
(DE commHlbNumQuotient!1!-t (num)
 (PROG	(Np Mn Hd)
	(SETQ Np num)
  Ml	(SETQ Mn (commHlbNum2FirstCoeff Np))
	(SETQ Hd (commHlbNum2FirstDeg Np))
  Sl	(COND ((EQN (commHlbNum2SecondDeg Np) (SETQ Hd (ADD1 Hd)))
	       (COND ((commHlbNum0!? (commHlbNumTail (commHlbNumTail Np)))
		      (commHlbNumRplacTail Np NIL)
		      (RETURN NIL))
		     ((ZEROP (SETQ Mn (PLUS2 (commHlbNum2SecondCoeff Np) Mn)))
		      (commHlbNumTermRemove Np)
		      (COND ((commHlbNum0!? (SETQ Np (commHlbNumTail Np)))
			     (RETURN NIL)))
		      (GO Ml)))
	       (SETQ Np (commHlbNumTail Np))
	       (commHlbRplacCoeff (commHlbFirstTerm Np) Mn)
	       (GO Sl)))
	(commHlbNumTermInsert Np (commHlbCoeff!&Deg2Term Mn Hd))
	(SETQ Np (commHlbNumTail Np))
	(GO Sl) ))


%  Add destructively term to num. The t-power in term must be
% strictly higher than the initial one in num.

% PROG variables: Num position; New num coefficient.

%# commHlbNumPlusTerm (hsnum, hsterm) : hsnum ; DESTRUCTIVE
(DE commHlbNumPlusTerm (num term)
 (PROG	(np cf)
	(SETQ np num)
  Ml	(COND ((commHlbNum0!? (commHlbNumTail np))
	       (commHlbNumTermAppend np term))
	      ((BMI!= (commHlbNum2SecondDeg np) (commHlbDeg term))
	       (COND ((ZEROP (SETQ cf (PLUS2 (commHlbNum2SecondCoeff np)
					     (commHlbCoeff term))))
		      (commHlbNumTermRemove np))
		     (T
		      (commHlbRplacCoeff (commHlbSecondTerm np) cf))))
	      ((BMI!< (commHlbNum2SecondDeg np) (commHlbDeg term))
	       (SETQ np (commHlbNumTail np))
	       (GO Ml))
	      (T
	       (commHlbNumTermInsert np term))) ))


%  Add num2 to num1, destroying both arguments. It is assumed that
% the least num2 degree is not less than the least num1 degree, and
% that (the coefficient at) the former doesn't cancel the latter.

%  CHECK: Could it be replaced by e.g. VECTPLUS? YES, or
% by VectPlus2; but these are non-destructive and presumably
% less efficient. HMMM ... I won't use this for a while.

%# commHlbNumAdd0 (hsnum, hsnum) : - ; DESTRUCTIVE
(DE commHlbNumAdd0 (num1 num2)
 (PROG	(np1 np2 np3)
	(COND ((EQ (commHlbNum2FirstDeg (SETQ np1 num1))
		   (commHlbNum2FirstDeg (SETQ np2 num2)))
	       (commHlbRplacCoeff (commHlbFirstTerm np1)
				  (PLUS2 (commHlbNum2FirstCoeff np1)
					 (commHlbNum2FirstCoeff np2)))
	       (COND ((commHlbNum0!? (SETQ np2 (commHlbNumTail np2)))
		      (RETURN NIL)))))
  Ml	(COND ((commHlbNum0!? (commHlbNumTail np1))
	       (commHlbNumRplacTail np1 np2))
	      ((EQ (commHlbNum2SecondDeg np1) (commHlbNum2FirstDeg np2))
	       (COND ((ZEROP (commHlbCoeff
			        (commHlbRplacCoeff
				   (commHlbSecondTerm np1)
				   (PLUS2 (commHlbNum2SecondCoeff np1)
					  (commHlbNum2FirstCoeff np2)))))
		      (commHlbNumTermRemove np1))
		     (T
		      (SETQ np1 (commHlbNumTail np1))))
	       (COND ((SETQ np2 (commHlbNumTail np2))
		      (GO Ml))))
	      ((LESSP (commHlbNum2SecondDeg np1) (commHlbNum2FirstDeg np2))
	       (SETQ np1 (commHlbNumTail np1))
	       (GO Ml))
	      (T
	       (SETQ np3 (commHlbNumTail np2))
	       (commHlbNumRplacTail np2 (commHlbNumTail np1))
	       (SETQ np1 (commHlbNumTail (commHlbNumRplacTail np1 np2)))
	       (COND ((commHlbNum!? (SETQ np2 np3))
		      (GO Ml))))) ))


%  What we really need, is adding NumDenDeg's, correcting for
% having different denominator degrees. The earlier variant used
% VectPlus2 for the actual additions, and then replaced in order to
% change numdd1 to the result. This was probably very inefficient;
% and it meant troubles for keeping the results free from zero co-
% efficients. This variant uses commHlbNumAdd0. This makes it
% mandatory to have the series with least degree non-vanishing term
% first. Thus input must be given thus; and the procedure is
% destructive.

%  Some (redundant?) replacements remain. Also the use of commHlbProlongNum
% may be inefficient.

% PROG variables: Denominator degrees of numdd1, numdd2; Return.

%# commHlbAddNumDenDeg2 (commHlbNumDenDeg, commHlbNumDenDeg) :
%#			commHlbNumDenDeg ; DESTRUCTIVE
(DE commHlbAddNumDenDeg2 (numdd1 numdd2)
 (PROG 	(dd1 dd2 rt)
	(COND ((EQ (SETQ dd1 (commHlbNumDenDeg2DenDeg numdd1))
		   (SETQ dd2 (commHlbNumDenDeg2DenDeg numdd2)))
	       (commHlbNumAdd0 (commHlbNumDenDeg2Num numdd1)
			       (commHlbNumDenDeg2Num numdd2))
	       (SETQ rt (commHlbShortenNum (commHlbNumDenDeg2Num numdd1)))
	       (commHlbRplacNum numdd1 (commHlbSplitNum2Num rt))
	       (commHlbRplacDenDeg numdd1 (BMI!- dd1
					      (commHlbSplitNum2DenDeg rt))))
	      ((BMI!< dd1 dd2)
	       (commHlbRplacNum numdd1
				(commHlbProlongNum (commHlbNumDenDeg2Num numdd1)
						   (BMI!- dd2 dd1)))
	       (commHlbNumAdd0 (commHlbNumDenDeg2Num numdd1)
			       (commHlbNumDenDeg2Num numdd2))
	       (commHlbRplacDenDeg numdd1 dd2))
	      (T
	       (commHlbNumAdd0 (commHlbNumDenDeg2Num numdd1)
			       (commHlbProlongNum (commHlbNumDenDeg2Num numdd2)
						  (BMI!- dd1 dd2)))))
	(RETURN numdd1) ))


%  Multiply num with t^pow. (Might never be used!) Returns.

%# commHlbNumTimesPower (hsnum, degno) : hsnum ;
(DE commHlbNumTimesPower (num pow)
 (PROG	(rt np)
	(SETQ rt
	      (TCONC NIL
		     (commHlbCoeff!&Deg2Term (commHlbNum2FirstCoeff num)
					     (PLUS2 (commHlbNum2FirstDeg num)
						    pow))))
	(COND ((commHlbNum0!? (SETQ np (commHlbNumTail num)))
	       (RETURN (CAR rt))))
  Ml	(TCONC rt (commHlbCoeff!&Deg2Term (commHlbNum2FirstCoeff np)
					  (PLUS2 (commHlbNum2FirstDeg np)
						 pow)))
	(COND ((commHlbNum!? (SETQ np (commHlbNumTail np)))
	       (GO Ml)))
	(RETURN (CAR rt)) ))


%  Multiply num with term.

% PROG variables: Return; Numerator position; Coefficient,
%		  Power of t, in term

%# commHlbNumTimesTerm (hsnum, hsterm) : hsterm ;
(DE commHlbNumTimesTerm (num term)
 (PROG	(rt np cf pw)
	(SETQ pw (commHlbDeg term))
	(SETQ cf (commHlbCoeff term))
	(SETQ rt
	      (TCONC NIL
		     (commHlbCoeff!&Deg2Term (TIMES2 (commHlbNum2FirstCoeff
							num)
						     cf)
					     (PLUS2 (commHlbNum2FirstDeg num)
						    pw))))
	(COND ((commHlbNum0!? (SETQ np (commHlbNumTail num)))
	       (RETURN (CAR rt))))
  Ml	(TCONC rt (commHlbCoeff!&Deg2Term (TIMES2 (commHlbNum2FirstCoeff np)
						  cf)
					  (PLUS2 (commHlbNum2FirstDeg np) pw)))
	(COND ((commHlbNum!? (SETQ np (commHlbNumTail np)))
	       (GO Ml)))
	(RETURN (CAR rt)) ))


%  Multiply num with num. The (suspectedly) simpler numerator
% argument should be given as num1.

%#  commHlbNumTimes2 (hsnum, hsnum) : hsnum ;
(DE commHlbNumTimes2 (num1 num2)
 (PROG	(rt np)
	(SETQ rt (commHlbNumTimesTerm num2 (commHlbFirstTerm num1)))
	(SETQ np num1)
  Ml	(COND ((commHlbNum!? (SETQ np (commHlbNumTail np)))
	       (commHlbNumAdd0 rt (commHlbNumTimesTerm num2
						       (commHlbFirstTerm np)))
	       (GO Ml)))
	(RETURN rt) ))




		%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%
		%%%				%%%
		%%% Low-level Support and Mask	%%%
		%%% Handling and Monomial	%%%
		%%% Routines.			%%%
		%%%				%%%
		%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%

%  The support of the monomial m is represented as the product of the
% variables dividing m. It - or its complement - may be used for `masking'
% a monomial or a whole set of monomials (generating an ideal). (Here
% `masking'  should not be taken in a strict datalogical sense .)
%  WARNING: The procedures comparing a support and a monomial ALWAYS
% assumes that they have the same lengths. (If not, rather ungraceful
% errors might occur.) The programmer must guarantee this use of them,
% although monomial lengths are changed dynamically rather often.
%  For similar reasons, using routines from elsewhere on these `monomials'
% should be avoided.


%  Returns the support of (the pure monomial part of the flagged-monomial)
% fmon.

%# commHlbSupport (hsflagmon) : hsmask ;
(DE commHlbSupport (fmon)
 (MAPCAR (commHlbFMon2Mon fmon)
	 (FUNCTION (LAMBDA (numero)
			   (COND ((ZEROP numero) 0)
				 (T 1))))) )


%  Boolean: Does Supp(fmon) intersect mask?

% PROG variables: `Mask Positions' in mask and Supp(fmon).

%# commHlbIntersectMask (hsflagmon hsmask) : bool ;
(DE commHlbIntersectMask (fmon mask)
 (PROG	(mp1 mp2)
	(SETQ mp1 mask)
	(SETQ mp2 (commHlbFMon2Mon fmon))
  Ml	(COND ((AND (EQ (CAR mp1) 1) (NOT (ZEROP (CAR mp2))))
	       (RETURN T))
	      ((SETQ mp1 (CDR mp1))
	       (SETQ mp2 (CDR mp2))
	       (GO Ml))) ))


%  Boolean: Is Supp(fmon) a subset of mask?

% PROG variables: `Mask Positions' in mask and Supp(fmon).

%# commHlbSubsetMask (hsflagmon hsmask) : bool ;
(DE commHlbSubsetMask (fmon mask)
 (PROG	(mp1 mp2)
	(SETQ mp1 mask)
	(SETQ mp2 (commHlbFMon2Mon fmon))
  Ml	(COND ((AND (ZEROP (CAR mp1)) (NOT (ZEROP (CAR mp2))))
	       (RETURN NIL))
	      ((SETQ mp1 (CDR mp1))
	       (SETQ mp2 (CDR mp2))
	       (GO Ml)))
	(RETURN T) ))


%  Quasi-boolean: Destructively replaces mask by the union of Supp(fmon)
% and mask. Returns NIL if the new mask is `trivial', i.e., consists of
% all variables; T otherwise.

% PROG variables: `Mask Positions' in mask and Supp(fmon); Return value.

%# commHlbNontrivUnionMask (hsflagmon hsmask) : bool ; DESTRUCTIVE (2)
(DE commHlbNontrivUnionMask (fmon mask)
 (PROG	(mp1 mp2 rt)
	(SETQ mp1 mask)
	(SETQ mp2 (commHlbFMon2Mon fmon))
  Ml	(COND ((ZEROP (CAR mp1))
	       (COND ((ZEROP (CAR mp2)) (SETQ rt T))
		     (T (RPLACA mp1 1)))))
	(COND ((SETQ mp1 (CDR mp1))
	       (SETQ mp2 (CDR mp2))
	       (GO Ml)))
	(RETURN rt) ))


% Returns the size of the complement to mask (i.e., its number of 0's).

% PROG variables: Return value; `Mask Positions' in mask.

%# commHlbNoOf0Mask (hsmask) : varno ;
(DE commHlbNoOf0Mask (mask)
 (PROG	(rt mp)
	(SETQ rt 0)
	(SETQ mp mask)
  Ml	(COND ((ZEROP (CAR mp))
	       (SETQ rt (ADD1 rt))))
	(COND ((SETQ mp (CDR mp))
	       (GO Ml)))
	(RETURN rt) ))


%  Destructively pruning unnecessary variables, i.e., those outside mask.
% Uses the fact that the `Mon' is represented as the CDR of the `FMon'.

% PROG variables: `Mask Positions' in mask and Supp(fmon).

%# commHlbPrune0MaskedVars1 (hsflagmon, hsmask) : - ; DESTRUCTIVE (1)
(DE commHlbPrune0MaskedVars1 (fmon mask)
 (PROG	(mp1 mp2)
	(SETQ mp1 mask)
	(SETQ mp2 fmon)
  Ml	(COND ((ZEROP (CAR mp1))
	       (RPLACD mp2 (CDDR mp2)))
	      (T
	       (SETQ mp2 (CDR mp2))))
	(COND ((SETQ mp1 (CDR mp1))
	       (GO Ml))) ))


%# commHlbPrune0MaskedVars (hsmonid, hsmask) : - ; DESTRUCTIVE (1)
(DE commHlbPrune0MaskedVars (monid mask)
 (PROG	(lm)
	(SETQ lm monid)
  Ml	(commHlbPrune0MaskedVars1 (CAR lm) mask)
	(COND ((SETQ lm (CDR lm))
	       (GO Ml))) ))

%  Destructively pruning variables WITHIN mask.
% Uses the fact that the `Mon' is represented as the CDR of the `FMon'.

% PROG variables: `Mask Positions' in mask and Supp(fmon).

%# commHlbPrune1MaskedVars1 (hsflagmon, hsmask) : - ; DESTRUCTIVE (1)
(DE commHlbPrune1MaskedVars1 (fmon mask)
 (PROG	(mp1 mp2)
	(SETQ mp1 mask)
	(SETQ mp2 fmon)
  Ml	(COND ((ZEROP (CAR mp1))
	       (SETQ mp2 (CDR mp2)))
	      (T
	       (RPLACD mp2 (CDDR mp2))))
	(COND ((SETQ mp1 (CDR mp1))
	       (GO Ml))) ))


%# commHlbPrune1MaskedVars (hsmonid, hsmask) : - ; DESTRUCTIVE (1)
(DE commHlbPrune1MaskedVars (monid mask)
 (PROG	(lm)
	(SETQ lm monid)
  Ml	(commHlbPrune1MaskedVars1 (CAR lm) mask)
	(COND ((SETQ lm (CDR lm))
	       (GO Ml))) ))


%  Returns a copy of monid, with the first variable removed.

% PROG variables: Return value; input monomial list position.

%# commHlbPruneVar1Copy (hsmonid) : hsmonid ;
(DE commHlbPruneVar1Copy (monid)
 (PROG	(rt mp)
	(SETQ rt (TCONC NIL (commHlbFlag!&Mon2FMon
		     NIL
		     (commHlbMonCopy (commHlbMonTail
					(commHlbFMon2Mon (CAR monid)))))))
	(SETQ mp (CDR monid))
  Ml	(COND (mp
	       (TCONC rt (commHlbFlag!&Mon2FMon
			    NIL
			    (commHlbMonCopy (commHlbMonTail
						(commHlbFMon2Mon (CAR mp))))))
	       (SETQ mp (CDR mp))
	       (GO Ml)))
	(RETURN (CAR rt)) ))


%  Boolean: Does fmon1 NOT divide fmon2? (They are allowed to be equal.)

% PROG variables: `Monomial Positions' in fmon1 and fmon2.

%# commHlbNonMonFactorP (hsflagmon, hsflagmon) : bool ;
(DE commHlbNonMonFactorP (fmon1 fmon2)
 (PROG	(mp1 mp2)
	(SETQ mp1 (commHlbFMon2Mon fmon1))
	(SETQ mp2 (commHlbFMon2Mon fmon2))
  Ml	(COND ((LESSP (CAR mp2) (CAR mp1))
	       (RETURN T)))
	(COND ((SETQ mp1 (CDR mp1))
	       (SETQ mp2 (CDR mp2))
	       (GO Ml))) ))


%  Boolean: Is mon1 lex greater than mon2? (They are NOT allowed
% to be equal.)

% PROG variables: `Monomial Positions' in mon1 and mon2.

%# commHlbMonGreaterP (hsmon, hsmon) : bool ;
(DE commHlbMonGreaterP (mon1 mon2)
 (PROG	(mp1 mp2)
	(SETQ mp1 mon1)
	(SETQ mp2 mon2)
  Ml	(COND ((EQ (CAR mp1) (CAR mp2))
	       (SETQ mp1 (CDR mp1))
	       (SETQ mp2 (CDR mp2))
	       (GO Ml)))
	(RETURN (LESSP (CAR mp2) (CAR mp1))) ))


%  Destructive. Returns a lex decreasing merged list of the two lists
% monid1 and monid2, each of which is assumed to be lex decreasing.

% PROG variables: Return value; Monomial list position in monid1 = rt,
%		  monid2; Temporary monomial list position.

%# commHlbMergeMonId2 (hsmonid, hsmonid) : hsmonid ;
(DE commHlbMergeMonId2 (monid1 monid2)
 (PROG	(rt mp1 mp2 mp3)
	(SETQ mp1 (SETQ rt (CONS NIL monid1)))
	(SETQ mp2 monid2)
  Ml	(COND ((NOT (CDR mp1))
	       (RPLACD mp1 mp2)
	       (RETURN (CDR rt)))
	      ((commHlbMonGreaterP (commHlbFMon2Mon (CADR mp1))
				   (commHlbFMon2Mon (CAR mp2)))
	       (SETQ mp1 (CDR mp1))
	       (GO Ml)))
	(SETQ mp3 (CDR mp2))
	(RPLACD mp2 (CDR mp1))
	(RPLACD mp1 mp2)
	(SETQ mp1 mp2)
	(COND ((SETQ mp2 mp3)
	       (GO Ml)))
	(RETURN (CDR rt)) ))


%  Returns the total degree (assuming all variables of weight 1),
% even for a length 1 argument.

%# commHlbTDeg (hsmon) : degno ;
(DE commHlbTDeg (mon)
 (COND	((CDR mon) (PLUSNOEVAL mon))
	(T (CAR mon))) )


%  Returns the total-degree of the Least Common Multiple of mon1 and
% mon2, without actually calculating the LCM.

% PROG variable: Return value; monomial positions in mon1, mon2.

%# commHlbTDegLCM (hsmon, hsmon) : degno ;
(DE commHlbTDegLCM (mon1 mon2)
 (PROG	(rt mp1 mp2)
	(SETQ mp1 mon1)
	(SETQ mp2 mon2)
	(SETQ rt (COND ((BMI!< (CAR mp1) (CAR mp2))
			(CAR mp2))
		       (T
			(CAR mp1))))
  Ml	(COND ((NOT (SETQ mp1 (CDR mp1)))
	       (RETURN rt)))
	(SETQ rt (BMI!+ rt
			(COND ((BMI!< (CAR mp1) (CAR (SETQ mp2 (CDR mp2))))
			       (CAR mp2))
			      (T
			       (CAR mp1)))))
	(GO Ml) ))


%  Returns the Least Common Multiple of mon1 and mon2.

% PROG variable: Return value; monomial positions in rt, mon2.

%# commHlbLCM (hsmon, hsmon) : hsmon ;
(DE commHlbLCM (mon1 mon2)
 (PROG	(rt mp1 mp2)
	(SETQ mp1 (SETQ rt (LISTCOPY mon1)))
	(SETQ mp2 mon2)
  Ml	(COND ((BMI!< (CAR mp1) (CAR mp2))
	       (RPLACA mp1 (CAR mp2))))
	(COND ((SETQ mp1 (CDR mp1))
	       (SETQ mp2 (CDR mp2))
	       (GO Ml)))
	(RETURN rt) ))


%  Lowers destructively the first exponent in each monomial of monid
% by vardeg.

% PROG variable: Monomial list position.

%#  commHlbLowerVar1InMonId (exptno, hsmonid) : - ; DESTRUCTIVE (2)
(DE commHlbLowerVar1InMonId (vardeg monid)
 (PROG	(mp)
	(SETQ mp monid)
  Ml	(RPLACA (commHlbFMon2Mon (CAR mp))
		(BMI!- (commHlbFirstInFMon (CAR mp)) vardeg))
	(COND ((SETQ mp (CDR mp))
	       (GO Ml))) ))


%  Expr that flags fmon NIL. Ordinally performed by the macro
% commHlbNilFlag.)

%# commHlbExprNilFlag (hsflagmon) : - ; DESTRUCTIVE
(DE commHlbExprNilFlag (fmon) (commHlbNilFlag fmon))


		%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%
		%%%				%%%
		%%% Internal Series Calculating	%%%
		%%%				%%%
		%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%


%  We convert a MonId to a Hilbert series of its residue class ring,
% represented as a NumDenDeg, a numerator and the degree ( = the (1-t)
% exponent) of the denominator, in a recursive loop: First the residue
% class ring is split into tensor products of residue class rings
% w.r.t. zero ideals or RedMonId's, reduced monomial ideals (with full
% supports). Zero ideal residue class rings, i.e., polynomial rings, just
% raise the DenDeg. For each RedMonId, either the series is calcul|ated
% directly by means of the Basic Case algorithms, or the RedMonId I is
% split into two MonId's, I+a and (I:a), where a is the least positive
% power of the splitting variable. Then the conversion is called
% recursively on each of these MonId's.

%  (The theoretical approach and experimental implementational
% efficiency investigations of this splitting method are due to Ralf
% Froeberg and Joachim Hollman. REFERENCES SHOULD BE INSERTED HERE.)


%  Returns the NumDenDeg Hilbert Series of MonId, not necessarily in
% the most compact form. The input must be non-empty, lex sorted, and
% without repetitions.

% PROG variables: List of RedMonId, Denominator degree, Return value,
%		  Hilbert series of a factor, MonId position.

%# commHlbMonId2HSer1 (hsmonid) : hsnumdendeg ; DESTRUCTIVE
(DE commHlbMonId2HSer1 (monid)
 (PROG	(lm dd rt hs mp)
	(SETQ dd (CAR (SETQ lm (commHlbReduceMonId monid))))
  Ml	(COND ((NOT (SETQ lm (CDR lm)))
	       (RETURN (commHlbNum!&DenDeg2NumDenDeg rt dd))))
	(SETQ hs (OR (commHlbBasicCaseSeries (CAR lm))
		     (commHlbSplitCaseSeries (CAR lm) 1)))
	(SETQ dd (PLUS2 (commHlbNumDenDeg2DenDeg hs) dd))
	(SETQ rt (COND (rt
			(commHlbNumTimes2 rt (commHlbNumDenDeg2Num hs)))
		       (T
			(commHlbNumDenDeg2Num hs))))
	(GO Ml) ))


%  Returns ((No. of free variables) . (list of reduced monomial ideals)).

% PROG variables: Return value; Variable support mask; List of
%		  (remaining, reduced) input monomials; Various
%		  monomial list positions. (mp2 also: the new
%		  RedMonId under collection.)

%# commHlbReduceMonId (hsmonid) : hsdata ; DESTRUCTIVE
(DE commHlbReduceMonId (monid)
 (PROG	(rt msk lm mp1 mp2 mp3)
	(SETQ lm monid)

	% Main loop. Make lm into a ring form structure; search this
	% until either the fact that the support is trivial (i.e., no
	% tensor product factoring by disjoint sets of variables is
	% possible), or a whole leap without support extension has
	% passed.
  Ml	(SETQ msk (commHlbSupport (CAR (SETQ mp1 lm))))
	(RPLACD (SETQ mp3 (LASTPAIR lm)) lm)
	(commHlbTrueFlag (CAR mp1))

	% Primary subloop: After a support extension, start a new leap.
  Pl	(SETQ mp2 mp1)

	% Secondary subloop. Check for end-of-leap and for support
	% extensions. Flag an FMon T if its support intersects the
	% current support (msk).
  Sl1	(COND ((EQ (SETQ mp1 (CDR mp1)) mp2)
	       (GO MlEnd))
	      ((OR (commHlbMonFlagP (CAR mp1))
		   (NOT (commHlbIntersectMask (CAR mp1) msk)))
	       (GO Sl1)))
	(commHlbTrueFlag (CAR mp1))
	(COND ((commHlbSubsetMask (CAR mp1) msk)
	       (GO Sl1))
	      ((commHlbNontrivUnionMask (CAR mp1) msk)
	       (GO Pl))
	      (T
	       (RPLACD mp3 NIL)
	       (MAPC lm 'commHlbExprNilFlag)
	       (RETURN (CONS 0 (CONS lm rt)))))

	% End of the main loop: Cut up the ring; remove the T-flagged
	% monomials from lm and collect and save them as a new RedMonId.
  MlEnd	(RPLACD mp3 NIL)
	(commHlbNilFlag (CAR lm))
	(SETQ mp2 (TCONC NIL (CAR (SETQ mp1 lm))))
  Sl2	(COND ((CDR mp1)
	       (COND ((commHlbMonFlagP (CADR mp1))
		      (commHlbNilFlag (CADR mp1))
		      (TCONC mp2 (CADR mp1))
		      (RPLACD mp1 (CDDR mp1)))
		     (T
		      (SETQ mp1 (CDR mp1))))
	       (GO Sl2)))
	(commHlbPrune0MaskedVars (CAR mp2) msk)
	(SETQ rt (CONS (CAR mp2) rt))
	(COND ((SETQ lm (CDR lm))
	       (commHlbPrune1MaskedVars lm msk)
	       (GO Ml)))

	(RETURN (CONS (commHlbNoOf0Mask msk) rt)) ))


%  Returns the Hilbert series of the residue class ring (as a NumDenDeg)
% if redmonid is of one of the basic types it can handle; NIL else.
%  Its argument must be a non-empty reduced monomial ideal generating set.

%  Right now, the procedure handles the case of at most 3 monomials.

% PROG variables: Length of redmonid; Embedding dimension (i.e., number
%		  of variables); Return value; First, second, third
%		  monomial; Least common multiple of m1 and m2.

%# commHlbBasicCaseSeries (hsredmonid) : genhsnumdendeg ;
(DE commHlbBasicCaseSeries (redmonid)
 (PROG	(ln ed rt m1 m2 m3 m12)
	(COND ((GREATERP (SETQ ln (LENGTH redmonid)) 3)
	       (RETURN NIL)))
	(SETQ ed (commHlbMonVarNo (commHlbFMon2Mon (CAR redmonid))))
	(SETQ rt (LIST (CONS 1 0)
		       (CONS
			  -1
			  (commHlbTDeg
			     (SETQ m1 (commHlbFMon2Mon (CAR redmonid)))))))
	(COND ((EQ ln 1)
	       (commHlbNumQuotient1!-t rt)
	       (RETURN (commHlbNum!&DenDeg2NumDenDeg rt (SUB1 ed)))))
	(commHlbNumPlusTerm
	   rt
	   (CONS -1 (commHlbTDeg (SETQ m2
				       (commHlbFMon2Mon (CADR redmonid))))))
	(commHlbNumPlusTerm rt
			    (CONS 1
				  (commHlbTDeg (SETQ m12
						     (commHlbLCM m1 m2)))))
	(COND ((EQ ln 2)
	       (GO End)))
	(commHlbNumPlusTerm
	   rt
	   (CONS -1
		 (commHlbTDeg (SETQ m3
				    (commHlbFMon2Mon (CADDR redmonid))))))
	(commHlbNumPlusTerm rt (CONS 1 (commHlbTDegLCM m1 m3)))
	(commHlbNumPlusTerm rt (CONS 1 (commHlbTDegLCM m2 m3)))
	(commHlbNumPlusTerm rt (CONS -1 (commHlbTDegLCM m12 m3)))
  End	(SETQ rt (commHlbShortenNum rt))
	(RETURN (commHlbNum!&DenDeg2NumDenDeg (CAR rt)
					      (BMI!- ed (CDR rt)))) ))


%  Splits redmonid into two, calculating the series by means of theirs.
% Splitting by means of the numb'th variable; presently, numb must be 1.

%# commHlbSplitCaseSeries (hsredmonid, varno) : hsnumdendeg ;
(DE commHlbSplitCaseSeries (redmonid numb)
 (commHlbSplitCaseSeries1 redmonid))


% PROG variables: Positions in (input or new) monomial lists;
%		  Least positive degree of
%		  variable 1 (say x); Nominator; Embedding dimension of
%		  redmonid; List of new monomials; Return value parts.

%# commHlbSplitCaseSeries1 (hsredmonid) : hsnumdendeg ;
(DE commHlbSplitCaseSeries1 (redmonid)
 (PROG	(mp1 mp2 vd nm ed lm rt1 rt2)
	(SETQ ed (commHlbMonVarNo (commHlbFMon2Mon (CAR redmonid))))
	(SETQ mp1 redmonid)

	% First main loop: Find the least positive degree of x;
	% this must be the last non-zero such degree.
  Ml1	(COND ((AND (CDR mp1) (NOT (ZEROP (commHlbFirstInFMon (CADR mp1)))))
	       (SETQ mp1 (CDR mp1))
	       (GO Ml1)))
	(SETQ vd (commHlbFirstInFMon (CAR mp1)))

	% Calculate the series for (redmonid + x^vd).
	(SETQ nm (LIST (CONS 1 0) (CONS -1 vd)))
	(COND ((NOT (SETQ lm (CDR mp1)))
	       (commHlbNumQuotient1!-t nm)
	       (commHlbLowerVar1InMonId vd redmonid)
	       (SETQ rt2 (commHlbMonId2HSer1 redmonid))
	       (commHlbRplacNum rt2 (commHlbNumTimesPower
				       (commHlbNumDenDeg2Num rt2)
				       vd))
	       (RETURN (commHlbAddNumDenDeg2
			  (commHlbNum!&DenDeg2NumDenDeg nm (SUB1 ed))
			  rt2))))
	(SETQ rt1 (commHlbMonId2HSer1 (commHlbPruneVar1Copy lm)))
	(commHlbNumQuotient1!-t (SETQ nm 
				      (commHlbNumTimes2
				         nm
					 (commHlbNumDenDeg2Num rt1))))
	(commHlbRplacNum rt1 nm)

	% Calculate (monid : x^vd), by lowering the x-power of the
	% x-divisible monomials by vd, and by removing the superfluous of
	% the other monomials. 
	(RPLACD mp1 NIL)
	(commHlbLowerVar1InMonId vd (SETQ mp1 redmonid))
	(SETQ lm (CONS NIL lm))


	% Second main loop: Bypass those new monomials who have
	% positive x-exponents ...
  Ml2	(COND ((NOT (ZEROP (CAR (commHlbFMon2Mon (CAR mp1)))))
	       (SETQ mp1 (CDR mp1))
	       (GO Ml2)))

	% Third main loop: ... and go through the others one by one ...
  Ml3	(SETQ mp2 lm)

	% Subloop: ... eliminating multiples thereof among old monomials.
  Sl	(COND ((commHlbNonMonFactorP (CAR mp1) (CADR mp2))
	       (SETQ mp2 (CDR mp2)))
	      (T
	       (RPLACD mp2 (CDDR mp2))))
	(COND ((CDR mp2)
	       (GO Sl))
	      ((AND (SETQ mp1 (CDR mp1)) (CDR lm))
	       (GO Ml3)))

	% Now ( (input)redmonid : x^vd) = (modified)redmonid + Cdr[lm], so
	% we may calculate its Hilbert series (as rt2), multiply it with
	% t^vd, and add it to the other Hilbert series.
	(SETQ rt2 (commHlbMonId2HSer1
		     (COND ((CDR lm) (commHlbMergeMonId2 redmonid (CDR lm)))
			   (T redmonid))))			    
	(commHlbRplacNum rt2 (commHlbNumTimesPower (commHlbNumDenDeg2Num rt2)
						   vd))
	(RETURN (commHlbAddNumDenDeg2 rt1 rt2)) ))



		%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%
		%%%				%%%
		%%%  High level series		%%%
		%%% calculation and display	%%%
		%%%				%%%
		%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%


%  Calculate the Hilbert series from GBasis, on rational form.
% Store the results on HILBERTNUMERATOR and HILBERTDENOMINATOR.

%# commCALCRATHILBERTSERIES () : - ;
(DE commCALCRATHILBERTSERIES ()
 (PROG	(denpos tmpcff) % Denominator position; temporary coefficient
	(COND ((OR (NOT GBasis) (NOT (CDR GBasis)))
	       (ERROR 99 "No GBasis for CALCRATHILBERTSERIES")))
	(SETQ denpos
	      (CDR (SETQ HILBERTNUMERATOR (commHlbMonId2HSer1
					   (commGBASIS2HSERIESMONID)))))
	(SETQ HILBERTDENOMINATOR (CAR HILBERTNUMERATOR))
	(SETQ HILBERTNUMERATOR NIL)
  Ml	(SETQ tmpcff (CAAR denpos)) % Possibly insert non-zero check?
	(RPLACA (CAR (SETQ HILBERTNUMERATOR
			   (CONS (CAR denpos) HILBERTNUMERATOR)))
		(CDAR denpos))
	(RPLACD (CAR denpos) tmpcff)
	(COND ((SETQ denpos (CDR denpos))
	       (GO Ml))) ))


%  Return one Hilbert polynomial value, hilb(tDeg). Uses the stored
% rational form Hilbert series value, if any; else, invokes
% commCALCRATHILBERTSERIES in order to create it.
%  We assume the denominator to contain decreasing degree terms,
% the last one being of degree 0; and the numerator to be a
% nonnegative integer.

%  Meaning of PROG variables: Return value; Binomial coefficient;
% Upper and lower entries therein; Current denominator degree;
% Denominator position.

%# commTDEGREEHSERIESOUT (degno) : bgsize ;
(DE commTDEGREEHSERIESOUT (tDeg)
 (PROG	(rt bincf aa bb cc denpos)
	(COND ((OR (NOT (FIXP tDeg)) (GREATERP 0 tDeg))
	       (ERROR 99 "Bad argument to TDEGREEHSERIESOUT"))
	      ((NOT HILBERTDENOMINATOR)
	       (commCALCRATHILBERTSERIES)))
	(COND ((ZEROP HILBERTDENOMINATOR)
	       (RETURN (COND ((SETQ rt (ASSOC tDeg HILBERTNUMERATOR))
			      (CDR rt))
			     (T 0)))))
	(SETQ denpos HILBERTNUMERATOR)
	Fl
	(COND ((LESSP tDeg (CAAR denpos))
	       (SETQ denpos (CDR denpos))
	       (GO Fl)))
	(SETQ aa (SUB1 HILBERTDENOMINATOR))
	(SETQ bb 0)
	(SETQ cc tDeg)
	(SETQ rt 0)
	(SETQ bincf 1)
  Ml	(COND ((EQN (CAAR denpos) cc)
	       (SETQ rt (PLUS2 rt (TIMES2 bincf (CDAR denpos))))
	       (COND ((NOT (SETQ denpos (CDR denpos)))
		      (RETURN rt)))))
	(SETQ bincf (QUOTIENT (TIMES2 bincf (SETQ aa (ADD1 aa)))
			      (SETQ bb (ADD1 bb))))
	(SETQ cc (SUB1 cc))
	(GO Ml) ))


%  Mainly for initiation processes: We may wish to `calculate' the
% Hilbert series of a polynomial ring.

%# commCALCPOLRINGHSERIES (varno) : - ;
(DE commCALCPOLRINGHSERIES (var!#)
 (PROGN	(SETQ HILBERTDENOMINATOR (GETVARNO))
	(SETQ HILBERTNUMERATOR (NCONS (CONS 0 1))) ))





%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%
%								%
%	    Old pbseries.sl, now rather assimilated:		%
%								%
%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%


(ON SAVERECVALUES)
(COND ((NOT TDEGVARIABLE) (SETQ TDEGVARIABLE '!t)))
(COND ((NOT HDEGVARIABLE) (SETQ HDEGVARIABLE '!z)))

% A pair (list . last cdr of list), where Car(list)=NIL, and the
% other list items are (all hitherto found) right monomial factors.
% (In algebraic terms, they are the ring monomials occurring in the
% boundaries of the basis elements in the minimal free right
% R-module resolution of the coefficient field k, where R is the
% monomial ring k<InVars>/(GBasis). Remember that GBasis is a set
% of monomials.)
% RMFplace is the tail of the list which starts one item before
% the first non-processed RMF; it is employed in a Depth First
% Search for new `pairings'.
(COND ((NOT RIGHTMONFACTORS)
       (SETQ RMFplace (NCONS NIL))
       (SETQ RIGHTMONFACTORS (CONS RMFplace RMFplace))))

% cRightMonFactors is organised as is RightMonFactors, but its other
% list items are uninterned (potential) RMFs. (They are not interned
% and added to RightMonFactors, until some redundancy checks are
% finished.)
(COND ((NOT cRightMonFactors)
       (SETQ cRightMonFactors (NCONS (NCONS NIL)))
       (RPLACD cRightMonFactors (CAR cRightMonFactors))))

% The Right Monomial Factor - lists are prolonged with the help of
% the PSL expr TCONC, which is not a Standard Lisp function.

%  After changing the DELTA1 handling 2002-07-06, the internal
% augmon structure is employed, in the sense that it is depended on
% always to be a pair, but never to have its CAR part EQ to DELTA./JoeB


(DE RECEVAL (rearg)
  (PROG (ntd !_savedvalue)
	% (COND ((NOT (Mon!? rearg)) (RETURN (APPLY rearg (LIST tDeg)))))
	(COND ((EQ (CAR rearg) 'DELTA)
	       (RETURN (COND ((BMI!= tDeg (CDR rearg)) '((1 . 1)))))))
	(SETQ ntd (BMI!- tDeg (TOTALDEGREE (PMon rearg))))
	(COND ((BMI!< ntd 1) (RETURN NIL))
	      ((AND !*SAVERECVALUES
		    (SETQ !_savedvalue
			  (ATSOC tDeg (LGET (Mplst rearg) 'SavedValues))))
	       (RETURN (CDR !_savedvalue))))
	(PROG (tDeg)
	      (SETQ tDeg ntd)
	      (SETQ !_savedvalue
		    (CDRADD1 (RECEVLIS (LGET (Mplst rearg) 'RecDef)))))
	(COND (!*SAVERECVALUES
	       (LPUT!-LGET (Maplst rearg) 'SavedValues
			  '(CONS (CONS tDeg !_savedvalue) !_IBID))))
	(RETURN !_savedvalue) ))

(DE RECEVLIS (larg)
  (DPLISTCOPY (VECTPLUS (MAPCAR larg (FUNCTION RECEVAL)))))

% (DE DELTA1 (arg) (COND ((BMI!= arg 1) '((1 . 1))) (T NIL)) )

(DE VECTPLUS (levald)
    (COND (levald (VectPlus2 (CAR levald) (VECTPLUS (CDR levald))))) )

(DE VectPlus2 (list1 list2)
    (COND ((NOT list2) list1)
	  ((NOT list1) list2)
	  ((BMI!= (CDAR list1) (CDAR list2))
	   (CONS (CONS (PLUS2 (CAAR list1) (CAAR list2)) (CDAR list1))
		 (VectPlus2 (CDR list1) (CDR list2))))
	  ((BMI!< (CDAR list1) (CDAR list2))
	   (CONS (CAR list1) (VectPlus2 (CDR list1) list2)))
	  (T (CONS (CAR list2) (VectPlus2 list1 (CDR list2))))) )

(DE z2!-1 (list)
  (PROG (AA BB)
	(SETQ AA 0)
	(SETQ BB list)
   Ml	(COND (BB
	       (COND ((ZEROP (REMAINDER (CDAR BB) 2))
		      (SETQ AA (PLUS2 AA (CAAR BB))))
		     (T (SETQ AA (DIFFERENCE AA (CAAR BB)))))
	       (SETQ BB (CDR BB))
	       (GO Ml)))
	(RETURN AA) ))


	%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%
	%%%						%%%
	%%% Finding New Right Monomial Factors, and	%%%
	%%% Putting Recursive Definitions on them:     	%%%
	%%%						%%%
	%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%


 %  Add item to the recursive definition of (the series
 %  corresponding to) the R(ight) M(onomial) F(actor) mon.
 %  If item is a monomial, we also may need to find mon from
 %  item, so add mon to an `inverse' list on item.

%  After changing the DELTA1 handling 2002-07-06, the internal
% augmon structure is employed, in the sense that it is depended on
% always to be a pair, but never to have its CAR part EQ to DELTA./JoeB

(DE PutRecDef (!_mon !_item)
  (PROGN (LPUT!-LGET (Maplst !_mon) 'RecDef '(CONS !_item !_IBID))
	 (COND ((NOT (EQ (CAR !_item) 'DELTA))
		(LPUT!-LGET (Maplst !_item) 'InvRecDef '(CONS !_mon !_IBID)))) ))


 %  Remove item from this recursive definition.

(DE RemRecDef (!_mon !_item)
  (PROGN (LPUT!-LGET (Maplst !_mon) 'RecDef '(DELQ !_item !_IBID))
	 (COND ((NOT (EQ (CAR !_item) 'DELTA))
		(LPUT!-LGET (Maplst !_item)
			   'InvRecDef
			   '(DELQ !_mon !_IBID)))) ))


 %  THE MAIN RMF-FINDING PROCEDURE:
 %  mon is a new GBE. Immediately do ALL necessary extensions:
 %  Check mon to the right of existing RMF's;
 %  Add the Tor2 element corresponding to mon;
 %  While there are 'new' RME's, check one of these to the left
 %  of the GBE's.

(DE FindNewRMFs (mon)
  (PROG ()
	(SETQ RMFplace (FindNewRMFs!> mon))
	(FindNewTor2RMF mon)
   Ml	(COND ((SETQ RMFplace (CDR RMFplace))
	       (FindNewRMFs!< (CAR RMFplace) (LIST GBasis cGBasis))
	       (GO Ml))) ))


 %  RMF-FINDING AUXILIARIES:

 %  mon is a new GBE. It corresponds to a Tor2-element:

(DE ordweightsFindNewTor2RMF (mon)
  (PROG (AA)
	(COND ((NOT (MEMQ (SETQ AA (MonIntern1 (CDR (PMon mon))))
			  (CAR RIGHTMONFACTORS)))
	       (TCONC RIGHTMONFACTORS AA)))
	(PutRecDef AA '(DELTA . 1)) ))

(DE altweightsFindNewTor2RMF (mon)
  (PROG (AA)
	(COND ((NOT (MEMQ (SETQ AA (MonIntern1 (CDR (PMon mon))))
			  (CAR RIGHTMONFACTORS)))
	       (TCONC RIGHTMONFACTORS AA)))
	(PutRecDef AA (CONS 'DELTA
			    (VarIndex2Weight (CAR (PMon mon))))) ))

 %  mon is a new GBE. Chech through all RMF's in order to see
 %  what elongations with mon may occur. Return the augmented
 %  list of the new RMF's at the end of Car(RIGHTMONFACTORS).
 %   When we have found the elongations CC of the current RMF,
 %  Car(AA), we must check whether they are minimal. Therefore,
 %  we save a list InvRecDef on Car(AA), telling what RMFs it
 %  may be prolonged with (so that it is in the RecDef o these).
 %  For each item on CC, and for each item on
 %  DD := InvRecDef(Car(AA)), we must check whether one is a
 %  (proper) left factor of the other. (They cannot be equal,
 %  due to the minimality of the Groebner bases.) The multiples
 %  are deleted.
 %   (We thus may remove part of a RecDef, which already was
 %  employed in calculations of the PBseries. However, then
 %  the prolongation of Car(AA) has length > TotalDegree(mon) =
 %  = cDeg, and thus this RecDef part must have evaluated to
 %  NIL.)
 %  Meanings of prog variables:
 %  Car(AA) = the RMF to be prolonged;
 %  BB FIRST = length of longest proper 'mon' left factor;
 %     THEN = augmented list of new RMF's;
 %  CC = list of uninterned prolongations 'v' of Car(AA) by
 %	 'mon'. (Recall that a prolongation is an equality
 %		Car(AA)*v = u*mon);
 %  DD = list of (earlier found, already saved) prolongations
 %  of Car(AA);
 %  LL = list of interned, non-redundant prolongations of
 %  Car(AA) by 'mon'.

(DE FindNewRMFs!> (mon)
  (PROG (AA BB CC DD LL)
	(SETQ BB (SUB1 (TOTALDEGREE (PMon mon))))
	(SETQ AA (CAR RIGHTMONFACTORS))
   Ml	(COND ((NOT (SETQ AA (CDR AA)))
	       (SETQ BB (CDR RIGHTMONFACTORS))
	       (GO Ll)))
	(TCONCPTRCLEAR cRightMonFactors)
	(FindNewRMFs2 (CAR AA) mon (TOTALDEGREE (PMon (CAR AA))) BB)
	(COND ((NOT (SETQ CC (CDAR cRightMonFactors)))
	       (GO Ml)))
   Sl	(SETQ DD (LGET (Mplst (CAR AA)) 'InvRecDef))
   Thl	(COND ((NOT DD)
	       (SETQ LL (CONS (MonIntern1 (CAR CC)) LL))
	       (PutRecDef (CAR LL) (CAR AA)))
	      ((NOT (LeftMonFactorP (PMon (CAR DD)) (CAR CC)))
	       (COND ((LeftMonFactorP (CAR CC) (PMon (CAR DD)))
		      (RemRecDef (CAR DD) (CAR AA))))
	       (SETQ DD (CDR DD))
	       (GO Thl)))
	(COND ((SETQ CC (CDR CC)) (GO Sl)))
	(GO Ml)
   Ll	(COND ((NOT LL) (RETURN BB))
	      ((NOT (MEMQ (CAR LL) (CAR RIGHTMONFACTORS)))
	       (TCONC RIGHTMONFACTORS (CAR LL))))
	(SETQ LL (CDR LL))
	(GO Ll) ))

 %  mon is a new RMF. Search systematically through the GBE's
 %  in order to find all possible minimal elongations of mon,
 %  and thus new RMF's, or at least new ways recursively to
 %  achieve them.

(DE FindNewRMFs!< (mon llmons)
  (PROG (AA BB CC)
	(TCONCPTRCLEAR cRightMonFactors)
	(SETQ BB (TOTALDEGREE (PMon mon)))
	(SETQ CC llmons)
   Fl	(COND ((NOT CC)
	       (SETQ AA (CDAR cRightMonFactors))
	       (GO Ml)))
	(SETQ AA (CAR CC))
	(SETQ CC (CDR CC))
   Fl1	(COND ((SETQ AA (CDR AA))
	       (FindNewRMFs2 mon (CAR AA) BB
			     (SUB1 (TOTALDEGREE (PMon (CAR AA)))))
	       (GO Fl1))
	      (T (GO Fl)))

	% Now AA = the (potentially) new RMF's.
	% It remains to eliminate non-minimal ones; to
	% extend the Recursive Definitions, and to add
	% the new RMF's to RIGHTMONFACTORS.
	%  We already know that no RMF is a left factor in
	% another RMF occurring to the right of the first one.
	% We must check out for the opposite possibility.
   Ml	(COND ((NOT AA) (RETURN NIL)))
	(SETQ BB (CDR AA))
	(SETQ CC (CAR AA))
   Sl	(COND ((AND BB (NOT (LeftMonFactorP (CAR BB) CC)))
	       (SETQ BB (CDR BB))
	       (GO Sl))
	      % Is Car(AA) minimal?
	      (BB (SETQ AA (CDR AA)) (GO Ml))	     % NO! Skip it.
	      ((NOT (MEMQ (SETQ CC (MonIntern1 CC))  % YES.
			  (CAR RIGHTMONFACTORS)))
	       (TCONC RIGHTMONFACTORS CC)))
	(PutRecDef CC mon)
	(SETQ AA (CDR AA))
	(GO Ml) ))

 %  Check for common factors of mon1 and mon2, of length not
 %  exceeding min(td1,td2). (In this way td1 or td2 need not be
 %  recalculated as often.)

%%%%%%% WARNING! THIS USES THE INTERNAL PUREMONOMIAL STRUCTURE! %%%%%%%
(DE FindNewRMFs2 (mon1 mon2 td1 td2)
  (PROG (AA BB CC DD ee LL PP)
	(SETQ AA (PMon mon1))
	(SETQ BB (PMon mon2))
	(SETQ LL (COND ((BMI!< td2 td1)
			(SETQ AA (PNTH AA (ADD1 (BMI!- td1 td2))))
			td2)
		       (T td1)))
	% Very preliminary:
	(COND ((AND (SETQ CC (LGET (Mplst mon2) 'Cycles))
		    (PAIRP (CAR CC)))
	       (SETQ PP (CAR (LASTCAR CC)))))
   Fl	(COND ((NOT (OR (SETQ CC (LeftMonFactorP AA BB))
			(BMI!= (SETQ LL (SUB1 LL)) 0)))
	       (SETQ AA (CDR AA))
	       (GO Fl))
	      ((NOT CC) (RETURN NIL))
	      ((AND PP (BMI!> LL PP))
	       (SETQ DD LL)
	       (SETQ LL (SUB1 PP))
	       (SETQ AA (PNTH AA (ADD1 (BMI!- DD LL)))))
	      (T (SETQ AA (CDR AA)) (SETQ LL (SUB1 LL))))
   Ml	(SETQ ee (CDAR cRightMonFactors)) % Does an older RMF factor the new?
   Sl	(COND ((AND ee (NOT (LeftMonFactorP (CAR ee) CC)))
	       (SETQ ee (CDR ee))
	       (GO Sl))
	      ((NOT ee) (TCONC cRightMonFactors CC)))
   Ml1	(COND ((BMI!= LL 0) (RETURN NIL))
	      ((OR (AND DD (BMI!= (REMAINDER (BMI!- DD LL) PP) 0))
		   (NOT (SETQ CC (LeftMonFactorP AA BB))))
	       (SETQ LL (SUB1 LL))
	       (SETQ AA (CDR AA))
	       (GO Ml1)))
	(SETQ LL (SUB1 LL))
	(SETQ AA (CDR AA))
	(GO Ml) )
  %  (DOUBLEPEEK mon1) (DOUBLEPEEK mon2)	% Defined in debug.sl
)

		%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%
		%%%				%%%
		%%% Available High-level Series	%%%
		%%% Calculating & Displaying	%%%
		%%%				%%%
		%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%


(DE TDEGREECALCULATEPBSERIES (newDeg)
  (PROG (tDeg)
	(COND ((NOT (AND LastDeg (LESSP LastDeg newDeg))) (SETQ tDeg 2))
	      (T (SETQ tDeg (ADD1 LastDeg))))
   Ml	(COND ((NOT (LESSP newDeg tDeg))
	       (COND ((NOT (ASSOC tDeg DOUBLEPBSERIES))
		      (TDEGREECALCULATEPBSERIES1 tDeg)))
	       (SETQ tDeg (ADD1 tDeg))
	       (GO Ml)))
	(SETQ LastDeg newDeg)))

(DE TDEGREECALCULATEPBSERIES1 (tDeg)
  (PROG (AA)
	(SETQ DOUBLEPBSERIES
	      (CONS (CONS tDeg
			  (SETQ AA (RECEVLIS (CDAR RIGHTMONFACTORS))))
		    DOUBLEPBSERIES))
	(SETQ INVHILBERTSERIES
	      (CONS (CONS tDeg (z2!-1 AA)) INVHILBERTSERIES))
	(COND ((GETIMMEDIATEASSOCRINGPBDISPLAY)
	       (DEGREEPBSERIESDISPLAY))) ))

(DE noncommTDEGREEHSERIESOUT (tDeg)
  (PROG (AA BB)
	(COND ((SETQ AA (ATSOC tDeg HILBERTSERIES))
	       (SETQ AA (CDR AA)))
	      ((ATSOC tDeg INVHILBERTSERIES) T)
	      ((SETQ BB (ATSOC tDeg DOUBLEPBSERIES))
	       (SETQ INVHILBERTSERIES
		     (CONS (CONS tDeg  (z2!-1 (CDR BB)))
			   INVHILBERTSERIES)))
	      (T (TDEGREECALCULATEPBSERIES tDeg)))
	(COND ((NOT AA)
	       (SETQ AA (INVERT-FPSERIES-STEP tDeg
					      INVHILBERTSERIES
					      'HILBERTSERIES
					      !*PrintSerSteps))))
%	(PRIN2 "+") (PRIN2 AA) (PRIN2 "*t^") (PRINT tDeg)
	(RETURN AA) ))

(DE INVERT-FPSERIES-STEP (deg InSeries OutSeriesName PrintStepP)
  (PROG (AA BB CC DD OutSeries)
	(SETQ OutSeries (EVAL OutSeriesName))
	(SETQ AA 0)
	(SETQ BB deg)
   Ml	(COND ((BMI!> BB 0)
	       (COND ((SETQ CC (ATSOC BB InSeries))
		      (COND ((NOT (SETQ DD (ATSOC (DIFFERENCE deg BB)
						  OutSeries)))
			     (INVERT-FPSERIES-STEP (DIFFERENCE deg BB)
						   InSeries
						   OutSeriesName
						   PrintStepP)
			     (SETQ OutSeries (EVAL OutSeriesName))
			     (SETQ DD (ATSOC (DIFFERENCE deg BB)
					     OutSeries))))
		      (SETQ AA
			    (DIFFERENCE AA
					(TIMES2 (CDR CC)
						(CDR DD))))))
	       (SETQ BB (SUB1 BB))
	       (GO Ml)))
	(SET OutSeriesName (CONS (CONS deg AA) OutSeries))
	(COND (PrintStepP (PrintFPStep deg AA HDEGVARIABLE)))
	(RETURN AA) ))

(DE RECEVALTD (mon td) (PROG (tDeg) (SETQ tDeg td) (RECEVAL mon)))

(DE RECEVLISTD (lmon td) (PROG (tDeg) (SETQ tDeg td) (RECEVLIS lmon)))

 %  If we wish to continue PBseriescalculation though GROEBNER is Done:

(DE CALCTOLIMIT (limit)
  (PROG (tDeg)
	(SETQ tDeg (ADD1 cDeg))
   Ml	(COND ((NOT (BMI!> tDeg limit))
	       (TDEGREECALCULATEPBSERIES tDeg)
	       (SETQ tDeg (ADD1 tDeg))
	       (GO Ml))) ))

% New 2002-07-12 (JoeB):

%  Should be given the last total degree for which series were
% calculated as an argument, or possibly a higher value. If so,
% all effects of (possibly) having calculated the Hilbert series,
% associated monomial ring double Poincare-Betti series, et
% cetera, should be cancelled; except induced calculations in
% lower total degrees. (Repeated calls with successively
% decreasing arguments would eliminate the effects of all these.)
%  Giving a too small argument could yield possibly silent errors.
% Likewise, changing the "Save Recursive Values" status between
% calculating series and calling this procedure.

%  Meaning of PROG variable: RIGHTMONFACTORS position.

%# REVERTSERIESCALC (binno) : boolean ;
(DE REVERTSERIESCALC (deg)
  (PROG (rmfp)
	(SETQ HILBERTSERIES (PRUNEFIRSTDEGREEITEM HILBERTSERIES deg))
	(SETQ INVHILBERTSERIES (PRUNEFIRSTDEGREEITEM INVHILBERTSERIES deg))
	(SETQ DOUBLEPBSERIES (PRUNEFIRSTDEGREEITEM DOUBLEPBSERIES deg))
	(COND ((NOT !*SAVERECVALUES) (RETURN NIL)))
	(SETQ rmfp (CAR RIGHTMONFACTORS))
  Ml	(COND ((NOT (SETQ rmfp (CDR rmfp)))
	       (RETURN T)))
	(LPUT!-LGET (Maplst (CAR rmfp)) 'SavedValues
		    (LIST 'PRUNEFIRSTDEGREEITEM '!_IBID deg))
	(GO Ml) ))

%# REMLASTSERIESCALC () : - ;
(DE REMLASTSERIESCALC ()
 (PROGN (REVERTSERIESCALC LastDeg)
	(SETQ LastDeg (SUB1 LastDeg))))


		%%%%%%%%%%%%%%%%%%%%%%%%%%%
		%%%			%%%
		%%%  OUTPUT ROUTINES	%%%
		%%%			%%%
		%%%%%%%%%%%%%%%%%%%%%%%%%%%

% (FLAG '(MonAlgOutprep) 'USER)

(DE VarOrSpacePrin2 (varname)
 (COND (varname (PRIN2 varname)) ((PRIN2 " "))))

% TEMPORARILY changed MonAlgOutprep to noncommMonAlgOutprep during
% merging /911120.
(COND ((NOT (DEFP 'SavedMonAlgOutprep))
       (COPYD 'SavedMonAlgOutprep 'noncommMonAlgOutprep)))

 %  VERY BAD fix; It's the INPUT to algoutlist that should be modified.
(DE WInsert (arg) (LIST (CAR arg) NIL (CDR arg)))

(DF ALGOUTLIST (listnvars)
  (PROG (AA Vars AO!+ AO!- AO!* AO!^ AObop!+ AObop!- AOeop AObol AOeol)
	(AlgOutModeSwitch (CADR listnvars))
	(SETQ Vars (EVLIS (CDDR listnvars)))
	(SETQ AA (MAPCAR (EVAL (CAR listnvars)) (FUNCTION WInsert)))
	(COND (AA (Char0AlgFirstRedorTermPrint (CAR AA)))
	      (T (PRIN2 "0") (GO End)))

   Ml	(COND ((SETQ AA (CDR AA))
	       (Char0AlgRedorTermPrint (CAR AA))
	       (GO Ml)))
   End	(PRIN2 AOeop) ))

(DE DEGREEPBSERIESDISPLAY ()
  (PROG (OutItem !*REDEFMSG !*USERMODE)
	(COPYD 'MonAlgOutprep 'PolOutprep)
	(SETQ OutItem (CDAR DOUBLEPBSERIES))
	(PRIN2 "+") (VarOrSpacePrin2 TDEGVARIABLE) (PRIN2 "^")
	(PRIN2 (CAAR DOUBLEPBSERIES))
	(PRIN2 "*(") (ALGOUTLIST OutItem PBOUT HDEGVARIABLE) (PRIN2 ")")
	(TERPRI)
	(COPYD 'MonAlgOutprep 'SavedMonAlgOutprep) ))

(DE PolOutprep (expts)
  (PROG (AA BB CC)
	(SETQ AA expts)
	(SETQ BB Vars)
   Ml	(COND ((NOT (EQ (CAR AA) 0))
	       (SETQ CC (CONS (CONS (CAR BB) (CAR AA)) CC))))
	(COND ((SETQ AA (CDR AA)) (SETQ BB (CDR BB)) (GO Ml)))
	(RETURN CC) ))


(DE PAIRPCDR (arg) (IF (PAIRP arg) (CDR arg) arg))

(DE MAPCDAR (rrr) (MAPCAR rrr (FUNCTION PAIRPCDR)))

(DE PREPRECDEF (!*!*xx) (MAPCDAR (LGET (Mplst !*!*xx) 'RecDef)))

(DE PRINTRECDEF (mon) (MAPC (PREPRECDEF mon) (FUNCTION PRINT)))

(DE PRINTINVRECDEF (!*!*xx)
  (MAPC (MAPCDAR (LGET (Mplst !*!*xx) 'InvRecDef)) (FUNCTION PRINT)))

(DE PrintFPStep (deg coeff variable)
  (PROG (AA Vars AO!+ AO!* AO!^)
	(SETQ AA (CDR (ASSOC 'PBOUT AOModes)))
	(SETQ AO!+ (CADDR AA))
	(SETQ AA (CDDDDR AA))
	(SETQ AO!* (CAR AA))
	(SETQ AO!^ (CADR AA))
	(PRIN2 AO!+)
	(PRIN2 coeff)
	(PRIN2 AO!*)
	(PRIN2 variable)
	(PRIN2 AO!^)
	(PRINT deg) ))


(DE CLEARPBSERIES ()
 (PROGN (SETQ HILBERTSERIES NIL)
	(SETQ INVHILBERTSERIES NIL)
	(SETQ SIMPLEPBSERIES NIL)
	(SETQ DOUBLEPBSERIES NIL)
	(COND (RIGHTMONFACTORS
	       (TCONCPTRCLEAR RIGHTMONFACTORS)
	       (SETQ RMFplace (CAR RIGHTMONFACTORS))))
	(COND (cRightMonFactors
	       (TCONCPTRCLEAR cRightMonFactors))) ))

(ON EOLINSTRINGOK)

(DE PBINIT ()
 (PROGN (COND ((NOT EMBDIM)
	       (SETQ EMBDIM
		     (COND (OutVars (LENGTH OutVars))
			   (InVars (LENGTH InVars))
			   (T (PRIN2 "You didn't supply the EMBDIM;
now type it in here: ") (READ))))))
	(SETQ DOUBLEPBSERIES (LIST (CONS 1 (CONS EMBDIM 1))
				   (CONS 0 (CONS 1 0))))
	(SETQ INVHILBERTSERIES (LIST (CONS 1 (MINUS EMBDIM))
				     (CONS 0 1)))
	(SETQ HILBERTSERIES (LIST (CONS 1 EMBDIM)
				   (CONS 0 1)))
	(COND ((NOT !*NOBIGNUM)
	       (COND (BigNumbFile (EVAL (LIST 'LOAD BigNumbFile))))))
	(SETQ LastDeg 1) ))

(OFF EOLINSTRINGOK)





%  Mainly for initiation processes: We may wish to `calculate' the
% Hilbert series of a polynomial ring.

(DE noncommCALCPOLRINGHSERIES (var!#)
 (PROGN	(SETQ HILBERTDENOMINATOR
	      (LIST (CONS 0 1)
		    (CONS 1 (MINUS (GETVARNO)))))
	(SETQ HILBERTNUMERATOR (NCONS (CONS 0 1))) ))




(DE HSeriesNonCommify ()
 (PROG	(!*USERMODE !*REDEFMSG)
%	(COPYD 'GBASIS2HSERIESMONID 'noncommGBASIS2HSERIESMONID)
%	(COPYD 'CALCRATHILBERTSERIES 'noncommCALCRATHILBERTSERIES)
	(COPYD 'CALCRATHILBERTSERIES 'NILNOOPFCN0)
	(COPYD 'TDEGREEHSERIESOUT 'noncommTDEGREEHSERIESOUT)
	(COPYD 'CALCPOLRINGHSERIES 'noncommCALCPOLRINGHSERIES)
))


		%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%
		%%%				%%%
		%%% Strategic Hilbert series	%%%
		%%% comparison auxiliaries and	%%%
		%%% high level procedures	%%%
		%%%				%%%
		%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%


%  The following global variables should ONLY be accessible by the
% procedures in this section. Hence, they should be REMoved from the OBlist
% at the end of the section. (HOWEVER, there seems to be a bug
% in the memory handling of REMOBbed objects?)

(GLOBAL '(PreStoredHSeries!*!& PreStoredHSeriesDefault!*!&))

%  IGNORECDEG as a value of GETHSERIESMINIMUM should mean "Ignore
% the current degree, since no new Gbe's are expected here".
%  Similarly, SKIPCDEG should mean "Process the input polynomials of
% the current degree in ordinary manner, but skip all possible SPairs
% of this degree".
%  They should be user friendly, whence eval troubles should be avoided:

(SETQ IGNORECDEG 'IGNORECDEG)
(SETQ INPUTONLY 'INPUTONLY)
(SETQ SKIPCDEG 'SKIPCDEG)


%  SETHSERIESMINIMA should be rather flexible, whence a FEXPR.
%  For now, it handles the following cases:
% a) An ALIST, whose item CARs are nonnegative integers ("degrees")
%    and whose CDRs are the same (= minimal Hilbert function values
%    of the degrees). All degrees should be equal.
% b) The same, and exactly ONE item (DEFAULT . <defaultdef>) (as
%    specified below).
% c) A list of nonnegative integers, forming the first minimal Hilbert
%    series values from Hilb(0) and up.
% d) The same, but the list ending in ( ... DEFAULT . <defaultdef>).
%  Here DEFAULT is the interned identifier with this name, and
% <defaultdef> should be either an atom or a function body using one
% single variable HSDEG, or a list with one of the preceeding types as
% its single item.
%  The atom or function body (with the current degree substituted for
% HSDEG) should eval to NIL, T, IGNORECDEG, SKIPCDEG, or a nonnegative
% integer. NIL stands for "Ignore the limitations"; T stands for
% "Immediately finish the Groebner basis calculation"; IGNORECDEG stands
% for "Ignore this degree"; SKIPCDEG stands for "Only process input
% polynomials of this degree".  The input should be tested to be on
% one of these forms, and if not, an error should be generated.
% However, there will be no real test of the correctness of the
% DEFAULT expression.


(DF SETHSERIESMINIMUMDEFAULT (uu)
 (COND	((OR (EQ uu 'HSDEG) (AND (PAIRP uu) (EQ (CAR uu) 'HSDEG)))
	 (SETQ PreStoredHSeriesDefault!*!&
	       (LIST 'LAMBDA (NCONS 'HSDEG) 'HSDEG)))
	((ATOM uu)
	 (SETQ PreStoredHSeriesDefault!*!& uu))
	((AND (ATOM (CAR uu)) (NOT (CDR uu)))
	 (SETQ PreStoredHSeriesDefault!*!& (CAR uu)))
	((NOT (CDR uu))
	 (SETQ PreStoredHSeriesDefault!*!&
	       (LIST 'LAMBDA (NCONS 'HSDEG) (CAR uu))))
	(T
	 (SETQ PreStoredHSeriesDefault!*!&
	       (LIST 'LAMBDA (NCONS 'HSDEG) uu)))) )


(DF SETHSERIESMINIMA (uu)
 (PROG	(rt rp pn) % Return list; return list position; position number.
	(COND ((OR (NULL uu) (AND (PAIRP uu) (NOT (CAR uu)) (NULL (CDR uu))))
	       (RETURN (SETQ PreStoredHSeries!*!& NIL)))
	      ((NOT (PAIRP uu))
	       (GO Err))
	      ((ATOM (CAR uu))
	       (COND ((EQ (CAR uu) 'DEFAULT)
		      (RETURN (EVAL (CONS 'SETHSERIESMINIMUMDEFAULT
					  (CDR uu)))))
		     (T
		      (SETQ rp uu)
		      (SETQ rt (TCONC NIL NIL))
		      (SETQ pn 0)
		      (GO Al))))
	      ((NOT (DPLISTP uu))
	       (GO Err)))

	% The alist case.
	(SETQ rt (DPLISTCOPY uu))
	(COND ((SETQ rp (ASSOC 'DEFAULT rt))
	       (SETQ rt (DELETE rp rt))
	       (COND ((ASSOC 'DEFAULT rt)
		      (ERROR 99
		       "Trying to set DEFAULT twice in SETHSERIESMINIMA")))
	       (EVAL (CONS 'SETHSERIESMINIMUMDEFAULT (CDR rp)))))
	(SETQ rp rt)
  Ml	(COND ((NULL rp)
	       (SETQ PreStoredHSeries!*!& rt)
	       (RETURN T))
	      ((OR (NOT (NUMBERP (CAAR rp)))
		   (ASSOC (CAAR rp) (CDR rp))
		   (NOT (OR (NUMBERP (CDAR rp))
			    (NOT (CDAR rp))
			    (EQ (CDAR rp) 'IGNORECDEG)
			    (EQ (CDAR rp) 'INPUTONLY)
			    (EQ (CDAR rp) 'SKIPCDEG)
			    (EQ (CDAR rp) T))))
	       (GO Err)))
	(SETQ rp (CDR rp))
	(GO Ml)

	% The list of integers case.
  Al	(COND ((NOT (OR (NUMBERP (CAR rp))
			(NOT (CAR rp))
			(EQ (CAR rp) 'IGNORECDEG)
			(EQ (CAR rp) 'INPUTONLY)
			(EQ (CAR rp) 'SKIPCDEG)
			(EQ (CAR rp) T)))
	       (GO Err)))
	(TCONC rt (CONS pn (CAR rp)))
	(COND ((NOT (SETQ rp (CDR rp)))
	       (SETQ PreStoredHSeries!*!& (CDAR rt))
	       (RETURN T))
	      ((NOT (PAIRP rp))
	       (GO Err))
	      ((EQ (CAR rp) 'DEFAULT)
	       (SETQ PreStoredHSeries!*!& (CDAR rt))
	       (RETURN (EVAL (CONS 'SETHSERIESMINIMUMDEFAULT
				   (CDR rp))))))
	(SETQ pn (ADD1 pn))
	(GO Al)

  Err	(ERROR 99 "Bad argument to SETHSERIESMINIMA") ))



(DE GETHSERIESMINIMUM (tdeg)
 (PROG	(rt)
	(COND ((SETQ rt (ASSOC tdeg PreStoredHSeries!*!&))
	       (RETURN (CDR rt)))
	      ((ATOM PreStoredHSeriesDefault!*!&)
	       (RETURN (EVAL PreStoredHSeriesDefault!*!&))))
	(RETURN (APPLY PreStoredHSeriesDefault!*!& (NCONS tdeg))) ))


(DE GETHSERIESMINIMA ()
 (NCONC (commHlbCopyNum PreStoredHSeries!*!&)
	(NCONS
	 (CONS 'DEFAULT
	       (COND ((AND (PAIRP PreStoredHSeriesDefault!*!&)
			   (EQ (CAR PreStoredHSeriesDefault!*!&)
			       'LAMBDA))
		      (CADDR PreStoredHSeriesDefault!*!&))
		     (T
		      PreStoredHSeriesDefault!*!&))))) )

(DE CLEARHSERIESMINIMA ()
 (PROGN (SETHSERIESMINIMA) (SETHSERIESMINIMUMDEFAULT)) )


 % (MAPC '(PreStoredHSeries!*!& PreStoredHSeriesDefault!*!&) (FUNCTION REMOB))






%# HSeriesCommify () : - ;
(DE HSeriesCommify ()
 (PROG	(!*USERMODE !*REDEFMSG)
	(COPYD 'GBASIS2HSERIESMONID 'commGBASIS2HSERIESMONID)
	(COPYD 'CALCRATHILBERTSERIES 'commCALCRATHILBERTSERIES)
	(COPYD 'TDEGREEHSERIESOUT 'commTDEGREEHSERIESOUT)
	(COPYD 'CALCPOLRINGHSERIES 'commCALCPOLRINGHSERIES)
%	(COPYD 'SETHSERIESMINIMA 'commSETHSERIESMINIMA)
%	(COPYD 'SETHSERIESMINIMUMDEFAULT 'commSETHSERIESMINIMUMDEFAULT)
%	(COPYD 'GETHSERIESMINIMUM 'commGETHSERIESMINIMUM)
%	(COPYD 'GETHSERIESMINIMA 'commGETHSERIESMINIMA)
))

%# HSeriesOrdWeights () : - ;
(DE HSeriesOrdWeights ()
 (PROG	(!*USERMODE !*REDEFMSG)
	(COPYD 'FindNewTor2RMF 'ordweightsFindNewTor2RMF)
))

%# HSeriesAltWeights () : - ;
(DE HSeriesAltWeights ()
 (PROG	(!*USERMODE !*REDEFMSG)
	(COPYD 'FindNewTor2RMF 'altweightsFindNewTor2RMF)
))

(COND ((NonCommP) (HSeriesNonCommify))
      (T (HSeriesCommify)))

(COND ((GETWEIGHTS) (HSeriesAltWeights))
      (T (HSeriesOrdWeights)))

% Temporary measure, to ensure backwards compatibility:

(SETQ  !*PrintSerSteps T)

(ON RAISE)
