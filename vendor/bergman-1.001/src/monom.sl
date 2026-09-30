%  Internal monomial handling in the commmutative case.

%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%
%% Copyright (C) 1992,1994,1995,1996,1998,2001,2002,2003,2005,
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


%	CHANGES:

%  Introduced unstable MONLESSP modifications.  DegLexMONLESSP -->
% LexMONLESSP./JoeB 2006-08-16

%  Introduced commALLMONQUOTIENTS as a synonym of commMONFACTORP.
% /JoeB 2006-08-15

%  Introduced MAXDEG mode changing./JoeB 2006-08-11

%  Made MonomialInit work with both process modes./JoeB 2006-08-07

%  Corrected MATRIXWISELESSP, and the LCorOUT versions. (Note, that
% LCorOUT is drastically changed, since it no longer returns the
% totaldegree.)/JoeB 2006-08-01

%  Added MATRIX orders./JoeB 2005-08-01

%  Corrected MonSignifVar./JoeB 2005-03-14

%  Added CLEARVARNO./JoeB 2003-10-31

%  'Improved' message string handling in INITVARNO./JoeB 2003-08-28

%  Replaced *NONCOMMUTATIVE by ((Non)CommP)./JoeB 2003-08-25

%  Moved GETINVARNO to inout.sl./JoeB 2003-08-18

%  Added Mon(Least)SignifVar and RestOfMon (in order to support
% modularisation)/JoeB 2003-08-12

%  Corrected SETVARNO./KAE,JoeB 2002-10-09

%  Added SETVARNO, INITVARNO./JoeB 2002-07-12

%  Added GETINVARNO./JoeB 2001-08-17

%  Now exports MONONE./JoeB 1999-11-26

%  Introduced IOWeights2Weights, Weights2IOWeights, Weights
% /JoeB 1999-11-17

%  Corrected Mplist to Mplst; corrected commspreadMonAlgOutprep.
% /JoeB 1998-03-12 -- 04-01

%  Changed GETWEIGHTSLIST to GETWEIGHTS/JoeB 1997-09-18

%  Split commMonAlgOutprep in a collect exponents and a spread
% factors variant. Added mode changer auxiliaries CommCollectExps,
% CommNoExps, corresponding to the new mode./JoeB 1997-09-17

%  Brought monomial mode independent procedures GETMONAUGPROP,
% REMMONPROP, LPUT, LGET, LPUT!-LGET here./JoeB 1996-10-11

%  Moved TermInsert to polynom.sl.
%  Added MONTIMES./JoeB 1996-06-21

%  Changed niMonInit to MonomialInit./JoeB 1996-06-17

%  Added (comm)GETVARNO and GETEMBDIM (disencouraged!) as more
% modularised ways of accessing the number of variables (embedding
% dimension)./JoeB 1996-04-25

%  Introduced alternative weights. Simultaneously, corrected erroneous
% handling of LCorOUT by mode changers by removing its comm prefix.
% /JoeB 1995-07-27


% The 'monomial' module handles ALL routines where the PureMONOMIAL is
% not regarded as an atom, EXCEPT (possibly) for some 'reclaim' macro.
% This file handles the commutative case; 'ncmonom' the non-commutative
% (where they differ from the commutative procedures).

% Import: ; GBasis, InPols, OutVars, EMBDIM.
% Export: MONINTERN, niMonIntern, MonInsert, MONLESSP, MONFACTORP,
%	  MonTimes, MONTIMES2, niMonQuotient, LCorOUT,
%	  TOTALDEGREE, MonomialInit, MONLISPOUT, MonAlgOutprep, MonCommify,
%	  CommOrdWeights, CommAltWeights, GETVARNO, IOWeights2Weights,
%	  Weights2IOWeights; !&!*InnerEmbDim!&!*, MONONE.
% Available: LISTCOPY, PLUSNOEVAL.

% (Monomials are to be internally represented as lists of exponents of the
% variables, ordered reversely. In most places, SHORT FORM representations
% should be employed, where no unnecessecary variable exponents appear, but
% beginning with a reduction status POINTER. A variable is unnecessary, if
% it never appears in a generator, or if it appears as a leading monomial
% in one (which then is called a "linear reductor", and is saved separately,
% in long form). Linear reductors should be found dynamically,  and the
% short form monomials changed accordingly. (THIS IS NOW NOT IMPLEMENTED!)
% Each (coefficient free) short form monomial is stored UNIQUELY, in order to
% save place and to facilitate reductions.
% A monomial with coefficient is stored as (coeff . monomial); the coefficient
% MUST be in Z and non-zero; a polynomial is stored as a list of monomials,
% ordered revers-lexicographically.

(OFF RAISE)

% Meanings of the globals: short form monomial structured list; non-interned
% monomials (2).

(GLOBAL '(MONLIST niMon niMon1 GBasis InPols OutVars EMBDIM MAOaux
	  !&!*InnerEmbDim!&!* InVars MONONE !#!&CommOrderMatrix!#
	  UNDECIDED))

(COND ((NOT MONLIST) (SETQ MONLIST (NCONS NIL))))


%    Procedures independent of the internal monomial representation:


%# GETMONAUGPROP (augmon, identifier) : any ;
(DE GETMONAUGPROP (mon prop) (ATSOC prop (Mplst mon)) )


%  Returns T if prop is found (whence removed), NIL else.
% Only the first occurrence of the prop property is removed
% from the monomial property list of augmon.

%# REMMONPROP (augmon, identifier) : boolean ;
(DE REMMONPROP (augmon prop)
 (PROG	(AA)
	(SETQ AA (Maplst augmon))
  Ml	(COND ((NOT (CDR AA))
	       (RETURN NIL))
	      ((AND (PAIRP (CADR AA)) (EQ (CAADR AA) prop))
	       (RPLACD AA (CDDR AA))
	       (RETURN T)))
	(SETQ AA (CDR AA))
	(GO Ml) ))

%	Some non-commutative monomial property list auxiliaries.
%	(Perhaps better to replace them by macros??)

% 91-08-23 Moved def. of LPUT-LGET to PBseries module, for compiler reasons.

%# LPUT (any, identifier, any) : - ;
(DE LPUT (augalist name item)
 (PROG	(AA)
	(COND ((SETQ AA (ATSOC name (CDR augalist))) (RPLACD AA item))
	      (T
	       (RPLACD augalist (CONS (CONS name item) (CDR augalist))))) ))

%# LGET (any, identifier) : any ;
(DE LGET (alist name)
 (PROG	(AA)
	(COND ((SETQ AA (ATSOC name alist)) (RETURN (CDR AA)))) ))

%%%%  Old LPUT-LGET comments:

% If not defined in another module, define
% LPUT-LGET[list,thing,sexpr] such that it works equivalent to
% (DF LPUT-LGET (arg)
%     (PROG (!_IBID list thing)
%	    (SETQ !_IBID (LGET (CDR (SETQ list (EVAL (CAR arg))))
%			       (SETQ thing (EVAL (CADR arg)))))
%	    (LPUT list thing (EVAL (CADDR arg))) ))
% where sexpr may contain !_IBID.

% - If LPUT-LGET is defined in another module, we still must ensure
% that the compiler recognizes it as a FEXPR:
%(COND ((NOT (GETD 'LPUT!-LGET)) (PUT 'LPUT!-LGET 'TYPE 'FEXPR)))

%	91-08-23: THIS DOESN'T WORK; I must resort to the extremely
%	bad way of defining the same function twice. This make very
%	great risks of diverging definitions!
%	SO INSTEAD THE DEFINITION IS MOVED HERE; moreover, it is changed
%	to an EXPR.

% The usage should be equivalent to: we let !_IBID:=LGET(augalist,name),
% and make LPUT(augalist,name,sexpr). Typically, sexpr is an S-expression
% involving (the fluid variable) !_IBID. If it involves other variables,
% these should also be declared FLUID (or GLOBAL)!

%%%%  End of old LPUT-LGET comments.

%# LPUT!-LGET (??? , identifier, any) : - ;
(DE LPUT!-LGET (augalist name sexpr)
 (PROG	(!_IBID AA)
	(COND ((NOT (SETQ AA (ATSOC name (CDR augalist))))
	       (RPLACD augalist (CONS (CONS name (EVAL sexpr))
				      (CDR augalist))))
	      (T
	       (SETQ !_IBID (CDR AA))
	       (RPLACD AA (EVAL sexpr)))) ))





% MONLIST corresponds to OBLIST, and MONINTERN to INTERN. It is used
% for reading in and "interning" (sometimes reversed) lists of exponents.
% puremonomial=list of exponents; Ml=main loop; Rl=readloop; MkNew=make a new one.
% JH suggestion: instead save an array of exponents, or even a (condensed)
% integer (assuming that we have postulated a correct upper bound for the
% degrees).)
% intermedpmon2PMon should be COPYD'ed from REVERSE or from LISTCOPY in the
% DEGREVLEX or in both the (DEG)LEX and the MATRIX cases, respectively.

(DE commMONINTERN (lexponents)
 (PROG	(AA BB CC DD)
	(SETQ AA (SETQ DD (intermedpmon2PMon lexponents)))
	(SETQ BB MONLIST)
  Ml	(SETQ CC (CAR AA))
  Rl	(COND ((OR (NOT (CDR BB)) (MonIntPrecedence (CAADR BB) CC))
	       (RPLACD BB (CONS (NCONS CC) (CDR BB)))
	       (GO MkNew))
	      ((NOT (EQ CC (CAADR BB)))
	       (SETQ BB (CDR BB))
	       (GO Rl))
	      ((SETQ AA (CDR AA))
	       (SETQ BB (CADR BB))
	       (GO Ml)))
	(RETURN (CDADR BB))
  MkNew	(SETQ BB (CADR BB))
	(COND ((SETQ AA (CDR AA))
	       (RPLACD BB (NCONS (NCONS (CAR AA))))
	       (GO MkNew)))
	(RPLACD BB (PMon2NewMon DD))
	(RETURN (CDR BB)) ))


(DE commniMonIntern NIL
 (PROG	(AA BB CC)
	(SETQ AA niMon)
	(SETQ BB MONLIST)
  Ml	(SETQ CC (CAR AA))
  Rl	(COND ((OR (NOT (CDR BB)) (MonIntPrecedence (CAADR BB) CC))
	       (RPLACD BB (CONS (NCONS CC) (CDR BB)))
	       (GO MkNew))
	      ((NOT (EQ CC (CAADR BB)))
	       (SETQ BB (CDR BB))
	       (GO Rl))
	      ((SETQ AA (CDR AA))
	       (SETQ BB (CADR BB))
	       (GO Ml)))
	(RETURN (CDADR BB))
  MkNew	(SETQ BB (CADR BB))
	(COND ((SETQ AA (CDR AA))
	       (RPLACD BB (NCONS (NCONS (CAR AA))))
	       (GO MkNew)))
	(RPLACD BB (PMon2NewMon (LISTCOPY niMon)))
	(RETURN (CDR BB)) ))

% intermedpmon2PMon performs 2 things:
%  1) Guarantees that the intermediate form input is not EQ to part of
%     the interned form;
%  2) Changes the order from 'highest first/last' to 'most significant
%     first'.
% Since REVLEX is standard:

(COPYD 'intermedpmon2PMon 'REVERSE)

% There may be troubles with my idea of a fast RCheck-structure; if I am not
% careful, it might be of size O(m^b), where m:= max. assumed variable
% exponent; b:= # variables. I would not want it bigger than O(bg), where
% g:= # standard basis elements.


% Inserting a monomial in its appropriate place in the monomial list lmon.
% The given monomial is monic.
% The order is revlex increasing!

% 91-10-25: Since MonInsert is used only in internal work, I removed the
% error check.

(DE MonInsert (mon lmon)
 (PROG	(AA BB)
	(SETQ AA (PMon mon))
	(SETQ BB lmon)
  Ml	(COND ((NULL (CDR BB))
	       (RETURN (RPLACD BB (NCONS mon))))
%	      ((EQ (CADR BB) mon)
%	       (CONTINUABLEERROR)
%	       (RETURN BB))
	      ((MONLESSP (PMon (CADR BB)) AA)
	       (SETQ BB (CDR BB))
	       (GO Ml)))
 (RETURN (RPLACD BB (CONS mon (CDR BB)))) ))

% Arithmetic relations and operations of and on monomials:

% REVLEX comparing monomials (using the PSL fast inum comparer on each
% coefficient). Recall that the pmon are in REVERSE order. The arguments
% mustn't be equal!

%# MONLESSP (pmon, pmon) : bool ; RESET
(DE commstableMONLESSP (pmon1 pmon2)
 (PROG	(AA BB)
	(SETQ AA pmon1)
	(SETQ BB pmon2)
  Ml	(COND ((EQ (CAR AA) (CAR BB))
	       (SETQ AA (CDR AA))
	       (SETQ BB (CDR BB))
	       (GO Ml)))
	(RETURN (BMI!< (CAR BB) (CAR AA))) ))


(DE commMONFACTORP (pmon1 pmon2)
 (PROG	(AA BB)
	(SETQ AA pmon1)
	(SETQ BB pmon2)
  Ml	(COND ((BMI!< (CAR BB) (CAR AA))
	       (RETURN NIL))
	      ((SETQ AA (CDR AA))
	       (SETQ BB (CDR BB))
	       (GO Ml)))
	(RETURN T) ))


(DE commMonTimes (pmon1 pmon2)
 (PROG	(AA BB CC)
	(SETQ AA pmon1)
	(SETQ BB pmon2)
	(SETQ CC niMon)
	Ml
	(RPLACA CC (BMI!+ (CAR AA) (CAR BB)))
	(COND ((SETQ AA (CDR AA))
	       (SETQ CC (CDR CC))
	       (SETQ BB (CDR BB))
	       (GO Ml)))
	(RETURN (commniMonIntern)) ))


% In fact, MONOMIAL quotients will not need to be interned; and furtermore
% they may be of 'bad' degrees. The following are non-interned versions,
% with output of type PUREMONOMIALs.

(DE commniMonQuotient (pmon1 pmon2)
 (PROG	(AA BB CC)
	(SETQ AA pmon1)
	(SETQ BB pmon2)
	(SETQ CC niMon1)
  Ml	(RPLACA CC (BMI!- (CAR AA) (CAR BB)))
	(COND ((SETQ AA (CDR AA))
	       (SETQ CC (CDR CC))
	       (SETQ BB (CDR BB))
	       (GO Ml)))
	(RETURN niMon1) ))

(DE commPreciseniMonQuotient (pmon1 pmon2 extra) (niMonQuotient pmon1 pmon2))


% The "Lowest Common multiple or OUT with the pair" - function also uses
% the internal structure of the PureMONOMIAL.
% In the list representations of
% exponents, one could define it as below. Here the PROG variables signify,
% in this order, "tail" of pmon1, "tail" of pmon2, "tail" of niMon, and the
% Boolean "Are the monomials so far in different variables (except possibly
% in the most significant one)?".

% Corrected 2006-08-01/JoeB

(DE RevLexnomxmLCorOUT (pmon1 pmon2)
 (PROG	(AA BB CC rt)
	(SETQ AA (CDR pmon1))
	(SETQ BB (CDR pmon2))
	(SETQ CC (CDR niMon))
	(RPLACA niMon (COND ((BMI!< (CAR pmon1) (CAR pmon2))
			     (CAR pmon2))
			    (T (CAR pmon1))))
  Ml	(RPLACA CC (COND ((EQ (CAR AA) 0)
			  (CAR BB))
			 ((EQ (CAR BB) 0)
			  (CAR AA))
			 ((BMI!< (CAR AA) (CAR BB))
			  (SETQ rt T)
			  (CAR BB))
			 ((SETQ rt T)
			  (CAR AA))))
	(COND ((SETQ CC (CDR CC))
	       (SETQ AA (CDR AA))
	       (SETQ BB (CDR BB))
	       (GO Ml)))
	(RETURN rt) ))

(DE RevLexmxmLCorOUT (pmon1 pmon2)
 (PROG	(AA BB CC rt)
	(SETQ AA (CDR pmon1))
	(SETQ BB (CDR pmon2))
	(SETQ CC (CDR niMon))
	(RPLACA niMon (COND ((BMI!< (CAR pmon1) (CAR pmon2))
			     (CAR pmon2))
			    (T (CAR pmon1))))
  Ml	(RPLACA CC (COND ((EQ (CAR AA) 0)
			  (CAR BB))
			 ((EQ (CAR BB) 0)
			  (CAR AA))
			 ((BMI!< (CAR AA) (CAR BB))
			  (SETQ rt T)
			  (CAR BB))
			 ((SETQ rt T)
			  (CAR AA))))
	(COND ((SETQ CC (CDR CC))
	       (SETQ AA (CDR AA))
	       (SETQ BB (CDR BB))
	       (GO Ml)))
	(RETURN (AND rt
		     (NOT (AND (SETQ AA (GETMAXDEG))
			       (BMI!< AA (TOTALDEGREE niMon)))))) ))


% For a more efficient adding of integers;
% lints must be set to a list of at least two inums.

(DE PLUSNOEVAL (lints)
 (PROG	(AA BB)
	(SETQ AA (CAR lints))
	(SETQ BB (CDR lints))
  Ml	(SETQ AA (BMI!+ AA (CAR BB)))
	(COND ((SETQ BB (CDR BB))
	       (GO Ml)))
	(RETURN AA) ))

%  Might be slower than (COPYD 'commTOTALDEGREE 'PLUS),
% especially if the correct assembly properties are set; or
% than a macro could be. Other programme parts might expect an
% expr, though.

%(DE commTOTALDEGREE (pmon) (EVAL (CONS 'PLUS pmon)) )
(COPYD 'commTOTALDEGREE 'PLUSNOEVAL) % Changed 91-10-27.


% Should only be called when some input is read into InPols.

(DE commMonomialInit ()
 (PROG	(AA)
	(COND (InPols
	       (COND ((EQ (GETPROCESS) 'DEGREEWISE)
		      (SETQ AA (LENGTH (APol2Lpmon (CADAR InPols)))))
		     (T
		      (SETQ AA (LENGTH (APol2Lpmon (CAR InPols)))))))
	      ((AND GBasis (CDR GBasis))
	       (SETQ AA (LENGTH (PMon (CADR GBasis)))))
	      (EMBDIM (SETQ AA EMBDIM))
	      (T
	       (SETQ AA 0)))
	(SETQ !&!*InnerEmbDim!&!* AA)
	(SETQ niMon NIL)
	(SETQ MONONE NIL)
  Ml	(COND ((BMI!< 0 AA)
	       (SETQ AA (SUB1 AA))
	       (SETQ niMon (CONS NIL niMon))
	       (SETQ MONONE (CONS 0 MONONE))
	       (GO Ml)))
	(SETQ niMon1 (LISTCOPY niMon))
	(SETQ MONONE (MONINTERN MONONE)) ))


%  Modularised EmbDim access:

(DE commGETVARNO () (PROGN !&!*InnerEmbDim!&!*))


% Disencouraged. Added solely for naming convention consistencies.

(DE GETEMBDIM () (GETVARNO))


% Added 2003-08-12 (in order to support modularisation)/JoeB

(DE commMonSignifVar (augmon)
 (PROG	(ip rt)
	(SETQ ip (PMon augmon))
	(SETQ rt 1)
  Ml	(COND ((BMI!= (CAR ip) 0)
	       (SETQ rt (ADD1 rt))
	       (GO Ml)))
	(RETURN rt) ))

%  Meaning of PROG variables: Input PMon part; Return value;
% Index counter.

(DE commMonLeastSignifVar (augmon)
 (PROG	(ip rt ic)
	(SETQ ic (LENGTH (SETQ ip (PMon augmon))))
  Ml	(COND ((NOT (BMI!= (CAR ip) 0))
	       (SETQ rt ic)))
	(COND ((NOT (BMI!= (SETQ ic (SUB1 ic)) 0))
	       (SETQ ip (CDR ip))
	       (GO Ml)))
	(RETURN rt) ))

(DE commRestOfMon (augmon)
 (PROG	(ip)
	(SETQ ip (SETQ niMon (LISTCOPY (PMon augmon))))
	Ml
	(COND ((BMI!= (CAR ip) 0)
	       (SETQ ip (CDR ip))
	       (GO Ml)))
	(RPLACA ip (SUB1 (CAR ip)))
	(RETURN (commniMonIntern)) ))

(COPYD 'commMONLISPOUT 'REVERSE)


% Added 2002-07-12: Dangerous actual accesses to VARNO.

(DE SETVARNO (inum)
 (PROG	(rt)
	(COND ((OR (NOT (FIXP inum)) (LESSP inum 0))
	       (ERROR 99 "Bad input to SETVARNO")))
	(SETQ rt !&!*InnerEmbDim!&!*)
	(SETQ EMBDIM (SETQ !&!*InnerEmbDim!&!* inum))
	(RETURN rt) ))

% Added 2003-10-31: Probably almost as dangerous./JoeB

(DE CLEARVARNO ()
 (PROG	(rt)
	(SETQ rt !&!*InnerEmbDim!&!*)
	(SETQ EMBDIM (SETQ !&!*InnerEmbDim!&!* NIL))
	(RETURN rt) ))

% GETVARNO help:

(DF INITVARNO (u)
  (COND (u
	 (COND ((ATOM u) (SETVARNO (EVAL u)))
	       (T (SETVARNO (EVAL (CAR u))))))
	(InVars (SETVARNO (LENGTH InVars)))
	(OutVars (SETVARNO (LENGTH OutVars)))
	(T
	 (PRIN2 "You didn't supply the number of variables;")
	 (PRIN2 "now type it in here: ")
	 (SETVARNO (READ)))) )


(DE commcollexpMonAlgOutprep (pmon)
 (PROG	(aa bb)
	(RPLACD MAOaux (MONLISPOUT pmon))
	(SETQ aa MAOaux)
	(SETQ bb OutVars)
  Ml	(COND ((NOT (EQ (CADR aa) 0))
	       (SETQ aa (CDR aa))
	       (RPLACA aa (CONS (CAR bb) (CAR aa))))
	      (T
	       (RPLACD aa (CDDR aa))))
	(COND ((CDR aa)
	       (SETQ bb (CDR bb))
	       (GO Ml)))
	(RETURN (CDR MAOaux)) ))


% A spread factors variant:

(DE commspreadMonAlgOutprep (pmon)
 (PROG	(aa bb cc)
	(RPLACD MAOaux (MONLISPOUT pmon))
	(SETQ aa MAOaux)
	(SETQ bb OutVars)
  Ml	(SETQ cc (CADR aa))
  Sl	(COND ((NOT (BMI!= cc 0))
	       (RPLACD aa (CONS (CONS (CAR bb) 1) (CDR aa)))
	       (SETQ aa (CDR aa))
	       (SETQ cc (SUB1 cc))
	       (GO Sl))
	      ((CDR (RPLACD aa (CDDR aa)))
	       (SETQ bb (CDR bb))
	       (GO Ml)))
	(RETURN (CDR MAOaux)) ))


% Accompanying mode changers:

(DE CommCollectExpts ()
 (PROGN	(COPYD 'commMonAlgOutprep 'commcollexpMonAlgOutprep)
	(COND ((CommP)
	       (COPYD 'MonAlgOutprep 'commcollexpMonAlgOutprep))) ))

(DE CommPrintNoExpts ()
 (PROGN	(COPYD 'commMonAlgOutprep 'commspreadMonAlgOutprep)
	(COND ((CommP)
	       (COPYD 'MonAlgOutprep 'commspreadMonAlgOutprep))) ))


% The default:

(COPYD 'commMonAlgOutprep 'commcollexpMonAlgOutprep)

%%%%%%%%%%%%%%%%

% DEGLEX adoptions.


(COPYD 'RevLexMONLESSP 'commstableMONLESSP)

(DE LexMONLESSP (pmon1 pmon2)
 (PROG	(AA BB)
	(SETQ AA pmon1)
	(SETQ BB pmon2)
  Ml	(COND ((EQ (CAR AA) (CAR BB))
	       (SETQ AA (CDR AA))
	       (SETQ BB (CDR BB))
	       (GO Ml)))
	(RETURN (BMI!> (CAR BB) (CAR AA))) ))


(COPYD 'RevLexLCorOUT 'RevLexnomxmLCorOUT)
(COPYD 'LCorOUT 'RevLexLCorOUT)

(DE ordnomxmLCorOUT (pmon1 pmon2)
 (PROG	(AA BB CC rt)
	(SETQ AA pmon1)
	(SETQ BB pmon2)
	(SETQ CC niMon)
  Ml	(RPLACA CC (COND ((EQ (CAR AA) 0)
			  (CAR BB))
			 ((EQ (CAR BB) 0)
			  (CAR AA))
			 ((BMI!< (CAR AA) (CAR BB))
			  (SETQ rt T)
			  (CAR BB))
			 ((SETQ rt T)
			  (CAR AA))))
	(COND ((SETQ CC (CDR CC))
	       (SETQ AA (CDR AA))
	       (SETQ BB (CDR BB))
	       (GO Ml)))
	(RETURN rt) ))

(DE ordmxmLCorOUT (pmon1 pmon2)
 (PROG	(AA BB CC rt)
	(SETQ AA pmon1)
	(SETQ BB pmon2)
	(SETQ CC niMon)
  Ml	(RPLACA CC (COND ((EQ (CAR AA) 0)
			  (CAR BB))
			 ((EQ (CAR BB) 0)
			  (CAR AA))
			 ((BMI!< (CAR AA) (CAR BB))
			  (SETQ rt T)
			  (CAR BB))
			 ((SETQ rt T)
			  (CAR AA))))
	(COND ((SETQ CC (CDR CC))
	       (SETQ AA (CDR AA))
	       (SETQ BB (CDR BB))
	       (GO Ml)))
	(RETURN (AND rt
		     (NOT (AND (SETQ AA (GETMAXDEG))
			       (BMI!< AA (TOTALDEGREE niMon)))))) ))


%%%%%%%%%%%%%%%%

% Marix monomial order adaptions and auxiliaries.

%# GetOrdMatrix () : llint ; MACRO
(DM GetOrdMatrix (u) '!#!&CommOrderMatrix!#)

%# GETORDERMATRIX () : llint ;
(DE GETORDERMATRIX () (COPY (GetOrdMatrix)) )

% Without type checking, now. Type checking may be added, or a
% special checking procedure written, later.

%# SETORDERMATRIX (llint) : llint ; FEXPR
(DF SETORDERMATRIX (Mtrx)
 (PROG	(rt)
	(SETQ rt (GETORDERMATRIX))
	(SETQ !#!&CommOrderMatrix!#
	      (COND ((AND (PAIRP Mtrx)
			  (NOT (CDR Mtrx))
			  (OR (NOT (CAR Mtrx))
			      (AND (PAIRP (CAR Mtrx))
				   (PAIRP (CAAR Mtrx)))))
		     (CAR Mtrx))
		    (T
		     Mtrx)))
	(RETURN rt) ))

%  Standard assignment, in order to avoid confusion. (May be changed by the user.)

(SETQ UNDECIDED 'UNDECIDED)

%  Compare the two pure monomias by means of the matrix Mtrx.
% Resurns NIL, T, or UNDECIDED, depending on whether the first
% monomial is found to be less than or greater than the second one,
% or neither, with respect to the order represented by Mtrx.
%  Meaning of PROG variables: Matrix Tail; first, second Scalar Products.

%# MATRIXWISELESSP (llint, pmon, pmon) : genid ;
(DE MATRIXWISELESSP (Mtrx Pmon1 Pmon2)
 (PROG	(mt sp1 sp2)
	(SETQ mt Mtrx)
  Ml	(COND ((NOT mt)
	       (RETURN UNDECIDED))
	      ((EQN (SETQ sp1 (SCALARPRODUCT Pmon1 (CAR mt)))
		    (SETQ sp2 (SCALARPRODUCT Pmon2 (CAR mt))))
	       (SETQ mt (CDR mt))
	       (GO Ml)))
	(RETURN (LESSP sp1 sp2)) ))

(DE MatrixMONLESSP (pmon1 pmon2)
 (PROG	(rt)
	(COND ((EQ (SETQ rt (MATRIXWISELESSP (GetOrdMatrix) pmon1 pmon2))
		   UNDECIDED)
	       (ERROR 109 "Matrix monomial order unresolved")))
	(RETURN rt) ))


%  Monoid order modifications in the unstable mode.

(DE instableDegMONLESSP (pmon1 pmon2)
 (PROG	(td1 td2)
	(RETURN (OR (BMI!< (SETQ td1 (TOTALDEGREE pmon1))
			   (SETQ td2 (TOTALDEGREE pmon2)))
		    (AND (BMI!= td1 td2)
			 (stableMONLESSP pmon1 pmon2)))) ))

(COPYD 'comminstableMONLESSP 'instableDegMONLESSP)

%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%

%	Mode changers:

% Non-ordinary weight modification procedures.

(COPYD 'ordweightscommTOTALDEGREE 'commTOTALDEGREE)

(DE altweightscommTOTALDEGREE (pmon)
 (PROG	(aa bb rt)
	(SETQ aa pmon)
	(SETQ bb (Weights))
	(SETQ rt 0)
  Ml	(SETQ rt (BMI!+ rt (BMI!* (CAR aa) (CAR bb))))
	(COND ((SETQ aa (CDR aa))
	       (SETQ bb (CDR bb))
	       (GO Ml)))
	(RETURN rt) ))

(DE CommOrdWeights ()
 (PROGN (COPYD 'commTOTALDEGREE 'ordweightscommTOTALDEGREE)
	(COND ((CommP)
	       (COPYD 'TOTALDEGREE 'ordweightscommTOTALDEGREE))) ))

(DE CommAltWeights ()
 (PROGN (COPYD 'commTOTALDEGREE 'altweightscommTOTALDEGREE)
	(COND ((CommP)
	       (COPYD 'TOTALDEGREE 'altweightscommTOTALDEGREE))) ))


(DE MonCommify ()
 (PROGN	(COPYD 'MONINTERN 'commMONINTERN)
	(COPYD 'niMonIntern 'commniMonIntern)
	(COPYD 'stableMONLESSP 'commstableMONLESSP)
	(COPYD 'instableMONLESSP 'comminstableMONLESSP)
	(COPYD 'MONLESSP
	       (COND ((EQ (GETPROCESS) 'ITEMWISE) 'instableMONLESSP)
		     (T 'stableMONLESSP)))
	(COPYD 'MONFACTORP 'commMONFACTORP)
	(COPYD 'ALLMONQUOTIENTS 'commMONFACTORP)
	(COPYD 'MonTimes 'commMonTimes)
	(COPYD 'MONTIMES2 'commMonTimes)
	(COPYD 'niMonQuotient 'commniMonQuotient)
	(COPYD 'PreciseniMonQuotient 'commPreciseniMonQuotient)
	(COPYD 'TOTALDEGREE 'commTOTALDEGREE)
	(COPYD 'MonomialInit 'commMonomialInit)
	(COPYD 'GETVARNO 'commGETVARNO)
	(COPYD 'MonSignifVar 'commMonSignifVar)
	(COPYD 'MonLeastSignifVar 'commMonLeastSignifVar)
	(COPYD 'RestOfMon 'commRestOfMon)
	(COPYD 'MONLISPOUT 'commMONLISPOUT)
	(COPYD 'MonAlgOutprep 'commMonAlgOutprep)
	(COPYD 'IOWeights2Weights
	       (COND ((EQ commMONORDER 'TDEGREVLEX) 'REVERSE)
		     (T  'LISTCOPY)))
	(COPYD 'Weights2IOWeights 'IOWeights2Weights)
 ))

%	The commutative case is default!

(MonCommify)

%	Shared with ncmonom.sl:

(DE MonMaxDeg ()
 (PROGN	(COPYD 'ordLCorOUT 'ordmxmLCorOUT)
	(COPYD 'RevLexLCorOUT 'RevLexmxmLCorOUT)
	(COPYD 'LCorOUT
	       (COND ((EQ (GETCOMMORDER) 'TDEGREVLEX) 'RevLexLCorOUT)
		     (T 'ordLCorOUT)))
	(COPYD 'LCauto 'mxmLCauto)
	(COPYD 'quickLC2 'mxmLC2)
	(COND ((EQ (GETLOWTERMSHANDLING) 'QUICK)
	       (COPYD 'LC2 'quickLC2))) ))

(DE MonNoMaxDeg ()
 (PROGN	(COPYD 'ordLCorOUT 'ordnomxmLCorOUT)
	(COPYD 'RevLexLCorOUT 'RevLexnomxmLCorOUT)
	(COPYD 'LCorOUT
	       (COND ((EQ (GETCOMMORDER) 'TDEGREVLEX) 'RevLexLCorOUT)
		     (T 'ordLCorOUT)))
	(COPYD 'LCauto 'nomxmLCauto)
	(COPYD 'quickLC2 'nomxmLC2)
	(COND ((EQ (GETLOWTERMSHANDLING) 'QUICK)
	       (COPYD 'LC2 'quickLC2))) ))

(ON RAISE)
