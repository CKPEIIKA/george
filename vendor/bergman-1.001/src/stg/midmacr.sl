%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%
%% Copyright (C) 1992,1994,1998 Joergen Backelin
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

%  CHANGES:

% 1994-09-08: inx --> pmon .


% Macros for the ideal handler.
(OFF RAISE)
(GLOBAL '(!*!&StandardBindPosition !*!&StandardBindPMonVector
	  !*!&StandardBindTreeVector !*!&BindPositionMax
	  !*!&AlternativeBindPosition !*!&AlternativeBindPMonVector
	  !*!&AlternativeBindTreeVector niTreeMon))
(DM StBPos (rrg) (QUOTE !*!&StandardBindPosition))
(DM StBValueEQ (rrg) (CONS 'BMI!= (CDR rrg)))
(DM StBValue!< (rrg) (CONS 'BMI!< (CDR rrg)))
(DM StBValue!> (rrg) (CONS 'BMI!> (CDR rrg)))
(DM StBValueDIFFERENCE (rrg) (CONS 'BMI!- (CDR rrg)))
(DM StBValueNatDiff (rrg)
    (LIST 'COND
	  (LIST (LIST 'BMI!< (CADR rrg) (CADDR rrg)) 0)
	  (LIST T (CONS 'BMI!- (CDR rrg)))))
(DM InitStandardBindPosition (rrg) '(SETQ !*!&StandardBindPosition 0))
(DM PushStBPos (rrg)
    '(SETQ !*!&StandardBindPosition (ADD1 !*!&StandardBindPosition)))
(DM PopStBPos (rrg)
    '(SETQ !*!&StandardBindPosition (SUB1 !*!&StandardBindPosition)))
(DM StBLeft (rrg) '(StBValueEQ !*!&StandardBindPosition 0))
(DM StBRight (rrg)
    '(StBValueEQ !*!&StandardBindPosition !*!&BindPositionMax))
(DM GetStBPMonValue (rrg)
    '(GETV !*!&StandardBindPMonVector !*!&StandardBindPosition))
(DM GetStBTreeNode (rrg)
    '(GETV !*!&StandardBindTreeVector !*!&StandardBindPosition))
(DM GetNextStBTreeNode (rrg) '(CDR (GetStBTreeNode)))
(DM GetStBTreeValue (rrg) '(CAAR (GetStBTreeNode)))
(DM GetNextStBTreeValue (rrg) '(CAADR (GetStBTreeNode)))
(DM LongerStBTreeNode (rrg) '(CDR (GetStBTreeNode)))
(DM GetStBTreeLeaf (rrg) '(CDAR (GetStBTreeNode)))
(DM PutStBTree (rrg)
    (LIST 'PUTV
	  '!*!&StandardBindTreeVector
	  '!*!&StandardBindPosition
	  (CADR rrg)))
(DM PutStBPMon (rrg)
    (LIST 'PUTV
	  '!*!&StandardBindPMonVector
	  '!*!&StandardBindPosition
	  (CADR rrg)))
(DM InsertStBTreeNode (rrg)
    (LIST 'RPLACD
	  '(GetStBTreeNode)
	  (LIST 'CONS (CADR rrg) '(CDR (GetStBTreeNode)))))
(DM InsertStBTreeLeaf (rrg)
    (LIST 'RPLACD '(CAR (GetStBTreeNode)) (CADR rrg)))
(DM InsertNextStBTreeLeaf (rrg)
    (LIST 'RPLACD '(CADR (GetStBTreeNode)) (CADR rrg)))
(DM MoveStBTreeNode (rrg)
    '(PutStBTree (CDR (GetStBTreeNode))))
(DM Move!&GetStBTreeNode (rrg) '(MoveStBTreeNode))
(DM Move!&GetNextStBTreeNode (rrg)
    '(CDR (PutStBTree (CDR (GetStBTreeNode)))))
(DM PushStB (rrg)
    '(PROGN (PushStBPos)
	    (PutStBTree (CAR (GETV !*!&StandardBindTreeVector
				   (SUB1 !*!&StandardBindPosition))))))
(DM PushNextStB (rrg)
    '(PROGN (PushStBPos)
	    (PutStBTree (CADR (GETV !*!&StandardBindTreeVector
				    (SUB1 !*!&StandardBindPosition))))))
(DM Push!&MoveStB (rrg)
    '(PROGN (PushStBPos)
	    (PutStBTree (CDAR (GETV !*!&StandardBindTreeVector
				    (SUB1 !*!&StandardBindPosition))))))
(DM PopStB (rrg) '(PopStBPos))
(DM PopStBTo (rrg)
    (LIST 'SETQ '!*!&StandardBindPosition (CADR rrg)))
(DM CutStBTreeNode (rrg) '(RPLACD (GetStBTreeNode) NIL))
(DM AmputeStBTreeNode (rrg)
    '(RPLACD (GetStBTreeNode) (CDDR (GetStBTreeNode))))
(DM BarrenStBTreeNode (rrg) '(NOT (CDADR (GetStBTreeNode))))
%%%%
(DM AltBPos (rrg) (QUOTE !*!&AlternativeBindPosition))
(DM InitAlternativeBindPosition (rrg) '(SETQ !*!&AlternativeBindPosition 0))
(DM PushAltBPos (rrg)
    '(SETQ !*!&AlternativeBindPosition (ADD1 !*!&AlternativeBindPosition)))
(DM PopAltBPos (rrg)
    '(SETQ !*!&AlternativeBindPosition (SUB1 !*!&AlternativeBindPosition)))
(DM AltBLeft (rrg) '(StBValueEQ !*!&AlternativeBindPosition 0))
(DM AltBRight (rrg)
    '(StBValueEQ !*!&AlternativeBindPosition !*!&BindPositionMax))
(DM GetAltBPMonValue (rrg)
    '(GETV !*!&AlternativeBindPMonVector !*!&AlternativeBindPosition))
(DM GetAltBTreeNode (rrg)
    '(GETV !*!&AlternativeBindTreeVector !*!&AlternativeBindPosition))
(DM GetNextAltBTreeNode (rrg) '(CDR (GetAltBTreeNode)))
(DM GetAltBTreeValue (rrg) '(CAAR (GetAltBTreeNode)))
(DM GetNextAltBTreeValue (rrg) '(CAADR (GetAltBTreeNode)))
(DM LongerAltBTreeNode (rrg) '(CDR (GetAltBTreeNode)))
(DM GetAltBTreeLeaf (rrg) '(CDAR (GetAltBTreeNode)))
(DM PutAltBTree (rrg)
    (LIST 'PUTV
	  '!*!&AlternativeBindTreeVector
	  '!*!&AlternativeBindPosition
	  (CADR rrg)))
(DM PutAltBPMon (rrg)
    (LIST 'PUTV
	  '!*!&AlternativeBindPMonVector
	  '!*!&AlternativeBindPosition
	  (CADR rrg)))
(DM InsertAltBTreeNode (rrg)
    (LIST 'RPLACD
	  '(GetAltBTreeNode)
	  (LIST 'CONS (CADR rrg) '(CDR (GetAltBTreeNode)))))
(DM InsertAltBTreeLeaf (rrg)
    (LIST 'RPLACD '(CAR (GetAltBTreeNode)) (CADR rrg)))
(DM InsertNextAltBTreeLeaf (rrg)
    (LIST 'RPLACD '(CADR (GetAltBTreeNode)) (CADR rrg)))
(DM MoveAltBTreeNode (rrg)
    '(PutAltBTree (CDR (GetAltBTreeNode))))
(DM Move!&GetAltBTreeNode (rrg) '(MoveAltBTreeNode))
(DM Move!&GetNextAltBTreeNode (rrg)
    '(CDR (PutAltBTree (CDR (GetAltBTreeNode)))))
(DM PushAltB (rrg)
    '(PROGN (PushAltBPos)
	    (PutAltBTree (CAR (GETV !*!&AlternativeBindTreeVector
				   (SUB1 !*!&AlternativeBindPosition))))))
(DM PushNextAltB (rrg)
    '(PROGN (PushAltBPos)
	    (PutAltBTree (CADR (GETV !*!&AlternativeBindTreeVector
				    (SUB1 !*!&AlternativeBindPosition))))))
(DM Push!&MoveAltB (rrg)
    '(PROGN (PushAltBPos)
	    (PutAltBTree (CDAR (GETV !*!&AlternativeBindTreeVector
				    (SUB1 !*!&AlternativeBindPosition))))))
(DM PopAltB (rrg) '(PopAltBPos))
(DM PopAltBTo (rrg)
    (LIST 'SETQ '!*!&AlternativeBindPosition (CADR rrg)))
(DM CutAltBTreeNode (rrg) '(RPLACD (GetAltBTreeNode) NIL))
(DM AmputeAltBTreeNode (rrg)
    '(RPLACD (GetAltBTreeNode) (CDDR (GetAltBTreeNode))))
(DM BarrenAltBTreeNode (rrg) '(NOT (CDADR (GetAltBTreeNode))))
%%%%
(DM GetAltStBPMonValue (rrg)
    '(GETV !*!&StandardBindPMonVector !*!&AlternativeBindPosition))
(DM GetAltStBTreeValue (rrg)
    '(CAAR (GETV !*!&StandardBindTreeVector !*!&AlternativeBindPosition)))
(DM GetAltNextStBTreeValue (rrg)
    '(CAADR (GETV !*!&StandardBindTreeVector !*!&AlternativeBindPosition)))
(DM ClearniTreeMon (rrg) '(RPLACD niTreeMon NIL))
