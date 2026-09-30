%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%
%% Copyright (C) 1994,1997,1999 Joergen Backelin
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


%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%
%%							      %%
%%	WARNING!	WARNING!	WARNING!	      %%
%%							      %%
%%	Do not compile the content of this file! It	      %%
%%	mainly contains top-of-the-top procedures,	      %%
%%	which should be visible to the user.		      %%
%%	Moreover, trying to compile the self-loading	      %%
%%	macros should (rightfully) cause errors!	      %%
%%							      %%
%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%



%   CHANGES:

%  PBSisLoaded!* --> HSisLoaded!*./JoeB 1999-11-04

%  Added PRINTNEXT (for debugging input)./JoeB 1999-10-20

%  CHANNELFLUSH --> FLUSHCHANNEL./JoeB 1999-07-04

%  Made the hseries.sl user available procedures self-loading.
% Replaced direct ALGOUTMODE access./JoeB 1999-06-29

%  Made MODULEHSERIES a self-loading macro./JoeB 1999-06-26

%  CLEARALL --> CHEARIDEAL (but old name kept as alias).
% Brought MODULEHSERIES from bmtop.sl. Changed oldded use.
% /JoeB 1998-10-22 -- 10-24

%  Introduced APPLYIFDEF0, GETCURRENTDEGREE, SETCURRENTDEGREE.
% /JoeB 1998-08-07, 1998-08-24

%  CLEARALL now sets cDeg to NIL./JoeB 1997-10-12



(GLOBAL '(MODULESHSERIESFILE!* HSERIESFILE!* !*HSisLoaded
	  !&!*PRESENTCHAN!#))

% Top-of-the-top level functions.

(DE CLEARIDEAL ()
 (PROGN (SETQ SPairs ())
	(SETQ cSPairs ())
	(COND ((PAIRP GBasis) (RPLACD GBasis ()))
	      (T (SETQ GBasis (CONS () ()))))
	(COND ((PAIRP cGBasis) (RPLACD cGBasis ()))
	      (T (SETQ cGBasis (CONS () ()))))
	(SETQ InPols ())
	(SETQ cInPols ())
	(SETCURRENTDEGREE ())
	(COND ((PAIRP MONLIST) (RPLACD MONLIST ()))
	      (T (SETQ MONLIST (CONS () ()))))
	(COND ((PAIRP MAOaux) (RPLACD MAOaux ()))
	      (T (SETQ MAOaux (CONS () ()))))
	(COND (!*HSisLoaded (CLEARPBSERIES)))
	(SETQ EMBDIM ())
	(SETQ !&!*InnerEmbDim!&!* ())
	(SETQ ReclaimList ())
	(COND ((PAIRP HISTORYLIST!*) (RPLACD HISTORYLIST!* NIL)))
	(APPLYIFDEF0 '(CLEARHOMOGENISATION CLEARRESOLUTION))
	(RECLAIM) ))

(DE CLEARALL () (PROGN
  (COND (!*OBSOLETENAMESINFORM (TERPRI)
	 (PRIN2 "*** CLEARALL is obsolete - use CLEARIDEAL instead! ")
	 (TERPRI)))
  (CLEARIDEAL)))

(DE GI () (GROEBNERINIT)) (DE GK () (GROEBNERKERNEL)) (DE BO () (BIGOUTPUT))
(DE GF () (GROEBNERFINISH)) (DE CL () (CLEARIDEAL))
(DE DOP (fil) (EVAL (LIST 'DEGREEOUTPREPARE fil)))
(DE ES () (PROGN (DEGREEOUTPUT) (ENDDEGREEOUTPUT)))
(DE STF (fil) (SETQ TESTFOO fil))
(DF SMI (lrg) (PRINTX (SET (CAR lrg) (MONINTERN (CDR lrg)))))

(DF SIMPLE (files)
    (PROG (outfi)
	  (COND ((AND (PAIRP files) (FILEP (CAR files)))
		 (DSKIN (CAR files))
		 (COND ((AND (PAIRP (CDR files)) (STRINGP (CADR files)))
			(SETQ outfi (CADR files))))
		 (GO skip)))
	  (PRIN2 "Now input in-variables and ideal generators in algebraic form, thus:")
	  (TERPRI) (PRIN2 "	vars v1, ..., vn;") (TERPRI)
	  (PRIN2 "	r1, ..., rm;") (TERPRI)
	  (PRIN2 "where v1, ..., vn are the variables, and r1, ..., rm the generators.")
	  (TERPRI) (ALGFORMINPUT)
     skip (SETALGOUTMODE ALG)
	  (COND (outfi (DOP outfi)) (T (DEGREEOUTPREPARE)))
	  (GROEBNERINIT)
	  (GROEBNERKERNEL)
	  (GROEBNERFINISH)
	  (PRIN2 " - All is OK (I hope). Now you may (e. g.):") (TERPRI)
	  (PRIN2 "   - kill bergman with (QUIT); or") (TERPRI)
	  (PRIN2 "   - interrupt bergman with ^Z; or") (TERPRI)
	  (PRIN2 "   - clear the memory with (CLEARIDEAL), and run a new (SIMPLE).")
	  (TERPRI) ))

(DE DEGREEENDDISPLAY () (PROGN (DEGREEOUTPUT) (TERPRI)
 (PRIN2 "% No. of Spolynomials calculated until degree ")
 (PRIN2 (GETCURRENTDEGREE)) (PRIN2 ": ")  (PRINT NOOFSPOLCALCS)
 (PRIN2 "% Time: ") (PRINT (TIME))
))

(FLAG '(DEGREEENDDISPLAY) 'USER)

(DE NCPBHGROEBNER (infile gbfile PBfile Hfile)
   (PROG (oldoutfi PBoutfi Houtfi !*CUSTSHOW !*PBSERIES oldded)
	 (COND ((NOT !*NONCOMMUTATIVE)
		(PRIN2 "*** I turn on noncommutativity")
		(TERPRI)
		(NONCOMMIFY)))
	 (ON PBSERIES)

	 % DON'T change the next line without asking SC and VU:
	 (COND ((EQ (GETALGOUTMODE) 'LISP)
		(SETALGOUTMODE ALG)))
	 (DSKIN infile)
	 (DOP gbfile)
	 (SETQ PBoutfi (OPEN PBfile 'OUTPUT))
	 (SETQ Houtfi (OPEN Hfile 'OUTPUT))
	 (ON CUSTSHOW)
	 (COPYD 'oldded 'DEGREEENDDISPLAY)
	 (COPYD 'DEGREEENDDISPLAY 'NCPBHDED)
	 (GROEBNERINIT)
	 (GROEBNERKERNEL)
	 (GROEBNERFINISH)
	 (CLOSE PBoutfi)
	 (CLOSE Houtfi)
	 (COPYD 'DEGREEENDDISPLAY 'oldded) ))

(COPYD 'oldded 'DEGREEENDDISPLAY)

(DE NCPBHDED ()
  (PROGN (DEGREEOUTPUT)
	 (SETQ oldoutfi (WRS PBoutfi))
	 (TDEGREECALCULATEPBSERIES (GETCURRENTDEGREE))
	 (FLUSHCHANNEL PBoutfi)
	 (WRS Houtfi)
	 (TDEGREEHSERIESOUT (GETCURRENTDEGREE))
	 (FLUSHCHANNEL Houtfi)
	 (WRS oldoutfi)
	 (TERPRI)
	 (PRIN2 "% No. of Spolynomials calculated until degree ")
	 (PRIN2 (GETCURRENTDEGREE)) (PRIN2 ": ")  (PRINT NOOFSPOLCALCS)
	 (PRIN2 "% No. of ReducePol(0) demanded until degree ")
	 (PRIN2 (GETCURRENTDEGREE)) (PRIN2 ": ")  (PRINT NOOFNILREDUCTIONS)
	 (PRIN2 "% Time: ") (PRINT (TIME))
))

(FLAG '(oldded NCPBHDED) 'USER)


 %%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%
 %%%  The following procedures are self-loading, and must  %%%
 %%%  not be compiled!					   %%%
 %%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%

% Stagger with substance key routines:

% Flagged the procedures USER 94-08-25 /JoeB
(PROG (axx)
 (DM STAGSIMPLE (u)
  (PROGN (LAPIN (MKBMPATHEXPAND "$bmauxil/stagsubs.sl")) u))
 (MAPC (SETQ axx '(STAGGERINIT STAGGERKERNEL STAGGERFINISH AUTOREDUCEINPUT
	 AUTOREDDEGENDDISPLAY AutoReduceFromTo STAGTYPECHECKER))
       (FUNCTION (LAMBDA (fcn) (COPYD fcn 'STAGSIMPLE))))
 (FLAG (CONS 'STAGSIMPLE axx) 'USER)

 (DM CALCPOLRINGHSERIES (u)
  (PROGN (EVAL (LIST 'LOAD HSERIESFILE!*))
	 (ON HSisLoaded)
	 u))
 (MAPC (SETQ axx '(CALCRATHILBERTSERIES CLEARHSERIESMINIMA
	 GBASIS2HSERIESMONID CALCRATHILBERTSERIES CALCPOLRINGHSERIES
	 GETHSERIESMINIMA GETHSERIESMINIMUM SETHSERIESMINIMA
	 SETHSERIESMINIMUMDEFAULT TDEGREEHSERIESOUT))
       (FUNCTION (LAMBDA (fcn) (COPYD fcn 'CALCPOLRINGHSERIES))))
 (FLAG (CONS 'CALCPOLRINGHSERIES axx) 'USER)
)

%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%
%  Non-comm module top-of-the-top stuff:                    %
%  Added by SK & VU 96-08-18                                %
% %%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%

(DM MODULEHSERIES (u) (PROGN (LAPIN MODULESHSERIESFILE!*) u))

(FLAG '(MODULEHSERIES) 'USER)


%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%
%%%  Some debugging facilities (for the user).		  %%%
%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%

(DF PRINTNEXT (u)
 (PROG	(!&!*CHWITHERR!# !&!*OLDCH!#)
	(SETQ !&!*CHWITHERR!# (COND ((ATOM u) u)
				    ((ATOM (CDR u)) (CDR u))
				    (T (CADR u))))
	(COND ((NOT (FIXP !&!*CHWITHERR!#))
	       (SETQ !&!*CHWITHERR!# !&!*PRESENTCHAN!#)))

	% Not so good: no error check!
	(SETQ !&!*OLDCH!# (RDS !&!*CHWITHERR!#))
	(PRINT (READ))
	(RDS !&!*OLDCH!#) ))
