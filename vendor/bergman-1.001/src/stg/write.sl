%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%
%% Copyright (C) 1992,1998,1999,2002 Joergen Backelin
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


% Created 1992-03-31.


% Changes:

%  Removed PRIN2T, TYO./JoeB 2002-10-11

%  PUREMONPRINT,MonOne --> MONPRINT,MONONE./JoeB 1999-11-26

%  FlushChannel --> FLUSHCHANNEL./JoeB 1999-07-04

%  Corrected PRINTFULLSTAGGERSTATMON./JoeB 1998-09-24

(OFF RAISE)

(GLOBAL '(MONONE cAccGBasis GBasOutChan))

(DE STAGGERDEGREEOUTPUT ()
 (PROG	(cChan)
	(COND ((NOT (CDR cAccGBasis))
	       (RETURN NIL)))
	(SETQ cChan (WRS GBasOutChan))
	(PRIN2 "% ") (PRINT cDeg)
	(MAPC (CDR cAccGBasis) (FUNCTION PointerPrint))
	(TERPRI)
	(COND (GBasOutChan (FLUSHCHANNEL GBasOutChan)))
	(WRS cChan) ))

(COPYD 'STAGGERENDDEGREEOUTPUT 'ENDDEGREEOUTPUT)

(DE DEGREEBIGOUTPUT (dlmon)
 (PROG	(AA)
	(SETQ AA dlmon)
  Ml	(COND (AA
	       (PRIN2 "% ") (PRINT (CAAR AA))
	       (MAPC (CDAR AA) (FUNCTION PointerPrint))
	       (TERPRI)
	       (SETQ AA (CDR AA))
	       (GO Ml))) ))

%  Some procedures for writing specific staggerthings (like the staggerstuff),
% for debugging and efficiency tests, mainly.

(DE PrintTreeMon (tmon)
 (PROG	()
	(InitStandardBindPosition)
	(PutStBTree tmon)
  Ml	(COND ((NOT (Move!&GetStBTreeNode))
	       (COND ((StBLeft)
		      (RETURN (TERPRI)))
		     (T
		      (PopStB)
		      (GO Ml))))
	      ((StBRight)
	       (PUREMONor1PRINT (GetStBTreeLeaf))
	       (PRIN2 " ")
	       (GO Ml)))
  Psh	(Push!&MoveStB)
	(COND ((StBRight)
	       (PUREMONor1PRINT (GetStBTreeLeaf))
	       (PRINC '! )
	       (GO Ml)))
	(GO Psh) ))

(DE PUREMONor1PRINT (mon)
 (COND	((EQ mon MONONE)
	 (PRIN2 1))
	(T
	 (MONPRINT mon))) )

(DE PrintMonPri (mon) (PRIN2 (GetMonPri mon)))

(DE PrintMonSubs (mon) (PRIN2 (GetMonSubs mon)))

(DE PrintMonAcc (mon) (PRIN2 (GetMonAcc mon)))

(DE PrintMonSubs!-Acc (mon) (PRIN2 (GetMonSubs!-Acc mon)))


(DE PRINTFULLSTAGGERSTATMON (mon)
 (PROGN (PRIN2 "%* Input to PFSSM: ") (MONPRINT mon) (TERPRI)
	(PRIN2 "%*PriPos existence; ")
	(COND ((GetMonPri mon)
	       (PRIN2 "T; Priority:  ")
	       (PrintMonPri mon))
	      (T
	       (PRIN2 NIL)))
	(TERPRI)
	(PRIN2 "%* Subs-Acc; Subs: ")
	(PRIN2 " ") (PrintMonSubs!-Acc mon)
	(PRIN2 " ") (PrintMonSubs mon) (TERPRI)
	(PRIN2 "%* ProhId: ") (PrintTreeMon (GetMonProhId mon)) ))

(DE PrintSP2rItem (itm)
 (PROGN (PRIN2 "%* Printing SP2r item:") (TERPRI)
	(PRIN2 "%* (LC; SubsPri; Inx(LC/mon1); Inx(LC/mon2); mon1; mon2)")
	(TERPRI)
	(MONPRINT (CAR itm)) (PRIN2 " ")
	(PRIN2 (CAAADR itm)) (PRIN2 ".")
	(PRIN2 (CDADR itm)) (PRIN2 " ") (PRIN2 (CADDR itm)) (PRIN2 " ")
	(PRIN2 (CADDDR itm)) (PRIN2 " ") (MONPRINT (CADR (CDDDR itm)))
	(PRIN2 " ") (MONPRINT (CADDR (CDDDR itm))) (TERPRI) ))

(COPYD 'PFSSM 'PRINTFULLSTAGGERSTATMON)
