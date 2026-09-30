%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%
%% Copyright (C) 1992,1994,1995,1996,1997,1998 Joergen Backelin
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


%	CHANGES

%  Added !*SAWSIsLoaded and SETSAWSSTRATEGY./JoeB 2004-05-02

%  Replaced direct ALGOUTMODE access./JoeB 1999-06-29

%  !&StaSOldRaise --> !&!S!t!a!S!O!l!d!R!a!i!s!e (for working
% smootly with the case converter)./JoeB 1999-02-12

%  CLEARALL --> CLEARIDEAL./JoeB 1998-10-23

%  Lower case in TOPLOOPNAME!*./JoeB 1998-09-22

%  Changed MAPLEINPUT to ALGFORMINPUT and MAPLE to ALG.
% Introduced GETCURRENTDEGREE./JoeB 1998-08-07

%  Changed setinvars to vars in STAGSIMPLE./JoeB 1997-08-21

% Available: STAGSIMPLE.

(SETQ TOPLOOPNAME!* "")
(SETQ !&!S!t!a!S!O!l!d!R!a!i!s!e !*RAISE) (OFF RAISE)
(GLOBAL '(!*SAWSIsLoaded !&!*StgFinalOutputChan))


(LOAD STG)
(ON SAWSIsLoaded)


(DF STAGSIMPLE (files)
    (PROG (outfi finaloutfi)
	  (COND ((AND (PAIRP files) (FILEP (CAR files))) % FILEP is psl - bad.
		 (DSKIN (CAR files))
		 (COND ((AND (PAIRP files) (PAIRP (CDR files)))
			(COND ((STRINGP (CADR files))
			       (SETQ outfi (CADR files))))
			(COND ((AND (PAIRP (CDDR files))
				    (STRINGP (CADDR files)))
			       (SETQ finaloutfi (CADDR files))))))
		 (GO skip)))
	  (PRIN2 "Now input in-variables and ideal generators in mapleform, thus:")
	  (TERPRI) (PRIN2 "	vars v1, ..., vn;") (TERPRI)
	  (PRIN2 "	r1, ..., rm;") (TERPRI)
	  (PRIN2 "where v1, ..., vn are the variables, and r1, ..., rm the generators.")
	  (TERPRI) (ALGFORMINPUT)
     skip (SETALGOUTMODE ALG)
	  (COND (outfi (DOP outfi)) (T (DEGREEOUTPREPARE)))
	  (GROEBNERINIT)
	  (STAGTYPECHECKER) % Only since as yet the autored unit is within stg.
	  (AUTOREDUCEINPUT)
	  (STAGGERINIT)
	  (STAGGERKERNEL)
	  (COND (finaloutfi
		 (SETQ !&!*StgFinalOutputChan (OPEN finaloutfi 'OUTPUT)))
		(T (SETQ !&!*StgFinalOutputChan NIL)))
	  (STAGGERFINISH)
	  (PRIN2 " - All is OK (I hope). Now you may (e. g.):") (TERPRI)
	  (PRIN2 "   - kill bergman with (QUIT); or") (TERPRI)
	  (PRIN2 "   - interrupt bergman with ^Z; or") (TERPRI)
	  (PRIN2 "   - clear the memory with (CLEARIDEAL), and run a new (SIMPLE).")
	  (TERPRI) ))

(DE DEGREEENDDISPLAY () (PROGN (STAGGERDEGREEOUTPUT) (TERPRI)
 (PRIN2 "% No. of Spolynomials calculated until degree ")
 (PRIN2 (GETCURRENTDEGREE)) (PRIN2 ": ")  (PRINT NOOFSPOLCALCS)
 (PRIN2 "% No. of ReducePol(0) demanded until now: ")
 (PRINT NOOFNILREDUCTIONS)
 (PRIN2 "% No. of NOOFREPRIORITATIONS demanded until now: ")
 (PRINT NOOFREPRIORITATIONS)
 (PRIN2 "% No. of NOOFSTAGCONECRIT encountered until now: ")
 (PRINT NOOFSTAGCONECRIT)
 (PRIN2 "% Time: ") (PRINT (TIME))
 ))

(SETSAWSSTRATEGY)

%(FLAG '(STAGDEGREEENDDISPLAY) 'USER)

% (ON IMMEDIATEFULLREDUCTION)
(ON REDUCTIVITY)
(COND (!&!S!t!a!S!O!l!d!R!a!i!s!e (ON RAISE)))
(SETQ TOPLOOPNAME!* "bergman (with stag)")
