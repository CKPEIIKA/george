% Lisp auxiliary procedures
%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%
%% Copyright (C) 2005 Joergen Backelin
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

%%	Created 2005-02-19.

%% Intended to contain auxiliary 'pure lisp' procedures, mainly for
%% Lisp form input and output.


%%  GENERAL PROCEDURES. When executed, only the Standard Lisp
%% procedures, and those defined in slext.sl, are assumed to be defined.
%% If a procedure is marked DESTRUCTIVE, it may modify its input
%% (which is "called by reference"; as usual; in lisp). In order to
%% safeguard against this, the Standard Lisp procedure COPY may be used.

%% Very little safeguarding is done in what follows. Wrong format input
%% may cause weird errors.  Each permutation should be a list of integers;
%% and if the length of the list is n, say, then it should have each one
% of the integers 1, 2, ..., n as a member in exactly one position.


%  Form the product of two permutations. Both permutations should be of
% the same length.

%  Meanings of PROG variables: ReTurn, Return Position

%# PERMPROD (permutation, permutation) : permutation;
(DE PERMPROD (P1 P2)
 (PROG	(RT RP)
	(COND ((NULL P2) (RETURN NIL)))
	(SETQ RP (SETQ RT (NCONS (CAR (PNTH P1 (CAR P2))))))
  Ml	(COND ((SETQ P2 (CDR P2))
	       (RPLACD RP (NCONS (CAR (PNTH P1 (CAR P2)))))
	       (SETQ RP (CDR RP))
	       (GO Ml)))
	(RETURN RT) ))


%  Permute one integer (which MUST be a member of the permutation).

%# PERMUTEINT (permutation, int) : int ;
(DE PERMUTEINT (P I) (CAR (PNTH P I)))

%  Permute each item on the list (whose members MUST be integers in
% the permutation). Destructive on the list.

%  Meaning of PROG variable: Input Position.

%# PERMUTELIST (permutation, lint) : lint ; DESTRUCTIVE
(DE PERMUTELIST (P L)
 (PROG	(IP)
	(COND ((NULL (SETQ IP L)) (RETURN NIL)))
  Ml	(RPLACA IP (PERMUTEINT P (CAR IP)))
	(COND ((SETQ IP (CDR IP)) (GO Ml)))
	(RETURN L) ))

%  Permute each monomial in an nc lisp polynomial. Destructive on
% the lisppol.

%  Meaning of PROG variable: Input Position.

%# PERMUTENCLISPPOL (permutation, lisppol) : lisppol ; DESTRUCTIVE
(DE PERMUTENCLISPPOL (P POL)
 (PROG	(IP)
	(SETQ IP POL)
  Ml	(COND ((NOT IP) (RETURN POL)))
	(PERMUTELIST P (CDAR IP))
	(SETQ IP (CDR IP))
	(GO Ml) ))


% In order to walk through all permutations of [n] := {1, 2, ..., n}:
% (Cf. e.g. the procedures in koszhom; and even more, the Alexander
% Berglund programming for his 'examensarbete'.

%  From koszhom:

%	Adds successively A2 SUCcessors to Car B1 in the beginning of B1.

%# SUC (int, lint) : lint ;
(DE SUC (A2 B2)
 (PROG	()
  ML	(COND ((ZEROP A2) (RETURN B2)))
	(SETQ A2 (SUB1 A2))
	(SETQ B2 (CONS (ADD1 (CAR B2)) B2))
	(GO ML) ))

% (E. g., (REVERSE (SUC (SUB1 N) (NCONS 1))) should yield (1 2 .... N).)


%  Rotate a list L before the 'tail part' after TP one step to the left
% (inserting  the original CAR immediately after the CAR of TP). Destructive.
%  Both arguments SHOULD be non-empty lists, and MUST be pairs.

%# ROTATE1L (lany, lany) : lany ; DESTRUCTIVE
(DE ROTATE1L (L TP) (PROGN (RPLACD TP (CONS (CAR L) (CDR TP))) (CDR L) ))


%  Reverse the part of P preceeding Q. P should be a list, and Q a
% (not necessarily proper) tail part of P.

%# REVERSEPART (lany, lany) : lany ;
(DE REVERSEPART (P Q)
 (PROG	(RT)
	(SETQ RT Q)
	Ml
	(COND ((NOT (EQ P Q))
	       (SETQ RT (CONS (CAR P) RT))
	       (SETQ P (CDR P))
	       (GO Ml)))
	(RETURN RT) ))

%  Gives the next permutation (w.r.t. an 'inverse revlex' order), if one
% exists; NIL else. The argument MUST be a non-nil permutation. Destructive.

%  ERROR: A reversal of the leftmost part (to make it as increasing as possible,
%  given the new tail), should be added.

%  Meanings of PROG variables: Raise Position; Insertion Element Position.
%# NEXTPERM (permutation) : genpermutation ; DESTRUCTIVE
(DE NEXTPERM (P)
 (PROG	(RP IEP)

	% First loop: Find the first raise, if there is one; else return NIL.
	(SETQ RP P)
	Fl
	(COND ((NULL (CDR RP))
	       (RETURN NIL))
	      ((BMI!< (CADR RP) (CAR RP))
	       (SETQ RP (CDR RP))
	       (GO Fl))

	      % Second loop (preparation): Find the element to be inserted
	      % after the first raise element: the leftmost one less than this.
	      ((BMI!< (CAR (SETQ IEP P)) (CADR RP))
	       (SETQ IEP (ROTATE1L P (CDR RP)))
	       (RETURN (REVERSEPART IEP (CDR RP)))))
	Sl
	(COND ((BMI!> (CADR IEP) (CADR RP))
	       (SETQ IEP (CDR IEP))
	       (GO Sl))
	      ((EQ (CDR IEP) RP)
	       (RPLACD IEP (ROTATE1L RP (CDR RP)))
	       (RETURN (REVERSEPART P (CDDR IEP)))))
	(RPLACD IEP (CONS (CADR RP) (ROTATE1L (CDR IEP) (CDR RP))))
	(RETURN (REVERSEPART P (CDR (RPLACD RP (CDDR RP))))) ))

%# REVERSEAPPEND (lany, lany) : lany ;
(DE REVERSEAPPEND (LIST1 LIST2)
 (PROG	()
  ML	(COND (LIST1
	       (SETQ LIST2 (CONS (CAR LIST1) LIST2))
	       (SETQ LIST1 (cdr LIST1))
	       (GO ML)))
	(RETURN LIST2) ))


 %%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%
 %								%
 %   Procedures for calculating "(i,j) partial derivatives"	%
 %   of non-commutative lisp form polynomials.			%
 %								%
 %   Fulfils  del ((i)) = - (i j) ,  del ((j)) = (j i),		%
 %   and  del(ab) = del(a)b + s(a)del(b), where s replaces	%
 %   each occurence of i with j, and vice versa.		%
 %								%
 %%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%

(FLUID '(PDERIV))

%# NCLISPPOLDERIVATIVE (varno, varno, in_form_polynomial) :
%#             in_form_polynomial ;
(DE NCLISPPOLDERIVATIVE (I J LP)
 (PROG	()
	(SETQ PDERIV NIL)
  ML	(COND (LP
	       (ADDPDERIVATIVETERMS I J (CAR LP))
	       (SETQ LP (CDR LP))
	       (GO ML)))
	(RETURN (COPY PDERIV)) ))

%# ADDPDERIVATIVETERMS (varno, varno, dpin_form_coefficientlvarno) : - ;
(DE ADDPDERIVATIVETERMS (I J LCM)
 (PROG	(PCF NCF ST)
	(SETQ NCF (MINUS (SETQ PCF (CAR LCM))))
  ML	(COND ((NOT (SETQ LCM (CDR LCM)))
	       (RETURN NIL))
	      ((EQN (CAR LCM) I)
	       (SETQ PDERIV
		     (CONS (CONS NCF
				 (REVERSEAPPEND ST (CONS I (CONS J (CDR LCM)))))
			   PDERIV)))
	      ((EQN (CAR LCM) j)
	       (SETQ PDERIV
		     (CONS (CONS PCF
				 (REVERSEAPPEND ST (CONS J (CONS I (CDR LCM)))))
			   PDERIV))))
	(SETQ ST (CONS (COND ((EQN (CAR LCM) I) J)
			     ((EQN (CAR LCM) J) I)
			     (T (CAR LCM)))
		       ST))
	(GO ML) ))

%# NCLISPPOLDERIVATIVES (in_form_polynomial) : lin_form_polynomial ;
(DE NCLISPPOLDERIVATIVES (LP)
 (PROG	(I J N RT)
	(COND ((NOT (LESSP (SETQ I 1) (SETQ N (GETVARNO))))
	       (RETURN NIL)))
  ML	(SETQ J (ADD1 I))
  SL	(SETQ RT (CONS (NCLISPPOLDERIVATIVE I J LP) RT))
	(COND ((LESSP J N)
	       (SETQ J (ADD1 J))
	       (GO SL))
	      ((LESSP (SETQ I (ADD1 I)) N)
	       (GO ML)))
	(RETURN RT) ))


%# ADDPOLPARTDERS2INPUT (in_form_polynomial) : - ;
(DE ADDPOLPARTDERS2INPUT (LP)
 (PROG	() ))

%  For extracting the leading monomials of a typical output of
% polynomials in LISP form.  Uses that only the leading terms are
% preceeded by double left parentheses.
%  Returns T if successful; NIL if input and thus output is recognised
% as bad.

%# LISPEXTRACTLEADMONS (string, string) : bool ;
(DE LISPEXTRACTLEADMONS (infile outfile)
 (PROG	(OUTCHN!# OLDOUTCHN!# C OLDINCHN!#)
	% Here, perhaps appropriate tests of input and output should be
	% inserted.
	(SETQ OLDINCHN!# (RDS (OPEN infile 'INPUT)))
	(SETQ OLDOUTCHN!# (WRS (SETQ OUTCHN!# (OPEN outfile 'OUTPUT))))
  ML	(COND ((EQ (SETQ C (READCH)) $EOF$)
	       (CLOSE (RDS OLDINCHN!#))
	       (CLOSE (WRS OLDOUTCHN!#))
	       (RETURN T))
	      ((NOT (AND (EQ C '!() (EQ (READCH) '!()))
	       (GO ML)))

	% A leading term is found. Ignore its coefficient; print the rest
	% (exept possibly a leading blank); flush the output.
	(READ)
	(PRINC '!()
	(COND ((EQ (SETQ C (READCH)) '! )
	       (SETQ C (READCH))))
  SL	(COND ((EQ C $EOF$)
	       (CLOSE (RDS OLDINCHN!#))
	       (CLOSE (WRS OLDOUTCHN!#))
	       (RETURN NIL))
	      ((EQ C '!))
	       (PRINC C)
	       (TERPRI)
	       (FLUSHCHANNEL OUTCHN!#)
	       (GO ML)))
	(PRINC C)
	(SETQ C (READCH))
	(GO SL) ))
