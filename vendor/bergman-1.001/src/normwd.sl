%  Internal 'normal word' handling in the non-commmutative case.

%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%
%% Copyright (C) 2001 Joergen Backelin
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


%	Created 2001-08-04.
% Module for the internal handling of `normal words', i.e., of
% all non-reducible monomials (of a certain given length). They will
% employ the inner structure both of monomials and of MONLIST, and
% thus may be rather different in commutative and non-commutative
% cases. Whenever this be the case, we now write a non-commutative
% version (and may denote it by the prefix nc, as usual).

(OFF RAISE)


(GLOBAL '(MONLIST niMon niMon1 GBasis cGBasis dpOutVars MAOaux
	  MONONE !*OLDPRINTMODES1 bnmLeftModuleNormalWords
	  anbnmLModNormalMonStartIndexLimits
	  anbnmLModNormalMonEndIndexLimits))
(COND ((NOT MONLIST) (SETQ MONLIST (NCONS NIL))))
(COND ((NOT MAOaux) (SETQ MAOaux (NCONS NIL))))

%  Check if the augmon is the leading monomial of a Groebner basis
% element. If so, return this; else, return NIL.

%  Employs the internal structure of an augpol.

%  In this version, an extra check is done for membership in the
% Groebner basis lists, if the pointer is found probably to be a
% Gbe. This is done in order to avoid curious effects of other
% uses of the monptr. It should be possible to avoid it, if some
% care is taken on not allowing any pointers.

%# GbeLm!? (augmon) : augredor ;

(DE GbeLm!? (amon)
 (PROG	(rt)
	(COND ((AND (PAIRP (SETQ rt (Mpt amon)))
		    (PAIRP (CDR rt))
		    (PAIRP (CADR rt))
		    (EQ (CDADR rt) amon)
		    (OR (MEMQ amon GBasis) (MEMQ amon cGBasis)))
	       (RETURN rt))) ))


%  pmon should be a puremon (representing a non-unit monomial m, and
% valid for saving as the puremon part of an augmon). All left factors
% of m (excluding 1, but including m) are tested for being Gbe's. If
% one of them is, then NIL is returned. Else, pmon is interned, and
% the corresponding augmon is returned.

%  Meaning of PROG variables: PureMon Position; MONLIST Position;
% Variable Index.

%# noncommInternIfLeftNormal (puremon) : genaugmon

(DE noncommInternIfLeftNormal (pmon)
 (PROG	(pmp mlp vi)
	(SETQ pmp pmon)
	(SETQ mlp MONLIST)
  Ml	(SETQ vi (CAR pmp))
  Rl	(COND ((OR (NOT (CDR mlp)) (BMI!< vi (CAADR mlp)))
	       (RPLACD mlp (CONS (NCONS vi) (CDR mlp))) (GO MkNew))
	      ((NOT (BMI!= vi (CAADR mlp))) (SETQ mlp (CDR mlp)) (GO Rl))
	      ((BMI!= 0 (CAR (SETQ pmp (CDR pmp))))
	       (COND ((NOT (AND (CDR (SETQ mlp (CADR mlp)))
				(BMI!= 0 (CAADR mlp))))
		      (RPLACD mlp (CONS (CONS 0 (CONS (NCONS NIL) mlp))
					(CDR mlp))))
		     ((GbeLm!? (CDADR mlp))
		      (RETURN NIL)))
	       (RETURN (CDADR mlp)))
	      ((AND (CDR (SETQ mlp (CADR mlp)))
		    (BMI!= 0 (CAADR mlp))
		    (GbeLm!? (CDADR mlp)))
	       (RETURN NIL)))
	(GO Ml)
 
  MkNew	(SETQ mlp (CADR mlp))
	(COND ((SETQ pmp (CDR pmp))
	       (RPLACD mlp (NCONS (NCONS (CAR pmp))))
	       (GO MkNew)))
	(RPLACD mlp (CONS (NCONS NIL) pmon))
	(RETURN (CDR mlp)) ))


%  Depending on the object type mode, there maay be restrictions on
% which of the potentially possibe normal words actually to construct.
% There should be rich possibilities to handle this; whence the input
% procedures should be FEXPRs.
%  Meaning of PROG variables: Lower Limit, Higher Limit (inclusive).

%# SETLMODNORMALMONSTARTS (any) : - ; FEXPR
(DF SETLMODNORMALMONSTARTS (ints)
 (PROG	(ll hl)
	(COND ((OR (NOT (PAIRP ints))
		   (NOT (PAIRP (CDR ints)))
		   (NOT (FIXP (SETQ ll (EVAL (CAR ints)))))
		   (NOT (FIXP (SETQ hl (EVAL (CADR ints)))))
		   (LESSP hl ll)
		   (LESSP ll 0))
	       (ERROR 99 ints " bad input to SETLMODNORMALMONSTARTS")))
	(SETQ anbnmLModNormalMonStartIndexLimits (CONS ll hl)) ))

%# SETLMODNORMALMONENDS (any) : - ; FEXPR
(DF SETLMODNORMALMONENDS (ints)
 (PROG	(ll hl)
	(COND ((OR (NOT (PAIRP ints))
		   (NOT (PAIRP (CDR ints)))
		   (NOT (FIXP (SETQ ll (EVAL (CAR ints)))))
		   (NOT (FIXP (SETQ hl (EVAL (CADR ints)))))
		   (LESSP hl ll)
		   (LESSP ll 0))
	       (ERROR 99 ints " bad input to SETLMODNORMALMONENDS")))
	(SETQ anbnmLModNormalMonEndIndexLimits (CONS ll hl)) ))



%  Out of a degree, a degree-list of normals words, and index
% limits, this procedure produces a new set of normal words,
% corresponding to products v * m, where v is a variable with
% index within the bounds, and m is an old normal word. If no
% such words are found, NIL is returned; else, a sorted list
% of such words, prepended by the degree.

%  In this variant, the degree limits are represented by a
% dotted pair (degno1 . degno2), such that the permissible indices
% should be deg1+1, deg1+2, ..., deg2.
%  Meaning of PROG variables: Variable Index; Variable Limit;
% input List of Normal words, Input normal word list Position,
% output Normal Word, ReTurn value, Return value Position.

%# noncommordweightsNormalWords (degno, dlaugmon, any) : augmon ;
(DE noncommordweightsNormalWords (deg nwds lmt)
 (PROG	(vi vl ln ip nw rt rp)
	(SETQ vi (SUB1 (CAR lmt)))
	(SETQ vl (CDR lmt))
	(COND ((NOT (AND (BMI!< vi vl)
			 (SETQ ln (ATSOC (SUB1 deg) nwds))))
	       (RETURN NIL)))
	(SETQ ln (CDR ln))
	(SETQ rp (SETQ rt (NCONS deg)))
  Ml	(SETQ vi (ADD1 vi))
	(SETQ ip ln)
  Sl	(COND ((SETQ nw
		     (noncommInternIfLeftNormal (CONS vi (PMon (CAR ip)))))
	       (RPLACD rp (NCONS nw))
	       (SETQ rp (CDR rp))))
	(COND ((SETQ ip (CDR ip))
	       (GO Sl))
	      ((BMI!< vi vl)
	       (GO Ml))
	      ((CDR rt)
	       (RETURN rt))) ))


%%  Create a list consisting of all dotted pairs with CAR's from
%% the first argument list, and CDR's from the second.
%%  The pairs are ordered LEX with respect to the orders of the
%% input lists.
%
%%  The following might lead to trouble in some un-lispish lisps,
%% who do not treat lambda expressions as functions (!!!!)
%
%%# SETPRODUCT (lany, lany) : ldpany ;
%(DE SETPRODUCT (list1 list2)
% (COND	((NOT (LISTP list1))
%	 (ERROR 99 "Bad argument to SETPRODUCT: " list1 " not a list"))
%	((NOT (LISTP list2))
%	 (ERROR 99 "Bad argument to SETPRODUCT: " list2 " not a list"))
%	(T
%	 (MAPCAN list1
%		 (FUNCTION (LAMBDA (u1)
%				   (MAPCAR list2
%					   (FUNCTION (LAMBDA (u2)
%							     (CONS u1
%								   u2))))))))) )


%  A slightly more sofisticated variant, where searching the list should
% be facilitated. However, no attempt at preserving orders.
%  Changes its last two arguments as main effect. Returns the number of
% new items on the list lresult.

%# XSETPRODUCT (lany, lany, augldpany, augldpany) : int ;
(DE XSETPRODUCT (list1 list2 laccess lresult)
 (PROG	(ip1 itm ip2 no)
	(SETQ ip1 list1)
	(SETQ no 0)
  Ml	(SETQ itm (CAR ip1))
	(SETQ ip2 list2)
	(SETQ no (ADD1 no))
  Sl	(RPLACD lresult (CONS (CONS (CAR ip2) itm) (CDR lresult)))
	(COND ((SETQ ip2 (CDR ip2))
	       (GO Sl)))
	(RPLACD laccess (CONS (CONS itm (CDR lresult)) (CDR laccess)))
	(COND ((SETQ ip1 (CDR ip1))
	       (GO Ml)))
	(RETURN (TIMES no (LENGTH list2))) ))

%# INTERNPAIR (any, any, l(any.ldpany)) : dpany ; Unsafe
(DE INTERNPAIR (itm1 itm2 laccess) (ATSOC itm2 (CDR (ATSOC itm1 laccess))) )



(ON RAISE)
