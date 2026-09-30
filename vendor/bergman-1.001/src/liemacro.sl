%  Internal Lie monomial handling macros. (Only to be used in
%  the compilation of liemonom.sl.)

%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%
%% Copyright (C) 2000 Joergen Backelin
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


%	Created 2000-08-07.


%	CHANGES:


(OFF RAISE)

(GLOBAL '(bml!#OddVars

))

(FLUID '(

))


% Lie monomials could appear in different forms. Here, we assume the
% internal representation to be roughly of the Lindon-Shirshov type,
% with modifications for super Lie algebras demand of squares. The
% precise terminology we use is:
% Lie monomial ::= <negated>|<normal>
% normal ::= <proper>|<improper>
%	 ( = <simple>|<composit>|<square> )
% proper ::= <simple>|<proper composit>|<proper square>
% improper ::= <improper composit>|<improper square>
% composit ::= <proper composit>|<improper composit>
% proper composit ::= [<proper>,<proper>]
% improper composit ::= [<proper>,<proper>] | [<proper>,<improper>]
%					    | [<improper>,<proper>]
% square ::= <proper square>|<improper square>
% proper square ::= <proper>^(2)
% improper square ::= <improper>^(2)
% whereas a simple Lie monomial corresponds to a single variable, and
% a negated Lie monomial shoud be -1 times a normal one.
% Here [*,*] and *^(2) stands for Lie product and for "divided
% squaring", respectively; and the clauses above are subject to the
% following further restrictions:
% The argument to a `square' must be of odd parity;
% if A and B are proper Lie monomials, then the `composit' [A,B] is
% proper precisely if all the following conditions are satisfied (and
% improper else): With a = L2ncw(A) and b = L2ncw(B), ab > ba in lex
% order, and b is the longest proper right sub-word c of ab such that
% c = L2ncw(C) for some proper Lie monomial c; and if [A,B] is a
% composit or improper Lie monomial, with a and b as above, then ab
% is not less than b (lexicographically). L2ncw is defined recursively
% as the variable for a simple Lie monomial, and as L2ncw(A)L2ncw(B)
% for an improper or composit Lie monomial [A,B].

% Main types: Mon, PMon, Mpt, as usual.
% Neg (negative augmented Lie momomial)
% Norm (normal augmented Lie momomial)
% Prop (proper augmented Lie momomial)
% Simp (simple augmented Lie momomial)
% Comp (composit augmented Lie momomial)
% Sq (square augmented Lie momomial)
% PNeg, PNorm, PProp, PSimp, PComp, PSq (corresponding pure Lie
%					 monomials)
% LFac, RFac (left and right factors of a composit or improper Lie
%	      monomial, of type Mon)
% Root (the `divided square root' of a square Lie monomial, of type
%	Mon)
% Deg (ordinary total degree)
% Par (parity, i.e., the optional extra Z/(2) degree)
% Ncw (non-commutative word, the associated associative word)
% We also have regularity data (?).

% Internal representation:
% A PNorm be represented by

%	((<type> . <factor(s)>) (Deg . Par) . Ncw) ,

% where <type> is NIL for improper Lie monomials, T for simple and
% proper ones, and SQUARE for squared ones;
% <factor(s)> is NIL for simple Lie monomials, (LFac . RFac) for
% composit and improper ones, and Root for squared ones;
% Deg is a positive INUM;
% Par is NIL for even (i.e., ordinary) Lie monomials, and T for odd
% ones;
% and Ncw is represented in the ordinary non-commutative monomials
% standard way (with positive INUMS for the variables, and a trailing
% zero).

% A PNeg be represented by

%	(NIL . Norm)

% Thus it is imperative that the exported procedures operating on the
% pure part distinguish PNeg from PNorm before further operations are
% performed. In particular, a property or converter macro in general
% assumes Norm or PNorm input.

% Corresponding formal types are formed by prepending lie- to the
% lower case correspondence of the type. All the macros have the
% prefix bml- ("bergman lie").

% The specific Lie types should be subject to the following
% "automatic formal castings": Those directly derived from the
% formal definitions above; and
%	liepneg, liepnorm --> puremon
%	lieneg, lienorm --> augmon
%	liedeg --> degree
%	liepar --> bool


%  Properties:
%# bmlPNeg!? (puremon) : bool ;
%# bmlNeg!? (augmon) : bool ;
%# bmlPNorm!? (liepnorm) : bool ;
%# bmlNorm!? (lienorm) : bool ;
%# bmlPProp!? (liepnorm) : bool ;
%# bmlProp!? (lienorm) : bool ;
%# bmlPSimp!? (liepnorm) : bool ;
%# bmlSimp!? (lienorm) : bool ;
%# bmlPComp!? (liepnorm) : bool ;
%# bmlComp!? (lienorm) : bool ;
%# bmlPSq!? (liepnorm) : bool ;
%# bmlSq!? (lienorm) : bool ;

%  Converters:
%# bmlPNeg2Norm (liepneg) : lienorm ;
%# bmlNeg2Norm (lieneg) : lienorm ;
%# bmlPNeg2PNorm (liepneg) : liepnorm ;
%# bmlNeg2PNorm (lieneg) : liepnorm ;
%# bmlLFac (liepnorm) : lienorm ;
%# bmlRFac (liepnorm) : lienorm ;
%# bmlRoot  (liepnorm) : lienorm ;
%# bmlDeg (liepnorm) : liedeg ;
%# bmlPar (liepnorm) : liepar ;
%# bmlNcw (liepnorm) : liencw ;
%# bmlNorm2LFac (lienorm) : lienorm ;
%# bmlNorm2RFac (lienorm) : lienorm ;
%# bmlNorm2Root  (lienorm) : lienorm ;
%# bmlNorm2Deg (lienorm) : liedeg ;
%# bmlNorm2Par (lienorm) : liepar ;
%# bmlNorm2Ncw (lienorm) : liencw ;
%# bmlPNeg2LFac (liepneg) : lienorm ;
%# bmlPNeg2RFac (liepneg) : lienorm ;
%# bmlPNeg2Root  (liepneg) : lienorm ;
%# bmlPNeg2Deg (liepneg) : liedeg ;
%# bmlPNeg2Par (liepneg) : liepar ;
%# bmlPNeg2Ncw (liepneg) : liencw ;
%# bmlNeg2LFac (lieneg) : lienorm ;
%# bmlNeg2RFac (lieneg) : lienorm ;
%# bmlNeg2Root  (lieneg) : lienorm ;
%# bmlNeg2Deg (lieneg) : liedeg ;
%# bmlNeg2Par (lieneg) : liepar ;
%# bmlNeg2Ncw (lieneg) : liencw ;
%# blmVarNo2Par (varno) : liepar ;
(DM blmVarNo2Par (rrg) (LIST 'MEMQ (CADR rrg) 'bml!#OddVars))

%  Constructors, modifiers:

%# bmlLFac!&RFac!&Deg!&Par!&Ncw2NewPNorm
%#    (lienorm,lienorm,liedeg,liepar,liencw) : pnorm ;
%# bmlDeg!&Par!&Ncw2NewPNorm (liedeg,liepar,liencw) : pnorm ;
%# bmlPutSimpOrComp (liepnorm) : - ;
%# bmlPutSq (liepnorm) : - ;
%# bmlPutLFac (liepnorm,lienorm) : - ;
%# bmlPutRFac (liepnorm,lienorm) : - ;
%# bmlPutLFac!&RFac (liepnorm,lienorm,lienorm) : - ;
%# bmlPutRoot (liepnorm,lienorm) : - ;
%# bmlPutSQ!&Root (liepnorm,lienorm) : - ;
