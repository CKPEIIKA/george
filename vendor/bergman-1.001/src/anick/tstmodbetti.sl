
% Testing module resolutions and Betti numbers calculation

%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%
%% Copyright (C) 1996
%% Alexander Podoplelov (and Joergen Backelin ?)
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


(OFF RAISE)
(GLOBAL '(anCHAINS anNEWCHAINS anOutChan cGBasis GBasis cDeg !*PBSERIES
	  !*CALCBETTI !*ONFLYBETTI anDIFFTIME anBETTITIME
	  anBETTINUMS ANICKRESOLUTIONOUTPUTFILE
	  anLASTCALCULATEDDEGREE
	  SObeg SOmid SOend btMacMx
	  anPrintSDPMode !*anchPrintEdgeString anchEdgeString!*
	  ModeProperties!*))

(GLOBAL '(anchEdgeString!*  !*anchPrintEdgeString anCHAINS
	  anNEWCHAINS MONONE !*anDEBUG REDANDCOEFFONE ModeProperties!*
	  anUNITCHAIN))

(GLOBAL '(NALGGEN NMODGEN))


% This routine should be called before the calculation of the Anick
% resolution to construct the chains for the chains of length
% zero, as a list (in increasing order).
%  Also construct the chain anUNITCHAIN of length -1.
%  Mening of prog variables: Return list of chains; Variable index;
% Variable as a monomial; Differential.

% 2001-08-01: In this version, NALGGEN is set, and 0-chains are
% created only for higher variable indices, i.e., for module
% generators.

(DE anCONSTRUCTZEROCHAINS ()
 (PROG	(rt vi vm df)
	(SETQ NALGGEN (DIFFERENCE (SETQ vi (GETVARNO)) NMODGEN))
	(SETQ anUNITCHAIN (ancrMakeChain NIL NIL MONONE NIL -1))
  Ml	(COND ((NOT (LESSP NALGGEN vi))
	       (RETURN (SETQ anCHAINS (NCONS (CONS 1 rt))))))
	(SETQ df (anMakeNewSDP))
	(anAppendSDPTail df
			 (anChn!&QPol2SDPTail
				anUNITCHAIN
				(Tm2QPol
				 (Cf!&Mon2Tm REDANDCOEFFONE
					     (SETQ vm
						   (MONINTERN (NCONS vi)))))))
	(SETQ rt (CONS (ancrMakeChain anUNITCHAIN NIL vm df 0)
		       rt))
	(SETQ vi (SUB1 vi))
	(GO Ml) ))


%          For a given degree it calculates chains and the Anick
%	  resolution differentials, and prints them into the result
%	  file. It also updates related variables.

% 2001-08-01: In this version, ignores the new Groebner basis
% elements beginning with ring variables (except for UNSIGN).

%    anifResolutionFixDegree (dgr:int) : - ;
(DE anifResolutionFixDegree (dgr)
 (PROG (chp dd t1 ip)
    (PRIN2 "Calculating the module Anick resolution in degree ")
    (PRIN2 dgr)
    (PRIN2 "...")
    (TERPRI)

    (UNSIGNLC!'S cGBasis)
    (SETQ chp (CDR anCHAINS))

    (COND ((NOT (EQN dgr cDeg))
	   (SETQ anNEWCHAINS (NCONS dgr))
	   (GO L1)
	  )
    )

    (SETQ ip (CDR cGBasis))
 L2 (COND ((AND ip (NOT (LESSP NALGGEN (MonSignifVar (CAR ip)))))
	   (SETQ ip (CDR ip))
	   (GO L2)))

    (SETQ anNEWCHAINS
	  (CONS cDeg (MAPCAR ip (FUNCTION anNEWGBELM2CHAIN)))
    )

L1  (COND
      (  chp
         (SETQ dd (DIFFERENCE dgr (CAAR chp)))
         (MAPC (CDAR chp) (FUNCTION (LAMBDA (u) (anCONSTRUCTNEWCHAINS u dd ))))
         (SETQ chp (CDR chp))
         (GO L1)
      )
    )%COND

    (SETQ t1 (TIME))
    (MAPC (CDR anNEWCHAINS) (FUNCTION anDIFF))
    (SETQ anDIFFTIME (PLUS2 anDIFFTIME (DIFFERENCE (TIME) t1)))
%    (PRINTNEWCHAINSDIFF anOutChan)
%    (FlushChannel anOutChan)
    (COND ( (CDR anNEWCHAINS)
	    (NCONC anCHAINS (NCONS anNEWCHAINS))))

%%%%%%%% Betti numbers calculation should be called from this point %%%%%%%
    (COND ( (AND !*CALCBETTI !*ONFLYBETTI)
		(SETQ t1 (TIME))
		(anBETTI anNEWCHAINS)
		(SETQ anBETTITIME (PLUS2 anBETTITIME (DIFFERENCE (TIME) t1)))
		(PRINTBETTI)
		(MACBETTIPRINT)
    ))

    (PRIN2 "end of Calculations.")
    (TERPRI)
 )
)

(ON RAISE)

