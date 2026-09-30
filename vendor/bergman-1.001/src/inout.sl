%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%
%% Copyright (C) 1992,1993,1994,1995,1996,1997,2003,2004,2005,
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


% CHANGES:

%  Added ENDITEMOUTPUT./JoeB 2006-08-18

%  Replaced DEGLIST2LIST by DEGORITEMLIST2LIST.  Split SortlPol into
% DEGREEWISE and ITEMWISE variants./JoeB 2006-08-06

%  Re-introduced the obsolete POLALGOUT (since it is in the printed
% manual)./JoeB 2006-08-05

%  Conferred access to SAVEDEGREE to SETSAVEDEGREE calls.
% /JoeB 2005-06-17.

%  Added ADDLISPFORMINPUT and ADDLISPPOLS2INPUT./JoeB 2005-02-19

%  Adding (low degree term handling) safe versions of AlgPMonPrint; and
% the mode changers io(Quick/Safe)LowTms./JoeB 2004-10-12.

%  Added CHECKOUTFILE, and now use it in DEGREEOUTPREPARE./JoeB 2004-05-11

%  Added QPOL2LISPPOL./JoeB 2004-04-30

%  Made SETIOVARS set the variable number, if not already set.
% /JoeB 2004-04-19

%  Added CLEARVARS./JoeB 2003-10-31

%  Declared !*OBSOLETENAMESINFORM GLOBAL (instead of FLUID).
% /JoeB 2003-08-28

%  Added !&!*InnerInVarNo!&!*, and moved GETINVARNO here.
%  LISPFORMINPUT now changes promptstring./JoeB 2003-08-18

%  Added SET/GETALGOUTMODE./JoeB 1999-06-29

%  Declared more fluids./JoeB 1999-06-26

%  Removed ! within double quotes./JoeB 1998-10-22

%  Added QPOLALGOUT. (Calls as yet undefined QPOL2LISPPOL.)
% /JoeB 1998-07-14

%  Changed algoutname MAPLE to ALG. MAPLE, like BPOUT for newer
% PBOUT, is saved as obsolete./JoeB 1997-08-22

%  Made temporary corrections of Char0Alg(First)RedorTermPrint,
% and removed the redand variants./JoeB 1997-04-04

%  Corrected PRINTRATCF./JoeB 1997-03-03

%  Added PRINTQPOLRATFACTOR, PRINTRATCF./JoeB 1997-02-14

%  Added REDANDALGOUT, alg(First)RedandTermPrint./JoeB 1996-06-27

%  Changed PUREMONPRINT to MONPRINT./JoeB 1996-06-23

%  Added AlgOutModeSwitch, and inserted it in REDORALGOUT.
% Corrected error message in SETOUTVARS.
% Made ADDALGOUTMODE take care of redefining existing algebraic
% output mode./JoeB 1996-06-21

%  Corrected forming of dpOutVars./JoeB 1995-07-27

%  LISPPOLSTOINPUT, PointerOut, OUTPUT2LISPPOLS added.
% Consistent naming name conversions initiated.
% Corrected an error in REDOR2LISPPOL. /JoeB1995-07-02

%  SET/GET-IN/OUT-VARiableS routines added./JoeB1995-06-30


(OFF RAISE)

% Import: MONINTERN, MONLESSP, TOTALDEGREE, MONLISPOUT, TermInsert,
%	  PolDen, PolNum, RedandCoeff2OutCoeff, RATCF2DENOMINATOR,
%	  RATCF2NUMERATOR, QuizIdP, OneOfAskRead; cDeg, cGBasis, I(nPols,
%	  OutVars, GBasis, MonAlgOutprep, REDANDCOEFFONE, QuizIds!*.
% Export: BIGOUTPUT, DEGREEOUTPUT, ENDDEGREEOUTPUT, AlgPMonPrint,
%	  Alg(First)RedandPrint, Alg(First)RedorPrint,
%	  SortlPol, AlgOutModeSwitch, PointerPrint; *SAVEDEGREE.
% Available: SETINVARS, SETOUTVARS, SETIOVARS, CLEARVARS, GETINVARS,
%	  GETOUTVARS, GETIOVARS, LISPFORMINPUT, LISPPOLS2INPUT,
%	  LISPPOL2REDAND, REDAND2LISPPOL, REDOR2LISPPOL,
%	  OUTPUT2LISPPOLS, DEGREEOUTPREPARE, REDANDALGOUT,
%	  REDORALGOUT, PRINTQPOLRATFACTOR, PRINTRATCF, MONPRINT,
%	  GETALGOUTMODE, SETALGOUTMODE, ADDALGOUTMODE; ((ALGOUTMODE)).

(GLOBAL '(!*SAVEDEGREE GBasOutChan AOModes cDeg cGBasis InPols InPMonOne
	  InVars dpInVars !&!*InnerInVarNo!&!* OutVars dpOutVars GBasis
	  REDANDCOEFFONE QuizIds!*))

(FLUID '(AO!+ AO!- AO!* AO!^ AObop!+ AObop!- AOeop AObol AOeol ALGOUTMODE
	 !*EOLINSTRINGOK PROMPTSTRING!*))

(SETQ AO!+ '!+)		(SETQ AO!- '!-)		(SETQ AO!^ '!^)
(SETQ AO!* '!*)		(SETQ AObop!+ '! )	(SETQ AObop!- '!-)
(SETQ AOeop "   ")	(SETQ AObol " ")	(SETQ AOeol ";")

(ON EOLINSTRINGOK) % Don't warn for (psl) strings containing End Of Lines.


%%%	Input and output variable lists handling.	%%%

% The lists are set up in two variants: as plain lists, and as
% alists. In the second case, the dotted pairs consist of variable
% name identifiers and of integers, giving the place in the list.
%  Presently, input and output lists are EQUAL; this is not to be
% relied on for the future.


(DE SETINVARS (lid)
 (PROG	(ii ip)
%	(COND ((NOT lid)
%	       (RETURN NIL)))
	% Check input:
	(SETQ ip lid)
  Fl	(COND (ip
	       (COND ((OR (NOT (PAIRP ip))
			  (NOT (IDP (CAR ip)))
			  (MEMQ (CAR ip) (CDR ip)))
		      (ERROR 99 "Bad input to SETINVARS")))
	       (SETQ ip (CDR ip))
	       (GO Fl)))
	(SETQ ip (SETQ InVars lid))
	(SETQ dpInVars (SETQ InPMonOne NIL))
	(SETQ ii 0)
  Ml	(COND (ip
	       (SETQ dpInVars
		     (CONS (CONS (CAR ip) (SETQ ii (ADD1 ii))) dpInVars))
	       (SETQ InPMonOne (CONS 0 InPMonOne))
	       (SETQ ip (CDR ip))
	       (GO Ml)))
	(SETQ dpInVars (REVERSE dpInVars))
	(SETQ !&!*InnerInVarNo!&!* ii) ))

(SETQ !&!*InnerInVarNo!&!* 0)

(DE SETOUTVARS (lid)
 (PROG	(ii ip)
%	(COND ((NOT lid)
%	       (RETURN NIL)))
	% Check input:
	(SETQ ip lid)
  Fl	(COND (ip
	       (COND ((OR (NOT (PAIRP ip))
			  (NOT (IDP (CAR ip)))
			  (MEMQ (CAR ip) (CDR ip)))
		      (ERROR 99 "Bad input to SETOUTVARS")))
	       (SETQ ip (CDR ip))
	       (GO Fl)))
	(SETQ ip (SETQ OutVars lid))
	(SETQ dpOutVars NIL)
	(SETQ ii 0)
  Ml	(COND (ip
	       (SETQ dpOutVars
		     (CONS (CONS (SETQ ii (ADD1 ii)) (CAR ip)) dpOutVars))
	       (SETQ ip (CDR ip))
	       (GO Ml)))
	(SETQ dpOutVars (REVERSE dpOutVars)) ))

(DE SETIOVARS (lid)
 (PROGN	(SETINVARS lid)
	(SETOUTVARS lid)
	(COND ((NOT (GETVARNO))
	       (SETVARNO !&!*InnerInVarNo!&!*))) ))

(DE CLEARVARS ()
 (PROG	(rt)
	(SETQ rt (GETIOVARS))
	(SETQ InPMonOne (SETQ dpInVars (SETQ InVars NIL)))
	(SETQ dpOutVars (SETQ OutVars NIL))
	(CLEARVARNO)
	(SETQ !&!*InnerInVarNo!&!* 0)
	(RETURN rt) ))

(DE GETINVARS NIL (PROGN InVars))

(DE GETINVARNO () (PROGN !&!*InnerInVarNo!&!*))

(DE GETOUTVARS NIL (PROGN OutVars))

(DE GETIOVARS NIL (CONS (GETINVARS) (GETOUTVARS)))



%%%	Input.	%%%

(DE LISPFORMINPUT NIL
 (PROG	(rt ip lp PROMPTSTRING!*)
	(SETPROMPT "lisp form input> ")
  Ml	(COND ((NOT (EQUAL (SETQ ip (READ)) '(LISPFORMINPUTEND)))
	       (COND ((SETQ lp (LISPPOL2REDAND ip))
		      (SETQ rt (CONS lp rt))))
	       (GO Ml))
	      (rt
	       (SETQ InPols (SortlPol rt)))) ))

(DE ADDLISPFORMINPUT NIL
 (PROG	(rt ip lp PROMPTSTRING!*)
	(SETPROMPT "lisp form input> ")
  Ml	(COND ((NOT (EQUAL (SETQ ip (READ)) '(LISPFORMINPUTEND)))
	       (COND ((SETQ lp (LISPPOL2REDAND ip))
		      (SETQ rt (CONS lp rt))))
	       (GO Ml))
	      (rt
	       (SETQ InPols (SortlPol (APPEND (DEGORITEMLIST2LIST InPols)
					      rt))))) ))

(DE LISPPOLS2INPUT (llsppol)
 (PROG	(rt ip lp)
	(SETQ ip llsppol)
  Ml	(COND (ip
	       (COND ((SETQ lp (LISPPOL2REDAND (CAR ip)))
		      (SETQ rt (CONS lp rt))))
	       (SETQ ip (CDR ip))
	       (GO Ml))
	      (rt
	       (SETQ InPols (SortlPol rt)))) ))

(DE ADDLISPPOLS2INPUT (llsppol)
 (PROG	(rt ip lp)
	(SETQ ip llsppol)
  Ml	(COND (ip
	       (COND ((SETQ lp (LISPPOL2REDAND (CAR ip)))
		      (SETQ rt (CONS lp rt))))
	       (SETQ ip (CDR ip))
	       (GO Ml))
	      (rt

	       (SETQ InPols (SortlPol (APPEND (DEGORITEMLIST2LIST InPols)
					      rt))))) ))

%	Sorts laugpol do a doilaugpol; if in DEGREEWISE mode, first by
%	total-degree; then (or only, respectively) by MONLESSP(Lm).
%	Returns the resulting degree-or-item-list.
%	Loops: First loop; Main loop; Degree-Insert loop;
%	Polynomial-Insert loop.

%# SortlPol (laugpol) : doilaugpol ; RESET
(DE DegSortlPol (laugpol)
 (PROG	(AA BB CC DD)
	(COND ((NOT (SETQ AA laugpol)) (RETURN NIL)))
	(SETQ BB (NCONS NIL))
  Ml	(COND ((APol0? (CAR AA)) (GO MlEnd))
	      ((SETQ DD (ASSOC (SETQ CC (TOTALDEGREE (APol2Lpmon (CAR AA))))
			       (CDR BB)))
	       (GO PIl)))
	(SETQ CC (LIST CC (CAR AA)))
	(SETQ DD BB)
  DIl	(COND ((OR (NOT (CDR DD)) (LESSP (CAR CC) (CAADR DD)))
	       (RPLACD DD (CONS CC (CDR DD))) (GO MlEnd)))
	(SETQ DD (CDR DD))
	(GO DIl)
  PIl	(COND ((AND (NOT (Mon!= (APol2Lm (CADR DD)) (APol2Lm (CAR AA))))
		    (MONLESSP (APol2Lpmon (CADR DD)) (APol2Lpmon (CAR AA)))
		    (CDR (SETQ DD (CDR DD))))
	       (GO PIl)))
	(RPLACD DD (CONS (CAR AA) (CDR DD)))
  MlEnd	(COND ((SETQ AA (CDR AA)) (GO Ml)))
	(RETURN (CDR BB)) ))

(DE ItemSortlPol (laugpol)
 (PROG	(AA BB lp DD)
	(SETQ AA laugpol)
  Fl	(COND ((NOT AA) (RETURN NIL))
	      ((APol0? (CAR AA)) (SETQ AA (CDR AA)) (GO Fl)))
	(SETQ BB (LIST NIL (CAR AA)))
	(GO MlEnd)
  Ml	(COND ((APol0? (CAR AA)) (GO MlEnd)))
	(SETQ lp (APol2Lpmon (CAR AA)))
	(SETQ DD BB)
  PIl	(COND ((AND (NOT (Mon!= (APol2Lm (CADR DD)) (APol2Lm (CAR AA))))
		    (MONLESSP (APol2Lpmon (CADR DD)) lp)
		    (CDR (SETQ DD (CDR DD))))
	       (GO PIl)))
	(RPLACD DD (CONS (CAR AA) (CDR DD)))
  MlEnd	(COND ((SETQ AA (CDR AA)) (GO Ml)))
	(RETURN (CDR BB)) ))

%	Turns a Lisp form input polynomial into an augpol.
%	For consistency, ought this to be moved to a macro file?

%%   CAUTION: in non-commutative mode, the tail parts of the monomials
%%   are changed, one by one. Hence, rather bad things happen, if
%%   two monomial share their last CDR's. This may be avoided by
%%   letting the input to LISPPOL2REDAND be a COPY of the original
%%   polynomial, whenever such shared tails might possibly exist.

(DE LISPPOL2REDAND (pol)
 (PROG	(AA BB CC)
	(SETQ AA pol)
	(SETQ BB (mkAPol))
  Ml	(COND ((NOT AA)
	       (RETURN (COND ((PPol? BB) BB))))
	      ((NOT (SETQ CC (InCoeff2RedandCoeff (CAAR AA))))
	       (SETQ AA (CDR AA))
	       (GO Ml)))
	(TermInsert (Cf!&Mon2Tm CC (MONINTERN (CDAR AA))) BB)
	(SETQ AA (CDR AA))
	(GO Ml) ))


%%%	OUTPUT.	    %%%

%	Inverts the operation of LISPPOL2REDAND.

(DE REDAND2LISPPOL (augpol)
 (PROG	(AA BB CC)
	(SETQ AA (PPol augpol))
	(SETQ CC (SETQ BB (NCONS NIL)))
  Ml	(COND ((Pol? AA)
	       (RPLACD BB
		       (NCONS (CONS (RedandCoeff2OutCoeff (Lc AA))
				    (MONLISPOUT (Lpmon AA)))))
	       (PolDecap AA)
	       (SETQ BB (CDR BB))
	       (GO Ml)))
	(RETURN (CDR CC)) ))

(DE REDOR2LISPPOL (augpol)
 (PROG	(AA BB CC)
	(SETQ AA (PPol augpol))
	(SETQ CC (SETQ BB (NCONS NIL)))
  Ml	(COND ((Pol? AA)
	       (RPLACD BB
		       (NCONS (CONS (RedorCoeff2OutCoeff (Lc AA))%JoeB 950702
				    (MONLISPOUT (Lpmon AA)))))
	       (PolDecap AA)
	       (SETQ BB (CDR BB))
	       (GO Ml)))
	(RETURN (CDR CC)) ))

(DE QPOL2LISPPOL (qpol)
 (PROG	(AA BB CC)
	(SETQ AA (PPol qpol))
	(SETQ CC (SETQ BB (NCONS (CONS (PolNum qpol) (PolDen qpol)))))
  Ml	(COND ((Pol? AA)
	       (RPLACD BB
		       (NCONS (CONS (RedandCoeff2OutCoeff (Lc AA))
				    (MONLISPOUT (Lpmon AA)))))
	       (PolDecap AA)
	       (SETQ BB (CDR BB))
	       (GO Ml)))
	(RETURN CC) ))

(DE PointerOut (mon)
    (REDOR2LISPPOL (Mpt mon)))

(DE PointerPrint (mon)
    (REDORALGOUT (Mpt mon)))

(DE OUTPUT2LISPPOLS NIL
 (MAPCAR (CDR GBasis) (FUNCTION PointerOut)))

(DE BIGOUTPUT NIL
    (MAPC (CDR GBasis) (FUNCTION PointerPrint)))


%	Checks whether or not the item is a possible output file.

%# CHECKOUTFILE (uip) : filechannel ;
(DE CHECKOUTFILE (userinp)
 (PROG	(rt ip)
	(COND ((QuizIdP (SETQ ip userinp))
	       (PRIN2 "- Provide a valid output filename within quotes (like in ""foo.bar""): ")
	       (SETQ ip (READ))))
	(COND ((NOT (STRINGP ip))
	       (ERROR 99 (CONSTANTLIST2STRING (LIST ip "bad input to CHECKOUTFILE")))))
	(COND ((GETOVERWRITE)
	       (BM!_DELETE!_FILE ip)))
	(COND ((FILEP ip)
	       (PRIN2 (CONSTANTLIST2STRING (LIST "*** The file "
						 ip
						 "exists. Shall I try to remove it? ")))
	       (TERPRI)
	       (COND ((YESP (CONSTANTLIST2STRING (LIST "Answer" 'YES "or" 'NO)))
		      (BM!_DELETE!_FILE ip)))))
	(COND ((NOT (SETQ rt (OPEN ip 'OUTPUT)))
	       (ERROR 98 (CONSTANTLIST2STRING (LIST "Could not open"
						    ip
						    "for output")))))
	(RETURN rt) ))



%	Prepares for making degree-by-degree output. Either no argument
%	should be given (meaning `Output to Standard Output'), or an
%	appropriate file name (but not of an existing file) should be
%	given as a non-evaled argument.

(DF DEGREEOUTPREPARE (fil)
 (COND	((NOT fil)
	 (SETSAVEDEGREE T)
	 (SETQ GBasOutChan NIL))
	((NOT (PAIRP fil))
	 (PRIN2 "***** Bad input to DEGREEOUTPREPARE") (TERPRI))
	(T
	 (SETSAVEDEGREE T)
	 (SETQ GBasOutChan (CHECKOUTFILE (CAR fil))))) )


%	The following two procedures should only be called when SAVEDEGREE
%	is on, and GBasOutChan is either NIL (for Standard Output) or
%	the channel number of an open output file.

(DE DEGREEOUTPUT NIL
 (PROG	(cChan)
	(COND
	 ((NOT (CDR cGBasis)) (RETURN NIL)))
	(SETQ cChan (WRS GBasOutChan))
	(PRIN2 "% ") (PRINT cDeg)
	(MAPC (CDR cGBasis) (FUNCTION PointerPrint))
	(TERPRI)
	(COND (GBasOutChan (FLUSHCHANNEL GBasOutChan)))
	 (WRS cChan) ))

(DE ENDDEGREEOUTPUT NIL
 (PROG	(cChan)
	(SETQ cChan (WRS GBasOutChan))
	(PRIN2 "Done
")
	(WRS cChan)
	(COND (GBasOutChan
	       (CLOSE GBasOutChan)))
	% (SETSAVEDEGREE NIL)
	))

(COPYD 'ENDITEMOUTPUT 'ENDDEGREEOUTPUT)

(DE REDANDALGOUT (augpol)
  (COND	((OR (NOT ALGOUTMODE) (NOT OutVars) (NOT (ASSOC ALGOUTMODE AOModes)))
	 (PRINT (REDAND2LISPPOL augpol)))
	(T
	 (PROG (AA AO!+ AO!- AO!* AO!^ AObop!+ AObop!- AOeop AObol AOeol)
	       (AlgOutModeSwitch ALGOUTMODE)
	       (AlgFirstRedandTermPrint (APol2Lt augpol))
	       (SETQ AA (PolTail (PPol augpol)))
	  Ml   (COND (AA
		      (AlgRedandTermPrint (Lt AA))
		      (PolDecap AA)
		      (GO Ml)))
	       (PRIN2 AOeop) ))))


%	The most common output function. Most outputs to the user but
%	specialised ones (like leadmons) uses this, or REDOR2LISPPOL.

(DE REDORALGOUT (augpol)
  (COND	((OR (NOT ALGOUTMODE) (NOT OutVars) (NOT (ASSOC ALGOUTMODE AOModes)))
	 (PRINT (REDOR2LISPPOL augpol)))
	(T
	 (PROG (AA AO!+ AO!- AO!* AO!^ AObop!+ AObop!- AOeop AObol AOeol)
	       (AlgOutModeSwitch ALGOUTMODE)
	       (AlgFirstRedorTermPrint (APol2Lt augpol))
	       (SETQ AA (PolTail (PPol augpol)))
	  Ml   (COND (AA
		      (AlgRedorTermPrint (Lt AA))
		      (PolDecap AA)
		      (GO Ml)))
	       (PRIN2 AOeop) ))))


% 98-07-14: A non-spread ratio coefficient printer.

(DE QPOLALGOUT (augpol)
  (COND	((OR (NOT ALGOUTMODE) (NOT OutVars) (NOT (ASSOC ALGOUTMODE AOModes)))
	 (PRINT (QPOL2LISPPOL augpol)))
	((NOT augpol) NIL)
	(T
	 (PROG (aa bo AO!+ AO!- AO!* AO!^ AObop!+ AObop!- AOeop AObol AOeol)
	       (AlgOutModeSwitch ALGOUTMODE)
	       (COND ((SETQ bo (PRINTQPOLRATFACTOR augpol))
		      (PRIN2 AO!*)
		      (PRIN2 "(")))
	       (AlgFirstRedandTermPrint (APol2Lt augpol))
	       (SETQ aa (PolTail (PPol augpol)))
	  Ml   (COND (aa
		      (AlgRedandTermPrint (Lt aa))
		      (PolDecap aa)
		      (GO Ml)))
	       (COND (bo
		      (PRIN2 ")")))
	       (PRIN2 AOeop) )
	 T)) )


% 97-02-14: Printing ratio coefficients:

%    If ratcoeff is a/b (with a and b relatively prime as they should),
%    the procedure does one of the following
%	Prints a/b and returns T if b <> 0;
%	Prints a and returns T if b = 1 but a <> 1;
%	Doesn't print and returns NIL if a = b = 1.
%    The procedure may or may not surround the print form of a
%    (and b) with parentheses, depending on the domain and others.

%# PRINTRATCF (ratcoeff) : bool ;
(DE PRINTRATCF (rtcf)
 (COND	((NOT (EQ (RATCF2DENOMINATOR rtcf) REDANDCOEFFONE))
	 (PRIN2 (RedandCoeff2OutCoeff (RATCF2NUMERATOR rtcf)))
	 (PRIN2 '!/)
	 (PRIN2 (RedandCoeff2OutCoeff (RATCF2DENOMINATOR rtcf)))
	 T)
	((NOT (EQ (RATCF2NUMERATOR rtcf) REDANDCOEFFONE))
	 (PRIN2 (RedandCoeff2OutCoeff (RATCF2NUMERATOR rtcf)))
	 T)) )


%    If the ratio factor or "quotient" of qpol is a/b (with
%    a and b relatively prime as they should), the procedure does
%    one of the following
%	Prints a/b and returns T if b <> 0;
%	Prints a and returns T if b = 1 but a <> 1;
%	Doesn't print and returns NIL if a = b = 1.
%    The procedure may or may not surround the print form of a
%    (and b) with parentheses, depending on the domain and others.

%# PRINTQPOLRATFACTOR (qpol) : bool ;
(DE PRINTQPOLRATFACTOR (qpol)
 (COND	((NOT (EQ (PolDen qpol) REDANDCOEFFONE))
	 (PRIN2 (RedandCoeff2OutCoeff (PolNum qpol)))
	 (PRIN2 '!/)
	 (PRIN2 (RedandCoeff2OutCoeff (PolDen qpol)))
	 T)
	((NOT (EQ (PolNum qpol) REDANDCOEFFONE))
	 (PRIN2 (RedandCoeff2OutCoeff (PolNum qpol)))
	 T)) )





% 92-03-02: Structuring the AlgTermPrints.
% New versions probably slightly slower, and worse for mon=1.

(DE AlgPureMonPrint (mon) (AlgPMonPrint (PMon mon)))

(DE AlgPMonPrint (pmon)
 (PROG	(AA)
	(SETQ AA (MonAlgOutprep pmon))
  Ml	(PRIN2 (CAAR AA))
	(COND ((NOT (EQ (CDAR AA) 1))
	       (PRIN2 AO!^)
	       (PRIN2 (CDAR AA))))
	(COND ((SETQ AA (CDR AA))
	       (PRIN2 AO!*)
	       (GO Ml))) ))

(DE AlgRedandTermPrint (term)
 (PROG	(BB)
	(PRIN2 (COND ((MINUSP (SETQ BB (RedandCoeff2OutCoeff (Cf term))))
		      (SETQ BB (MINUS BB))
		      AO!-)
		     (T
		      AO!+)))
	(COND ((NOT (EQ BB 1))
	       (PRIN2 BB)
	       (PRIN2 AO!*)))
	(AlgPMonPrint (Tm2PMon term)) ))

(DE AlgFirstRedandTermPrint (term)
 (PROG	(BB)
	(PRIN2 (COND ((MINUSP (SETQ BB (RedandCoeff2OutCoeff (Cf term))))
		      (SETQ BB (MINUS BB))
		      AObop!-)
		     (T
		      AObop!+)))
	(COND
	      ((NOT (EQ BB 1))
	       (PRIN2 BB)
	       (PRIN2 AO!*)))
	(AlgPMonPrint (Tm2PMon term)) ))

(DE AlgRedorTermPrint (term)
 (PROG	(BB)
	(PRIN2 (COND ((MINUSP (SETQ BB (RedorCoeff2OutCoeff (Cf term))))
		      (SETQ BB (MINUS BB))
		      AO!-)
		     (T
		      AO!+)))
	(COND ((NOT (EQ BB 1))
	       (PRIN2 BB)
	       (PRIN2 AO!*)))
	(AlgPMonPrint (Tm2PMon term)) ))

(DE AlgFirstRedorTermPrint (term)
 (PROG	(BB)
	(PRIN2 (COND ((MINUSP (SETQ BB (RedorCoeff2OutCoeff (Cf term))))
		      (SETQ BB (MINUS BB))
		      AObop!-)
		     (T
		      AObop!+)))
	(COND
	      ((NOT (EQ BB 1))
	       (PRIN2 BB)
	       (PRIN2 AO!*)))
	(AlgPMonPrint (Tm2PMon term)) ))


(DE MONPRINT (mon)
  (COND	((OR (NOT ALGOUTMODE) (NOT OutVars) (NOT (ASSOC ALGOUTMODE AOModes)))
	 (PRIN2 (MONLISPOUT (PMon mon))))
	(T
	 (AlgPureMonPrint mon))) )

%  2004-10-12: "Quick" (possibly not working) contra "safe" (but slow)
% handling of situations, where constants may or may not be expected:

(COPYD 'quickAlgPMonPrint 'AlgPMonPrint)

(DE safeAlgPMonPrint (pmon)
 (PROG	(AA)
	(COND ((NULL (SETQ AA (MonAlgOutprep pmon)))
	       (PRIN2 1)
	       (RETURN NIL)))
  Ml	(PRIN2 (CAAR AA))
	(COND ((NOT (EQ (CDAR AA) 1))
	       (PRIN2 AO!^)
	       (PRIN2 (CDAR AA))))
	(COND ((SETQ AA (CDR AA))
	       (PRIN2 AO!*)
	       (GO Ml))) ))

%  Mode changers:

(DE ioQuickLowTms ()
 (PROG	(!*USERMODE !*REDEFMSG)
	(COPYD 'AlgPMonPrint 'quickAlgPMonPrint) ))

(DE ioSafeLowTms ()
 (PROG	(!*USERMODE !*REDEFMSG)
	(COPYD 'AlgPMonPrint 'safeAlgPMonPrint) ))



%%%	Algebraic output mode handling.	  %%%

(DF SETALGOUTMODE (lid)
 (PROG	(ip rt)
	(SETQ rt ALGOUTMODE)
	Ml
	(COND ((ATOM lid)
	       (SETQ ip lid))
	      (T
	       (SETQ ip (CAR lid))))
	(COND ((EQ ip 'LISP)
	       (SETQ ALGOUTMODE NIL)
	       (RETURN rt)))
	(COND ((MEMQ ip QuizIds!*)
	       (SETQ lid (OneOfAskRead (MAPCAR AOModes (FUNCTION CAR))))
	       (GO Ml)))
	(COND ((ASSOC ip AOModes)
	       (AlgOutModeSwitch (SETQ ALGOUTMODE ip))
	       (RETURN rt)))
	(PRIN2 "*** ") (PRIN2 lid)
	(PRIN2 " bad input to SETALGOUTMODE") (TERPRI) ))


(DE GETALGOUTMODE () (COND (ALGOUTMODE ALGOUTMODE) (T 'LISP)))


(DF ADDALGOUTMODE (clause)
  (COND ((NOT (EQ (LENGTH clause) 10))
	 (PRIN2 "***** ")
	 (PRIN2 clause)
	 (PRIN2 "BAD INPUT (not length 10) TO ADDALGOUTMODE")
	 (TERPRI))
	((NOT (ASSOC (CAR clause) AOModes))
	 (SETQ AOModes (CONS clause AOModes)))
	((NOT (EQUAL (ASSOC (CAR clause) AOModes) clause))
	 (TERPRI)
	 (PRIN2 "*** Am changing the definition of the algebraic output")
	 (TERPRI)
	 (PRIN2 "*** clause ")
	 (PRIN2 (CAR clause))
	 (TERPRI)
	 (RPLACD (ASSOC (CAR clause) AOModes) (CDR clause)))) )


% The strange 'indentation' below is due to strings containing EOL:

(ADDALGOUTMODE ALG "" !- !+ !- !* !^ ",
   " ![ !])

(ADDALGOUTMODE MACAULAY "" !- !+ !- "" "" "
   " "" "")

(ADDALGOUTMODE PBOUT "" !- !+ !- !* !^ "" !( !))


(DE AlgOutModeSwitch (idfier)
 (PROG	(aa)
	(SETQ aa (CDR (ASSOC idfier AOModes)))
	(SETQ AObop!+ (CAR aa))
	(SETQ AObop!- (CADR aa))
	(SETQ AO!+ (CADDR aa))
	(SETQ AO!- (CADDDR aa))
	(SETQ aa (CDDDDR aa))
	(SETQ AO!* (CAR aa))
	(SETQ AO!^ (CADR aa))
	(SETQ AOeop (CADDR aa))
	(SETQ AObol (CADDDR aa))
	(SETQ AOeol (CAR (CDDDR aa))) ))


%  JoeB 1997-04-04: The following is NOT updated with respect to the
%  presently more modularised coefficient domain mode handling:

%% The following procedures may be changed in non-zero characteristic,
%% whence fresh copies are saved:
%
%%(COPYD 'Char0POLLISPOUT 'POLLISPOUT)
%(COPYD 'Char0AlgRedandTermPrint 'AlgRedandTermPrint)
%(COPYD 'Char0AlgFirstRedandTermPrint 'AlgFirstRedandTermPrint)
%(COPYD 'Char0AlgRedorTermPrint 'AlgRedorTermPrint)
%(COPYD 'Char0AlgFirstRedorTermPrint 'AlgFirstRedorTermPrint)

%  JoeB 1997-04-04: Since two of the routines are used by pbseries.sl,
%  I temporarily define them (correctly). The whole thing should be
%  reviewed!

(DE Char0AlgFirstRedorTermPrint (term)
 (PROG	(BB)
	(PRIN2 (COND ((MINUSP (SETQ BB (Cf term)))
		      (SETQ BB (MINUS BB))
		      AObop!-)
		     (T
		      AObop!+)))
	(COND
	      ((NOT (EQ BB 1))
	       (PRIN2 BB)
	       (PRIN2 AO!*)))
	(AlgPMonPrint (Tm2PMon term)) ))

(DE Char0AlgRedorTermPrint (term)
 (PROG	(BB)
	(PRIN2 (COND ((MINUSP (SETQ BB (Cf term)))
		      (SETQ BB (MINUS BB))
		      AO!-)
		     (T
		      AO!+)))
	(COND ((NOT (EQ BB 1))
	       (PRIN2 BB)
	       (PRIN2 AO!*)))
	(AlgPMonPrint (Tm2PMon term)) ))


%%%	1995-07-02: Older version name compatibility definitions:   %%%

(GLOBAL '(!*OBSOLETENAMESINFORM))

(ON OBSOLETENAMESINFORM)

(DE POLINTERN (arg1) (PROGN
  (COND (!*OBSOLETENAMESINFORM (TERPRI)
	 (PRIN2 "*** POLINTERN is obsolete - use LISPPOL2REDAND instead.")
	 (TERPRI)))
  (LISPPOL2REDAND arg1)))

(DE POLALGOUT (arg1) (PROGN
  (COND (!*OBSOLETENAMESINFORM (TERPRI)
	 (PRIN2 "*** POLALGOUT is obsolete - use either REDANDALGOUT or REDORALGOUT instead.")
	 (TERPRI)))
  (REDANDLAGOUT arg1)))

(DE REDAND2LISPFORM (arg1) (PROGN
  (COND (!*OBSOLETENAMESINFORM (TERPRI)
	 (PRIN2 "*** REDAND2LISPFORM is obsolete - use REDAND2LISPPOL instead.")
	 (TERPRI)))
  (REDAND2LISPPOL arg1)))

(DE REDOR2LISPFORM (arg1) (PROGN
  (COND (!*OBSOLETENAMESINFORM (TERPRI)
	 (PRIN2 "*** REDOR2LISPFORM is obsolete - use REDOR2LISPPOL instead.")
	 (TERPRI)))
  (REDOR2LISPPOL arg1)))

(DE PUREMONPRINT (arg1) (PROGN
  (COND (!*OBSOLETENAMESINFORM (TERPRI)
	 (PRIN2 "*** PUREMONPRINT is obsolete - use MONPRINT instead.")
	 (TERPRI)))
  (MONPRINT arg1)))

(DE MAPLEINPUT (arg1) (PROGN
  (COND (!*OBSOLETENAMESINFORM (TERPRI)
	 (PRIN2 "*** MAPLEINPUT is obsolete - use ALGFORMINPUT instead.")
	 (TERPRI)))
  (ALGFORMINPUT)))

(EVAL (CONS 'ADDALGOUTMODE (CONS 'MAPLE (CDR (ASSOC 'ALG AOModes)))))
(EVAL (CONS 'ADDALGOUTMODE (CONS 'BPOUT (CDR (ASSOC 'PBOUT AOModes)))))


(ON RAISE)
(OFF EOLINSTRINGOK)
