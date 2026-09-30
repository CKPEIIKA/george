%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%
%% Copyright (C) 1992,1993,1994,1996,1998,2002,2003 Joergen Backelin
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

% 2004-05-02: Added !*SAWSIsLoaded./JoeB

% 030828: Replaced !*NONCOMMUTATIVE by a call to CommP./JoeB

% 021011: StagFixNullReduced now defined without argument.
% Removed PRIN2T./JoeB

% 991126: PUREMONPRINT,MonOne --> MONPRINT,MONONE./JoeB

% 990702: GETD --> DEFP./JoeB

% 980807: Introduced ClearMplst. Corrected ReducePolStep call
%   arguments./JoeB

% 961011: GETMONAUGPROP, REMMONPROP --> monom.sl. CIRCLENGTH -->
%   slext.sl. The other "Bergman extensions" --> progaux.sl./JoeB

% 950619: EE --> ee ./JoeB

% 940508: Corrected an input interpreter check in AutoReduceFromTo./JoeB

% 930624: Corrected the use together with modular logarithms, by turning
%   logarithmic coefficients to ordinary ones before the final
%   autoreduction. Added globals Modulus and !*MODLOGARITHMS.
%    Added some Char0 aliases (in order to enable (SETMODULUS 0)).
%    Added a new counter NOOFMULTIPLESTAGBES.


% Created 1992-02-19. Contains 'staggered linear bases' routines.

% Import: ReducePol, SubtractRedor, MonInsert, INITTWOWAYLIST,
%     PROLONGTWOWAYLIST, PutMonPri, PutPriPos, GetMonPri, GetMonPriPos,
%     PutMonSubs!=Acc, MonIdealMember, MonIdealUnionNonMember;
%     cDeg, cGBasis, GBasis, InPols, *CUSTSHOW, Pek, MONLIST,
%     InVars, *InnerPMonLength*, EMBDIM,
%     NOOFNILREDUCTIONS, *IMMEDIATEFULLREDUCTION, augSP.
% Export: PRIORITYINIT, ClearPriority;.
% Available: AUTOREDUCEINPUT, AUTOREDDEGENDDISPLAY;
%    INITPRIORITYSTART, INITPRIORITYSTEPLENGTH, REPRIORITYSTEPLENGTH
%    *SAVEDEGREE.

(OFF RAISE)

(COND ((NOT (DEFP 'AUTOREDDEGENDDISPLAY))
       (DE AUTOREDDEGENDDISPLAY () ())))

(FLAG '(AUTOREDDEGENDDISPLAY) 'USER)

(GLOBAL '(cDeg GBasis cGBasis AccGBasis cAccGBasis SPairs cSPairs InPols
	  cInPols !*CUSTSHOW MAXDEG NOOFNILREDUCTIONS !*!&TMRTwoWayList
	  INITPRIORITYSTART INITPRIORITYSTEPLENGTH REPRIORITYSTEPLENGTH
	  !*!&PriTwoWayRing !*!&TMRTwoWayList InLeadMons MONLIST
	  !*SAWSIsLoaded InVars !&!*InnerEmbDim!&!* EMBDIM cPolSubsPri
	  !*SAVEDEGREE !*IMMEDIATEFULLREDUCTION augSP MONONE !*CSTRUCTRUE!*
	  NOOFSPOLCALCS AugSP2r cSubsGBasis niTreeMon NOOFREPRIORITATIONS
	  GBasOutChan !&!*StgFinalOutputChan DegGBasis !*DEGREEPRINTOUTPUT
	  NOOFSTAGCONECRIT CheckStgOrdersNo Modulus !*MODLOGARITHMS
	  NOOFMULTIPLESTAGBES))

(FLUID '(NGroeb Pek !_IBID SP2r !*!&StandardBoundInputMonomial))

(ON SAWSIsLoaded)

%%%%	AUTO REDUCING.    %%%%

% General auto reducing procedure. Its (non-evaluated) arguments are:
% Source degree leading monomial list name, output degree leading monomial
% list name, (optional) output leading monomial list name, (optional)
% multiple leading monomial elimination flag.
%  The flag set indicates that if one input leadmon is a multiple of
% another leadmon, then the former be discarded. This flag should be turned
% on e. g. when the input is known to be a (possible non-minimal) Groebner
% basis.
%  The flag may be set without outputting a leadmon list by setting the
% output leadmon list name to NIL.

(DF AutoReduceFromTo (lid)
 (PROG	(AA cAA BB cBB SvdcDeg nGbe NM SvdGB cP Gbtrue)
	(SETQ SvdcDeg cDeg)
	(COND ((NOT (AND (PAIRP lid)
			 (IDP (CAR lid))
			 (PAIRP (CDR lid))
			 (IDP (CADR lid))
			 (OR (NOT (CDDR lid))
			     (AND (PAIRP (CDDR lid))
				  (IDP (CADDR lid))))))
	       (ERROR 99 "Bad input to AutoReduceFromTo"))
	      ((AND (PAIRP (CDDR lid)) (CDDDR lid)) % Corrected 940508
	       (SETQ Gbtrue (COND ((PAIRP (CDDDR lid)) (CADDDR lid))
				  (T (CDDDR lid))))))
	(SETQ SvdGB GBasis)
	(SETQ GBasis (NCONS NIL))
	(SETQ AA (EVAL (CAR lid)))
	(SETQ cBB (SETQ BB (NCONS NIL)))
  Ml	(COND ((NOT AA)
	       (COND ((AND (CDDR lid) (CADDR lid))
		      (SET (CADDR lid) GBasis)))
	       (SETQ AA GBasis)
	       (COND ((NOT (MEMQ 'GBasis lid))
		      (SETQ GBasis SvdGB)))
	       (COND ((NOT (MEMQ 'cDeg lid))
		      (SETQ cDeg SvdcDeg)))
	       (RETURN (CONS AA (SET (CADR lid) (CDR BB))))))
	(SETQ cGBasis (NCONS (SETQ cDeg (CAAR AA))))
	(SETQ cAA (CDAR AA))
	(SETQ AA (CDR AA))
  Sl	(SETQ cP (Mpt (CAR cAA)))
	(PutMpt (CAR cAA) NIL)
	(COND ((NOT (OR (AND Gbtrue
			     (AccidentalReducibleLeadMon (CAR cAA)))
			(APol0!? (SETQ nGbe (ReducePol cP)))))
	       (SETQ NM (APol2Lm nGbe))
	       (PutMpt NM nGbe)
	       (SETQ Pek (CDDR (MonInsert NM cGBasis)))
	       (AutoReduceFix NM)))
	(COND ((SETQ cAA (CDR cAA))
	       (GO Sl))
	      ((CDR cGBasis)
	       (RPLACD cBB (NCONS (LISTCOPY cGBasis)))
	       (SETQ cBB (CDR cBB))
	       (SETQ GBasis (NCONC GBasis (CDR cGBasis)))
	       (RPLACD cGBasis NIL)))
	(GO Ml) ))

% Auto reducing input (for good input to main routines)

(DE AUTOREDUCEINPUT ()
 (PROGN	(PutLeadMonPtrsinPolDegList InPols)
	(SETQ InLeadMons (PolDegList2LeadMonDegList InPols))
	(AutoReduceFromTo InLeadMons InLeadMons GBasis)
%	(PRIN2 "** Between in AUTOREDUCEINPUT")(TERPRI)
	(TreeMonReform MONLIST NIL)%(PRIN2 "** After TreeMonReform")(TERPRI)
 ))


%(DE InsertPol!&Mon (pol mon lpol lmon)
% (PROG	(AA BB CC)
%	(SETQ AA (MonInsert mon lmon))
%	(SETQ BB (PNTH lpol (ADD1 (DIFFERENCE (LENGTH lmon)
%						 (LENGTH AA)))))
%	(RPLACD BB (CONS pol (CDR BB)))
%	(RETURN AA) ))

(DE AutoReduceFix (mon)
 (PROG	()
  Ml	(COND (Pek
	       (SubtractRedor (Mpt (CAR Pek)) mon)
	       (SETQ Pek (CDR Pek))
	       (GO Ml))) ))

(DE GeneralAccidentalReducibleLeadMon (mon)
 (PROG	(AA II)
	(SETQ AA (CDR GBasis))
	(SETQ II (PMon mon))
  Ml	(COND ((OR (NOT AA) (EQ (CAR AA) mon))
	       (RETURN NIL))
	      ((MONFACTORP (PMon (CAR AA)) II)
	       (RETURN T)))
	(SETQ AA (CDR AA))
	(GO Ml) ))

(DE SavedAccidentalReducibleLeadMon (mon) (LGET (CADR mon) 'IsAMultiple))

(COND ((NOT (DEFP 'AccidentalReducibleLeadMon))
       (COPYD 'AccidentalReducibleLeadMon
	      'GeneralAccidentalReducibleLeadMon) ))

(DE commTreeMonReform (tmon boole)
 (PROGN (COND ((NOT !*!&TMRTwoWayList)
	       (SETQ !*!&TMRTwoWayList
		     (INITTWOWAYLIST (OR !&!*InnerEmbDim!&!*
					 EMBDIM
					 (ERROR 99 "No EMBDIM given?"))))))
	(COND (boole
	       (commTreeMonReform1T tmon !*!&TMRTwoWayList))
	      (T
	       (commTreeMonReform1NIL tmon !*!&TMRTwoWayList))) ))

(DE commTreeMonReform1T (tmon twwl)
 (PROG	(AA)
	(SETQ AA twwl)
	(PutTwW AA tmon)
  Psh	(COND ((LongerTwW AA)
	       (PushTwW!&Tree AA)
	       (GO Psh)))
	(commMonReformT (NextTwW (SubNode (GetTwW AA))))
  Pop	(COND ((NOT (PopTwW AA))
	       (RETURN NIL))
	      ((NOT (CDAR (MvTreeNode!@TwW AA))) % BAD! Should be macro!
	       (GO Pop)))
	(GO Psh) ))

(DE commTreeMonReform1NIL (tmon twwl)
 (PROG	(AA)
	(SETQ AA twwl)
	(PutTwW AA tmon)
  Psh	(COND ((LongerTwW AA)
	       (PushTwW!&Tree AA)
	       (GO Psh)))
	(commMonReformNIL (NextTwW (SubNode (GetTwW AA))))
  Pop	(COND ((NOT (PopTwW AA))
	       (RETURN NIL))
	      ((NOT (CDAR (MvTreeNode!@TwW AA))) % BAD! Should be macro!
	       (GO Pop)))
	(GO Psh) ))

(DE commMonReformT (mon)
 (PROGN	(PutMpt mon NIL)
	(ClearMplst mon) ))

(DE commMonReformNIL (mon)
 (PROGN	(COND ((NOT (SelfPointingMon mon))
	       (PutMpt mon NIL)))
	(ClearMplst mon) ))

(DE AutoRedCommify ()
 (PROGN (COPYD 'TreeMonReform 'commTreeMonReform)
%	(COPYD 'MonReform 'commMonReform)
 ))

(COPYD 'Char0AutoReduceFix 'AutoReduceFix)

(DE AutoRedInit ()
    (AddTo!&Char0Lists '(AutoReduceFix) NIL))

%%%%	Priority initialization and handling.    %%%%

(DE PRIORITYINIT ()
 (PROG	(AA BB CC)
	(INITPRIORITYDEFAULTS)
	(SETQ AA (CDR GBasis))
%	(COND ((NOT InLeadMons)
%	       (SETQ InLeadMons (deglPols2lLms InPols))))
	(SETQ !*!&PriTwoWayRing (NCONS (NCONS ())))
	(RPLACD !*!&PriTwoWayRing
		(PROLONGTWOWAYLIST (LENGTH AA)
				   !*!&PriTwoWayRing))
	(RPLACD (CADR !*!&PriTwoWayRing) !*!&PriTwoWayRing)
	(SETQ BB (NextTwW !*!&PriTwoWayRing))
	(SETQ CC INITPRIORITYSTART)
  Ml	(MakePri (CAR AA) CC BB)
	(COND ((SETQ AA (CDR AA))
	       (PushTwW BB)
	       (SETQ CC (BMI!+ CC INITPRIORITYSTEPLENGTH))
	       (GO Ml)))
  ))

(DE INITPRIORITYDEFAULTS ()
 (PROGN	(COND ((NOT INITPRIORITYSTART)
	       (SETQ INITPRIORITYSTART 0)))
	(COND ((NOT INITPRIORITYSTEPLENGTH)
	       (SETQ INITPRIORITYSTEPLENGTH 32)))
	(COND ((NOT REPRIORITYSTEPLENGTH)
	       (SETQ REPRIORITYSTEPLENGTH 16)))
	(SETQ NOOFREPRIORITATIONS 0) ))

(DE MakePri (mon pri twwpos)
 (PROGN	(PutMonPri mon pri)
	(PutMonPriPos mon twwpos)
	(PutTwW twwpos mon) ))

% PutMonPri, PutMonPriPos, GetMonPri, GetMonPriPos be defined
% in a monomial module, or as macros.

(DE ClearPriority ()
 (PROGN	(SETQ !*!&PriTwoWayRing NIL)
	(SETQ InLeadMons NIL) ))

(DE InsertPriGbe (mon1 mon2)		% Arguments: old/new Gbe.
 (PROG	(AA BB CC)
	(SETQ AA (GetMonPri mon1))	% Or possibly given as argument.
	(SETQ BB (GetMonPriPos mon1))
	(SETQ CC (Pos2Pri (FormerTwW BB)))
	(InsertBeforeTwW BB)
	(PopTwW BB)
	(COND ((BMI!= (SETQ CC (BMI!- AA CC)) 1)
	       (SETQ CC (ReformPriorities BB)))
	      (T
	       (SETQ CC (BMI!- AA (BMI!/ CC 2)))))
	(MakePri mon2 CC BB) ))

%  We must make room for more priorities between the existing ones,
% whence we exchange the existing ones to an arithmetic sequence
% with the increment REPRIORITYSTEPLENGTH. A new priority is assumed
% to be inserted at BB; one member in the arithmetic
% sequence is reserved for this. That value is returned.
%  We know that some items are not stop items; to wit, the first item
% (before which nor ANY new element ever is inserted), and the first
% item after BB. For the rest of the items, checks are made.

(DE ReformPriorities (twwpos)
 (PROG	(AA BB RP)
	(SETQ NOOFREPRIORITATIONS (ADD1 NOOFREPRIORITATIONS))
	(SETQ AA (NextTwW !*!&PriTwoWayRing))
	(SETQ BB (BMI!+ (Pos2Pri AA) REPRIORITYSTEPLENGTH))
  Fl	(PushTwW AA)
	(COND ((NOT (EQ AA twwpos))
	       (PutPosPri AA BB)
	       (SETQ BB (BMI!+ BB REPRIORITYSTEPLENGTH))
	       (GO Fl)))
	(SETQ RP BB)
	(PushTwW AA)
  Sl	(SETQ BB (BMI!+ BB REPRIORITYSTEPLENGTH))
	(PutPosPri AA BB)
	(PushTwW AA)
	(COND ((NOT (EQ AA !*!&PriTwoWayRing))
	       (GO Sl)))
	(RETURN RP) ))

(DE PriorityCommify () ())

%%%%	Substantial support.    %%%%

(DE MemberOrSubs!-AccPriMonInsert (mon auglmon)
 (PROG 	(AA BB)
	(SETQ AA auglmon)
	(SETQ BB (GetMonSubs!-AccPri mon))
  Ml	(COND ((NOT (CDR AA))
	       (RPLACD AA (NCONS mon))
	       (RETURN AA))
	      ((EQ (CADR AA) mon)
	       (RETURN AA))
	      ((Subs!-AccPri!< (GetMonSubs!-AccPri (CADR AA)) BB)
	       (SETQ AA (CDR AA))
	       (GO Ml)))
	(RETURN (RPLACD AA (CONS mon (CDR AA)))) ))

(DE Subs!-AccPriMonInsert (mon auglmon)
 (PROG 	(AA BB)
	(SETQ AA auglmon)
	(SETQ BB (GetMonSubs!-AccPri mon))
  Ml	(COND ((NOT (CDR AA))
	       (RPLACD AA (NCONS mon))
	       (RETURN AA))
	      ((Subs!-AccPri!< (GetMonSubs!-AccPri (CADR AA)) BB)
	       (SETQ AA (CDR AA))
	       (GO Ml)))
	(RETURN (RPLACD AA (CONS mon (CDR AA)))) ))

(DE SubsPriMonInsert (mon auglmon)
 (PROG 	(AA BB CC DD)
	(SETQ AA auglmon)
	(SETQ BB (GetMonSubs mon))
	(SETQ CC (GetMonPri mon))
  Ml	(COND ((NOT (CDR AA))
	       (RPLACD AA (NCONS mon))
	       (RETURN AA))
	      ((OR (AND (Subs!= (SETQ DD (GetMonSubs (CADR AA))) BB)
			(Pri!< (GetMonPri (CADR AA)) BB))
		   (Subs!< DD BB))
	       (SETQ AA (CDR AA))
	       (GO Ml)))
	(RETURN (RPLACD AA (CONS mon (CDR AA)))) ))

(DE SubsPriItemInsert (itm auglitm)
 (PROG	(AA BB)
	(SETQ AA auglitm)
	(SETQ BB (CADR itm))
  Ml	(COND ((NOT (CDR AA))
	       (RPLACD AA (NCONS itm)))
	      ((SubsPri!< (CADR (CADR AA)) BB)
	       (SETQ AA (CDR AA))
	       (GO Ml))
	      (T
	       (RPLACD AA (CONS itm (CDR AA))))) ))


(DE SubstanceCommify () ())

%%%%	Reduction support.    %%%%


%  An exterior variable, cPolSubsPri, is assumed to be set to the SubsPri
% (i. e., Substance & Priority) of augpol - or rather of its formative
% critical pair.
%  Meaning of prog variables: The rest of augpol; Coefficient equalising
% factors pair; Reductor polynomial; The augpol substance; The augpol
% priority.

(DE ReduceSubstantialPol (augpol)
 (PROG	(AA CC SB PR)
	(COND ((APol0? (SETQ AA augpol))
	       (COND (NOOFNILREDUCTIONS
		      (SETQ NOOFNILREDUCTIONS (ADD1 NOOFNILREDUCTIONS))))
	       (RETURN NIL)))
	(SETQ SB (SubsPri2Subs cPolSubsPri))
	(SETQ PR (SubsPri2Pri cPolSubsPri))
  Ml	(COND ((NOT (Mpt? (Lm (PolTail AA))))
	       (PutMpt (Lm (PolTail AA))
		       (OR (FindGroebF (Lpmon (PolTail AA))) T))))
	(COND ((EQ (Mpt (Lm (PolTail AA))) T)
	       (PolDecap AA))
	      ((Mon!= (Lm (PolTail AA))
		      (Lm (SETQ CC (PPol (Mpt (Lm (PolTail AA)))))))
	       (COND ((AND (OR !*IMMEDIATEFULLREDUCTION (EQ AA augpol))
			   (COND ((Subs!= (GetMonSubs (Lm CC)) SB)
				  (Pri!< (GetMonPri (Lm CC)) PR))
				 (T
				  (Subs!< (GetMonSubs (Lm CC)) SB))))
		      (SubtractRedand1 augpol AA CC))
		     (T (PolDecap AA))))
	      ((Subs!-AccPri!<3 (GetMonSubs!-AccPri (Lm CC))
				(Subs!&Mon2Subs!-Acc SB (Lm (PolTail AA)))
				PR)
	       (ReducePolStep augpol
			      AA
			      CC
			      (niMonQuotient (Lpmon (PolTail AA))
					     (Lpmon CC))))
	      (T
	       (PolDecap AA)))
	(COND ((PolTail AA) (GO Ml))
	      ((PPol? augpol)
	       (Redand2Redor (PPol augpol))
	       (RETURN augpol)))
 ))

(DE StagFormSPol (itm)
 (PROG	(RT %BB
	)
	(COND ((NUMBERP NOOFSPOLCALCS)
	       (SETQ NOOFSPOLCALCS (ADD1 NOOFSPOLCALCS))))
	(SETQ RT (RedorMonMult (Mpt (CADR (CDDDR itm)))
			       (CADDR itm)))
	(ReducePolStep RT
		       RT
		       (PPol (Mpt (CADDR (CDDDR itm))))
		       (CADR (CDDR itm)))
%	(SETQ RT (mkAPol))
%	(SETQ BB (CoeffsGCD!:d (Lc (PPol (Mpt (CADR (CDDDR itm)))))
%			       (Lc (PPol (Mpt (CADDR (CDDDR itm)))))))
%	(ConcPolNMonMult RT
%			 (PPol (Mpt (CADR (CDDDR itm))))
%			 (CAR BB)
%			 (CADDR itm))
%	(SemiPolLinComb RT
%			RT
%			(PolTail (PPol (Mpt (CADDR (CDDDR itm)))))
%			(CDR BB)
%			(CADR (CDDR itm)))
	(RemPairFromMon itm (CAR itm))
	(COND ((PPol? RT)
	       (SETQ cPolSubsPri (CADR itm))
	       (RETURN RT))) ))

% (COPYD 'Char0StagFormSPol 'StagFormSPol)

% (COPYD 'Char0ReduceSubstantialPol 'ReduceSubstantialPol)

(DE STAGGERINITREDUCTIONS () ())
%  (AddTo!&Char0Lists '(StagFormSPol ReduceSubstantialPol) NIL)

%%%%	Prohibition ideal handling support.    %%%%

%	(The monomial ideal internal structure handling is
%	done in idealstg.)

%(DE MkStagPairs (gbaspos)
% (PROG	(AA BB CC DD EE)
%	(SETQ AA (CDR GBasis))
%	(SETQ CC (GetMonProhId (SETQ BB (CAR gbaspos))))
%  Ml	(COND ((EQ AA gbaspos)
%	       (RETURN T))
%	      ((AND (SETQ DD (SubstanceLCorOUT (CAR AA) BB))
%		    (NOT (MonIdealMember (CAR DD) CC)))
%	       (MonIdealUnionNonMember (CAR DD) CC)
%	       (COND ((CDR DD)
%		      (StagSPolPrep (CAR AA) BB (CDR DD))))))
%	(SETQ AA (CDR AA))
%	(GO Ml) ))

% (where SubstanceLCorOUT(mon1,mon2):=NIL | (LC/mon2) | (LC/mon2 . LC),
% where LC is a (possibly modified) LC(mon1,mon2) and is given
% explicitly only if no immediate criterion 'unneccessiates' it.)


(DE IdealsCommify () ())


%%%%	Output support: moved to writestg.    %%%%




%%%%	Top level things.    %%%%

%  Should be re-considered. If GROEBNERINIT is called somehow,
% then MONONE will be defined. Else, lots of things won't.
% /JoeB 1999-11-26

(DE STAGGERINIT ()
 (PROGN % (SETQ MONONE (MkMonOne))
	(SETQ AugSP2r (NCONS NIL))
	(SETQ augSP (NCONS NIL))
	(SETQ NOOFSTAGCONECRIT 0)
	(SETQ NOOFMULTIPLESTAGBES 0)
%	(SETQ AccGBasis (NCONS NIL))
%	(SETQ cAccGBasis (NCONS NIL))
%	(SETQ cSubsGBasis (NCONS NIL))
%	(GROEBNERINIT)
%	(AddTo!&Char0Lists '(STAGGERFINISH) ())
	(AutoRedInit)
	(BindInit)
%	(FORMALINPUT2GBASIS)
	(STAGGERINITSUBSPRI)
	(STAGGERINITPROHIDEALS)
	(STAGGERINITCRITPAIRS)
	(STAGGERINITREDUCTIONS) ))

(DE STAGGERINITSUBSPRI ()
 (PROG 	(AA)
	(SETQ AA (CDR GBasis))
  Ml	(COND (AA
	       (MakeStaggerStuff (CAR AA))
	       (PutMonSubs!=Acc (CAR AA))
	       (SETQ AA (CDR AA))
	       (GO Ml)))
	(PRIORITYINIT) ))

(DE STAGGERINITPROHIDEALS ()
 (PROG	(AA)
	(SETQ AA (CDR GBasis))
  Ml	(COND (AA
	       (FixProhId!&PreCritPairs AA)
	       (SETQ AA (CDR AA))
	       (GO Ml))) ))

(DE STAGGERINITCRITPAIRS () ())

(DE STAGGERKERNEL ()
 (PROG (NGroeb SP2r cMon)

%	For some non-standard applications, and for empty input:
  (COND ((NOT (OR InLeadMons SPairs))
	 (COND ((OR cAccGBasis cSPairs) (GO Aft))
	       (T (GO MlEnd)))))

%	Main loop: Find a new current degree cDeg and initiate it.
 Ml
  (COND ((NOT InLeadMons)
	 (SETQ cDeg (CAAR SPairs))
	 (SETQ cSPairs (CDAR SPairs))
	 (SETQ SPairs (CDR SPairs)))
	((OR (NOT SPairs) (LESSP (CAAR InLeadMons) (CAAR SPairs)))
	 (SETQ cDeg (CAAR InLeadMons))
	 (SETQ cAccGBasis (CAR InLeadMons))
	 (SETQ InLeadMons (CDR InLeadMons)))
	((LESSP (SETQ cDeg (CAAR SPairs)) (CAAR InLeadMons))
	 (SETQ cSPairs (CDAR SPairs))
	 (SETQ SPairs (CDR SPairs)))
	(T
	 (SETQ cAccGBasis (CAR InLeadMons))
	 (SETQ InLeadMons (CDR InLeadMons))
	 (SETQ cSPairs (CDAR SPairs))
	 (SETQ SPairs (CDR SPairs))))

 Aft	% Since APol2Lm is a macro, I use this VERY BAD non-macro:
%  (RPLACD cAccGBasis (MAPCAR cInLeadMons (FUNCTION CDADR)))
  (COND ((NOT cAccGBasis) (SETQ cAccGBasis (NCONS cDeg))))
%  (SETQ cSubsGBasis (LISTCOPY cAccGBasis))
%  (SETQ cInLeadMons NIL)
  (MAPC cSPairs (FUNCTION StagSPairTransform)) % setting AugSP2r
  (SETQ SP2r (CDR AugSP2r))
  (RPLACD AugSP2r NIL)
  (SETQ cSPairs NIL)

%	PairList check:
 PLchk
  (COND ((NOT SP2r) (GO MlEnd))
	((NOT (StagCrit (CAR SP2r)))
	 (SETQ NGroeb (ReduceSubstantialPol (StagFormSPol (CAR SP2r))))
	 (COND (NGroeb (SETQ NGroeb (StagFixNGBasElt NGroeb)))
	       (T (StagFixNullReduced))))
	(T (RemPairFromMon (CAR SP2r) (CAAR SP2r))))
  (SETQ SP2r (CDR SP2r))
  (GO PLchk)

%	The degree cDeg is fully investigated, and the result is to be saved
%	(and perhaps to be displayed).
%	If we simultaneously calculate PBseries, then we do it NOW.
 MlEnd
  (MAPC (CDR cAccGBasis) (FUNCTION StagFixGBasElt))
  (COND (!*CUSTSHOW (DEGREEENDDISPLAY))
	(!*SAVEDEGREE (STAGGERDEGREEOUTPUT)))

%  (DEnSPairs)
%  (MonReclaim)		For the time being, instead:
  (RECLAIM)
  (COND ((CDR cAccGBasis)
	 (SETQ AccGBasis (NCONC AccGBasis (NCONS cAccGBasis)))))
  (SETQ cAccGBasis NIL) % 940505: Rather (RPLACD cAccGBasis NIL) ????
%  (SETQ cSubsGBasis NIL)
  (StagFixEndDegreeThings)
  (COND ((OR InLeadMons SPairs) (GO Ml)))
  (RETURN 'Done) ))

(DE STAGGERFINISH ()
 (PROG	(OldChan)
	(COND (!*SAVEDEGREE (STAGGERENDDEGREEOUTPUT)))
	(MAPC (CDR GBasis)
	      (FUNCTION (LAMBDA (mon)
				(DestructRedor2Redand (Mpt mon)))))
	(AUTOREDUCESTAGGEROUTPUT)
	(COND (!&!*StgFinalOutputChan
	       (SETQ OldChan (WRS !&!*StgFinalOutputChan))))
	(COND (!*DEGREEPRINTOUTPUT
	       (DEGREEBIGOUTPUT DegGBasis))
	      (T
	       (BIGOUTPUT)))
	(PRIN2 "Done") (TERPRI)
	(COND (OldChan
	       (CLOSE (WRS OldChan)))) ))

% (COPYD 'Char0STAGGERFINISH 'STAGGERFINISH)

% Change 1993-06-24: In case of active modular logarithms, the input
% to AutoReduceFromTo should be in ordinary coeff form, not in log form.
% Thus then AccGBasis is changed. (Not GBasis, just to retain some
% modularisation.)/JoeB

(DE AUTOREDUCESTAGGEROUTPUT ()
 (PROGN (TreeMonReform MONLIST NIL)
	(MAPC AccGBasis
	      (FUNCTION
	       (LAMBDA (dlst)
		       (MAPC (CDR dlst)
			     (FUNCTION
			      (LAMBDA (mon)
				      (DestructRedor2Redand
				       (Mpt mon))))))))
	(AutoReduceFromTo AccGBasis DegGBasis GBasis T) ))

% Auxiliaries:

(DE FixProhId!&CritPairs (gbaspos)
 (PROG	(AA BB)
	(SETQ BB (CAR gbaspos))
	(SETQ AA (CDR GBasis))
  Fl	(COND ((NOT (EQ AA gbaspos))
	       (ElimTrivObstruction (CAR AA) BB)
	       (SETQ AA (CDR AA))
	       (GO Fl)))
	(SETQ AA (CDR GBasis))
  Sl	(COND ((NOT (EQ AA gbaspos))
	       (StagSPolPrep (CAR AA) BB)
	       (SETQ AA (CDR AA))
	       (GO Sl)))
	(SETQ AA (CDR gbaspos))
  Tl	(COND (AA
	       (StagElim!&SPolPrep BB (CAR AA))
	       (SETQ AA (CDR AA))
	       (GO Tl))) ))

(DE FixProhId!&PreCritPairs (gbaspos)
 (PROG	(AA BB)
	(SETQ BB (CAR gbaspos))
	(SETQ AA (CDR GBasis))
  Fl	(COND ((NOT (EQ AA gbaspos))
	       (ElimTrivObstruction (CAR AA) BB)
	       (SETQ AA (CDR AA))
	       (GO Fl)))
	(SETQ AA (CDR GBasis))
  Sl	(COND ((NOT (EQ AA gbaspos))
	       (StagSPolPrep (CAR AA) BB)
	       (SETQ AA (CDR AA))
	       (GO Sl))) ))

(DE ElimTrivObstruction (mon1 mon2)
 (PROG  (AA BB !*!&StandardBoundInputMonomial)
	(COND ((AND (SETQ AA (TrivObstructionFactor mon1 mon2))
		    (NOT (MonIdealMember AA (SETQ BB (GetMonProhId mon2)))))
	       (MonIdealUnionNonMember AA BB))) ))

% Note that we ASSUME (Subs!-AccPri!< mon1 mon2). We S.A.P. insert mon1
% and mon2 into Mpt(mon3), and (if necessary, i. e., if Mpt(mon3) didn't
% already exist) insert mon3 into SPairs. We're in trouble if mon3 is on
% the GBasis or of degree cDeg, though.

(DE StagSPolPrep (mon1 mon2)
 (PROG	(AA BB CC DD)
	(COND ((OR (NOT (SETQ BB (StagLCorOUT mon1 mon2)))
		   (MonIdealMember (CAR BB) (SETQ CC (GetMonProhId mon2))))
	       (RETURN NIL))
	      ((SETQ AA (GETMONAUGPROP (SETQ DD (MonInternCopy (CADR BB)))
				       'Pairs))
	       (MemberOrSubs!-AccPriMonInsert mon1 AA)
	       (MemberOrSubs!-AccPriMonInsert mon2 (CDR AA))
	       (RETURN AA)))
        (LPUT (CAR DD) 'Pairs (LIST mon1 mon2))
	(SETQ BB (CDDR BB))
	(COND ((NULL SPairs)
	       (RETURN (SETQ SPairs (NCONS (LIST BB DD))))))
	(SETQ AA (RPLACD augSP SPairs))
  Ml	(COND ((BMI!< BB (CAADR AA))
	       (RPLACD AA (CONS (LIST BB DD) (CDR AA))))
	      ((BMI!= BB (CAADR AA))
	       (MonInsert DD (CADR AA)))
	      ((CDR (SETQ AA (CDR AA)))
	       (GO Ml))
	      (T
	       (RPLACD AA (NCONS (LIST BB DD)))))
	(SETQ SPairs (CDR augSP))
	(RPLACD augSP NIL) ))

(DE StagElim!&SPolPrep (mon1 mon2)
 (PROG	(AA BB CC !*!&StandardBoundInputMonomial)
	(COND ((OR (NOT (SETQ BB (StagTrivObstructionFactor!&LCorOUT mon1
								     mon2)))
		   (MonIdealMember (CAR BB) (SETQ CC (GetMonProhId mon2))))
	       (RETURN NIL))
	      ((EQ (CAR BB) (CDDDR BB))
	       (MonIdealUnionNonMember (CAR BB) CC)
	       (RETURN NIL)))

	% Update ProhId[mon2], if necessary.
	(AND (CDDDR BB)
	     (NOT (MonIdealMember (CDDDR BB) CC))
	     (MonIdealUnionNonMember (CDDDR BB) CC))

	      % Is the LC = mon1? Then an incidental new pair has been taken
	      % care of by StagSPairTransform.
	(COND ((EQ (SETQ CC (MonInternCopy (CADR BB))) mon1) (RETURN NIL))
	      ((SETQ AA (GETMONAUGPROP CC 'Pairs))
	       (MemberOrSubs!-AccPriMonInsert mon1 AA)
	       (MemberOrSubs!-AccPriMonInsert mon2 (CDR AA))
	       (RETURN AA)))
        (LPUT (CAR CC) 'Pairs (LIST mon1 mon2))
	(COND ((NULL SPairs)
	       (RETURN (SETQ SPairs
			     (NCONS (LIST (CADDR BB)
					  CC))))))
	(SETQ AA (RPLACD augSP SPairs))
	(SETQ BB (CADDR BB))
  Ml	(COND ((BMI!< BB (CAADR AA))
	       (RPLACD AA (CONS (LIST BB CC)
				(CDR AA))))
	      ((BMI!= BB (CAADR AA))
	       (MonInsert CC (CADR AA)))
	      ((CDR (SETQ AA (CDR AA)))
	       (GO Ml))
	      (T
	       (RPLACD AA (NCONS (LIST BB CC)))))
	(SETQ SPairs (CDR augSP))
	(RPLACD augSP NIL) ))

(DE StagSPairTransform (mon)
 (PROG	(AA BB CC DD ee FF BooL)
	(SETQ BB (CADR (SETQ ee (GETMONAUGPROP mon 'Pairs))))

	% 920420: There is ONE criterion for dismissing the WHOLE mon;
	% to wit, that BB be NOT the s.a.p smallest mon factor:
	(COND ((NOT (EQ (APol2Lm (SETQ FF (FindGroebF (PMon mon)))) BB))
	       (SETQ NOOFSTAGCONECRIT (ADD1 NOOFSTAGCONECRIT))
	       (REMMONPROP mon 'Pairs)
	       (SETQ BooL (APol2Lm (SETQ FF (FindGroebF (PMon mon)))))))
%	       (RETURN NIL)
	(SETQ AA (RPLACD ee (CDDR ee)))
	(SETQ CC (CDR (MONQUOTIENT (PMon mon) (PMon BB))))
  Ml	(COND ((CDR AA)
	       (COND ((MonIdealMember (SETQ DD
					    (PMon (MONQUOTIENT
						  (PMon mon)
						  (PMon (CADR AA)))))
				      (GetMonProhId (CADR AA)))
		      (RPLACD AA (CDDR AA)))
		     (T
		      (COND (BooL
			     (PRIN2 "***** ")
			     (MONPRINT BooL) (PRIN2 " ")
			     (MONPRINT BB) (PRIN2 " ")
			     (MONPRINT (CADR AA)) (TERPRI)
			     (CONTINUABLEERROR
			      99
			      "STAGCONECRIT applies, but the pair exists")))
		      (SETQ AA (CDR AA))
		      (RPLACA AA
			      (LIST mon
				    (Subs!-AccPri!+Acc
				     (GetMonSubs!-AccPri (CAR AA))
				     (Mon2Subs mon))
				    CC
				    DD
				    BB
				    (CAR AA)))
		      (SubsPriItemInsert (CAR AA) AugSP2r)))
	       (GO Ml))
	      ((NOT (CDR ee))
	       (REMMONPROP mon 'Pairs)))
	(PutMpt mon FF) ))

(DE StagCrit (itm)
 (MonIdealMember (CADR (CDDR itm)) (GetMonProhId (CADDR (CDDDR itm)))) )

(DE StagFixNullReduced ()
 (MonIdealUnionNonMember (CADR (CDDAR SP2r))
			 (GetMonProhId (CADDR (CDDDR (CAR SP2r))))) )

(DE StagFixNGBasElt (augpol)
 (PROG	(AA)
	(COND ((NOT (EQ T (Mpt (SETQ AA (APol2Lm augpol)))))
	       (MarkAccidentalReducible AA)
	       (RenewPairs!@Mon AA)))
	(PutMpt AA augpol)
	(MonIdealUnionNonMember!&Colon (CADR (CDDAR SP2r))
				       (GetMonProhId (CADDR (CDDDR
							     (CAR SP2r)))))
	(MakeStaggerStuff AA)
%	(PRIN2 "** Before TransferMonProhId; AA is ") (MONPRINT AA)
%	(PRIN2 "; niTreeMon is ") (PrintTreeMon niTreeMon)
	(TransferMonProhId AA niTreeMon)
%	(PRIN2 "** After TransferMonProhId; ProhId[AA] is ")
%	(PrintTreeMon (GetMonProhId AA))
	(ClearniTreeMon)
	(PutMonSubs AA (SubsPri2Subs cPolSubsPri))
	(InsertPriGbe (CADDR (CDDDR (CAR SP2r))) AA)
	(PutMonSubs!-Acc AA
			 (Subs!&Mon2Subs!-Acc (SubsPri2Subs cPolSubsPri) AA))
	(FixProhId!&CritPairs (CDR (Subs!-AccPriMonInsert AA GBasis)))
	(FixNAccGBasElt AA)
%	(FixNSubsGBasElt AA)
	(RETURN AA) ))

(DE GeneralMarkAccidentalReducible (mon)
    (SETQ NOOFMULTIPLESTAGBES (ADD1 NOOFMULTIPLESTAGBES)) )

(DE SaveMarkAccidentalReducible (mon)
 (PROGN (LPUT (CAR mon) 'IsAMultiple T)
	(SETQ NOOFMULTIPLESTAGBES (ADD1 NOOFMULTIPLESTAGBES)) ))

(COND ((NOT (DEFP 'MarkAccidentalReducible))
       (COPYD 'MarkAccidentalReducible 'GeneralMarkAccidentalReducible)))

(DE RenewPairs!@Mon (mon)
 (PROG	(AA BB CC)
	(COND ((NOT (SETQ AA (GETMONAUGPROP mon 'Pairs)))
	       (RETURN (MakeTrivPair!@Mon mon))))
	(SETQ BB (PMon MONONE))
	(SETQ CC (CDDR (CADR AA)))
	(COND ((NOT (MonIdealMember (CAR CC)
				    (GetMonProhId (CADDR CC))))
	       (RPLACD AA (CONS (SETQ CC
				      (LIST mon
					    (Subs!-AccPri!+Acc
					     (GetMonSubs!-AccPri (CADDR CC))
					     (Mon2Subs mon))
					    BB
					    (CAR CC)
					    mon
					    (CADDR CC)))
				(CDR AA)))
	       (SubsPriItemInsert CC SP2r) % which actually is 'augmented' here
	       (SETQ AA (CDDR AA)))
	      (T
	       (SETQ AA (CDR AA))))
  Ml	(RPLACA (CDDR (RPLACA (CDDAR AA) BB)) mon)
	(COND ((SETQ AA (CDR AA))
	       (GO Ml))) ))

(DE MakeTrivPair!@Mon (mon)
 (PROG	(AA BB CC)
	(SETQ BB (APol2Lm (Mpt mon)))
	(COND ((MonIdealMember (SETQ AA
				     (PMon (MONQUOTIENT
					   (PMon mon)
					   (PMon BB))))
			       (GetMonProhId BB))
	       (RETURN NIL)))
	(SETQ BB (LIST mon
		       (Subs!-AccPri!+Acc
			(GetMonSubs!-AccPri BB)
			(Mon2Subs mon))
		       (PMon MONONE)
		       AA
		       mon
		       BB))
	(SubsPriItemInsert BB SP2r) % which actually is 'augmented' here
	(LPUT (CAR mon) 'Pairs (NCONS BB)) ))

(DE FixNAccGBasElt (mon) (MonInsert mon cAccGBasis))

%(DE FixNSubsGBasElt (mon)
% (PROG	(AA)
%	(SETQ AA (CDDR (SubsPriMonInsert mon cSubsGBasis)))
%  Ml	(COND (AA
%	       (SubtractRedor (Mpt (CAR AA)) mon)
%	       (SETQ AA (CDR AA))
%	       (GO Ml))) ))

(DE StagFixGBasElt (mon) ())

(DE StagFixEndDegreeThings () (FixEndDegreeThings))



(DE GMGeneralCommify () ())


%%%% For debugging:	%%%%

(DE CheckStgOrders ()
  (PROG (AA)
	(SETQ CheckStgOrdersNo (ADD1 CheckStgOrdersNo))
	(COND ((NOT (AND (PAIRP GBasis)
			 (PAIRP (SETQ AA (CDR GBasis)))
			 (PAIRP (CDR AA))))
	       (RETURN T)))
	GBl
	(COND ((OR (EQ (CAR AA) (CADR AA))
		   (Subs!-AccPri!< (GetMonSubs!-AccPri (CADR AA))
				   (GetMonSubs!-AccPri (CAR AA))))
	       (PRIN2 "***** CheckStgOrders number ")
	       (PRIN2 CheckStgOrdersNo)
	       (PRIN2 " detected disorder in GBasis.") (TERPRI)
	       (GO Err))
	      ((PAIRP (CDR (SETQ AA (CDR AA))))
	       (GO GBl)))
	(RETURN T)
	Err
	(PRIN2 " ---  Offending elements:") (TERPRI)
	(PRINTX (CDAR AA))
	(PRINTX (CDADR AA))
	(CONTINUABLEERROR 99 NIL NIL) ))


(DE GMCommify ()
 (PROG	(*USERMODE *REDEFMSG)
	(AutoRedCommify)
	(PriorityCommify)
	(SubstanceCommify)
	(IdealsCommify)
	(GMGeneralCommify)
 ))

(COND ((CommP) (GMCommify)))

(ON RAISE)
