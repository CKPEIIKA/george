%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%
%% Copyright (C) 1995,1996,1999 Joergen Backelin
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

%  Macros specific for compilation of Hilbert and Poincare-Betti
% series procedures files.

%	CHANGES:

%  Added commHlbMonTail, commHlbMonCopy./JoeB 1999-11-03

(OFF RAISE)

%# commHlbFMon2Mon (hsflagmon) : hsmon ;
(DM commHlbFMon2Mon (rrg) (CONS 'CDR (CDR rrg)))
%# commHlb (hsflagmon) : hsflag ;
(DM commHlbMonFlagP (rrg) (CONS 'CAR (CDR rrg)))
%# commHlbFlag!&Mon2FMon (hsflag, hsmon) : hsflagmon ;
(DM commHlbFlag!&Mon2FMon (rrg) (CONS 'CONS (CDR rrg)))
%# commHlbTrueFlag (hsflagmon) : - ;
(DM commHlbTrueFlag (rrg) (LIST 'RPLACA (CADR rrg) T))
%# commHlbNilFlag (hsflagmon) : - ;
(DM commHlbNilFlag (rrg) (LIST 'RPLACA (CADR rrg) NIL))
%# commHlbMonVarNo (hsflagmon) : degno ;
(DM commHlbMonVarNo (rrg) (CONS 'LENGTH (CDR rrg)))
%# commHlbFirstInFMon (hsflagmon) : exptno ;
(DM commHlbFirstInFMon (rrg) (CONS 'CADR (CDR rrg)))
%# commHlbSecondInFMon (hsflagmon) : exptno ;
(DM commHlbSecondInFMon (rrg) (CONS 'CADDR (CDR rrg)))
%# commHlbMonTail (hsmon) : hsmon ;
(DM commHlbMonTail (rrg) (CONS 'CDR (CDR rrg)))
%# commHlbMonCopy (hsmon) : hsmon ;
(DM commHlbMonCopy (rrg) (CONS 'LISTCOPY (CDR rrg)))

%# commHlbCoeff (hsterm) : hscoeff ;
(DM commHlbCoeff (rrg) (CONS 'CAR (CDR rrg)))
%# commHlbDeg (hsterm) : degno ;
(DM commHlbDeg (rrg) (CONS 'CDR (CDR rrg)))
%# commHlbCoeff!&Deg2Term (hscoeff, degno) : hsterm ;
(DM commHlbCoeff!&Deg2Term (rrg) (CONS 'CONS (CDR rrg)))
%# commHlbRplacDeg (hsterm, degno) : - ;
(DM commHlbRplacDeg (rrg) (CONS 'RPLACD (CDR rrg)))
%# commHlbRplacCoeff (hsterm, hscoeff) : - ;
(DM commHlbRplacCoeff (rrg) (CONS 'RPLACA (CDR rrg)))

%# commHlbFirstTerm (hsnum) : hsterm ;
(DM commHlbFirstTerm (rrg) (CONS 'CAR (CDR rrg)))
%# commHlbSecondTerm (hsnum) : hsterm ;
(DM commHlbSecondTerm (rrg) (CONS 'CADR (CDR rrg)))
%# commHlbNumTail (hsnum) : hsnum ;
(DM commHlbNumTail (rrg) (CONS 'CDR (CDR rrg)))
%# commHlbNumRplacTail (hsnum, hsnum) : - ;
(DM commHlbNumRplacTail (rrg) (CONS 'RPLACD (CDR rrg)))
%# commHlbCopyNum (hsnum) : hsnum ;
(DM commHlbCopyNum (rrg) (CONS 'DPLISTCOPY (CDR rrg)))
%# commHlbNum!? (num) : bool ;
(DM commHlbNum!? (rrg) (CADR rrg))
%# commHlbNum0!? (num) : bool ;
(DM commHlbNum0!? (rrg) (CONS 'NOT (CDR rrg)))
%# commHlbNumTermAppend (hsnum, hsterm) : - ;
(DM commHlbNumTermAppend (rrg)
 (LIST 'RPLACD (CADR rrg) (CONS 'NCONS (CDDR rrg))))
%# commHlbNumTermInsert (hsnum, hsterm) : - ;
(DM commHlbNumTermInsert (rrg)
 (LIST 'RPLACD (CADR rrg) (LIST 'CONS (CADDR rrg) (LIST 'CDR (CADR rrg)))))
%# commHlbNumTermRemove (hsnum) : - ;
(DM commHlbNumTermRemove (rrg)
 (LIST 'RPLACD (CADR rrg) (CONS 'CDDR (CDR rrg))))
%# commHlbNum2FirstCoeff (hsnum) : hscoeff ;
(DM commHlbNum2FirstCoeff (rrg) (CONS 'CAAR (CDR rrg)))
%# commHlbNum2FirstDeg (hsnum) : degno ;
(DM commHlbNum2FirstDeg (rrg) (CONS 'CDAR (CDR rrg)))
%# commHlbNum2SecondCoeff (hsnum) : hscoeff ;
(DM commHlbNum2SecondCoeff (rrg) (CONS 'CAADR (CDR rrg)))
%# commHlbNum2SecondDeg (hsnum) : degno ;
(DM commHlbNum2SecondDeg (rrg) (CONS 'CDADR (CDR rrg)))

%# commHlbNumDenDeg2Num (hsnumdendeg) : hsnum ;
(DM commHlbNumDenDeg2Num (rrg) (CONS 'CDR (CDR rrg)))
%# commHlbNumDenDeg2DenDeg (hsnumdendeg) : hsdendeg ;
(DM commHlbNumDenDeg2DenDeg (rrg) (CONS 'CAR (CDR rrg)))
%# commHlbNum!&DenDeg2NumDenDeg (hsnum, hsdendeg) : hsnumdendeg ;
(DM commHlbNum!&DenDeg2NumDenDeg (rrg) (LIST 'CONS (CADDR rrg) (CADR rrg)))
%# commHlbRplacNum (hsnumdendeg, hsnum) : - ;
(DM commHlbRplacNum (rrg) (CONS 'RPLACD (CDR rrg)))
%# commHlbRplacDenDeg (hsnumdendeg, hsdendeg) : - ;
(DM commHlbRplacDenDeg (rrg) (CONS 'RPLACA (CDR rrg)))
%# commHlbSplitNum2Num (hssplitnum) : hsnum ;
(DM commHlbSplitNum2Num (rrg) (CONS 'CAR (CDR rrg)))
%# commHlbSplitNum2DenDeg (hssplitnum) : hsdendeg ;
(DM commHlbSplitNum2DenDeg (rrg) (CONS 'CDR (CDR rrg)))
%# commHlbNum!&DenDeg2SplitNum (hsnum, hsdendeg) : hssplitnum ;
(DM commHlbNum!&DenDeg2SplitNum (rrg) (CONS 'CONS (CDR rrg)))

% Macros for sermul.sl:

%# serCoeff (srterm) : srcoeff ;
(DM serCoeff (rrg) (CONS 'CDR (CDR rrg)))
%# serDeg (srterm) : degno ;
(DM serDeg (rrg) (CONS 'CAR (CDR rrg)))
%# serCoeff!&Deg2Term (srcoeff, degno) : srterm ;
(DM serCoeff!&Deg2Term (rrg) (LIST 'CONS (CADDR rrg) (CADR rrg)))
%# serRplacDeg (srterm, degno) : - ;
(DM serRplacDeg (rrg) (CONS 'RPLACA (CDR rrg)))
%# serRplacCoeff (srterm, srcoeff) : - ;
(DM serRplacCoeff (rrg) (CONS 'RPLACD (CDR rrg)))

%# serFirstTerm (srpol) : srterm ;
(DM serFirstTerm (rrg) (CONS 'CAR (CDR rrg)))
%# serSecondTerm (srpol) : srterm ;
(DM serSecondTerm (rrg) (CONS 'CADR (CDR rrg)))
%# serPolTail (srpol) : srpol ;
(DM serPolTail (rrg) (CONS 'CDR (CDR rrg)))
%# serPolRplacTail (srpol, srpol) : - ;
(DM serPolRplacTail (rrg) (CONS 'RPLACD (CDR rrg)))
%# serCopyPol (srpol) : srpol ;
(DM serCopyPol (rrg) (CONS 'DPLISTCOPY (CDR rrg)))
%# serPol!? (pol) : bool ;
(DM serPol!? (rrg) (CADR rrg))
%# serPol0!? (pol) : bool ;
(DM serPol0!? (rrg) (CONS 'NOT (CDR rrg)))
%# serPolTermAppend (srpol, srterm) : - ;
(DM serPolTermAppend (rrg)
 (LIST 'RPLACD (CADR rrg) (CONS 'NCONS (CDDR rrg))))
%# serPolTermInsert (srpol, srterm) : - ;
(DM serPolTermInsert (rrg)
 (LIST 'RPLACD (CADR rrg) (LIST 'CONS (CADDR rrg) (LIST 'CDR (CADR rrg)))))
%# serPolTermRemove (hsnum) : - ;
(DM serPolTermRemove (rrg)
 (LIST 'RPLACD (CADR rrg) (CONS 'CDDR (CDR rrg))))
%# serPol2FirstCoeff (srpol) : srcoeff ;
(DM serPol2FirstCoeff (rrg) (CONS 'CDAR (CDR rrg)))
%# serPol2FirstDeg (srpol) : degno ;
(DM serPol2FirstDeg (rrg) (CONS 'CAAR (CDR rrg)))
%# serPol2SecondCoeff (srpol) : srcoeff ;
(DM serPol2SecondCoeff (rrg) (CONS 'CDADR (CDR rrg)))
%# serPol2SecondDeg (srpol) : degno ;
(DM serPol2SecondDeg (rrg) (CONS 'CAADR (CDR rrg)))
