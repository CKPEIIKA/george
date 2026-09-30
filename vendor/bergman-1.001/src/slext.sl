%   General extensions of Standard Lisp.
%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%
%% Copyright (C) 1992,1993,1994,1995,1996,1997,1998,1999,2001,
%% 2002,2003,2004,2005,2006 Joergen Backelin
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

%	CHANGES (after summer -95):

%  Added APPLYIFDIFFANDDEF1./JoeB 2007-08-21

%  Corrected TCONC./JoeB 2006-08-11

%  Added a CL-SPECIFIC version of LOADIFMACROS./Kae,JoeB 2005-08-04

%  Added SCALARPRODUCT./JoeB 2005-08-01

%  For merging compilation under clisp and under psl/reduce,
% introduced GROUPCOMP, ITEMCOMP, and a clisp version of FASLEND.
% JoeB,Kae July-August 2005

%  Brought PROLONGTWOWAYLIST and INITTWOWAYLIST here from reclaim.sl,
% and added CLEARTWOWAYLIST./JoeB 2005-06-25.


%  Tried to improve BM!_DELETE!_FILE environment flexibility.
% /Kae,JoeB 2004-05-12

%  Corrected ATSOC; added PROTECTEDASSOC and BM!_DELETE!_FILE.
% /JoeB 2004-05-10

%  Added READTOEOL. Corrected FLIPSWITCH./JoeB 2004-04-28

%  Added FLIPSWITCH and ASSIGNSTRING. (Modified from the commented
% out procedures anFLIPFLAG and anASSIGNSTRING in anick/t_inout.)
% /JoeB 2004-04-24

%  Added BMDATING and auxiliary month names GLOBALs, in order to
% facilitate putting date and time to file output et cetera.
% /KAE,JoeB 2004-04-24

%  Added LOADIFMACROS, and defined it in psl-specific mode.
% /JoeB 2003-11-04

%  Brought TCONCPTRCLEAR here from hseries.sl./JoeB 2002-10-14

%  Added DELETIP (at least temporarily), and PRINTX. Moved
% ADDINTTOLIST here./JoeB 2002-10-12

%  Moved TIME clisp definition to environ.lsp. Corrected BMI!/ clisp
% definition./KAE 2002-10-09

%  Made APPLYIFDEF0 ignore non-EXPRs. Added PRUNEFIRSTDEGREEITEM.
% /JoeB 2002-07-12

%  Added NILNOOPFCN0./JoeB 2002-07-11

%  Moved the OFF definition first, and immediately used it on RAISE.
% /JoeB 2001-08-14

%  Corrected clisp DSKIN and LAPIN definitions./JoeB, SV 1999-11-26

%  Corrected '(lambda expression) to (FUNCTION (ibid.))
% (in APPENDLCHARTOID)/JoeB, SV 1999-11-14

%  FlushChannel --> FLUSHCHANNEL (in order to make it more user
% available in top-of-the-top procedures et cetera).  Replaced
% DEFUN by DE in the CL!-SPECIFIC variants (for conformity).
% Re-defined CL!-SPECIFIC RECLAIM./JoeB 1999-07-04

%  Added DEFP./JoeB

%  Changed CL!-SPECIFIC definitions of NCONS, ATSOC,
% APPENDNUMBERTOSTRING, DSKIN, LAPIN, APPENDLCHARTOID,
% FlushChannel, RECLAIM, TIME for better
% compatibility with COMMON LISP.
% Moved CL!-SPECIFIC versions of COPYD, ON, OFF to 
% environ.lsp
% Removed CL!-SPECIFIC version of UNION /SV 1-07-1999

%  Added SETPROMPT and PROMPTREAD./JoeB, SV 1999-06-29

%  Changed fast i-numerical operators (<, +, et cetera) to macros
% and prefixed BMI to them. Added MERGESTRINGS./JoeB 1998-11-07

%  Changed FILEP DE to COPYD/JoeB 1998-02-11

%  Moved DEGLIST2LIST here from stg.sl./JoeB

%  Added NILNOOPFCN2, NILNOOPFCN3, NILNOOPFCN4, ONENOOPFCN1, -2,  and
% LISTONENOOPFCN0, -1, -2, for copying in different modules.
% /JoeB 1997-03-14

%  Moved CIRCLENGTH here from stg.sl./JoeB 1996-10-11

%  Moved APPLYIFDEF0 here from checkstg.sl./JoeB 1996-09-02

%  Added !* as inum operator./JoeB 1996-08-30

%  (Re-)introduced I- prefix inum operators and vector lookup in
% reduce mode./JoeB 1996-07-01

%  Added NILNOOPFCN1, TNOOPFCN1, and IBIDNOOPFCN, for copying in
% different modules, when really noop functions are wanted.
% /JoeB 1996-06-22

%  Added boolean DPLISTP: "Is argument a list of dotted pairs?"
% /JoeB 1996-05-02, 1996-05-14

% Handling cases (even in this file ...); assignments

%# OFF (id) : - ; FEXPR
(PSL!-AVOIDING (CL!-AVOIDING
(DF OFF (!#ARRG)
    (SET (INTERN (COMPRESS (CONS '!* (EXPLODE (CAR !#ARRG)))))
	 NIL))))

(OFF RAISE)

%# ON (id) : - ; FEXPR
(PSL!-AVOIDING (CL!-AVOIDING
(DF ON (!#ARRG)
    (SET (INTERN (COMPRESS (CONS '!* (EXPLODE (CAR !#ARRG)))))
	 T))))

%  From anick/t_inout.sl, but adapted slightly:/JoeB 2004-04-24

%  Mainly for assigning values to switches, or type checked
% mode defining strings to identifiers.

%# FLIPSWITCH (id, bool) : bool ;
(DE FLIPSWITCH (var boolval)
 (PROG	(rt)
	(SETQ rt var)
	(SET var (NOT (NOT boolval)))
	(RETURN rt) ))

%# ASSIGNSTRING (id, string) : genstring ;
(DE ASSIGNSTRING (var str)
 (PROG	(rt)
	(SETQ rt var)
	(COND ((NOT (STRINGP str))
	       (PRIN2 "*** ")
	       (PRIN2 str)
	       (PRIN2 " ")
	       (PRIN2 "not a string value for ")
	       (PRIN2 var)
	       (TERPRI)
	       (RETURN NIL)))
	(SET var str)
	(RETURN rt) ))

% General lisp-extensions:

%# COPYD (id, id) : - ;
(PSL!-AVOIDING (CL!-AVOIDING
 (DE COPYD (!&!*IMAGE !&!*SOURCE)
     (PUTD !&!*IMAGE (CAR (GETD !&!*SOURCE)) (CDR (GETD !&!*SOURCE)))) ))
%(CL!-SPECIFIC % Hollman's code
% (DE COPYD (!#st !#sf)
%     (SETF (SYMBOL!-FUNCTION !#st) (SYMBOL!-FUNCTION !#sf))) )


%  Defined-property: Is the argument bound to a function definition?
%# DEFP (id) : bool ; MACRO

(PSL!-AVOIDING (CL!-AVOIDING
 (DM DEFP (rrg) (LIST 'GETD (CADR rrg))) ))

(REDUCE!-SPECIFIC (CL!-AVOIDING
 (DM DEFP (rrg) (LIST 'GETD (CADR rrg))) ))

(PSL!-SPECIFIC (REDUCE!-AVOIDING
 (DM DEFP (rrg) (LIST 'FBOUNDP (CADR rrg))) ))

(CL!-SPECIFIC
 (DM DEFP (rrg) (LIST 'FBOUNDP (CADR rrg))) )

%# EVENP (int) : bool ;
(PSL!-AVOIDING (CL!-AVOIDING
 (DM EVENP (rrg) (LIST 'EQN (LIST 'REMAINDER (CADR rrg) 2) 0)) ))

% BAD. As in some psl, works wrong for negative integers.
%(PSL!-AVOIDING (CL!-AVOIDING
% (DM ODDP (rrg) (LIST 'EQN (LIST 'REMAINDER (CADR rrg) 2) 1)) ))

%# MINUSP (number) : bool ;
(PSL!-AVOIDING (CL!-AVOIDING
 (DM MINUSP (rrg) (LIST 'LESSP (CADR rrg) 0)) ))

% The redefined COND accepts more than two items per COND-"pair".
% The redefinition is rather clumsy, and should be omitted whenever
% possible. Furthermore, it probably doesn't work well with compilers;
% and its use of RETURN and GO is strictly speaking unauthorised.

% Correction 920804: Of course, no prog within a COND!
% NO! This doesn't work, either! Am commenting out this, for the time
% being.

%(PSL!-AVOIDING (CL!-AVOIDING
%(COPYD '!#TRUECOND 'COND)))
%
%(PSL!-AVOIDING (CL!-AVOIDING
%(DF COND (!#GENCONDFORMS)
%    (PROG (AA BB)
%	  (SETQ AA !#GENCONDFORMS)
%	  FL
%	  (!#TRUECOND ((NOT AA)
%		       (RETURN NIL))
%		      ((OR (ATOM AA) (ATOM (CAR AA)))
%		       (ERROR 6 "Bad argument to COND."))
%		      ((AND (NOT (SETQ BB (EVAL (CAAR AA))))
%			    (OR (SETQ AA (CDR AA)) T))
%		       (GO FL)))
%	  (SETQ AA (CDAR AA))
%	  SL
%	  (!#TRUECOND ((NOT AA)
%		       (RETURN BB))
%		      ((ATOM AA)
%		       (ERROR 6 "Bad argument to COND.")))
%	  (SETQ BB (EVAL (CAR AA)))
%	  (SETQ AA (CDR AA))
%	  (GO SL) ))))

%# NCONS (any) : lany ;
(PSL!-AVOIDING (CL!-AVOIDING (DM NCONS (itm) (LIST 'CONS (CADR itm) NIL)) ))

(CL!-SPECIFIC (DE NCONS (itm) (CONS itm NIL)))

% ATSOC should check equality by EQ (or EQN, like Common Lisp ASSOC).
% The following definition could be modified e. g. in that case.
%# ATSOC (any, ldpany) : gendpany ;

(PSL!-AVOIDING (CL!-AVOIDING
(DE ATSOC (!#U !#V)
 (PROG	(AA)
	(SETQ AA !#V)
  Ml	(COND ((NOT AA) (RETURN NIL))
	      ((EQ !#U (CAAR AA)) (RETURN (CAR AA))))
	(SETQ AA (CDR AA))
	(GO Ml) )) ))

(CL!-SPECIFIC (DE ATSOC (x y) (ASSOC x y :TEST #'EQ)))

%  In uip (user input) situations, and for mode handling, when the
% second argument might not be an alist.

%# PROTECTEDASSOC (any, any) : gendpany ;
(DE PROTECTEDASSOC (!#U !#V)
 (PROG	(AA)
	(SETQ AA !#V)
  Ml	(COND ((ATOM AA) (RETURN NIL))
	      ((AND (PAIRP (CAR AA)) (EQUAL !#U (CAAR AA))) (RETURN (CAR AA))))
	(SETQ AA (CDR AA))
	(GO Ml) ))


% 2002-10-11: DELETIP as psl defined.
% Disrecommended. The single use (in homog.sl) might be removed.
%# DELETIP (any, lany) : lany ;

(PSL!-AVOIDING (CL!-AVOIDING
(DE DELETIP (itm lst)
 (PROG	(ip)
	(COND ((NOT (PAIRP lst)) (RETURN lst))
	      ((EQUAL (CAR lst) itm) (RETURN (CDR lst))))
	(SETQ ip lst)
  Ml	(COND ((NOT (PAIRP (CDR ip))) (RETURN lst))
	      ((EQUAL (CADR ip) itm)
	       (RPLACD ip (CDDR ip))
	       (RETURN lst)))
	(SETQ ip (CDR ip))
	(GO Ml) )) ))

(CL!-SPECIFIC
(DEFUN DELETIP (x y) (LISP:DELETE x y :COUNT 1)) )

% 2002-10-11: Psl Standard Lisp extension, printing some self-referring
% objects, and hence good for some debugging et cetera. (WARNING:
% calls ordinary LENGTH, and therefore runs into an infinite loop
% if tail-self-reference occurs.)
%# PRINTX (any) : - ;

(PSL!-AVOIDING (DE PRINTX (any) (PROGN (PRIN2 "<unprintable>") (TERPRI)) ) )

(REDUCE!-AVOIDING (DE PRINTX (any) (PROGN (PRIN2 "<unprintable>") (TERPRI)) ) )

% 2005-08-01: Calculate the scalar product of the two arguments (which should be
% non-empty lists of integers of the same length), interpreted as vectors in the
% obvious manner. The integers need not be INUMs. The arguments are not checked.

%# SCALARPRODUCT (lint , lint) : int;
(DE SCALARPRODUCT (Li1 Li2)
 (PROG	(ip1 ip2 rt)
	(SETQ ip1(CDR Li1))
	(SETQ ip2 (CDR Li2))
	(SETQ rt (TIMES2 (CAR Li1) (CAR Li2)))
  Ml	(COND (ip1
	       (SETQ rt (PLUS2 rt (TIMES2 (CAR ip1) (CAR ip2))))
	       (SETQ ip1 (CDR ip1))
	       (SETQ ip2 (CDR ip2))
	       (GO Ml)))
	(RETURN rt) ))


% 2004-04-28: Read until end of line. Retur the number of characters read
% (before the end)./JoeB

%# READTOEOL ( ) : int ;
(DE READTOEOL ()
 (PROG	(C RT)
	(SETQ RT 0)
  ML	(COND ((OR (EQ (SETQ C (READCH)) $EOL$) (EQ C $EOF$))
	       (RETURN RT)))
	(SETQ RT (ADD1 RT))
	(GO ML) ))


%  Operations on lists of dotted pairs (Association Lists):

%# DPLISTCOPY (ldpany) : ldpany ;
(REDUCE!-AVOIDING (PSL!-SPECIFIC (COPYD 'DPLISTCOPY 'COPYALIST)))

(PSL!-AVOIDING
(DE DPLISTCOPY (dpl)
 (COND (dpl (PROG (AA BB CC)
		  (SETQ CC (SETQ BB (NCONS (CONS (CAAR dpl) (CDAR dpl)))))
		  (SETQ AA (CDR dpl))
	     Ml	  (COND (AA
			 (RPLACD CC (NCONS (CONS (CAAR AA) (CDAR AA))))
			 (SETQ AA (CDR AA))
			 (SETQ CC (CDR CC))
			 (GO Ml)))
		  (RETURN BB)
	     ))))
)

(PSL!-SPECIFIC (REDUCE!-SPECIFIC
(DE DPLISTCOPY (dpl)
 (COND (dpl (PROG (AA BB CC)
		  (SETQ CC (SETQ BB (NCONS (CONS (CAAR dpl) (CDAR dpl)))))
		  (SETQ AA (CDR dpl))
	     Ml	  (COND (AA
			 (RPLACD CC (NCONS (CONS (CAAR AA) (CDAR AA))))
			 (SETQ AA (CDR AA))
			 (SETQ CC (CDR CC))
			 (GO Ml)))
		  (RETURN BB)
	     ))))
))

%  New 1996-05-02:

%# DPLISTP (any) : bool ;
(DE DPLISTP (lst)
 (PROG	(aa)
	(COND ((NULL (SETQ aa lst))
	       (RETURN T)))
  Ml	(COND ((OR (ATOM aa) (ATOM (CAR aa)))
	       (RETURN NIL))
	      ((SETQ aa (CDR aa))
	       (GO Ml)))
	(RETURN T) ))
	

%  Operations on Degree Lists (a special case of association lists):

%  Moved here 1997-08-21:

%# DEGLIST2LIST (dlany) : lany ;
(DE DEGLIST2LIST (dlist)
 (MAPCAN dlist (FUNCTION (LAMBDA (auglst) (LISTCOPY (CDR auglst))))) )


%# APPLYIFDEF0 (lid) : - ;
(DE APPLYIFDEF0 (lexprid)
 (PROG	(AA !*USERMODE !*REDEFMSG)
	(SETQ AA lexprid)
  Ml	(COND (AA
	       (COND ((AND (DEFP (CAR AA)) (EQ (CAR (GETD (CAR AA))) 'EXPR))
		      (APPLY (CAR AA) NIL)))
	       (SETQ AA (CDR AA))
	       (GO Ml))) ))

%  Added 2007-08-21.  Intended for "leaving modes hooks".
%  If the two first arguments differ, then search the
% last argument for an EXPR associated with the second argument; which, if
% found, is applied with the first argument as only argument.
%  Returns T if such an EXPR was found and applied, NIL else.

%# APPLYIFDIFFANDDEF1 (lid) : bool ;
(DE APPLYIFDIFFANDDEF1 (nmd omd hooklst)
 (PROG	(AA !*USERMODE !*REDEFMSG)
	(COND ((AND (NOT (EQ nmd omd))
		    (SETQ AA (PROTECTEDASSOC omd hooklst))
		    (DEFP (CDR AA))
		    (EQ (CAR (GETD (CDR AA))) 'EXPR))
	       (APPLY (CDR AA) (NCONS nmd))
	       (RETURN T))) ))



%  New 2003-11-04, for taking cre of calls to procedures, which were
% compiled as EXPR's, but replaced by self-loading macros before a
% certain execution.
%# LOADIFMACROS (any) : - ;

(PSL!-SPECIFIC
(DF LOADIFMACROS (U)
 (PROG	(ip itm)
	(SETQ ip U)
  Ml	(COND ((ATOM ip)
	       (RETURN NIL))
	      ((AND (PAIRP (SETQ itm (CAR ip)))
		    (PAIRP (CDR itm))
		    (EQ (CAR itm) 'QUOTE))
	       (SETQ itm (CADR itm))))
	(COND ((AND (IDP itm)
		    (PAIRP (SETQ itm (GETD itm)))
		    (EQ (CAR itm) 'MACRO)
		    (PAIRP (SETQ itm (CDR itm)))
		    (EQ (CAR itm) 'LAMBDA))
	       (APPLY itm '(NIL))))
	(SETQ ip (CDR ip))
	(GO Ml) )) )

(PSL!-AVOIDING (CL!-AVOIDING (DF LOADIFMACROS (U) (PROGN NIL) ) ) )

(CL!-SPECIFIC
 (DF LOADIFMACROS (U)
  (PROG (ip itm itm1)
	(SETQ ip U)
	Ml
	(COND ((ATOM ip)
	       (RETURN NIL))
	      ((AND (PAIRP (SETQ itm (CAR ip)))
		    (PAIRP (CDR itm))
		    (EQ (CAR itm) 'QUOTE))
	       (SETQ itm (CADR itm))))
	(COND ((AND (IDP itm)
		    (PAIRP (SETQ itm1 (GETD itm)))
		    (EQ (CAR itm1) 'MACRO)
		    (NOT (COMPILED!-FUNCTION!-P (CDR itm1))))
	       (MACROEXPAND!-1 (LIST itm NIL))))
	(SETQ ip (CDR ip))
	(GO Ml) )) )


%  New 1996-06-22 and 1997-03-14, for copying definitions in trivial cases:

%# NILNOOPFCN0 () : NIL ;
(DE NILNOOPFCN0 () NIL)
%# NILNOOPFCN1 (any) : NIL ;
(DE NILNOOPFCN1 (any) NIL)
%# NILNOOPFCN2 (any, any) : NIL ;
(DE NILNOOPFCN2 (any1 any2) NIL)
%# NILNOOPFCN3 (any, any, any) : NIL ;
(DE NILNOOPFCN3 (any1 any2 any3) NIL)
%# NILNOOPFCN4 (any, any, any, any) : NIL ;
(DE NILNOOPFCN4 (any1 any2 any3 any4) NIL)

%# TNOOPFCN1 (any) : T ;
(DE TNOOPFCN1 (any) T)

%# IBIDNOOPFCN (any) : any ;
(DE IBIDNOOPFCN (any) any)

%# ONENOOPFCN1 (any) : 1 ;
(DE ONENOOPFCN1 (any) 1)
%# ONENOOPFCN2 (any, any) : 1 ;
(DE ONENOOPFCN2 (any1 any2) 1)

%# LISTONENOOPFCN0 () : 1.NIL ;
(DE LISTONENOOPFCN0 () (CONS 1 NIL))
%# LISTONENOOPFCN1 (any) : 1.NIL ;
(DE LISTONENOOPFCN1 (any) (CONS 1 NIL))
%# LISTONENOOPFCN2 (any, any) : 1.NIL ;
(DE LISTONENOOPFCN2 (any1 any2) (CONS 1 NIL))


% New 2005-07-01, for merging psl and cl type compilation:

%# GROUPCOMP (string) : - ; MACRO/EXPR
(PSL!-SPECIFIC
(DM GROUPCOMP (file) (LIST 'FASLOUT (CADR file)) ) )

(CL!-SPECIFIC
(FLUID '(!#cl!_Compile!_OutChan!*)) )

(CL!-SPECIFIC
 (DE GROUPCOMP (file)
  (PROG	NIL %(oldoutch)
 	(SETQ !#cl!_Compile!_OutChan!* (OPEN file 'OUTPUT))
 	%(SETQ oldoutch (WRS !#cl!_Compile!_OutChan!*))
 	(WRITE-LINE ";;" !#cl!_Compile!_OutChan!*)
 	(WRITE-LINE "(SETQ |*S_*_RaiSe| *RAISE)" !#cl!_Compile!_OutChan!*)
 	(WRITE-LINE "(OFF RAISE)" !#cl!_Compile!_OutChan!*)
        (WRITE-LINE "" !#cl!_Compile!_OutChan!*)
 	%(WRS oldoutchan)
)) )

%# ITEMCOMP (string) : - ; MACRO/EXPR
(PSL!-SPECIFIC
(DM ITEMCOMP (file) (LIST 'DSKIN (CADR file)) ) )

(CL!-SPECIFIC
 (DE ITEMCOMP (file)
  (PROG (zz |*S_*_RaiSe|)
	(WRITE-LINE
          (CONCATENATE 'STRING
            "(LOAD (MKBMPATHEXPAND "
            DOUBLEQUOTE
            "$bmload/"
	      (SUBSEQ
		 (SETQ zz (FILE-NAMESTRING (PARSE-NAMESTRING file)))
		 0
		 (- (LENGTH zz) 3))
 	      %"_cl_item.fas" DOUBLEQUOTE "))" % do we need to distinguish files?
 	      ".fas" 
            DOUBLEQUOTE
            "))"  % it is better, as directories differ
          )
          !#cl!_Compile!_OutChan!*
        )
      (SETQ |*S_*_RaiSe| *RAISE)
 	(COMPILE-AND-LOAD (MKBMPATHEXPAND file))
      (COND (|*S_*_RaiSe| (ON RAISE))
            (T (OFF RAISE)) )
 	%(WRS oldoutchan)
)) )

%# FASLEND () : - ;
(CL!-SPECIFIC
 (DE FASLEND NIL
  (PROG NIL %(oldoutch)
 	%(SETQ oldoutch (WRS !#cl!_Compile!_OutChan!*))
 	(WRITE-LINE "" !#cl!_Compile!_OutChan!*)
 	(WRITE-LINE "(COND (|*S_*_RaiSe| (ON RAISE))" !#cl!_Compile!_OutChan!*)
 	(WRITE-LINE "      (T (OFF RAISE)) )" !#cl!_Compile!_OutChan!*)
        (WRITE-LINE "" !#cl!_Compile!_OutChan!*)
 	(CLOSE !#cl!_Compile!_OutChan!*) )) )


% From 'stg':

(GLOBAL '(!*CSTRUCTRUE!*))

%# CIRCLENGTH (any) : int ;
(DE CIRCLENGTH (list)
 (PROG	(AA BB CC DD)
	(SETQ AA 0)
	(SETQ BB list)
  Ml	(COND ((NOT (PAIRP BB))
	       (SETQ !*CSTRUCTRUE!* NIL)
	       (RETURN AA)))
	(SETQ CC list)
	(SETQ DD AA)
  Sl	(COND ((GREATERP DD 0)
	       (COND ((EQ CC BB) (SETQ !*CSTRUCTRUE!* T) (RETURN AA))
		     (T (SETQ DD (SUB1 DD)) (SETQ CC (CDR CC)) (GO Sl)))))
	(SETQ AA (ADD1 AA))
	(SETQ BB (CDR BB))
	(GO Ml) ))



% From 'coefficients':

	% Shared with primaux:
%# APPENDNUMBERTOSTRING (number, string) : string ;

(CL!-AVOIDING
(DE APPENDNUMBERTOSTRING (numb strng)
  (COND ((NOT (AND (NUMBERP numb) (STRINGP strng)))
	 (ERROR 0 "Bad arguments to APPENDNUMBERTOSTRING"))
	(T
	 (COMPRESS (NCONC (REVERSE (CDR (REVERSE (EXPLODE strng))))
			  (NCONC (EXPLODE numb) '(!")))))) ) )
(CL!-SPECIFIC
(DE APPENDNUMBERTOSTRING (numb strng)
  (COND ((NOT (AND (NUMBERP numb) (STRINGP strng)))
         (ERROR 0 "Bad arguments to APPENDNUMBERTOSTRING"))
        (T
          (CONCATENATE 'STRING
             strng (FORMAT NIL "~D" numb)) ))))

%(PSL!-SPECIFIC (DM STRIPEXPLODE (u) (CONS 'EXPLODE2 (CDR u))))
%(CL!-SPECIFIC (DM STRIPEXPLODE (u) (CONS 'EXPLODEC (CDR u))))

%# STRIPEXPLODE (atom) : lid ;
(DE STRIPEXPLODE (item)
  (COND ((NOT (ATOM item))
	 (ERROR 0 "Bad argument to STRIPEXPLODE"))
	((STRINGP item)
	 (REVERSE (CDR (REVERSE (CDR (EXPLODE item))))))
	(T
	 (EXPLODE item))) )

%# CONSTANTLIST2STRING (latom) : string ;
(DE CONSTANTLIST2STRING (list)
 (PROG	(IN UT)
	(COND ((NOT (SETQ IN (REVERSE list)))
	       (RETURN "")))
	(SETQ UT (NCONC (STRIPEXPLODE (CAR IN)) '(!")))
  Ml	(COND ((SETQ IN (CDR IN))
	       (SETQ UT (NCONC (STRIPEXPLODE (CAR IN))
			       (CONS '!  UT)))
	       (GO Ml)))
	(RETURN (COMPRESS (CONS '!" UT))) ))

	% Shared with primaux:

%# SETVECTPROG (id, int) : - ;
(DE SETVECTPROG (id uv)
 (PROG	(AA BB)
	(COND ((OR (NOT (IDP id))
		   (NOT (FIXP uv))
		   (LESSP uv 0))
	       (ERROR 0 "Bad argument to SETVECTPROG")))
	(SET id (SETQ BB (MKVECT uv)))
	(SETQ AA 0)
  Ml	(PUTV BB AA (READ))
	(COND ((NOT (EQN AA uv))
	       (SETQ AA (ADD1 AA))
	       (GO Ml))) ))

%# CALLSHELL (atom, latom) : - ;
(PSL!-SPECIFIC
 (DE CALLSHELL (filstr list)
     (SYSTEM (CONSTANTLIST2STRING (CONS filstr list))) )
)

%# BM!_DELETE!_FILE (string) : - ;
(CL!-AVOIDING (UNIX!-SPECIFIC
(DE BM!_DELETE!_FILE (X) (CALLSHELL "rm -f" (NCONS X)))
))

% NOT tested try to work in non-unix context.
(CL!-AVOIDING (MSDOS!-SPECIFIC
(DE BM!_DELETE!_FILE (X) (CALLSHELL "del" (NCONS X)))
))

(CL!-SPECIFIC
(DE BM!_DELETE!_FILE (X)
   (IF (LISP:PROBE-FILE X) (LISP:DELETE-FILE X)) )
)


%  New 1998-11-07:
%# MERGESTRINGS (string, string) : string ;
(DE MERGESTRINGS (str1 str2)
 (COMPRESS (CONS (QUOTE !")
		 (NCONC (STRIPEXPLODE str1)
			(NCONC (STRIPEXPLODE str2) (QUOTE (!")))))) )

% From inout (with completions and corrections):

% FILEP should be true only when its argument is a file name.
% I do not know how to define this in pure Standard Lisp. If
% you have FILEP or a synonym, change the following!
%# FILEP (any) : bool ;

(PSL!-AVOIDING (CL!-AVOIDING (COPYD 'FILEP 'TNOOPFCN1) ))

%(CL!-SPECIFIC (DM FILEP (filstr) (CONS 'PROBE!-FILE (CDR filstr))) )
% New definition /SV 1-07-1999

(CL!-SPECIFIC
 (DE FILEP (fname)
    (COND ((PROBE!-FILE fname) T)
          ( T NIL) )) )

% These exist in PSL and some other dialects, but not e. g. in Common:

%# DSKIN (string) : - ;
(PSL!-AVOIDING (CL!-AVOIDING
(DE DSKIN (filen)
 (PROG	(oldinch inrd)
	(COND ((NOT (FILEP filen)) (ERROR 0 "Bad argument to DSKIN")))
	(SETQ oldinch (RDS (OPEN filen 'INPUT)))
  Ml	(COND ((NOT (EQ (SETQ inrd (READ)) !$EOF!$))
	       (PRINT (EVAL inrd))
	       (GO Ml)))
	(CLOSE (RDS oldinch)) )) ))

(CL!-SPECIFIC
(DE DSKIN (x &OPTIONAL (y "DSKIN"))
  (WITH-OPEN-FILE (ISTREAM x :DIRECTION :INPUT)
    (PROG (!*STANDARD!-INPUT!* rval)
      (SETF !*STANDARD!-INPUT!* ISTREAM)
      (COND (!*LOAD!-VERBOSE!*
       (TERPRI)
       (LISP:PRINC ";; ")
       (LISP:PRINC y)
       (LISP:PRINC ": loading file ")
       (LISP:PRINC x)
       (LISP:PRINC " ...")
       (TERPRI)
       T))
      (LOOP WHILE (LISTEN ISTREAM) DO 
        (PROGN 
          (SETQ rval (EVAL (READ !*STANDARD!-INPUT!* NIL !$EOF!$ NIL)))
          (COND ((STRING= y "LAPIN") rval)
                (T (LISP:PRINT rval))
          )))
      (COND (!*LOAD!-VERBOSE!*
       (LISP:PRINC ";; ")
       (LISP:PRINC y)
       (LISP:PRINC ": loading of file ")
       (LISP:PRINC x)
       (LISP:PRINC " is finished.")
       (TERPRI)
       T))
      (RETURN T) ) ) )
)


%# LAPIN (string) : - ;
(PSL!-AVOIDING (CL!-AVOIDING
(DE LAPIN (filen)
 (PROG	(oldinch inrd)
	(COND ((NOT (FILEP filen)) (ERROR 0 "Bad argument to LAPIN")))
	(SETQ oldinch (RDS (OPEN filen 'INPUT)))
  Ml	(COND ((NOT (EQ (SETQ inrd (READ)) !$EOF!$))
	       (EVAL inrd)
	       (GO Ml)))
	(CLOSE (RDS oldinch)) )) ))

(CL!-SPECIFIC
 (DE LAPIN (x) (DSKIN x "LAPIN"))
)



% New. !*RAISE added as PROG variable, in order to turn it off, so that
% COMPRESS doesn't perform automatic raising./Joeb 930624

%  In the newer versions, EXPLODE and COMPRESS seem not to handle lower
% case letters as before. Furthermore, there seems to be a difference
% between REDUCE and PSL in this respect.
%  I make a difference between REDUCE and non-REDUCE below, but perhaps
% a difference between newer and older versions were more adequate.
% /JoeB 950620
%# APPENDLCHARTOID (lid, id) : id ;

(REDUCE!-AVOIDING (CL!-AVOIDING
(DE APPENDLCHARTOID (lch id)
 (PROG	(!*RAISE)
	(RETURN (INTERN (COMPRESS (APPEND lch (EXPLODE id))))) ))
))

(CL!-SPECIFIC
 (DE APPENDLCHARTOID (lch id)
  (PROG (SAVED!*RAISE)
   (SETQ SAVED!*RAISE !*RAISE)
   (OFF RAISE)
   (RETURN (PROG1
    (CAR (LIST (INTERN
      (COERCE (APPEND
           (LISP:MAPCAR (FUNCTION (LAMBDA (x) (COERCE x 'CHARACTER))) lch)
           (COERCE (STRING id) 'LIST)) 'STRING))))
    (COND (SAVED!*RAISE (ON RAISE)))
 ))))
)

(REDUCE!-SPECIFIC
(DE APPENDLCHARTOID (lch id)
 (PROG	(!*RAISE)
	(SETQ !*RAISE T)
	(RETURN (INTERN (COMPRESS (APPEND lch (EXPLODE id))))) ))
)

%# PAIRCOPYD (dpid) : - ;
(DE PAIRCOPYD (fcnpair)
 (COND ((DEFP (CDR fcnpair))
	(COPYD (CAR fcnpair) (CDR fcnpair))) ))

%# UNION (lany, lany) : lany ;
(PSL!-AVOIDING (CL!-AVOIDING
 (DE UNION (lst1 lst2)
     (PROG (AA BB)
	   (SETQ AA lst1)
	   (SETQ BB lst2)
      Ml   (COND (AA
		  (COND ((NOT (MEMBER (CAR AA) lst2))
			 (SETQ BB (CONS (CAR AA) BB))))
		  (SETQ AA (CDR AA))
		  (GO Ml)))
	   (RETURN BB) ))) )



% New 1999-06-29 (JoeB & SV):

%# SETPROMPT (string) : - ;
(PSL!-SPECIFIC
 (DE SETPROMPT (prmpt)
  (SETQ PROMPTSTRING!* prmpt) ) )

(PSL!-AVOIDING
 (DE SETPROMPT (prmpt)
  (PRIN2 prmpt) ) )

%# PROMPTREAD (string) : any ;
(DE PROMPTREAD (prmpt)
 (PROG	(PROMPTSTRING!*)
	(SETPROMPT prmpt)
	(RETURN (READ)) ))

% From 'monomials':

% One may use COPY instead of LISTCOPY, or define it as below. (This ought to
% be faster, since the CARs never are tested by PAIRP or correspondingly;
% however, if COPY is very efficiently written in c or something, this need not
% be the case.)
%# LISTCOPY (lany) : lany ;

(PSL!-AVOIDING
 (DE LISTCOPY (litems)
  (PROG	(AA BB CC)
	(SETQ CC (SETQ AA (NCONS (CAR (SETQ BB litems)))))
   Ml	(COND ((SETQ BB (CDR BB))
	       (RPLACD CC (NCONS (CAR BB)))
	       (SETQ CC (CDR CC))
	       (GO Ml)))
	(RETURN AA) ))
)

(PSL!-SPECIFIC (REDUCE!-SPECIFIC
 (DE LISTCOPY (litems)
  (PROG	(AA BB CC)
	(SETQ CC (SETQ AA (NCONS (CAR (SETQ BB litems)))))
   Ml	(COND ((SETQ BB (CDR BB))
	       (RPLACD CC (NCONS (CAR BB)))
	       (SETQ CC (CDR CC))
	       (GO Ml)))
	(RETURN AA) ))
))

(REDUCE!-AVOIDING (PSL!-SPECIFIC (COPYD 'LISTCOPY 'COPYLIST)))


% New 2002-07-12 (JoeB):

%# PRUNEFIRSTDEGREEITEM (dlany, degno) : dlany ;
(DE PRUNEFIRSTDEGREEITEM (dlist deg)
 (COND	((AND dlist (EQN (CAAR dlist) deg)) (CDR dlist))
	(T dlist)) )


%  With some misgivings, I test (re-)introducing the inum I- prefix
% operators. Most of them seem to work in reduce 3.5, at least; but
% only by means of numerous flags, making them compile well. (They are
% defined in the binary file inum, whence removing the LOSE flag followed
% by (load inum) makes them defined, but probably not efficiently
% compiled.)
%  Thus, COPYD is not the way to handle this; I use macros.  Similarly, I
% introduce FASTGETV, to set to IGETV in Reduce mode./JoeB 1996-07-01

%  The fast inum operators should consistently be macros. They also
% should have names which reasonably would not collide with other
% procedure names; whence I prefix BMI before them, here and
% (hopefully) in each instance where they are called./JoeB 1998-11-07

%# BMI!< (inum, inum) : bool ;
(PSL!-AVOIDING (CL!-AVOIDING
(DM BMI!< (rrg) (CONS 'LESSP (CDR rrg))) ))

(PSL!-SPECIFIC (REDUCE!-AVOIDING
(DM BMI!< (rrg) (CONS '!< (CDR rrg))) ))

(CL!-SPECIFIC
(DM BMI!< (rrg) (CONS '!< (CDR rrg))) )

(REDUCE!-SPECIFIC
(DM BMI!< (rrg) (CONS 'ILESSP (CDR rrg))) )

%# BMI!> (inum, inum) : bool ;
(PSL!-AVOIDING (CL!-AVOIDING
(DM BMI!> (rrg) (CONS 'GREATERP (CDR rrg))) ))

(PSL!-SPECIFIC (REDUCE!-AVOIDING
(DM BMI!> (rrg) (CONS '!> (CDR rrg))) ))

(CL!-SPECIFIC
(DM BMI!> (rrg) (CONS '!> (CDR rrg))) )

(REDUCE!-SPECIFIC
(DM BMI!> (rrg) (CONS 'IGREATERP (CDR rrg))) )

%# BMI!+ (inum, inum) : inum ;
(PSL!-AVOIDING (CL!-AVOIDING
(DM BMI!+ (rrg) (CONS 'PLUS2 (CDR rrg))) ))

(PSL!-SPECIFIC (REDUCE!-AVOIDING
(DM BMI!+ (rrg) (CONS '!+ (CDR rrg))) ))

(CL!-SPECIFIC
(DM BMI!+ (rrg) (CONS '!+ (CDR rrg))) )

(REDUCE!-SPECIFIC
(DM BMI!+ (rrg) (CONS 'IPLUS2 (CDR rrg))) )

%# BMI!- (inum, inum) : inum ;
(PSL!-AVOIDING (CL!-AVOIDING
(DM BMI!- (rrg) (CONS 'DIFFERENCE (CDR rrg))) ))

(PSL!-SPECIFIC (REDUCE!-AVOIDING
(DM BMI!- (rrg) (CONS '!- (CDR rrg))) ))

(CL!-SPECIFIC
(DM BMI!- (rrg) (CONS '!- (CDR rrg))) )

(REDUCE!-SPECIFIC
(DM BMI!- (rrg) (CONS 'IDIFFERENCE (CDR rrg))) )

%# BMI!= (inum, inum) : bool ;
(PSL!-AVOIDING (CL!-AVOIDING
(DM BMI!= (rrg) (CONS 'EQN (CDR rrg))) ))

(PSL!-SPECIFIC
(DM BMI!= (rrg) (CONS 'EQ (CDR rrg))) )

(CL!-SPECIFIC
(DM BMI!= (rrg) (CONS '!= (CDR rrg))) )

 % Added 94-08-25/JoeB
%# BMI!/ (inum, inum) : inum ;
(PSL!-AVOIDING (CL!-AVOIDING
(DM BMI!/ (rrg) (CONS 'QUOTIENT (CDR rrg))) ))

(PSL!-SPECIFIC (REDUCE!-AVOIDING
(DM BMI!/ (rrg) (CONS '!/ (CDR rrg))) ))

% KAE 2002-09-06 16:56:06 Replaced / by QUOTIENT
(CL!-SPECIFIC
(DM BMI!/ (rrg) (CONS 'QUOTIENT (CDR rrg))) )

(REDUCE!-SPECIFIC
(DM BMI!/ (rrg) (CONS 'IQUOTIENT (CDR rrg))) )

(REDUCE!-AVOIDING
(DM FASTGETV (rrg) (CONS 'GETV (CDR rrg))) )

(REDUCE!-SPECIFIC
(DM FASTGETV (rrg) (CONS 'IGETV (CDR rrg))) )

 % Added 96-08-30/JoeB
%# BMI!* (inum, inum) : inum ;
(PSL!-AVOIDING (CL!-AVOIDING
(DM BMI!* (rrg) (CONS 'TIMES2 (CDR rrg))) ))

(PSL!-SPECIFIC (REDUCE!-AVOIDING
(DM BMI!* (rrg) (CONS '!* (CDR rrg))) ))

(CL!-SPECIFIC
(DM BMI!* (rrg) (CONS '!* (CDR rrg))) )

(REDUCE!-SPECIFIC
(DM BMI!* (rrg) (CONS 'ITIMES2 (CDR rrg))) )

% From PBseries:

% If ptr is non-nil, it MUST be a pair of pairs.
% The CAR of ptr is the list being built; the CDR is the last pair
% in it, from which to continue the building.

%# TCONC (any, any) : dpany ; DESTRUCTIVE (1)
(PSL!-AVOIDING
 (DE TCONC (ptr elem)
     (COND ((ATOM ptr)
	    (PROG (tmp) (SETQ tmp (NCONS elem)) (RETURN (CONS tmp tmp))))
	   ((PAIRP (CDR ptr))
	    (RPLACD (CDR ptr) (NCONS elem)) (RPLACD ptr (CDDR ptr)))
	   (T
	    (RPLACD ptr (NCONS elem)) (RPLACA ptr (CDR ptr)))))
)

%# LCONC (dplany, lany) : dplany ; DESTRUCTIVE (1)
(PSL!-AVOIDING
 (DE LCONC (ptr lst) (COND ((CAR ptr) (RPLACD (CDR ptr) lst)
			     (RPLACD ptr (LASTPAIR (CDR ptr))))
			    (T (RPLACA ptr lst) (RPLACD ptr lst))))
)

%# PNTH (lany, int) : lany ;
(PSL!-AVOIDING
 (DE PNTH (list no) (COND ((EQ no 1) list)
			   (T (PNTH (CDR list) (SUB1 no)))))
)

%# LASTCAR (lany) : any ;
(PSL!-AVOIDING
 (DE LASTCAR (list) (CAR (LASTPAIR list)))
)

%# LASTPAIR (lany) : any.NIL ;
(PSL!-AVOIDING
 (DE LASTPAIR (list) (COND ((NULL (CDR list)) list)
			    (T (LASTPAIR (CDR list)))))
)

%# DELQ (any, any) : any ;
(PSL!-AVOIDING
 (DE DELQ (U V)
  (COND ((NOT (PAIRP V)) V)
	((EQ (CAR V) U) (CDR V))
	(T (CONS (CAR V) (DELQ U (CDR V))))))
)

%# COPY (any) : any ;
(PSL!-AVOIDING
 (DE COPY (U)
  (COND ((ATOM U) U)
	(T (CONS (COPY (CAR U)) (COPY (CDR U))))))
)

%# CDRADD1 ( l(any.int) ) : l(any.int) ; DESTRUCTIVE
(DE CDRADD1 (ldp)
  (PROG (AA)
	(SETQ AA ldp)
   Ml	(COND (AA
	       (RPLACD (CAR AA) (ADD1 (CDAR AA)))
	       (SETQ AA (CDR AA))
	       (GO Ml)))
	(RETURN ldp) ))

%# ZEROP (number) : bool ;
(PSL!-AVOIDING (CL!-AVOIDING (DE ZEROP (N) (EQN N 0)) ))

%# TCONCPTRCLEAR (dpany) : dpany ; DESTRUCTIVE
(DE TCONCPTRCLEAR (ptr)
    (PROGN (RPLACD (CAR ptr) NIL) (RPLACD ptr (CAR ptr))))


% Moved from groebinout.

%# FLUSHCHANNEL (open_file_channel) : - ;
(PSL!-AVOIDING (CL!-AVOIDING (DM FLUSHCHANNEL (fp) (PROGN NIL))))
(PSL!-SPECIFIC (DM FLUSHCHANNEL (fp) (CONS 'CHANNELFLUSH (CDR fp))))
%(CL!-SPECIFIC (DM FLUSHCHANNEL (fp) '(FORCE-OUTPUT)))
% Changed /SV 1-07-1999
(CL!-SPECIFIC (DE FLUSHCHANNEL (stream) (FORCE-OUTPUT stream)) )

%# RECLAIM () : - ;
(PSL!-AVOIDING (CL!-AVOIDING (DE RECLAIM () (PROGN NIL)) ))

%(CL!-SPECIFIC (DM RECLAIM (rrg) '(GC)) )
%% Changed /SV 1-07-1999
%(CL!-SPECIFIC (DE RECLAIM () NIL))
%% For some implementations the line below will work
%%(CL!-SPECIFIC (DE RECLAIM () (GC)) )

% Yet another approach/JoeB 1999-07-04
(CL!-SPECIFIC
  (COND ((LISP:FBOUNDP 'GC) (DE RECLAIM () (GC)))
	(T (DE RECLAIM () (PROGN NIL))) ) )

% TIME is only used in some output formatting in make files which
% should anyhow be changed in non-PSL cases. Here is a Common definition:

%(CL!-SPECIFIC (DM TIME (rrg) '(GET!-INTERNAL!-RUN!-TIME)) )
%% Changed /SV 1-07-1999
%(CL!-SPECIFIC
%(DE TIME ()
% (CAR (LIST
%  (ROUND (* (/ (GET!-INTERNAL!-RUN!-TIME)
%               INTERNAL!-TIME!-UNITS!-PER!-SECOND
%            )
%            1000
%         ) ) )) ))
% Moved to environ.lsp, because of a necessity to shadow the old definition.
% KAE/2002-10-09


% New, for use with shell produced files et cetera./KAE,JoeB 2004-04-24

(GLOBAL '(!&!#Long!-Month!-Names  !&!#Short!-Month!-Names !&!#Month!-Names))

% Presently unused.
(SETQ !&!#Long!-Month!-Names
  '("January" "February" "March" "April"
    "May" "June" "July" "August"
    "September" "October" "November" "December"))

(SETQ !&!#Short!-Month!-Names
  '("Jan" "Feb" "Mar" "Apr" "May" "Jun"
    "Jul" "Aug" "Sep" "Oct" "Nov" "Dec"))

% This constant is used inside bmdating definition
(SETQ  !&!#Month!-Names  !&!#Short!-Month!-Names)

%# BMDATING () : string ;
(PSL!-SPECIFIC
 (DE BMDATING () (CONSTANTLIST2STRING (LIST (DATE-AND-TIME) "GMT")) )
)

(CL!-SPECIFIC
  (DE BMDATING ()
    (PROGN ()
      (LISP:MULTIPLE!-VALUE!-BIND
        (SECONDS MINUTES HOURS DAY MONTH YEAR DAY!-OF!-WEEK
DAYLIGHT!-SAVING TIMEZONE)
        (GET!-DECODED!-TIME)
        (COND (DAYLIGHT!-SAVING (SETQ TIMEZONE (- TIMEZONE 1))))
        (LISP:FORMAT T "~2,'0d-~a-~4,'0d ~2,'0d:~2,'0d:~2,'0d GMT~@d"
          DAY (NTH !&!#Month!-Names (- MONTH 1)) YEAR
          HOURS MINUTES SECONDS
          (MINUS TIMEZONE)
        )
      )
    )
  )
)

(PSL!-AVOIDING (CL!-AVOIDING
 (DE BMDATING () (PROGN "(No dates available in this bergman version)"))
))


%  From modinout.sl 2002-10-12/JoeB:

%(DE ADDINTTOLIST (l n) (MAPCAR l (FUNCTION (lambda (i) (PLUS2 i n)))))

%# ADDINTTOLIST (int, lint) : lint ;
(DE ADDINTTOLIST (l n) 
  (COND (l (CONS (PLUS2 (CAR l) n) (ADDINTTOLIST (CDR l) n)))))


%From reclaim.sl 2005-06-25/JoeB

%# PROLONGTWOWAYLIST (int, lany) : lany ; DESTRUCTIVE (2)
(DE PROLONGTWOWAYLIST (no lst)
 (COND	((LESSP 0 no)
	 (PROG (AA)
	       (SETQ AA (CONS (NCONS NIL)
			      (PROLONGTWOWAYLIST (SUB1 no) lst)))
	       (RPLACD (CADR AA) AA)
	       (RETURN AA)))
	(T lst) ))

%# INITTWOWAYLIST (int) : lany ;
(DE INITTWOWAYLIST (no) (PROLONGTWOWAYLIST (SUB1 no) (NCONS (NCONS NIL))))

% New 2005-06-25/JoeB

%# CLEARTWOWAYLIST (ldpany) : - ; DESTRUCTIVE
(DE CLEARTWOWAYLIST (lst)
 (PROG	(ip)
	(SETQ ip lst)
   Ml	(COND (ip
	       (RPLACA (CAR ip) NIL)
	       (SETQ ip (CDR ip))
	       (GO Ml))) ))

(ON RAISE)
