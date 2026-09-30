%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%
%
%     Betti numbers calculation
%
%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%

%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%
%% Copyright (C) 1996,1998
%% Alexander Podoplelov
%%
%% Bergman and Anick are distributed in the hope that they will be
%% useful, but WITHOUT ANY WARRANTY.  No author or distributor
%% accepts responsibility to anyone for the consequences of using them
%% or for whether they serve any particular purpose or work at all,
%% unless (s)he says so in writing.  Refer to the Bergman General Public
%% License for full details.

%% Everyone is granted permission to copy, modify and redistribute
%% bergman, but only under the conditions described in the
%% Bergman General Public License.   A copy of this license is
%% supposed to have been given to you along with bergman so you
%% can know your rights and responsibilities.  It should be in a
%% file named copyright.  Among other things, the copyright notice
%% and this notice must be preserved on all copies.
%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%


%  CHANGES 1997-03-19 -- ... :
%  RANK now calls the new procedure INPUTMATRIX2REDANDMATRIX, which
% replaces the input coefficients in its matrix input with reductand
% coefficients.


(OFF RAISE)

(GLOBAL '(anZERO))

%    MPRINT (mat:matrix) : bool ;
%          Prints mat as a matrix to standard output and returns T, if
%	  that is not NIL. Else it prints nothing and returns NIL.
(DE MPRINT (matrix)
 (PROG (r c)
        (SETQ r matrix)
   L1   (COND ( (NULL r) (RETURN NIL) ))
        (SETQ c (CAR r))
   L2   (COND ( (NULL c) (GO LNEXT) ))
        (PRIN2 (CAR c)) (PRIN2 (LIST2STRING '(9)) )
        (SETQ c (CDR c))
        (GO L2)
 LNEXT  (TERPRI)
        (SETQ r (CDR r))
        (GO L1)
  LOUT  (RETURN T)
 )
)

%    CFLINEPRINT (ln:lcoeff) : bool ;
%          Prints the list of coefficients ln in one line and returns
%	  T if ln is non-NIL. Else it prints nothing and returns NIL.
(DE CFLINEPRINT (line)
 (PROG (c)
        (COND ( (NULL (SETQ c line)) (RETURN NIL)))
   L1   (COND ( (NOT (CAR c)) (PRIN2 0))
	      ( (NOT (PRINTRATCF (CAR c))) (PRIN2 1)))
        (COND ( (SETQ c (CDR c))
		(PRIN2 (LIST2STRING '(9)) )
		(GO L1) ))
	(TERPRI)
        (RETURN T)
 )
)




%    RANK (mat:inputmatrix) : int ;
%          Returns the rank of mat calculated in present coefficient
%	  field.
(DE RANK (matrix)
 (PROG (n m r)
        (COND   ( (NULL matrix) (RETURN 0) ))
        (SETQ m (LENGTH (CAR matrix)))
        (SETQ n (LENGTH matrix))
        (SETQ r matrix)
   L1   (COND
                ( (NOT (NULL r))
                        (COND ( (NEQ m (LENGTH (CAR r)))
                                        (PRIN2 "***Invalid matrix format to calculate its rank")
                                        (TERPRI)
                                        (RETURN NIL)
                        ))
                        (SETQ r (CDR r))
                        (GO L1)
                )
        )
        (RETURN (anRANK (INPUTMATRIX2REDANDMATRIX (COPY matrix))))
 )
)


%    INPUTMATRIX2REDANDMATRIX (mtrx:inputmatrix) : matrix ; DESTRUCTIVE
%          Modifies the elements of mtrx so that their type is of
%	  acceptance by further procedures.
(DE INPUTMATRIX2REDANDMATRIX (mtrx)
 (PROG	(rp cp) % Row position; Column position.
	(SETQ rp mtrx)
  Ml	(COND ((NULL rp)
	       (RETURN NIL)))
	(SETQ cp (CAR rp))
  Sl	(COND (cp
	       (RPLACA cp (InCoeff2RedandCoeff (CAR cp)))
	       (SETQ cp (CDR cp))
	       (GO Sl)))
	(SETQ rp (CDR rp))
	(GO Ml) ))


%    anRANK (mat:matrix) : int ; DESTRUCTIVE
%          Returns the rank of mat.
%	  Transform mat to triangular form by applying Gauss
%	  method.
(DE anRANK (matrix)
 (PROG (r r1 c c0 c1 tm tm1 i i1 nod a1 rt) % Changed 1997-03-20/JoeB
        (SETQ r matrix)
	(SETQ  rt 0)
  L1    (COND ( (NULL r) (RETURN rt) ))
        (SETQ c (CAR r))
        (SETQ i 0)
  L2    (COND ( (NULL c)          (SETQ r (CDR r)) (GO L1) )
              ( (EQ (CAR c) anZERO) (SETQ i (ADD1 i)) (SETQ c (CDR c)) (GO L2) )
        )
	(RedandLine2RedorLine c)
	(SETQ rt (ADD1 rt))
        (SETQ r1 (CDR r))
  L3    (COND ( (NULL r1) (SETQ r (CDR r)) (GO L1) ))
        (SETQ c1 (CAR r1))
        (SETQ i1 i)
  L4    (COND ( (LESSP 0 i1)
		(SETQ i1 (SUB1 i1)) (SETQ c1 (CDR c1)) (GO L4) )
              ( (EQ (CAR c1) anZERO)
		(SETQ r1 (CDR r1)) (GO L3) )
	)
	(ReduceLineStep (CAR r1) c1 c)
	(SETQ r1 (CDR r1))
	(GO L3)
 )
)


(ON RAISE)
