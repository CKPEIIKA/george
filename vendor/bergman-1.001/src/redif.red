COMMENT Reduce interface procedures. May be loaded from Reduce (with
normal Reduce syntax, no 'lisp-hook*'. Provides a rudimentary interface
for using bergman from Reduce.
 All mode-changers - including setiovars - must be run symbolically.
Then bmgroebner may be called FROM ALGEBRAIC MODE, with a list of
polynomials as (single) argument. Each polynomial should be homogeneous,
and ONLY contain set bergman input variables. If all is well, bmgroebner
returns a reduced groebner basis (as a list of polynomials):
 Right now, only integer or standard form coefficients are permitted;

SYMBOLIC;

OFF RAISE;

GLOBAL '(Modulus InVars dpInVars OutVars InPMonOne);
FLUID '(!&!*nInPol!&!*);


SYMBOLIC PROCEDURE BMLSPPOL2ALGSQ(lsppol);
 BEGIN SCALAR lp,tm;
  IF NULL (lp := lsppol) THEN RETURN NIL;
  REPEAT <<RPLACA(CAR lp, !*bmLspCoeff2D CAAR lp);
	   RPLACA(lp, 'TIMES . CAR lp);
	   tm := CDDAR lp;
	   FOR EACH ovar IN OutVars DO
	     <<RPLACA(tm, LIST('EXPT, ovar, CAR tm));
	       tm := CDR tm>>;
	   lp := CDR lp>>
  UNTIL (NULL lp);
  RETURN MK!*SQ SIMP('PLUS . lsppol)
 END;

SYMBOLIC PROCEDURE ALGSQ2BMLSPPOL (sq);
 IF NOT (sq := !*Q2F sq) THEN NIL
 ELSE
   BEGIN SCALAR !&!*nInPol!&!*;
	 !&!*nInPol!&!* := TCONC(NIL,NIL);
	 !*F2bmLspPol1(sq, LISTCOPY InPMonOne);
	 RETURN CDAR !&!*nInPol!&!*;
   END;;

SYMBOLIC PROCEDURE SFALGSQ2BMLSPPOL (sq);
 IF NOT (sq := REORDER !*Q2F sq) THEN NIL
 ELSE
   BEGIN SCALAR !&!*nInPol!&!*;
	 !&!*nInPol!&!* := TCONC(NIL,NIL);
	 !*F2SFCfbmLspPol1(sq, LISTCOPY InPMonOne);
	 RETURN CDAR !&!*nInPol!&!*;
   END;;

SYMBOLIC PROCEDURE !*F2bmLspPol1 (sf,lexp);
  BEGIN SCALAR le, lp, vn;
   Ml:	IF NOT sf THEN RETURN NIL
	ELSE IF DOMAINP sf THEN RETURN TCONC (!&!*nInPol!&!*,
					      (!*D2bmInCoeff sf) . lexp)
	ELSE IF NOT (vn := ATSOC(MVAR sf, dpInVars))
	  THEN REDERR "Undeclared input variable in !*F2bmLspPol1";
	lp := PNTH(le := LISTCOPY lexp, CDR vn);
	RPLACA(lp, PLUS2(CAR lp, LDEG sf));
	!*F2bmLspPol1(LC sf, le);
	sf := RED sf;
	GO Ml; % Does RETURN work inside a WHILE loop?
  END;

SYMBOLIC PROCEDURE !*F2SFCfbmLspPol1 (sf,lexp);
  BEGIN SCALAR le, lp, vn;
   Ml:	IF NOT sf THEN RETURN NIL
	ELSE IF DOMAINP sf OR NOT (vn := ATSOC(MVAR sf, dpInVars))
	     THEN RETURN TCONC (!&!*nInPol!&!*,
				(!*F2bmInCoeff sf) . lexp);
	lp := PNTH(le := LISTCOPY lexp, CDR vn);
	RPLACA(lp, PLUS2(CAR lp, LDEG sf));
	!*F2SFCfbmLspPol1(LC sf, le);
	sf := RED sf;
	GO Ml; % Does RETURN work inside a WHILE loop?
  END;

SYMBOLIC PROCEDURE !*D2bmInCoeff (rcf);
 IF NOT (NUMBERP rcf) THEN TYPERR(rcf,"bergman input coefficient")
 ELSE rcf;

SYMBOLIC PROCEDURE !*F2bmInCoeff (rcf); NUMR SIMP PREPF rcf;


% Should be coefficient mode dependent, in the ordinary way!

SYMBOLIC PROCEDURE !*bmLspCoeff2D (bmcf); PREPF bmcf;


% Top level things. Should be called in algebraic mode!?
 
SYMBOLIC OPERATOR CHECKALGBMINPUT;
SYMBOLIC OPERATOR SFCHECKALGBMINPUT;
SYMBOLIC OPERATOR ALGBMINPUT;
SYMBOLIC OPERATOR SFALGBMINPUT;
SYMBOLIC OPERATOR ALGBMOUTPUT;
PUT('BMGROEBNER,'PSOPFN,'BMGROEBNEREXPR);

SYMBOLIC PROCEDURE CHECKALGBMINPUT(lredpol);
 FOR EACH rp IN CDR lredpol DO
  IF NOT (EQ(CAR rp,'!*SQ) AND SUBSETP(KERNELS NUMR CADR rp, InVars)
          AND DENR CADR rp EQ 1)
  THEN TYPERR(CAR rp, "bergman input polynomial");

SYMBOLIC PROCEDURE SFCHECKALGBMINPUT(lredpol);
 FOR EACH rp IN CDR lredpol DO
  IF NOT (EQ(CAR rp,'!*SQ) AND DENR CADR rp EQ 1)
  THEN TYPERR(CAR rp, "bergman input polynomial");


SYMBOLIC PROCEDURE ALGBMINPUT(lredpol);
LISPPOLS2INPUT FOR EACH rp IN CDR lredpol COLLECT ALGSQ2BMLSPPOL CADR rp;

SYMBOLIC PROCEDURE SFALGBMINPUT(lredpol);
LISPPOLS2INPUT FOR EACH rp IN CDR lredpol COLLECT SFALGSQ2BMLSPPOL CADR rp;
   

SYMBOLIC PROCEDURE ALGBMOUTPUT();
'LIST . FOR EACH lp IN OUTPUT2LISPPOLS() COLLECT BMLSPPOL2ALGSQ lp;
  

SYMBOLIC PROCEDURE BMGROEBNEREXPR(lredpol);
 IF Modulus EQ 'SF THEN SFCfBMGROEBNEREXPR(lredpol)
                   ELSE ordBMGROEBNEREXPR(lredpol);

SYMBOLIC PROCEDURE SFCfBMGROEBNEREXPR(lredpol);
 BEGIN SCALAR bmOldKOrder;
   lredpol := AEVAL CAR lredpol;
   bmOldKOrder := SETKORDER GETINVARS();
   SFCHECKALGBMINPUT(lredpol);
   SFALGBMINPUT(lredpol);
   GROEBNERINIT();
   GROEBNERKERNEL();
   SETKORDER bmOldKOrder;
   RETURN ALGBMOUTPUT();
 END;

SYMBOLIC PROCEDURE ordBMGROEBNEREXPR(lredpol);
 <<lredpol := AEVAL CAR lredpol;
   CHECKALGBMINPUT(lredpol);
   ALGBMINPUT(lredpol);
   GROEBNERINIT();
   GROEBNERKERNEL();
   ALGBMOUTPUT()>>;




ON RAISE;

ALGEBRAIC;

;END;
