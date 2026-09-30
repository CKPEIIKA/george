%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%
%% Copyright (C) 1992,1994,1996,1998,1999,2002,2003,2005,2006
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

%	CHANGES COMPARED TO bergman 0.8: (For older changes, see ...)

%  Added ExtraNGroeb and FindExtraNGbe./JoeB 2006-08-16

%  Added new intervener CUSTENDDEGREE./JoeB 2006-08-10

%  Introducing 'instable' and 'itemwise' variants, and corresponding
% mode changers.  In the new instable variants new Grobner generators
% are (or should be) constructed regardless of total degrees.
% They are saved on two structures: In increasing monoid order, on
% GBasis; and degreewise in order of time being found, on rGBasis.
% /JoeB, August 2006

%  Improved macrification of SPolautoPrep.  Introduced
% SPolPrepInsertOrProlong, and emplyed it in commSPolPrep.
% /JoeB 2006-08-09

%  Replaced DEGLIST2LIST by DEGORITEMLIST2LIST./JoeB 2006-08-06

%  Introduced the prefixes stable/instable and deg/item.
% /JoeB 2006-08-01 -- 08-11

%  commSPolPrep now calls SPolPrepInsert.  The latter does not redefine
% SPairs./JoeB 2005-07-30

%  GROEBNERKERNEL now interrupts and returns Trivial, if a constant
% is found./JoeB 2004-10-10

%  Introduced a call to LOADIFMACROS in MainStrategyInit.
% /JoeB 2003-11-04

%  Replaced *NONCOMMUTATIVE by ((Non)CommP)./JoeB 2003-08-25

%  Added ADDADDITIONALRELATIONS, and a facultative call to it in
% MainStrategyInit./JoeB 2002-10-11 -- 12

%  PBSERIESFILE!*, !*PBSisLoaded --> HSERIESFILE!*, !*HSisLoaded.
% /JoeB 1999-11-04

%  GETD --> DEFP./JoeB 1999-07-02

%  Constituted a separate SeriesInit./JoeB 1999-06-29 -- 30

%  Corrected non-standard GROEBNERKERNEL call to test for numerical
% cDeg before passing to MlEnd./JoeB 1997-10-12

%  Moved mode changers to modes.sl./JoeB 1997-09-17

%  Moved LPUT, LGET to monom.sl./JoeB 1996-10-11

%  Added types./JoeB 1996-08-06

%  Made copying of definitions of (non)commALGFORMINPUT conditional.
% /JoeB 1996-07-26

%  Moved the check on whether to consider cInPols or cSPairs from the
% definition of FindInputNGbe back to the S(econd)l(oop) in
% GROEBNERKERNEL, since the choice between repeating Sl and calling
% FindSP2r should be decided by this and not by the outcome of
% calling FindInputNGbe./JoeB 1996-07-20

%  Added a new initiator and a new intervener, ResolutionInit and
% ResolutionFixcDegEnd, to be used e. g. by the Anick module/programme.
% /JoeB 1996-06-21--24

%  Changed niMonInit to MonomialInit./JoeB 1996-06-17

%  Moved FixNGbe to 'strategy'.  Introduced new fixers: StratFixcDegEnd,
% FixMainStratInit.  Modularised GROEBNERINIT, now calling
% MainStrategyInit and nGbeStratInit (the latter being defined in
% 'strategy').  Introduced HSeries(Non)Commify (from the new 'series'
% module).  Introduced new potential customer intervention points:
% with CUSTSHOW on, CUSTDISPLAYINIT if defined supplants DisplayInit.
% /JoeB 1996-04-25 -- 05-10.

%  Moved the decision on how to set the redor priorities to a new
% procedure CALCREDUCTORPRIORITY, defined e.g. in strategy./JoeB 1996-04-22

%  Modularised GROEBNERKERNEL to a much higher extent.
%  Now this directly or indirectly calls FindNewcDeg, FixNcDeg,
% FindInputNGbe, FindSP2r, FindCritPairNGbe; and FixNGbe (formerly
% FixNGBasElt) has a similar (and thus extended) function.
% (The idea of the change is to facilitate strategy mode changing.)
%  Replaced GBasElt by Gbe in function names.
%  Collected ALL 'Critical Pairs' finding to the end of current degree
% (within DEnSPairs).  The SPolPrep variants now work with augSP rather
% than SPairs directly, and do not return.  augSP and SPairs resetting
% is handled entirely by DEnSPairs.  Thus commSPolPrep, SPolautoPrep,
% noncommSPolPrep, and SPolPrepInsert are changed.
%  Added a flag !*CUSTSTRATEGY, which if ON leads to the execution of
% those of the functions CUSTNEWCDEGFIX, CUSTNEWINPUTGBEFIND,
% CUSTCRITPAIRTONEWGBE, and CUSTENDDEGREECRITPAIRFIND, that the
% `customer' has defined./JoeB 1996-04-19

(OFF RAISE)


% Import: MONLESSP, ReducePol, SPolInputs, MonInsert, SubtractRedor,
%	  DEGREEOUTPUT, ENDDEGREEOUTPUT, BIGOUTPUT, MonReclaim, Redand2Redor,
%	  FormSPol, MonomialInit, LCorOUT, TDEGREECALCULATEPBSERIES, PBINIT,
%	  ELIMPAIRS, nGbeStratInit, DomainInit, ListMonFactorP, ReclaimInit,
%	  UNSIGNLC, CALCREDUCTORPRIORITY, FixNcDeg, StratFixcDegEnd,
%	  LOADIFMACROS, AUTOADDRELATIONSTATE;
%	  *CUSTSHOW, *SAVEDEGREE, *PBSERIES, NOOFNILREDUCTIONS, Modulus,
%	  HSERIESFILE!*, MONONE.
% Export: LPUT, LGET, LPUT-LGET, SeriesInit; NOOFSPOLCALCS,
%	  !*IMMEDIATEFULLREDUCTION, !_IBID, !*IMMEDIATECRIT,
%	  ADDADDITIONALRELATIONS.
% Optional input: DEGREEENDDISPLAY.

%Try at a GR\BNER programme.  It is to be tailored for cyclic n-root problems;
% thus flexibility is sacrificed for (hopefully?) efficiency.  Only HOMOGENEOUS
% input, and TOTAL DEGREE - REVERSE LEXICOGRAPHICAL ordering is considered.
% Variables however are planned to be allowed to have different weights - like
% in Macaulay.  (At present, only weights 1 are allowed.)

% In the non-commutative version of the GR\BNER programme, only HOMOGENEOUS
% input, and TOTAL DEGREE - LEXICOGRAPHICAL ordering is considered.

% New Grobner generators are constructed degree for degree.  They are always
% reduced modulo all so far constructed basis elements, except possibly
% the last one.  They are saved on an intricate structure, where new ?
% monomials very fast may be checked for having a basis element leading ?
% monomial factor or not. ?

% In itemwise and/or instable mode, new Grobner generators may be
% constructed regardless of total degrees.  They may be saved on two
% structures: In increasing monoid order, on  GBasis; and in order of
% time being found, on tGBasis; or, also degree-wise, on rGBasis.

% Meanings of the globals: Dictionary for the input variables (ordered
% REVERSELY); linear reductors; output dictionary for short form monomials;
% reduction "check list"; Possibly future S-polynomial pairs to check of
% higher degrees; the same, of the current degree; the Grobner basis
% (before the final phase, WITHOUT linear reductors); the new Grobner basis
% elements found; (the Grobner basis ordered by time and the unprocessed
% ones of these, NOT USED;) The Groebner basis on `rectangular' form; the
% current degree under consideration; the in-polynomials; the same, of the
% current degree; customised display at end-of-degree flag; save results at
% end-of-degree flag; the number of S-polynomials calculated so far;
% Poincare-Betti series feature flag; immediate full reduction
% of old Groebner basis elements by means of newfound ones flag;
% Non-commutative domain flag; Monoidal domain (= binomial case) flag;
% Immediate critical pair elimination flag; Maximal considered degree;
% augmented SPairlist (for use in SPolPrep; the number of calls to
% ReducePol (etc.) with zero argument so far); HSeries file loaded flag;
% the monoid ordering ("term order") when commutativity is in force;
% Make leading coefficients (in output) positive; Coefficient field
% characteristic; Name of the Poincare Betti auxiliary procedures file.

% Presently Reductors and RCheck are not used.

(GLOBAL '(Reductors RCheck SPairs cSPairs GBasis cGBasis %% tGBasis uGBasis
	  rGBasis cDeg InPols cInPols !*CUSTSHOW !*SAVEDEGREE
	  NOOFSPOLCALCS !*PBSERIES !*IMMEDIATEFULLREDUCTION !*MONOIDAL
	  !*IMMEDIATECRIT MAXDEG augSP NOOFNILREDUCTIONS !*HSisLoaded
	  commMONORDER Modulus HSERIESFILE!* !*CUSTSTRATEGY
	  !*OLDPRINTMODES1 MONONE))

%# NGroeb : augpol/augmon/NIL ;
%# Pek : laugmon ;
%# !_IBID : any ;
%# cMon : augmon/NIL ;
%# SP2r : any ;
(FLUID '(NGroeb Pek !_IBID cMon SP2r ExtraNGroeb))

(ON IMMEDIATEFULLREDUCTION)
(OFF MONOIDAL)

% Coefficient manipulation handling may be expensive.  The choice of integers
% or rationals for coefficients may decide whether or not to assume leading
% monomials to have coefficient 1.

% MAIN PROGRAMME:

%# GROEBNERKERNEL () : genid ; RESET
%	Meaning of PROG variables: New Groebner base element; S-Pols to reduce;
%	current Monomial.

(DE stabledegGROEBNERKERNEL ()
 (PROG (NGroeb SP2r cMon)

%	For some non-standard applications, and for empty input:
  (COND ((NOT (OR InPols SPairs))
	 (COND ((OR cInPols cSPairs) (GO Sl))
	       ((NUMBERP cDeg) (GO MlEnd))
	       (T (RETURN NIL)))))

%	Main loop: Find a new current degree cDeg and initiate it.
 Ml
  (COND ((NOT (FindNewcDeg))
	 (RETURN NIL)))

%	Subloop: Pick (in the first place) a new LCM of Lead(ing )Mon(omial)s,
%	or (else) a new input polynomial; reduce in order to find new Gbe's.
 Sl
  (COND ((NOT (OR cSPairs cInPols))
	 (GO MlEnd))
	((OR (NOT cSPairs)
	     (AND cInPols (NOT (Mon!= (APol2Lm (CAR cInPols)) (CAR cSPairs)))
		  (MONLESSP (APol2Lpmon (CAR cInPols)) (PMon (CAR cSPairs)))))
	 (COND ((FindInputNGbe) (FixNGbe)))
	 (GO Sl)))
  (degFindSP2r)

%	PairList check:
 PLchk
  (COND ((NOT SP2r)
	 (GO Sl))
	((FindCritPairNGbe)
	 (FixNGbe)))
  (GO PLchk)

%	The degree cDeg is fully investigated, and the result is to be saved
%	(and perhaps to be displayed).
%	If we simultaneously calculate PBseries, then we do it NOW.
 MlEnd
  (COND ((AND (GETCUSTSTRATEGY) (DEFP 'CUSTENDDEGREE) (CUSTENDDEGREE))
	 (GO Ml)))
  (MAPC (CDR cGBasis) (FUNCTION FixGbe))
  (COND (!*CUSTSHOW (DEGREEENDDISPLAY))
	((COND (!*PBSERIES (TDEGREECALCULATEPBSERIES cDeg))))
	(!*SAVEDEGREE (DEGREEOUTPUT)))

  (DEnSPairs)
  (MonReclaim)
  (APPLYIFDEF0 '(ResolutionFixcDegEnd))
  (StratFixcDegEnd)
  (COND ((AND (BMI!= cDeg 0) (MEMQ MONONE GBasis)) (RETURN 'Trivial))
	((OR InPols SPairs) (GO Ml)))
  (RETURN 'Done) ))


% MAIN PROGRAMME, VARIANT IN VERY INHOMOGENEOUS SITUATIONS:

%# itemGROEBNERKERNEL () : genid ;
%	Meaning of PROG variables: New Groebner base element; S-Pols to reduce;
%	current Monomial.

(DE stableitemGROEBNERKERNEL ()
 (PROG (NGroeb SP2r cMon)

%	For some non-standard applications, and for empty input:
  (COND ((NOT (OR InPols SPairs))
	 (RETURN NIL)))

%	Main loop: Pick (in the first place) a new LCM of Lead(ing )Mon(omial)s,
%	or (else) a new input polynomial; reduce in order to find new Gbe's.
 Ml
  (COND (SP2r
	 (COND ((NOT (FindCritPairNGbe)) (GO Ml))))
	((NOT (OR SPairs InPols))
	 (RETURN 'Done))
	((OR (NOT SPairs)
	     (AND InPols (NOT (Mon!= (APol2Lm (CAR InPols)) (CAR SPairs)))
		  (MONLESSP (APol2Lpmon (CAR InPols)) (PMon (CAR SPairs)))))
	 (COND ((NOT (itemFindInputNGbe)) (GO Ml))))
	(T
	 (itemFindSP2r)
	 (GO Ml)))

%	A new Groebner basis element (NGroeb) is found, and the result is to be saved
%	(and perhaps to be displayed).
%	If we simultaneously calculate PBseries, then we do it NOW.

  (FixNGbe)
%  (MAPC (CDR cGBasis) (FUNCTION FixGbe))
%  (COND (!*CUSTSHOW (DEGREEENDDISPLAY))
%	((COND (!*PBSERIES (TDEGREECALCULATEPBSERIES cDeg))))
%	(!*SAVEDEGREE (DEGREEOUTPUT)))

  (COND ((Mon!= MONONE NGroeb)
	 (RETURN 'Trivial)))

  (itemnSPairs)
%  (MonReclaim)
%  (APPLYIFDEF0 '(ResolutionFixcDegEnd))
%  (StratFixcDegEnd)
%  (COND ((MEMQ MONONE GBasis)
%	 (RETURN 'Trivial)))
  (GO Ml) ))



%  In the instable variants of GROEBNERKERNEL, there is a third kind of
% sources for new Gbe's: head term reductions of old ones.  (We save these
% as the CDR of a tail part, uGBasis, of the entry time ordered Groebner
% basis tGBasis, until they are properly processed.)  No, instead, we
% first save them as ordinary ambiguities; and when a new polynomial was
% found in this way, on the new fluid variable ExtraNGroeb.

%  THIS MIGHT BE STUPID.  Perhaps it is better to store info as `special
% SPairs' instead!

(DE instableitemGROEBNERKERNEL ()
 (PROG (NGroeb SP2r cMon ExtraNGroeb)

%	For some non-standard applications, and for empty input:
  (COND ((NOT (OR InPols SPairs % (CDR uGBasis)
		  ))
	 (RETURN NIL)))

%	Main loop: Pick (in the first place) a new LCM of Lead(ing )Mon(omial)s,
%	or (else) a new input polynomial; reduce in order to find new Gbe's.
 Ml
  (COND (ExtraNGroeb % (PRIN2T "ExtraNGroeb case:")
	 (COND ((NOT (FindExtraNGbe)) (GO Ml))))
	(SP2r % (PRIN2T "SP2r case:")
	 (COND ((NOT (FindCritPairNGbe)) (GO Ml))))
	((NOT (OR SPairs InPols))
	 (RETURN 'Done))
	((OR (NOT SPairs)
	     (AND InPols (NOT (Mon!= (APol2Lm (CAR InPols)) (CAR SPairs)))
		  (MONLESSP (APol2Lpmon (CAR InPols)) (PMon (CAR SPairs)))))
	 % (PRIN2T "OR case:")
	 (COND ((NOT (itemFindInputNGbe)) (GO Ml))))
	(T % (PRIN2 "SPairs case: ")
	 (itemFindSP2r) % (PRIN2T "... after itemFindSP2r")
	 (GO Ml)))

%	A new Groebner basis element (NGroeb) is found, and the result is to be saved
%	(and perhaps to be displayed).
%	If we simultaneously calculate PBseries, then we do it NOW.

  (FixNGbe)
%  (MAPC (CDR cGBasis) (FUNCTION FixGbe))
%  (COND (!*CUSTSHOW (DEGREEENDDISPLAY))
%	((COND (!*PBSERIES (TDEGREECALCULATEPBSERIES cDeg))))
%	(!*SAVEDEGREE (DEGREEOUTPUT)))

  (COND ((Mon!= MONONE NGroeb)
	 (RETURN 'Trivial)))

  (itemnSPairs)
%  (MonReclaim)
%  (APPLYIFDEF0 '(ResolutionFixcDegEnd))
%  (StratFixcDegEnd)
%  (COND ((MEMQ MONONE GBasis)
%	 (RETURN 'Trivial)))
  (GO Ml) ))

(COPYD 'instableGROEBNERKERNEL 'instableitemGROEBNERKERNEL)


%# GROEBNERINIT () : - ; RESET
(DE stableGROEBNERINIT ()
 (PROGN	(MonomialInit)
	(DomainInit)
	(ReclaimInit)
	(MainStrategyInit)
	(nGbeStratInit)
	(SeriesInit)
	(COND (!*PBSERIES (PBINIT)))
	(DisplayInit)
	(APPLYIFDEF0 '(ResolutionInit))
 ))

(DE instableitemGROEBNERINIT ()
 (PROGN	% (SETQ uGBasis (NCONS NIL))
	% (SETQ tGBasis (CONS uGBasis uGBasis))
	(SETQ rGBasis (NCONS (NCONS NIL)))
	(stableGROEBNERINIT) ))

(COPYD 'instableGROEBNERINIT 'instableitemGROEBNERINIT)


%# GROEBNERFINISH () : - ;
(DE GROEBNERFINISH ()
  (COND ((AND (GETSAVEDEGREE) (EQ (GETPROCESS) 'DEGREEWISE))
	 (ENDDEGREEOUTPUT))
	((AND (GETITEMPRINTOUTPUT)
	      (OR (EQ (GETPROCESS) 'ITEMWISE) (EQ (GETITEMPRINTOUTPUT) T)))
	 (ENDITEMOUTPUT))
	((NOT !*CUSTSHOW)
	 (BIGOUTPUT))) )



% AUXILIARIES:


%  Initiate the main (overall) strategy, by setting appropriate global
% variables et cetera.

%# MainStrategyInit () : - ;
(DE MainStrategyInit ()
 (PROGN	(SETQ SPairs NIL)
	(SETQ cSPairs NIL)
	(SETQ GBasis (NCONS NIL))
	(SETQ cGBasis (NCONS NIL))
	(SETQ cInPols NIL)
	(SETQ augSP (NCONS NIL))
	(COND ((AUTOADDRELATIONSTATE)
	       (LOADIFMACROS ADDADDITIONALRELATIONS)
	       (SETQ InPols
		     (SortlPol (ADDADDITIONALRELATIONS
				  (DEGORITEMLIST2LIST InPols))))))
	(FixMainStratInit) ))


%# FixMainStratInit () : - ;
(DE FixMainStratInit NIL (PROGN NIL))


%# SeriesInit () : - ;
(DE SeriesInit ()
 (COND	(!*PBSERIES
	 (COND ((NOT !*HSisLoaded)
		(EVAL (LIST 'LOAD HSERIESFILE!*))
		(ON HSisLoaded))))) )


%# DisplayInit () : - ;
(DE DisplayInit ()
 (COND	((AND !*CUSTSHOW (DEFP 'CUSTDISPLAYINIT))
	 (CUSTDISPLAYINIT))
	(T
	 (SETQ NOOFSPOLCALCS 0)
	 (SETQ NOOFNILREDUCTIONS 0))) )


% Fundamental definition: 'Do not add further relations'.

(COPYD 'ADDADDITIONALRELATIONS 'IBIDNOOPFCN) % To be defined VU 02-07-07


%  Find a new current degree cDeg and initiate it:
%  (Re)set cSPairs and/or cInPols to the (new) cDeg parts of
% SPairs and InPols respectively, and remove these parts.

%  Intervener: FixNcDeg.  Returns the value of this, which ordinarily
% should be the new value of cDeg.

%# FindNewcDeg () : any ;
(DE FindNewcDeg ()
 (COND	((NOT InPols)
	 (SETQ cDeg (CAAR SPairs))
	 (SETQ cSPairs (CDAR SPairs))
	 (SETQ SPairs (CDR SPairs))
	 (FixNcDeg 2))
	((OR (NOT SPairs) (LESSP (CAAR InPols) (CAAR SPairs)))
	 (SETQ cDeg (CAAR InPols))
	 (SETQ cInPols (CDAR InPols))
	 (SETQ InPols (CDR InPols))
	 (FixNcDeg 1))
	((LESSP (SETQ cDeg (CAAR SPairs)) (CAAR InPols))
	 (SETQ cSPairs (CDAR SPairs))
	 (SETQ SPairs (CDR SPairs))
	 (FixNcDeg 2))
	(T
	 (SETQ cInPols (CDAR InPols))
	 (SETQ InPols (CDR InPols))
	 (SETQ cSPairs (CDAR SPairs))
	 (SETQ SPairs (CDR SPairs))
	 (FixNcDeg 3))) )


%# FindExtraNGbe () : augmon/NIL ; RESET
(DE FindExtraNGbe ()
 (COND	((AND !*CUSTSTRATEGY (DEFP 'CUSTNEWEXTRAGBEFIND))
	 (CUSTNEWEXTRAGBEFIND))
	(T
	 (SETQ NGroeb (ReducePol ExtraNGroeb))
	 (SETQ ExtraNGroeb NIL)
	 NGroeb)) )

%  If appropriate, prepare a new GBasis element from the first (c)InPols
% element.  Then, save result as new NGroeb value, and return this.
% Else, return nil.

%# FindInputNGbe () : augmon/NIL ; RESET
(DE degFindInputNGbe ()
 (COND	((AND !*CUSTSTRATEGY (DEFP 'CUSTNEWINPUTGBEFIND))
	 (CUSTNEWINPUTGBEFIND))
	(T
	 (SETQ NGroeb (ReducePol (CAR cInPols)))
	 (SETQ cInPols (CDR cInPols))
	 NGroeb)) )

(DE itemFindInputNGbe ()
 (COND	((AND !*CUSTSTRATEGY (DEFP 'CUSTNEWINPUTGBEFIND))
	 (CUSTNEWINPUTGBEFIND)) % ?? Perhaps anothe customising procedure?
	(T
	 (SETQ NGroeb (ReducePol (CAR InPols)))
	 (SETQ InPols (CDR InPols))
	 NGroeb)) )


%  Using one or several (c)SPairs items (and removing these),
% make a list of "S-Polynomial pairs to reduce" as SP2r.

%# FindSP2r () : - ; RESET
(DE degFindSP2r ()
 (PROGN (SETQ SP2r (SPolInputs (SETQ cMon (CAR cSPairs))))
	(SETQ cSPairs (CDR cSPairs)) ))

(DE itemFindSP2r ()
 (PROGN (SETQ SP2r (SPolInputs (SETQ cMon (CAR SPairs))))
	(SETQ SPairs (CDR SPairs)) ))


%  Assuming SP2r is non-empty, investigate it for new GBasis
% element, eliminating the appropriate parts of it.
%  Should terminate non-NIL iff a new Gbe is to be treated in the
% ordinary manner.

%# FindCritPairNGbe () : any ;
(DE FindCritPairNGbe ()
 (COND	((AND !*CUSTSTRATEGY (DEFP 'CUSTCRITPAIRTONEWGBE))
	 (CUSTCRITPAIRTONEWGBE))
	(T
	 (SETQ NGroeb
	       (ReducePol (FormSPol cMon (CAAR SP2r) (CDAR SP2r) (CDR SP2r))))
	 (COND ((NonCommP)
		(SETQ SP2r NIL))
	       (T
		(SETQ SP2r (CDR SP2r))))
	 NGroeb)) )


%# FixGbe (augmon) : - ;
(DE FixGbe (mon)
 (PROGN %(Redand2Redor (PPol (Mpt  mon)))
	(PreenRedor (Mpt mon))
	(COND (!*IMMEDIATECRIT (ELIMPAIRS mon)))
	(PutredPriority (Mpt mon)
			(CALCREDUCTORPRIORITY mon)) )) % 1996-04-222/JoeB


%# DEnSPairs () : - ;
(DE DEnSPairs ()	% Degree-End new SPairs
% New potential SPolynomials formed among the new Groebner basis elements?
 (PROG	(Pek)
	(COND ((AND !*CUSTSTRATEGY (DEFP 'CUSTENDDEGREECRITPAIRFIND))
	       (RETURN (CUSTENDDEGREECRITPAIRFIND)))
	      ((AND MAXDEG (NOT (LESSP cDeg MAXDEG)))
	       (RETURN NIL)))
	(RPLACD augSP SPairs)
	(SETQ Pek (CDR cGBasis))
  SPl	(COND (Pek
	       % New potential critical pairs formed from mon and itself?
	       (COND ((NonCommP)
		      (SPolautoPrep (CAR Pek))))
	       % New potential critical pairs formed from mon and old Gbe's?
	       (MAPC (CDR GBasis)
		     (FUNCTION (LAMBDA (A!*R!*G)
				       (SPolPrep (CAR Pek) A!*R!*G))))
	       % New potential critical pairs formed from mon and new Gbe's?
	       (MAPC (CDR Pek)
		     (FUNCTION (LAMBDA (A!*R!*G)
				       (SPolPrep (CAR Pek) A!*R!*G))))
	       (SETQ Pek (CDR Pek))
	       (GO SPl)))
	(SETQ SPairs (CDR augSP))
	(RPLACD augSP ()) ))



%# itemnSPairs () : - ;
(DE itemnSPairs ()	% Item-wise new SPairs
% New potential SPolynomials formed by means of the new Groebner basis element?
 (PROG	(Pek) % Should cDeg be local to itemSPairs, too?
	(COND ((AND !*CUSTSTRATEGY (DEFP 'CUSTITEMCRITPAIRFIND))
	       (RETURN (CUSTITEMCRITPAIRFIND)))
	      ((AND (GETMAXDEG) (NOT (LESSP cDeg (GETMAXDEG))))
	       (RETURN NIL)))
	(RPLACD augSP SPairs)
	(SETQ Pek (CDR GBasis))
	% New potential critical pairs formed from mon and itself?
	(COND ((NonCommP)
	       (SPolautoPrep NGroeb)))
	% New potential critical pairs formed from mon and old Gbe's?
  Ml	(COND ((NOT (Mon!= NGroeb (CAR Pek)))
	       (SPolPrep NGroeb (CAR Pek))))
	(COND ((SETQ Pek (CDR Pek))
	       (GO Ml)))
	(SETQ SPairs (CDR augSP))
	(RPLACD augSP ())

	% From FixGbe:
	(COND (!*IMMEDIATECRIT (ELIMPAIRS NGroeb))) ))

%% (COPYD 'stableitemnSPairs 'itemnSPairs)

%% %# instableitemnSPairs () : - ;
%% (DE instableitemnSPairs ()
%%  (PROG	(Pek)
%% 	(COND ((AND !*CUSTSTRATEGY (DEFP 'CUSTITEMCRITPAIRFIND))
%% 	       (RETURN (CUSTITEMCRITPAIRFIND)))
%% 	      ((AND (GETMAXDEG) (NOT (LESSP cDeg (GETMAXDEG))))
%% 	       (RETURN NIL)))
%% 	(RPLACD augSP SPairs)
%% 	(SETQ Pek (CDR GBasis))
%% 	% New potential critical pairs formed from mon and itself?
%% 	(COND ((NonCommP)
%% 	       (SPolautoPrep NGroeb)))
%% 	% New potential critical pairs formed from mon and old Gbe's?
%%   Ml	(COND ((NOT (Mon!= NGroeb (CAR Pek)))
%% 	       (SPolPrep NGroeb (CAR Pek))))
%% 	(COND ((SETQ Pek (CDR Pek))
%% 	       (GO Ml)))
%% 	(SETQ SPairs (CDR augSP))
%% 	(RPLACD augSP ())

%% 	% From FixGbe:
%% 	(COND (!*IMMEDIATECRIT (ELIMPAIRS NGroeb))) ))


%# FixEndDegreeThings () : - ;
(DE FixEndDegreeThings ()
 (COND ((AND MAXDEG (NUMBERP MAXDEG) SPairs)
	(PROG (cdrsinsp)
	      (SETQ cdrsinsp SPairs)
	      (COND ((LESSP MAXDEG (CAAR cdrsinsp))
		     (SETQ SPairs NIL) % NOTE that their Mpt's aren't changed
		     (RETURN NIL))
		    ((NOT (CDR cdrsinsp)) (RETURN NIL)))
	 Ml   (COND ((LESSP MAXDEG (CAADR cdrsinsp))
		     (RPLACD cdrsinsp NIL)) % NOTE ibid.
		    ((CDR (SETQ cdrsinsp (CDR cdrsinsp)))
		     (GO Ml)))))) )


% The preparation before new S-polynomials are calculated are done in two
% steps.  First the LCM of the two leading monomials is found, and at the same
% time some trivial cases are detected.  At a later phase, ALL pairs with
% the same LCM are considered, and as many of their S-polynomials as found
% necessary by the "component algorithm" are calculated.
%  The first phase is done mainly by SPolPrep.  It uses the auxiliary procedure
% LCorOUT, which is found in 'monomials'.  It
% has the result NIL if the S-polynomial MUST be 0-reducible, and the total-
% degree of the new monomial otherwise.  The monomial itself is saved,
% as a side-effect, in the niMon structure!

%  There is in fact a more general criterion than the "GC is only in last
% variable" one employed here: If the GC of the leading monomials is the
% leading monomial of the GC of the polynomials, then the S-polynomial is
% zero.  I find it doubtful (but not out of the question) that an implementation
% of this would be worth while for our examples.
%  However, in the REVLEX situation  a very special case of this is cheap
% to use: If the GC of the leading monomials is a power of the most
% significant variable (the "last" variable), then this power is a common
% factor of both polynomials, whence the criterion is fulfilled.

%  Changes 1996-04-19: The SPolPrep variants now work with augSP rather
% than SPairs directly, and do not return.
%  Changes 2005-07-30: Now calls SPolPrepInsert, and refers both
% MAXDEG exceedence checking and Mpt assignment to this procedure.
% However, this means that the total degree is calculated twice (in LCorOUT
% and in SPolPrepInsert), which is inefficient.
%  Changes August 2006:
% To avoid having the total degree calculated twice (in LCorOUT
% and in SPolPrepInsert), it now is NEVER calculated in LCorOUT.
% However, SPairs is assigned to (CDR augSP), which seems to be superfluous.
% Moreover, a restoration of the older situation might be advisable, for
% making the MAXDEG inhibition of higher critical pairs calculation more
% efficient.

%  If LCorOUT returns non-NIL to SPolPrep, then the pair mon1,
% mon2 of the two LeadMons of the polynomials to be compared are stored within
% the POINTER of BB, the interned LC of them.  Furthermore, if necessary
% BB is inserted in its proper place in SPairs.

%# commSPolPrep (augmon, augmon) : - ;
(DE commSPolPrep (mon1 mon2)
 (COND	((LCorOUT (PMon mon1) (PMon mon2))
	 (SPolPrepInsertOrProlong (niMonIntern) (CONS mon1 mon2)))) )
%(PROG	(BB)
%	(COND ((NULL (LCorOUT (PMon mon1) (PMon mon2)))
%	       (RETURN NIL))
%	      ((Mpt? (SETQ BB (niMonIntern)))
%	       (RETURN (PutMpt BB (CONS (CONS mon1 mon2) (Mpt BB))))))
%        (SPolPrepInsert BB (NCONS (CONS mon1 mon2))) ))


%  Non-commutative variants:

%# SPolautoPrep (augmon) : - ; RESET
(DE SPolautoPrep (mon)
 (PROG	(AA)
	(SETQ AA (LCauto (PMon mon) cDeg))
	(LPUT (Maplst mon) 'Cycles AA)
  Ml	(COND (AA
	       (SPolPrepInsert (CDAR AA)
			       (CONS (CONS mon mon) (CAAR AA)))
	       (SETQ AA (CDR AA))
	       (GO Ml))) )) % Changed 96-04-19

(COPYD 'stableSPolautoPrep 'SPolautoPrep)

(DE instableSPolautoPrep (mon)
 (PROG	(AA)
	(SETQ AA (LCauto (PMon mon) cDeg))
	(LPUT (Maplst mon) 'Cycles AA)
  Ml	(COND (AA
	       (SPolPrepInsertOrProlong (CDAR AA)
					(CONS (CONS mon mon) (CAAR AA)))
	       (SETQ AA (CDR AA))
	       (GO Ml))) )) % Changed 96-04-19

%# noncommSPolPrep (augmon, augmon) : - ;
(DE noncommSPolPrep (mon1 mon2) % Changed 96-04-19
 (PROGN (SPolPrep1 mon1 mon2)
	(SPolPrep1 mon2 mon1) ))

%# SPolPrep1 (augmon, augmon) : - ; RESET
(DE SPolPrep1 (mon1 mon2)
 (PROG	(AA)
	(SETQ AA (LC2 (PMon mon1) (PMon mon2) (LGET (CDAR mon1) 'Cycles)
		      (LGET (CDAR mon2) 'Cycles)))
  Ml	(COND (AA
	       (COND ((NOT (AND !*IMMEDIATECRIT
				(ELIMNEWPAIR (CDAR AA))))
		      (SPolPrepInsert (CDAR AA)
				      (CONS (CONS mon1 mon2)
					    (CAAR AA)))))
	       (SETQ AA (CDR AA))
	       (GO Ml))) ))

(COPYD 'stableSPolPrep1 'SPolPrep1)

(DE instableSPolPrep1 (mon1 mon2)
 (PROG	(AA)
	(SETQ AA (LC2 (PMon mon1) (PMon mon2) (LGET (CDAR mon1) 'Cycles)
		      (LGET (CDAR mon2) 'Cycles)))
  Ml	(COND (AA
	       (COND ((NOT (AND !*IMMEDIATECRIT
				(ELIMNEWPAIR (CDAR AA))))
		      (SPolPrepInsertOrProlong (CDAR AA)
					       (CONS (CONS mon1 mon2)
						     (CAAR AA)))))
	       (SETQ AA (CDR AA))
	       (GO Ml))) ))


%  Auxiliary.  Should not be exported; might later be replaced by
% further splitting of SPolPrepInsert variants, if the need should arise.

%# bmmainStoreSPData (augmon, any) : - ; RESET
(DE bmmainstableStoreSPData (mon itm) (PutMpt mon itm) )
(DE bmmaininstableStoreSPData (mon itm) (LPUT (Maplst mon) 'SPairs itm) )


%# SPolPrepInsert (augmon, any) : - ; RESET
(DE degSPolPrepInsert (mon itm)
 (PROG	(ap td)	% augSP Position, Total Degree of mon
	(SETQ td (TOTALDEGREE (PMon mon)))
%	(COND ((AND MAXDEG (BMI!< MAXDEG td))
%	       (RETURN NIL)))
	(bmmainStoreSPData mon itm)
	(COND ((NULL (CDR (SETQ ap augSP)))
	       (RETURN (RPLACD ap (NCONS (LIST td mon))))))
  Ml	(COND ((LESSP td (CAADR ap))
	       (RPLACD ap (CONS (LIST td mon) (CDR ap))))
	      ((EQ td (CAADR ap)) (MonInsert mon (CADR ap)))
	      ((CDR (SETQ ap (CDR ap))) (GO Ml))
	      (T (RPLACD ap (NCONS (LIST td mon))))) )) % Changed 96-04-19

%% (DE itemSPolPrepInsert (mon itm)
%%   (COND ((NOT (AND MAXDEG (BMI!< MAXDEG (TOTALDEGREE (PMon mon)))))
%% 	 (bmmainStoreSPData mon itm)
%% 	 (MonInsert mon augSP)
%% 	 (SETQ SPairs (CDR augSP)))) )

(DE itemSPolPrepInsert (mon itm)
 (PROGN	(bmmainStoreSPData mon itm)
	(MonInsert mon augSP)
	(SETQ SPairs (CDR augSP)) ))

% (COPYD 'SPolPrepInsert 'degSPolPrepInsert)

%# SPolPrepInsertOrProlong (augmon, spdatum) : - ; RESET
(DE stableSPolPrepInsertOrProlong (mon itm)
 (PROG	(osp)	% Old S-Pairs at mon
	(COND ((SETQ osp (Mpt mon))
	       (PutMpt mon (CONS itm osp)))
	      (T
	       (SPolPrepInsert mon (NCONS itm)))) ))

(DE instableSPolPrepInsertOrProlong (mon itm)
 (PROG	(osp)
	(COND ((SETQ osp (ATSOC 'SPairs (Mplst mon)))
	       (RPLACD osp (CONS itm (CDR osp))))
	      (T
	       (SPolPrepInsert mon (NCONS itm)))) ))

% (COPYD 'SPolPrepInsertOrProlong 'stableSPolPrepInsertOrProlong)

%	If IMMEDIATECRIT is on, unnecessary pairs should be eliminated
%	as soon as possible, i. e., when a new Gbe is found (by
%	ELIMPAIRS), or a new critical pair is formed (by ELIMNEWPAIR).

%	For the time being, only done for the non-commutative case.
%  Meaning of PROG variables:
% IndeX part, DiFference, SPairs, Current SPair, (Monomial Degree).

%# ELIMPAIRS (augmon) : - ; RESET
(DE degELIMPAIRS (mon)
 (PROG	(ix df sp csp)
	% IndeX part,DiFference,SPairs,Current Spairs.
	(SETQ sp SPairs)
	(SETQ ix (PMon mon))
	% No elimination possible for LCM's of degree cDeg+1:
	(COND ((AND sp (EQ (CAAR sp) (ADD1 cDeg)))
	       (SETQ sp (CDR sp))))
  Ml	(COND ((NOT sp) (RETURN NIL)))
	(SETQ csp (CAR sp))
	(SETQ df (SUB1 (DIFFERENCE (CAR csp) cDeg)))
  Sl	(COND ((EarlyMonFactorP ix (CDR (PMon (CADR csp))) df)
	       (PutMpt (CADR csp) NIL)		% Added 91-09-24
	       (RPLACD csp (CDDR csp)))
	      (T (SETQ csp (CDR csp))))
	(COND ((CDR csp) (GO Sl))
	      ((NOT (CDAR sp))
	       (SETQ SPairs (DELETE (CAR sp) SPairs))))
	(SETQ sp (CDR sp))
	(GO Ml) ))

%# itemELIMPAIRS (augmon) : - ;
(DE itemELIMPAIRS (mon)
 (PROG	(ix df sp csp md)
	(SETQ sp (RPLACD augSP SPairs))
	(SETQ md (TOTALDEGREE (SETQ ix (PMon mon))))
  Ml	(COND ((NOT (CDR sp))
	       (SETQ SPairs (CDR augSP))
	       (RPLACD augSP ())
	       (RETURN NIL)))
	(SETQ csp (PMon (CADR sp)))
	% No elimination possible for LCM's of degree cDeg+1:
	(COND ((LESSP (SETQ df (SUB1 (DIFFERENCE (TOTALDEGREE csp) md))) 2)
	       (SETQ sp (CDR sp)))
	      ((EarlyMonFactorP ix (CDR csp) df)
	       (PutMpt (CADR sp) NIL)
	       (RPLACD sp (CDDR sp)))
	      (T (SETQ sp (CDR sp))))
	(GO Ml) ))

%# ELIMNEWPAIR (augmon) : bool ; RESET
(DE degELIMNEWPAIR (mon)
 (OR (ListMonFactorP (CDR GBasis) (PMon mon))
     (ListMonFactorP (CDR cGBasis) (PMon mon))))

 % Check that the following is not called after mon is put on GBasis! 

(DE itemELIMNEWPAIR (mon)
 (ListMonFactorP (CDR GBasis) (PMon mon)) )


%  MODE CHANGERS.

(DE MainDegreewise ()
 (PROGN	(COPYD 'ELIMNEWPAIR 'degELIMNEWPAIR)
	(COPYD 'ELIMPAIRS 'degELIMPAIRS)
	(COPYD 'SPolPrepInsert 'degSPolPrepInsert)
	(COPYD 'FindInputNGbe 'degFindInputNGbe)
	(COPYD 'FindSP2r 'degFindSP2r)
%	(COPYD 'stableGROEBNERINIT 'stabledegGROEBNERINIT)
%	(COPYD 'instableGROEBNERINIT 'instabledegGROEBNERINIT)
	(COPYD 'stableGROEBNERKERNEL 'stabledegGROEBNERKERNEL)
%	(COPYD 'instableGROEBNERKERNEL 'instabledegGROEBNERKERNEL)
 ))

(DE MainItemwise ()
 (PROGN	(COPYD 'ELIMNEWPAIR 'itemELIMNEWPAIR)
	(COPYD 'ELIMPAIRS 'itemELIMPAIRS)
	(COPYD 'SPolPrepInsert 'itemSPolPrepInsert)
	(COPYD 'FindInputNGbe 'itemFindInputNGbe)
	(COPYD 'FindSP2r 'itemFindSP2r)
%	(COPYD 'stableGROEBNERINIT 'stableitemGROEBNERINIT)
	(COPYD 'instableGROEBNERINIT 'instableitemGROEBNERINIT)
	(COPYD 'stableGROEBNERKERNEL 'stableitemGROEBNERKERNEL)
	(COPYD 'instableGROEBNERKERNEL 'instableitemGROEBNERKERNEL)
 ))

(DE MainStabilise ()
 (PROGN	(COPYD 'SPolPrepInsertOrProlong 'stableSPolPrepInsertOrProlong)
	(COPYD 'bmmainStoreSPData 'bmmainstableStoreSPData)
	(COPYD 'SPolautoPrep 'stableSPolautoPrep)
	(COPYD 'SPolPrep1 'stableSPolPrep1)
	(COPYD 'GROEBNERINIT 'stableGROEBNERINIT)
	(COPYD 'GROEBNERKERNEL 'stableGROEBNERKERNEL)
 ))

(DE MainDestabilise ()
 (PROGN	(COPYD 'SPolPrepInsertOrProlong 'instableSPolPrepInsertOrProlong)
	(COPYD 'bmmainStoreSPData 'bmmaininstableStoreSPData)
	(COPYD 'SPolautoPrep 'instableSPolautoPrep)
	(COPYD 'SPolPrep1 'instableSPolPrep1)
	(COPYD 'GROEBNERINIT 'instableGROEBNERINIT)
	(COPYD 'GROEBNERKERNEL 'instableGROEBNERKERNEL)
 ))

(ON RAISE)
