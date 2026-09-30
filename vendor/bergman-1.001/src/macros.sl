%%
%  General macros.

%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%
%% Copyright (C) 1992,1994,1995,1996,1997,1998,2003,2004,2005
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

%  Added VarIndex2Weight./JoeB 2006-08-11

%  Added GetNextTwW, GetFormerTwW./JoeB 2005-06-25.

%  Brought DefineSWLHFEXPR, DefineGSSF, and CheckWarning here,
% from modes.sl./JoeB 2005-02-04

%  Changed !*!&WeightsList!#, !*!&WeightsDPList!# to
%  !$!&WeightsList!#!*, !$!&WeightsDPList!#!*./JoeB 2004-04-30

%  Added NonCommP, CommP, InVarNo, and the corresponding
% variables./JoeB, August 2003

%  Employ OFF and ON on the switch RAISE./JoeB 2001-08-14

%  Added !*!&WeightsList!#, !*!&WeightsDPList!#./JoeB 1999-11-17

%  Added ReplacePolTail./JoeB 1998-03-27

%  Removed ratcoeff's handling macros, except QPol2Lm./JoeB 1997-02-14

%  Added types. Added ratcoeff's handling macros./JoeB 1996-08-06

(OFF RAISE)

(FLUID '(!$!&WeightsList!#!* !$!&WeightsDPList!#!*))

(GLOBAL '(!*!#NonCommutativity!# !&!*InnerInVarNo!&!*))

% This file should collect all GENERAL macros used in the source files.
% (However, the lisp-extensions are in 'slext'.)
% The file might be replaced e.g. in a Common Lisp version.

% char2.sl, 'coeff', 'logodd', 'odd', 'reduct'   contain SPECIFIC macros.
% When hseries.sl is compiled, hmacro.sl should be loaded.
% Similarly, there is a specific anick macro file and several
% stagger ones. In either case, this file and slext must also be loaded
% at compile time.


% Main types:
% APol (augmented polynomial, augpol);
% PPol (pure polynomial, purepol);
% Mon  (augmented monomial, augmon)
% Tm   (term = monmial-with-coefficient, cfmon)
% Cf   (Coefficient, coeff);
% Lm   (Leading monomial (augmon));
% Lt   (Leading term (cfmon));
% Lcf  (Leading coefficient (coeff));
% redPriority (reduction priority (of a gbe), polhead.polpriority);
% PMon (Pure Monomial = exponent/index 'vector' in comm./noncomm. case, puremon);
% Mpt  (Monomial pointer, any)
% Mplst (Monomial property list, any)
% Maplst (Monomial augmented property list, any)

% TwW (Two-way list, twwlist)

% RtCf (Rational coefficient, ratcoeff)

% The transitions be made explicitly like xx2yy ("xx to yy"), except
% when taking an 'obvious child' in the implicit tree structure of
% types. Thus PPol = APol2PPol, Lt = PPol2Lt; Lc = PPol2Lc, since
% Cf = Tm2Cf.

%# Cf (cfmon) : coeff ;
(DM Cf (rrg) (CONS 'CAR (CDR rrg)))
%# Mon (cfmon) : augmon ;
(DM Mon (rrg) (CONS 'CDR (CDR rrg)))
%# Mon!? (any) : bool ;
(DM Mon!? (rrg) (CONS 'PAIRP (CDR rrg)))
%# PMon (augmon) : puremon ;
(DM PMon (rrg) (CONS 'CDR (CDR rrg)))
%# Mpt (augmon) : any ;
(DM Mpt (rrg) (CONS 'CAAR (CDR rrg)))
%# Mpt!? (any) : bool ;
(DM Mpt!? (rrg) (CONS 'CAAR (CDR rrg)))
%# Mon!= (augmon, augmon) : bool ;
(DM Mon!= (rrg) (CONS 'EQ (CDR rrg)))
%# Mplst (augmon) : any ;
(DM Mplst (rrg) (CONS 'CDAR (CDR rrg)))
%# Maplst (augmon) : any ;
(DM Maplst (rrg) (CONS 'CAR (CDR rrg)))
%# ClearMplst (augmon) : - ;
(DM ClearMplst (rrg) (LIST 'RPLACD (CONS 'Maplst (CDR rrg)) NIL))
%# mkAPol () : augpol ;
(DM mkAPol (rrg) (LIST 'CONS 'NIL 'NIL))
%# PPol (augpol) : purepol ;
(DM PPol (rrg) (CONS 'CDR (CDR rrg)))
%# PPol!? (augpol) : bool ;
(DM PPol!? (rrg) (CONS 'CDR (CDR rrg)))
%# Pol!? (genpurepol) : bool ;
(DM Pol!? (rrg) (CADR rrg))
%# redPriority (augpol) : polpriority ;
(DM redPriority (rrg) (CONS 'CAR (CDR rrg)))

%# Lt (purepol) : cfmon ;
(DM Lt (rrg) (CONS 'CAR (CDR rrg)))
%# Lc (purepol) : coeff ;
(DM Lc (rrg) (CONS 'CAAR (CDR rrg)))
%# Lm (purepol) : augmon ;
(DM Lm (rrg) (CONS 'CDAR (CDR rrg)))
%# Lpmon (purepol) : puremon ;
(DM Lpmon (rrg) (CONS 'CDDAR (CDR rrg)))
%# APol2Lt (augpol) : cfmon ;
(DM APol2Lt (rrg) (CONS 'CADR (CDR rrg)))
%# APol2Lc (augpol) : coeff ;
(DM APol2Lc (rrg) (CONS 'CAADR (CDR rrg)))
%# APol2Lm (augpol) : augmon ;
(DM APol2Lm (rrg) (CONS 'CDADR (CDR rrg)))
% In order to get around a minor compiler bug, don't use eg CDDADR:
%# APol2Lpmon (augpol) : puremon ;
(DM APol2Lpmon (rrg) (LIST 'CDDR (CONS 'CADR (CDR rrg))))
%# APol0!? (genaugpol) : bool ;
(DM APol0!? (rrg) (CONS 'NULL (CDR rrg)))
%# PPol0!? (augpol) : bool ;
(DM PPol0!? (rrg) (LIST 'NULL (CONS 'PPol (CDR rrg))))
%# Pol0!? (purepol) : bool ;
(DM Pol0!? (rrg) (CONS 'NOT (CDR rrg)))
%# CopyPPol (purepol) : purepol ;
(DM CopyPPol (rrg) (CONS 'DPLISTCOPY (CDR rrg)))
%# Tm2PMon (cfmon) : puremon ;
(DM Tm2PMon (rrg) (CONS 'CDDR (CDR rrg)))
%# PMon2NewMon (puremon) : augmon ;
(DM PMon2NewMon (rrg) (LIST 'CONS '(CONS NIL NIL) (CADR rrg)))
%# Cf!&Mon2Tm (coeff, augmon) : cfmon ;
(DM Cf!&Mon2Tm (rrg) (CONS 'CONS (CDR rrg)))
%# Tm2Pol (cfmon) : purepol ;
(DM Tm2Pol (rrg) (LIST 'CONS (CADR rrg) NIL))
%# Cf!&Mon2Pol (coeff, augmon) : purepol ;
(DM Cf!&Mon2Pol (rrg) (LIST 'Tm2Pol (CONS 'Cf!&Mon2Tm (CDR rrg))))
%# PolTail (purepol) : genpurepol ;
(DM PolTail (rrg) (CONS 'CDR (CDR rrg))) 
%  MUST be a macro; assigns new value to its argument, which should
%  be a variable name whose value is a purepol.
%# PolDecap (&purepol) : genpurepol ; MACRO
(DM PolDecap (rrg) (LIST 'SETQ (CADR rrg) (CONS 'CDR (CDR rrg))))
%# PutredPriority (augpol, polpriority) : - ;
(DM PutredPriority (rrg) (CONS 'RPLACA (CDR rrg)))
%# PutCf (cfmon, coeff) : - ;
(DM PutCf (rrg) (CONS 'RPLACA (CDR rrg)))
%# PutMon (cfmon, augmon) : - ;
(DM PutMon (rrg) (CONS 'RPLACD (CDR rrg)))
%# ConcPol (purepol, purepol) : - ;
(DM ConcPol (rrg) (CONS 'RPLACD (CDR rrg)))
%# ReplacePolTail (purepol, purepol) : - ;
(DM ReplacePolTail (rrg) (CONS 'RPLACD (CDR rrg)))
%# PutMpt (augmon, any) : - ;
(DM PutMpt (rrg) (LIST 'RPLACA (LIST 'CAR (CADR rrg)) (CADDR rrg)))
%# PutLc (puremon, coeff) : - ;
(DM PutLc (rrg) (LIST 'RPLACA (LIST 'CAR (CADR rrg)) (CADDR rrg)))
%# RemoveNextTm (pol) : - ;
(DM RemoveNextTm (rrg)
    (LIST 'RPLACD (CADR rrg) (CONS 'CDDR (CDR rrg))))

%# InsertTm (pol) : redandposition ;
(DM InsertTm (rrg)
    (LIST 'RPLACD
	  (CADR rrg)
	  (LIST 'CONS (CADDR rrg) (LIST 'CDR (CADR rrg)))))
%# LastTmPos (purepol) : purepol ;
(DM LastTmPos (rrg) (CONS 'LASTPAIR (CDR rrg)))
%# SelfPointingMon (augmon) : bool ;
(DM SelfPointingMon (rrg)
    (LIST 'AND
	  (LIST 'PAIRP (CONS 'Mpt (CDR rrg)))
	  (LIST 'PAIRP (LIST 'CDR (CONS 'Mpt (CDR rrg))))
	  (LIST 'PAIRP (LIST 'CADR (CONS 'Mpt (CDR rrg))))
	  (LIST 'EQ (LIST 'CDADR (CONS 'Mpt (CDR rrg))) (CADR rrg))))

% Monomial interning manipulation macros:

%# MonIntPrecedence (monint, monint) : bool ;
(DM MonIntPrecedence (rrg) (CONS 'BMI!< (CDR rrg)))
%# InVarNo () : int ;
(DM InVarNo (rrg) (QUOTE !&!*InnerInVarNo!&!*))

% Weight lists macros:

%# Weights () : any ;
(DM Weights (rrg) (QUOTE !$!&WeightsList!#!*))
%# dpWeights () : any ;
(DM dpWeights (rrg) (QUOTE !$!&WeightsDPList!#!*))
%# VarIndex2Weight (varno) : degree ;
(DM VarIndex2Weight (rrg)
 (LIST 'CDR (LIST 'ATSOC (CADR rrg) (QUOTE !$!&WeightsDPList!#!*))))

% TwoWay list and tree handling macros.

%# PutTwW (twwlist, any) : - ;
(DM PutTwW (rrg)
    (LIST 'RPLACA (LIST 'CAR (CADR rrg)) (CADDR rrg)))
%# GetTwW (twwlist) : any ;
(DM GetTwW (rrg) (CONS 'CAAR (CDR rrg)))
%# LongerTwW (twwlist) : bool ;
(DM LongerTwW (rrg) (CONS 'CDR (CDR rrg)))
%# NextTwW (twwlist) : twwlist ;
(DM NextTwW (rrg) (CONS 'CDR (CDR rrg)))
%# GetNextTwW (twwlist) : any ;
(DM GetNextTwW (rrg) (CONS 'CAADR (CDR rrg)))
%# FormerTwW (twwlist) : twwlist ;
(DM FormerTwW (rrg) (CONS 'CDAR (CDR rrg)))
%# GetFormerTwW (twwlist) : any ;
(DM GetFormerTwW (rrg) (CONS 'CAADAR (CDR rrg)))
%# SubNode (twwlist) : twwlist ;
(DM SubNode (rrg) (CONS 'CADR (CDR rrg)))
%# PushTwW (twwlist) : twwlist ;
(DM PushTwW (rrg) (LIST 'SETQ (CADR rrg) (CONS 'CDR (CDR rrg))))
%# PushTwW!&Tree (any) : any ; ???
(DM PushTwW!&Tree (rrg)			% Testing implied progn in macro.
 (LIST 'PROGN
       (LIST 'RPLACA (CONS 'CADR (CDR rrg))
	     (LIST 'CADR (CONS 'CAAR (CDR rrg))))
       (LIST 'SETQ (CADR rrg) (CONS 'CDR (CDR rrg))) ))
%# PopTwW (any) : any ; ???
(DM PopTwW (rrg) (LIST 'SETQ (CADR rrg) (CONS 'CDAR (CDR rrg))))
%# LongerTreeNode!@TwW (twwlist) : bool ;
(DM LongerTreeNode!@TwW (rrg) (CONS 'CDAAR (CDR rrg)))
%# MvTreeNode!@TwW (any, ...) : any ; ???
(DM MvTreeNode!@TwW (rrg)
    (LIST 'RPLACA (CONS 'CAR (CDR rrg)) (CONS 'CDAAR (CDR rrg))))
%# MakeTreeNode (any, ...) : any ; ???
(DM MakeTreeNode (rrg) (CONS 'NCONS (CDR rrg)))

%# InsertBeforeTwW (twwlist, any) : - ;
(DM InsertBeforeTwW (rrg)
 (LIST 'PROGN
       (LIST 'RPLACD
	     (CONS 'FormerTwW (CDR rrg))
	     (LIST 'CONS (LIST 'CONS NIL (CONS 'FormerTwW (CDR rrg)))
			 (CADR rrg)))
       (LIST 'RPLACD
	     (CONS 'CAR (CDR rrg))
	     (CONS 'CDDAR (CDR rrg)))))


%  Rational coefficients general macros.

%# QPol2Lm (qpol) : augmon ;
(DM QPol2Lm (rrg) (CONS 'CDADR (CDR rrg)))

%%%%	'Template like' macros for function definitions and	%%%%
%%%%	 similar applications.					%%%%

%  A macro for defining an FEXPR, which calls SetWithList!&Help with
% its own name as first argument.

%# DefineSWLHFEXPR (u) : - ; MACRO
(DM DefineSWLHFEXPR (u)
 (LIST 'DF (CADR u) '(clause)
       (CONS 'SetWithLists!&Help
	     (CONS (LIST 'QUOTE (CADR u)) (CONS 'clause (CDDR u))))) )

%  A macro for defining one 'setting' and one 'getting' procedure,
% SET<name> and GET<name> respectively, such that GET<name> returns
% the value of <switch>, while SET<name> returns the old <switch>
% value, but also assigns a new value, by means of OFF or ON.

%  Should the SET variant rather be an FEXPR?

%  Acronym: Get and Set for Switch Flipping.

%# DefineGSSF (u) : - ; MACRO
(DM DefineGSSF (u)
 (LIST 'PROGN
       (LIST 'DE
	     (APPENDLCHARTOID '(G E T) (CADR u))
	     NIL
	     (LIST 'PROGN (APPENDLCHARTOID '(!*) (CADDR  u))))
       (LIST 'DE
	     (APPENDLCHARTOID '(S E T) (CADR u))
	     (NCONS 'bool)
	     (LIST 'PROG
		   (NCONS 'rt)
		   (LIST 'SETQ 'rt (NCONS (APPENDLCHARTOID '(G E T) (CADR u))))
		   (LIST 'COND
			 (LIST 'bool (CONS 'ON (CDDR u)))
			 (LIST T (CONS 'OFF (CDDR u))))
		   (LIST 'RETURN 'rt)))) )


% Mode changing defining procedures macros.

% A mode changing auxiliary macro, with a compile time syntax check:

%  CheckWarning issues a warning that the check failed, if the
% fluid variable !*!#CheckFailInform has a non-NIL value. Its
% argument must be a list of evaluable items; the values are printed.
% ("Type EVAL, NOSPREAD" in Standard Lisp Report terminology.)

%# CheckWarning (lany) : boolean ; MACRO
(DM CheckWarning (u)
 (PROG	(ip rt)
	(COND ((NOT (LISTP u))
	       (TERPRI)
	       (PRIN2 "*** Bad input ")
	       (PRIN2 (CDR u))
	       (PRIN2 " to CheckWarning.")
	       (TERPRI)
	       (PRIN2 "*** The call is replaced by ")
	       (PRIN2 NIL)
	       (PRIN2 ".")
	       (TERPRI)
	       (RETURN NIL)))
	(SETQ ip (REVERSE (CONS 'TERPRI (CDR u))))
	(SETQ rt '((TERPRI) T))
  Ml	(COND ((EQ (CAR ip) 'TERPRI)
	       (SETQ rt
		     (CONS '(TERPRI)
			   (CONS '(PRIN2 "*** ") rt))))
	      (T
	       (SETQ rt
		     (CONS (LIST 'PRIN2 (CAR ip)) rt))))
	(COND ((SETQ ip (CDR ip))
	       (GO Ml)))
	(RETURN (LIST
		 'COND
		 (CONS '!*!#CheckFailInform rt))) ))


%  Other mode (setup) checking macros:

%# CommP () ; bool ;
(DM CommP (rrg) (LIST 'NOT (QUOTE !*!#NonCommutativity!#)))
%# NonCommP () ; bool ;
(DM NonCommP (rrg) (QUOTE !*!#NonCommutativity!#))

(ON RAISE)
