%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%% 
%
%     Implementation of the in/out routines for tensor polynomial
%     structure.
%
%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%% 


(OFF RAISE)

%%%%  CHANGES (after 1999-11-15): %%%%

%  Quoted ModeProperties!* in PUT/GET calls./JoeB 2005-06-26

%    SObeg
%        This string is printed in the beginning of a tensor monomial.
%
%    SOmid
%        This string is printed for a tensor multiplication sign.
%
%    SOend
%        This string is printed in the end of a tensor monomial.
%
%    anPrintSDPMode
%        Contains the mode which is used for printing semi-distributed
%	polynomials. The values are DISTRIBUTED and SEMIDISTRIBUTED.
(GLOBAL '(SObeg SOmid SOend anPrintSDPMode ModeProperties!*))

% Property assignments
(PUT 'ModeProperties!* 'anPrintSDPMode 'anAssignSDPMode)
(PUT 'ModeProperties!* 'TENSTERM!-PRINTMODE 'anAssignTMstrings)

% %%%%%% Printing tensor polynomial %%%%%%%

%    anSDP!_PRETTYPRINTSDP (pol:sdtp) : - ;
%        Prints semi-distributed polynomial pol in a semi-distributed
%	form.
(DE anSDP!_PRETTYPRINTSDP (tp)  
%Var types:
%tp     : semidestributedtensorpolynomial
 (PROG (BB AA AO!+ AO!- AO!* AO!^ AObop!+ AObop!- AOeop AObol AOeol
        FirstPrt C)
          (SETQ AO!* "")
          (SETQ FirstPrt T)
          (SETQ AA tp) 
   M1     (anNextSDPTail AA)
          (COND
             ( (NULL AA) (GO MOUT) )
          )%COND
          (SETQ BB (PPol (anSDP2FirstQPol AA)))
   M2     (COND
             ( BB
                (anPRT2 (COND 
                             ( (MINUSP (SETQ C (RedandCoeff2OutCoeff (Lc BB))))
                                      (SETQ C (MINUS C)) "-" ) % "-"
			     (T (COND ( FirstPrt 
                                         (SETQ FirstPrt NIL) "" )
                                      (T "+")
                                ) )%COND
                       )%COND
                )%anPRT2
	        (COND ((PRINTQPOLRATFACTOR (anSDP2FirstQPol AA))
		       (anPRT2 '!*)))
                (COND
                  ( (NOT (EQ C 1)) (anPRT2 C) (anPRT2 AO!*) )
                )%COND
                (anPRT2 SObeg)
                (PRINTCHAIN (anSDP2FirstChn AA))
                (anPRT2 SOmid)
                (COND ((NOT (Mon!= (Lm BB) MONONE)) (MONPRINT (Lm BB)))
                      (T (anPRT2 1))
                )%COND
                (anPRT2 SOend)
                (PolDecap BB)
                (GO M2)
             )
          )%COND
          (GO M1)
MOUT
 )%PROG
) %DE

%    anDP!_PRETTYPRINTSDP (pol:sdtp) : - ;
%        Prints semi-distributed polynomial pol in a distributed form.
(DE anDP!_PRETTYPRINTSDP (tp)  
%Var types:
%tp     : semidestributedtensorpolynomial
 (PROG (BB AA AO!+ AO!- AO!* AO!^ AObop!+ AObop!- AOeop AObol AOeol
	FirstPrt C rc)
          (SETQ AO!* "")
          (SETQ FirstPrt T)
          (SETQ AA tp) 
   M1     (anNextSDPTail AA)
          (COND
             ( (NULL AA) (GO MOUT) )
          )%COND
          (SETQ BB (PPol (anSDP2FirstQPol AA)))
   M2     (COND
             ( BB
	        (SETQ rc
		      (SHORTENRATCF
		       (REDANDCFS2RATCF (TIMES2 (PolNum (anSDP2FirstQPol AA))
						(Lc BB))
					(PolDen (anSDP2FirstQPol AA)))))
                (anPRT2 (COND ((REDANDCFNEGATIVE (RedandCoeff2OutCoeff
						  (RATCF2NUMERATOR rc)))
			       (SETQ rc (RATCF!- rc))
			       "-" )
			      (T (COND ( FirstPrt % A feature on the bug boundary
					 (SETQ FirstPrt NIL) "" )
				       (T "+")
				       ) )%COND
                       )%COND
                )%anPRT2
	        (COND ((PRINTRATCF rc)
		       (anPRT2 AO!*)))
                (anPRT2 SObeg)
                (PRINTCHAIN (anSDP2FirstChn AA))
                (anPRT2 SOmid)
                (COND ((NOT (Mon!= (Lm BB) MONONE)) (MONPRINT (Lm BB)))
                      (T (anPRT2 1))
                )%COND
                (anPRT2 SOend)
                (PolDecap BB)
                (GO M2)
             )
          )%COND
          (GO M1)
MOUT
 )%PROG
) %DE

%    PRINTTENSORPOLSDISTRIBUTED () : - ;
%        Selects distributed form for printing semi-distributed
%	polynomials.
(DE PRINTTENSORPOLSDISTRIBUTED ()
 (PROG (!*USERMODE !*REDEFMSG)
       (COPYD 'PRETTYPRINTSDP 'anDP!_PRETTYPRINTSDP)
       (SETQ anPrintSDPMode 'DISTRIBUTED) ))

%    PRINTTENSORPOLSSEMIDISTRIBUTED () : - ;
%        Selects semi-distributed form for printing semi-distributed
%	polynomials.
(DE PRINTTENSORPOLSSEMIDISTRIBUTED ()
 (PROG (!*USERMODE !*REDEFMSG)
       (COPYD 'PRETTYPRINTSDP 'anSDP!_PRETTYPRINTSDP)
       (SETQ anPrintSDPMode 'SEMIDISTRIBUTED) ))

(FLAG '(PRETTYPRINTSDP) 'USER)

%    GETTENSORPOLSPRINTMODE () : id ;
%        Returns the identifier which is a keyword either DISTRIBUTED
%	or SEMIDISTRIBUTED. This identifier points out how the current
%	semi-distributed polynomials are printed.
(DE GETTENSORPOLSPRINTMODE () (PROGN anPrintSDPMode))

(PRINTTENSORPOLSSEMIDISTRIBUTED)

(DE anExtractTPModes ()
 (LIST	(LIST 'TENSPOL!-PRINTMODE (GETTENSORPOLSPRINTMODE))
	(LIST 'TENSTERM!-PRINTMODE (LIST SObeg SOmid SOend))
 )
)


(DE anAssignSDPMode (var kwd)
    (PROGN
     (COND ( (EQ kwd 'DISTRIBUTED) (PRINTTENSORPOLSDISTRIBUTED))
	   ( (EQ kwd 'SEMIDISTRIBUTED) (PRINTTENSORPOLSSEMIDISTRIBUTED))
	   (T
	     (PRIN2 "Wrong keyword for printing tp's : ")
	     (PRIN2 kwd)
	     (TERPRI)
	   )
     )
     NIL
    )
)


(DE anAssignTMstrings (var lst) 
    (PROGN
     (COND ( (NOT (AND (LISTP lst) (EQ (LENGTH lst) 3)))
	     (PRIN2 "Wrong value for tensor output strings")
	     (TERPRI)
	   )
	   (T
	     (SETQ SObeg (CAR lst))
	     (SETQ SOmid (CADR lst))
	     (SETQ SOend (CADDR lst))
	   )
     )
     NIL
    )
)



%(DE anFLIPFLAG (var boolval)
%    (PROGN
%     (COND ( (NULL boolval) (SET var NIL))
%	   (T (SET var T))
%     )
%    )
%)

%(DE anASSIGNSTRING (var str)
%    (PROGN
%     (COND ( (NOT (STRINGP str))
%	     (PRIN2 "not a string value for ")
%	     (PRIN2T var)
%	     NIL
%           )
%     )
%     (SET var str)
%    )
%)



(ON RAISE)
