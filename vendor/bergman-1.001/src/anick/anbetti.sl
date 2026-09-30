%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%
%
%     Betti numbers calculation
%
%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%

%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%
%% Copyright (C) 1996
%% Alexander Podoplelov
%%
%% Bergman and Anick are distributed in the hope that they will be
%% useful, but WITHOUT ANY WARRANTY.  No author or distributor
%% accepts responsibility to anyone for the consequences of using them
%% or for whether they serve any particular purpose or work at all,
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

%  CHANGES:

% 2001-08-10: Various changes, in order to get Betti numbers for
% other objects than rings.
% In particular, anBETTI was split into object type depending
% versions./JoeB, SK, VU

% 1998-07-03: Added MEMBER2NIL and made minor changes in
% anbtMAKEMATRIXLINE (as a temporary patch)./JoeB

(OFF RAISE)

(GLOBAL '(anZERO anBETTINUMS anCURRENTBETTINUMS btMacMx !*CALCBETTI
	  !*ONFLYBETTI))

% This procedure initializes variables which are used to collect
% information about Betti Numbers. It should be called before
% Anick calculation.
(DE anBETTIINIT ()
 (PROGN
   (SETQ anBETTINUMS (NCONS NIL))
   (SETQ btMacMx NIL)
 )
)

% This function accepts a homological degree of a chain,
% a list of all chains, and returns the number of chains
% of that degree in that list.
(DE anbtNUMBEROFCHAINS(order chains)
 (PROG (i)
        (SETQ i 0)
        (MAPC chains (FUNCTION (LAMBDA (u)
                (COND ( (EQ (anChn2Length u) order) (SETQ i (ADD1 i)) ))
        )))
        (RETURN i)
 )
)


%(DE anbtMEMBER (what theset)
% (PROG	(ip rt) % Input; Return value
%	(COND ((NULL (SETQ ip theset))
%	       (RETURN NIL)))
%	(SETQ rt 0)
%  Ml	(COND ((EQ what (CAR ip))
%	       (RETURN rt))
%	      ((SETQ ip (CDR ip))
%	       (INCR rt)
%	       (GO Ml)))
% )
%)




% MEMBER2NIL (element:any, list:lany) : genint ; DESTRUCTIVE (2)
%     Searches list for its first occurrence of element.
%     If found, the occurrence is (destructively) replaced by
%     NIL, and the number of the position of element in list is
%     returned. If element is not found in list, NIL is returned.
(DE MEMBER2NIL (what theset)
 (PROG  (ip rt) % Input; Return value
	(COND ((NULL (SETQ ip theset))
	       (RETURN NIL)))
	(SETQ rt 0)
  Ml	(COND ((EQ what (CAR ip))
	       (RPLACA ip NIL)
	       (RETURN rt))
	      ((SETQ ip (CDR ip))
	       (SETQ rt (ADD1 rt))
	       (GO Ml)))
 )
)


%    anbtZEROPROLONG (c:lratcoeff, n:int) : lratcoeff ;
%         Returns a list whose first n elements are NIL (representing
%	  the coefficient zero), and which than continues with the list
%	  ``tail''.
(DE anbtZEROPROLONG (lrtcf int)
 (PROG	(i rt)
	(COND ((ZEROP (SETQ i int))
	       (RETURN lrtcf)))
	(SETQ rt lrtcf)
   L1	(SETQ rt (CONS anZERO rt))
	(COND ((EQ (SETQ i (SUB1 i)) 0)
	       (RETURN rt)))
	(GO L1)
 )
)


%    anbtALIGN (m:llgenredandcoeff) : matrix ; DESTRUCTIVE
%          This procedure destructively modifies the matrix "m" so
%	  that all its lines are prolonged by zero coefficients and
%	  have equal length, the length of its first input line.
%	  (Consequently, no other input line may be longer than the
%	  first one.) Besides aligning, to each line of the
%	  matrix the INTEGERISE function is applied. The modified
%	  matrix is returned.
(DE anbtALIGN(matrix)
 (PROG (m r i)
	(COND ( (NULL matrix)
		(RETURN NIL) ))
	(SETQ m (LENGTH (CAR matrix)))
	(SETQ r matrix)
  Ml	(INTEGERISE (CAR r))
	(COND ((SETQ r (CDR r))
	       (RPLACA r
		       (anbtZEROPROLONG (CAR r)
					(DIFFERENCE m (LENGTH (CAR r)))))
	       (GO Ml)))
	(RETURN matrix)
 )
)



%    anbtMAKEMATRIXLINE (id:lchn, pol:sdp) : lcoeff ;
%         Returns a list of coefficients which are extracted from the pol.
%	  Only coefficients of semi-distributed monomials where
%	  corresponding qpol is equal to one are looked for.
%	  The corresponding chains to those qpols are placed into
%	  "id" list.  Extracted coefficients are arranged according to the
%	  list "id" which is updated every time.
% colsIDlist = ( NIL (chnn) ... (chn2) (chn1) ) or ( NIL ) for the first time.
(DE anbtMAKEMATRIXLINE (colsIDlist sdp)
 (PROG (a rt locols lcp)
        (SETQ a (CDR sdp))
   L1   (COND   ( (Mon!= (APol2Lm (anSDP2FirstQPol a)) MONONE)
		  (SETQ locols
			(CONS (CONS (anSDP2FirstChn a)
				    (Cf (QPol2LRatTm (anSDP2FirstQPol a))))
			      locols)
                  )
                )
        )
	(COND ( (anNextSDPTail a)
		(GO L1)
	      )
	)
	(COND ( (NULL locols) (RETURN NIL) ) )
	(SETQ locols (CONS NIL locols) )
	(COND ( (NULL (SETQ a (CDR colsIDlist))) (GO L4) ) )
	(SETQ rt (TCONC NIL NIL))
   L2	(COND ( (NOT (CDR (SETQ lcp locols))) (GO L5) ))
   L3   (COND ( (anChn!= (CAR a) (CAADR lcp))
		(TCONC rt (CDADR lcp)) % extracting the coefficient
		(RPLACD lcp (CDDR lcp))
	      )
	      
	      ( (NULL (CDR (SETQ lcp (CDR lcp)))) (TCONC rt anZERO) )
	      ( T (GO L3) )
	)
	(COND ( (SETQ a (CDR a)) (GO L2) ) )
	(SETQ rt (CDAR rt))
   L4   (COND ( (NULL (SETQ locols (CDR locols))) (RETURN rt) ) )
	(RPLACD colsIDlist (CONS (CAAR locols) (CDR colsIDlist)))
	(SETQ rt (CONS (CDAR locols) rt))
	(GO L4)
   L5	(TCONC rt anZERO)
	(COND ( (SETQ a (CDR a)) (GO L5) ) )
	(RETURN (CDAR rt))
 )
)


%    anbtMAKEMATRIX (order:int, chains:lchn) : llcoeff ;
%         This procedure accepts homological degree "order" and a list
%	  of chains "lchn", and returns a "matrix" of coefficients of
%	  all the semi-distributed tensor polynomials corresponding
%	  to chains of that degree. The lines of its output "matrix"
%	  may have different lengths, however.
% chains = ( (chn1) (chn2) ... )
(DE anbtMAKEMATRIX (order chains)
 (PROG  (cols i rt cp)
	(SETQ cols (NCONS NIL))
	(SETQ cp chains)
  Ml	(COND ( (NULL cp)
		(RETURN (anbtALIGN rt))))
	(COND ( (EQ (anChn2Length (CAR cp)) order)
		(SETQ i
		      (anbtMAKEMATRIXLINE cols 
					  (anChn2Diff (CAR cp))))
		(COND ( (NOT (NULL i))
			(SETQ rt (CONS i rt))
			))
                ))
	(SETQ cp (CDR cp))
        (GO Ml)
 )
)


%    anRingBETTI (chains:lchn) : - ;
%         The procedure accepts as its argument a list which is an
%	  element of the anCHAINS degree list. More precisely,
%	  its tail is a list of chains, but the first element equals
%	  their homological degree. The procedure updates Betti
%	  numbers which are storied in anCURRENTBETTINUMS for this
%	  particular homological degree. anCURRENTBETTINUMS is some
%	  tail of the anBETTINUMS list.
% chains = ( deg (chn1) (chn2) ... ) - an element from anCHAINS
(DE anRingBETTI(chains)
 (PROG (Qc Qn Rc Rn order top chns B lp cp)
	(SETQ lp (SETQ cp (LASTPAIR anBETTINUMS)))
        (SETQ chns (CDR chains))
        (SETQ top  (CAR chains))
        (SETQ order (SETQ Rc 0))
        (SETQ Qc (anbtNUMBEROFCHAINS 0 chns))
   L1   (SETQ Qn (anbtNUMBEROFCHAINS (ADD1 order) chns))
        (SETQ Rn
                (COND   ( (OR (EQ Qn 0) (EQ (ADD1 order) top)) 0 )
                        ( T     (anRANK (anbtMAKEMATRIX (ADD1 order) chns)) )
                )
        )
        (SETQ B (DIFFERENCE Qc (PLUS2 Rc Rn)))
        (COND ( (NEQ B 0)
		(RPLACD cp (NCONS (CONS (CONS order top) B) ))
		(SETQ cp (CDR cp))
		(anbtMacSet order top B)
        ))
        (SETQ Qc Qn)
        (SETQ Rc Rn)
        (SETQ order (ADD1 order))
        (COND ( (LESSP order top) (GO L1) ))
	% Here conditional printing of the new BETTINUMs should be inserted;
	% or (more modularised):
	(SETQ anCURRENTBETTINUMS (CDR lp))
 )
)


%    anALLBETTI () : - ;
%         This procedure applies the procedure anBETTI to all elements
%	  of the anCHAINS list. It should be called if the calculation
%	  of Betti numbers was not invoked during calculation of the Groebner
%	  basis.
(DE anALLBETTI () (MAPC anCHAINS (FUNCTION (LAMBDA (u) (anBETTI u)))))


%    PRINTBETTINUMBER (btnumber:btnum) : - ;
%          Prints Betti number btnumber as follows:
%	                 B(order, degree) = value
%    The procedure chould be changed when weights would be possible
%    for Anick. Here artificially weights for module variables
%    are made to be equal zero VU-01.08.16
(DE PRINTBETTINUMBER (btnum)
  (PROGN  (PRIN2 "B(")
	  (COND ((EQ (GETOBJECTTYPE) 'RING)(PRIN2 (ADD1 (CAAR btnum))))
                (T (PRIN2 (CAAR btnum))))
	  (PRIN2 '!,)
	  (COND ((EQ (GETOBJECTTYPE) 'RING)(PRIN2 (CDAR btnum)))
                ((EQ (GETOBJECTTYPE) 'TWOMODULES)
                 (PRIN2 (DIFFERENCE (CDAR btnum) 2)))
                (T (PRIN2 (DIFFERENCE (CDAR btnum) 1))))
	  (PRIN2 ")=")
	  (PRINT (CDR btnum))
  )
)

%    PRINTBETTI () : - ;
%          Prints all the calculated  Betti numbers.
%          ((Applies the procedure PRINTBETTINUMBER to all elements of the
%	  anBETTINUMS list.))
(DE PRINTBETTI () (MAPC (CDR anBETTINUMS) (FUNCTION PRINTBETTINUMBER)))

%    PRINTCURRENTBETTI () : - ;
%          Prints Betti numbers for the last calculated Groebner basis
%	  degree. Applies the procedure PRINTBETTINUMBER to all
%         elements of the anCURRENTBETTINUMS list.
(DE PRINTCURRENTBETTI () (MAPC anCURRENTBETTINUMS (FUNCTION PRINTBETTINUMBER)))

%    anbtMacCorrect (deg:int) : bool ;
%         This procedure takes a degree for updating Betti numbers in
%	  a nice Macaulay form so that later it is possible to print them.
%	  It affects only internal btMacMx structure and return either
%	  T or NIL depending on whether the update actually changed
%	  btMacMx.
(DE anbtMacCorrect ( deg )
 (PROG (i j cl)
	(COND ( (LESSP (SETQ i (DIFFERENCE deg (LENGTH btMacMx))) 0)
		(RETURN NIL) ))
	(SETQ cl btMacMx)
   L1	(COND ( (NULL cl) (GO LADD) ))
	(SETQ j i)
   L2	(COND ( (LESSP 0 j)
		(NCONC (CAR cl) (NCONS NIL))
		(SETQ j (SUB1 j))
		(GO L2)))
	(SETQ cl (CDR cl))
	(GO L1)
   LADD	(COND ( (EQN i 0) (RETURN T) ))
	(SETQ j (SETQ i (SUB1 i)))
	(SETQ cl (NCONS NIL))
   L3	(COND ( (LESSP 0 j)
		(NCONC cl (NCONS NIL))
		(SETQ j (SUB1 j))
		(GO L3) ))
	(COND ( (NULL btMacMx) (SETQ btMacMx (NCONS cl)) )
	      (T (NCONC btMacMx (NCONS cl)) ))
	(GO LADD)
 )
)

%    anbtMacSet (order:int, degree:int, value:int) : bool ;
%          Sets the value of Betti number in Macaulay form of corresponding
%	  "order" and "degree" to "value". Returns boolean value T.
(DE anbtMacSet (o p v)
 (PROG (i j)
	(COND ( (LESSP (LENGTH btMacMx) p) (anbtMacCorrect p) ))
	(SETQ i btMacMx)
	(SETQ j 1)
   L1	(COND ( (LESSP j (DIFFERENCE p o)) (SETQ j (ADD1 j)) (SETQ i (CDR i)) (GO L1)))
	(SETQ i (CAR i))
	(SETQ j 0) 
   L2	(COND ( (LESSP j o) (SETQ j (ADD1 j)) (SETQ i (CDR i)) (GO L2)))
	(RPLACA i v)
	(RETURN T)
 )
)

%    MACBETTIPRINT () : bool ;
%          Prints Betti numbers in Macaulay form. Returns boolean value T.
%    The procedure chould be changed when weights would be possible
%    for Anick. Here artificially weights for module variables
%    are made to be equal zero VU-01.08.16
(DE MACBETTIPRINT ()
 (PROG (i j len pos shift l cdeg)
	(SETQ len 4)
	(SETQ shift 4)
	(SETQ cdeg (LENGTH btMacMx))
	(SETQ l 0)
   L0	(COND ( (LESSP l (ADD1 cdeg))
		(TAB (PLUS2 shift (TIMES2 l len)))
		(PRIN2 l) (SETQ l (ADD1 l)) (GO L0) ))
	(SETQ l 0)
	(TAB 0) (PRIN2 "  +-")
   L0_1	(COND ( (LESSP l (ADD1 (TIMES cdeg len)))
		(PRIN2 '!-) (SETQ l (ADD1 l)) (GO L0_1) ))
	(SETQ l 0)
	(SETQ i btMacMx)
        (COND ((EQ (GETOBJECTTYPE) 'TWOMODULES) (SETQ i (CDR i)))) %SK&VU
   L1	(COND ( (NULL i) (TERPRI) (RETURN T) ))
	(SETQ pos 1)
	(SETQ j (CAR i))
   L2	(COND ( (NULL j) (SETQ i (CDR i)) (GO L1)))
	(COND ( (EQ j (CAR i))
		(TERPRI) (PRIN2 l) (TAB 2) (PRIN2 "|")
                (COND  ((EQ (GETOBJECTTYPE) 'RING)      %SK&VU
	        	(TAB shift)
		        (COND ( (EQ i btMacMx) (PRIN2 1) )
		                (T (PRIN2 '!-) )))
                         )%endCond   SK&VU
		(SETQ l (ADD1 l))  
	      )
	)
	(TAB (PLUS2 shift (TIMES2  len %SK&VU
                           (COND ((NOT (EQ (GETOBJECTTYPE) 'RING))
                                 (SUB1 pos))
                                 (T pos))))) % end SK&VU 
	(SETQ pos (ADD1 pos))
	(COND ( (NULL (CAR j)) (PRIN2 '!-) )
	      (T (PRIN2 (CAR j))))
	(SETQ j (CDR j))
	(GO L2)
 )
)

(DE anExtractBettiModes ()
 (LIST	(LIST 'BETTI !*CALCBETTI)
	(LIST 'BETTI-FOREACHDEGREE !*ONFLYBETTI)
 )
)

(ON RAISE)
