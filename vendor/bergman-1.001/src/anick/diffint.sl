%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%% 
%
%     Implementation of the Anick resolution routines.
%
%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%% 

%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%
%% Copyright (C) 1996,2002
%% Alexander Podoplelov (and Joergen Backelin ?)
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

%	CHANGES:

%  Replaced some non-ascii blank space by ordinary blanks/JoeB 2002.10.14


(OFF RAISE)

% (GLOBAL '(!*anDEBUG_di))

% %%%%%% Differential procedure %%%%%%%

%    anDIFF (inchain:chn) : sdtp ;
%          The chain inchain is processed according to the
%	  algorithm of calculating the differential in the Anick
%	  resolution. The result semi-distributed polynomial is
%	  returned.
(DE anDIFF (chn)  
(PROG (g h cp result c1)
%Var types:
%chn    : chain
%g      : chain
%h      : augmon    
%cp     : semidistributedtensorpol
%result : semidistributedtensorpol

%    (COND ( *anDEBUG (PRIN2 "anDIFF<- ") (PRINTCHAIN chn) (PRIN2 ".1") (TERPRI) ))
%    (COND ( *anDEBUG_di (PRIN2 "-> D (")
%			(PRIN2 (anChn2Length chn)) (PRIN2 '!,)
%			(PRINTCHAIN chn) (PRIN2 ")") (TERPRI) ))

    (COND
        ((NOT (NULL (SETQ cp (anChn2Diff chn))))
             (SETQ cp (anCopySDP cp)) 
%             (COND ( *anDEBUG (PRIN2 "anDIFF->") (PRETTYPRINTSDP cp) (TERPRI) ))
%             (COND ( *anDEBUG_di (PRIN2 " <- D (exists):") (PRETTYPRINTSDP cp) (TERPRI) ))
             (RETURN cp)
        )
    )%COND

    (COND
        ((NULL (SETQ g (anChn2LowerChn chn)) )
             (PRIN2 "***** Error ak#1 in DIFF: Cannot get previous cahin") (TERPRI)
	     (PRIN2 "***** Length[chn] = ") (PRINT (anChn2Length chn))
             (TERPRI) 
             (ERROR 1 "Error ak#1 in DIFF: Cannot get previous chain")  
        ) %SETQ
    )%COND
    (COND
        ((NULL (SETQ cp (anChn2Diff g)))
             (SETQ cp (anDIFF g)) )
    )%COND
%    (COND ( *anDEBUG (PRIN2 "...Dif ") (PRINTCHAIN g) (PRIN2 ",") (PRETTYPRINTSDP cp) (TERPRI) ))
    (COND
        ((NULL (SETQ h (anChn2LastVx chn)))
             (PRIN2 "***** Error ak#2 in DIFF: Cannot get last vertex")
             (TERPRI)
             (ERROR 2 "Error ak#2 in DIFF: Cannot get last vertex") 
        ) %SETQ
    )%COND
%    (COND ( *anDEBUG (PRIN2 "...BeforeConc ") (PRETTYPRINTSDP cp) (PRIN2",") (MONPRINT h) (TERPRI) ))
    (SETQ cp (anCONCATTENSPOLMON cp h)) % cp now is a copy so its structure
                                        % can be modified 
%    (COND ( *anDEBUG (PRIN2 "...Conc ") (PRETTYPRINTSDP cp) (TERPRI) ))
    (COND 
        ((NOT (anSDP0!? cp)) (SETQ cp (andiINTEG cp)) )
    )%COND
    (SETQ result (anMAKETENSPOL g h))
    (COND 
        ((NOT (anSDP0!? cp)) 
            (SETQ c1 (REDANDCF2RATCF (REDANDCF!- REDANDCOEFFONE)))
            (anDESTRUCTADDTENSPOLS result cp c1)
        )
    )%COND
    (anSetDiff chn result)
%    (COND ( *anDEBUG (PRIN2 "anDIFF->") (PRETTYPRINTSDP result) (TERPRI) ))
%    (COND ( *anDEBUG_di (PRIN2 " <- D(")
%			(PRIN2 (anChn2Length chn)) (PRIN2 '!,)
%			(PRINTCHAIN chn) (PRIN2 ")=")
%			(PRETTYPRINTSDP result) (TERPRI) ))
    (RETURN result)
 )%PROG
) %DE

%%%%%%% Integral procedure (destructive) %%%%%%%%%%%

%    andiINTEG (pol:sdtp) : sdtp ; DESTRUCTIVE
%	  This procedure is used in the calculation of Anick differential
%	  in order to complete the algorithm for calculating the Anick
%	  differential.
(DE andiINTEG (semidtpol)
 (PROG (g h cp result coef c1)
% Var types:
% semidtpol : semidistributedtensorpol, couln't be NIL or somthing like this
% g      : dp of chain and augmon
% h      : dp of n+1 chain and tail so that
%           [n+1 chain]*[tail]=[n chain]*[rightfactor]
% cp     : semidistributedtensorpol
% result : semidistributedtensorpol

%     (COND ( *anDEBUG (PRIN2 "andiINTEG<-") (PRETTYPRINTSDP semidtpol) (TERPRI) ))
%     (COND (*anDEBUG_di (PRIN2 "-> I(")
%			(PRETTYPRINTSDP semidtpol)
%			(PRIN2 ")") (TERPRI) ))
     (SETQ g (anEXTRACTHIGHTENSMON semidtpol))  % g=dotted_pair( chn . term)
%     (COND ( *anDEBUG (PRIN2 "andiINTEG,inp1  =") (PRETTYPRINTSDP semidtpol) (TERPRI) ))
     (SETQ coef (Cf (CDR g)))
     (COND
         ( (NULL (SETQ h (anPROLONGCHAIN (CAR g) (Mon (CDR g))))) %h=dp(chn(n+1).augmon_rest)
              (PRIN2 "***** Error ak#3 in INTEG: Cannot prolongate chain.")
              (TERPRI)
              (ERROR 3 "Error ak#3 in INTEG: Cannot prolongate chain.") 
         )
     )%COND
%     (COND ( *anDEBUG (PRIN2 "andiINTEG,inp2  =") (PRETTYPRINTSDP semidtpol) (TERPRI) ))
     (SETQ cp (anDIFF (CAR h)))
%     (COND ( *anDEBUG (PRIN2 "andiINTEG,inp3  =") (PRETTYPRINTSDP semidtpol) (TERPRI) ))
%     (COND ( (NOT (Mon!= (PMon (CDR h)) MONONE))
               (SETQ cp (anCONCATTENSPOLMON cp (CDR h))) % now cp can be modified
%           ) )%COND
%     (COND ( *anDEBUG (PRIN2 "andiINTEG,inp4  =") (PRETTYPRINTSDP semidtpol) (TERPRI) ))
     (COND
         ((NOT (anSDP0!? cp))
             (SETQ c1  (REDANDCFS2RATCF (REDANDCF!- (RATCF2NUMERATOR coef))
					(RATCF2DENOMINATOR coef)))
%             (COND ( *anDEBUG (PRIN2 "andiINTEG,inp  =") (PRETTYPRINTSDP semidtpol) (TERPRI) ))
%             (COND ( *anDEBUG (PRIN2 "andiINTEG,diff2=") (PRETTYPRINTSDP cp) (TERPRI) ))
%             (COND ( *anDEBUG (PRIN2 "andiINTEG,coeff=") (PRIN2 (RedandCoeff2OutCoeff c1)) (TERPRI) ))
             (anDESTRUCTADDTENSPOLS semidtpol cp c1)
%             (COND ( *anDEBUG (PRIN2 "andiINTEG,inp-diff2=") (PRETTYPRINTSDP semidtpol) (TERPRI) ))
         )
     )%COND
     (COND
         ((NOT (anSDP0!? semidtpol))
             (SETQ semidtpol (andiINTEG semidtpol))
         )
     )%COND
     (SETQ result (anMAKETENSPOL (CAR h) (CDR h)))
     (anDESTRUCTADDTENSPOLS semidtpol result coef)
%     (COND ( *anDEBUG (PRIN2 "andiINTEG->") 
%        (COND ( (anSDP0!? semidtpol) (PRETTYPRINTSDP semidtpol) )) (TERPRI) ))
%     (COND (*anDEBUG_di (PRIN2 " <- I(")
%			(PRETTYPRINTSDP semidtpol)
%			(PRIN2 ")") (TERPRI) ))
     (RETURN semidtpol)
 )%PROG
)%DE


(ON RAISE)
