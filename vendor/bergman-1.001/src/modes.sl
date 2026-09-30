%  Mode changing procedures.
%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%
%% Copyright (C) 1992,1994,1996,1997,1999,2002,2003,2004,2005,
%% 2006 Joergen Backelin
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

%	Created 1997-09-17 from part of old main.sl.
%	All top level mode changers should be collected here.

%   CHANGES:

%  Introducing "leaving" procedures for the resolution type
% setters.  Thus, added a new list !$!&ResolutionTypeEnds!#!*,
% and calls to the new procedure APPLYIFDIFFANDDEF1, as well
% as three as yet undefined Leave<specification>RESOLUTION
% procedures./JoeB

%  Changed a CONS to LIST in RestoreObjectType, in order to
% adapt to the Common Lisp troubles with non-list arguments.
% (Perhaps, this is a cause for trouble in other FEXPRs, as
% well.)
%  Commented out some printing for debugging reasons within
% PRINTTIMES resetting.
%  Added some potential resolution process mode changers into
% SET(DEGREE/ITEM)WISE, namely
% (Anick/MinRes)(Degree/Item)wise, and made them tested by
% APPLYIFDEF0./JoeB 2007-08-20

%  Introduced unstable MONLESSP modifications,
% (GET/SET)OBSOLETENAMESINFORM, (GET/SET)ITEMPRINTOUTPUT,
% RestoreOutputFormat, and RestorePrintTimes.
%  DegLexMONLESSP --> LexMONLESSP; RestoreOutputDomain -->
% RestoreCoeffDomain.
%  Extended the use of DEGREEPRINTOUTPUT, and moved it to
% OUTPUTFORMAT; probably duplicating SAVEDEGREE.  The caused
% confusion might be fixed in a more consistent output format
% revision./JoeB 2006-08-20

%  Introduced MAXDEG mode changers./JoeB 2006-08-11

%  ItemFixNGbe split up into StableItemFixNGbe and InstableItemFixNGbe.
% /JoeB 2006-08-05

%  Added GETPROCESS and !*!&DegreeWise!#./JoeB 2006-08-03

%  Corrected the declaration of !$!&NonCommMonOrders!#!*.
%  Added SETDEGREEWISE and SETITEMWISE (but not yet the GET's)./JoeB
% 2006-08-01

%  Added the MATRIX commutative order, its setter MATRIXIFY,
% and its matrix, with access procedures (SET/GET)ORDERMATRIX.
% Changed LCorOUT redefinitions./JoeB 2005-08-01 -- 08-02

%  Added  INVWELIMORDER and corrsponding mode changes. /ufn 2005-06-26

%  Added ExtractSomeModes, and employed it in GETSETUP and
% PRINTSETUP (which now are FEXPRs, with extended
% functionality)./JoeB 2005-06-20 -- 06-26

%  Corrected CHECKSETUP./JoeB 2005-03-14

%  Moved DefineSWLHFEXPR, DefineGSSF, and CheckWarning to
% macros.sl./JoeB 2005-02-04


%  Corrected (improved) HSERIESLIMITATIONS handling in
% RestoreStrategyModes (CHECKSETUP, respectively). Added
% setup clashes for commutative mode and few variables.
% Added RINGSTACKLENGTH./JoeB 2005-01-22

%  Corrected GLOBAL declaration corrections./JoeB 2005-01-10--01-18

%  Corrected GLOBAL declarations./JoeB 2005-01-07

%  Added (GET/SET)LOWTERMSHANDLING./JoeB 2004-10-12.

%  Corrected the output format restore procedure part of
% !$!&ListOfModes!#!*. Added (GET/SET)ODDPRIMESMODULI.
% /JoeB 2004-10-10

%  Renamed CUSTSHOW as CUSTDISPLAY, and moved it into the
% OUTPUTFORMAT major mode. Moved CUSTSTRATEGY into the
% strategy mode. Added ACTIVETRACEBREAKS to the debug
% minor modes./JoeB 2004-10-09

%  Fixed the new common lisp lambda expression `feature'
% circumvention in ModeSettingP, too. (Cf. the 2003-08-25
% comment.) Added PROTECTEDASSOC./JoeB 2004-05-10

% Improved clash and CheckFailInform handling./JoeB 2004-05-08

%  Added HOMOGENISATIONVARIABLE as variable setup minor mode.
% Corrected GETIMMEDIATEASSOCRINGPBDISPLAY./JoeB 2004-05-05

%  Added main strategy as mode. Added more clashes./JoeB 2004-05-03

%  Corrected ModePath. Added more clashes./JoeB 2004-04-30

%  Corrected the !#!&ListOfModes!#!* INPUTFORMAT item function
% tail./JoeB 2004-04-27

%  Added Inmmediate Associated Ring display moder as minor
% output mode.
%  Improved Anick minor modes documentation, and re-positioned them
% to directly after resolution type instead of after output.
%  /JoeB 2004-04-24

%  Moved OneOfAskRead and QuizIds!* to dialogue.sl./JoeB 2004-04-17

%  Corrected CHECKWARNING handling of VARIABLENUMBER, and
% expanded it considerably.
%  Changed the default setting of OLDSERIESMODES1 to 'off'.
%  Added a CLEARVARNO clause to RestoreVariableModes.
%  Added !*!#ClashList!& and FINDMODECLASHES./JoeB,
% October 2003 to 2003-11-04


%  Replaced *NONCOMMUTATIVE by !*!#NonCommutativity!# and
% ((Non)CommP); and added (S/G)ETRINGTYPE and !*!&RingTypes!#.
%  Added GETORDER./JoeB 2003-08-25

%  Changing (APPLY (CDR inp) ()) to (EVAL (LIST (CDR inp))) in a
% couple of places, in order to take care of self-loading macros.
% /JoeB 2003-08-12

%  Adding AUTO ADDRELATIONS handling./JoeB 2002-10-10

%  Tried to fix the GLOBAL declaration of the switches corresponding
% to the elements in !#!&UsrFlags!#!*. Avoided re-definitions of
% ExtractCurrentModes and of PRINTSETUP./JoeB 2002-10-09

%  Added resolution calculations type modes./JoeB 2002-07-12

%  Added HSeriesOrdWeights,HSeriesAltWeights.
%  Spread the use of OneOfAskRead, but removed !*!&HelpList!#.
% /JoeB 2002-07-06 -- 09

%  PMon2HlbMon --> commPMon2HlbMon/JoeB 2002-06-16, 2002-06-26

%  Added a module type.
% JoeB 2001-08-03


%  Changed RestoreMode and !#!&ListOfModes!#!*, by introducing
% extra FUNCTION quotings within the !#!&ListOfModes!#!* items,
% countered by an extra EVAL before APPLYing the function within
% RestoreMode. (Thus, the new `feature' of clisp APPLY, i.e.,
% not to accept pure LAMBDA expressions as functions, is
% circumvened.)/JoeB,SV 2000-08-08

%  Introduced IOWeights2Weights, Weights2IOWeights.  Made
% !*!&WeightsList!# !*!&WeightsDPList!# FLUID (not GLOBAL).
% Improved argument check and handling for SETWEIGHTS.
% Corrected GETSETUP handling of HSERIESLIMITATIONS.
% Added !#NoAListWarning!&, CheckWarning, and !*!#CheckFailInform,
% and started to make CHECKSETUP operating.  Brought PMon2HlbMon
% here. Corrected pp order changers by removing the prefix comm-
% from LCorOUT.

%  Combined setting and globalising !#!&UsrFlags!#!* (in order for
% the common lisp compiler to be able to handle it)./JoeB 1999-11-19


%  Removed !*PBSisLoaded, PBSERIESFILE!*./JoeB 1999-11-04

%  Corrected SETMAXDEG./JoeB 1999-07-08

%  Made ListSwitch call APPENDLCHARTOID. Added CL!-SPECIFIC
% PRINTSETUP. GETD --> DEFP. /JoeB 1999-07-02

%  Added 12 preliminary GET... and 12 SET..., in order to avoid
% (documented) switches for mode changing purposes./JoeB 1999-07-01

%  Replaced explicit ALGOUTMODE access by calls to SETALGOUTMODE and
% GETALGOUTMODE. Added QuizIds!* and OneOfAskRead./JoeB 1999-06-29

%  Added extraction and restoration of Hilbert series minima.
% /JoeB 1999-06-26

%  Added ANICK mode. Changed ExtractCurrentModes and ExtractMode,
% so that they should handle some mode extractor being undefined
% gracefully./JoeB 1998-11-07

%  Introduced the type modestate./JoeB 1998-11-04

%  Added <GET,SET><MIN,MAX>DEG./JoeB 1998-11-03

%  REVLEXIFY --> DEGREVLEXIFY, but old name retained as an (obsolete)
% alias. Corrected some messages./JoeB 1998-10-22 -- 10-23



% Import: ; QuizIdP, OneOfAskRead.

% Export: AUTOADDRELATIONSTATE, MAYBEAUTOADDRELATIONS.

% Available: DEGLEXIFY, PURELEXIFY, DEGREVLEXIFY, MATRIXIFY, COMMIFY,
%	     SETMODULEOBJECT, SETRINGOBJECT, MODULEOBJECT,
%	     SETLOWTERMSHANDLING, GETLOWTERMSHANDLING, NONCOMMIFY,
%	     NOEXPTSPRINTMODE, EXPTSPRINTMODE, DENSECONTENTS, SPARSECONTENTS,
%	     CLEARWEIGHTS, SETWEIGHTS, GETWEIGHTS, GETWEIGHTDPS,
%	     PRINTWEIGHTS, SETOBJECTTYPE, GETOBJECTTYPE,
%	     GETODDPRIMESMODULI, SETODDPRIMESMODULI,
%	     AUTOADDRELATIONS, NOAUTOADDRELATIONS,
%	     CANCELAUTOADDRELATIONSSETTINGS, SETAUTOADDRELATIONSSTATE,
%	     SETSETUP, GETSETUP, CHECKSETUP, PRINTSETUP,
%	     FINDMODECLASHES.

(OFF RAISE)

(GLOBAL '(!$!&Strategies!#!* MINDEG MAXDEG !*MODLOGARITHMS !$!&LowRepr!#
	  !$!&LowReprTypes!#!* !*!&NoRaiseAlgInp!# !*!&!#PrintNoExpts!*
	  !*!&!#PBDisplay!# !*!&!#OverWrite!# !#!&ResTyp!#
	  !$!&ResolutionTypes!#!* !$!&ResolutionTypeEnds!#!*
	  !$!&RingTypes!#!* commMONORDER noncommMONORDER
	  !$!&CommMonOrders!#!* !$!&NonCommMonOrders!#!* !#!&CommOrderMatrix!#
	  !*!&DegreeWise!# !*DEGREEPRINTOUTPUT !$!&ItemPrinting!#
	  !$!#ProcessingGbes!#!* !*!&!#Stable!#  !* Modulus !$!&OddModRepr!#!*
	  !$!&ListOfModes!#!* !#!&ObjectType !#!&UsrFlags!#!* !*HSisLoaded
	  !*!#NonCommutativity!# HSERIESFILE!* !#NoAListWarning!&
	  !$!&ClashList!#!* !$!&CancelList!#!* MONLIST !*!&RelAutoAdd!#
	  !*!&RelAutoAddProhib!# !#!&MaxChainLength!#))

(FLUID '(!*TakeDenseContents
	 !$!&WeightsList!#!* !$!&WeightsDPList!#!* !*!#CheckFailInform))

(SETQ !#NoAListWarning!& " is not a dotted-pair list.")

(SETQ !$!&CancelList!#!* '(CANCEL cancel Cancel cANCEL))

%  The disposition of the particular mode changers follows the
% manual listing:

%Object type:
%	Ring (default)				SETRINGOBJECT()
%	Module					SETMODULEOBJECT()
%	Two modules (for calculating Tor(*,*))	SETTWOMODULESOBJECT()
%	Factor Algebra ( = Residue class ring)	SETFACTALGOBJECT()
%  Minor variants:
%	Right, Left, 2-sided module?
%	Autoadding of relations?		SETAUTOADDRELATIONSTATE(state)
%		Yes!				AUTOADDRELATIONS()
%		No, absolutely not!		NOAUTOADDRELATIONS()
%		Perhaps, but not right now!	CANCELAUTOADDRELATIONSSETTINGS()
%	Permit linear or constant terms?	SETLOWTERMSHANDLING(state)
%		Yes!				state := SAFE
%		No, since using fast tricks	state := QUICK
%
%Resolution calculations type:
%	None (default)				SETRESOLUTIONTYPE(NIL)
%	Anick					SETRESOLUTIONTYPE(ANICK)
%
%Anick minor modes (only present when the module anick is loaded):
%	In what form is tenspols (Anick resolution elements) printed?
%		Semidistributed			PRINTTENSORPOLSSEMIDISTRIBUTED()
%		(Fully) distributed		PRINTTENSORPOLSDISTRIBUTED()
%	The beginning, tensor sign, and end of a tensor product term:
%					SETTENSPOLPRTSTRINGS(string,string,string)
%	The chain link demarkation string	SETEDGESTRING(string)
%	Should this string be printed?		SETEDGESTRINGPRINTING(boole)
%	Should the Betti numbers of the homology be calculated at each degree end?
%		Yes, and immediately displayed!	      ONFLYBETTI(T)
%		Yes, but not automatically displayed  CALCBETTI(T) + ONFLYBETTI(NIL)
%		No				      CALCBETTI(NIL)
%
%Polynomial ring (or correspondingly for other objects) set-up:
%	Type of ring (or correpondingly);	SETRINGTYPE(),COMMIFY(),
%						NONCOMMIFY()
%	Commutative DEG-REVLEX (default);	COMMIFY(),DEGREVLEXIFY()
%	Commutative DEG-LEX;			  - " -  ,DEGLEXIFY()
%	Commutative MATRIX;			  - " -  ,MATRIXIFY();
%		set the matrix with			SETORDERMATRIX(llint)
%	Non-commutative DEG-LEFTLEX (default);	NONCOMMIFY(),DEGLEFTLEXIFY()
%	Non-commutative ELIM-DEG-LEFTLEX	NONCOMMIFY(),ELIMORDER()
%  Minor variants:
%	Ordinary ( = unit) weights		CLEARWEIGHTS(),SETWEIGHTS()
%	Alternative weights			SETWEIGHTS()
%	Homogenising variable:			SETHOMOGVARIABLE()
%
%Coefficient arithmetics:
%	Characteristic 0, arbitrary integers (default); SETMODULUS(0)
%	Characteristic 0, only inums;		NOBIGNUMS, - " -
%	Characteristic 2;			SETMODULUS(2)
%	Odd characteristic, ordinary inum arithmetics;  SETMODULUS(pr)
%	Odd characteristic, ordinary bignum arithmetics; - " -
%	Odd characteristic, logarithm table inum arithmetics; - " -,
%						MODLOGARITHMS
%	(Arbitrary Reduce Standard Forms;	SETREDUCESFCOEFFS()
%	 only available in bergman-under-reduce)
%
%Fundamental strategy:				SETSTRATEGY(clause)
%	Default, ordinary (Buchberger, Bergman) (with degree first)
%						SETDEFAULTSTRATEGY()
%	Rabbit (jumping back to lower degrees)	SETRABBITSTRATEGY()
%	Staggered with substance (SAWS).	SETSAWSSTRATEGY()
%  Major mode modifications:
%	Work degree by degree (irrespective of order)	SETDEGREEWISE()
%	   Instead, work item for item (NOT compatible with Rabbit or SAWS)
%						SETITEMWISE()
%	Are the found leading monomials of Groebner basis elements stable?
%						SETSTABILITY(T,NIL),
%						STABILISE(),DESTABILISE()
%  Minor mode modifications:
%	    with immediate full autoreduction (default);
%						IMMEDIATEFULLREDUCTION
%	    without immediate full autoreduction;    -  "  -
%	Densely or sparsely performed factoring out of contents:
%						DENSECONTENTS(),
%						SPARSECONTENTS()
%	Ordinary or Hilbert series limit interruption strategy:
%						ORDNGBESTRATEGY(),
%						MINHILBLIMITSTRATEGY()
%	   (or use SETINTERRUPTSTRATEGY)
%	Calculation start and end points:	SETMINDEG(),
%						GETMINDEG(),
%						SETMAXDEG(),
%						GETMAXDEG().
%	Customised strategy procedures read (if defined):
%						SETCUSTSTRATEGY
%	   combined with defining one or more of
%	   CUSTNEWCDEGFIX, CUSTNEWINPUTGBEFIND, CUSTCRITPAIRTONEWGBE,
%	   CUSTENDDEGREE, CUSTENDDEGREECRITPAIRFIND, CUSTITEMCRITPAIRFIND.
%
%Input mode minor modification:
%	(No) case sensitivity in algebraic input SETCASESENSALGIN (NIL/T)
%
%Output mode:
%	Ordinary algebraic form (default):	SETALGOUTMODE(ALG)
%	Lisp form:				SETALGOUTMODE(LISP)
%	Macaulay-like algebraic form:		SETALGOUTMODE(MACAULAY)
%
%  Submode:
%    PRINTTIMES
%	DEGREEPRINTOUTPUT <NIL | T>
%	ITEMPRINTOUTPUT	  <NIL | T | MAYBE>
% *	FINALPRINTOUTPUT  <MAYBE | T | NIL>
%  Minor mode modifications:
%	Collect common factors to exponents (default):
%						EXPTSPRINTMODE()
%	Print each factor separately:		NOEXPTSPRINTMODE()
%
%	If the associated monomial ring Poincare-Betti series is calculated
%	degree by degree, should it be printed automatically or not:
%					SETIMMEDIATEASSOCRINGPBDISPLAY(NIL/T)
%	Should existing files if possible be overwritten?
%						SETOVERWRITE(NIL/T)
%	Customised display procedures read (if defined):
%						SETCUSTDISPLAY
%	   combined with defining one or more of
%	   CUSTDISPLAYINIT, DEGREEENDDISPLAY, CUSTCLEARCDEGDISPLAY,
%	   CUSTCLEARCDEGOBSTRDISPLAY, and HSERIESMINCRITDISPLAY.
%
%Debugging mode modifications:
%	If an alertchannel is open, and called by FILEALERT with second
%	argument MAYBE, should the channel be closed?  SETDIRECTALERTCLOSING (NIL/T)
%	Setup checkers print (not) failure information as warnings to the
%	write selected channel.			SETCHECKFAILUREDISPLAY(NIL/T)
%	The following option should only be turned on, if bergman is
%	compiled under Psl or Reduce:
%	Should we cause continuable error loops at entries and exits
%	of procedures which are traced by MYTRACE or MYTR1?
%						SETACTIVETRACEBREAKS(NIL/T)

%   Mode influencing user available switches - a complete list.
%   (However, note that we plan to replace them by mode changers!)

(GLOBAL
 (MAPCAR
  (SETQ !#!&UsrFlags!#!*
	'(%CUSTSHOW CUSTSTRATEGY
%	  DEGREEPRINTOUTPUT
	  DYNAMICLOGTABLES
%	  HOMOGENISED
	  IMMEDIATECRIT IMMEDIATEFULLREDUCTION
	  IMMEDIATERECDEFINE NOBIGNUM
	  OBSOLETENAMESINFORM OLDPRINTMODES1 OLDSERIESMODES1
	  STANDARDANICKMODES
	  PBSERIES REDUCTIVITY SAVEDEGREE SAVERECVALUES
%	  MONOIDAL POSLEADCOEFFS			% Presently not used?
%	  SAVEACCIDENTALREDUCIBILITYINFO SAVEINHOMOGMONLIST
)) (FUNCTION (LAMBDA (id)  (APPENDLCHARTOID '(!*) id)))))

% (GLOBAL !#!&UsrFlags!#!*)

(GLOBAL '(CUSTSHOW CUSTSTRATEGY HOMOGENISED TRBR
	  !*CUSTSHOW !*CUSTSTRATEGY !*HOMOGENISED))

(CL!-SPECIFIC
 (DE DefSwitchExpr (x) (LIST 'DEFSWITCH x))
)

(CL!-SPECIFIC
(MAPCAR (MAPCAR !#!&UsrFlags!#!* 'DefSwitchExpr) 'EVAL)
)

(FLUID '(*TRBR))

(CL!-SPECIFIC
(MAPCAR (MAPCAR '(CUSTSHOW CUSTSTRATEGY HOMOGENISED TRBR) 'DefSwitchExpr)
	'EVAL)
)


%  General auxiliaries for the mode changers:

%  Tries clause (normally: user input to an FEXPR), trying to get
% a good antecedent inp for the association list actlist out of it.
% If the user seems to want help, provides a simple dialogue in
% order to get inp. If an inp with an actlist item is found, apply
% the CDR of that item as a mode changing procedure without argument;
% returning retval. Else, return an error.

%  In a dialogue or error message, use id as the calling function name.

%  Meanings of PROG variables: ReTurn value; INPut mode clause;
% composed Error Message.

%# SetWithLists!&Help ( id, any, any, alist ) : any ;
(DE SetWithLists!&Help (fcnname clause retval actlist)
 (PROG	(rt inp em)
	(SETQ rt retval)
	(SETQ em (CONSTANTLIST2STRING (LIST "Bad input to" fcnname)))
	(COND ((ATOM clause)
	       (ERROR 99 em))
	      ((QuizIdP (SETQ inp (CAR clause)))
	       (PRIN2 "** ")
	       (PRIN2 fcnname)
	       (PRIN2 " should be given one argument:")
	       (TERPRI)
	       (SETQ inp (OneOfAskRead (MAPCAR actlist (FUNCTION CAR)))))
	      ((CDR clause)
	       (ERROR 99 em))
	      ((NOT (ASSOC inp actlist))
	       (SETQ inp (EVAL inp))))
	(COND ((NOT (SETQ inp (ASSOC inp actlist)))
	       (ERROR 99 em)))
	(EVAL (LIST (CDR inp)))
	(RETURN rt) ))


%  Mode changers (mode by mode):

%	Object type:

%# SETMODULEOBJECT () : - ;
(DE SETMODULEOBJECT ()
 (PROG	(!*USERMODE !*REDEFMSG)
	(SETQ !#!&ObjectType 'MODULE)
	(APPLYIFDEF0 '(AnickModuleObject HSerModuleObject)) ))

%# SETTWOMODULESOBJECT () : - ;
(DE SETTWOMODULESOBJECT ()
 (PROG	(!*USERMODE !*REDEFMSG)
	(SETQ !#!&ObjectType 'TWOMODULES)
	(APPLYIFDEF0 '(AnickTwoModulesObject HSerTwoModulesObject)) ))

%# SETFACTALGOBJECT () : - ;
(DE SETFACTALGOBJECT ()
 (PROG	(!*USERMODE !*REDEFMSG)
	(SETQ !#!&ObjectType 'FACTORALGEBRA)
	(APPLYIFDEF0 '(AnickFactAlgObject HSerFactAlgObject)) ))

%# SETRINGOBJECT () : - ;
(DE SETRINGOBJECT ()
 (PROG	(!*USERMODE !*REDEFMSG)
	(SETQ !#!&ObjectType 'RING)
	(APPLYIFDEF0 '(AnickRingObject HSerRingObject)) ))

%# GETOBJECTTYPE () : - ;
(DE GETOBJECTTYPE () (PROGN !#!&ObjectType) )

%# SETOBJECTTYPE (uip) : id ; FEXPR
(DF SETOBJECTTYPE (uip)
 (PROG	(ip)
	(COND ((ATOM uip)
	       (SETQ ip uip))
	      ((AND (EQ (CAR uip) 'QUOTE) (PAIRP (CDR uip))
		    (NULL (CDDR uip)))
	       (SETQ ip (CADR uip)))
	      ((CDR uip)
	       (GO Err))
	      (T
	       (SETQ ip (CAR uip))))
	(COND ((OR (NOT ip) (EQ ip 'RING))
	       (RETURN (SETRINGOBJECT)))
	      ((EQ ip 'MODULE)
	       (RETURN (SETMODULEOBJECT)))
	      ((EQ ip 'TWOMODULES)
	       (RETURN (SETTWOMODULESOBJECT)))
	      ((EQ ip 'FACTORALGEBRA)
	       (RETURN (SETFACTALGOBJECT))))
 Err	(ERROR 99 "Bad object type input") ))

%# MODULEOBJECT () : boolean ;
(DE MODULEOBJECT () (EQ !#!&ObjectType 'MODULE) )


%	Automatic relation adding state:
(DE AUTOADDRELATIONSTATE () (PROGN !*!&RelAutoAdd!#) )

(DE AUTOADDRELATIONS ()
 (PROG	(rt)
	(SETQ rt !*!&RelAutoAdd!#)
	(SETQ !*!&RelAutoAdd!# T)
	(SETQ !*!&RelAutoAddProhib!# NIL)
	(RETURN rt) ))

(DE NOAUTOADDRELATIONS ()
 (PROG	(rt)
	(SETQ rt !*!&RelAutoAdd!#)
	(SETQ !*!&RelAutoAdd!# NIL)
	(SETQ !*!&RelAutoAddProhib!# T)
	(RETURN rt) ))

(DE MAYBEAUTOADDRELATIONS ()
 (COND ((NOT !*!&RelAutoAddProhib!#) (SETQ !*!&RelAutoAdd!# T))) )

(DE CANCELAUTOADDRELATIONSSETTINGS ()
 (PROG	(rt)
	(SETQ rt (CONS !*!&RelAutoAdd!# !*!&RelAutoAddProhib!#))
	(SETQ !*!&RelAutoAdd!# NIL)
	(SETQ !*!&RelAutoAddProhib!# NIL)
	(RETURN rt) ))

(DF SETAUTOADDRELATIONSSTATE (stt)
 (COND ((AND (PAIRP stt) (MEMQ (CDR stt) !$!&CancelList!#!*))
	(CANCELAUTOADDRELATIONSSETTINGS))
       ((OR (NOT stt) (AND (PAIRP stt) (NOT (CDR stt))))
	(NOAUTOADDRELATIONS))
       (T
	(AUTOADDRELATIONS))) )


%	Handling of constant or linear terms:

%	Permit linear or constant terms?	SETLOWTERMSHANDLING(state)
%		Yes!				state := SAFE
%		No, since using fast tricks	state := QUICK

(SETQ !$!&LowReprTypes!#!*
 '((QUICK . SETQUICKLOWTERMSHANDLING)
   (SAFE . SETSAFELOWTERMSHANDLING)))

%# SETLOWTERMSHANDLING (uip) : id ; FEXPR
(DefineSWLHFEXPR SETLOWTERMSHANDLING (GETLOWTERMSHANDLING) !$!&LowReprTypes!#!*)

%# GETLOWTERMSHANDLING () : id ;
(DE GETLOWTERMSHANDLING () !$!&LowRepr!#)

%# SETQUICKLOWTERMSHANDLING () : id
(DE SETQUICKLOWTERMSHANDLING ()
 (PROG	(rt)
	(SETQ rt (GETLOWTERMSHANDLING))
	(SETQ !$!&LowRepr!# 'QUICK)
	(noncommQuickLowTms)
	(ioQuickLowTms)
	(RETURN rt) ))

%# SETSAFELOWTERMSHANDLING () : id
(DE SETSAFELOWTERMSHANDLING ()
 (PROG	(rt)
	(SETQ rt (GETLOWTERMSHANDLING))
	(SETQ !$!&LowRepr!# 'SAFE)
	(noncommSafeLowTms)
	(ioSafeLowTms)
	(RETURN rt) ))


%	Resolution calculation types:

%# SETNORESOLUTION () : id ;
(DE SETNORESOLUTION ()
 (PROG	(rt !*USERMODE !*REDEFMSG)
	(SETQ rt (GETRESOLUTIONTYPE))
	(APPLYIFDIFFANDDEF1 (SETQ !#!&ResTyp!# 'NONE)
			    rt
			    !$!&ResolutionTypeEnds!#!*)
	(COPYD 'ResolutionInit 'NILNOOPFCN0)
	(COPYD 'ResolutionFixcDegEnd 'NILNOOPFCN0)
	(RETURN rt) ))

%# SETRESOLUTIONTYPE (uip) : id ; FEXPR
(DefineSWLHFEXPR SETRESOLUTIONTYPE (GETRESOLUTIONTYPE)
		 !$!&ResolutionTypes!#!*)

%# GETRESOLUTIONTYPE () : id ;
(DE GETRESOLUTIONTYPE () !#!&ResTyp!#)

(SETQ !$!&ResolutionTypes!#!*
 '((NONE . SETNORESOLUTION)
   (NIL . SETNORESOLUTION)
   (ANICK . SETANICKRESOLUTION)
   (MINIMAL . SETMINIMALRESOLUTION)))

(SETQ !$!&ResolutionTypeEnds!#!*
 '((NONE . LeaveNORESOLUTION)
   (ANICK . LeaveANICKRESOLUTION)
   (MINIMAL . LeaveMINIMALRESOLUTION)))



%	Polynomial ring set-up:

%# SETRINGTYPE (uip) ; id ; FEXPR
(DefineSWLHFEXPR SETRINGTYPE (GETRINGTYPE) !$!&RingTypes!#!*)

(DE GETRINGTYPE ()
 (COND	((NonCommP) 'NONCOMMUTATIVE)
	(T 'COMMUTATIVE)) )

%# COMMIFY () : - ;
(DE COMMIFY ()
 (PROG	(!*USERMODE !*REDEFMSG)
	(OFF !#NonCommutativity!#)
	(OFF IMMEDIATECRIT)
	(MonCommify)
	(ReclaimCommify)
	(APPLYIFDEF0 '(HSeriesCommify))
	(COPYD 'SPolInputs 'commSPolInputs)
	(COPYD 'SPolPrep 'commSPolPrep)
	(COND ((DEFP 'commPolAlgRead)
	       (COPYD 'PolAlgRead 'commPolAlgRead)))

	% Until the series handling is improved:
	(OFF PBSERIES)
	% Temporary, in order to retain backwards compatibility:
	(COND (!*OLDPRINTMODES1 (EXPTSPRINTMODE)))
	))

%# NONCOMMIFY () : - ;
(DE NONCOMMIFY ()
 (PROG	(!*USERMODE !*REDEFMSG)
	(ON !#NonCommutativity!#)
	(ON IMMEDIATECRIT)
	(MonNonCommify)
	(ReclaimNonCommify)
	(APPLYIFDEF0 '(HSeriesNonCommify))
	(COPYD 'SPolInputs 'noncommSPolInputs)
	(COPYD 'SPolPrep 'noncommSPolPrep)
	(COND ((DEFP 'noncommPolAlgRead)
	       (COPYD 'PolAlgRead 'noncommPolAlgRead)))
	% Temporary, in order to retain backwards compatibility:
	(COND (!*OLDPRINTMODES1 (NOEXPTSPRINTMODE)))
	(COND (!*OLDSERIESMODES1 (ON PBSERIES)))
	))

(DE ELIMORDER ()
 (PROG	(!*USERMODE !*REDEFMSG)
	(SETQ noncommMONORDER 'ELIMLEFTLEX)
	(COPYD 'noncommstableMONLESSP 'noncommElimLeftLexMONLESSP)
%	(COPYD 'noncomminstableMONLESSP 'noncomminstableElimLeftLexMONLESSP)
	(COPYD 'noncomminstableMONLESSP 'noncommElimLeftLexMONLESSP)
	(COND ((NonCommP) (MonNonCommify))) ))
(DE INVELIMORDER ()
 (PROG	(!*USERMODE !*REDEFMSG)
	(SETQ noncommMONORDER 'INVELIMLEFTLEX)
	(COPYD 'noncommstableMONLESSP 'noncommInvElimLeftLexMONLESSP)
%	(COPYD 'noncomminstableMONLESSP 'noncomminstableInvElimLeftLexMONLESSP)
	(COPYD 'noncomminstableMONLESSP 'noncommInvElimLeftLexMONLESSP)
	(COND ((NonCommP) (MonNonCommify))) ))

(DE INVWELIMORDER ()
 (PROG	(!*USERMODE !*REDEFMSG)
	(SETQ noncommMONORDER 'INVWELIMLEFTLEX)
	(COPYD 'noncommstableMONLESSP 'noncommInvWElimLeftLexMONLESSP)
%	(COPYD 'noncomminstableMONLESSP 'noncomminstableInvWElimLeftLexMONLESSP)
	(COPYD 'noncomminstableMONLESSP 'noncommInvWElimLeftLexMONLESSP)
	(COND ((NonCommP) (MonNonCommify))) ))

% Used together with homogenisation, Otherwise HomogVarInd should be
% put correctly
(DE HOMOGELIMORDER ()
 (PROG	(!*USERMODE !*REDEFMSG)
	(SETQ noncommMONORDER 'HOMOGELIMLEFTLEX)
	(COPYD 'noncommstableMONLESSP 'noncommHomElimMONLESSP)
	(COPYD 'noncomminstableMONLESSP 'noncommHomElimMONLESSP)
	(COND ((NonCommP) (MonNonCommify))) ))
  
(DE DEGLEFTLEXIFY ()
 (PROG	(!*USERMODE !*REDEFMSG)
	(SETQ noncommMONORDER 'TDEGLEFTLEX)
	(COPYD 'noncommstableMONLESSP 'noncommLexMONLESSP)
	(COPYD 'noncomminstableMONLESSP 'instableDegMONLESSP)
	(COND ((NonCommP) (MonNonCommify))) ))

(COPYD 'NOELIM 'DEGLEFTLEXIFY)

%# DEGLEXIFY () : - ;
(DE DEGLEXIFY ()
 (PROG	(!*USERMODE !*REDEFMSG)
%	(COND ((NonCommP)
%	       (ERROR 1
%		      "DEGLEXIFY not allowed in the non-commutative case.")))
	(SETQ commMONORDER 'TDEGLEX)
	(COPYD 'commstableMONLESSP 'LexMONLESSP)
	(COPYD 'comminstableMONLESSP 'instableDegMONLESSP)
	(COPYD 'LCorOUT 'ordLCorOUT)
	(COPYD 'intermedpmon2PMon 'LISTCOPY)
	(COPYD 'commMONLISPOUT 'LISTCOPY)
%	(COPYD 'MONLISPOUT 'commMONLISPOUT)
%	(COPYD 'commMonAlgOutprep 'commMonAlgOutprep!_copy)
%	(COPYD 'MonAlgOutprep 'commMonAlgOutprep)
	(COPYD 'commPMon2HlbMon 'REVERSE)
	(APPLYIFDEF0 '(HomogDegLexify))
	(COND ((CommP) (COMMIFY)))
	))

%# PURELEXIFY () : - ;
(DE PURELEXIFY () % ONLY interesting in conjunction with homogenisation.
 (PROG	(!*USERMODE !*REDEFMSG)
%	(COND ((NonCommP)
%	       (ERROR 1
%		      "PURELEXIFY not allowed in the non-commutative case.")))
	(SETQ commMONORDER 'PURELEX)
	(COPYD 'commstableMONLESSP 'LexMONLESSP)
	(COPYD 'comminstableMONLESSP 'LexMONLESSP)
	(COPYD 'LCorOUT 'ordLCorOUT)
	(COPYD 'intermedpmon2PMon 'LISTCOPY)
	(COPYD 'commMONLISPOUT 'LISTCOPY)
%	(COPYD 'MONLISPOUT 'commMONLISPOUT)
%	(COPYD 'commMonAlgOutprep 'commMonAlgOutprep!_copy)
%	(COPYD 'MonAlgOutprep 'commMonAlgOutprep)
	(COPYD 'commPMon2HlbMon 'REVERSE)
	(APPLYIFDEF0 '(HomogPureLexify))
	(COND ((CommP) (COMMIFY)))
	))

%# DEGREVLEXIFY () : - ;
(DE DEGREVLEXIFY ()
 (PROG	(!*USERMODE !*REDEFMSG)
%	(COND ((NonCommP)
%	       (ERROR 1
%		      "DEGREVLEXIFY not allowed in the non-commutative case.")))
	(SETQ commMONORDER 'TDEGREVLEX)
	(COPYD 'commstableMONLESSP 'RevLexMONLESSP)
	(COPYD 'comminstableMONLESSP 'instableDegMONLESSP)
	(COPYD 'LCorOUT 'RevLexLCorOUT)
	(COPYD 'intermedpmon2PMon 'REVERSE)
	(COPYD 'commMONLISPOUT 'REVERSE)
%	(COPYD 'MONLISPOUT 'commMONLISPOUT)
%	(COPYD 'commMonAlgOutprep 'commMonAlgOutprep!_reverse)
%	(COPYD 'MonAlgOutprep 'commMonAlgOutprep)
	(COPYD 'commPMon2HlbMon 'LISTCOPY)
	(APPLYIFDEF0 '(HomogRevLexify))
	(COND ((CommP) (COMMIFY)))
	))


%# REVLEXIFY () : - ; ALIAS FOR DEGREVLEXIFY
(DE REVLEXIFY () (PROGN
  (COND (!*OBSOLETENAMESINFORM (TERPRI)
	 (PRIN2 "*** REVLEXIFY is obsolete - use DEGREVLEXIFY instead. ")
	 (TERPRI)))
  (DEGREVLEXIFY)))



%# MATRIXIFY () : - ;
(DE MATRIXIFY ()
 (PROG	(!*USERMODE !*REDEFMSG)
	(SETQ commMONORDER 'MATRIX)
	(COPYD 'commstableMONLESSP 'MatrixMONLESSP)
	(COPYD 'comminstableMONLESSP 'MatrixMONLESSP)
	(COPYD 'LCorOUT 'ordLCorOUT)
	(COPYD 'intermedpmon2PMon 'LISTCOPY)
	(COPYD 'commMONLISPOUT 'LISTCOPY)
	(COPYD 'commPMon2HlbMon 'REVERSE)
	(APPLYIFDEF0 '(HomogMatrixify))
	(COND ((CommP) (COMMIFY)))
	))


%	Since TDEGREVLEX is default:

(COND ((NOT commMONORDER)
       (SETQ commMONORDER 'TDEGREVLEX)))


%# GETORDER () : id ;
(DE GETORDER ()
 (COND	((NonCommP) (GETNONCOMMORDER))
	(T (GETCOMMORDER))) )

%  No SETORDER, though!/JoeB 2003-08-25

%# GETCOMMORDER () : identifier ;
(DE GETCOMMORDER () commMONORDER)

%# SETCOMMORDER (uip) : identifier ; FEXPR
(DefineSWLHFEXPR SETCOMMORDER (GETCOMMORDER) !$!&CommMonOrders!#!*)

(SETQ !$!&RingTypes!#!*
 '((COMMUTATIVE . COMMIFY)
   (NONCOMMUTATIVE . NONCOMMIFY)))

(SETQ !$!&CommMonOrders!#!*
 '((TDEGLEX . DEGLEXIFY)
   (PURELEX . PURELEXIFY)
   (TDEGREVLEX . DEGREVLEXIFY)
   (MATRIX . MATRIXIFY)))


%	Since TDEGLEFTLEX is default:

(COND ((NOT noncommMONORDER)
       (SETQ noncommMONORDER 'TDEGLEFTLEX)))

%# GETNONCOMMORDER () : identifier ;
(DE GETNONCOMMORDER () noncommMONORDER)

%# SETNONCOMMORDER (uip) : identifier ; FEXPR
(DefineSWLHFEXPR SETNONCOMMORDER (GETNONCOMMORDER) !$!&NonCommMonOrders!#!*)

(SETQ !$!&NonCommMonOrders!#!*
 '((TDEGLEFTLEX . DEGLEFTLEXIFY)
   (ELIMLEFTLEX . ELIMORDER)
   (HOMOGELIMLEFTLEX . HOMOGELIMORDER)
   (INVELIMLEFTLEX . INVELIMORDER)
   (INVWELIMLEFTLEX . INVWELIMORDER)))


%  Minor variants of polynomial ring set-up:


%%%% Various weights handling.

%  Note that !$!&WeightsList!#!* is internal. Access to it by user
% interface filters through IOWeights2Weights and
% Weights2IOWeights, which (depending on variable orders) might
% reverse the order. Direct access to !$!&WeightsList!#!* is by
% the macro Weights.

%  On the other hand, at present !$!&WeightsDPList!#!* is directly
% accessed by GETDPWEIGHTS. There might be reasons to remove this
% from the user interface, replacing it with a macro, too.
% /JoeB 1999-11-26

(DE CLEARWEIGHTS ()
 (PROG	(rt !*USERMODE !*REDEFMSG)
	(SETQ rt (GETWEIGHTS))
	(SETQ !$!&WeightsList!#!* NIL)
	(SETQ !$!&WeightsDPList!#!* NIL)
	(CommOrdWeights)
	(NonCommOrdWeights)
	(APPLYIFDEF0 '(HSeriesOrdWeights))
	(RETURN rt) ))

(DF SETWEIGHTS (lint)
 (PROG	(rt aa nr !*USERMODE !*REDEFMSG)
	(COND ((NOT (SETQ aa lint)) (RETURN (CLEARWEIGHTS))))
	(SETQ rt (GETWEIGHTS))
	(COND ((NOT (PAIRP aa))
	       (GO Err))
	      ((AND (PAIRP (CAR aa)) (EQ (LENGTH aa) 1))
	       (SETQ aa (CAR aa))))
	(SETQ nr aa)
  Fl	(COND ((NOT (AND (PAIRP nr)
			 (FIXP (CAR nr))
			 (LESSP 0 (CAR nr))))
	       (GO Err))
	      ((SETQ nr (CDR nr))
	       (GO Fl)))
	(SETQ !$!&WeightsList!#!* (IOWeights2Weights lint))
	(SETQ nr 2)
	(SETQ aa (CDR !$!&WeightsList!#!*))
	(SETQ !$!&WeightsDPList!#!*
	      (TCONC NIL (CONS 1 (CAR !$!&WeightsList!#!*))))
  Ml	(COND (aa
	       (TCONC !$!&WeightsDPList!#!* (CONS nr (CAR aa)))
	       (SETQ aa (CDR aa))
	       (SETQ nr (ADD1 nr))
	       (GO Ml)))
	(SETQ !$!&WeightsDPList!#!* (CAR !$!&WeightsDPList!#!*))
	(CommAltWeights)
	(NonCommAltWeights)
	(APPLYIFDEF0 '(HSeriesAltWeights))
	(RETURN rt)
  Err	(ERROR 99 lint " bad input to SETWEIGHTS") ))

(DE GETWEIGHTS ()
 (COND (!$!&WeightsList!#!* (Weights2IOWeights !$!&WeightsList!#!*))) )

(DE GETWEIGHTDPS () !$!&WeightsDPList!#!*)

(DE PRINTWEIGHTS ()
 (PROG	(ip)
	(COND ((NULL (SETQ ip (GETWEIGHTS)))
	       (RETURN NIL)))
  Ml	(PRIN2 (CAR ip))
	(COND ((SETQ ip (CDR ip))
	       (PRIN2 '! )
	       (GO Ml)))
	(RETURN T) ))



%Coefficient arithmetics: In coeff.sl, sfcf.sl, ...
%	Characteristic 0, arbitrary integers (default); SETMODULUS(0)
%	Characteristic 0, only inums;		NOBIGNUMS, - " -
%	Characteristic 2;			SETMODULUS(2)
%	Odd characteristic, ordinary inum arithmetics;  SETMODULUS(pr)
%	Odd characteristic, ordinary bignum arithmetics; - " -
%	Odd characteristic, logarithm table inum arithmetics; - " -,
%						MODLOGARITHMS
%	(Arbitrary Reduce Standard Forms;	SETREDUCESFCOEFFS()
%	 only available in bergman-under-reduce)

(SETQ !$!&OddModRepr!#!*
 '((DEFAULT . SETORDODDCOEFF)
   (ORDINARY . SETORDODDCOEFF)
   (MODLOGARITHMIC . SETMODLOGODDCOEFF)))

%# SETODDPRIMESMODULI (uip) : id ; FEXPR
(DefineSWLHFEXPR SETODDPRIMESMODULI (GETODDPRIMESMODULI) !$!&OddModRepr!#!*)

%# GETODDPRIMESMODULI () : id ;
(DE GETODDPRIMESMODULI ()
 (COND	(!*MODLOGARITHMS 'MODLOGARITHMIC)
	(T 'ORDINARY) ))

%# SETORDODDCOEFF () : - ;
(DE SETORDODDCOEFF () (OFF MODLOGARITHMS))

%# SETMODLOGODDCOEFF () : - ;
(DE SETMODLOGODDCOEFF () (ON MODLOGARITHMS))

%Fundamental strategy:
%	Default, ordinary (Buchberger, Bergman) (with degree first)
%	Rabbit (jumping back to lower degrees)
%	Staggered with substance (SAWS).	Various.

%# SETSTRATEGY (uip) : id ; FEXPR
(DefineSWLHFEXPR SETSTRATEGY (GETSTRATEGY) !$!&Strategies!#!*)

(SETQ !$!&Strategies!#!*
 '((DEFAULT . SETDEFAULTSTRATEGY)
   (ORDINARY . SETDEFAULTSTRATEGY)
   (BERGMAN . SETDEFAULTSTRATEGY)
   (BUCHBERGER . SETDEFAULTSTRATEGY)
   (RABBIT . SETRABBITSTRATEGY)
   (SAWS . SETSAWSSTRATEGY)
   (STAGGER . SETSAWSSTRATEGY)))

%  Major mode modifications:
%	Work degree by degree (irrespective of order)	SETDEGREEWISE()
%	   Instead, work item for item (NOT compatible with Rabbit or SAWS)
%						SETITEMWISE()
%	Are the found leading monomials of Groebner basis elements stable?
%						SETSTABILITY(T,NIL),
%						STABILISE(),DESTABILISE()

(DefineSWLHFEXPR SETPROCESS (GETPROCESS) !$!#ProcessingGbes!#!*)

(SETQ !$!#ProcessingGbes!#!*
 '((DEGREEWISE . SETDEGREEWISE)
   (ITEMWISE . SETITEMWISE)))

(DE GETPROCESS ()
 (COND	(!*!&DegreeWise!# 'DEGREEWISE)
	(T 'ITEMWISE)) )

(DE SETDEGREEWISE ()
 (PROG	(rt !*USERMODE !*REDEFMSG)
	(SETQ rt !*!&DegreeWise!#)
	(COPYD 'DEGORITEMLIST2LIST 'DEGLIST2LIST)
	(COPYD 'SortlPol 'DegSortlPol)
	(APPLYIFDEF0
	 '(MainDegreewise StratDegreewise ReductDegreewise
	   AnickDegreewise MinResDegreewise))
	(EVAL (LIST 'SETSTABILITY (GETSTABILITY)))
	(ON !&DegreeWise!#)
	(RETURN rt)
 ))

(DE SETITEMWISE ()
 (PROG	(rt !*USERMODE !*REDEFMSG)
	(SETQ rt !*!&DegreeWise!#)
	(COPYD 'DEGORITEMLIST2LIST 'IBIDNOOPFCN)
	(COPYD 'SortlPol 'ItemSortlPol)
	(APPLYIFDEF0
	 '(MainItemwise StratItemwise ReductItemwise
	   AnickItemwise MinResItemwise))
	(EVAL (LIST 'SETSTABILITY (GETSTABILITY)))
	(OFF !&DegreeWise!#)
	(RETURN rt)
 ))


(DE STABILISE ()
 (PROG	(rt !*USERMODE !*REDEFMSG)
	(SETQ rt (GETSTABILITY))
	(MainStabilise)
	(StratStabilise)
	(ReductStabilise)
	(ON !&!#Stable!#)
	(RETURN rt) ))

(DE DESTABILISE ()
 (PROG	(rt !*USERMODE !*REDEFMSG)
	(SETQ rt (GETSTABILITY))
	(MainDestabilise)
	(StratDestabilise)
	(ReductDestabilise)
	(OFF !&!#Stable!#)
	(RETURN rt) ))

%# GETSTABILITY () : boolean;
(DE GETSTABILITY ()  (PROGN !*!&!#Stable!#))


%# SETSTABILITY (sexpr) : boolean ; FEXPR
(DF SETSTABILITY (u)
 (COND	((OR (NOT u) (AND (PAIRP u) (OR (NOT (CAR u)) (EQ (CAR u) 'OFF))))
	 (DESTABILISE))
	(T
	 (STABILISE)) ))

% Initialisation:

(SETQ !*!&!#Stable!# T)


%  Minor mode modifications:
%	    with immediate full autoreduction (default);
%						IMMEDIATEFULLREDUCTION
%	    without immediate full autoreduction;    -  "  -



%    Mode changers for factoring out contents as densely as possible, or
%    just after finished reductions.

(DE DENSECONTENTS ()
 (PROG	(!*USERMODE !*REDEFMSG)
	(ON TakeDenseContents)
	(Char0DenseContents)
	(APPLYIFDEF0 '(SFCfDenseContents))
 ))

(DE SPARSECONTENTS ()
 (PROG	(!*USERMODE !*REDEFMSG)
	(OFF TakeDenseContents)
	(Char0SparseContents)
	(APPLYIFDEF0 '(SFCfSparseContents))
 ))

%	Ordinary or Hilbert series limit interruption strategy:
%						ORDNGBESTRATEGY(),
%						MINHILBLIMITSTRATEGY()
%	   (or use SETINTERRUPTSTRATEGY)


%	Calculation start and end points:

%  If degno is an integer or NIL, then set MINDEG to this, and
% return the old MINDEG value. Else, signal an error.

%#SETMINDEG (degno:genint) : genint ;
(DE SETMINDEG (degno)
 (PROG	(oldmd)
	(COND ((AND degno (NOT (FIXP degno)))
	       (ERROR 1010 "Bad input to SETMINDEG")))
	(SETQ oldmd MINDEG)
	(SETQ MINDEG oldmd)
	(RETURN oldmd) ))

%#GETMINDEG () : genint ;
(DE GETMINDEG () (PROGN MINDEG))

%  If degno is an integer or NIL, then set MAXDEG to this, and
% return the old MAXDEG value. Else, signal an error.

%#SETMAXDEG (degno:genint) : genint ;
(DE SETMAXDEG (degno)
 (PROG	(oldmd !*USERMODE !*REDEFMSG)
	(COND ((AND degno (NOT (FIXP degno)))
	       (ERROR 1010 "Bad input to SETMAXDEG")))
	(SETQ oldmd MAXDEG)
	(COND ((AND degno (LESSP 0 degno))
	       (MonMaxDeg)
	       (SETQ MAXDEG degno))
	      (T
	       (MonNoMaxDeg)
	       (SETQ MAXDEG NIL)))
	(RETURN oldmd) ))

%#GETMAXDEG () : genint ;
(DE GETMAXDEG () (PROGN MAXDEG))



%Input mode minor modification:
%	(No) case sensitivity in algebraic input SETCASESENSALGIN (NIL/T)

%# SETCASESENSALGIN (bool) : bool ;
%# GETCASESENSALGIN () : bool ;
(DefineGSSF CASESENSALGIN !&NoRaiseAlgInp!#)



%Output mode:
%	Lisp form (default):			SETALGOUTMODE(LISP)
%	Ordinary algebraic form:		SETALGOUTMODE(ALG)
%	Macaulay-like algebraic form:		SETALGOUTMODE(MACAULAY)
%
%Output time modes should be brought here: Degreewise and/or itemwise
%and/or finally.
%
%Minor mode modifications:
%	Collect common factors to exponents (default):
%						EXPTSPRINTMODE()
%	Print each factor separately:		NOEXPTSPRINTMODE()

%# EXPTSPRINTMODE () : - ;
(DE EXPTSPRINTMODE ()
    (PROG (!*USERMODE !*REDEFMSG)
	  (CommCollectExpts)
	  (NonCommCollectExpts)
	  (OFF !&!#PrintNoExpts!*)
))

%# NOEXPTSPRINTMODE () : - ;
(DE NOEXPTSPRINTMODE ()
    (PROG (!*USERMODE !*REDEFMSG)
	  (CommPrintNoExpts)
	  (NonCommPrintNoExpts)
	  (ON !&!#PrintNoExpts!*)
))

%# SETIMMEDIATEASSOCRINGPBDISPLAY (boole) : boole ;
%# GETIMMEDIATEASSOCRINGPBDISPLAY () : boole ;
(DefineGSSF IMMEDIATEASSOCRINGPBDISPLAY !&!#PBDisplay!#)

%# SETOVERWRITE (boole) : boole ;
%# GETOVERWRITE () : boole ;
(DefineGSSF OVERWRITE !&!#OverWrite!#)

%# SETCHECKFAILUREDISPLAY (boole) : boole ;
%# GETCHECKFAILUREDISPLAY () : boole ;
(DefineGSSF CHECKFAILUREDISPLAY !#CheckFailInform)


%# GETDEGREEPRINTOUTPUT (sexpr) : boolean ;
(DE GETDEGREEPRINTOUTPUT () (PROGN !*DEGREEPRINTOUTPUT))

%# SETDEGREEPRINTOUTPUT (sexpr) : boolean ; FEXPR
(DF SETDEGREEPRINTOUTPUT (u)
 (PROG	(rt)
	(SETQ rt (GETDEGREEPRINTOUTPUT))
	(COND ((OR (NOT u)
		   (AND (PAIRP u) (OR (NOT (CAR u)) (EQ (CAR u) 'OFF))))
	       (OFF DEGREEPRINTOUTPUT))
	      (T
	       (ON DEGREEPRINTOUTPUT)))
	(RETURN rt) ))


%# GETITEMPRINTOUTPUT (sexpr) : boolean ;
(DE GETITEMPRINTOUTPUT () (PROGN !$!&ItemPrinting!#))

%# SETITEMPRINTOUTPUT (sexpr) : boolean ; FEXPR
(DF SETITEMPRINTOUTPUT (u)
 (PROG	(rt)
	(SETQ rt (GETITEMPRINTOUTPUT))
	(COND ((OR (NOT u)
		   (AND (PAIRP u) (OR (NOT (CAR u)) (EQ (CAR u) 'OFF))))
	       (SETQ !$!&ItemPrinting!# NIL))
	      ((OR (EQ u 'MAYBE)
		   (AND (PAIRP u) (EQ (CAR u) 'MAYBE)))
	       (SETQ !$!&ItemPrinting!# 'MAYBE))
	      (T
	       (SETQ !$!&ItemPrinting!# T)))
	(RETURN rt) ))


%	THE COMPACT MODE HANDLER.

%  A complete or non-complete mode set-up should be representable
% by an object in lisp-form, with legible, relatively long
% identifier names. There could also be a rather short form
% representation, of anick c-version type.
%  Modes could be bound to identifiers as properties; extracted
% therefrom; saved from or restored to the actual active total
% mode set up; printed or read, in short or long form; changed
% partly or totally by means of an interactive mode change.

%  For this to work, we need a couple of fundamental mode
% encoders and decoders.

%  In the long form object, the representation should be a list
% of lists. Each member list should begin with a major mode type
% designator. Typically, the next object would be the name of the
% mode chosen, or NIL if default. There may be optional items,
% e.g. for dependent submodes (as lists organised in a similar
% manner), or for mode information structures such as weight
% lists.

%  In input, any order of mode specifications should be allowed.

%  (Note the input name "uip" = "user input" used to denote that
% this could be input directly from the user, and hence quite
% unreliable.)


%  Mode clash checking list and procedures

(SETQ !$!&ClashList!#!*
      '((((VARIABLESETUP RINGTYPE) . (EQ (CAR ITEM) 'COMMUTATIVE))
	 .((OBJECTTYPE) . (NOT (EQ (CAR ITEM) 'RING))))
	(((VARIABLESETUP RINGTYPE) . (EQ (CAR ITEM) 'COMMUTATIVE))
	 .((VARIABLESETUP VARIABLENUMBER) .
           (AND (NUMBERP (CAR ITEM)) (LESSP (CAR ITEM) 2))))
%	(((VARIABLESETUP RINGTYPE) . (EQ (CAR ITEM) 'COMMUTATIVE))
%	 .((VARIABLESETUP INVARIABLES) . (LESSP (LENGTH (CAR ITEM)) 2)))
	(((OUTPUTFORMAT IMMEDIATEASSOCRINGPBDISPLAY) . (CAR ITEM))
	 .((VARIABLESETUP VARIABLENUMBER) . (NOT (CAR ITEM))))
	(((STRATEGY INTERRUPTION) . (EQ (CAR ITEM) 'MINHILBLIMITS))
	 .((VARIABLESETUP VARIABLEWEIGHTS) CAR ITEM))
	(((RESOLUTIONTYPE) . (EQ (CAR ITEM) 'ANICK))
	 .((VARIABLESETUP RINGTYPE) . (NOT (EQ (CAR ITEM) 'NONCOMMUTATIVE))))
	(((RESOLUTIONTYPE) . (EQ (CAR ITEM) 'ANICK))
	 .((VARIABLESETUP VARIABLEWEIGHTS) . (CAR ITEM)))
	(((RESOLUTIONTYPE) . (EQ (CAR ITEM) 'ANICK))
	 .((VARIOUSFLAGS PBSERIES) . (EQ (CAR ITEM) 'OFF)))
	(((STRATEGY) .
	  (AND (PAIRP ITEM)
	       (PAIRP (PROTECTEDASSOC (CAR ITEM) !$!&Strategies!#!*))
	       (EQ (CDR (PROTECTEDASSOC (CAR ITEM) !$!&Strategies!#!*))
		   'SETSAWSSTRATEGY)))
	 .((STRATEGY INTERRUPTION) . (EQ (CAR ITEM) 'MINHILBLIMITS)))
	(((STRATEGY) .
	  (AND (PAIRP ITEM)
	       (PAIRP (PROTECTEDASSOC (CAR ITEM) !$!&Strategies!#!*))
	       (EQ (CDR (PROTECTEDASSOC (CAR ITEM) !$!&Strategies!#!*))
		   'SETSAWSSTRATEGY)))
	 .((STRATEGY PROCESS) . (EQ (CAR ITEM) 'ITEMWISE)))
	(((STRATEGY) .
	  (AND (PAIRP ITEM)
	       (PAIRP (PROTECTEDASSOC (CAR ITEM) !$!&Strategies!#!*))
	       (EQ (CDR (PROTECTEDASSOC (CAR ITEM) !$!&Strategies!#!*))
		   'SETSAWSSTRATEGY)))
	 .((OBJECTTYPE) . (NOT (EQ (CAR ITEM) 'RING))))
	(((STRATEGY) .
	  (AND (PAIRP ITEM)
	       (PAIRP (PROTECTEDASSOC (CAR ITEM) !$!&Strategies!#!*))
	       (EQ (CDR (PROTECTEDASSOC (CAR ITEM) !$!&Strategies!#!*))
		   'SETSAWSSTRATEGY)))
	 .((VARIABLESETUP RINGTYPE) . (NOT (EQ (CAR ITEM) 'COMMUTATIVE))))
	(((STRATEGY) .
	  (AND (PAIRP ITEM)
	       (PAIRP (PROTECTEDASSOC (CAR ITEM) !$!&Strategies!#!*))
	       (EQ (CDR (PROTECTEDASSOC (CAR ITEM) !$!&Strategies!#!*))
		   'SETSAWSSTRATEGY)))
	 .((VARIABLESETUP VARIABLEWEIGHTS) . (CAR ITEM)))
	(((STRATEGY PROCESS) . (EQ (CAR ITEM) 'ITEMWISE))
	 .((VARIOUSFLAGS REDUCTIVITY) . (EQ (CAR ITEM) 'OFF)))
))

%  For the inquisitive user. Yields a copy, and hence cannot be used
% in order to manipulate !$!&ClashList!#!*.

%# GETMODECLASHLIST () : lmodeclash
(DE GETMODECLASHLIST () (COPY !$!&ClashList!#!*))

%  Given a mode name path and a (suggested) mode state, check
% whether the path is present in the mode state. If not,
% return NIL; but if present, return the corresponding node
% of the mode state.
%  Meaning of PROG variables: Rest of Input Path; Node Item.

%# ModePath (lmodename , modestate) : gany
(DE ModePath (mnpath mst)
 (PROG	(rip ni)
	(COND ((NULL (SETQ rip mnpath))
	       (RETURN (CONS T mst)))
	      ((NULL (SETQ ni (PROTECTEDASSOC (CAR rip) mst)))
	       (RETURN NIL)))
  Ml	(COND ((NULL (SETQ rip (CDR rip)))
	       (RETURN ni))
	      ((ATOM (CDR ni))
	       (RETURN NIL))
	      ((SETQ ni (PROTECTEDASSOC (CAR rip)
			       (COND ((ATOM (CADR ni)) (CDDR ni))
				     (T (CDR ni)))))
	       (GO Ml))) ))

%# ModeSettingP (modesettingtype , modestate) : bool
(DE ModeSettingP (mtype mst)
 (PROG	(itm)
	(COND ((SETQ itm (ModePath (CAR mtype) mst))
	       (RETURN (APPLY (EVAL (LIST 'FUNCTION (LIST 'LAMBDA '(ITEM) (CDR mtype))))
			      (LIST (CDR itm)))))) ))

%# FINDMODECLASHES (modestate , modestate) : lmodeclash
(DE FINDMODECLASHES (mst1 mst2)
 (COND ((EQ mst1 mst2)
	(FINDMODECLASHES1 mst1))
       (T
	(FINDMODECLASHES2 mst1 mst2))) )

%# FINDMODECLASHES (modestate) : lmodeclash
(DE FINDMODECLASHES1 (mst)
 (PROG	(mc rt)
	(SETQ mc !$!&ClashList!#!*)
  Ml	(COND ((NULL mc)
	       (RETURN rt))
	      ((AND (ModeSettingP (CAAR mc) mst)
		    (ModeSettingP (CDAR mc) mst))
	       (SETQ rt (CONS (CAR mc) rt))))
	(SETQ mc (CDR mc))
	(GO Ml) ))

%# FINDMODECLASHES (modestate , modestate) : lmodeclash
(DE FINDMODECLASHES2 (mst1 mst2)
 (PROG	(mc rt)
	(SETQ mc !$!&ClashList!#!*)
  Ml	(COND ((NULL mc)
	       (RETURN rt))
	      ((OR (AND (ModeSettingP (CAAR mc) mst1)
			(ModeSettingP (CDAR mc) mst2))
		   (AND (ModeSettingP (CAAR mc) mst2)
			(ModeSettingP (CDAR mc) mst1)))
	       (SETQ rt (CONS (CAR mc) rt))))
	(SETQ mc (CDR mc))
	(GO Ml) ))

% Old ExtractCurrentModes, for developing purposes only:
(DE OLDECM ()
 (PROG	(rt ri)		% Return value; Return value item
	(SETQ ri
	      (LIST 'VARIABLESETUP
		    (LIST 'RINGTYPE (GETRINGTYPE))
		    (LIST 'COMMUTATIVEORDER (GETCOMMORDER))
		    (LIST 'NONCOMMUTATIVEORDER (GETNONCOMMORDER))
		    (LIST 'VARIABLENUMBER (GETVARNO))
		    (LIST 'INVARIABLES (GETINVARS))
		    (LIST 'OUTVARIABLES (GETOUTVARS))
		    (LIST 'VARIABLEWEIGHTS (GETWEIGHTS))
	      ))
	(SETQ rt (CONS ri rt))
	(SETQ rt (CONS (LIST 'COEFFICIENTDOMAIN
			     Modulus
			     (LIST 'ODDPRIMESMODULI
				   (COND (!*MODLOGARITHMS
					  'MODLOGARITHMIC)
					 (T
					  'ORDINARY))))
		       rt))
	(RETURN rt)
))

% (COPYD 'OLDECM 'ExtractCurrentModes)

%# ExtractCurrentModes () : sexpr ;
(DE ExtractCurrentModes ()
 (PROG	(rt)
	(SETQ rt (MAPCAR !$!&ListOfModes!#!* (FUNCTION ExtractMode)))
  Ml	(COND ((MEMQ NIL rt)
	       (SETQ rt (DELETE NIL rt))
	       (GO Ml)))
	(RETURN rt) ))

%(DE ExtractCurrentModes ()
% (MAPCAR !$!&ListOfModes!#!*
%	 (FUNCTION (LAMBDA (uu) (CONS (CAR uu) (EVAL (CADR uu)))))) )

%# ExtractMode (dottedpair): sexpr ;
(DE ExtractMode (dp)
 (COND ((OR (AND (PAIRP (CADR dp)) (PAIRP (CAADR dp))) (DEFP (CAADR dp)))
	(CONS (CAR dp) (EVAL (CADR dp))))) )

%# ExtractSomeModes (lid) : sexpr ;
(DE ExtractSomeModes (lid)
 (COND	((NULL lid) (ExtractCurrentModes))
	((LISTP lid) (ModePath lid (ExtractCurrentModes)))) )

%# GETSETUP (lid) : gmodestate ; FEXPR
(DF GETSETUP (uu) (COPY (ExtractSomeModes uu)))


%# PRINTSETUP (lid) : boole ; FEXPR
(CL!-AVOIDING (REDUCE!-AVOIDING (PSL!-SPECIFIC
 (DF PRINTSETUP (uu)
  (PROG	(rt)
	(COND ((SETQ rt (ExtractSomeModes uu))
	       (PRETTYPRINT rt)
	       (RETURN T))) )) )))
(CL!-AVOIDING (PSL!-AVOIDING
 (DF PRINTSETUP (uu)
  (PROG	(rt)
	(COND ((SETQ rt (ExtractSomeModes uu))
	       (PRINT rt)
	       (RETURN T))) )) ) )
(REDUCE!-SPECIFIC
 (DF PRINTSETUP (uu)
  (PROG	(rt)
	(COND ((SETQ rt (ExtractSomeModes uu))
	       (PRINT rt)
	       (RETURN T))) )) )
(CL!-SPECIFIC
 (DF PRINTSETUP (uu)
  (PROG	(rt)
	(COND ((SETQ rt (ExtractSomeModes uu))
	       (PPRINT rt)
	       (RETURN T))) )) )


%# ListSwitch (identifier) : sexpr ;
%(DE ListSwitch (id)
% (LIST id (COND ((EVAL (INTERN (COMPRESS (CONS '!* (EXPLODE id))))) 'ON)
%		(T 'OFF))) )

(DE ListSwitch (id)
 (LIST id (COND ((EVAL (APPENDLCHARTOID '(!*) id)) 'ON)
		(T 'OFF))) )

%# SwitchList (lidentifier) : - ;
(DE SwitchList (lid) (EVAL (LIST (CADR lid) (CAR lid))))


%# RestoreMode (modestate) : - ;
(DE RestoreMode (dpany)
 (APPLY (EVAL (CADDR (ASSOC (CAR dpany) !$!&ListOfModes!#!*)))
	(LIST (CDR dpany))) )


(SETQ !$!&ListOfModes!#!*

      '((OBJECTTYPE
	 (LIST (GETOBJECTTYPE)
	       (LIST 'AUTOADDRELATIONSTATE
		     !*!&RelAutoAdd!#
		     !*!&RelAutoAddProhib!#)
	       (LIST 'LOWTERMSHANDLING
		     !$!&LowRepr!#))
	 (FUNCTION RestoreObjectType))

	(RESOLUTIONTYPE
	 (LIST (GETRESOLUTIONTYPE))
	 (FUNCTION RestoreResolutionType))

	(ANICK
	 (ExtractAnickModes)
	 (FUNCTION RestoreAnickModes))

	(VARIABLESETUP
	 (LIST (LIST 'RINGTYPE (GETRINGTYPE))
	       (LIST 'COMMUTATIVEORDER (GETCOMMORDER))
	       (LIST 'ORDERMATRIX (GETORDERMATRIX))
	       (LIST 'NONCOMMUTATIVEORDER (GETNONCOMMORDER))
	       (LIST 'VARIABLENUMBER (GETVARNO))
	       (LIST 'INVARIABLES (GETINVARS))
	       (LIST 'OUTVARIABLES (GETOUTVARS))
	       (LIST 'VARIABLEWEIGHTS (GETWEIGHTS))
	       (LIST 'HOMOGENISATIONVARIABLE (GETHOMOGVARIABLE)))
	 (FUNCTION RestoreVariableModes))

	(STRATEGY
	 (NCONC (LIST (GETSTRATEGY)
		      (LIST 'PROCESS (GETPROCESS))
		      (LIST 'STABILITY (GETSTABILITY))
		      (LIST 'MINDEG (GETMINDEG))
		      (LIST 'MAXDEG (GETMAXDEG))
		      (LIST 'INTERRUPTION (GETINTERRUPTSTRATEGY)))
		(COND (!*HSisLoaded
		       (LIST (LIST 'HSERIESLIMITATIONS (GETHSERIESMINIMA))
			     (LIST 'CUSTOMISED (GETCUSTSTRATEGY))))
		      (T (NCONS (LIST 'CUSTOMISED (GETCUSTSTRATEGY))))))
	 (FUNCTION RestoreStrategyModes))

	(COEFFICIENTDOMAIN
	 (LIST Modulus
	       (LIST 'ODDPRIMESMODULI
		     (COND (!*MODLOGARITHMS
			    'MODLOGARITHMIC)
			   (T
			    'ORDINARY))))
	 (FUNCTION RestoreCoeffDomain))

	(INPUTFORMAT
	 (LIST (COND ((GETCASESENSALGIN) 'CASESENSALGIN)
		     (T 'NOCASESENSALGIN)))
	 (FUNCTION (LAMBDA (uu)
			   (COND ((MEMQ 'CASESENSALGIN uu)
				  (SETCASESENSALGIN T))
				 ((MEMQ 'NOCASESENSALGIN uu)
				  (SETCASESENSALGIN NIL))))))

	(OUTPUTFORMAT
	 (LIST (GETALGOUTMODE)
	       (LIST 'PRINTTIMES
		     (LIST 'DEGREEPRINTOUTPUT (GETDEGREEPRINTOUTPUT))
		     (LIST 'ITEMPRINTOUTPUT (GETITEMPRINTOUTPUT)))
	       (COND (!*!&!#PrintNoExpts!* 'NOEXPTSPRINT)
		     (T 'EXPTSPRINT))
	       (LIST 'IMMEDIATEASSOCRINGPBDISPLAY (GETIMMEDIATEASSOCRINGPBDISPLAY))
	       (LIST 'OVERWRITE (GETOVERWRITE))
	       (LIST 'CUSTOMISED (GETCUSTDISPLAY)))
	 (FUNCTION RestoreOutputFormat))

	(DEBUGSTATE
	 (LIST (LIST 'DIRECTALERTCLOSING (GETDIRECTALERTCLOSING))
	       (LIST 'CHECKFAILUREDISPLAY (GETCHECKFAILUREDISPLAY))
	       (LIST 'ACTIVETRACEBREAKS (GETACTIVETRACEBREAKS)))
	 (FUNCTION (LAMBDA (uu) (PROG (itm)
				      (COND ((SETQ itm (ATSOC 'DIRECTALERTCLOSING uu))
					     (SETDIRECTALERTCLOSING (CADR itm))))
				      (COND ((SETQ itm (ATSOC 'CHECKFAILUREDISPLAY uu))
					     (SETCHECKFAILUREDISPLAY (CADR itm))))
				      (COND ((SETQ itm (ATSOC 'ACTIVETRACEBREAKS uu))
					     (SETACTIVETRACEBREAKS (CADR itm))))))))

	(VARIOUSFLAGS
	 (MAPCAR !#!&UsrFlags!#!* 'ListSwitch)
	 (FUNCTION (LAMBDA (uu) (MAPC uu 'SwitchList))))

))

%# RestoreObjectType (sexpr) : - ;
(DE RestoreObjectType (sexpr)
 (PROG	(ip itm)
	(COND ((AND (PAIRP sexpr) (NOT (PAIRP (CAR sexpr))))
	       (EVAL (LIST 'SETOBJECTTYPE (CAR sexpr)))
	       (SETQ ip (CDR sexpr)))
	      (T
	       (SETQ ip sexpr)))
	(COND ((SETQ itm (PROTECTEDASSOC 'AUTOADDRELATIONSTATE ip))
	       (COND ((CADR itm) (AUTOADDRELATIONS))
		     ((CADDR itm) (NOAUTOADDRELATIONS))
		     (T (CANCELAUTOADDRELATIONSSETTINGS)))))
	(COND ((SETQ itm (PROTECTEDASSOC 'LOWTERMSHANDLING ip))
	       (EVAL (CONS 'SETLOWTERMSHANDLING (CDR itm))))) ))

%# RestoreResolutionType (sexpr) : - ;
(DE RestoreResolutionType (sexpr)
 (EVAL (CONS 'SETRESOLUTIONTYPE sexpr)) )

%# RestoreVariableModes (sexpr) : - ;
(DE RestoreVariableModes (sexpr)
 (PROG	(itm)
	(COND ((SETQ itm (PROTECTEDASSOC 'RINGTYPE sexpr))
	       (COND ((EQ (CADR itm) 'COMMUTATIVE) (COMMIFY))
		     (T (NONCOMMIFY)))))
	(COND ((SETQ itm (PROTECTEDASSOC 'COMMUTATIVEORDER sexpr))
	       (EVAL (CONS 'SETCOMMORDER (CDR itm)))))
	(COND ((SETQ itm (PROTECTEDASSOC 'ORDERMATRIX sexpr))
	       (EVAL (CONS 'SETORDERMATRIX (CDR itm)))))
	(COND ((SETQ itm (PROTECTEDASSOC 'NONCOMMUTATIVEORDER sexpr))
	       (EVAL (CONS 'SETNONCOMMORDER (CDR itm)))))
	(COND ((SETQ itm (PROTECTEDASSOC 'INVARIABLES sexpr))
	       (SETINVARS (CADR itm))))
	(COND ((SETQ itm (PROTECTEDASSOC 'OUTVARIABLES sexpr))
	       (SETOUTVARS (CADR itm))))
	(COND ((SETQ itm (PROTECTEDASSOC 'VARIABLENUMBER sexpr))
	       (COND ((CADR itm) (SETVARNO (CADR itm)))
		     (T (CLEARVARNO)))))
	(COND ((SETQ itm (PROTECTEDASSOC 'VARIABLEWEIGHTS sexpr))
	       (EVAL (CONS 'SETWEIGHTS (CADR itm)))))
	(COND ((SETQ itm (PROTECTEDASSOC 'HOMOGENISATIONVARIABLE sexpr))
	       (EVAL (CONS 'SETHOMOGVARIABLE (CDR itm))))) ))

%# RestoreStrategyModes (sexpr) : - ;
(DE RestoreStrategyModes (sexpr)
 (PROG	(itm inp)
	(COND ((AND (PAIRP sexpr) (ATOM (CAR sexpr)))
	       (EVAL (LIST 'SETSTRATEGY (CAR sexpr)))
	       (SETQ inp (CDR sexpr)))
	      (T
	       (SETQ inp sexpr)))
	(COND ((SETQ itm (PROTECTEDASSOC 'PROCESS inp))
	       (EVAL (CONS 'SETPROCESS (CDR itm)))))
	(COND ((SETQ itm (PROTECTEDASSOC 'STABILITY inp))
	       (EVAL (CONS 'SETSTABILITY (CDR itm)))))
	(COND ((SETQ itm (PROTECTEDASSOC 'INTERRUPTION inp))
	       (EVAL (CONS 'SETINTERRUPTSTRATEGY (CDR itm)))))
	(COND ((SETQ itm (PROTECTEDASSOC 'HSERIESLIMITATIONS inp))
	       (COND ((NOT !*HSisLoaded)
		      (EVAL (LIST 'LOAD HSERIESFILE!*))
		      (ON HSisLoaded)))
	       (EVAL '(SETHSERIESMINIMUMDEFAULT))
	       (EVAL (CONS 'SETHSERIESMINIMA (CADR itm)))))
	(COND ((SETQ itm (PROTECTEDASSOC 'MINDEG inp))
	       (EVAL (CONS 'SETMINDEG (CDR itm)))))
	(COND ((SETQ itm (PROTECTEDASSOC 'MAXDEG inp))
	       (EVAL (CONS 'SETMAXDEG (CDR itm)))))
	(COND ((SETQ itm (PROTECTEDASSOC 'CUSTOMISE inp))
	       (EVAL (CONS 'CUSTSTRATEGY (CDR itm)))))
 ))

%# RestoreCoeffDomain (sexpr) : - ;
(DE RestoreCoeffDomain (sexpr)
 (PROG	(itm)
	(SETMODULUS (CAR sexpr))
	(COND ((SETQ itm (PROTECTEDASSOC 'ODDPRIMESMODULI sexpr))
	       (COND ((EQ (CADR itm) 'ORDINARY) (OFF MODLOGARITHMS))
		     (T (ON MODLOGARITHMS))))) ))

%# RestoreOutputFormat (sexpr) : - ;
(DE RestoreOutputFormat (sexpr)
 (PROG	(itm)
	(COND ((AND (PAIRP sexpr)
		    (ATOM (CAR sexpr))
		    (NOT (MEMQ (CAR sexpr) '(EXPTSPRINT NOEXPTSPRINT))))
	       (EVAL (LIST 'SETALGOUTMODE (CAR sexpr)))))
	(COND ((MEMQ 'EXPTSPRINT sexpr)
	       (EXPTSPRINTMODE))
	      ((MEMQ 'NOEXPTSPRINT sexpr)
	       (NOEXPTSPRINTMODE)))
	(COND ((SETQ itm (PROTECTEDASSOC 'PRINTTIMES sexpr))
	       (RestorePrintTimes (CDR itm))))
	(COND ((SETQ itm (PROTECTEDASSOC
			  'IMMEDIATEASSOCRINGPBDISPLAY
			  sexpr))
	       (SETIMMEDIATEASSOCRINGPBDISPLAY (CADR itm))))
	(COND ((SETQ itm (PROTECTEDASSOC 'OVERWRITE sexpr))
	       (SETOVERWRITE (CADR itm))))
	(COND ((SETQ itm (PROTECTEDASSOC 'CUSTOMISED sexpr))
	       (EVAL (CONS 'SETCUSTDISPLAY (CDR itm))))) ))

% RestorePrintTimes (sexpr) : - ;
(DE RestorePrintTimes (sexpr)
 (PROG	(itm)
%	(PRINT sexpr)
	(COND ((SETQ itm (PROTECTEDASSOC 'DEGREEPRINTOUTPUT sexpr))
%	       (PRINT itm)
%	       (PRINT (CONS 'SETDEGREEPRINTOUTPUT (CDR itm)))
	       (EVAL (CONS 'SETDEGREEPRINTOUTPUT (CDR itm)))))
	(COND ((SETQ itm (PROTECTEDASSOC 'ITEMPRINTOUTPUT sexpr))
	       (EVAL (CONS 'SETITEMPRINTOUTPUT (CDR itm))))) ))

%# SETSETUP (modestate) : boolean ;
(DE SETSETUP (sexpr)
 (COND	((NOT (CHECKSETUP sexpr))
	 NIL)
	(T
	 (MAPC sexpr (FUNCTION RestoreMode))
	 T)) )

%%%%  Added 1999-07-01, in order to eliminate user switches.  %%%%
%%%%  Should be distributed into their appropriate places!    %%%%

%  The following mode informing switch should NOT be set by users:
% HOMOGENISED.

%  The OLDMODE and OBSOLETE stuff might be merged into one category.
% Anyhow they need not be documented here!


%# GETCUSTDISPLAY (sexpr) : boolean ;
(DE GETCUSTDISPLAY () (PROGN !*CUSTSHOW))

%# SETCUSTDISPLAY (sexpr) : boolean ; FEXPR
(DF SETCUSTDISPLAY (u)
 (PROG	(rt)
	(SETQ rt (GETCUSTSHOW))
	(COND ((OR (NOT u)
		   (AND (PAIRP u) (OR (NOT (CAR u)) (EQ (CAR u) 'OFF))))
	       (OFF CUSTSHOW))
	      (T
	       (ON CUSTSHOW)))
	(RETURN rt) ))

% Old names for (SET/GET)CUSTDISPLAY:
%# GETCUSTSHOW (sexpr) : boolean ;
(COPYD 'GETCUSTSHOW 'GETCUSTDISPLAY)

%# SETCUSTSHOW (sexpr) : boolean ; FEXPR
(COPYD 'SETCUSTSHOW 'SETCUSTDISPLAY)


%# GETCUSTSTRATEGY (sexpr) : boolean ;
(DE GETCUSTSTRATEGY () (PROGN !*CUSTSTRATEGY))

%# SETCUSTSTRATEGY (sexpr) : boolean ; FEXPR
(DF SETCUSTSTRATEGY (u)
 (PROG	(rt)
	(SETQ rt (GETCUSTSTRATEGY))
	(COND ((OR (NOT u)
		   (AND (PAIRP u) (OR (NOT (CAR u)) (EQ (CAR u) 'OFF))))
	       (OFF CUSTSTRATEGY))
	      (T
	       (ON CUSTSTRATEGY)))
	(RETURN rt) ))

%# GETDYNAMICLOGTABLES (sexpr) : boolean ;
(DE GETDYNAMICLOGTABLES () (PROGN !*DYNAMICLOGTABLES))

%# SETDYNAMICLOGTABLES (sexpr) : boolean ; FEXPR
(DF SETDYNAMICLOGTABLES (u)
 (PROG	(rt)
	(SETQ rt (GETDYNAMICLOGTABLES))
	(COND ((OR (NOT u)
		   (AND (PAIRP u) (OR (NOT (CAR u)) (EQ (CAR u) 'OFF))))
	       (OFF DYNAMICLOGTABLES))
	      (T
	       (ON DYNAMICLOGTABLES)))
	(RETURN rt) ))

%# GETIMMEDIATECRIT (sexpr) : boolean ;
(DE GETIMMEDIATECRIT () (PROGN !*IMMEDIATECRIT))

%# SETIMMEDIATECRIT (sexpr) : boolean ; FEXPR
(DF SETIMMEDIATECRIT (u)
 (PROG	(rt)
	(SETQ rt (GETIMMEDIATECRIT))
	(COND ((OR (NOT u)
		   (AND (PAIRP u) (OR (NOT (CAR u)) (EQ (CAR u) 'OFF))))
	       (OFF IMMEDIATECRIT))
	      (T
	       (ON IMMEDIATECRIT)))
	(RETURN rt) ))

%# GETIMMEDIATEFULLREDUCTION (sexpr) : boolean ;
(DE GETIMMEDIATEFULLREDUCTION () (PROGN !*IMMEDIATEFULLREDUCTION))

%# SETIMMEDIATEFULLREDUCTION (sexpr) : boolean ; FEXPR
(DF SETIMMEDIATEFULLREDUCTION (u)
 (PROG	(rt)
	(SETQ rt (GETIMMEDIATEFULLREDUCTION))
	(COND ((OR (NOT u)
		   (AND (PAIRP u) (OR (NOT (CAR u)) (EQ (CAR u) 'OFF))))
	       (OFF IMMEDIATEFULLREDUCTION))
	      (T
	       (ON IMMEDIATEFULLREDUCTION)))
	(RETURN rt) ))

%# GETIMMEDIATERECDEFINE (sexpr) : boolean ;
(DE GETIMMEDIATERECDEFINE () (PROGN !*IMMEDIATERECDEFINE))

%# SETIMMEDIATERECDEFINE (sexpr) : boolean ; FEXPR
(DF SETIMMEDIATERECDEFINE (u)
 (PROG	(rt)
	(SETQ rt (GETIMMEDIATERECDEFINE))
	(COND ((OR (NOT u)
		   (AND (PAIRP u) (OR (NOT (CAR u)) (EQ (CAR u) 'OFF))))
	       (OFF IMMEDIATERECDEFINE))
	      (T
	       (ON IMMEDIATERECDEFINE)))
	(RETURN rt) ))

%# GETNOBIGNUM (sexpr) : boolean ;
(DE GETNOBIGNUM () (PROGN !*NOBIGNUM))

%# SETNOBIGNUM (sexpr) : boolean ; FEXPR
(DF SETNOBIGNUM (u)
 (PROG	(rt)
	(SETQ rt (GETNOBIGNUM))
	(COND ((OR (NOT u)
		   (AND (PAIRP u) (OR (NOT (CAR u)) (EQ (CAR u) 'OFF))))
	       (OFF NOBIGNUM))
	      (T
	       (ON NOBIGNUM)))
	(RETURN rt) ))

%# SETOBSOLETENAMESINFORM (boole) : boole ;
%# GETOBSOLETENAMESINFORM () : boole ;
(DefineGSSF OBSOLETENAMESINFORM OBSOLETENAMESINFORM)

%# GETPBSERMODE (sexpr) : boolean ;
(DE GETPBSERMODE () (PROGN !*PBSERIES))

%# SETPBSERMODE (sexpr) : boolean ; FEXPR
(DF SETPBSERMODE (u)
 (PROG	(rt)
	(SETQ rt (GETPBSERMODE))
	(COND ((OR (NOT u)
		   (AND (PAIRP u) (OR (NOT (CAR u)) (EQ (CAR u) 'OFF))))
	       (OFF PBSERIES))
	      (T
	       (ON PBSERIES)))
	(RETURN rt) ))

%# GETREDUCTIVITY (sexpr) : boolean ;
(DE GETREDUCTIVITY () (PROGN !*REDUCTIVITY))

%# SETREDUCTIVITY (sexpr) : boolean ; FEXPR
(DF SETREDUCTIVITY (u)
 (PROG	(rt)
	(SETQ rt (GETREDUCTIVITY))
	(COND ((OR (NOT u)
		   (AND (PAIRP u) (OR (NOT (CAR u)) (EQ (CAR u) 'OFF))))
	       (OFF REDUCTIVITY))
	      (T
	       (ON REDUCTIVITY)))
	(RETURN rt) ))

%# GETSAVEDEGREE (sexpr) : boolean ;
(DE GETSAVEDEGREE () (PROGN !*SAVEDEGREE))

%# SETSAVEDEGREE (sexpr) : boolean ; FEXPR
(DF SETSAVEDEGREE (u)
 (PROG	(rt)
	(SETQ rt (GETSAVEDEGREE))
	(COND ((OR (NOT u)
		   (AND (PAIRP u) (OR (NOT (CAR u)) (EQ (CAR u) 'OFF))))
	       (OFF SAVEDEGREE))
	      (T
	       (ON SAVEDEGREE)))
	(RETURN rt) ))

%# GETSAVERECVALUES (sexpr) : boolean ;
(DE GETSAVERECVALUES () (PROGN !*SAVERECVALUES))

%# SETSAVERECVALUES (sexpr) : boolean ; FEXPR
(DF SETSAVERECVALUES (u)
 (PROG	(rt)
	(SETQ rt (GETSAVERECVALUES))
	(COND ((OR (NOT u)
		   (AND (PAIRP u) (OR (NOT (CAR u)) (EQ (CAR u) 'OFF))))
	       (OFF SAVERECVALUES))
	      (T
	       (ON SAVERECVALUES)))
	(RETURN rt) ))

%# GETACTIVETRACEBREAKS () : boole
%# SETACTIVETRACEBREAKS (boole) : boole
(DefineGSSF ACTIVETRACEBREAKS TRBR)


%  PROG variables: Input member list tails for object type,
% resolution type, anick, variables, strategy, coefficients,
% input, output, and various flags;
% sub-items of such.

%# CHECKSETUP (any) ; boolean ;
(DE CHECKSETUP (uip)
 (PROG	(ob rs an vb str cf ip op vfg itm1 itm2)
	(COND ((NOT (DPLISTP uip))
	       (CheckWarning "The proposed set-up "
			     uip
			     " is not a list of lists.")
	       (RETURN NIL)))

	% Check that the user input items begin with different
	% major mode identifiers.
	(SETQ itm1 uip)
  Ml	(COND (itm1
	       (COND ((NOT (ATSOC (SETQ itm2 (CAAR itm1))
				  !$!&ListOfModes!#!*))
		      (CheckWarning itm2
				    " is not a recognised main mode name.")
		      (RETURN NIL))
		     ((ATSOC itm2 (SETQ itm1 (CDR itm1)))
		      (CheckWarning itm2
				    " is set several times, which is not permitted")
		      (RETURN NIL)))
	       (GO Ml)))

	(COND ((SETQ ob (ATSOC 'OBJECTTYPE uip))
	       (COND ((NOT (LISTP vb))
		      (CheckWarning "The object type item "
				    vb
				    " is not a list.")
		      (RETURN NIL)))))

	(COND ((AND (SETQ rs (ATSOC 'RESOLUTIONTYPE uip))
		    (NOT (AND (LISTP rs)
			      (EQN (LENGTH rs) 2)
			      (IDP (SETQ rs (CADR rs)))
			      (ATSOC rs !$!&ResolutionTypes!#!*))))
	       (CheckWarning "The resolution mode "
			     rs
			     " is undefined.")
	       (RETURN NIL)))

	(COND ((SETQ an (ATSOC 'ANICK uip))
	       (SETQ an (CDR an))))

	(COND ((SETQ vb (ATSOC 'VARIABLESETUP uip))
	       (COND ((NOT (DPLISTP (SETQ vb (CDR vb))))
		      (CheckWarning "The variable setup item "
				    vb
				    !#NoAListWarning!&)
		      (RETURN NIL)))
	       (COND ((SETQ itm1 (ATSOC 'VARIABLENUMBER vb))
		      (COND ((NOT (AND (PAIRP (SETQ itm2 (CDR itm1)))
				       (NOT (CDR itm2))))
			     (CheckWarning itm1 " ill formed.")
			     (RETURN NIL))
			    ((SETQ itm2 (CAR itm2))
			     (COND ((NOT (AND (FIXP itm2) (LESSP -1 itm2)))
				    (CheckWarning itm1 " ill formed.")
				    (RETURN NIL))
				   ((AND (SETQ itm1 (ATSOC 'INVARIABLES vb))
					 (PAIRP itm1)
					 (PAIRP (CDR itm1))
					 (LISTP (CADR itm1))
					 (NOT (EQN (LENGTH (CADR itm1)) itm2)))
				    (CheckWarning "(The explicit variable number "
						  itm2
						  " differ from the number "
						  (LENGTH (CADR itm1))
						  " of given input variables.)"))
				   ((AND (SETQ itm1 (ATSOC 'OUTVARIABLES vb))
					 (PAIRP itm1)
					 (PAIRP (CDR itm1))
					 (LISTP (CADR itm1))
					 (NOT (EQN (LENGTH (CADR itm1)) itm2)))
				    (CheckWarning "(The explicit variable number "
						  itm2
						  " differ from the number "
						  (LENGTH (CADR itm1))
						  " of given output variables.)")))))))))

	(COND ((SETQ str (ATSOC 'STRATEGY uip))
	       (COND ((AND (PAIRP (SETQ str (CDR str)))
			   (ATOM (CAR str)))
		      (COND ((NOT (ATSOC (CAR str) !$!&Strategies!#!*))
			     (CheckWarning "The strategy item "
					   (CAR str)
					   " is not a valid main strategy.")
			     (RETURN NIL)))
		      (SETQ str (CDR str))))
	       (COND ((NOT (DPLISTP str))
		      (CheckWarning "The strategy item "
				    str
				    !#NoAListWarning!&)
		      (RETURN NIL)))
	       (COND ((AND (SETQ itm1 (ATSOC 'HSERIESLIMITATIONS str))
			   (ATOM (CDR itm1)))
		      (CheckWarning "The strategy"
				    (CAR itm1)
				    "item is an atom")
		      (RETURN NIL)))))

	(COND ((SETQ cf (ATSOC 'COEFFICIENTDOMAIN uip))
	       (COND ((NOT (AND (PAIRP (SETQ cf (CDR cf)))
				(OR (NOT (CAR cf))
				    (AND (FIXP (CAR cf))
					 (NOT (BMI!< (CAR cf) 0))))
				(DPLISTP (CDR cf))))
		      (CheckWarning "Inappropriate coefficient domain item "
				    cf)
		      (RETURN NIL)))))

	(COND ((SETQ ip (ATSOC 'INPUTFORMAT uip))
	       (COND ((NOT (LISTP (SETQ ip (CDR ip))))
		      (CheckWarning "The input format item "
				    ip
				    " is not a list.")
		      (RETURN NIL)))))

	(COND ((SETQ op (ATSOC 'OUTPUTFORMAT uip))
	       (COND ((NOT (LISTP (SETQ op (CDR op))))
		      (CheckWarning "The output format item "
				    op
				    " is not a list.")
		      (RETURN NIL)))))

	(COND ((SETQ vfg (ATSOC 'VARIOUSFLAGS uip))
	       (COND ((NOT (DPLISTP (SETQ vfg (CDR vfg))))
		      (CheckWarning "The various switches item "
				    op
				    !#NoAListWarning!&)
		      (RETURN NIL)))))

	(COND ((AND (SETQ itm1 (ATSOC 'INTERRUPTION str))
		    (NOT (AND (LISTP itm1)
			      (EQN (LENGTH itm1) 2)
			      (IDP (SETQ itm1 (CADR itm1)))
			      (CHECKINTERRUPTSTRATEGY itm1))))
	       (CheckWarning "The interruption strategy "
			     itm1
			     " is undefined.")
	       (RETURN NIL)))
%	      ((AND (EQ itm1 'MINHILBLIMITS)
%		    (SETQ itm2 (ATSOC 'VARIABLEWEIGHTS vb))
%		    (SETQ itm2 (CADR itm2)))
%	       (CheckWarning "The minimal Hilbert series limitation strategy"
%			     TERPRI
%			     "is incompatible with weight setting"))

	(COND ((NOT (FINDMODECLASHES1 uip))
	       (RETURN T)))
	(CheckWarning "Clashes between different mode settings were found.") ))


%   By default, !*!#CheckFailInform be ON:

(SETCHECKFAILUREDISPLAY T)

% (SETQ !*!#CheckFailInform T)



%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%
%%%							%%%
%%%	Saving and pushing entire ring structures:	%%%
%%%							%%%
%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%

% The push down list:

(GLOBAL '(!#!&RingStack!#!&))

%  An item on this list be a structure (modes mons . name), where
% modes be the extracted ring setup modes, mons the MONLIST at
% extraction time, and name be an identifier or other self-evaluating
% lisp object serving as ring name; or NIL for "no name given".

%  At present, I assume the operations to be performed rather rarely.
% Hence, I use the compact mode handler procedures; although these
% make a number of copying et cetera, that we might not want.

%# GetRingModes (void) : any ;
(DE GetRingModes () (ASSOC 'VARIABLESETUP (GETSETUP)))

%  Vsu = Variable set-up (as in the compact mode handler).
%# RestoreRingModes (any) ; boolean ;
(DE RestoreRingModes (Vsu) (SETSETUP (LIST Vsu)))

%# PUSHRING (void) ; int ;
(DE PUSHRING ()
 (PROGN	(SETQ !#!&RingStack!#!&
	      (CONS (LIST (GetRingModes) MONLIST)
		    !#!&RingStack!#!&))
	(SETQ MONLIST (NCONS NIL))
	(LENGTH !#!&RingStack!#!&) ))

%# POPRING (void) ; genint ;
(DE POPRING ()
 (COND (!#!&RingStack!#!&
	(RestoreRingModes (CAAR !#!&RingStack!#!&))
	(SETQ MONLIST (CADAR !#!&RingStack!#!&))
	(ADD1 (LENGTH (SETQ !#!&RingStack!#!& (CDR !#!&RingStack!#!&))))) ))

%  Prog variable: Old Ring.
%# SWITCHRING (void) ; boolean ;
(DE SWITCHRING ()
 (PROG	(or)
	(COND ((NOT !#!&RingStack!#!&)
	       (RETURN NIL)))
	(SETQ or (LIST (GetRingModes) MONLIST))
	(POPRING)
	(SETQ !#!&RingStack!#!& (CONS or !#!&RingStack!#!&))
	(RETURN T) ))

%# RINGSTACKLENGTH () : int ;
(DE RINGSTACKLENGTH () (LENGTH !#!&RingStack!#!&) )

(ON RAISE)
