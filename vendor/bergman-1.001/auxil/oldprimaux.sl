%   primaux.sl - auxiliaries for modular logarithm tables making.
%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%
%% Copyright (C) 1991,1992,1996 Joergen Backelin
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
% 92-05-11: Correcting some bugs in FirstPrimitiveRoot:
%   - Removed spurious repetition of (SETQ testno 1);
%   - Changed the bigexpt calculations modulus from PrPrime to Prime;
%   - At SHl, changed the first ASSOC argument from (CAR tlf) to
%   - (CAR tlf).

% 91-09-28: Correcting a bug in FirstPrimitiveRoot: Reversing factors.

% 91-08-28: Commenting out the ODDP definition. Making SAVEDC5, PL,
%   PSEUDOLIST, and PSEUDOLIST1 global. Turned off RAISE:

(OFF RAISE)
% 91-08-27: Added:
(LOAD "nbig30")
(DM MODEXPT (larg)	% (SMALLBASE BIGEXP BIGMOD)
    (LIST 'MODSMARTEXPT
	  (CADR larg)
	  (LIST 'BINLIST (CADDR larg))
	  (CADDDR larg)) )
% END-OF-CHANGES.

(GLOBAL '(PL PSEUDOLIST PSEUDOLIST1 SAVEDC5))

%%%% Below is from an old Dec-20 Standard Lisp file, pdecid. %%%%

% Auxiliaries for tests of odd numbers < 2.5E10 by the Pomerance-Selfridge
% Wagstaff technique (as described in H Riesel, Prime Numbers and Computer
% Methods for Factorization, Ch. 4)

(DE DECIDE1 (NARG)
% Power;Active CC;One less than 2power in NARG-1;odd factor in NARG-1;Primelist
 (PROG	(AA BB CC DD EE FF)
	(SETQ AA (NCONS (SETQ FF (SUB1 NARG))))
	(SETQ CC 0)
  A	(COND ((ZEROP (CDR (SETQ AA (DIVIDE (SETQ DD (CAR AA)) 2))))
	       (SETQ CC (ADD1 CC)) (GO A)))
	(SETQ EE '(2 3 5))
	(COND ((NULL (OR (EQ (SETQ AA (MODEXPT 2 DD NARG)) 1) (EQN AA FF)))
	       (GO C)))
  B	(COND ((NULL (SETQ EE (CDR EE)))
	       (RETURN (COND ((MEMQ NARG PSEUDOLIST) 'COMPOSITE) ('PRIME))))
	      ((OR (EQ (SETQ AA (MODEXPT (CAR EE) DD NARG)) 1) (EQN AA FF))
	       (GO B)))
  C	(COND ((ZEROP (SETQ BB CC))
	       (RETURN 'COMPOSITE)))
  D	(COND ((EQN (SETQ AA (REMAINDER (TIMES2 AA AA) NARG)) FF)
	       (GO B))
	      ((EQ AA 1)
	       (RETURN 'COMPOSITE))
	      ((ZEROP (SETQ BB (SUB1 BB)))
	       (RETURN 'COMPOSITE)))
	(GO D)))

% CHANGED TO MACRO 91-08-27:
	% Unsofisticated version!

%(DE MODEXPT (SMALLBASE BIGEXP BIGMOD)
% (PROG	(AA BB CC)	% (Sub)power;2^n-power;remaining bigexp
%	(SETQ BB SMALLBASE) (SETQ AA 1) (SETQ CC (DIVIDE BIGEXP 2))
%  A	(COND ((EQ (CDR CC) 1) (SETQ AA (REMAINDER (TIMES2 AA BB) BIGMOD))))
%	(COND ((ZEROP (CAR CC)) (RETURN AA)))
%	(SETQ CC (DIVIDE (CAR CC) 2))
%	(SETQ BB (REMAINDER (TIMES2 BB BB) BIGMOD))
%	(GO A)))

	% "Strong pseudoprimes" < 2.5E10 for bases 2, 3, 5 (viz. Riesel p. 98).
	% Note that the first four have factors < 10000.

(SETQ PSEUDOLIST '(25326001 161304001 3215031751 14386156093
		   960946321 1157839381 3697278427 5764643587
		   6770862367 15579919981
		   18459366157 19887974881 21276028621))

(SETQ PSEUDOLIST1 (CDDDDR PSEUDOLIST))


%%%% From pupdt %%%%

%	(SETQ *RAISE NIL)

(GLOBAL '(&*ASKSTRONG &*NEWNUMBER PRIMLIST))

(COND ((NOT PRIMLIST) (SETQ PRIMLIST (LIST 2 3 5 7 11 13 17 19))))

(COND ((NOT (GETD 'PENULTIMA))
       (DE PENULTIMA (ARRG)
	   (PROG (UUUU)
		 (SETQ UUUU ARRG)
	    Ml	 (COND ((CDDR UUUU) (SETQ UUUU (CDR UUUU)) (GO Ml)))
		 (RETURN UUUU)))))

(SETQ PL (PENULTIMA PRIMLIST))

(DE STRONGPRIMFAC (X) % Succeeds iff smallest prime factor < (last in PRIMLIST)^2.
	% May give erratic amswer if not 2, 3, 5, 7, 11 all are on PRIMLIST, or
	% if (CADR PL) (= last on PRIMLIST) is > Sqrt(2.5E10).
 % Remaining quotient;Primes;Factor-list;Test prime-factor;Square-root;Exponent
 (PROG	(A5 B5 C5 D5 E5 F5)
	(SETQ B5 PRIMLIST)
	(COND ((NULL (LESSP (CADR PL) X))
	       (COND ((MEMBER X PRIMLIST) (RETURN 'PRIME)))
	       (SETQ A5 X)
	       (SETQ B5 PRIMLIST)
	       (GO D))
	      ((ZEROP (REMAINDER X 2))
	       (SETQ F5 1)
	       (SETQ A5 (QUOTIENT X (SETQ D5 2)))
	       (SETQ B5 PRIMLIST)
	       (GO B))
	      ((ZEROP (REMAINDER X 3))
	       (SETQ F5 1)
	       (SETQ A5 (QUOTIENT X (SETQ D5 3)))
	       (SETQ B5 (CDR PRIMLIST))
	       (GO B))
	      ((ZEROP (REMAINDER X 5))
	       (SETQ F5 1)
	       (SETQ A5 (QUOTIENT X (SETQ D5 5)))
	       (SETQ B5 (CDDR PRIMLIST))
	       (GO B))
	      ((ZEROP (REMAINDER X 7))
	       (SETQ F5 1)
	       (SETQ A5 (QUOTIENT X (SETQ D5 7)))
	       (SETQ B5 (CDDDR PRIMLIST))
	       (GO B))
  % Since X contains no "very small" factors, it probably doesn't contain
  % "small" ones! Thus, do Pomerance-Selfridge-Wagstaff test directly!
	      ((LESSP X 25000000000)
	       (COND ((EQ (DECIDE1 X) 'PRIME) (RETURN 'PRIME)))
	       (SETQ A5 X)
	       (SETQ B5 (CDDDDR PRIMLIST))
	       (GO D)))
  % "Ordinary" PRIMFACtorization:
	(SETQ E5 (CAR (SQRT1 (SETQ A5 X))))
  A	(SETQ D5 (CAR B5))
	(COND ((LESSP E5 D5)
	       (RETURN (COND ((NULL C5) (QUOTE PRIME))
			     ((EQN A5 1) C5) ((CONS (CONS A5 1) C5)))))
	      ((ZEROP (REMAINDER A5 D5))
	       (SETQ F5 1)
	       (SETQ A5 (QUOTIENT A5 D5))
	       (GO B))
	      ((SETQ B5 (CDR B5))
	       (GO A)))
	(GO C)
  B	(COND ((ZEROP (REMAINDER A5 D5))
	       (SETQ F5 (ADD1 F5))
	       (SETQ A5 (QUOTIENT A5 D5))
	       (GO B)))
	(SETQ C5 (CONS (CONS D5 F5) C5))
	(SETQ E5 (SQRT A5))
	(COND ((SETQ B5 (CDR B5))
	       (GO A))
	      ((LESSP E5 D5)
	       (RETURN (COND ((EQN A5 1) C5) ((CONS (CONS A5 1) C5))))))

  % The other methods fell through!
  % Here D5=last tested primfactor.
  C	(SETQ B5 (DECIDE1 A5))
	(COND ((LESSP A5 25000000000) % which implies C5 non-NIL! 
	       (COND ((EQ B5 'PRIME) (RETURN (CONS (CONS A5 1) C5))))
	       (GO E))
	      (C5 (PRIN2 " % X = ") (PRIN2 A5) (PRIN2 " times ")
		  (PRIN2 (SETQ SAVEDC5 C5)) (TERPRI)))
%	(COND ((AND (EQ B5 'COMPOSITE) &*ASKSTRONG
%		    (ASK " % " A5 " is composite. Shall I search for a factor?"
%			 T NIL))
	       (GO E)%))
	(RETURN (CONS NIL (CONS (CONS D5 (CONS (QUOTE "SMALLER THAN ANY FACTOR IN")
					       (NCONS A5)))
				C5)))
	
  % X IS composite. No square-root test in this round! 
  D	(SETQ D5 (CAR B5))
	(COND ((ZEROP (REMAINDER A5 D5)) (SETQ F5 1)
	       (SETQ A5 (QUOTIENT A5 D5)) (GO B))
	      ((SETQ B5 (CDR B5)) (GO D)))
	(SETQ D5 (CADR PL))
	% This is the next-worse situation: X<2.5E10 is composite
	% but with no known small factor.
	% We test only numbers (D5) = 1,5 (mod 6).
  E	(COND ((EQ (REMAINDER D5 6) 1)
	       (GO G)))
	(SETQ D5 (PLUS2 2 D5))
  F	(COND ((ZEROP (REMAINDER A5 D5))
	       (GO H)))
  G	(COND ((ZEROP (REMAINDER A5 (PLUS2 4 D5)))
	       (SETQ D5 (PLUS2 4 D5))
	       (GO H)))
	(SETQ D5 (PLUS2 6 D5))
	(GO F)			% DANGER: loop if NOT A5 composite!

  H	(COND ((EQN (SETQ A5 (QUOTIENT A5 D5)) D5)
	       (RETURN (CONS (CONS D5 2) C5)))
	      ((LESSP A5 (TIMES2 D5 D5))
	       (RETURN (CONS (CONS A5 1) (CONS (CONS D5 1) C5)))))
	% This means that the original A5 was > (Cadr PL)^3 !
	(SETQ F5 1)
  I	(COND ((ZEROP (REMAINDER A5 D5))
	       (SETQ F5 (ADD1 F5))
	       (SETQ A5 (QUOTIENT A5 D5))
	       (GO I)))
	(SETQ C5 (CONS (CONS D5 F5) C5))
	(COND ((EQ A5 1)
	       (RETURN C5))
	      ((LESSP A5 (TIMES2 D5 D5))
	       (RETURN (CONS (CONS A5 1)  C5))))
	(GO C)
))


%%%% From (pretty)inkexp


(DE SQRT (X) (COND ((LESSP 0 X) (CAR (SQRT1 X))) (0)) )

(DE SQRT1 (X)
    (COND ((LESSP X 4) (CONS 1 (SUB1 X)))
	  ((PROG (A B)
		 (SETQ A
		       (SQRT1 (CAR (SETQ B
					 (DIVIDE X
						 4)))))
		 (COND
		  ((LESSP (SETQ B
				(PLUS2 (TIMES2 4 (CDR A))
				       (CDR B)))
			  (ADD1 (TIMES2 4 (CAR A))))
		   (RETURN (CONS (TIMES2 2 (CAR A)) B)))
		  ((RETURN (CONS (ADD1 (TIMES2 2 (CAR A)))
				 (SUB1 (DIFFERENCE
					B
					(TIMES2
					 4 (CAR A))))))))))) )

(DE PRIMFAC (X)
    (PROG (A5 B5 C5 D5 E5 F5)
	  (SETQ E5 (CAR (SQRT1 (SETQ A5 X))))
	  (SETQ B5 PRIMLIST)
      A	  (SETQ D5 (CAR B5))
	  (COND ((LESSP E5 D5)
		 (RETURN (COND ((NULL C5)
				(QUOTE PRIME))
			       ((EQN A5 1)
				C5)
			       ((CONS (CONS A5
					    1)
				      C5)))))
		((ZEROP (REMAINDER A5 D5))
		 (SETQ F5 1)
		 (SETQ A5 (QUOTIENT A5 D5))
		 (GO B))
		((SETQ B5 (CDR B5)) (GO A)))
      C	  (RETURN (CONS NIL
			(CONS (CONS D5
				    (CONS (QUOTE
					   "SMALLER THAN ANY FACTOR IN")
					  (NCONS
					   A5)))
			      C5)))
      B	  (COND ((ZEROP (REMAINDER A5 D5))
		 (SETQ F5 (ADD1 F5))
		 (SETQ A5 (QUOTIENT A5 D5))
		 (GO B)))
	  (SETQ C5 (CONS (CONS D5 F5) C5))
	  (SETQ E5 (SQRT A5))
	  (COND ((SETQ B5 (CDR B5)) (GO A))
		((LESSP E5 D5)
		 (RETURN (COND ((EQN A5 1)
				C5)
			       ((CONS (CONS A5
					    1)
				      C5))))))
	  (GO C) ))


%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%

%%%% New things.

%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%

%	91-08-28: PSL has ODDP defined, whence I comment out this:
%(DM ODDP (numb) (LIST 'EQ (LIST 'REMAINDER (CADR numb) 2) 1))



	% Assuming prime pr1 much smaller than prime pr2, decide if pr1
	% is a quadratic residue (mod pr2) by means of the Gaussian
	% reciprocity theorem. Several variants, depending on pr2 (mod 4).
	%  Uses (pr1-1)/2 as third argument. (SHOULD BE MACRO's!)

(DE QUADRREST2P (pr2 pr2cong1p)
  (COND (pr2cong1p
	 (EQ (REMAINDER pr2 8) 1))
	(T
	 (EQ (REMAINDER pr2 8) 7))) )

(DE QUADRRESTP (pr1 pr2 pr2cong1p)
    (COND (pr2cong1p (QUADRREST1P pr1 pr2 (QUOTIENT pr1 2)))
	  (T (QUADRREST3P pr1 pr2 (QUOTIENT pr1 2)))) )

(DE QUADRREST1P (pr1 pr2 pr1h)
    (EQ (MODEXPT (REMAINDER pr2 pr1) pr1h pr1) 1) )

(DE QUADRREST3P (pr1 pr2 pr1h)
  (COND ((EQ (REMAINDER pr1 4) 1)
	 (EQ (MODEXPT (REMAINDER pr2 pr1) pr1h pr1) 1))
	(T
	 (NOT (EQ (MODEXPT (REMAINDER pr2 pr1) pr1h pr1) 1)))) )

(GLOBAL '(HalfPrime Prime PrPrime))

(DE FirstPrimitiveRoot ()
 (PROG	(quadrlist testlist testno prmod4 qr purgeexpts tlf factors)

	% To guarantee that STRONGPRIMFAC yields a list:
	(COND ((EQ Prime 3)
	       (RETURN 2)))

	(SETQ testlist (LIST (NCONS 3)
			     (NCONS 5)
			     (LIST 6 2 3)
			     (NCONS 7)
			     (LIST 10 2 5)
			     (NCONS 11)
			     (LIST 12 3)
			     (NCONS 13)
			     (LIST 14 2 7)
			     (LIST 15 3 5)))
	% Make the 2 power first in factors:
	(SETQ factors (REVERSE (STRONGPRIMFAC PrPrime)))
	(SETQ prmod4 (NOT (EQ (CDAR factors) 1)))
	(SETQ quadrlist (CDR factors))
	(SETQ testno 1)
  Fl	(COND (quadrlist
	       (SETQ testno (TIMES2 (CAAR quadrlist) testno))
	       (SETQ quadrlist (CDR quadrlist))
	       (GO Fl)))
	(SETQ purgeexpts (BINLIST (QUOTIENT PrPrime testno)))
	(SETQ quadrlist (SETQ factors (CDR factors)))
  Sl	(COND (quadrlist
	       (RPLACA quadrlist (BINLIST (QUOTIENT testno (CAAR quadrlist))))
	       (SETQ quadrlist (CDR quadrlist))
	       (GO Sl))
	      ((QUADRREST2P Prime prmod4)
	       (SETQ quadrlist (NCONS (CONS 2 T)))
	       (GO TLl))
	      (T
	       (SETQ quadrlist (NCONS (NCONS 2)))))
	(COND ((NOMODEXPTS1 (MODSMARTEXPT 2 purgeexpts Prime)
			    factors
			    Prime)
	       (RETURN 2)))
  TLl	(SETQ testno (CAAR testlist))
	(COND ((NOT (SETQ tlf (CDAR testlist)))
	       (SETQ qr (QUADRRESTP testno Prime prmod4))
	       (SETQ quadrlist (CONS (CONS testno qr) quadrlist))
	       (GO TLend)))
	(SETQ qr T)
  STLl	(COND ((NOT (CDR (ASSOC (CAR tlf) quadrlist)))
	       (SETQ qr (NOT qr))))
	(COND ((SETQ tlf (CDR tlf))
	       (GO STLl)))
  TLend	(COND ((AND (NOT qr)
		    (NOMODEXPTS1 (MODSMARTEXPT testno purgeexpts Prime)
				factors
				Prime))
	       (RETURN testno))
	      ((SETQ testlist (CDR testlist))
	       (GO TLl)))

	% Higher element tests.
	(SETQ testno 17)
  Hl	(COND ((EQ (SETQ tlf (STRONGPRIMFAC testno)) 'PRIME)
	       (SETQ qr (QUADRRESTP testno Prime prmod4))
	       (SETQ quadrlist (CONS (CONS testno qr) quadrlist))
	       (GO Hend)))
  SHl	(COND ((AND (ODDP (CDAR tlf))
		    (NOT (CDR (ASSOC (CAAR tlf) quadrlist))))
	       (SETQ qr (NOT qr))))
	(COND ((SETQ tlf (CDR tlf))
	       (GO SHl)))
  Hend	(COND ((AND (NOT qr)
		    (NOMODEXPTS1 (MODSMARTEXPT testno purgeexpts Prime)
				factors
				Prime))
	       (RETURN testno)))
	(SETQ testno (ADD1 testno))
	(GO Hl) ))

(DE MODSMARTEXPT (SMALLBASE BINBIGEXP BIGMOD)
 (PROG	(AA BB CC)	% (Sub)power;2^n-power;remaining bigexp
	(SETQ BB SMALLBASE) (SETQ AA 1) (SETQ CC BINBIGEXP)
	A
	(COND ((CAR CC)
	       (SETQ AA (REMAINDER (TIMES2 AA BB) BIGMOD))))
	(COND ((NOT (SETQ CC (CDR CC)))
	       (RETURN AA)))
	(SETQ BB (REMAINDER (TIMES2 BB BB) BIGMOD))
	(GO A)))

(DE BINLIST (numb)
 (PROG	(AA BB)
	(COND ((EQ numb 1)
	       (RETURN (NCONS T))))
	(SETQ BB (DIVIDE numb 2))
	Ml
	(SETQ AA (CONS (EQ (CDR BB) 1) AA))
	(COND ((EQ (CAR BB) 1)
	       (RETURN (REVERSE (CONS T AA)))))
	(SETQ BB (DIVIDE (CAR BB) 2))
	(GO Ml) ))

(DE NOMODEXPTS1 (base lbinlists bigmod)
 (PROG	(AA)
	(SETQ AA lbinlists)
  Ml	(COND ((NOT AA)
	       (RETURN T))
	      ((EQ (MODSMARTEXPT base (CAR AA) bigmod) 1)
	       (RETURN NIL)))
	(SETQ AA (CDR AA))
	(GO Ml) ))

%%%% Making the vectors EXPVECT and LOGVECT:

(GLOBAL '(EXPVECT LOGVECT FIRSTPRIMROOT))


% Make the vectors EXPVECT and LOGVECT, with entries 'exponents (mod Prime)'
% and 'logarithms (mod Prime)', respectively. FIRSTPRIMROOT should be the
% first primitive root (mod Prime), i.e., the smallest generator of the
% cyclic group (Z/(Prime))* of non-zero residues (mod Prime). EXPVECT[n]
% = FIRSTPRIMROOT^n (mod Prime), where n is a residue (mod PrPrime),
% the predecessor Prime - 1 to Prime. This establishes EXPVECT as a
% bijection from Z/(PrPrime) to (Z/(Prime))* ; LOGVECT be the inverse of
% this. Thus LOGVECT is undefined ( = NIL) on the residue class PrimeZ.
% For low values, the tables are calculated by increasing the exponent
% n by 1, calculating the new EXPVECT[n] by means of the old one, and
% saving both directions of the bijection simultaneously.
% If upb > Prime, EXPVECT and LOGVECT will be defined also for higher
% values, by putting EXPVECT[n]:=EXPVECT[ n (mod PrPrime) ] and
% LOGVECT[n] := LOGVECT[ n (mod Prime) ] .

(DE MakeEXP!&LOGVECTs (upb)
 (PROG	(EP LG)
%	(PUTV EXPVECT 0 1)
	(SETQ EP 1)
	(SETQ LG 0)
  Fl	(PUTV LOGVECT EP LG)
	(PUTV EXPVECT LG EP)
	(COND ((NOT (EQN (SETQ LG (ADD1 LG)) PrPrime))
	       (SETQ EP (REMAINDER (TIMES2 EP FIRSTPRIMROOT)
				   Prime))
	       (GO Fl)))
	(PUTV EXPVECT PrPrime 1)
	(COND ((NOT (LESSP PrPrime upb)) (RETURN T)))
  Sl	(SETQ LG (ADD1 LG))
	(PUTV LOGVECT LG (GETV LOGVECT (REMAINDER LG Prime)))
	(PUTV EXPVECT LG (GETV EXPVECT (REMAINDER LG PrPrime)))
	(COND ((NOT (EQN LG upb)) (GO Sl))) ))

%%%% From 'coefficients':

(DE StripExplode (item)
  (COND ((NOT (ATOM item))
	 (ERROR 0 "Bad argument to StripExplode"))
	((STRINGP item)
	 (REVERSE (CDR (REVERSE (CDR (EXPLODE item))))))
	(T
	 (EXPLODE item))) )

(DE List2String (list)
 (PROG	(IN UT IT)
	(COND ((NOT (SETQ IN (REVERSE list)))
	       (RETURN "")))
	(SETQ UT (NCONC (StripExplode (CAR IN)) '(!")))
	Ml
	(COND ((SETQ IN (CDR IN))
	       (SETQ UT (NCONC (StripExplode (CAR IN))
			       (CONS '!  UT)))
	       (GO Ml)))
	(RETURN (COMPRESS (CONS '!" UT))) ))


%%%% Input-output of rather long lists and vectors:

% Takes 1 or 2 arguments. Sets the first argument to a list
% (of length >= 1) of the following (unevaled) S-expressions,
% up to but not including the first one EQ to the second argument,
% or to NIL if no one is supplied.

(DF SETPROG (idnstop)
 (PROG	(AA BB CC)
	(COND ((NOT (IDP (CAR idnstop)))
	       (ERROR 0 "Bad argument to SETPROG")))
	(SETQ AA (SET (CAR idnstop) (NCONS (READ))))
	(SETQ BB (COND ((CDR idnstop) (CADR idnstop))))
  Ml	(COND ((NOT (EQ (SETQ CC (READ)) BB))
	       (RPLACD AA (NCONS CC))
	       (SETQ AA (CDR AA))
	       (GO Ml))) ))

% The first argument be an identifier, whose value be a non-nil list.
% This is written in a form readable by SETPROG, with NIL or the
% optional second argument as STOP S-expression.

(DF WRITEPROG (idnstop)
 (PROG	(AA)
	(COND ((NOT (IDP (CAR idnstop)))
	       (ERROR 0 "Bad argument to WRITEPROG")))
	(SETQ AA (EVAL (CAR idnstop)))
	(PRINT (CONS 'SETPROG idnstop))
  Ml	(PRINT (CAR AA))
	(COND ((SETQ AA (CDR AA))
	       (GO Ml)))
	(PRINT (COND ((CDR idnstop) (CADR idnstop)))) ))

% The next two procedures play similar roles, but for vectors.
% The second argument is the upper bound of the SET vector; this
% may be lower than the input vector to WRITEVECTPROG.

	% Shared with 'coefficients':

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

(DE WRITEVECTPROG (id uv)
 (PROG	(AA BB)
	(COND ((OR (NOT (IDP id))
		   (NOT (VECTORP (SETQ BB (EVAL id))))
		   (NOT (FIXP uv))
		   (LESSP uv 0)
		   (LESSP (UPBV BB) uv))
	       (ERROR 0 "Bad argument to WRITEVECTPROG")))
	(SETQ AA 0)
	(PRINT (LIST 'SETVECTPROG (LIST 'QUOTE id) uv))
  Ml	(PRINT (GETV BB AA))
	(COND ((NOT (EQN AA uv))
	       (SETQ AA (ADD1 AA))
	       (GO Ml))) ))


%%%% An updating routine for the list PRIMLIST of primes. I don't
%%%% find my original files, whence I rewrite it.

(DE PLUPDATE (limit)
 (PROG	(AA SQ BB)
%	(COND ((EQ (CAR PL) 2)
%	       (RPLACD PL (NCONS 3))
%	       (SETQ PL (CDR PL))))
	(SETQ AA (PLUS2 (CADR PL) 2))
  Ml	(COND ((LESSP limit AA)
	       (RETURN T)))
	(SETQ SQ (SQRT AA))
	(SETQ BB PRIMLIST)
  Sl	(COND ((EQN (REMAINDER AA (CAR BB)) 0)
	       (SETQ AA (PLUS2 2 AA))
	       (GO Ml))
	      ((NOT (LESSP SQ (CAR (SETQ BB (CDR BB)))))
	       (GO Sl)))
	(RPLACD (CDR PL) (NCONS AA))
	(SETQ PL (CDR PL))
	(SETQ AA (PLUS2 2 AA))
	(GO Ml) ))

	% Shared with 'coefficients':

(DE APPENDNUMBERTOSTRING (numb strng)
  (COND ((NOT (AND (NUMBERP numb) (STRINGP strng)))
	 (ERROR 0 "Bad arguments to APPENDNUMBERTOSTRING"))
	(T
	 (COMPRESS (NCONC (REVERSE (CDR (REVERSE (EXPLODE strng))))
			  (NCONC (EXPLODE numb) '(!")))))) )
