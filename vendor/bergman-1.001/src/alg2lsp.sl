%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%
%% Copyright (C) 1992,1994,1995,1997,1998,2004,2005,2006
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


% CHANGES:

%  Replaced explicit investigations of the global variable Modulus
% by calls to InCoeff2RedandCoeff./JoeB 2007-08-15.

%  Replaced DEGLIST2LIST by DEGORITEMLIST2LIST./JoeB 2006-08-06

%  Changed UnRaisedAlgIn (adding a boolean argument), and added
% ADDALGFORMINPUT./JoeB 2005-02-19

%  Am experimenting a bit with the read error mechanisms.
% /JoeB 2005-01-19

%  Corrected a call to CONSTANTLIST2STRING./JoeB 2005-01-19

%  Fixed reading of (non-zero) constants in the noncommutative
% case./JoeB 2004-10-06

%  Changed ALGFORMINPUT error handling./JoeB 2004-04-28.

%  Changed ALGFORMINPUT and REDANDALGIN (introducing UnRaised
% versions) and the ALGINSCANTABLE setting to more clisp
% compatible form./JoeB, SV 1999-06-29

%  Declared more fluids./JoeB 1999-06-26

%  Added REDANDALGIN. Modularised commutativity mode changes in
% ALGFORMINPUT and REDANDALGIN by means of PolAlgRead. Introduced
% case sensitivity minor input mode./JoeB1998-07-24

%  Declared InPMonOne GLOBAL/JoeB1998-07-05

%  Moved keywords for variables input to a new global variable
% AlgVarInKeywords; added forms of VARS to this list. (In the
% future, these should replace SETINVARS forms completely in
% the algforminput context.) Changed AlginSetinvarsRead to
% AlginVarsRead/JoeB19970818 - 19970821

%  Introduced modularised IN/OUT-VARS handling, i.a. removing
% (comm/noncomm)InVars2OutVars /JoeB19950630

%  Adopting the old (fishy) 'binding globals as fluids' trick by
% using *RAISE as prog variable in both ALGFORMINPUT./JoeB19950621

(OFF RAISE)
(ON EOLINSTRINGOK)
(FLUID '(CURRENTSCANTABLE!* PROMPTSTRING!* !&CommaReadFlag!#
	 !*EOLINSTRINGOK))
(GLOBAL '(InPols InVars OutVars AlginEnders ALGINSCANTABLE!*
	  AlgVarInKeywords InPMonOne !*!&NoRaiseAlgInp!#))

(SETQ AlginEnders '(ENDALGFORMINPUT endalgforminput !; !: !$EOF!$))

(SETQ AlgVarInKeywords
      '(setinvars Setinvars SetInvars SETINVARS vars VARS Vars vARS))

(CL!-AVOIDING
 (SETQ ALGINSCANTABLE!*
  [17 10 10 10 11 10 10 10 10 17 17 10 17 17 10 10
   10 10 10 10 10 10 10 10 10 10 10 10 10 10 10 10
   17 14 15 13 11 12 11 11 11 11 13 11 11 11 20 11
   0  1  2  3  4  5  6  7  8  9 13 11 11 11 11 10
   10 10 10 10 10 10 10 10 10 10 10 10 10 10 10 10
   10 10 10 10 10 10 10 10 10 10 10 11 16 11 11 10
   21 10 10 10 10 10 10 10 10 10 10 10 10 10 10 10
   10 10 10 10 10 10 10 10 10 10 10 11 11 11 11 11
   ALGINDIPHTHONG]) )

(CL!-SPECIFIC
 (SETQ ALGINSCANTABLE!*
  (VECTOR 17 10 10 10 11 10 10 10 10 17 17 10 17 17 10 10
	  10 10 10 10 10 10 10 10 10 10 10 10 10 10 10 10
	  17 14 15 13 11 12 11 11 11 11 13 11 11 11 20 11
	  0  1  2  3  4  5  6  7  8  9 13 11 11 11 11 10
	  10 10 10 10 10 10 10 10 10 10 10 10 10 10 10 10
	  10 10 10 10 10 10 10 10 10 10 10 11 16 11 11 10
	  21 10 10 10 10 10 10 10 10 10 10 10 10 10 10 10
	  10 10 10 10 10 10 10 10 10 10 10 11 11 11 11 11
	  'ALGINDIPHTHONG)) )

% JoeB 940830:
%(PUTDIPHTHONG ALGINSCANTABLE!* '!: '!= '!:!=)
(PUT '!: 'ALGINDIPHTHONG '((!= . !:!=)))

%(PUTDIPHTHONG ALGINSCANTABLE!* '!* '!* '!^)
(PUT '!* 'ALGINDIPHTHONG '((!* . !^)))

(DE commPolAlgRead (JustRead)
 (PROG (aa bb kk mm rt mp PROMPTSTRING!* cm)
  (SETQ PROMPTSTRING!* "algebraic form (comm.) input> ")
  (SETQ rt (NCONS NIL))
  (SETQ aa JustRead)
MonRead
  (COND ((OR (EQ aa '!,) (MEMQ aa AlginEnders))
	 (SETQ !&CommaReadFlag!# (EQ aa '!,))
	 (RETURN (COND ((CDR rt) rt))))
	((EQ aa '!+)
	 (SETQ aa (RATOM))
	 (GO MonRead))
	((EQ aa '!-)
	 (SETQ mp (NOT mp))
	 (SETQ aa (RATOM))
	 (GO MonRead))
	((NOT (FIXP aa))
	 (SETQ kk 1)
	 (SETQ mm (LISTCOPY InPMonOne))
	 (GO VarRead)))
  (SETQ kk aa)
  (SETQ aa (RATOM))
  (SETQ mm (LISTCOPY InPMonOne))
TimesRead
  (COND ((NOT (EQ aa '!*)) (GO MonReadEnd)))
  (SETQ aa (RATOM))
VarRead
  (COND ((SETQ bb (ATSOC aa dpInVars))
	 (SETQ cm (PNTH mm (CDR bb)))
	 (COND ((EQ (SETQ aa (RATOM)) '!^)
		(RPLACA cm (PLUS2 (CAR cm) (RATOM)))
		(SETQ aa (RATOM)))
	       (T
		(RPLACA cm (ADD1 (CAR cm)))))
	 (GO TimesRead))
	(T
	 (AlginReadErrMessage)
	 (SETQ !&CommaReadFlag!# NIL)
	 (RETURN NIL)))
MonReadEnd
	(COND (mp
	       (SETQ mp NIL)
	       (SETQ kk (MINUS kk))))
	(COND ((SETQ kk (InCoeff2RedandCoeff kk))
	       (TermInsert (CONS kk (MONINTERN mm)) rt)))
	(GO MonRead) ))

(DE noncommPolAlgRead (JustRead)
 (PROG (aa bb kk mm sm rt mp PROMPTSTRING!* cm)
  (SETQ PROMPTSTRING!* "algebraic form (noncomm.) input> ")
  (SETQ sm (NCONS NIL))
  (SETQ rt (NCONS NIL))
  (SETQ aa JustRead)
MonRead
  (COND ((OR (EQ aa '!,) (MEMQ aa AlginEnders))
	 (SETQ !&CommaReadFlag!# (EQ aa '!,))
	 (RETURN (COND ((CDR rt) rt))))
	((EQ aa '!+)
	 (SETQ aa (RATOM))
	 (GO MonRead))
	((EQ aa '!-)
	 (SETQ mp (NOT mp))
	 (SETQ aa (RATOM))
	 (GO MonRead))
	((NOT (FIXP aa))
	 (SETQ kk 1)
	 (SETQ mm sm)
	 (GO VarRead)))
  (SETQ kk aa)
  (SETQ aa (RATOM))
  (SETQ mm sm)
TimesRead
  (COND ((NOT (EQ aa '!*)) (GO MonReadEnd)))
  (SETQ aa (RATOM))
VarRead
  (COND ((SETQ bb (CDR (ATSOC aa dpInVars)))
	 (COND ((EQ (SETQ aa (RATOM)) '!^)
		(SETQ cm (RATOM))
		(SETQ aa (RATOM)))
	       (T
		(RPLACD mm (NCONS bb))
		(SETQ mm (CDR mm))
		(GO TimesRead))))
	(T
	 (AlginReadErrMessage)
	 (SETQ !&CommaReadFlag!# NIL)
	 (RETURN NIL)))
  (COND ((OR (NOT (FIXP cm)) (LESSP cm 0))
	 (SETQ !&CommaReadFlag!# NIL)
	 (AlginReadErrMessage)
	 (RETURN NIL)))
WritePower
  (COND ((LESSP 0 cm)
	 (SETQ cm (SUB1 cm))
	 (RPLACD mm (NCONS bb))
	 (SETQ mm (CDR mm))
	 (GO WritePower)))
  (GO TimesRead)
MonReadEnd
	(COND (mp
	       (SETQ mp NIL)
	       (SETQ kk (MINUS kk))))
	(COND ((SETQ kk (InCoeff2RedandCoeff kk))
	       (TermInsert (CONS kk
				 (COND ((CDR sm) (MONINTERN (CDR sm)))
				       (T (MonIntern1 (NCONS 0)))))
			   rt)))
	(RPLACD sm NIL)
	(GO MonRead) ))

%  2004-04-28: Two changes in case of error: Read and discard
% the rest of the line; and if an alert channel is open, alert
% it of the number of so skipped characters and of the error,
% but do not create an error outside the ERRORSET./JoeB

%# ALGFORMINPUT () : bool ;
(DE ALGFORMINPUT ()
 (PROG	(save!-raise err!-result chars!-left old!-out!-chan)
	(SETQ save!-raise !*RAISE)
	(OFF RAISE) 
	(SETQ err!-result (ERRORSET '(UnRaisedAlgIn NIL) NIL NIL))
	(COND (save!-raise (ON RAISE))
	      (T (OFF RAISE)) )
	(COND ((ATOM err!-result)
	       (SETQ chars!-left (READTOEOL))
	       (COND ((GETALERTCHAN)
		      (FILEALERT (CONSTANTLIST2STRING (LIST chars!-left
							    "skipped;"
							    EMSG!*))
				 'MAYBE)
		      (RETURN err!-result))
		     (T
		      (PRIN2 "***** ") (PRIN2 chars!-left) (PRIN2 " skipped;")
		      (ERROR err!-result EMSG!*)))))
	(RETURN (CAR err!-result)) ))

%# ADDALGFORMINPUT () : bool ;
(DE ADDALGFORMINPUT ()
 (PROG	(save!-raise err!-result chars!-left old!-out!-chan)
	(SETQ save!-raise !*RAISE)
	(OFF RAISE) 
	(SETQ err!-result (ERRORSET '(UnRaisedAlgIn T) NIL NIL))
	(COND (save!-raise (ON RAISE))
	      (T (OFF RAISE)) )
	(COND ((ATOM err!-result)
	       (SETQ chars!-left (READTOEOL))
	       (COND ((GETALERTCHAN)
		      (FILEALERT (CONSTANTLIST2STRING (LIST chars!-left
							    "skipped;"
							    EMSG!*))
				 'MAYBE)
		      (RETURN err!-result))
		     (T
		      (PRIN2 "***** ") (PRIN2 chars!-left) (PRIN2 " skipped;")
		      (ERROR err!-result EMSG!*)))))
	(RETURN (CAR err!-result)) ))

%# UnRaisedAlgIn (bool) : bool ;
(DE UnRaisedAlgIn (Add)
(PROG (aa np ll CURRENTSCANTABLE!* PROMPTSTRING!*
	    !*RAISE !&CommaReadFlag!#)
	(SETPROMPT "algebraic form input> ")
	(SETQ CURRENTSCANTABLE!* ALGINSCANTABLE!*)
	(COND ((NOT !*!&NoRaiseAlgInp!#)
	       (ON RAISE)))
  InitL	(COND ((MEMQ (SETQ aa (RATOM)) AlginEnders)
	       (RETURN NIL))
	      ((MEMQ aa AlgVarInKeywords)
	       (AlginVarsRead)
	       (GO InitL)))
  ML	(COND ((Pol!? (SETQ np (PolAlgRead aa)))
	       (SETQ ll (CONS np ll))))
	(COND (!&CommaReadFlag!#
	       (SETQ aa (RATOM))
	       (GO ML))
	      (ll
	       (SETQ InPols
		     (SortlPol (COND (Add (APPEND (DEGORITEMLIST2LIST  InPols)
						  ll))
				     (T ll))))
	       (RETURN T))) ))

(DE REDANDALGIN ()
 (PROG (save!-raise err!-result)
  (SETQ save!-raise !*RAISE)
  (OFF RAISE) 
  (SETQ err!-result (ERRORSET '(UnRaisedRedandAlgIn) NIL NIL))
  (COND (save!-raise (ON RAISE))
        (T (OFF RAISE)) )
  (RETURN (COND ((ATOM err!-result) (ERROR err!-result EMSG!*))
		(T (CAR err!-result)))) ))

(DE UnRaisedRedandAlgIn ()
 (PROG	(rt CURRENTSCANTABLE!* PROMPTSTRING!*
	 !*RAISE !&CommaReadFlag!#)
	(SETPROMPT "algebraic form input> ")
	(SETQ CURRENTSCANTABLE!* ALGINSCANTABLE!*)
	(COND ((NOT !*!&NoRaiseAlgInp!#)
	       (ON RAISE)))
	(SETQ rt (PolAlgRead (RATOM)))
	(COND (!&CommaReadFlag!#
	       (PRIN2
"*** Bad polynomial input ender (,) accepted under protest.")))
	(RETURN rt) ))

% The commutative case is default:

(COPYD 'PolAlgRead 'commPolAlgRead)

(DE AlginVarsRead ()
 (PROG	(AA BB RT)
	(SETQ BB (SETQ RT (NCONS (RATOM))))
	Ml
	(COND ((EQ (SETQ AA (READCHAR)) 44)
	       (RPLACD BB (NCONS (RATOM)))
	       (SETQ BB (CDR BB))
	       (GO Ml))
	      ((EQ (GETV ALGINSCANTABLE!* AA) 17)
	       (GO Ml))
	      ((NOT (MEMQ AA '(59 58))) (UNREADCHAR AA)))
	(SETIOVARS RT) ))

%(DE AlginReadErrMessage NIL
% (PROGN
%  (CONTINUABLEERROR)
%  (PRIN2 "*** Error in the Algin Reader;
%*** an end-of-read token is simulated,
%*** and LISP reading is resumed.") ))

(DE AlginReadErrMessage NIL
 (PROGN
  (ERROR 99 "*** Error in the Algin Reader;
*** an end-of-read token is simulated,
*** and LISP reading is resumed.") ))


(ON RAISE)
(OFF EOLINSTRINGOK)

