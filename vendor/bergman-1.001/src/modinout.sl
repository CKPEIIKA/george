%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%
%% Copyright (C) 1995,1996,2003,2004,2005 2006 Joergen Backelin,
%% Svetlana Cojocaru, Victor Ufnarovski
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

(OFF RAISE)

%	CHANGES:


%  Added procedures  NONES and  SETWEIGHTSTOONE
%  to simplify the authomatic setting  all  weights in varlist equal to 1
%  the corresponding calls added in SysStep1/ ufn 2007-08-20
%  Introduced InCoeff2RedandCoeff in the definitions of
%  ShortMonom and VeryShortMonom./JoeB, ufn 2007-08-15

%  Replaced MAXDEG by GETMAXDEG and SETMAXDEG //ufn 2006-08-09

%  Added procedures for input for syzygies: SyzScrInput1,SyzScrInput2,
%  procedures for changing the order of variables:
%  Newindex*, InsertNew*, and  *SYZYGIESADDITIONALRELATIONS,
%  VeryShortMonom, Monompol
%  Global variables:tmplist   ind1start  ind2start
%          ind1finish ind2finish
%  /ufn 2006-08-07

%  Added two procedures to generate iovars /ufn 2005-06-28 ADDIOVAR,GENIOVAR

%  Added procedure for syzygies additional relations:
%  SYZYGIESADDITIONALRELATIONS,Monompol BinomsForSiziges SizScreenInput
%  and 5 global variables  Homomorphismvar FirstRingvar LastRingvar Modstartvar Modlastvar
%   /ufn 2005-06-27

%  Added input and output checkers for rabbit /ufn 2005-06-21

%  Corrected a message./(SC 2004-10-08), JoeB 2005-01-07

%  HomogVarIndex --> !$!&HomogVarIndex!#./JoeB 2004-05-05

%  Replaced (LENGTH (GETINVARS)) by (InVarNo)./JoeB 2003-08-18

%  Corrected FACTALGADDITIONALRELATIONS./JoeB 2002-10-12

%  2002-07-11, VU and SC added FACTALGADDITIONALRELATIONS and
% HOCHADDITIONALRELATIONS, and numerous auxiliaries for these.

%  Removed ! within quotes./JoeB 1999-07-02


% Imports: PrintSeries, DoublePrint, DoubleNewLine, NLength, serMaxLength,
%	   powChangeSign; MaxL.
% Exports: ScreenInput, CheckInput, CheckOutputGB, CheckOutputHs,
%	   DoublePrint, DoubleNewLine, PrintSeries, PrintForAnick,
%	   revnoncommPolAlgRead, BinomsForNCHomogenisation,
%	   FACTALGADDITIONALRELATIONS, HOCHADDITIONALRELATIONS.
% Available:

(GLOBAL '(NMODGEN SERMAXDEG OutModFile GbOutFile ScInput InModFile InRingFile
	 !$!&HomogVarIndex!# HsOutFile MaxL InPols PBSOutFile
          Homomorphismvar FirstRingvar LastRingvar tmplist   ind1start  ind2start
          ind1finish ind2finish))





(DE ScreenInput ()

          (SETQ ScInput T)
          (PRIN2 "Input the Maximum Degree you want to calculate")(TERPRI)
          (SETMAXDEG (READ))
          (PRIN2 "Input the number of module generators")(TERPRI)
          (SETQ NMODGEN (READ))
          (PRIN2 "Now input ALL ring and module variables but ONLY") (TERPRI)
          (PRIN2 "the ring ideal generators in algebraic form, thus:")
          (TERPRI) (PRIN2 "      vars v1, ..., vn;") (TERPRI)
          (PRIN2 "       r1, ..., rm;") (TERPRI)
          (PRIN2 "where v1, ..., vn are all the variables, and r1, ..., rm the generators.")
          (TERPRI)
          (ALGFORMINPUT)

)

(DE ScreenInput0 ()

          (SETQ ScInput T)
          (PRIN2 "Input the Maximum Degree you want to calculate")(TERPRI)
          (SETMAXDEG (READ))
          (PRIN2 "Input the number of module generators")(TERPRI)
          (SETQ NMODGEN (READ))
          (PRIN2 "Now input extra homomorphism variable (e.g. f)," )(TERPRI)
           (PRIN2   "ALL ring and module variables (in this order)  and") (TERPRI)
          (PRIN2 "the ring ideal generators in algebraic form, thus:")
          (TERPRI) (PRIN2 "      vars f, v1, ..., vn;") (TERPRI)
          (PRIN2 "       r1, ..., rm;") (TERPRI)
          (PRIN2 "where v1, ..., vn are all the variables, and r1, ..., rm the generators.")
          (TERPRI)
          (ALGFORMINPUT)
)

%Input for syzigies
 (DE SyzScrInput1 ()

         (ScreenInput)

  )

(DE SyzStep1 ()
         (COND ((NOT (GETWEIGHTS)) (SETWEIGHTSTOONE)))
         (SETQ FirstRingvar 1)
         (SETQ  LastRingvar (DIFFERENCE (GETVARNO)  NMODGEN))
         (SETQ   Modstartvar (ADD1 LastRingvar))
         (SETQ   Modlastvar (GETVARNO))
         (SETQ  ind1start Modstartvar)
         (SETQ  ind1finish  (GETVARNO))
         (SETQ  ind2start (ADD1 ind1finish))
         (SETQ tmplist  (MAPCAR (DEGLIST2LIST InPols) 'REDAND2LISPPOL))
  )

(DE SyzScrInput2 ()
 (PROG (tmp)
         (PRIN2 "Now input  module elements:") (TERPRI)
         (ALGFORMINPUT)
  ))

(DE SyzStep2 ()
 (PROG (tmp)
          % (PRIN2T "Before inserting")  (PRIN2T tmplist)
            (RETURN (MAPCAR (DEGLIST2LIST InPols) 'REDAND2LISPPOL))
))

(DE  Insertnewvars (modlist)
  (PROG (tmp  oldw  oldv)
% (PRIN2T "length of modlist=") (PRIN2T (LENGTH  modlist))
  ( LISPPOLS2INPUT (COPY modlist ))
%(PRIN2T "After copiing of modlist")
  (InsertNewvarsinIndegList  InPols)
%(PRIN2T "After InsertNewvarsinIndegList ")
  (SETQ ind2finish (GETVARNO))
  (SETQ tmp (MAPCAR (DEGLIST2LIST InPols) 'REDAND2LISPPOL))
 % (PRIN2T "length of tmp after inserting") (PRIN2T (LENGTH tmp))
(SETQ oldw (GETWEIGHTS))
(SETQ oldv (GETINVARS))
  (CLEARIDEAL)
  (NewindexinList  tmp)
  (NewindexinList  modlist)
 (NewindexinVar  oldv oldw )
% (PRIN2T "length of tmp after changing=") (PRIN2T (LENGTH tmp))
  (SETQ tmp  (APPEND tmp  (COPY  tmplist)))
% (PRIN2T "tmp after append") (PRIN2T tmp)
 ( LISPPOLS2INPUT tmp)
))

%two procedures to add a new variable with weight /ufn 2005-06-28
(DE  ADDIOVAR (var weight )
  (PROG (varlist weightlist r)
  (SETQ varlist (NCONC (GETINVARS)(LIST var)) )
  (CLEARVARNO)
  (SETIOVARS varlist)

  (SETQ weightlist  (NCONC (GETWEIGHTS) (LIST weight)))
  (EVAL (CONS 'SETWEIGHTS weightlist))
  (RETURN (GETVARNO))
))

(DE GENIOVAR (weight) (ADDIOVAR (GENSYM) weight))

%easy, non-efficient procedure for creating list of n ones 
(DE NONES (n)
(COND ((LESSP n 1) NIL)
      ((EQN n 1) (LIST 1))
      (T (NCONC (NONES (SUB1 n))  (LIST 1)))
)) 

%a procedure setting  all  weights in varlist equal to 1
(DE SETWEIGHTSTOONE ()
 (PROG (n) 
   (SETQ n (GETVARNO))
   (EVAL (CONS 'SETWEIGHTS (NONES n)))
)
)
  


(DE CheckInput (files)
  (COND ( (NOT (AND (FILEP (CAR files)) (FILEP (CADR files))))
          (PRIN2 "***Input files must exist")  (TERPRI)
          (PRIN2 "Input data from the keyboard")  (TERPRI)
          (ScreenInput)
        )
        (T
           (SETQ InRingFile (CAR files))
           (SETQ InModFile  (CADR files))
           (SETQ ScInput NIL)
           (DSKIN InRingFile)
        )
  )
)

(DE CheckInputPBS (files)
  (COND ( (NOT (AND (FILEP (CAR files)) (FILEP (CADR files))))
          (PRIN2 "***Input files must exist")  (TERPRI)
          (PRIN2 "Input data from the keyboard")  (TERPRI)
          ( SyzScrInput1)

        )
        (T
           (SETQ InRingFile (CAR files))
           (SETQ InModFile  (CADR files))
           (SETQ ScInput NIL)
           (DSKIN InRingFile)

        )
  )
)
(DE CheckOutputPBS (files )
  (PROG (name)
   (COND (ScInput (SETQ name (CAR files)))
         (T       (SETQ name (CADDR files)))
   )
   (COND ( (NOT (STRINGP name) )
           (PRIN2 "***Incorrect output file.") (TERPRI)
           (PRIN2 "Do you agree to use the file outf____.pbs as output ?" )
           (TERPRI)
           (COND ( (YESP "Type Yes or No")
                   (SETQ PBSOutFile "outf____.pbs")
                   (PRIN2 "outf____.pbs is used as output file") (TERPRI)
                   (PRIN2 "Don't forget to rename it after calculations. " )
                   (TERPRI)
                )
                (T
                   (PRIN2 "No output file. Program is canceled") (TERPRI)
                   (QUIT) %It should be changed after the implementation
                          %of new input-output files handling procedure
                )
           )
         )
         (T (SETQ PBSOutFile name))
   )
))

(DE CheckOutputGB (files )
   (COND ( (NOT (STRINGP (CADDR files)) )
           (PRIN2 "***Incorrect output file.") (TERPRI)
           (PRIN2 "Do you agree to use the file outf____.mgb as output ?" )
           (TERPRI)
           (COND ( (YESP "Type Yes or No")
                   (SETQ GbOutFile "outf____.mgb")
                   (PRIN2 "outf____.mgb is used as output file") (TERPRI)
                   (PRIN2 "Don't forget to rename it after calculations. " )
                   (TERPRI)
                )
                (T
                   (PRIN2 "No output file. Program is canceled") (TERPRI)
                   (QUIT) %It should be changed after the implementation
                          %of new input-output files handling procedure
                )
           )
         )
         (T (SETQ GbOutFile (CADDR files)))
   )
)

(DE CheckOutputHs (files)
    (COND ( (NOT (STRINGP (CADDDR files)))
            (PRIN2 "***Incorrect output file.") (TERPRI)
            (PRIN2 "Do you agree to use the file outf____.mhs as output ?" )
            (TERPRI)
            (COND ((YESP "Type Yes or No")
                   (SETQ HsOutFile "outf____.mhs")
                  )
                  (T
                   (PRIN2 "No output file. Program is canceled") (TERPRI)
                   (QUIT) %It should be changed after the implementation
                          %of new input-output files handling procedure

                  )
             )
          )
          (T (SETQ HsOutFile (CADDDR files)))
    )
)
%The same as CHANNELPRIN2
(DE ChannelWrite (outchan outitem)
   (PROG (oldchannel)
       (SETQ oldchannel (WRS outchan))
       (PRIN2 outitem)
       (WRS oldchannel)
   )
)

%The same as CHANNELTERPRI
(DE ChannelNewLine (outchan)
   (PROG (oldchannel)
       (SETQ oldchannel (WRS outchan))
       (TERPRI)
       (WRS oldchannel)
   )
)

(DE DoublePrint (What)
   (PROGN
    (PRIN2 What)
    (COND (OutModFile (ChannelWrite  OutModFile What))
    )
   )
)

(DE DoubleNewLine ()
  (PROGN
   (TERPRI)
   (COND (OutModFile (ChannelNewLine OutModFile))
   )
  )
)

(DE PrintPara (para)
        (PROGN
           (COND ( (NEQ (CDR para) 0)
                   (PROGN
                      (OutSpaces (DIFFERENCE MaxL (NLength (CDR para))))
                      (COND
                       ((MINUSP (CDR para)) (DoublePrint " "))
                       ( T                  (DoublePrint "+"))
                      )
                      (DoublePrint  (CDR para))
                      (COND
                         ( (NEQ (CAR para) 0)
                              (PROGN
                                 (DoublePrint  "*t^")
                                 (DoublePrint  (CAR para))
                              )
                         )
                       )
                       (DoubleNewLine)
                   )
                 )
                  (T NIL)
           )
        )
)


(DE PrintSeries (ser)
          (PROGN
            (DoubleNewLine)
            (serMaxLength ser)
            (MAPC ser 'PrintPara)
          )
)

(DE OutSpaces (N )
    (COND ((LESSP N 1) NIL)
          (T (PROGN
              (DoublePrint " ")
              (OutSpaces (SUB1 N))
             )
    )     )
)

(DE Prettyprintoutvars (outchan varslist)
 (PROG (ov oldch)
       (COND ((NOT (SETQ ov varslist))
              (RETURN NIL)
             )
       )
       (SETQ oldch (WRS outchan))
       (PRIN2 (CAR ov))
   M1  (COND ((SETQ ov (CDR ov))
              (PRIN2 ",")
              (PRIN2 (CAR ov))
              (GO M1)
            )
       )
       (WRS oldch)
       (RETURN T)
 )
)
(DE PrintForAnick ()
  (PROG (modbegin)
    (ChannelWrite  GBasOutChan  "% setinvars ")
    (Prettyprintoutvars GBasOutChan  (GETOUTVARS))
    (ChannelWrite  GBasOutChan  ";")
    (ChannelNewLine  GBasOutChan)

    (ChannelWrite  GBasOutChan  "% setmodulevars ")
    (SETQ modbegin (DIFFERENCE (LENGTH (GETOUTVARS)) (DIFFERENCE NMODGEN 1)))

    (Prettyprintoutvars GBasOutChan  (PNTH (GETOUTVARS) modbegin))
    (ChannelWrite  GBasOutChan  ";")
    (ChannelNewLine GBasOutChan)


    (ChannelWrite  GBasOutChan  "% (SETMAXDEG ")
    (ChannelWrite  GBasOutChan  (GETMAXDEG))
    (ChannelWrite  GBasOutChan  " )")
    (ChannelNewLine GBasOutChan)
  )
)

%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%
% Procedures for reverting  input polynomoals                %
%  Added by SC & VU 02-06-09                                 %
%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%

%(DE RevCopyMon (mon)
%   (CONS (CAR mon) (MONINTERN (REVERSE (DELETE 0 (CDDR mon))))))

% More modularised version /JoeB 02-06-27
(DE RevCopyMon (cfmon)
   (Cf!&Mon2Tm (Cf cfmon) (MONINTERN (REVERSE (MONLISPOUT (Tm2PMon cfmon))))))


(DE RevCopyPol (pol)
 (PROG (newpol p)
  (SETQ newpol (NCONS NIL))
  (SETQ p (CDR pol))
NextMonom
 (COND ((NULL p)

         (RETURN newpol))
 )
 (TermInsert (RevCopyMon (CAR p)) newpol)
 (SETQ p (CDR p))
 (GO NextMonom)
 ))


%(DE ShiftCopyMon (mon n) (CONS (CAR mon) (MONINTERN (ADDINTTOLIST (DELETE 0 (CDDR mon)
%) n))))

(DE ShiftCopyMon (cfmon n) (Cf!&Mon2Tm (Cf cfmon) (MONINTERN (ADDINTTOLIST (MONLISPOUT (Tm2PMon cfmon)
) n))))

(DE SHIFTCopyPol (pol n)
 (PROG (newpol p)
  (SETQ newpol (NCONS NIL))
  (SETQ p (CDR pol))
NextMonom
 (COND ((NULL p)
         (RETURN newpol))
 )
 (TermInsert (ShiftCopyMon (CAR p)n ) newpol)
 (SETQ p (CDR p))
 (GO NextMonom)
 ))

(DE SHIFTCopyListPol (ll n)
  (PROG (res)
  (COND ((NULL ll)(SETQ res NIL))
        (T (SETQ res (CONS (SHIFTCopyPol (CAR ll) n) (SHIFTCopyListPol (CDR ll) n)))))
  (RETURN res)))

%(DE RevCopyListPol (listpol)
% (PROG (newlist p)
% (SETQ newlist (NCONS NIL))
% (SETQ p  listpol)
%NextPol
% (COND ((NULL p) (RETURN newlist)))
% (SETQ newlist (CONS (RevCopyPol (CAR  p)) newlist))
% (PRIN2 "Here in NextPol l= ")(PRIN2 (LENGTH newlist))
% (SETQ p (CDR p))
% (GO NextPol)
%))

%(DE RevShiftCopyListPol (listpol n)
%  (PROG (ll)
%  (SETQ ll (MAPCAR listpol 'RevCopyPol))
%  (RETURN (SHIFTCopyListPol ll n))
%))

(DE RevShiftCopyListPol (listpol n)
 (SHIFTCopyListPol (MAPCAR listpol 'RevCopyPol) n)
)

(DE revnoncommPolAlgRead (JustRead)
  (RevCopyPol (noncommPolAlgRead JustRead)))
%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%
%% End of Procedures for reverting  input polynomoals    %%%%
%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%

%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%
% Procedures to change the order of variables: all indeces for variables in the interval
% ind1start ind2start-1 add the value indplus;
%allvariables in the interval  indstart2 ind2finish substract indminus
%  ind1start, ind2start,ind2finish are global variables
% ind1start < ind2start <=ind2finish;  indplus=ind2finish- ind2start+1 indminus=ind2start-ind1start
%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%
(DE Newindex (i)
 (COND ((LESSP  i  ind1start) i)
                ((LESSP  i (ADD1 ind1finish)) (BMI!+ i  (BMI!-(ADD1 ind2finish) ind2start)))
                ((LESSP i (ADD1 ind2finish)) (BMI!- i  (BMI!-  ind2start  ind1start)))
                (T i))
)

(DE NewindexinCAR (lst)
(RPLACA lst (Newindex (CAR lst)))
)

(DE NewindexinMonom (Cfmon)
 (PROG (AA)
  (SETQ AA (CDR Cfmon))
L1
  (COND (AA (NewindexinCAR AA) (SETQ AA (CDR AA)) (GO L1)))
 ))

(DE NewindexinTerm(Cfmon) (MAPC (Tm2PMon Cfmon) 'NewindexinCAR))

(DE NewindexinPolynom (Pol) (MAPC Pol 'NewindexinMonom))

(DE NewindexinList (Lst) (MAPC Lst 'NewindexinPolynom))

(DE Newindexchange (oldlist)
 (PROG( AA res i)
 (SETQ AA oldlist)
 (SETQ i 1)
 (SETQ res NIL)
Lab1
 (COND ((LESSP i ind1start)
                  (SETQ res (NCONC res (LIST(CAR AA))))
                  (SETQ AA (CDR AA))
                  (SETQ i (ADD1 i))
                  (GO Lab1)))

 (SETQ AA (PNTH oldlist ind2start))
(SETQ i  (SUB1 ind2start))
Lab2
(COND ((LESSP i ind2finish)
                  (SETQ res (NCONC res (LIST(CAR AA))))
                  (SETQ AA (CDR AA))
                  (SETQ i (ADD1 i))
                  (GO Lab2)))

(SETQ AA (PNTH oldlist ind1start))
(SETQ i  (SUB1  ind1start))
Lab3
(COND ((LESSP i ind1finish)
                  (SETQ res (NCONC res (LIST(CAR AA))))
                  (SETQ AA (CDR AA))
                  (SETQ i (ADD1 i))
                  (GO Lab3)))
(RETURN res)
))

(DE NewindexinVar  (oldv oldw )
(PROG (weightlist)
  (CLEARVARNO)
  (SETIOVARS (Newindexchange oldv))
 (SETQ weightlist  (Newindexchange oldw))
   (EVAL (CONS 'SETWEIGHTS weightlist))
))





%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%
% End of Procedures for changing the order of variables
%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%


%(DE ShortMonom ( c i j)
% (CONS c (MONINTERN (LIST i j))))

(DE VeryShortMonom ( c i )
 (Cf!&Mon2Tm (InCoeff2RedandCoeff c) (MONINTERN (LIST i ))))

(DE ShortMonom ( c i j)
 (Cf!&Mon2Tm (InCoeff2RedandCoeff c) (MONINTERN (LIST i j))))


% Monom as polynom /ufn 2005-06-27
(DE Monompol (c  i j)
 (PROG (pol)
 (SETQ pol (mkAPol)) %(NCONS NIL)
 (TermInsert (ShortMonom 1 i j) pol)
 (RETURN pol))
)

(DE Binom (i1 j1 i2 j2)
 (PROG (pol)
 (SETQ pol (mkAPol)) %(NCONS NIL)
 (TermInsert (ShortMonom 1 i1 j1) pol)
 (TermInsert (ShortMonom -1 i2 j2) pol)
 (RETURN pol))
)

(DE InsertNewvarMonom (pol weight)
  % (PRIN2T "inserting monom in")
  % (PRIN2T pol)
 (TermInsert (VeryShortMonom -1 (GENIOVAR weight)) pol)
  %(PRIN2T "After insertiing monom" )
%(PRIN2T pol)
)

(DE InsertNewvarsInList (list weight)
 (PROG (AA)
   % (PRIN2T "In InsertnewvarsInList")
        (SETQ AA list)
       % (PRIN2T "length of list=") (PRIN2T (LENGTH AA))
 Label %(PRIN2 AA=") (PRIN2T AA)
       %(PRIN2T "length of list=") (PRIN2T (LENGTH AA))

        (COND (AA (InsertNewvarMonom (CAR AA) weight)
                  (SETQ AA (CDR AA)) (GO Label))
        )
%  (PRIN2T "Finished InsertnewvarsInList")
))

(DE InsertNewvarsinIndegList (deglist )
 (PROG (deg AA)
       (SETQ AA deglist)% (PRIN2T "in  InsertNewvarsinIndegList")
 Lab
        (COND (AA  (SETQ deg (CAAR AA))
           % (PRIN2T "Before InsertNewvarsInList")
                  (InsertNewvarsInList (CDAR AA) deg)

 % (PRIN2T "After InsertNewvarsInList")
                  (SETQ AA (CDR AA))
                  (GO Lab)
                  )
         )
%(PRIN2T "Finish InsertNewvarsinIndegList ")
))

%(DE InsertHomomorphismMonom (pol weight)
  % (PRIN2T "inserting monom in")
  % (PRIN2T pol)
 %(TermInsert (ShortMonom -1 (GENIOVAR weight) Homomorphismvar) pol)
 % (PRIN2T "After insertiing monom" ) (PRIN2T pol)
%)

%(DE InsertHomomofrphismInList (list weight)
% (PROG (AA)
   % (PRIN2T "In InsertHomomofrphismInList")
  %      (SETQ AA list)
 %Label (PRIN2 AA=") (PRIN2T AA)(PRIN2T list=") (PRIN2T list)
 %
 %       (COND (AA (InsertHomomorphismMonom (CAR AA) weight)
 %                 (SETQ AA (CDR AA)) (GO Label))
%        )
 % (PRIN2T "Finished InsertHomomofrphismInList")
%))


%(DE InsertHomomofrphismIndegList (deglist )
% (PROG (deg AA)
%       (SETQ AA deglist)
% Lab  (PRIN2 AA)
 %       (COND (AA (SETQ deg (CAAR AA))
  %                (InsertHomomofrphismInList (CDAR AA) (SUB1 deg))
 % (PRIN2T "After InsertHomomofrphismInList")
 %                 (SETQ AA (CDR AA))
  %                (GO Lab)
 %                 )
 %        )
%))

%(DE BinomsForSyzygies ()
%(PROG (BinomList i j n)
%  (SETQ BinomList (NCONS NIL))
 % (SETQ i Homomorphismvar)
 % (SETQ j FirstRingvar)
 % (SETQ n (ADD1 LastRingvar))
%Loop
%  (SETQ BinomList (CONS (Binom i j j i) BinomList))
%  (SETQ j (ADD1 j))
%    (COND ((LESSP j n)
%           (GO Loop)))
 %  (SETQ BinomList (CONS (Monompol  1 i i) BinomList))
 % (PRIN2 "BinomList=")(PRIN2T BinomList)
 %   (RETURN BinomList)
%))
%
%(DE RestBinomsForSyzygies ()
%(PROG (BinomList  j n)
 % (SETQ n (GENIOVAR 1))
 % (SETQ BinomList (NCONS NIL))
 % (SETQ j   Modstartvar)
%Loop
%  (SETQ BinomList (CONS (Binom n j j Homomorphismvar ) BinomList))
 % (SETQ j (ADD1 j))
 %   (COND ((LESSP j n)
 %          (GO Loop)))
  % (SETQ BinomList (CONS (Monompol  1 n n) BinomList))
  % (PRIN2 " Second BinomList=")(PRIN2T BinomList)
 %   (RETURN BinomList)
%))


(DE BinomsForFactorAlgebra ()
 (PROG (BinomList i j n)
  (SETQ BinomList (NCONS NIL))
  (SETQ i 1)
  (SETQ n (ADD1 (CAR (DIVIDE (InVarNo) 2))))
  (SETQ j (ADD1 n))
 Loop
    (SETQ BinomList (CONS (Binom j n n i) BinomList))
    (SETQ i (ADD1 i))
    (SETQ j (ADD1 j))
    (COND ((LESSP i n)
           (GO Loop)))
    (RETURN BinomList)
))

(DE BinomsForNCHomogenisation ()
 (PROG (BinomList i j n)
  (SETQ BinomList (NCONS NIL))
  (SETQ i 1)
  (SETQ n !$!&HomogVarIndex!#)
 Loop
    (SETQ BinomList (CONS (Binom i n n i) BinomList))
    (SETQ i (ADD1 i))
    (COND ((LESSP i n)
           (GO Loop)))
    (RETURN BinomList)
))

(DE BinomsForHochshild ()
 (PROG (BinomList i j n nn nn1 nn2)
  (SETQ BinomList (NCONS NIL))
  (SETQ n (SUB1 (CAR (DIVIDE (InVarNo) 2))))
  (SETQ nn (PLUS2 n n))
  (SETQ nn1 (ADD1 nn))
  (SETQ nn2 (ADD1 nn1))
  (SETQ j  n)
 Loop1
    (SETQ j (ADD1 j))
    (COND ((LESSP nn j)  (RETURN BinomList)))
    (SETQ BinomList (CONS (Binom nn1 j nn1 (DIFFERENCE j n)) BinomList))
    (SETQ BinomList (CONS (Binom  j  nn2 (DIFFERENCE j n) nn2) BinomList))
    (SETQ i 0)
    Loop2
      (SETQ i (ADD1 i))
      (SETQ BinomList (CONS (Binom i j j i) BinomList))
            (COND ((LESSP i n)
         (GO Loop2)))
    (GO Loop1)
))

%(DE NOADDITIONALRELATIONS (ll)
%   (RETURN ll))

%(COPYD 'ADDADDITIONALRELATIONS 'NOADDITIONALRELATIONS)

(DE SYZYGIESADDITIONALRELATIONS (ll)
 % (PRIN2 "SYZYGIESADDITIONALRELATIONS,ll=")(PRIN2T ll)
  (APPEND  (APPEND (APPEND ll tmplist) ( BinomsForSyzygies)) (RestBinomsForSyzygies))
)

(DE NEWSYZYGIESADDITIONALRELATIONS (ll)
 % (PRIN2 "SYZYGIESADDITIONALRELATIONS,ll=")(PRIN2T ll)
   (APPEND ll tmplist)
)

(DE FACTALGADDITIONALRELATIONS (ll)
  (APPEND ll (BinomsForFactorAlgebra)) )

(DE HOCHADDITIONALRELATIONS (ll )
  (PROG (n)
  (SETQ n (SUB1 (CAR (DIVIDE (InVarNo) 2))))
  (SETQ ll(APPEND ll (RevShiftCopyListPol ll n)))
  (RETURN (APPEND ll (BinomsForHochshild)))))
%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%
%% End of Procedures for input of additional polynomials %%%%
%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%




(ON RAISE)



