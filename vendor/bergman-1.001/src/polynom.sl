%  General polynomial routines (not characteristic dependent but
% using internal polynomial structure).
%  Should be compiled/loaded ("linked") BEFORE characteristic
% dependent routines files.

%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%
%% Copyright (C) 1994,1995,1996,1997,1998 Joergen Backelin
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


(OFF RAISE)

% CHANGES:

% Added READPOL, REDUCEPOL, HREDUCEPOL, PRINTQPOLS, WRITEPOL,
% READTONORMALFORM, AFTERRABBIT, all of which, but the last one,
% handle polynomial by means of the property SAVEREDAND of
% some identifiers./VU, SK 2003-08-28


%  TermInsert now handles also terms with coinciding monomials.
% /JoeB 1998-07-05

%  Improved documentation; introduced typing; added QPOLMONMULT;
% corrected augredand to augredor in REDANDMONMULT./JoeB 1997-02-14

%  Made SubtractRedor non-returning./JoeB 1996-07-04

%  Brought TermInsert from monom.sl.  Added REDANDMONMULT.
%  Improved OrdinaryConcPolMonMult argument name mnemonics./JoeB 1996-06-21

% CREATED 1994-11-14 from part of the old (version 0.8) groebreductions.sl.


% Import: MonTimes, SubtractRedor1, MONLESSP, MONTIMES2, Num!&Den2QPol,
%	  PolNum, PolDen.
% Export: OrdinaryConcPolMonMult, SubtractRedor, TermInsert, AFTERRABBI.

% Available: REDANDMONMULT, QPOLMONMULT, REDAND2QPOL.
%	     READPOL, REDUCEPOL, HREDUCEPOL, PRINTQPOLS, WRITEPOL,
%	     READTONORMALFORM

% POLYNOMIAL ARITHMETICS ROUTINES. Most of them physically changes one
% argument, the redand. Some of them have rather arbitrary outputs, which
% should not be used! "Returns." below is short for "Returns what the
% mnemonic name indicates." No return indication = undefined output.


%	Changes returnstart by concatenating monquot*ppol (which may mean
%	monquot1*pol*monquot1). ppol may be a pure reductand or reductor
%	polynomial; returnstart should be the position of the last pair
%	in a polynomial of the same kind.

%# OrdinaryConcPolMonMult (purepol??position??, purepol, monquot) : - ;
(DE OrdinaryConcPolMonMult (returnstart ppol monquot)
 (PROG	(aa bb)
	(SETQ aa ppol)
	(SETQ bb returnstart)
  Ml	(ConcPol bb (Cf!&Mon2Pol (Lc aa) (MonTimes (Lpmon aa) monquot)))
	(COND ((PolDecap aa) (PolDecap bb) (GO Ml)))
 ))


%	Changes augredor.
%	cPol ("current polynomial") is to be reduced by, if its LeadMon augmon
%	is found on augredor. (cPol must be a Gbe, so that Mpt(augmon)=cPol.)

%# SubtractRedor (augredor, augmon) : - ;
(DE SubtractRedor (augredor augmon)
 (PROG	(aa)
	(SETQ aa augredor)
  Ml	(COND ((Mon!= (Lm (PolTail aa)) augmon)
	       (RETURN (SubtractRedor1 augredor aa (PPol (Mpt augmon)))))
	      ((AND (MONLESSP (PMon augmon) (Lpmon (PolTail aa)))
		   (Pol!? (PolTail (PolDecap aa))))
	       (GO Ml)))
 ))



%  Insert a coefficient-monomial (term) in decreasing order.
% 98-07-05: Should now work for Mon(cfmon) equal to occurring one;
%	    whence error check removed)/JoeB

%# TermInsert (redandterm, augredand) : redandposition ;
(DE TermInsert (cfmon augpol)
 (PROG	(aa bb)
	(SETQ aa (Tm2PMon cfmon))
	(SETQ bb augpol)
  Ml	(COND ((Pol0? (PolTail bb))
	       (RETURN (ConcPol bb (Tm2Pol cfmon))))
	      ((Mon!= (Lm (PolTail bb)) (Mon cfmon))
	       (COND ((SETQ aa (REDANDCF!+ (Cf cfmon) (Lc (PolTail bb))))
		      (PutLc (PolTail bb) aa))
		     (T
		      (RemoveNextTm bb)))
	       (RETURN bb))
	      ((MONLESSP aa (Lpmon (PolTail bb)))
	       (PolDecap bb)
	       (GO Ml)))
	(RETURN (InsertTm bb cfmon)) ))


%	Returns the product of augredand and pmon (in this order).
%	Non-destructive.
%	Meaning of prog variables: Return; Return position;
%	Input position.

%# REDANDMONMULT (augredand, puremon) : augredand ;
(DE REDANDMONMULT (augredand pmon)
 (PROG	(rt rp ip)
	(SETQ rp (SETQ rt (mkAPol)))
	(SETQ ip (PPol augredand))
	Ml
	(ConcPol rp (Cf!&Mon2Pol (Lc ip)
				 (MONTIMES2 (Lpmon ip) pmon)))
	(COND ((PolDecap ip)
	       (PolDecap rp)
	       (GO Ml)))
	(RETURN rt) ))


%	Returns the product of qpol and puremon (in this order).
%	Non-destructive.
%	Meaning of prog variables: Return; Return position;
%	Input position.

%# QPOLMONMULT (qpol, puremon) : qpol ;
(DE QPOLMONMULT (qpol pmon)
 (PROG	(rt rp ip)
	(SETQ rp (SETQ rt (Num!&Den2QPol (PolNum qpol) (PolDen qpol))))
	(SETQ ip (PPol qpol))
  Ml	(ConcPol rp (Cf!&Mon2Pol (Lc ip)
				 (MONTIMES2 (Lpmon ip) pmon)))
	(COND ((PolDecap ip)
	       (PolDecap rp)
	       (GO Ml)))
	(RETURN rt) ))


%  Not so smart procedure. We might wish to extract the content in some
% coefficient modes. Highly modularised, though.
%# REDAND2QPOL (redand) : qpol ;
(DE REDAND2QPOL (augpol)
 (PROG	(rt)
	(SETQ rt (Num!&Den2QPol REDANDCOEFFONE REDANDCOEFFONE))
	(ConcPol rt (CopyPPol (PPol augpol)))
	(RETURN rt) ))


% Procedures to deal with on screen reduction VU,SK 27.08-03 %
% To avoid the priniting the value is saved as a property list

%reading from the input, result as a property list in redand form
%can read several polynomialas separated by ;

%# READPOL (uip) : - ; FEXPR
(DF READPOL (ids)
 (PROG (id)
       (SETQ  id ids)
       (COND((NOT (IDP (CAR id)))
	      (ERROR 0 "Bad input to assignread")))
 L     (PUT   (CAR id) 'SAVEREDAND (REDANDALGIN))
       (SETQ id (CDR id))
       (COND ((NOT (NULL id))(GO L)))
       (RETURN T)
 ))


%print the previous

%# WRITEPOL (uip) : bool ; FEXPR
(DF WRITEPOL (id1)
 (PROG (aa)
       (COND ((SETQ aa (GET (CAR id1) 'SAVEREDAND))
	      (REDANDALGOUT aa))
	     (T
	      (PRIN2 "0, ")))
       (RETURN T)
 ))

%reduce one polynomial in redand form  to another as q-polynomial

%# REDUCEPOL (uip) : bool ; FEXPR
(DF REDUCEPOL  (ids)
 (PROG ()
       (COND ((NOT
	       (AND (PAIRP ids) (IDP (CAR ids))
		    (PAIRP (CDR ids))
		    (IDP (CADR ids))))
	      (ERROR 0 "Bad input to reducepol")))
       (PUT  (CADR ids)
	     'SAVEREDAND
	     (NORMALFORM (REDAND2QPOL (GET (CAR ids) 'SAVEREDAND))))
       (RETURN T))
)

% print q-form polynomials, saved as properties
%# PRINTQPOLS (uip) : bool ; FEXPR
(DF PRINTQPOLS (ids)
 (PROG (aa id)
       (SETQ id ids)
  L    (COND ((SETQ aa (GET (CAR id) 'SAVEREDAND))
	      (QPOLALGOUT aa))
	     (T
	      (PRIN2 "0, ")))
       (SETQ id (CDR id))
       (COND ((NOT (NULL id))(GO L)))
       (RETURN T)
 ))

% reduction for non-graded variant. dangerous, can crash.

%# HREDUCEPOL (uip) ; bool ; FEXPR
(DF HREDUCEPOL  (ids)
 (PROG ()
       (COND((NOT 
	      (AND (PAIRP ids) (IDP (CAR ids)) 
		   (PAIRP (CDR ids))
		   (IDP (CADR ids))))
	     (ERROR 0 "Bad input to hreducepol")))
       (PUT  (CADR ids)
	     'SAVEREDAND
	     (DeHomogQPol (NORMALFORM (REDAND2QPOL (GET (CAR ids)
							'SAVEREDAND)))))
       (RETURN T))
)

%checks that we are after rabbit

% AFTERRABBIT () ; bool ;
(DE AFTERRABBIT ()
 (EQ (GETORDER) 'HOMOGELIMLEFTLEX) )

% Interactive reduction. Works both for graded and non-geraded case,
% but unstable for non-graded case, because of problems with the
% dehomogenization, when differnt elements can appears to be the same elements
% for example if b^2 - a  was the relation it can be reduced to
% a-a instead of zero and the same redaction once more crashes.

%# READTONORMALFORM () : - ;
(DE READTONORMALFORM ()
  	(PROG(aa  rr)
    	(READPOL aa)
         (COND (( AFTERRABBIT) (HREDUCEPOL aa rr))
   	       (T (REDUCEPOL aa rr)))
   	 (TERPRI)
   	 (PRIN2 "is reduced to")
   	 (TERPRI)
   	 (PRINTQPOLS rr)
	)
)


(ON RAISE)
