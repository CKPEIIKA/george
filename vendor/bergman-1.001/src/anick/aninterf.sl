%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%
%
%     Implementation of initial the Anick resolution routines.
%
%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%

%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%
%% Copyright (C) 1996,2005
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


%%%%	CHANGES:   %%%%

%  Corrected final mode setting PROG, in order to make the file more compilable./JoeB 2005-08-01

%  Added HOMMAXDEGREE mode handling.  Quoted ModeProperties!* in PUT/GET
% calls.  Removed the call to SETANICKRESOLUTION/JoeB 2005-06-26

% Adding flushing in ANICKDISPLAY and a new global variable !*PRINTBETTI /ufn 2005-06-16 -- 06-25

%  !*!&ResTyp!# --> !#!&ResTyp!#./JoeB 2004-04-30

%  Made ANICKDISPLAY behaviour depending on
% !*STANDARDANICKMODES./JoeB 2004-04-21

%  (2002-06-23 -- 2002-07-12, the following changes were made:
% !*!&ResTyp!# was added, to keep track of the resolution
% type. The procedures SETANICKRESOLUTION and
% GETRESOLUTIONTYPE, accessing !*!&ResTyp!#, were introduced.
% Old COPYD's to ResolutionInit were replaced by ditto to
% anResolutionInit, followed by !*!&ResTyp!# depending copying to
% ResolutionInit, or not.
% ResolutionFixcDegEnd --> anResolutionFixcDegEnd.)

%  Corrected anifTwoModulesResolutionFixDegree./JoeB 2002-06-23



(OFF RAISE)

%    anOutChan
%          This variable contains the output channel handler for
%	   printing Anick related information into the result file.
%
%    anDIFFTIME
%          After the Anick resolution is calculated it contain the time
%	   consumed by calculations for differentials in milliseconds.
%
%    anBETTITIME
%          After Anick resolution is calculated it contain the time
%	   consumed by calculations for Betti numbers.
%
%    anBETTINUMS
%          This variable is a list of Betti numbers. Each Betti number
%	   is of the structure ((order:int . degree:int) . value:int)
%
%    ANICKRESOLUTIONOUTPUTFILE
%          Is equal to the name of output file. In case it equals to NIL,
%	   the output channel will be associated with the file name
%	   "andifres.txt".
%
%    anLASTCALCULATEDDEGREE
%          Equals the last degree for which the anifResolutionFixDegree
%	   procedure was called.
(GLOBAL '(anCHAINS anbnmSORTEDCHAINS anNEWCHAINS anOutChan cGBasis
	  GBasis cDeg anBETTINUMS anCURRENTBETTINUMS !*PBSERIES
	  !*CALCBETTI !*ONFLYBETTI anDIFFTIME anBETTITIME
	  anBETTINUMS ANICKRESOLUTIONOUTPUTFILE !*STANDARDANICKMODES
	  anLASTCALCULATEDDEGREE bnmLeftModuleNormalWords anbnmTensorMons
	  anbnmTensorMonsAccess anbnmNewTensorMonsAccess
	  SObeg SOmid SOend btMacMx
	  anPrintSDPMode !*anchPrintEdgeString anchEdgeString!*
	  ModeProperties!* NALGGEN
	  anbnmChainStartIndexLimits anbnmChainEndIndexLimits
	  !*PRINTBETTI !#!&ResTyp!#))

(COPYD 'anPRT2 'PRIN2)

(PUT 'ModeProperties!* '!*CALCBETTI (FUNCTION (LAMBDA (v a) (CALCBETTI a))))
(PUT 'ModeProperties!* '!*ONFLYBETTI (FUNCTION (LAMBDA (v a) (ONFLYBETTI a))))

%    SETTENSPOLPRTSTRINGS (strings:lstr) : lstr ;
%          The list strings should consist of 3 strings which are
%	  used to print tensor product. First string is printed
%	  at the beginning, second - as a tensor multiplication sign
%	  and the third - as the ending of thensor monomial.
%	  The list of 3 strings of old settings is returned.
(DF SETTENSPOLPRTSTRINGS (lstr)
 (PROG (rt)
       (COND ( (NOT (AND (LISTP lstr) (EQ (LENGTH lstr) 3)
			 (OR (STRINGP (CAR lstr)) (IDP (CAR lstr)))
			 (OR (STRINGP (CADR lstr)) (IDP (CADR lstr)))
			 (OR (STRINGP (CADDR lstr)) (IDP (CADDR lstr)))))
	       (ERROR 2000 "Bad argument to SETTENSPOLPRTSTRING")
	     )
       )
       (SETQ rt (GETTENSPOLPRTSTRINGS))
       (SETQ SObeg (CAR lstr))
       (SETQ SOmid (CADR lstr))
       (SETQ SOend (CADDR lstr))
       (RETURN rt)
 )
)

%    GETTENSPOLPRTSTRINGS () : lstr ;
%	  Returns a list of 3 strings which are used when tensor
%	  monomials are printed as beginning, middle and ending
%	  strings.
(DE GETTENSPOLPRTSTRINGS () (LIST SObeg SOmid SOend) )


% This procedure is called from "Bergman" application once.
% Purpose : initialization for the Anick resolution moduls.
%         This procedure initializes all the variables concerned with
%	  the Anick resolution. It needs information about Groebner
%	  basis generators, therefore, it should be called after the
%	  system has them.

%# ResolutionInit () : - ;
(DE RingResolutionInit () 
 (PROGN
    (PRIN2 "The Anick resolution initialization...")
    (TERPRI)

    (COND ((NOT ANICKRESOLUTIONOUTPUTFILE)
	   (SETQ ANICKRESOLUTIONOUTPUTFILE "andifres.txt")))
    (SETQ anOutChan (OPEN ANICKRESOLUTIONOUTPUTFILE 'OUTPUT))
%    (ON PRINTEDGESTRING)
%    (SETEDGESTRING "*")
    (anCONSTRUCTZEROCHAINS)
    (SETQ anLASTCALCULATEDDEGREE 1)
    (SETQ anDIFFTIME 0)
    (SETQ anBETTITIME 0)
    (SETQ SObeg "")
    (SETQ SOmid ".")
    (SETQ SOend "")
    (anBETTIINIT)
    (COND ( (AND !*CALCBETTI !*ONFLYBETTI)
		(SETQ anBETTITIME (TIME))
		(anBETTI (CAR anCHAINS))
		(SETQ anBETTITIME (DIFFERENCE (TIME) anBETTITIME))
		(PRINTBETTI)
    ))
    (PRIN2 "The Anick resolution initialization done.")
    (TERPRI)
 )
)

(DE TwoModulesResolutionInit () 
 (PROGN
    (PRIN2 "The Anick resolution initialization (for two modules)...")
    (TERPRI)

    (COND ((NOT ANICKRESOLUTIONOUTPUTFILE)
	   (SETQ ANICKRESOLUTIONOUTPUTFILE "andifres.txt")))
    (SETQ anOutChan (OPEN ANICKRESOLUTIONOUTPUTFILE 'OUTPUT))
%    (ON PRINTEDGESTRING)
%    (SETEDGESTRING "*")
    (anCONSTRUCTZEROCHAINS)
    (anUPDATESORTEDCHAINS 1)
%    (anbnmSetIndexLimits)
    (anbnmLMNWInit)
    (SETQ anLASTCALCULATEDDEGREE 1)
    (SETQ anDIFFTIME 0)
    (SETQ anBETTITIME 0)
    (SETQ SObeg "")
    (SETQ SOmid ".")
    (SETQ SOend "")
    (anBETTIINIT)
    (COND ( (AND !*CALCBETTI !*ONFLYBETTI)
		(SETQ anBETTITIME (TIME))
		(anBETTI (CAR anCHAINS))
		(SETQ anBETTITIME (DIFFERENCE (TIME) anBETTITIME))
		(PRINTBETTI)
    ))
    (PRIN2 "The Anick resolution initialization done.")
    (TERPRI)
 )
)

%    CALCBETTI (flag:bool) : - ;
%         Depending on whether flag is non-NIL or not, switches on/off
%	  the calculation of Betti numbers. It sets corresponding flags.
% flag is a boolean T or NIL
(DE CALCBETTI (flag)
 (PROGN
   (COND  ( (NULL flag)
	    (OFF CALCBETTI)
	    (OFF ONFLYBETTI)
	  )
	  (T
	    (ON CALCBETTI)
	  )
   )%COND
 )
)

%    ONFLYBETTI (flag:bool) : - ;
%         Depending on whether flag is non-NIL or not, switches on/off
%	  the calculation of Betti numbers. Also, the feature of
%	  calculating and printing them while Groebner basis is being
%	  calculated degree by degree. It sets corresponding flags.
(DE ONFLYBETTI (flag)
 (PROGN
   (COND  ( (NULL flag)
	    (OFF ONFLYBETTI)
	  )
	  (T
	    (ON CALCBETTI)
	    (ON ONFLYBETTI)
	  )
   )%COND
 )
)


%    GETBETTINUMS () : lbtnum;
%          Returns the list of Betti numbers.
(DE GETBETTINUMS () (COPY anBETTINUMS))


%    GETBTORDER (btnumber:btnum) : int ;
%          Returns the order of Betti number btnumber.
(DE GETBTORDER (btnum) (CAAR btnum))

%    GETBTDEGREE (btnumber:btnum) : int ;
%          Returns the degree of Betti number btnumber.
(DE GETBTDEGREE (btnum) (CDAR btnum))

%    GETBTVALUE (btnumber:btnum) : int ;
%          Returns the value of Betti number btnumber.
(DE GETBTVALUE (btnum) (CDR btnum))


%          For a given degree it calculates chains and the Anick
%	  resolution differentials, and prints them into the result
%	  file. It also updates related variables.

%# anifRingResolutionFixDegree (dgr:int) : - ;
(DE anifRingResolutionFixDegree (dgr)
 (PROG (chp dd t1)
    (PRIN2 "Calculating the Anick resolution in degree ")
    (PRIN2 dgr)
    (PRIN2 "...")
    (TERPRI)

    (UNSIGNLC!'S cGBasis)
    (SETQ anNEWCHAINS
	  (COND ((EQN dgr cDeg)
                 (CONS cDeg (MAPCAR (CDR cGBasis)
				    (FUNCTION anNEWGBELM2CHAIN)))
                )
                (T
                 (NCONS dgr)
                )
          )%COND
    )

    (SETQ chp (CDR anCHAINS))
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
(BETTIDISPLAY)
    ))

    (PRIN2 "end of Calculations.")
    (TERPRI)
 )
)

%%          For a given degree this calculates chains and the Anick
%%	  resolution differentials, and prints them into the result
%%	  file. It also updates related variables.
%
%%# anifModuleResolutionFixDegree (dgr:int) : - ;
%(DE anifModuleResolutionFixDegree (dgr)
% (PROG (chp dd t1 ip)
%    (PRIN2 "Calculating the module Anick resolution in degree ")
%    (PRIN2 dgr)
%    (PRIN2 "...")
%    (TERPRI)
%
%    (UNSIGNLC!'S cGBasis)
%    (SETQ chp (CDR anCHAINS))
%
%    (COND ((NOT (EQN dgr cDeg))
%	   (SETQ anNEWCHAINS (NCONS dgr))
%	   (GO L1)
%	  )
%    )
%
%    (SETQ ip (CDR cGBasis))
% L2 (COND ((AND ip (NOT (LESSP NALGGEN (MonSignifVar (CAR ip)))))
%	   (SETQ ip (CDR ip))
%	   (GO L2)))
%
%    (SETQ anNEWCHAINS
%	  (CONS cDeg (MAPCAR ip (FUNCTION anNEWGBELM2CHAIN)))
%    )
%
%L1  (COND
%      (  chp
%         (SETQ dd (DIFFERENCE dgr (CAAR chp)))
%         (MAPC (CDAR chp) (FUNCTION (LAMBDA (u) (anCONSTRUCTNEWCHAINS u dd ))))
%         (SETQ chp (CDR chp))
%         (GO L1)
%      )
%    )%COND
%
%    (SETQ t1 (TIME))
%    (MAPC (CDR anNEWCHAINS) (FUNCTION anDIFF))
%    (SETQ anDIFFTIME (PLUS2 anDIFFTIME (DIFFERENCE (TIME) t1)))
%%    (PRINTNEWCHAINSDIFF anOutChan)
%%    (FlushChannel anOutChan)
%    (COND ( (CDR anNEWCHAINS)
%	    (NCONC anCHAINS (NCONS anNEWCHAINS))))
%
%%%%%%%%% Betti numbers calculation should be called from this point %%%%%%%
%    (COND ( (AND !*CALCBETTI !*ONFLYBETTI)
%		(SETQ t1 (TIME))
%		(anBETTI anNEWCHAINS)
%		(SETQ anBETTITIME (PLUS2 anBETTITIME (DIFFERENCE (TIME) t1)))
%		(PRINTBETTI)
%		(MACBETTIPRINT)
%    ))
%
%    (PRIN2 "end of Calculations.")
%    (TERPRI)
% )
%)



%          For a given degree this calculates chains and the Anick
%	  resolution differentials, and prints them into the result
%	  file. It also updates related variables.

%  Meaning of PROG variables: CHain list Position; Degree Difference;
% Time spent; InPut; Return list Position;
% Last Chain Start variable index; First Chain End variable index;
% Last Chain End variable index
%# anifTwoModulesResolutionFixDegree (dgr:int) : - ;
(DE anifTwoModulesResolutionFixDegree (dgr)
 (PROG (chp dd t1 ip rp lcs fce lce)
    (PRIN2 "Calculating the module Anick resolution in degree ")
    (PRIN2 dgr)
    (PRIN2 "...")
%    (PRIN2 "... with lcs = ")
    (TERPRI)

    (UNSIGNLC!'S cGBasis)
    (SETQ chp (CDR anCHAINS))
    (SETQ lcs (CDR anbnmChainStartIndexLimits))
    (SETQ fce (CAR anbnmChainEndIndexLimits))
    (SETQ lce (CDR anbnmChainEndIndexLimits))
%    (PRIN2 lcs)
%    (TERPRI)

    (COND ((NOT (EQN dgr cDeg))
	   (SETQ anNEWCHAINS (NCONS dgr))
	   (GO L1)
	  )
    )

    (SETQ ip (CDR cGBasis))
 L2 (COND ((AND ip (NOT (BMI!< NALGGEN (MonSignifVar (CAR ip)))))
	   (SETQ ip (CDR ip))
	   (GO L2)))

    (SETQ rp (SETQ anNEWCHAINS (NCONS dgr)))

 L3
%    (PRIN2 "At L3; ip ")
%    (COND ((NOT ip) (PRIN2T "is empty."))
%	  (T (PRIN2 "begins with the G.b.elt. with leadmon = ")
%	     (AlgPMonPrint (PMon (CAR ip))) (TERPRI)
%	     (PRIN2 "(MonSignifVar (CAR ip)) = ")
%	     (PRIN2 (MonSignifVar (CAR ip)))
%	     (PRIN2 "; and (MonLeastSignifVar (CAR ip)) = ")
%	     (PRIN2 (MonLeastSignifVar (CAR ip)))
%	     (PRIN2T ".")))
    (COND ((OR (NOT ip) (BMI!< lcs (MonSignifVar (CAR ip))))
	   (GO L1))
	  ((NOT (OR (BMI!> (MonLeastSignifVar (CAR ip)) lce)
		    (BMI!< (MonLeastSignifVar (CAR ip)) fce)))
%	   (PRIN2T "Am creating chain for this monome.")
	   (RPLACD rp (NCONS (anNEWGBELM2CHAIN (CAR ip))))
	   (SETQ rp (CDR rp))))
    (SETQ ip (CDR ip))
    (GO L3)

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
	    (NCONC anCHAINS (NCONS anNEWCHAINS))
	    (anUPDATESORTEDCHAINS dgr)))

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



%          For a given degree this calculates chains and the Anick
%	  resolution differentials, and prints them into the result
%	  file. It also updates related variables.

%# anifModuleResolutionFixDegree (dgr:int) : - ;
(DE anifModuleResolutionFixDegree (dgr)
 (PROG (chp dd t1 ip rp)
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

    (SETQ rp (SETQ anNEWCHAINS (NCONS dgr)))

 L3 (COND ((AND ip (NOT (LESSP (CDR anbnmChainStartIndexLimits)
				(MonSignifVar (CAR ip)))))
	   (RPLACD rp (NCONS (anNEWGBELM2CHAIN (CAR ip))))
	   (SETQ rp (CDR rp))
	   (SETQ ip (CDR ip))
	   (GO L3)))

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

% PRINTNEWCHAINSDIFF (chan:genint) : - ;
% Prints differentials for the new generated chains
%  to the channel chan
(DE PRINTNEWCHAINSDIFF (chan)
    (PROG (OldChan oldLL)
	  (SETQ OldChan (WRS chan))
	  (SETQ oldLL (LINELENGTH 1024))
	  (MAPC (CDR anNEWCHAINS) 
		(FUNCTION (LAMBDA (u)
				  (MAPC (CDR u)
					(FUNCTION PRTCHNDIFF)))
		)
          )
	  (WRS OldChan)
	  (LINELENGTH oldLL)
    )
)

% PRINTCHAINSDIFF (chan:genint) : - ;
% Prints differentials for the all generated chains
%  to the channel chan
(DE PRINTCHAINSDIFF (chan)
    (PROG (OldChan oldLL)
	  (SETQ OldChan (WRS chan))
	  (SETQ oldLL (LINELENGTH 1024))
	  (MAPC anCHAINS
		(FUNCTION (LAMBDA (u)
				  (MAPC (CDR u)
					(FUNCTION PRTCHNDIFF)))
		)
          )
	  (WRS OldChan)
	  (LINELENGTH oldLL)
    )
)


% PRTCHNDIFF (inchain:chn) : - ;
% Prints differential for the chain inchain in form
% D (chain length, chain) = differential
(DE PRTCHNDIFF (chn)
    (PROG (diff)
	  (PRIN2 "D(") 
	  (PRIN2 (anChn2Length chn))
	  (PRIN2 ", ")
	  (PRINTCHAIN chn)
	  (PRIN2 ")=")
	  (COND ( (NULL (SETQ diff (anChn2Diff chn))) (PRIN2 "Nil"))
		(T (PRETTYPRINTSDP diff))
          )
	  (TERPRI)
    )
)




%    ResolutionFixcDegEnd () : - ;
%          Applies the procedure anifResolutionFixDegree for 
%	  all the degrees which has to be fixed in anifResolutionFixDegree
%	  sense.
(DE anResolutionFixcDegEnd ()
 (PROG	()
  Ml	(COND ((LESSP anLASTCALCULATEDDEGREE cDeg)
	       (SETQ anLASTCALCULATEDDEGREE (ADD1 anLASTCALCULATEDDEGREE))
	       (anifResolutionFixDegree anLASTCALCULATEDDEGREE)
	       (GO Ml)
	      )
	)
 )
)

%    ResolutionDone () : - ;
%          Closes the output stream used in Anick related procedures.
%%% Wind up procedure, closes all the streams 
(DE ResolutionDone()
  (PROG (OldChan)
     (COND ( (NOT (NULL anOutChan)) 
	     (PRIN2 "Closing the streams.")
	     (CLOSE anOutChan)
	     (SETQ anOutChan NIL)
	   )
     )
  )
)


%    ResolutionClear () : - ;
%          Cleans up all the Anick related variables including Betti
%	  numbers.
(DE ResolutionClear ()
 (PROGN	(PRIN2 "Cleaning the variables") (TERPRI)
	(SETQ anLASTCALCULATEDDEGREE NIL)
	(SETQ anCHAINS NIL)
	(SETQ anNEWCHAINS NIL)
	(SETQ anBETTINUMS (NCONS NIL))
	(SETQ anCURRENTBETTINUMS NIL)
	(SETQ anbnmSORTEDCHAINS NIL)
	(SETQ bnmLeftModuleNormalWords NIL)
	(SETQ anbnmTensorMons NIL)
	(SETQ anbnmTensorMonsAccess NIL)
	(SETQ anbnmNewTensorMonsAccess NIL)
	(SETQ btMacMx NIL)
	(SETQ anDIFFTIME 0)
	(SETQ anBETTITIME 0)
 )
)

%    CLEARRESOLUTION () : - ;
%          Calls ResolutionDone and ResolutionClear procedures.
(DE CLEARRESOLUTION ()
 (PROGN
     (ResolutionDone)
     (ResolutionClear)
 )
)


%    ANICKDISPLAY () : - ;
%          Prints the Betti numbers into the result file.
%	  - Now, just prints the differential, or bettinumbers too,
%	    depending on the switch !*STANDARDANICKMODES.
%	    /JoeB 2004-04-21
(DE ANICKDISPLAY ()
 (PROG (OldChan oldLL)
     (COND ( (BETTICALC)
	     (PRIN2 "Printing the results ...")
	     (TERPRI)
	     (SETQ OldChan (WRS anOutChan))
	     (SETQ oldLL (LINELENGTH 1024))
	     (MAPC anCHAINS
		   (FUNCTION (LAMBDA (u)
				     (MAPC (CDR u)
					   (FUNCTION PRTCHNDIFF)))
		   )
             )
	     (COND (!*STANDARDANICKMODES
		    (PRINTBETTI)
		    (MACBETTIPRINT)
		   )
	     )
	     (WRS OldChan)
	     (PRIN2 "Printing is done.")
	     (TERPRI)
%ufn 05.07.16 Added flushing
            (COND (!*PRINTBETTI (FLUSHCHANNEL anOutChan)))
	     (LINELENGTH oldLL)
	   )
     )
 )
)

%    BETTIDISPLAY () : - ;
%          Prints the Betti numbers into the result file.
%	  - Now, just prints the differential, or bettinumbers too,
%	    depending on the switch !*STANDARDANICKMODES.
%	    /JoeB 2004-04-21
(DE BETTIDISPLAY ()
 (PROG (OldChan oldLL)
     (COND ( (BETTICALC)
	     (PRIN2 "Printing the results ...")
	     (TERPRI)
	     (SETQ OldChan (WRS anOutChan))
	     (SETQ oldLL (LINELENGTH 1024))
	     %(MAPC anCHAINS
	     %	   (FUNCTION (LAMBDA (u)
	     %		     (MAPC (CDR u)
	     %				   (FUNCTION PRTCHNDIFF)))
	     %	   )
             %)
	     (COND (!*STANDARDANICKMODES
		    (PRINTBETTI)
		    (MACBETTIPRINT)
		   )
	     )
	     (WRS OldChan)
	     (PRIN2 "Printing is done.")
	     (TERPRI)
%ufn 05.07.16 Added flushing
             (COND (!*PRINTBETTI (FLUSHCHANNEL anOutChan)))
	     (LINELENGTH oldLL)
	   )
     )
 )
)

%  BETTICALC () : bool ;
% Returns true if the system is configured to calculate Betti numbers.
(DE BETTICALC ()
 (COND	( (AND !*CALCBETTI (NOT !*ONFLYBETTI))
	  (anALLBETTI) T)
	( T
	  !*CALCBETTI)
 )
)

%    CALCULATEANICKRESOLUTIONTOLIMIT (limdeg:int) : - ;
%          Countinues the process of Anick resolution calculation up to
%	  the degree limdeg. It maybe called after the Groebner basis is
%	  calculated, in case it is finite and calculations stopped
%	  at a lower degree than thatonto which the Anick resolution
%	  should be calculated.
(DE CALCULATEANICKRESOLUTIONTOLIMIT (limdeg)
 (PROG	()
	(COND ((OR (NOT GBasis) (NOT !*PBSERIES))
	       (ERROR 1001 "You cannot call CALCULATEANICKRESOLUTIONTOLIMIT now")
	      )
	      ((NOT anLASTCALCULATEDDEGREE)
	       (ResolutionInit)
	      )
	)
  Ml	(COND ((LESSP anLASTCALCULATEDDEGREE limdeg)
	       (SETQ anLASTCALCULATEDDEGREE (ADD1 anLASTCALCULATEDDEGREE))
	       (anifResolutionFixDegree anLASTCALCULATEDDEGREE)
	       (GO Ml)
	      )
	)
 )
)


%  Mode settings.

%    ExtractAnickModes () : lmodestate ;
%	  Returns the list of modestates.
(DE ExtractAnickModes ()
 (MAPCAN '(anExtractTPModes anExtractChnModes anExtractBettiModes)
	 (FUNCTION (LAMBDA (u) (APPLY u NIL)))))

%    RestoreAnickModes (modeinfo:lmodestate) : - ;
%	  Restores modestates supplied  by modeinfo.
(DE RestoreAnickModes (modeinfo)
 (PROG (modes dp fn)
       (SETQ modes '( (TENSPOL!-PRINTMODE . anPrintSDPMode)
		      (TENSTERM!-PRINTMODE . TENSTERM!-PRINTMODE)
		      (HOMMAXDEGREE . HOMMAXDEGREE)
		      (EDGE!-STRING . anchEdgeString!*)
		      (EDGE!-STRING!-PRINTING . !*anchPrintEdgeString)
		      (BETTI . !*CALCBETTI)
		      (BETTI-FOREACHDEGREE . !*ONFLYBETTI)
                    )
       )
%       (CheckModes (modeinfo))
   L1  (COND ( (NULL modeinfo) (RETURN NIL) )
	     ( T
	       (SETQ dp (ASSOC (CAAR modeinfo) modes))
	       (COND ( (NULL dp)
		       (PRIN2 "Variable name ")
		       (PRIN2 (CAAR modeinfo))
		       (PRIN2 " is not valid, skipping it.")
		       (TERPRI)
		     )
		     (T
		       (SETQ fn (GET 'ModeProperties!* (CDR dp)))
		       (COND ( (NULL fn)
			       % Direct assignment
			       (SET (CDR dp) (CADAR modeinfo))
			     )
			     (T
			       % Invoking property function
			       (APPLY fn (LIST (CDR dp) (CADAR modeinfo)))
			     )
		       )%COND
			       
		     )
	       )%COND
	     )
       )%COND
       (SETQ modeinfo (CDR modeinfo))
       (GO L1)
 )
)

%# SETANICKRESOLUTION () : id ;
(DE SETANICKRESOLUTION ()
 (PROG	(rt !*USERMODE !*REDEFMSG)
	(SETQ rt (GETRESOLUTIONTYPE))
	(SETQ !#!&ResTyp!# 'ANICK)
	(COPYD 'ResolutionInit 'anResolutionInit)
	(COPYD 'ResolutionFixcDegEnd 'anResolutionFixcDegEnd)
	(RETURN rt) ))

%# AnickRingObject () : - ;
(DE AnickRingObject ()
 (PROGN	(COPYD 'anifResolutionFixDegree 'anifRingResolutionFixDegree)
	(COPYD 'anResolutionInit 'RingResolutionInit)
	(COND ((EQ (GETRESOLUTIONTYPE) 'ANICK)
	       (COPYD 'ResolutionInit 'anResolutionInit)))
	(COPYD 'anBETTI 'anRingBETTI)
	(COPYD 'anCONSTRUCTNEWCHAINS 'anRingCONSTRUCTNEWCHAINS) ))

%# AnickModuleObject () : - ;
(DE AnickModuleObject ()
 (PROGN	(COPYD 'anifResolutionFixDegree 'anifModuleResolutionFixDegree)
	(COPYD 'anResolutionInit 'RingResolutionInit)
	(COND ((EQ (GETRESOLUTIONTYPE) 'ANICK)
	       (COPYD 'ResolutionInit 'anResolutionInit)))
	(COPYD 'anBETTI 'anRingBETTI)
	(COPYD 'anCONSTRUCTNEWCHAINS 'anRingCONSTRUCTNEWCHAINS) ))

%# AnickTwoModulesObject () : - ;
(DE AnickTwoModulesObject ()
 (PROGN	(COPYD 'anifResolutionFixDegree 'anifTwoModulesResolutionFixDegree)
	(COPYD 'anResolutionInit 'TwoModulesResolutionInit)
	(COND ((EQ (GETRESOLUTIONTYPE) 'ANICK)
	       (COPYD 'ResolutionInit 'anResolutionInit)))
	(COPYD 'anBETTI 'anTwoModulesBETTI)
	(COPYD 'anCONSTRUCTNEWCHAINS 'anTwoModulesCONSTRUCTNEWCHAINS)))

%# AnickFactAlgObject () : - ;
(DE AnickFactAlgObject ()
 (PROGN	(COPYD 'anifResolutionFixDegree 'anifModuleResolutionFixDegree)
	(COPYD 'anResolutionInit 'RingResolutionInit)
	(COND ((EQ (GETRESOLUTIONTYPE) 'ANICK)
	       (COPYD 'ResolutionInit 'anResolutionInit)))
	(COPYD 'anBETTI 'anRingBETTI)
	(COPYD 'anCONSTRUCTNEWCHAINS 'anRingCONSTRUCTNEWCHAINS) ))

(PROG	(tmp)
	(COND ((NOT (DEFP 'GETOBJECTTYPE))
	       (RETURN NIL)))
	(SETQ tmp (GETOBJECTTYPE))
	(COND ((EQ tmp 'MODULE) (AnickModuleObject))
	      ((EQ tmp 'TWOMODULES) (AnickTwoModulesObject))
	      ((EQ tmp 'FACTORALGEBRA) (AnickFactAlgObject))
	      (T (AnickRingObject))) )

%  RATHER preliminary, in order to ensure compatibility until changes
% implemented:
% (SETANICKRESOLUTION)

(ON RAISE)

