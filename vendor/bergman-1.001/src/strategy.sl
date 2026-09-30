%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%
%% Copyright (C) 1992,1994,1996,1997,2003,2005 Joergen Backelin
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

% Renamed strategy.sl (from groebcompalg.sl) 1994-09-00.

%	CHANGES:

%  Introduced Strat[Degree/Item]wise, StratStabilise,
% StratDestabilise, bmstrRetrieveSPData, MaybePrintItem, ExtraNGroeb,
% FindExtraNGbe, PruneCommSPData, commGbeSPolInputs, PutrGbe,
% DepressList, and NewReductSignature.; mode split FixNGbe further;
% changed SPolInputs, ConeP (adding a third explicit argument).
%  Added the new monomial properties SPairs, GbFactors,
% ExtraPointers, and LRReduced./JoeB 2006-08-11 -- 18

%  Re-introduced SKIPCDEG, as synonym of IGNORECDEG./JoeB 2005-07-29

%  Redefined SETINTERRUPTSTRATEGY by means of DefineSWLHFEXPR.
% /JoeB 2005-02-04

%  Corrected GLOBAL declarations./JoeB 2005-01-07

%  Introduced the main strategy mode handlers.
% /JoeB 2004-05-02 -- 05-03

%  Replaced *NONCOMMUTATIVE by ((Non)CommP)./JoeB 2003-08-25

%  (Old) SKIPCDEG --> IGNORECDEG; but added (new) SKIPCDEG, and
% CLEARCDEGREEOBSTRUCTIONS.  Fixed hsminFixNcDeg to work in
% non-commutative mode, too./JoeB 2002-07-11

%  Introduced CHECKINTERRUPTSTRATEGY./JoeB 1999-12-06.

%  GETD --> DEFP./JoeB 1999-07-02

%  Changed PutRecDef1 to PutRecDef./JoeB 1998-04-07.

%  Moved strategic auxiliary deglist operating procedures here
% (from staggering stuff): PutLeadMonPtr, PutLeadMonPtrsinPolList,
% PutLeadMonPtrsinPolDegList, LeadMonList2PolList,
% LeadMonDegList2PolDegList, PolList2LeadMonList,
% PolDegList2LeadMonDegList, LeadMonList2LeadMonDegList,
% PolList2PolDegList./JoeB 1997-08-21

%  Added type information./JoeB 1996-08-09.

%  Added New Groebner basis element strategy modifications. As a
% consequence, parts of old 'main' stuff was moved here./JoeB 1996-06-23


(OFF RAISE)


% Import: MONFACTORP, MonFactorP1, TOTALDEGREE, CALCPOLRINGHSERIES,
%	  GETVARNO, CALCRATHILBERTSERIES, FixEndDegreeThings,
%	  PutRecDef, REMLASTSERIESCALC; GBasis, cGBasis, InPols,
%	  cInPols, SPairs, cSPairs, SP2r,
%	  !*IMMEDIATECRIT, !*IMMEDIATERECDEFINE, !*CUSTSHOW, IGNORECDEG.
% Export: PutLeadMonPtr, PutLeadMonPtrsinPolList,
%	  PutLeadMonPtrsinPolDegList, LeadMonList2PolList,
%	  LeadMonDegList2PolDegList, PolList2LeadMonList,
%	  PolDegList2LeadMonDegList, LeadMonList2LeadMonDegList,
%	  PolList2PolDegList, (comm-, noncomm-)SPolInputs, FixNcDeg,
%	  nGbeStratInit, FixNGbe, StratFixcDegEnd, StratDegreewise,
%	  StratItemwise, StratStabilise, StratDestabilise,
%	  CHECKINTERRUPTSTRATEGY.
% Available: PAIRELTLIST, FINDCOMPS, CLEARCDEGREEGKINPUT,
%	  CLEARCDEGREEOBSTRUCTIONS, ORDNGBESTRATEGY,
%	  MINHILBNGBESTRATEGY, SETINTERRUPTSTRATEGY, GETINTERRUPTSTRATEGY.
% Potentially user defined:  HSERIESMINCRITDISPLAY.

(GLOBAL '(!#!&MainStrat!# !*SAWSIsLoaded Edges Off !*CUSTSTRATEGY
	  Queue Waiting GBasis rGBasis !*IMMEDIATECRIT !*IMMEDIATERECDEFINE
	  cDeg InPols cInPols SPairs cSPairs NewGbeStrategies!* cNGbeStrat!*
	  MaxNewcGbes!&!* IGNORECDEG INPUTONLY !#!$NoHigherGbRedNeeded!*
	  NOOFSPOLCALCS))

(FLUID '(SP2r NGroeb ExtraNGroeb))

(SETQ Edges (NCONS NIL))
(SETQ Off (NCONS NIL))
(SETQ Queue (NCONS NIL))
(SETQ Waiting (NCONS NIL))


%	DEGLIST HANDLING AUXILIARIES.

%  Various strategy implementations may work with deglists (lists of
% lists whose first member is a degree). The following procedures
% operate on or convert from/to/between such structures.

%# PutLeadMonPtr (augpol) : - ;
(DE PutLeadMonPtr
 (augpol) (PutMpt (APol2Lm augpol) augpol))


%# PutLeadMonPtrsinPolList (laugpol) : - ;
(DE PutLeadMonPtrsinPolList (laugpol) (MAPC laugpol (FUNCTION PutLeadMonPtr)))


%# PutLeadMonPtrsinPolDegList (dlaugpol) : - ;
(DE PutLeadMonPtrsinPolDegList (dlaugpol)
 (PROG	(AA)
	(SETQ AA dlaugpol)
  Ml	(COND (AA
	       (PutLeadMonPtrsinPolList (CDAR AA))
	       (SETQ AA (CDR AA))
	       (GO Ml))) ))


%# LeadMonList2PolList (laugmon) : laugpol ;
(DE LeadMonList2PolList (lmon)
 (MAPCAR lmon (FUNCTION (LAMBDA (mon) (Mpt mon)))) )


%# LeadMonDegList2PolDegList (dlaugmon) : (dlaugpol) ;
(DE LeadMonDegList2PolDegList (dlmon)
 (MAPCAR dlmon
	 (FUNCTION (LAMBDA (auglmon)
			   (CONS (CAR auglmon)
				 (LeadMonList2PolList (CDR auglmon)))))) )


%# PolList2LeadMonList (laugpol) : laugmon ;
(DE PolList2LeadMonList (laugpol)
 (MAPCAR laugpol (FUNCTION (LAMBDA (augpol) (APol2Lm augpol)))) )


%# PolDegList2LeadMonDegList (dlaugpol) : dlaugmon ;
(DE PolDegList2LeadMonDegList (dlaugpol)
 (MAPCAR dlaugpol
	 (FUNCTION (LAMBDA (auglaugpol)
			   (CONS (CAR auglaugpol)
				 (PolList2LeadMonList (CDR auglaugpol)))))) )


%# LeadMonList2LeadMonDegList (laugmon) : dlaugmon ;
(DE LeadMonList2LeadMonDegList (lmon)
 (PROG	(AA BB CC DD RT)
	(SETQ RT (SETQ AA (NCONS (LIST (TOTALDEGREE (PMon (CAR lmon)))
				       (CAR lmon)))))
	(SETQ BB (CDAR AA))
	(SETQ CC (CDR lmon))
  Ml	(COND ((NOT CC)
	       (RETURN RT))
	      ((EQ (SETQ DD (TOTALDEGREE (PMon (CAR CC)))) (CAAR AA))
	       (RPLACD BB (NCONS (CAR CC)))
	       (SETQ BB (CDR BB)))
	      ((LESSP (CAAR AA) DD)
	       (RPLACD AA (NCONS (LIST DD (CAR CC))))
	       (SETQ BB (CDAR (SETQ AA (CDR AA)))))
	      (T
	       (ERROR 99
		"Not non-decreasing input to LeadMonList2LeadMonDegList")))
	(SETQ CC (CDR CC))
	(GO Ml) ))


%# PolList2PolDegList (laugpol) : dlaugpol ;
(DE PolList2PolDegList (laugpol)
 (PROG	(AA BB CC DD RT)
	(SETQ RT (SETQ AA (NCONS (LIST (TOTALDEGREE (PMon (CAR laugpol)))
				       (CAR laugpol)))))
	(SETQ BB (CDAR AA))
	(SETQ CC (CDR laugpol))
  Ml	(COND ((NOT CC)
	       (RETURN RT))
	      ((EQ (SETQ DD (TOTALDEGREE (APol2Lpmon (CAR CC)))) (CAAR AA))
	       (RPLACD BB (NCONS (CAR CC)))
	       (SETQ BB (CDR BB)))
	      ((LESSP (CAAR AA) DD)
	       (RPLACD AA (NCONS (LIST DD (CAR CC))))
	       (SETQ BB (CDAR (SETQ AA (CDR AA)))))
	      (T
	       (ERROR 99
		      "Not non-decreasing input to PolList2PolDegList")))
	(SETQ CC (CDR CC))
	(GO Ml) ))


%  Auxiliary.  Should not be exported; might later be replaced by
% further splitting of SPolInputs variants, if the need should arise.

%  WARNING: Call it just once, since it may remove the retrieved material.


%# bmstrRetrieveSPData (augmon) : - ; RESET, DESTRUCTIVE
(DE bmstrstableRetrieveSPData (mon) (Mpt mon) )
(DE bmstrinstableRetrieveSPData (mon)
 (PROG	(rt)
	(COND ((SETQ rt (LGET (Mplst mon) 'SPairs))
	       (REMMONPROP mon 'SPairs)))
	(RETURN rt) ))

% The non-commutative version of the ordinary strategy.

%	 NOTE 91-11-06: The TOTALDEGREE below is taken on CDR(PMon(mon))
%	etcetera, which is rather bad.

%# noncommSPolInputs (augmon) : critpairs ; RESET
(DE stablenoncommSPolInputs (mon)
 (PROG	(AA BB)
	(SETQ BB (bmstrRetrieveSPData mon))
	% Changed 91-05-13 and 91-08-11:
	(COND ((OR !*IMMEDIATECRIT
		   (EQ (CDR BB) 1)
		   (EQ (TOTALDEGREE (CDAAR BB))
		       (TOTALDEGREE (CDR (PMon mon))))
		   (NOT (SETQ AA (ListMonFactorP (CDR GBasis) (PMon mon)))))
	       (PutMpt mon
		       (Mpt (MinMon (LIST (CAAR BB) (CDAR BB)))))
	       (COND (!*IMMEDIATERECDEFINE (PutRecDef mon (CAAR BB))))
	       (RETURN BB)))
	(PutMpt mon (Mpt (MinMon (LIST (CAAR BB) (CDAR BB) (CAR AA)))))
	(RETURN NIL) ))

%  The unstable non-commutative variant is more complex, and somewhat
% similar to the commutative one.  There are several cases, depending on
% whether or not mon also is a Groebner basis element LeadMon, and its
% pointer is set.  In either case, however, the found pair(s) form a list;
% and there is at most one 'ordinary' reduction to be found for the pair;
% which in that case is by means of its leftmost and its rightmost factors.
% We search this first; and add one ExtraNGroeb, iff indeed mon was a Gbe lm.

(DE instablenoncommSPolInputs (mon)
 (PROG	(AA BB CC rt td1 td2 lf rf) % lfp rfp pr

%	If mon already was the l. c. m. for a left-right critical pair
%	S-polynomial, then it cannot now be the LeadMon of a Gbe; no
%	reduction need be performed; and we just clean up a little.
	(COND ((LGET (Mplst mon) 'LRReduced)
	       (REMMONPROP mon 'SPairs)
	       (RETURN NIL)))

%	First real test: Is there a `proper in-factor'?
%	The raw, stupid thing (throwing away known information)
	(SETQ CC (COND ((SelfPointingMon mon)
			  (MAPCAR (LGET (Mplst mon) 'GbFactors)
				  (FUNCTION CAR)))
			 (T
			  (CDR GBasis))))
	(COND ((SETQ AA (ListMonFactorP CC (PMon mon)))
	       (SETQ BB (MONFACTORP (PMon AA) (PMon mon)))
	       (LPUT (Maplst mon) 'LRReduced T)
	       (GO It)))


%	If no SPairs Data is saved at mon, then the reason for mon to be
%	considered as an ambiguity is that indeed it is a Gbe lm with a
%	proper factor of the same type.

	(COND ((NOT (SETQ CC (bmstrRetrieveSPData mon)))
	       (SETQ BB (CADR (SETQ AA (CADR (GETMONAUGPROP mon 'GbFactors)))))
	       (SETQ AA (CAR AA))
	       (GO It)))


%	Since LRReduced was not set, there cannot be previously calculated
%	pairs.  Thus, we only need to find leftmost and rightmost factors,
%	and to check whether they overlap.

	(SETQ td1 (NCAUGMONLENGTH (SETQ AA (CAAAR CC))))
	(SETQ td2 (NCAUGMONLENGTH (SETQ BB (CDAAR CC))))
  Ml	(COND ((SETQ CC (CDR CC))
	       (COND ((AND (NOT (Mon!= AA (CAAAR CC)))
			   (BMI!< (SETQ rt (NCAUGMONLENGTH (CAAAR CC))) td1))
		      (SETQ AA (CAAAR CC))
		      (SETQ td1 rt)))
	       (COND ((AND (NOT (Mon!= BB (CDAAR CC)))
			   (BMI!< (SETQ rt (NCAUGMONLENGTH (CDAAR CC))) td2))
		      (SETQ BB (CDAAR CC))
		      (SETQ td2 rt)))
	       (GO Ml)))
	(SETQ rt (COND ((BMI!< (SETQ CC (BMI!- (NCAUGMONLENGTH mon) td2)) td1)
		       (CONS (CONS AA BB) CC))))
	(LPUT (Maplst mon) 'LRReduced T)
	(SETQ BB 0)

	% Instability test (before returning)
  It	(COND ((SelfPointingMon mon)
	       (PutExtraNGroeb mon AA BB)
	       (REMMONPROP mon 'GbFactors))
	      (T
	       (PutMpt mon (Mpt AA))))
	(RETURN rt) ))


% HERE THE COMPONENT ALGORITHM IS IMPLEMENTED. It should do a) a
% list AA of all leading monomials dividing the given monomial; b) a list
% BB of the components of the complement graph on AA to the POINTER set
% of edges; c) a choice of one polynomial from each component, and d) a
% list of pairs of (length BB) - 1 differences between the chosen elements.
% This list is returned, in order to let another routine make the
% S-polynomials out of it. After the procedure is ready, the POINTER is
% changed to a pointer to a reduction of the LCM.
%  There are several short-cuts available within the algorithm:
% A) One may check whether all AA elements actually appear in the AA or not.
%   If there is any one NOT appearing, then the complement graph is a cone,
%   and thus connected. (One possibility: FIRST form a preliminary AA out of
%   POINTER; THEN go through all leading monomials, checking that those
%   dividing the monomial are on AA. If one is not, abort.)
% B) If AA has just two elements, then (since POINTER is not empty)
%   the complementary graph is discrete, and POINTER contains precisely
%   one pair, whose S-polynomial should be calculated. (Output := POINTER.)

%  There is also a number of interesting choices: Which of the available
% polynomials are probably the better ones from which to construct the
% S-polynomials? Here are 5 suggestions:
%	1) Use arbitrary order;
%	2) Prefer lower total-degree;
%	3) Prefer higher total-degree;
%	4) Prefer lower number of appearing monomials;
%	5) Prefer "relatively lower" second monomial (i.e., revlex lower
%	  second monomial after multiplying up to the S-pol). No second
%	  monomial of course is lowest of all.
%  Right now, MinMon uses 4). (This PRIORITY is set in 'main', by
% FixGBasElts, however, by means of CALCREDUCTORPRIORITY, which the
% customer might wish to change.)

%# CALCREDUCTORPRIORITY (augmon) : polpriority ;
(DE CALCREDUCTORPRIORITY (augmon)
 (LENGTH (PPol (Mpt augmon))))


% The main function (exported). It returns a list of pairs of Groebner basis
% elements (Gbe's) (represented by their LeadMons as usual), which are to have
% their S-Polynomials reduced.
%  As a side effect, the monomial "mon" is to have its POINTER pointing
% to an 'optimal' Gbe reducing it.

%  2006-08-11: Introduced bmstrRetrieveSPData; and made slight changes,
% so that bmstrRetrieveSPData is called only once.

%# commSPolInputs (augmon) : critpairs ;
(DE stablecommSPolInputs (mon)
 (PROG	(AA BB CC)

%	List the Gbe's appearing in the proposed pairs:
	(SETQ AA (PAIRELTLIST (SETQ BB (bmstrRetrieveSPData mon))))

%	Is there another Gbe reducing mon? (Then no SPols need be reduced.)
	(COND ((SETQ CC (ConeP (PMon mon) AA (CDR GBasis)))
	       (PutMpt mon (Mpt (MinMon (CONS CC AA))))
	       (RETURN NIL))

	      %	Else, is there but one pair?
	      ((NOT (CDR BB))
	       (PutMpt mon (Mpt (MinMon AA)))
	       (RETURN BB))

	      %	Else, is there but one component?
	      ((NOT (CDR (SETQ BB (FINDCOMPS AA BB))))
	       (PutMpt mon (Mpt (MinMon (CAR BB)))) (RETURN NIL)))

%	Else, some reductions must be made.
%	Choose the minimal Gbe in each component, and the minimum AA of
%	them all; let POINTER point to that Gbe.
	(SETQ BB (MAPCAR BB 'MinMon))
	(PutMpt mon (Mpt (SETQ AA (MinMon BB))))

%	Delete AA from BB, and make BB a list of the pairs (AA . BB-element),
%	with minimal garbage created:
	(COND ((Mon!= AA (CAR BB))
	       (SETQ BB (CDR BB))
	       (SETQ CC BB)
	       (GO Sl)))
	(SETQ CC BB)
  Ml	(RPLACA CC (CONS AA (CAR CC)))
	(COND ((AND (CDR CC) (Mon!= AA (CADR CC)))
	       (RPLACD CC (CDDR CC))
	       (GO Sl2)))
	(COND ((SETQ CC (CDR CC))
	       (GO Ml)))
  Sl	(RPLACA CC (CONS AA (CAR CC)))
  Sl2	(COND ((SETQ CC (CDR CC))
	       (GO Sl)))
	(RETURN BB) ))

(DE instablecommSPolInputs (mon)
 (COND	((SelfPointingMon mon)  (commGbeSPolInputs mon))
	((PruneCommSPData mon) (stablecommSPolInputs mon))) )

%  PutExtraNGroeb takes care of the situation where both mon1 and mon2 are
% Gbe's, and mon1 divides mon2.  A new reductand formed from their pointer
% reductors is placed as ExtraNGroeb.  The old top level dotted pair of
% mon2 could be the pointer of an unknown number of other monomials.  Hence,
% it is saved as an 'extra pointer' for mon1; and its CDR is replaced by the
% pure reductor from mon1.  Similarly, any extra pointers at mon2 are moved
% to mon1, and refreshed.  Finally, mon2 gets to share the pointer of mon1.

%  Unhappily, this means that we work with the internal polynomial structure.

%# PutExtraNGroeb (augmon,augmon,genint) : - ;
(DE PutExtraNGroeb (mon1 mon2 placeno)
 (PROG	(rt op opp)
	(COND ((NUMBERP NOOFSPOLCALCS)
	       (SETQ NOOFSPOLCALCS (ADD1 NOOFSPOLCALCS))))
	(SETQ op (CONS (Mpt mon2) (LGET (Mplst mon2) 'ExtraPointers)))
	(SETQ rt (DestructRedor2Redand (CONS NIL (PPol (CAR op)))))
	(ReducePolStep rt
		       rt
		       (PPol (Mpt mon1))
		       (PreciseniMonQuotient (PMon mon2) (PMon mon1) placeno))
	(PutMpt mon2 (Mpt mon1))
	(RPLACA (CAR (SETQ opp op)) NIL)
  Ml	(RPLACD (CAR opp) (PPol (Mpt mon1)))
	(COND ((SETQ opp (CDR opp))
	       (GO Ml)))
	(LPUT!-LGET (Maplst mon1) 'ExtraPointers '(CONS op !_IBID))
	(REMMONPROP mon2 'ExtraPointers)
	(COND ((PPol!? rt)
	       (SETQ ExtraNGroeb rt))) ))

%   Defaults.

(COPYD 'noncommSPolInputs 'stablenoncommSPolInputs)
(COPYD 'commSPolInputs 'stablecommSPolInputs)


(DE commGbeSPolInputs (mon)
 (PROG	(AA BB CC)

%	List the Gbe's appearing in the proposed pairs:
	(SETQ AA (PAIRELTLIST (SETQ BB (bmstrRetrieveSPData mon))))

%	Is there another Gbe reducing mon?  Then only one SPol should be
%	reduced.
	(COND ((SETQ CC (ConeP (PMon mon)
			       AA
			       (MAPCAR (LGET (Mplst mon) 'GbFactors)
				       (FUNCTION CAR))))
	       (PutExtraNGroeb (SETQ BB (MinMon (CONS CC AA))) mon NIL)
	       (RETURN (NCONS (CONS BB mon))))
	      % Similarly, if there are no edges:
	      ((NOT BB)
	       (PutExtraNGroeb (SETQ CC (MinMon AA)) mon NIL)
	       (RETURN (NCONS (CONS CC mon))))

	      % Else, is there but one pair?
	      ((NOT (CDR BB))
	       (PutExtraNGroeb (SETQ CC (MinMon AA)) mon NIL)
	       (RETURN (CONS (CONS CC mon) BB))))

	      (SETQ BB (FINDCOMPS AA BB))

%	Choose the minimal Gbe in each component, and the minimum AA of
%	them all; let POINTER point to that Gbe.
	(SETQ BB (MAPCAR BB 'MinMon))
	(PutExtraNGroeb (SETQ AA (MinMon BB)) mon NIL)

	(COND ((NOT (CDR BB)) (RETURN NIL)))

%	Delete AA from BB, and make BB a list of the pairs (AA . BB-element),
%	with minimal garbage created:
	(COND ((Mon!= AA (CAR BB))
	       (SETQ BB (CDR BB))
	       (SETQ CC BB)
	       (GO Sl)))
	(SETQ CC BB)
  Ml	(RPLACA CC (CONS AA (CAR CC)))
	(COND ((AND (CDR CC) (Mon!= AA (CADR CC)))
	       (RPLACD CC (CDDR CC))
	       (GO Sl2)))
	(COND ((SETQ CC (CDR CC))
	       (GO Ml)))
  Sl	(RPLACA CC (CONS AA (CAR CC)))
  Sl2	(COND ((SETQ CC (CDR CC))
	       (GO Sl)))
	(RETURN BB) ))

%# PruneCommSPData (augmon) : bool ;
(DE PruneCommSPData (mon)
 (PROG	(sp ip) % SP-data; Input Position
	(SETQ ip (SETQ sp (GETMONAUGPROP mon 'SPairs)))
  Ml	(COND ((AND (SelfPointingMon (CAADR ip))
		    (SelfPointingMon (CDADR ip)))
	       (SETQ ip (CDR ip)))
	      (T
	       (RPLACD ip (CDDR ip))))
	(COND ((CDR ip)
	       (GO Ml))
	      ((CDR sp)
	       (RETURN sp)))
	(REMMONPROP mon 'SPairs) ))

%# SPolInputs (augmon) : critpairs ; RESET
(COPYD 'SPolInputs 'commSPolInputs)

%# PAIRELTLIST (ldpany) : lany ;
(DE PAIRELTLIST (pairlist)
 (PROG	(AA BB)
	(SETQ AA pairlist)
  Ml	(COND ((NOT (MEMQ (CAAR AA) BB))
	       (SETQ BB (CONS (CAAR AA) BB))))
	(COND ((NOT (MEMQ (CDAR AA) BB))
	       (SETQ BB (CONS (CDAR AA) BB))))
	(COND ((SETQ AA (CDR AA))
	       (GO Ml)))
	(RETURN BB) ))

% FINDCOMPS is a quite general function, taking {vertices} and {edges} of
% a simple graph as its input, and yielding a list of the connected components
% of the complementary graph as its output. HOWEVER, there must be at least 2
% vertices and 1 edge.
% It uses a BFS algorithm.
% Meaning of PROG variables: Components found (so far); Queue-place;
% Edges-position; Off-position; Waiting-position; Currently found vertex (with
% an edge to the component). Here the Queue contains the vertices already
% found in the current component; Off the other vertices found to have an edge
% (and thus NOT a "complementary edge") to the current vertex ( = Cadr(CC) );
% Waiting the rest of the vertices; and Edges contains the yet not used-up
% edges.

% EQ tests are used for vertex-equality. Applying this to monomial vertices
% only works if Mon!= = EQ; else make a copy of FINDCOMPS for this purpose.

% WARNING: The input is destroyed in the process.

%# FINDCOMPS (lany, ldpany) : ldpany ;
(DE FINDCOMPS (lverts ledges)
 (PROG	(AA CQ CE CO CW CV)
	(RPLACD Edges ledges)
	(RPLACD Waiting (CDR  lverts))
	(RPLACD Queue lverts)
  Ml	(RPLACD (SETQ CQ (CDR Queue)) NIL)
  Sl	(COND ((NOT (CDR (SETQ CE Edges)))
	       (RETURN (CONS (CDR (NCONC Queue (CDR Waiting))) AA))))
	(RPLACD Off NIL)
	(SETQ CO Off)
  SSl	(COND ((EQ (CAR CQ) (CAADR CE))
	       (SETQ CV (CDADR CE)))
	      ((EQ (CAR CQ) (CDADR CE))
	       (SETQ CV (CAADR CE)))
	      ((CDR (SETQ CE (CDR CE)))
	       (GO SSl))
	      (T
	       (GO GSl)))
	(RPLACD CE (CDDR CE))
	(SETQ CW Waiting)
  SSSl	(COND ((CDR CW)
	       (COND ((EQ (CADR CW) CV)
		      (RPLACD CO (CDR CW))
		      (RPLACD CW (CDDR CW))
		      (RPLACD (SETQ CO (CDR CO)) NIL))
		     (T
		      (SETQ CW (CDR CW)) (GO SSSl)))))
	(COND ((CDR CE)
	       (GO SSl)))
  GSl	(COND ((CDR Waiting)
	       (NCONC CQ (CDR Waiting))))
	(COND ((NOT (CDR (RPLACD Waiting (CDR Off))))
	       (RETURN (CONS (CDR Queue) AA)))
	      ((SETQ CQ (CDR CQ))
	       (GO Sl)))
	(SETQ AA (CONS (CDR Queue) AA))
	(COND ((CDDR (RPLACD Queue (CDR Waiting)))
	       (RPLACD Waiting (CDDR Waiting))
	       (GO Ml)))
	(RETURN (CONS (CDR Queue) AA)) ))


% The dual graph is a cone (and thus connected) iff there is a Groebner basis
% element with LeadMon dividing cMon, which is NOT among the pairs found.
% If so, return this LeadMon.

%# ConeP (puremon, laugmon, laugmon) : genaugmon ;
(DE ConeP (pmon lmon1 lmon2)
 (PROG	(AA)
	(SETQ AA lmon2)
  Ml	(COND ((AND (MONFACTORP (PMon (CAR AA)) pmon)
		    (NOT (MEMQ (CAR AA) lmon1)))
	       (RETURN (CAR AA)))
	      ((SETQ AA (CDR AA))
	       (GO Ml))) ))

% Pick out the monomial which points to the polynomial with least
% polpriority. Presently this means the shortest polynomial (i.e.,
% the one with the lowest # of non-vanishing monomials).

%# MinMon (laugmon) : augmon ;
(DE MinMon (lmon)
  (COND ((NOT (CDR lmon))
	 (CAR lmon))
	(T (PROG (AA BB)
		 (SETQ AA (CAR lmon))
		 (SETQ BB (CDR lmon))
	    Ml	 (COND ((LESSP (redPriority (Mpt (CAR BB)))
			       (redPriority (Mpt AA)))
			(SETQ AA (CAR BB))))
		 (COND ((SETQ BB (CDR BB))
			(GO Ml)))
		 (RETURN AA) ))))


		%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%
		%%%				%%%
		%%% Main strategy mode handlers	%%%
		%%%				%%%
		%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%

%# GETSTRATEGY () ; id ;
(DE GETSTRATEGY () (PROGN !#!&MainStrat!#) )

%# SETDEFAULTSTRATEGY
(DE SETDEFAULTSTRATEGY ()
 (PROG	(rt)
	(SETQ rt (GETSTRATEGY))
	(COND ((EQ rt 'SAWS)
	       (ERROR 99 "Cannot revert from the SAWS strategy.")))
	(SETQ !#!&MainStrat!# 'DEFAULT)
	(RETURN rt) ))

%# SETRABBITSTRATEGY
(DE SETRABBITSTRATEGY ()
 (PROG	(rt)
	(SETQ rt (GETSTRATEGY))
	(COND ((EQ rt 'SAWS)
	       (ERROR 99 "Cannot revert from the SAWS strategy.")))
	(SETQ !#!&MainStrat!# 'RABBIT)
	(RETURN rt) ))

%  As things work (or don't work) right now (2004-05-02), the
% SAWS (a.k.a. STAGGER (WITH SUBSTANCE)) strategy is essentially
% and irrevocably envoced by a number of self-loading macros,
% getting stagsubs.sl to be LAPINned, which in its turn makes
% stg to be loaded. In order for to make the transition to the
% 'modern' way to handle mode changing, we should ensure that
% each method calls the other. Thus, SETSAWSSTRATEGY invokes the
% loading of stagsubs.sl, and the latter file calls SETSAWSSTRATEGY.
%
%  In order to prevent an infinite LAPIN loop, I do turn on the
% SAWSIsLoaded switch more times than necessary.

%# SETSAWSSTRATEGY
(DE SETSAWSSTRATEGY ()
 (PROG	(rt)
	(SETQ rt (GETSTRATEGY))
	(COND ((NOT !*SAWSIsLoaded)
	       (ON SAWSIsLoaded)
	       (LAPIN (MKBMPATHEXPAND "$bmauxil/stagsubs.sl"))))
	(SETQ !#!&MainStrat!# 'SAWS)
	(RETURN rt) ))

%  Initialising: ...

(COND ((NOT !#!&MainStrat!#) (SETDEFAULTSTRATEGY)))


		%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%
		%%%				%%%
		%%% New Groebner basis element	%%%
		%%% strategy modifications	%%%
		%%%				%%%
		%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%


%  There may be some strategy or rather substrategy actions taken when
% new Gbe's are found. Most simply, there may be a limit on the number
% of expected Gbe's of the current degree, e.g. by Hilbert series
% considerations.


(SETQ NewGbeStrategies!*
      (NCONC '((ORDINARY . ORDNGBESTRATEGY)
	       (NONE . ORDNGBESTRATEGY)
	       (NIL . ORDNGBESTRATEGY)
	       (MINHILBLIMITS . MINHILBLIMITSTRATEGY))
	     NewGbeStrategies!*))



%	Auxiliaries for various strategies.


%  Added 2002-07-11: /JoeB
%  Clear the remaining 'critical pairs' at the current degree.

%# CLEARCDEGREEOBSTRUCTIONS () : - ;
(DE CLEARCDEGREEOBSTRUCTIONS ()
 (PROGN	(COND ((AND !*CUSTSHOW (DEFP 'CUSTCLEARCDEGOBSTRDISPLAY))
	       (CUSTCLEARCDEGOBSTRDISPLAY)))
	(MAPC cSPairs
	      (FUNCTION (LAMBDA (mn) (PutMpt mn NIL))))
	(SETQ cSPairs NIL)
	(SETQ SP2r NIL) ))

%  Clear ALL the remaining 'input' at the current degree.

%# CLEARCDEGREEGKINPUT () : - ;
(DE CLEARCDEGREEGKINPUT ()
 (PROGN	(COND ((AND !*CUSTSHOW (DEFP 'CUSTCLEARCDEGDISPLAY))
	       (CUSTCLEARCDEGDISPLAY)))
	(SETQ cInPols NIL)
	(MAPC cSPairs
	      (FUNCTION (LAMBDA (mn) (PutMpt mn NIL))))
	(SETQ cSPairs NIL)
	(SETQ SP2r NIL) ))




%	Ordinary strategy.


%  FindNewcDeg intervener. Binary number argument, whose bits tell
% which of cInPols and cSPairs were set.
%  Note that NIL return value causes immediate return from GROEBNERKERNEL.

%# ordFixNcDeg (binno) : gendegno ;
(DE ordFixNcDeg (binno)
 (COND	((AND !*CUSTSTRATEGY (DEFP 'CUSTNEWCDEGFIX))
	 (CUSTNEWCDEGFIX binno))
	(T
	 cDeg)) )


%# ordnGbeStratInit () : - ;
(DE ordnGbeStratInit () (PROGN NIL))


% End-of-current-item/degree interveners.

%  Auxiliary:
%# MaybePrintItem (augmon) : bool ;
(DE MaybePrintItem (mon)
  (COND	((AND (GETITEMPRINTOUTPUT)
	      (OR (EQ (GETPROCESS) 'ITEMWISE) (EQ (GETITEMPRINTOUTPUT) T)))
	 (PointerPrint mon)
	 T)) )

%  Changes 1996-04-25, 1996-05-07: Moved FixNGbe to 'strategy'./JoeB
%  Changes 1996-04-18: Remove the argument; now communicates by means
% of NGroeb. Incorporated two NGroeb changing lines from GROEBNERKERNEL.
%  Moved Critical Pairs finding to DEnSPairs./JoeB

%# ordFixNGbe () : - ;
(DE ordFixNGbe ()
 (PROG	(Pek mon)
	(PutMpt (SETQ mon (APol2Lm NGroeb)) NGroeb)
	(SETQ NGroeb mon)			% NGroeb := LeadMon(NGroeb)
	(PreenRedand (Mpt mon))
	(MaybePrintItem mon)

% Insert mon among the other new Groebner basis element leadmons of degree
% cDeg.
	(SETQ Pek (CDDR (MonInsert mon cGBasis)))

% If we calculate PBseries simultaneously, find new Right Monomial Factors:
	(COND (!*PBSERIES
	       (FindNewRMFs mon)))
	(COND ((NOT !*IMMEDIATEFULLREDUCTION)
	       (RETURN NIL)))

% Eliminate mon from the other new Groebner basis elements with higher
% LeadMons, if demanded.
 SNgr	(COND (Pek
	       (SubtractRedor (Mpt (CAR Pek)) mon)
	       (SETQ Pek (CDR Pek))
	       (GO SNgr))) ))


%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%
%   New degree/Item and Stable/Instable spits
%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%

%# itemFixNGbe () : - ; RESET
(DE stableitemFixNGbe ()
 (PROG	(Pek mon)
	(PutMpt (SETQ mon (APol2Lm NGroeb)) NGroeb)
	(SETQ NGroeb mon)			% NGroeb := LeadMon(NGroeb)
	(PreenRedand (Mpt mon)) % BAD: It's a reductor, not a reductand.

	% From FixGbe:
	(PreenRedor (Mpt mon))
	(PutredPriority (Mpt mon) (CALCREDUCTORPRIORITY mon))
	(MaybePrintItem mon)

% At least one procedure assumes cDeg == TOTALDEGREE(NGroeb):
	(SETQ cDeg (TOTALDEGREE mon))

% Insert mon among the other Groebner basis element leadmons.
	(SETQ Pek (CDDR (MonInsert mon GBasis)))
%	(TCONC tGBasis mon)

% If we calculate PBseries simultaneously, find new Right Monomial Factors:
	(COND (!*PBSERIES
	       (FindNewRMFs mon)))
	(COND ((OR (NOT !*IMMEDIATEFULLREDUCTION)
		   !#!$NoHigherGbRedNeeded!*) % Possibly, should be removed.
	       (RETURN NIL)))

% Eliminate mon from the other new Groebner basis elements with higher
% LeadMons, if demanded.
 SNgr	(COND (Pek
	       (stableMaybeReduceRedor (Mpt (CAR Pek)) mon)
	       (SETQ Pek (CDR Pek))
	       (GO SNgr))) ))


(DE instableitemFixNGbe ()
 (PROG	(Pek mon)
	(PutMpt (SETQ mon (APol2Lm NGroeb)) NGroeb)
	(SETQ NGroeb mon)			% NGroeb := LeadMon(NGroeb)
	(PreenRedand (Mpt mon))

	% From FixGbe:
	(PreenRedor (Mpt mon))
	(PutredPriority (Mpt mon) (CALCREDUCTORPRIORITY mon))
	(MaybePrintItem mon)

% At least one procedure assumes cDeg == TOTALDEGREE(NGroeb):
	(SETCURRENTDEGREE (TOTALDEGREE (PMon mon)))

% Insert mon among the other Groebner basis element leadmons.
	(SETQ Pek (CDDR (MonInsert mon GBasis)))
	% (TCONC tGBasis mon)
	(PutrGbe mon)
	(DepressList (CDAR rGBasis) (GETCURRENTDEGREE))

% If we calculate PBseries simultaneously, find new Right Monomial Factors:
	(COND (!*PBSERIES
	       (FindNewRMFs mon)))
	(COND ((OR (NOT !*IMMEDIATEFULLREDUCTION)
		   !#!$NoHigherGbRedNeeded!*)
	       (RETURN NIL)))

% Eliminate mon from the other new Groebner basis elements with higher
% LeadMons, if demanded.
 SNgr	(COND (Pek
%	       REWRITE THE FOLLOWING LINE.
	       (SubtractRedor (Mpt (CAR Pek)) mon)
	       (SETQ Pek (CDR Pek))
	       (GO SNgr))) ))


%   AUXILIARIES FOR THE UNSTABLE FUNCTIONS.

%  Puts mon on the  CDR(rGBasis) deglist; pushes a NIL (as in
% "infinity") into CAR(rGBasis).
%  Meaning of PROG variables: rGBasis Position; Current Degree.

%# PutrGbe (augmon) : -
(DE PutrGbe (mon)
 (PROG	(rgp cd)
	(SETQ cd (GETCURRENTDEGREE))
	(SETQ rgp rGBasis)
  Ml	(COND ((OR (NOT (CDR rgp)) (BMI!< cd (CAADR rgp)))
	       (RPLACD rgp (CONS (LIST cd (NCONS mon)) (CDR rgp)))
	       (RPLACD (CDADR rgp) (CADADR rgp)))
	      ((BMI!= cd (CAADR rgp))
	       (TCONC (CDADR rgp) mon))
	      (T
	       (SETQ rgp (CDR rgp))
	       (GO Ml)))
	(RPLACA rGBasis (CONS NIL (CAR rGBasis))) ))

%  Actually a lisp extension: For each element on the list Lst (wchich
% should consist of INUMs and NIL only), if it is NIL or else greater
% than DegNo, destructively replace it by DegNo. (Here, NIL represents
% infinity.)

%  Meaning of PROG variable: Input Position.

%# DepressList (lgendegno, degno) : - ; DESTRUCTIVE
(DE DepressList (Lst DegNo)
 (PROG	(ip)
	(SETQ ip Lst)
  Ml	(COND (ip
	       (COND ((OR (NOT (CAR ip)) (BMI!> (CAR ip) DegNo))
		      (RPLACA ip DegNo)))
	       (SETQ ip (CDR ip))
	       (GO Ml))) ))

%  Calculate a unique new reduction signature. It starts with a
% CONSed atom, which now is NIL for infinity, but later may be
% the lowest degree for which there are non-tested Gbe lm's. (The
% CDAR part is ignored.) Then follows the total degree in question
% (which thus need not be recalculated), and finally a degree-list,
% whose items are the last processed and the incidental unprocessed
% Gbe Lm's of the respective degree.
%  Meaning of PROG variables: InPut (from rGBasis), ReTurn; Return
% Position.

%# NewReductSignature (degno) : reductsignature ;
(DE NewReductSignature (DegNo)
 (PROG	(ip rt rp)
	(SETQ rp (CDR (SETQ rt (LIST (CAR rGBasis) DegNo))))
	(SETQ ip (CDR rGBasis))
  Ml	(COND ((AND ip (BMI!< (CAAR ip) DegNo))
	       (RPLACD rp (CONS (CAAR ip) (CDDAR ip)))
	       (SETQ rp (CDR rp))
	       (SETQ ip (CDR ip))
	       (GO Ml)))
	(RETURN rt) ))

%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%
%   End of `New splits'.
%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%



%# ordStratFixcDegEnd () : - ;
(DE ordStratFixcDegEnd ()
 (PROGN	(COND ((CDR cGBasis)
	       (SETQ GBasis (NCONC GBasis (CDR cGBasis)))
	       (RPLACD cGBasis NIL)))
	(FixEndDegreeThings) ))


%# FixNcDeg (binno) : gendegno ; RESET
%# FixNGbe () : - ; RESET
%# nGbeStratInit () : - ; RESET
%# StratFixcDegEnd () : - ; RESET
%# ORDNGBESTRATEGY () : - ;
(DE ORDNGBESTRATEGY ()
 (PROG	(!*USERMODE !*REDEFMSG)
	(COPYD 'FixNcDeg 'ordFixNcDeg)
	(COPYD 'FixNGbe 'ordFixNGbe)
	(COPYD 'nGbeStratInit 'ordnGbeStratInit)
	(COPYD 'StratFixcDegEnd 'ordStratFixcDegEnd)
	(SETQ cNGbeStrat!* 'ORDINARY)
))



%	Minimal Hilbert function values strategy.


%# hsminFixNcDeg (binno) : gendegno ;
(DE hsminFixNcDeg (binno)
 (PROG	(hf) % Hilbert function value
	(COND ((AND !*CUSTSTRATEGY (DEFP 'CUSTNEWCDEGFIX))
	       (RETURN (CUSTNEWCDEGFIX binno)))
	      ((NOT (SETQ hf (GETHSERIESMINIMUM cDeg)))
	       (SETQ MaxNewcGbes!&!* NIL)
	       (RETURN cDeg))
	      ((EQ hf 'IGNORECDEG)
	       (CLEARCDEGREEGKINPUT)
	       (RETURN 'IGNORECDEG))
	      ((OR (EQ hf 'INPUTONLY) (EQ hf 'SKIPCDEG))
	       (CLEARCDEGREEOBSTRUCTIONS)
	       (RETURN 'INPUTONLY))
	      ((EQ hf T)
	       (CLEARCDEGREEGKINPUT)
	       (RETURN NIL)))
	(SETQ MaxNewcGbes!&!* (DIFFERENCE (TDEGREEHSERIESOUT cDeg) hf))
	(COND ((NonCommP) (REMLASTSERIESCALC)))
	(COND ((NOT (LESSP 0 MaxNewcGbes!&!*))
	       (CLEARCDEGREEGKINPUT)
	       (RETURN 'IGNORECDEG)))
	(RETURN T) ))


%  Initial Hilbert series, with empty partial Groebner basis:

%# hsminnGbeStratInit () : - ;
(DE hsminnGbeStratInit ()
 (CALCPOLRINGHSERIES (GETVARNO)) )


%  If we have already found as many new Gbe's as we may by the given
% Hilbert series estimate, then interrupt calculation at this degree
% by emptying the lists cInPol and cSPairs. (This action should perhaps
% rather be done by a separate function?)
%  If the customer wishes (e.g.) to have statistics, then he/she should
% turn on CUSTSHOW and define HSERIESMINCRITDISPLAY.

%# hsminFixNGbe () : - ;
(DE hsminFixNGbe ()
 (PROG	(Pek mon)
	(COND ((NUMBERP MaxNewcGbes!&!*)
	       (COND ((NOT (LESSP 0 (SETQ MaxNewcGbes!&!*
					  (SUB1 MaxNewcGbes!&!*))))
		      (COND ((AND !*CUSTSHOW (DEFP 'HSERIESMINCRITDISPLAY))
			     (HSERIESMINCRITDISPLAY)))
		      (CLEARCDEGREEGKINPUT)))))
	(PutMpt (SETQ mon (APol2Lm NGroeb)) NGroeb)
	(SETQ NGroeb mon)			% NGroeb := LeadMon(NGroeb)
	(PreenRedand (Mpt mon))
	(MaybePrintItem mon)

% Insert mon among the other new Groebner basis element leadmons of degree
% cDeg.
	(SETQ Pek (CDDR (MonInsert mon cGBasis)))

% If we calculate PBseries simultaneously, find new Right Monomial Factors:
	(COND (!*PBSERIES
	       (FindNewRMFs mon)))
	(COND ((NOT !*IMMEDIATEFULLREDUCTION)
	       (RETURN NIL)))

% Eliminate mon from the other new Groebner basis elements with higher
% LeadMons, if demanded.
 SNgr	(COND (Pek
	       (SubtractRedor (Mpt (CAR Pek)) mon)
	       (SETQ Pek (CDR Pek))
	       (GO SNgr))) ))


%  If new Gbe's were found at the current degree, then we should recalculate
% the Hilbert series before joining the new Gbe's to the old ones.

%# hsminStratFixcDegEnd () : - ;
(DE hsminStratFixcDegEnd ()
 (PROGN	(COND ((CDR cGBasis)
	       (SETQ GBasis (NCONC GBasis (CDR cGBasis)))
	       (RPLACD cGBasis NIL)
	       (CALCRATHILBERTSERIES)))
	(FixEndDegreeThings) ))


%# MINHILBLIMITSTRATEGY () : - ;
(DE MINHILBLIMITSTRATEGY ()
 (PROG	(!*USERMODE !*REDEFMSG)
	(COPYD 'FixNcDeg 'hsminFixNcDeg)
	(COPYD 'nGbeStratInit 'hsminnGbeStratInit)
	(COPYD 'FixNGbe 'hsminFixNGbe)
	(COPYD 'StratFixcDegEnd 'hsminStratFixcDegEnd)
	(SETQ cNGbeStrat!* 'MINHILBLIMITS)
))


%# MINHILBNGBESTRATEGY () : - ; ALIAS
(COPYD 'MINHILBNGBESTRATEGY 'MINHILBLIMITSTRATEGY)


(COND ((NOT cNGbeStrat!*)
       (ORDNGBESTRATEGY)))


%# CHECKINTERRUPTSTRATEGY (any) : boolean ;
(DE CHECKINTERRUPTSTRATEGY (uip)
 (ASSOC (COND ((ATOM uip) uip)
	      (T (CAR uip)))
	NewGbeStrategies!*) )


%# SETINTERRUPTSTRATEGY (any) : - ; FEXPR
%(DF SETINTERRUPTSTRATEGY (arrg)
% (PROG	(aa) % New strategy invoking identifier / maker pair.
%	(COND ((AND (PAIRP arrg) (CDR arrg))
%	       (ERROR 99
%		      (PROGN (PRIN2 "***** ")
%			     (PRIN2 arrg)
%			     "bad input to SETINTERRUPTSTRATEGY")))
%	      ((NOT (SETQ aa (CHECKINTERRUPTSTRATEGY arrg)))
%	       (ERROR 99
%		      (PROGN (PRIN2 "***** ")
%			     (PRIN2 (COND ((ATOM arrg) arrg)
%					  (T (CAR arrg))))
%			     "not valid new gbe strategy"))))
%	(RETURN (APPLY (CDR aa) NIL)) ))
(DefineSWLHFEXPR SETINTERRUPTSTRATEGY (GETINTERRUPTSTRATEGY) NewGbeStrategies!*)

%# GETINTERRUPTSTRATEGY () : id ;
(DE GETINTERRUPTSTRATEGY () (PROGN cNGbeStrat!*))


		%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%
		%%%				%%%
		%%%     More mode handlers	%%%
		%%%				%%%
		%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%


(DE StratDegreewise ()
 (PROGN	(COPYD 'stableFixNGbe
	       (COND ((EQ cNGbeStrat!* 'MINHILBLIMITS) 'hsminFixNGbe)
		     (T 'ordFixNGbe)))
	(COPYD 'instableFixNGbe 'stableFixNGbe) % Bad. These versions ARE stable.
 ))

(DE StratItemwise ()
 (PROGN	(COPYD 'stableFixNGbe 'stableitemFixNGbe)
	(COPYD 'instableFixNGbe 'instableitemFixNGbe)
 ))

(DE StratStabilise ()
 (PROGN	(COPYD 'FixNGbe 'stableFixNGbe)
	(COPYD 'bmstrRetrieveSPData 'bmstrstableRetrieveSPData)
	(COPYD 'commSPolInputs 'stablecommSPolInputs)
	(COPYD 'noncommSPolInputs 'stablenoncommSPolInputs)
	(COPYD 'SPolInputs (COND ((NonCommP) 'noncommSPolInputs)
				 (T  'commSPolInputs))) ))

(DE StratDestabilise ()
 (PROGN	(COPYD 'FixNGbe 'instableFixNGbe)
	(COPYD 'bmstrRetrieveSPData 'bmstrinstableRetrieveSPData)
	(COPYD 'commSPolInputs 'instablecommSPolInputs)
	(COPYD 'noncommSPolInputs 'instablenoncommSPolInputs)
	(COPYD 'SPolInputs (COND ((NonCommP) 'noncommSPolInputs)
				 (T  'commSPolInputs))) ))


(ON RAISE)
