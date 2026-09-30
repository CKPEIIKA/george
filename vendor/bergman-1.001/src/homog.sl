%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%
%% Copyright (C) 1992,1993,1994,1995,1998,2002,2003,2005
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


%	CHANGES:

%  Replaced DEGLIST2LIST by DEGORITEMLIST2LIST, and made TESTINDATA,
% HOMOGENISEINPUT, and NONHOMOGINDATA working with both process modes.
% Also, HOMOGENISEINPUT now yields correctly sorted InPols.
% /JoeB 2006-08-07

%  Cleaned up variable declaration in HOMOGENISE./JoeB 2005-03-14

%  Commented out the call to WarningonLowGrad./JoeB,VU 2004-10-10.

%  Added LDEGREE./JoeB,VU 2004-10-06.

%  !*!&HomogVarName!# --> !$!&HomogVarName!#.
% HomogVarIndex --> !$!&HomogVarIndex!#. Added ASSIGNINHOMOGENP,
% NONHOMOGINDATA, SETERRONEOUSPOL, GETERRONEOUSPOL, SETERRONEOUSTERM,
% GETERRONEOUSTERM, CLEARERRORITEMS. Changed SETHOMOGVARIABLE to a
% FEXPR./JoeB 2004-05-05.

%  Added DeHomogQPol. Corrected DeHomogListofPol./UV 2003-08-28

%  Replaced *NONCOMMUTATIVE by ((Non)CommP)./JoeB 2003-08-25

%  Replaced (LENGTH (GETINVARS)) by (InVarNo)./JoeB 2003-08-18

%  Replaced LOAD HSERIES by the modularised approach. Corrected
% CancelingPol; and spelling in WarningonLowGrad messages. Added
% (SET/GET)HOMOGVARIABLE./JoeB 2002-10-10 -- 12

%  July 2002: VU added lots of stuff, for getting nc elimination order
% to work. Inter alia: noncommElimHomogPMon, HomogNonCommElim,
% CancelCfMonom, CancelHomogVar, HomogDefectCfMonom, DegreeLispPol,
% CancelingPol, WarningonLowGrad, CancelPol, CancelInListPol,
% DeHomogLispPol, DeHomogListOfPol, Commutator!?.

%  Added !*USERMODE, !*REDEFMSG. Corrected (?) HomogPMon.
%  PROBLEM:
%	How do I work with "short" and "long" monomials
%	simultaneously (e.g., w.r.t. weights)?
%  A preliminary approach: Allow homogeneisation only once, at
% GROEBNERINIT. When homogenising, save the "old ring info" with
% a kind of "push down"; calculate w.r.t. the new one, until de-
% homogenising, when the old ring is "popped". For this, saving,
% setting, pushing and popping rings should be introduced, e.g.
% in the modes module.

%  Removed setting of EMBDIM, and replaced declaring it GLOBAL
% with the same for !&!*InnerEmbDim!&!*, since this seems to be
% what is used./JoeB 1996-06-24


(OFF RAISE)

% Import: PLUSNOEVAL, MONINTERN, TermInsert, MONFACTORP, TOTALDEGREE;
%	  EMBDIM, InPols, GBasis, commMONORDER.
% Export: DeHomogQPol, .... 
% Available: ASSIGNINHOMOGENP, NONHOMOGINDATA, SETERRONEOUSPOL,
%	     GETERRONEOUSPOL, SETERRONEOUSTERM, GETERRONEOUSTERM,
%	     CLEARERRORITEMS, LDEGREE, TESTINDATA, HOMOGENP,
%	     (HOMOGENISE,) HOMOGENISEINPUT, SETHOMOGVARIABLE,
%	     GETHOMOGVARIABLE;
%            !*HOMOGENISED, !*SAVEINHOMOGMONLIST.

(GLOBAL '(!*HOMOGENISED !*SAVEINHOMOGMONS InhGBasis !&!*InnerEmbDim!&!*
	  InPols GBasis niMon SavedInhomogMonList commMONORDER 
	  MinCancelingDegree !$!&HomogVarIndex!# HSisLoaded HSERIESFILE!*
	  !$!&FoundIhPol!#!* !$!&FoundIhCfMon!#!* !$!&HomogVarName!#))
(FLUID '(!*USERMODE !*REDEFMSG))

(COND ((NOT InhGBasis) (SETQ InhGBasis (NCONS NIL))))
% (COND ((NOT EMBDIM) (SETQ EMBDIM 0))) Commented out /JoeB 1996-06-24

% This is a module for making non-homogeneous input possible. It
% contains routines for homogenising input and dehomogenising
% output from the main part of the programme.
% Its new kind of items, inhpol = inhomogeneous polynomials, be
% NOT MONINTERNED. Thus their Mon's = Expts's.

% WARNING: Some routines work with the internal PUREMON structure.

% Macros:

%(DM MonCoeff (cfmon) (LIST 'CAR (CADR cfmon)))
%(DM MonMon (cfmon) (LIST 'CDR (CADR cfmon)))
%(DM Expts (mon) (LIST 'CDR (CADR mon)))
%(DM FirstCfMon (pol) (LIST 'CAR (CADR pol)))
%(DM FirstCoeff (pol) (LIST 'CAAR (CADR pol)))
%(DM FirstMon (pol) (LIST 'CDAR (CADR pol)))
%(DM RestofPol (pol) (LIST 'CDR (CADR pol)))
%(DM MonPtr (mon) (LIST 'CAR (CADR mon)))


%%%%%%%% Tests for homogeneity. %%%%%%%%

%# HOMOGENP (augpol) : genint ;
(DE HOMOGENP (auginhpol)
 (PROG	(AA BB)
	(COND ((NOT auginhpol) (RETURN T)))
	(SETQ AA (CDR auginhpol))
	(SETQ BB (TOTALDEGREE (Lpmon AA)))
  Ml	(COND ((PolDecap AA)
	       (COND ((NOT (EQ (TOTALDEGREE (Lpmon AA))
			       BB))
		      (RETURN NIL)))
	       (GO Ml)))
	(RETURN BB)
 ))

%# ASSIGNINHOMOGENP (augpol) : genint ;
(DE ASSIGNINHOMOGENP (auginhpol)
 (PROG	(AA BB)
	(COND ((NOT auginhpol) (RETURN NIL)))
	(SETQ AA (CDR auginhpol))
	(SETQ BB (TOTALDEGREE (Lpmon AA)))
  Ml	(COND ((PolDecap AA)
	       (COND ((NOT (EQ (TOTALDEGREE (Lpmon AA))
			       BB))
		      (SETERRONEOUSTERM (Lt AA))
		      (RETURN (TOTALDEGREE (Lpmon AA)))))
	       (GO Ml)))
	(RETURN NIL)
 ))

%# LDEGREE (augpol) : degree;
(DE LDEGREE (pol) (TOTALDEGREE (Lpmon pol)))

%# TESTINDATA () : llgenint ;
(DE TESTINDATA ()
  (COND	((EQ (GETPROCESS) 'DEGREEWISE)
	 (MAPCAR InPols (FUNCTION (LAMBDA (clist)
					  (MAPCAR (CDR clist)
						  (FUNCTION HOMOGENP))))))
	(T
	 (MAPCAR InPols (FUNCTION HOMOGENP)))) )

%  Returns NIL if all InPol's are homogeneous. Else, returns
% the number of inhomogeneous ones.
%
%  Side effect: If inhomogeneous InPol's are found, then
% the first found such polynomial, and the first term found
% therein with degree different from the degree of the leading
% term, immediately afterwards are retriavable by (GETERRONEOUSPOL)
% and (GETERRONEOUSTERM), respectively.

%  Meaning of PROG variables: ReTurn value; INPut (part of InPols);
% Input Item.

%% (DE NONHOMOGINDATA ()
%%  (PROG	(rt inp ii)
%% 	(SETQ inp InPols)
%%   Ml1	(COND ((NOT (SETQ inp (CDR inp)))
%% 	       (RETURN rt)))
%% 	(SETQ ii (CAR inp))
%%   Sl	(COND ((NOT (SETQ ii (CDR ii)))
%% 	       (GO Ml1))
%% 	      ((NOT (ASSIGNINHOMOGENP (CAR ii)))
%% 	       (GO Sl)))
%% 	(SETERRONEOUSPOL (CAR ii))
%% 	(SETQ rt 1)
%%   Ml2	(COND ((SETQ ii (CDR ii))
%% 	       (COND ((NOT (HOMOGENP (CAR ii)))
%% 		      (SETQ rt (ADD1 rt))))
%% 	       (GO Ml2))
%% 	      ((SETQ inp (CDR inp))
%% 	       (SETQ ii (CAR inp))
%% 	       (GO Ml2)))
%% 	(RETURN rt) ))

%  Changes 2006-08-07: Work through ordinary list, in both process modes.

%  Meaning of PROG variables: ReTurn value; Input Position.

%# NONHOMOGINDATA () : genint ;
(DE NONHOMOGINDATA ()
 (PROG	(rt ip)
	(SETQ ip (DEGORITEMLIST2LIST InPols))
  Ml1	(COND ((NOT ip)
	       (RETURN rt))
	      ((NOT (ASSIGNINHOMOGENP (CAR ip)))
	       (SETQ ip (CDR ip))
	       (GO Ml1)))
	(SETERRONEOUSPOL (CAR ip))
	(SETQ rt 1)
  Ml2	(COND ((SETQ ip (CDR ip))
	       (COND ((NOT (HOMOGENP (CAR ip)))
		      (SETQ rt (ADD1 rt))))
	       (GO Ml2)))
	(RETURN rt) ))


%  Auxiliaries: For simpler global access to a found (and in the
% context erroneous) non-homogeneous polynomial, and to its first
% deviatingly graded term.
%
%  Should possibly be moved to another module.

%# SETERRONEOUSPOL (augpol) : - ;
(DE SETERRONEOUSPOL (pol) (SETQ !$!&FoundIhPol!#!* pol))

%# GETERRONEOUSPOL () : augpol ;
(DE GETERRONEOUSPOL () (PROGN !$!&FoundIhPol!#!*))

%# SETERRONEOUSTERM (cfmon) : - ;
(DE SETERRONEOUSTERM (tm) (SETQ !$!&FoundIhCfMon!#!* tm))

%# GETERRONEOUSTERM () : cfmon ;
(DE GETERRONEOUSTERM () (PROGN !$!&FoundIhCfMon!#!*))

%# CLEARERRORITEMS () : - ;
(DE CLEARERRORITEMS ()
 (PROGN	(SETQ !$!&FoundIhPol!#!* NIL)
	(SETQ !$!&FoundIhCfMon!#!* NIL) ))


%# POLDEGREE (augpol) : int ;
(DE POLDEGREE (auginhpol)
 (PROG	(AA BB CC)
	(COND ((NOT auginhpol) (RETURN T)))
	(SETQ AA (CDR auginhpol))
	(SETQ BB (TOTALDEGREE (Lpmon AA)))
  Ml	(COND ((PolDecap AA)
	       (COND ((LESSP BB
			     (SETQ CC (TOTALDEGREE
					(Lpmon AA))))
		      (SETQ BB CC)))
	       (GO Ml)))
	(RETURN BB)
 ))


%%%%%%%  Homogenisation/dehomogenisation preparation. %%%%%%%%

% Homogenisation/inhomogenisation is a bit intricate, since the
% internal representation of monomials depends on the number of
% variables (the "embedding dimension", embdim). The homogenisation
% SHOULD HAPPEN IN THE SAME PLACE, ONCE in the run, unless an
% explicit dehomogenisation or a (CLEARALL) has been performed.
% The reason is that else there is a grave risque of mixing in-
% homogeneous polynomials and monomials with homogeneous ones,
% or to use operations assuming the right kind of internal
% representation on the former, when they no longer have it.
% MOST SAFE AND SIMPLE should be only to use HOMOGENISEINPUT
% and DEHOMOGENISEREDUCEGBASIS. However, other top level functions
% may be needed in particular applications.


% The switch HOMOGENISED is normally set on or off by the
% (de-)homogenising routines. Touch it only e.g. to fool the
% system that the data is (not) homogenised, in order to perform
% an extra (de-)homogenisation.


% Checks that the mode settings are appropriate; sets HOMOGENISED;
% Stores away/Throws away the old saved unique monomial information
% (depending on whether SAVEINHOMOGMONS is set or not); changes the
% internal embdim, if set.

(DE PREPAREHOMOGENISATION ()
%added noncommutattive variant VU 02-07-03
 (PROGN	(COND ((NonCommP)
	       (COND ((NOT !*HSisLoaded)
		(EVAL (LIST 'LOAD HSERIESFILE!*))
		(ON HSisLoaded)))
	       (HomogNonCommElim))
	      (T
                (COND ((EQ commMONORDER 'TDEGREVLEX) (HomogRevLexify))
		      ((EQ commMONORDER 'TDEGLEX) (HomogDegLexify))
		      ((EQ commMONORDER 'PURELEX) (HomogPureLexify)))))
	% The following perhaps ought to be replaced by
	% (COND ((GETVARNO) (SETVARNO (ADD1 (GETVARNO))))) ??
	(COND (!&!*InnerEmbDim!&!*
	       (SETQ !&!*InnerEmbDim!&!* (ADD1 !&!*InnerEmbDim!&!*))))

	% New 2002-10-10: Perhaps put the homogvar in place.
	% (I put it last; should it go first?)
	% Alternatively, use the suggested procedure ADDOUTVAR.
	% Also, might depend on conditional. The user might not wish to
	% print this, anyhow; but might OUTVARS not to be fiddled with./JoeB
	(COND ((AND (GETVARNO)
		    (EQN (LENGTH (GETOUTVARS)) (SUB1 (GETVARNO)))
		    (NOT (MEMQ (GETHOMOGVARIABLE) (GETOUTVARS))))
	       (SETOUTVARS (APPEND (GETOUTVARS) (NCONS (GETHOMOGVARIABLE))))))
	(ON HOMOGENISED)
	(COND (!*SAVEINHOMOGMONS
	       (SETQ SavedInhomogMonList (CDR MONLIST))))
	(RPLACD MONLIST NIL) ))


% Inverts the same.

%# PREPAREDEHOMOGENISATION () : - ;
(DE PREPAREDEHOMOGENISATION ()
 (PROGN	(COND (!&!*InnerEmbDim!&!*
	       (SETQ !&!*InnerEmbDim!&!* (SUB1 !&!*InnerEmbDim!&!*))))
	(OFF HOMOGENISED)
	(COND (!*SAVEINHOMOGMONS
	       (RPLACD MONLIST SavedInhomogMonList))
	      (T
	       (RPLACD MONLIST NIL))) ))

%# CLEARHOMOGENISATION () : - ;
(DE CLEARHOMOGENISATION ()
 (PROGN (OFF HOMOGENISED) ))

%# SETHOMOGVARIABLE (uip) : id ; FEXPR
(DF SETHOMOGVARIABLE (any)
 (PROG	(rt ip)
	(SETQ rt !$!&HomogVarName!#)
	(COND ((ATOM any)
	       (SETQ ip any))
	      ((ATOM (CAR any))
	       (SETQ ip (CAR any)))
	      ((AND (EQ (CAAR any) 'QUOTE) (PAIRP (CDAR any)))
	       (SETQ ip (CADAR any)))
	      (T (ERROR 99 "Bad input to SETHOMOGVARIABLE")))
	(COND ((IDP ip)
	       (SETQ !$!&HomogVarName!# ip))
	      ((STRINGP ip)
	       (SETQ !$!&HomogVarName!#
		     (INTERN (COMPRESS (STRIPEXPLODE ip)))))
	      (T (ERROR 99 "Bad input to SETHOMOGVARIABLE")))
	(RETURN rt) ))

%# GETHOMOGVARIABLE () : id ;
(DE GETHOMOGVARIABLE () !$!&HomogVarName!#)


% - In order to get print-out to work, the HomogVarName must be related
% to the the HomogVarIndex. The latter should be calculated and set in
% PREPAREHOMOGENISATION.


% Works with the internal PUREMON structure:
% Give the homogenising variable the appropriate exponent, so that the
% result (which is interned) has degree degr.

%# RevLexHomogPMon (pmon, int) : augmon ;
(DE RevLexHomogPMon (pmon degr)
    (MONINTERN (CONS (DIFFERENCE degr (TOTALDEGREE pmon))
		     (MONLISPOUT pmon))) )

% The following is WRONG. Indeed, the first variable should be the
% homogenising variable (as being most significant); but then LOWER first
% variable exponent corresponds to HIGHER original total degree, which
% should be considered higher. HMMM ... .

%# DegLexHomogPMon (pmon, int) : augmon ; COPYD RevLexHomogPMon
(COPYD 'DegLexHomogPMon 'RevLexHomogPMon)

%# PureLexHomogPMon (pmon, int) : augmon ;
(DE PureLexHomogPMon (pmon degr)
    (MONINTERN (NCONC (MONLISPOUT pmon)
		      (NCONS (DIFFERENCE degr
					 (TOTALDEGREE pmon))))) )


%  NoncommutativeHomogenization for ELIM order VU 02-07-04
% Put homogenizing variable in the begining of the monom.
% Later reduction moves it back.

%# noncommElimHomogPMon (pmon, int) : augmon ;
(DE noncommElimHomogPMon (pmon degr)
 (PROG	(rt dg n)

	(SETQ rt (MONLISPOUT pmon))
	(SETQ dg (DIFFERENCE degr (TOTALDEGREE pmon)))
  L1	(COND ((GREATERP dg 0)
		  (SETQ rt (CONS !$!&HomogVarIndex!# rt))
		  (SETQ dg (SUB1 dg))
		  (GO L1)) 
             (T (RETURN (MONINTERN rt)))
        )%endCOND
))

(COPYD 'HomogPMon 'RevLexHomogPMon)
  
(DE HOMOGENISE (auginhpol)
 (PROG	(AA BB rt)
	(COND ((NOT auginhpol) (RETURN NIL)))
	(COND ((NOT !*HOMOGENISED)
	       (PREPAREHOMOGENISATION)))
	(SETQ AA (CDR auginhpol))
	(SETQ BB (POLDEGREE auginhpol))
	(SETQ rt (NCONS NIL))
  Ml	(TermInsert (Cf!&Mon2Tm (Lc AA) (HomogPMon (Lpmon AA) BB))
		    rt)
	(COND ((PolDecap AA) (GO Ml)))
	(RETURN rt)
 ))

%	Shortcut: as above, but employing that input be KNOWN homog.

(DE FormalHomogenise (auginhpol)
 (PROG	(AA BB)
	(COND ((NOT auginhpol) (RETURN NIL)))
	(COND ((NOT !*HOMOGENISED)
	       (PREPAREHOMOGENISATION)))
	(SETQ AA (CDR auginhpol))
	(SETQ BB (NCONS NIL))
  Ml	(TermInsert (Cf!&Mon2Tm (Lc AA) (HomogPMon (Lpmon AA) 0))
		    BB)
	(COND ((PolDecap AA) (GO Ml)))
	(RETURN BB)
 ))


%	Destructively changes the InPols polynomials.

%% (DE HOMOGENISEINPUT ()
%%  (PROGN (MAPC InPols
%% 	      (FUNCTION (LAMBDA (dlapolarg)
%% 				(MAP (CDR dlapolarg)
%% 				     (FUNCTION (LAMBDA (cdrarg)
%% 						       (RPLACA cdrarg
%% 							       (HOMOGENISE (CAR cdrarg)))))))))
%% 	(COND ((NonCommP)
%% 	       (SETQ InPols (SortlPol (APPEND (DEGORITEMLIST2LIST  InPols)
%% 					      (BinomsForNCHomogenisation))))))
%% 	NIL ))

%# HOMOGENISEINPUT () : - ;
(DE HOMOGENISEINPUT ()
 (PROG	(rt ip)
	(SETQ ip (DEGORITEMLIST2LIST  InPols))
  Ml	(COND (ip
	       (SETQ rt (CONS (HOMOGENISE (CAR ip)) rt))
	       (SETQ ip (CDR ip))
	       (GO Ml)))
	(COND ((NonCommP)
	       (SETQ rt (NCONC (BinomsForNCHomogenisation) rt))))
	(SETQ InPols (SortlPol rt)) ))

%	Destroys the GBasis polynomials.

%% Works with the internal PUREMON structure:
%
%(DE DehomogeniseGBasis ()
% (PROG	(AA BB CC DD EE FF GG)
%	(COND ((NOT (SETQ AA (CDR GBasis)))
%	       (RETURN NIL)))
%	(RPLACD InhGBasis NIL)
%	% Main loop: Process an homog Gbe
%  Ml	(COND ((NOT AA) (RETURN InhGBasis)))
%	(SETQ BB (Mpt (CAR AA)))
%	(SETQ CC (CDR (PMon (CAR AA)))) % Works with the internal PUREMON structure, and EVEN SO may be wrong!
%	(SETQ AA (CDR AA))
%	(SETQ DD (INHTOTALDEGREE CC))
%	(SETQ EE InhGBasis)
%	% First Subloop: Find the correct inhomog degree on InhGBasis
%  Sl1	(COND ((OR (NOT (CDR EE)) (LESSP DD (CAADR EE)))
%	       (SETQ FF (CDR BB))
%	       (GO SSl1)))
%	(SETQ FF (CDADR EE))
%  SSl1	(COND ((PMonEqOrFactorP (Lpmon (CDR EE)) BB)
%	       (GO Ml))
%	      ((SETQ FF (CDR FF))
%	       (GO SSl1)))
%	(SETQ EE (CDR EE))
%	(GO Sl1)
%	% Second Subloop: Dehomogenise the polynomial
%  Sl2	(RPLACD (Lt FF) (CDR (Lpmon FF))) % Works with the internal PUREMON structure
%	(COND ((SETQ FF (PolTail FF)) (GO Sl2))
%	      ((NOT (AND (CAR EE)
%			 (EQ (CAAR EE) DD)))
%	       (RPLACD EE (CONS (LIST DD BB) (CDR EE)))
%	       (SETQ EE (CDR EE))
%	       (GO Sl4)))
%	% Third Subloop: Insert the polynomial into InhGBasis
%	(SETQ DD (CAR EE))
%  Sl3	(COND ((AND (CDR DD) (MONLESSP (CDADR (CADR DD)) CC))
%	       (SETQ DD (CDR DD))
%	       (GO Sl3)))
%	(RPLACD DD (CONS BB (CDR DD)))
%	% Fourth Subloop: Eliminate inhomog Gbe's reducible by the
%	% new one
%  Sl4	(SETQ DD (CADR EE))
%  SSl4	(COND ((MonfactorP CC (CDADR (CADR DD)))
%	       (RPLACD DD (CDDR DD)))
%	      (T (SETQ DD (CDR DD))))
%	(COND ((CDR DD) (GO SSl4))
%	      ((NOT (CDADR EE)) (RPLACD EE (CDDR EE)))
%	      (T (SETQ EE (CDR EE))))
%	(COND ((CDR EE) (GO Sl4)))
%	(GO Ml)
% ))

% The construct above seems a bit fishy.
% An alternative construct; its input be a correct (reduced) homog.
% GBasis, but IN REVERSE order, represented by its monomials; the order
% be TDEG-REVLEX, internally represented by "the homogenisation
% variable first". Its output is a degree list of monomials,
% representing the homogeneisation of a reduced inhomogeneous GBasis. It
% is NOT tail auto-reduced. The montree structure is not hurt.
%  The output is a degree-list of pairs (Lm(Gbe) . Gbe) .

(DE InHomogReduceHomBasis (revlmon)
 (PROG  (inlmon tailinlmon cmon cpmon cdecr ctdeg newcmon newcpol
	 deglmonpol taildeglmonpol clmonpol)
	(COND ((NOT (SETQ inlmon revlmon))
	       (RETURN NIL)))
	(SETQ deglmonpol (NCONS NIL))
  Ml	%(PRIN2 "At Ml; (CAR inlmon) = ")(AlgPureMonPrint (CAR inlmon))(TERPRI)
	(COND ((ZEROP (SETQ cdecr (HOMOGVAREXP (SETQ cmon (CAR inlmon)))))
	       (SETQ cpmon (PMon (SETQ newcmon cmon)))
	       (SETQ newcpol (Mpt cmon))
	       (GO Ins)))
	(SETQ cpmon (PMon (SETQ newcmon (LOWERHOMOGVAREXP cmon cdecr))))
	(ReplaceLowerPolHomogVarExp (PPol (Mpt cmon)) cdecr)
	(SETQ newcpol (Mpt cmon))

	% Remove multiples of newcmon from input. (Unnecessary if cdecr=0).
	(SETQ tailinlmon inlmon)
  Rmi	%(PRIN2T "At Rmi")
	(COND ((CDR tailinlmon)
	       (COND ((MONFACTORP cpmon (PMon (CADR tailinlmon)))
		      (RPLACD tailinlmon (CDDR tailinlmon)))
		     (T
		      (SETQ tailinlmon (CDR tailinlmon))))
	       (GO Rmi)))

	% Insert the pair (newcmon . newcpol) into the proper place on
	% deglmonpol.
  Ins	%(PRIN2T "At Ins")
	(SETQ ctdeg (TOTALDEGREE cpmon))
	(SETQ taildeglmonpol deglmonpol)
  I1	%(PRIN2T "At I1")
	(COND ((AND (CDR taildeglmonpol) (BMI!< (CAADR taildeglmonpol) ctdeg))
	       (SETQ taildeglmonpol (CDR taildeglmonpol))
	       (GO I1))
	      ((NOT (AND (CDR taildeglmonpol)
			 (BMI!= ctdeg (CAADR taildeglmonpol))))
	       (RPLACD taildeglmonpol
		       (CONS (LIST ctdeg (CONS newcmon newcpol))
			     (CDR taildeglmonpol)))
	       (GO Rmop)))
	(SETQ clmonpol (CADR taildeglmonpol))
  I2	%(PRIN2T "At I2")
	%(COND ((CDR clmonpol) (PRIN2 "; (PMon (CAADR clmonpol)) = ")
	%       (PRINT (PMon (CAADR clmonpol))))
	%      (T (TERPRI)))
	(COND ((AND (CDR clmonpol) (MONLESSP cpmon (PMon (CAADR clmonpol))))
	       (SETQ clmonpol (CDR clmonpol))
	       (GO I2)))
	(RPLACD clmonpol
		(CONS (CONS newcmon newcpol) (CDR clmonpol)))

	% Remove multiples of newcmon from output. (Unnecessary if cdecr=0).
	% Also (if correct input) unnecessary for pp of the current pp total
	% degree.
  Rmop	%(PRIN2T "At Rmop")
	(COND ((ZEROP cdecr)
	       (GO End)))
	(SETQ taildeglmonpol (CDR taildeglmonpol))
  Rmo	%(PRIN2T "At Rmo")
	(COND ((NOT (CDR taildeglmonpol))
	       (GO End)))
	(SETQ clmonpol (CADR taildeglmonpol))
  Rmo1	%(PRIN2T "At Rmo1")
	(COND ((CDR clmonpol)
%	       (PRIN2 "Before MONFACTORP; cpmon = ") (PRIN2 cpmon)
%	       (PRIN2 "; (PMon (CAADR clmonpol)) = ")
%	       (PRINT (PMon (CAADR clmonpol)))
	       (COND ((MONFACTORP cpmon (PMon (CAADR clmonpol)))
		      (RPLACD clmonpol (CDDR clmonpol)))
		     (T
		      (SETQ clmonpol (CDR clmonpol))))
	       (GO Rmo1))
	      ((NOT (CDADR taildeglmonpol))
	       (RPLACD taildeglmonpol (CDDR taildeglmonpol)))
	      (T
	       (SETQ taildeglmonpol (CDR taildeglmonpol))))
	(GO Rmo)
  End	%(PRIN2T "At End")
	(COND ((SETQ inlmon (CDR inlmon))
	       (GO Ml)))
	(RETURN (CDR deglmonpol))
 ))



% If the output of InHomogReduceHomBasis is wanted transformed to a degree list
% of monomials, each of whose pointer is the corresponding polynomial:

(DE DEGREELISTPUTPOINTERS (deglmonpol)
 (MAPC deglmonpol
       (FUNCTION (LAMBDA (auglmonpol)
			 (MAP (CDR auglmonpol)
			      (FUNCTION (LAMBDA (almptail)
						(PROGN (PutMpt (CAAR almptail)
							       (CDAR almptail))
						       (RPLACA almptail
							       (CAAR almptail))))))))))

% Destructive! Replaces each pp p of ppol by p/(z^ind), where z is the
% homogenisation variable.

(DE ReplaceLowerPolHomogVarExp (ppol ind)
 (MAPC ppol
       (FUNCTION (LAMBDA (tm) (RPLACD tm (LOWERHOMOGVAREXP (CDR tm) ind))))) )


(DE RevLexHOMOGVAREXP (mon) (CAR (PMon mon)))

(DE RevLexLOWERHOMOGVAREXP (mon ind)
 (PROG	(cpmon cniMon)
	(RPLACA (SETQ cniMon niMon)
		(BMI!- (CAR (SETQ cpmon (PMon mon))) ind))
  Ml	(COND ((SETQ cpmon (CDR cpmon))
	       (RPLACA (SETQ cniMon (CDR cniMon)) (CAR cpmon))
	       (GO Ml)))
	(RETURN (niMonIntern))))

(COPYD 'HOMOGVAREXP 'RevLexHOMOGVAREXP)
(COPYD 'LOWERHOMOGVAREXP 'RevLexLOWERHOMOGVAREXP)

(DE HomogRevLexify ()
 (PROG	(!*USERMODE !*REDEFMSG)
	(COPYD 'HOMOGVAREXP 'RevLexHOMOGVAREXP)
	(COPYD 'LOWERHOMOGVAREXP 'RevLexLOWERHOMOGVAREXP)
	(COPYD 'HomogPMon 'RevLexHomogPMon) ))

(DE HomogDegLexify ()
 (PROG	(!*USERMODE !*REDEFMSG)
	(COPYD 'HomogPMon 'DegLexHomogPMon) ))

(DE HomogPureLexify ()
 (PROG	(!*USERMODE !*REDEFMSG)
	(COPYD 'HomogPMon 'PureLexHomogPMon) ))

(DE HomogNonCommElim ()
 (PROG	(!*USERMODE !*REDEFMSG)
	(COPYD 'HomogPMon 'noncommElimHomogPMon)
        (SETQ  !$!&HomogVarIndex!# (ADD1 (InVarNo)))
        (HOMOGELIMORDER)
 ))

%%%%%%%%%%%%%%%%%%%%%%% serie of Proc for dehomogenisation VU & SC 02-07-11
(DE CancelCfMonom (Mon n)
 (PROG (m)
  (SETQ m n)
  L
 (COND ((LESSP  0 m)
	 (COND ((EQ !$!&HomogVarIndex!# (CADR Mon)) (RPLACD Mon (CDDR Mon)))
	       (T (DELETIP !$!&HomogVarIndex!# (CDR Mon)))) % Looks unused - and isn't Standard.
	 (SETQ m (SUB1 m))
	 (GO L)))
 ))


(DE CancelHomogVar (LispPol n)
  (PROG (cr)
   (SETQ cr LispPol)
   M 
   (COND (cr  (CancelCfMonom (CAR cr) n) (SETQ cr (CDR cr)) (GO M)))
))

(DE HomogDefectCfMonom (Mon)
 (PROG (cr)
  (SETQ cr (MEMBER !$!&HomogVarIndex!# (CDR Mon)))
  (COND (cr (RETURN (ADD1 (HomogDefectCfMonom cr))))
        (T (RETURN 0)))
)) 

(DE DegreeLispPol (LispPol)
 (SUB1 (LENGTH (CAR LispPol)))
)

(DE CancelingPol (LispPol)
 (PROG (lm)
 %  (PRIN2 "in CancelingPol,LispPol=") (PRINT LispPol) (TERPRI)
   (COND ((NULL LispPol) (RETURN NIL)))
   (SETQ lm (CAR LispPol)) %?macros?   
%  (PRIN2 "in CancelingPol, lm=")(PRINT lm)(TERPRI)
   %take care about commutators
   (COND ((BMI!= ( DegreeLispPol LispPol) 2)
	  (RETURN ( EQUAL (CADDR lm) !$!&HomogVarIndex!#)))
	( T    (RETURN (MEMBER !$!&HomogVarIndex!# (CDR lm)))))
)) 


(DE WarningonLowGrad (LispPol)
 (COND ((LESSP (DegreeLispPol LispPol) 2)
        (PRIN2 "*** Sorry, we have got a polynomial of low degree in  the GB.")
	(TERPRI)
	(PRIN2 "*** The programme will crash soon.")
	(PRIN2 " The polynomial in lisp form looks as")
	(TERPRI)
	(PRINT LispPol)))
)


(DE CancelPol (LispPol)
 (COND ((CancelingPol LispPol) 
          (SETQ MinCancelingDegree (MIN2  (DegreeLispPol LispPol) MinCancelingDegree))
	  (CancelHomogVar LispPol (HomogDefectCfMonom (CAR LispPol)))
%	  ( WarningonLowGrad  LispPol)
	  ))
)	  
	    
(DE CancelInListPol (ListPol)
 (MAPC ListPol (FUNCTION  CancelPol))
)
 
%%%%%%%%%%%%%%%%%%%%%%% Complete Dehomogenization %%%%%%%%%%%%%%%%%%%%%%%
 
(DE DeHomogCfMonom (Mon )
  (CancelCfMonom Mon (HomogDefectCfMonom Mon))
)

(DE DeHomogLispPol (LispPol)
 (MAPC LispPol (FUNCTION DeHomogCfMonom ))
)

 (DE DeHomogQPol (QPol)
  (PROG ()
  (DeHomogLispPol (CDR QPol))
  (RETURN QPol)
 ))

%(DE DeHomogListofPol (ListPol)
% (MAPC ListPol (FUNCTION DeHomogLispPol  ))
%)

(DE Commutator!? (LispPol)
    (COND((EQUAL( DegreeLispPol LispPol) 2)
	  (EQUAL (CADAR LispPol) !$!&HomogVarIndex!#))
      	  ( T NIL))
)




% Destructive 
(DE DeHomogListofPol (ListPol)
 (PROG	(cl res)
	(SETQ res ListPol )
  L	(COND ((Commutator!? (CAR res)) (SETQ res (CDR res)) (GO L)))
	(SETQ cl res)
  M	(COND ((NULL cl) (RETURN res)))
	(COND ((NULL (CDR cl)) 
	       (DeHomogLispPol  (CAR cl )) 	
	       (RETURN res)))
	(COND ((Commutator!? (CADR cl)) (RPLACD cl (CDDR cl)) (GO M)))
	(DeHomogLispPol  (CAR cl ))
	(SETQ cl (CDR cl))
	(GO M) ))

%%%%%%%%%%%%%%%%%%%%%%% End of Proc for dehomogenisation VU & SC 02-07-11
(ON RAISE)
