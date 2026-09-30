%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%
% TENSPOL = TENSOR POLYNOMIAL
% represented in a semi-distributed form.
%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%

%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%
%% Copyright (C) 1996,2002
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

%	CHANGES:

% Corrected anSORTSDTp. Replaced NE by NOT EQ./JoeB 2002-10-09.

% Added anSORTSDTp for other type of ordning than DEGLEX, VU 02-07-02
% (VU also added anHIGHESTTENSMONOM2PureMon, anTENSDPTmLESSP,
% anRestoreTensorder

(OFF RAISE)

% Internal representation of the TENSPOL is as following:
% (NIL (Chn1,QPol1) (Chn2,QPol2) ... )
%   where Chni - chains, QPoli - augmented polynomials
% (Access the parts only by means of anSDP2... macros!)

%    anCONCATTENSPOLMON (pol:sdtp, mon:augmon) : sdtp ;
%	Concatenates mon to each element of the tensor polynomial pol
%	to the right side, reduces them by means of the current
%	Groebner basis, and returns the result.
%Concatenates h to each polynomail in cp and reduces them
(DE  anCONCATTENSPOLMON (cp h)
% cp : semidestributedtensorpolynomial
% h  : augmon
 (PROG (i j rt)
     (SETQ rt (SETQ i (CONS NIL (DPLISTCOPY (CDR cp)))))
 Lp  (COND
        ( (CDR i)
          (SETQ j (NORMALFORM (QPOLMONMULT (anSDP2NextQPol i) (PMon h))))
	  (COND ((NOT j) (anRemoveSDPTm i))
		(T
	         (anReplaceQPolinSDPTm (anSDP2NextSDPTm i) j)
	         (anNextSDPTail i)))
          (GO Lp)
        )
     )%COND
     (COND ( (EQ (GETNONCOMMORDER) 'TDEGLEFTLEX) (RETURN rt))
           (  T (RETURN (anSORTSDTp rt)))) 
    % added anSORTSDTp for other type of ordning than DEGLEX, VU 02-07-02
 )
)
 
%    anMAKETENSPOL (inchain:chn, mon:augmon) : sdtp ;
%	Creates and returns the tensor polynomial which contains only
%	one element: inchain tensor multiplied by mon.
(DE  anMAKETENSPOL (g h)
% g : chain
% h : augmon
  (CONS NIL
	(NCONS (anChn!&QPol2SDPTm g (Tm2QPol (Cf!&Mon2Tm REDANDCOEFFONE h))))
  )
)

(DE anHIGHESTTENSMONOM2PureMon (sdtm)
  (PROG (highestterm res)
   (SETQ  highestterm (CONS (anSDPTm2Chn  sdtm) (QPol2LRatTm(anSDPTm2QPol sdtm ))))
 (SETQ res   (MONTIMES2 (PMon (CHAIN2AUGMON (CAR highestterm ))) (PMon (CDDR highestterm ))))
  (RETURN (PMon res))
))

% Procedure for tensor polynomials comparison.  VU 02-07-02
%cannot be applied if they are equal and not TDEGLEFTLEX !
%# anTENSDPTmLESSP (SDPterm,SDPterm) : bool ;
(DE anTENSDPTmLESSP  (sdtm1 sdtm2)
(COND ((EQ (GETNONCOMMORDER) 'TDEGLEFTLEX)
           (anLESSCHAIN (anSDPTm2Chn sdtm1) (anSDPTm2Chn sdtm2)))
      (T  (MONLESSP (anHIGHESTTENSMONOM2PureMon sdtm1) (anHIGHESTTENSMONOM2PureMon sdtm2)))))



%(COPYD 'anTENSDPTmLESSP 'anTENSDPTmLESSPlex)

% Procedure to restore the order: Not efficient.  VU 02-07-03
% First sdtpm may be not highest, rest is ordered already.
% Is used  eg after the changing of the polynomial part.
% As result the leading SDPterm
% may be new, so it is necessary to move the old one down. VU 02-07-01

(DE anRestoreTensorder (sdtp)
 (PROG	(term a)
	%(PRIN2 "in anRestoreTensorder sdtp=")(PRETTYPRINTSDP sdtp)(TERPRI)
	(SETQ term (anSDP2NextSDPTm sdtp)) 
	(COND ((anSDP0!?  (anSDPTail  sdtp))(RETURN NIL)))
	(COND ( (anTENSDPTmLESSP (anSDP2NextSDPTm (anSDPTail  sdtp)) term)
		(RETURN NIL)))

	% term is not largest - we need to replace it.
	% Note that chains are different! 
	(anRemoveSDPTm sdtp)
	% First it was removed
	% (PRIN2 "in anRestoreTensorder after removing sdtp=")(PRETTYPRINTSDP sdtp)(TERPRI)

	(SETQ a  sdtp ) 
  L	(anNextSDPTail a) 
	(COND ( (anSDP0!? a) (anInsertSDPTm a term) (RETURN NIL) )
	      ( (anTENSDPTmLESSP ( anSDP2FirstSDPTm a) term )
		(anInsertSDPTm a term)
		(RETURN NIL) )    
	      ( T (GO L))
	      )%END COND
 ))
     
% Procedure to sort tensorpolynomials completely.: Not efficient.
% Destructive VU 02-07-02

% Corrected (?) JoeB 02-10-09
(DE anSORTSDTp (sdtp)
 (PROGN (COND ((NOT (OR (anSDP0!? sdtp) (anSDP0!? (anSDPTail sdtp))))
	       (anSORTSDTp (anSDPTail  sdtp))
	       (anRestoreTensorder sdtp)))
	sdtp )) 



%    anDESTRUCTADDTENSPOLS (pol1:sdtp,pol2:sdtp,cf:coeff):sdtp; DESTRUCTIVE(1)
%	Modifies pol1 so that pol1 = pol1+cf*pol2.
%	Returns the modified pol1.
(DE  anDESTRUCTADDTENSPOLS (sdp1 sdp2 cf)
% sdp1, sdp2 : semi-destributed tensor polynomials
% cf : coeffitient
% result : sdp1=sdp1+cf*sdp2
(PROG (a b c p)

    (SETQ a sdp1)
    (SETQ b (CDR sdp2))
 L4
     (COND
        ( (NULL b) (GO OUTLABEL) )
        ( (NULL (CDR a))
            (GO L5)
        )
          %this first to skip eqaulity in comparison of anTENSDPTmLESSP VU 02-07-04
        ( (anChn!= (anSDP2NextChn a) (anSDP2FirstChn b))
                (COND 
                   ( (NULL (DestructQPolSimpSemiLinComb 
                           (anSDP2NextQPol a) 
                           (anSDP2FirstQPol b) 
                           cf)
                     )
                        (anRemoveSDPTm a)
                   )
 % Added for nondeglex order  VU 00-07-02 
                   ((NOT (EQ (GETNONCOMMORDER) 'TDEGLEFTLEX))
		    (anRestoreTensorder a))
                )%COND
                (anNextSDPTail b)
                (GO L4)
        )
% Replaced  anLESSCHAIN by  anTENSDPTmLESSP    VU 00-07-02 
        ((anTENSDPTmLESSP (anSDP2NextSDPTm a) (anSDP2FirstSDPTm b))
          (DestructQPolCoeffTimes (anSDP2FirstQPol b) cf)
          (anInsertSDPTm a (anSDP2FirstSDPTm b))
          (anNextSDPTail b)
          (anNextSDPTail a)
          (GO L4)
        )
        
        (T (anNextSDPTail a) (GO L4))
    )%COND
 L5 (RPLACD a b)
 L6 (COND
      ( (NOT (NULL b))
        (DestructQPolCoeffTimes (anSDP2FirstQPol b) cf)
        (anNextSDPTail b)
        (GO L6)
      )
    )
OUTLABEL 
   (RETURN sdp1)
 )
)

%    anEXTRACTHIGHTENSMON (pol:sdtp) : (chn . augmon) ;
%	Returns a dotted pair which represents a highest
%	element in the deg-lex sense of pol.
(DE anEXTRACTHIGHTENSMON (semidtpol)
% semidtpol should not represent zero
%return pair:(chain.term)
   (CONS (anSDP2NextChn semidtpol) (QPol2LRatTm (anSDP2NextQPol semidtpol)))
)%DE


%    anPRINTQPOLORCONSTANT (pol:qpol) : - ;
%        Prints a rational coefficient cf, a *, and then within
%	parentheses the polynomial multiplied by the inverse of cf.
%	If the polynomial is constant, prints only it as a
%	rational coefficient.
(DE antpPRINTQPOLORCONSTANT (quotpol)
 (COND ((NOT quotpol)
	(PRINT 0))
       ((Mon!= (APol2Lm quotpol) MONONE)
	(PRIN2 "(") (PRIN2 (PolNum quotpol)) (PRIN2 "*")
	(PRIN2 (RedandCoeff2OutCoeff (APol2Lc quotpol))) (PRIN2 "/")
	(PRIN2 (PolDen quotpol)) (PRIN2 ")") (TERPRI))
       (T
	(PRIN2 "(") (PRIN2 (PolNum quotpol)) (PRIN2 "*")
	(PRIN2 (RedandCoeff2OutCoeff (APol2Lc quotpol))) (PRIN2 "/")
	(PRIN2 (PolDen quotpol)) (PRIN2 ")") (PRIN2 "*") (PRIN2 "(")
	(REDANDALGOUT quotpol) (PRIN2 ")") (TERPRI))
 )
)

(ON RAISE)
