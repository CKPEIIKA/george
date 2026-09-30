%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%
%% Copyright (C) 2006 Victor Ufnarovski
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


%  Created 07-08-2006 by ufn Contains procedures for the calculating
% syzygies and minimal resolutions for (nc-) modules and some routines
% for calculating PBS (Poincare-Betti series).
% 

%%	CHANGES:

%  Changed ONELETTERMONOM to ONELETTERMONOMP /ufn 2007-08-22

%  Introduced a LeaveMINIMALRESOLUTION hook, and made the customised
% procedures resetting local to this mode./JoeB 2007-08-21

%  Added possibility to start caclulation in the resolution without
%  explicitely written weights /ufn 2007-08-20

%  Declared NGroeb FLUID (not GLOBAL).  Added SETMINIMALRESOLUTION.
% /JoeB 2006-08-20

(OFF RAISE)

% Imports: 

% Exports: 

% Available: ADDPOLY,ADDTOPBS, ADDVARSTOPBS, PRINTPBS, CHANGEPBS, 
%	   HDEGVARIABLE, TDEGVARIABLE,

(GLOBAL '(  PBS CURHOMDEG bnmOutFile tmplist
	   Modlastvar Modstartvar ind1start ind2start 
           ind1finish ind2finish
	   !#minresoCustNIGbeF !#minresoCustED !#minresoCustNcDF ))

 (FLUID '(TDEGVARIABLE HDEGVARIABLE NGroeb))
(ON SAVERECVALUES) %ufn  Do we need this?  
(COND ((NOT TDEGVARIABLE) (SETQ TDEGVARIABLE '!t)))
(COND ((NOT HDEGVARIABLE) (SETQ HDEGVARIABLE '!z)))

		%%%%%%%%%%%%%%%%%%%%%%%%%%%
		%%%			%%%
		%%% Procedures for	%%%
		%%% Calculating and     %%%
		%%% Printing PBS	%%%
		%%%%%%%%%%%%%%%%%%%%%%%%%%%

%Procedure to print PBS
(DE PRINTPBS ()
 (PROG (aa k)
       (SETQ aa PBS)
       (SETQ k 1)
 L     (COND (aa 
              (PRINTPBSTerm (CAR aa) k )
              (SETQ aa (CDR aa)) 
              (SETQ k (ADD1 k)) 
              (GO L))) 
(TERPRI)
 )
)

(DE PRINTPBSDouble ()
 (PROG (aa k)
       (SETQ aa PBS)
       (SETQ k 1)
 L     (COND (aa 
              (PRINTPBSTermDouble (CAR aa) k )
              (SETQ aa (CDR aa)) 
              (SETQ k (ADD1 k)) 
              (GO L))) 
(TERPRI)
 )
)

(DE PRINTPBSTerm (Term  k)
 (PROG (a)
 (COND ((EQN (REMAINDER k 6) 1) (TERPRI)))
 (SETQ a (CAR Term))
 (COND ((AND (LESSP 1 k) (LESSP 0 a)) (PRIN2 "+")))
 (PRIN2 a)
 (SETQ a (CADR Term))
 (COND ((LESSP 0 a) (PRIN2 TDEGVARIABLE )(COND ((LESSP 1 a) (PRIN2 "^")(PRIN2 a)))))
 (SETQ a (CADDR Term))
 (COND ((LESSP 0 a) (PRIN2 HDEGVARIABLE )(COND ((LESSP 1 a) (PRIN2 "^")(PRIN2 a)))))
))

(DE PRINTPBSTermDouble (Term  k)
 (PROG (a)
 (COND ((EQN (REMAINDER k 6) 1) (DoubleNewLine)))
 (SETQ a (CAR Term))
 (COND ((AND (LESSP 1 k) (LESSP 0 a)) (DoublePrint "+")))
 (DoublePrint a)
 (SETQ a (CADR Term))
 (COND ((LESSP 0 a) (DoublePrint TDEGVARIABLE )(COND ((LESSP 1 a) (DoublePrint "^")(DoublePrint a)))))
 (SETQ a (CADDR Term))
 (COND ((LESSP 0 a) (DoublePrint HDEGVARIABLE )(COND ((LESSP 1 a) (DoublePrint "^")(DoublePrint a)))))
))

%Adding one term to PBS
(DE CHANGEPBS (coef deg homdeg)
 (SETQ PBS (ADDPOLY PBS (LIST (LIST coef deg homdeg))))
)

% Procedure to add two sorted comm polynomials uses MNlessp for orderidng
% Destructive. Not efficient, used for PBS only
(DE ADDPOLY (pol1 pol2)
 (PROG (aa bb c res)
     % (PRIN2T "Started ADDPOLY")
       (SETQ aa pol1)
       (SETQ bb pol2)
       (COND ((NULL aa) (RETURN bb))
             ((NULL bb) (RETURN aa))

             ((MNlessp(CDAR aa) (CDAR bb)) 
                    (RETURN (ADDPOLY bb aa)))
             ((MNlessp (CDAR bb) (CDAR aa)) 
                     (RETURN (APPEND (LIST (CAR bb)) (ADDPOLY (CDR bb) aa)))))
       (SETQ c (PLUS2  (CAAR aa) (CAAR bb)))
       (COND ((ZEROP c) (RETURN  (ADDPOLY (CDR aa) (CDR bb)))))
       (RETURN (APPEND (LIST (CONS c (CDAR aa))) (ADDPOLY (CDR aa) (CDR bb))))
 )
)  
% lex ordering for comm monomials. Is used for ADDPOLY only.
(DE MNlessp (mon1 mon2)
   (PROG (aa bb)
   (COND ((NULL mon1) (PRIN2 "Wrong monomial.") (RETURN NIL)))
   (SETQ aa  mon1)
   (SETQ bb  mon2)
M1 (COND ((NULL aa) (RETURN NIL))
         ((LESSP (CAR aa) (CAR bb)) (RETURN T))
         ((LESSP (CAR bb) (CAR aa)) (RETURN NIL))) 
   (SETQ aa (CDR aa))
   (SETQ bb (CDR bb))
   (GO M1)
    ) 
)

%Adding degrees of variables to PBS
%Note - the ordering in GETWEIGHTDPS in fact is opposite 
%to the original list of variables
(DE ADDVARSTOPBS (firstvar lastvar)
 (PROG (aa bb)
       (SETQ bb (GETWEIGHTDPS))
       (SETQ aa firstvar)
%       (SETQ rt 0)
  Ml   (CHANGEPBS 1  (CDR (ATSOC  aa bb)) 0)
       (COND ((LESSP aa lastvar)(SETQ aa (ADD1 aa))(GO Ml)))
        
))

%Adding degrees of the modlist to PBS
(DE ADDTOPBS (modlist)
  (PROG (aa)
  %  (PRIN2T "Inside ADDTOPBS")
    (SETQ aa modlist)
 L  (COND (aa 
            (CHANGEPBS 1 (LISPPOLTOALDEGREE (CAR aa)) CURHOMDEG)
            (SETQ aa (CDR aa))
            (GO L)))
         %  (PRIN2T "Finished ADDTOPBS")
              
))

%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%
%        End of the procedures for PBS                     %
%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%
%----------------------------------------------------------

%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%
%%%      Procedures to work with monomials
%%%  and polynomials in pure LISP lists form
%%%  The main differnse is absens of 0 in the end of 
%%%  monomials and ponters in the beginning
%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%% 


% Calulats the degree of a monomial
%Note: LISP monom has no 0 at the end
(DE MONLISPTOTALDEGREE (lispmonom) 
 (PROG  (aa bb rt)
        (SETQ aa (CDR lispmonom))
        (SETQ bb (GETWEIGHTDPS))
        (SETQ rt 0)
  Ml        (COND (aa
               (SETQ rt (PLUS2 rt (CDR (ATSOC (CAR aa) bb))))
               (SETQ aa (CDR aa))
               (GO Ml)))
        (RETURN rt) ))
% Calulats the degree of a polynomial
(DE LISPPOLTOALDEGREE (pol) (MONLISPTOTALDEGREE (CAR pol)))

% Procedure to print polynomial in LISP form
(DE PRINTLISPPOL (pol) (COND (pol (REDANDALGOUT (LISPPOL2REDAND (COPY pol))))
                              (T (PRIN2 "0") (TERPRI))))

% Procedure to print the list of polynomials in the LISP form
(DE PRINTLIST (lst) (MAPC lst 'PRINTLISPPOL))

%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%
%   Procedures working with the first letter   %
%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%

 (DE REPLACEFIRSTVARINMON (Cfmon ) (RPLACA (CDR Cfmon) 1))
  
 (DE REPLACEFIRSTVARINPOL (Pol ) (MAPC Pol 'REPLACEFIRSTVARINMON))
      
 (DE REPLACEFIRSTVARINLISTPOL (Lst ) (MAPC Lst 'REPLACEFIRSTVARINPOL ))
 
 (DE DELETE1FIRSTLETTERINMONOM (cfmon) (RPLACD  cfmon (CDDR cfmon)))

 (DE DELETEFIRSTLETTER1INPOLYNOM (pol)  (MAPC pol 'DELETE1FIRSTLETTERINMONOM ))
 
 (DE DELETEFIRSTLETTER1INLISTPOL (lst) (MAPC lst 'DELETEFIRSTLETTER1INPOLYNOM))

%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%
%   Procedures working with one letter monomials %
%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%

% Checks if the pure LISP monomial consists of one letter only (with the coef)
 (DE  ONELETTERMONOMP (cfmon ) (EQN (LENGTH cfmon ) 2))

%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%
%   Procedures working with leading  monomials   %
%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%

%The procedure checking if the leading monomial of a polynomial in
% the LISP form  is one of the GB leading monomials
(DE GBLEADMONOM (lisppol)
 (PROG (Pmon)
       (SETQ Pmon (LISTCOPY (CDAR lisppol)))
       (RETURN (NOT (NOT (MEMQ (MONINTERN Pmon) GBasis)))) ))

%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%
%            Different filters                  %
%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%

%                ONELETTER FILTERS              %

% The procedure consider the leading monomials
% of the list of polynomials in the LISP form 
% and creates another list that contains only those polynomials
% were this monomial is not  constan mutiplied by single var. Not destructive /ufn 2005-08-04 

(DE  ONELETTERFILTER (lst )
  (PROG (res AA )

	(SETQ AA lst)
  Label	(COND (AA 
		  (COND ((NOT ( ONELETTERMONOMP(CAAR AA)))
                         (SETQ res (CONS (CAR AA) res))))
                 
		  (SETQ AA (CDR AA))
		  (GO Label)
		)
	)
	(RETURN res)
 ))


%The same filter, but reduce the global variable PBS for every 
%skipped polynomial
 (DE  PBSONELETTERFILTER (lst )
  (PROG (res AA )

	(SETQ AA lst)
  Label	(COND (AA 
		(COND ((ONELETTERMONOMP (CAAR AA)) 
                          (CHANGEPBS -1  ( MONLISPTOTALDEGREE  (CAAR AA))
                                                    CURHOMDEG))                                           
                         (T  (SETQ res (CONS (CAR AA) res))))
                 
		  (SETQ AA (CDR AA))
		  (GO Label)
		)
	)
	(RETURN res)
 ))

%                          FIRSTLETTERFILTER

% The procedure consider the first letter of the leading monomials
% of the list of polynomials in the LISP form 
% and creates another list that contains only those polynomials
% which have this letter between m and n. Not destructive /ufn 2005-06-30
 (DE FIRSTLETTERFILTER (lst m n)
  (PROG (res AA Letter mm nn)
	(SETQ mm (SUB1 m))
	(SETQ nn (ADD1 n))
	(SETQ AA lst)
  Label	(COND (AA (SETQ Letter (CADAR (CAR AA)))
		  (COND ((AND (BMI!< mm Letter) (BMI!< Letter nn))
                         (SETQ res (CONS (CAR AA) res))))
                 
		  (SETQ AA (CDR AA))
		  (GO Label)
		)
	)
	(RETURN res)
 ))

%                         GBLEADMONLFILTER

% Procedure that filter a list of polynomials(in LISP FORM) and gives as result
% the list consisting of those polynomials which leading monomial are not
% GB leading monimials. Not destructive  /ufn 205-06-30
(DE GBLEADMONLFILTER (lst)
 (PROG (res AA)
        (SETQ AA lst)
  Label	(COND (AA (COND ((NOT (GBLEADMONOM (CAR AA)))
                         (SETQ res (CONS (CAR AA) res))))
                
		  (SETQ AA (CDR AA))
		  (GO Label)
               )
         )
	(RETURN res)
         
))

%                           GENERAL FILTER

%(DE FILTER (lst 'CONDITION) Does not work.
%  Should be rewritten.
% (PROG (res AA Pol)
%        (SETQ res (NCONS NIL))
%        (SETQ AA lst)
%Label           (COND (AA (COND (  (CONDITION (CAR AA))
%                         (SETQ res (NCONS (CAR AA) res))))
%                
%                   (SETQ AA (CDR AA))
%                   (GO Label)
%               )
%         )
%   (RETURN res)
%         
%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%
%  End of procedures with pure LISP form
%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%
%---------------------------------------------------------------------

%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%
%       Procedures for calculating of SYZYGIES
%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%


% Procedure to calculate GB for module of syzygies in a free module 
%     (First version written in 05-08-04/ufn)
% Takes ring relations, and elmetns of a free module, 
% generates new names for those elements
% It is supposed that the 
% ring and module variables are already introduced and the corresponding
% weights are already in the weights. All this information is saved in varsetup.
% It is supposed also that the rings relations (or GB in later versions) is
% saved in the global variable tmplist in LISPFORM
% module elements are given in the second parameter modlist and also
% in the LISPFORM.
% ind1start ind1finish,ind21start, ind2finish are already choosen.
% MAXDEG and NMODGEN  are already known.
% but we may be in the situation after CLEARRING
% The procedure puts new names between the ring and module variables.
% That is why it should change the inner numbering in all monoms.
% After that it calcultes GB and give as result only those elements
% of GB which starts from the new names.

(DE PURESYZYGIES (varsetup modlist)
 (PROG (TMP LENG res !*REDEFMSG !*USERMODE)
   % (PRIN2T "Started new PURESYZ")
    (COND 
     ((NOT (EQ (GETOBJECTTYPE) 'MODULE))
           (SETMODULEOBJECT)
           (TERPRI)
           (PRIN2 "*** We turn on the MODULE mode")
           (TERPRI)
      )
    )
 %recovering necessary names and weights  of variables   
    (SETSETUP varsetup)  
     (NONCOMMIFY)
    
%Here we plan  to add additional relations  
    (LOAD HSERIES)
   % (PRIN2T "Started insertvars in PURESYZ")
    (Insertnewvars  modlist)
 
   %  (PRIN2T "Started GI in PURESYZ") 
   (GROEBNERINIT)
   % (PRIN2T "Started GK in PURESYZ")
   (GROEBNERKERNEL)
 % (PRIN2T "Finished GK in PURESYZ")
%we do not need ind1finish  more and change it for possible next use
   (SETQ ind1finish (PLUS2 (DIFFERENCE ind2finish ind2start)ind1start))
   (SETQ res (FIRSTLETTERFILTER  (OUTPUT2LISPPOLS) ind1start  ind1finish))
   
  % (TERPRI)
  % (PRIN2T "----------------------------------------------------------------") 
   % (PRINTLIST res)
   % (PRIN2T "Finished PURESYZ")
  (RETURN res)
 ))

% Procedure to calculate GB for module of syzygies in a free module. 
% Takes ring relations, and elmetns of a free module, 
% generates new names for those elements
% It only reads the input and call PURESYZYGIES
% Uses the call of SyzStep1, which probably leads to some errors.
% Should be rewritten!!!!!
% Input from files should be realised too (does not work now)
% Return is in the lispform, ehich is printed. Was not used directly
% in MINR
(DF SYZYGIESGB (files)
%      (InputFile  OutFile)
 (PROG (TMP LENG modlist res !*REDEFMSG !*USERMODE)
    
     (NONCOMMIFY)
     
     (LOAD HSERIES)
     (SETSAFELOWTERMSHANDLING)
 
    (SETQ LENG (LENGTH files))
    (COND ( (EQ LENG 0)	 ( SyzScrInput1)
                         ( SETQ modlist (SyzScrInput2))
                          (SETQ bnmOutFile NIL ))
      %    ( (EQ LENG 1) (bnmCheckInput files)  )
      %    ( (EQ LENG 2) (bnmCheckOutput files) (bnmCheckInput files) )

    )
    (SyzStep1) %added to skip the error messages, but probably should be
               % replaced /ufn 2007-08-20
    (COND (bnmOutFile (DOP bnmOutFile)  )
          (T  (DEGREEOUTPREPARE))
    )
     (COND ((NOT (GETWEIGHTS)) (SETWEIGHTSTOONE)))
    (SETALGOUTMODE ALG)
 (RETURN  (PURESYZYGIES (LIST (GETSETUP VARIABLESETUP))  modlist))
   
 ))

% Another variant of syzygies calculates the minimal generating 
% set of syzygies. Do not know if it still works now /ufn 2006-08-20
% Was created as a test for the step in the mininimal resolution.
% Working but is  not nercessary.
% Procedure to calculate GB for module of syzygies in a free module.
% Takes ring relations, and elmetns of a free module, 
% generates new names for those elements
% generates one name more: all syzyzges are started from this name
% The message and information about f-variable (first one) should be added???
% (probably for debug only)
% It should be first in the list vars. It should be explanation what is output 
% how extra names are connected with module elements (sorted, not as in input)
% Information about weights also. See example in file "input" in bin/Linux_elf
% for example.
% Adding weights should vbe improved (if it was nil). Now weights are
% mandatory before the call.
(DF SYZYGIESMIN (files)
%      (InputFile  OutFile)
 (PROG (TMP LENG modlist newmodlist varsetup res !*REDEFMSG !*USERMODE)
    
     (NONCOMMIFY)
     
     (LOAD HSERIES)
     (SETSAFELOWTERMSHANDLING)
 
    (SETQ LENG (LENGTH files))
    (COND ( (EQ LENG 0)	 ( SyzScrInput1)
                                                         ( SETQ modlist (SyzScrInput2))
                                                        (SETQ bnmOutFile NIL ))
      %    ( (EQ LENG 1) (bnmCheckInput files)  )
      %    ( (EQ LENG 2) (bnmCheckOutput files) (bnmCheckInput files) )

    )

    (COND (bnmOutFile (DOP bnmOutFile)  )
          (T  (DEGREEOUTPREPARE))
    )
    (SETALGOUTMODE ALG)
   (SETQ PBS NIL)
   (SETQ CURHOMDEG 1)
   (SETQ modlist (PBSONELETTERFILTER (PURESYZYGIES (LIST (GETSETUP VARIABLESETUP))  modlist)))
    (ADDTOPBS modlist)
  (PRIN2 "PBS=")
  (PRIN2T PBS)
   (SETQ varsetup  (LIST (GETSETUP VARIABLESETUP) ))
   (SETQ ind2start (ADD1 (GETVARNO)))
  (CLEARRING)
%  (PRIN2T "modlist before ")(PRIN2T modlist)
  (SETQ newmodlist ( PURESYZYGIES  varsetup  modlist))
 %(PRIN2T "newmodlist  ")(PRIN2T newmodlist)
%  (PRIN2T "modlist after syz ")(PRIN2T modlist)
  (SETQ res  (PBSONELETTERFILTER newmodlist)) 
%(PRIN2T "modlist after filter ")(PRIN2T modlist)
  (TERPRI)
    (PRIN2T "----------------------------------------------------------------")  
  (PRIN2T "----------------------------------------------------------------") 
    (PRINTLIST res)
(PRIN2 "PBSAfter=")
  (PRIN2T PBS)
  (RETURN res) 
  
 ))

% The procedure takes a generating set for ring and calulated GB for
% a module (without ring GB) and create the minimal generating set
% for this module. All is in the LISP form. 
% ring ideal generators (or GB later) are saved in tmplist
% in LISP form. Varetup is already correct 
% ind1start  ind1finish have correct values bounds for mod generators. 
%  /ufn 2005-07-01 should be written !!!!!

(DE GBMODULE2GEN (  varsetup  gbmod)
  (PROG (tmp ring)
         (CLEARIDEAL)
         (SETQ ring tmplist)
         (SETQ tmplist NIL)
	 (SETSETUP varsetup)     
       %  (SETQ tmp (COPY gbmod))
         (SETQ tmp  gbmod )
         (ON CUSTSTRATEGY)
          
         (SETQ tmp  (APPEND tmp  (COPY  ring)))
       %  (PRIN2T "tmp before LISPPOLS2INPUT")
       %  (PRINTLIST tmp)
         (LISPPOLS2INPUT tmp)
         (GI)
         (GK)
        % (GF)to skip output
         (SETQ tmp tmplist)
         (SETQ tmplist ring)
         %(PRIN2T "tmp before filter") (PRINTLIST tmp)
         (SETQ tmp (FIRSTLETTERFILTER tmp ind1start  ind1finish))
        % (PRIN2T "tmp efter filter") (PRINTLIST tmp)
         (OFF CUSTSTRATEGY)
         (RETURN tmp)
))


(DE minresCUSTNEWINPUTGBEFIND ()
 (PROGN 

        %(PRIN2T "in CUSTNEWINPUTGBEFIND")
        (SETQ NGroeb (ReducePol (CAR cInPols)))
      %  (PRIN2T "NGroeb=") 
      % (COND (NGroeb (PRINTLISPPOL (REDAND2LISPPOL NGroeb)))
       %       ( T (PRIN2T 0)))
       
        (SETQ cInPols (CDR cInPols))
       
        (COND ( NGroeb  
               % (PRIN2T "Adding!")
                (SETQ tmplist (APPEND tmplist (LIST(REDAND2LISPPOL   NGroeb)))))
          % (T (PRIN2T " Not adding."))
        )
      %  (PRIN2T "finished CUSTNEWINPUTGBEFIND") (PRIN2T "NGroeb still=") 
      % (COND (NGroeb (PRINTLISPPOL (REDAND2LISPPOL NGroeb)))
       %       ( T (PRIN2T 0)))
        NGroeb ))



(DE minresCUSTENDDEGREE () (ASSOC (GETCURRENTDEGREE) InPols))

(DE minresCUSTNEWCDEGFIX (bnn)
 (PROG        (!*CUSTSTRATEGY)
        (COND ((EQN bnn 3)
               (SETQ InPols (CONS (CONS (GETCURRENTDEGREE) cInPols)
                                    InPols))
               (SETQ cInPols NIL)
               (RETURN (FixNcDeg 2))))
        (RETURN (FixNcDeg bnn)) ))

%  For the time being, no itemwise variant is planned, whence the
% following two procedure suggestions are left undefined.

%%# MinResDegreewise () : - ;
%(DE MinResDegreewise ()
% (PROGN (COPYD 'minresNEWINPUTGBEFIND 'degminresNEWINPUTGBEFIND)
%	(COND ((EQ (GETRESOLUTIONTYPE) 'MINIMAL)
%	       (COPYD 'CUSTNEWINPUTGBEFIND 'minresNEWINPUTGBEFIND)) ) ))
%
%%# MinResItemwise () : - ;
%(DE MinResItemwise ()
% (PROGN (COPYD 'minresNEWINPUTGBEFIND 'itemminresNEWINPUTGBEFIND)
%	(COND ((EQ (GETRESOLUTIONTYPE) 'MINIMAL)
%	       (COPYD 'CUSTNEWINPUTGBEFIND 'minresNEWINPUTGBEFIND)) ) ))

%# SETMINIMALRESOLUTION () : id ;
(DE SETMINIMALRESOLUTION ()
 (PROG	(rt !*USERMODE !*REDEFMSG)
	(SETQ rt (GETRESOLUTIONTYPE))
	(APPLYIFDIFFANDDEF1 (SETQ !#!&ResTyp!# 'MINIMAL)
			    rt
			    !$!&ResolutionTypeEnds!#!*)
	(COPYD 'ResolutionInit 'NILNOOPFCN0)
	(COPYD 'ResolutionFixcDegEnd 'NILNOOPFCN0)
	(COND ((NOT (EQ (GETRESOLUTIONTYPE) rt))
	       (SETQ !#minresoCustNIGbeF (GETD 'CUSTNEWINPUTGBEFIND))
	       (COPYD 'CUSTNEWINPUTGBEFIND 'minresCUSTNEWINPUTGBEFIND)
	       (SETQ !#minresoCustED (GETD 'CUSTENDDEGREE))
	       (COPYD 'CUSTENDDEGREE 'minresCUSTENDDEGREE)
	       (SETQ !#minresoCustNcDF (GETD 'CUSTNEWCDEGFIX))
	       (COPYD 'CUSTNEWCDEGFIX 'minresCUSTNEWCDEGFIX)))
	(RETURN rt) ))

% Leaving the MINIMAL resolution type mode "hook" procedure.  It is
% executed only if the mode is replaced by another one, whose name
% is provided as an argument.  It is NOT something the user should
% call out of context!

%# LeaveMINIMALRESOLUTION (id) : - ;
(DE LeaveMINIMALRESOLUTION (newmd)
 (PROGN	(COND (!#minresoCustNIGbeF
	       (PUTD 'CUSTNEWINPUTGBEFIND 'EXPR (CDR !#minresoCustNIGbeF)))
	      (T (REMD 'CUSTNEWINPUTGBEFIND)))
	(COND (!#minresoCustED
	       (PUTD 'CUSTENDDEGREE 'EXPR (CDR !#minresoCustED)))
	      (T (REMD 'CUSTENDDEGREE)))
	(COND (!#minresoCustNcDF
	       (PUTD 'CUSTNEWCDEGFIX 'EXPR (CDR !#minresoCustNcDF)))
	      (T (REMD 'CUSTNEWCDEGFIX))) ))

(ON RAISE)

