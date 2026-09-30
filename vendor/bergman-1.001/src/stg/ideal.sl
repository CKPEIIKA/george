%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%
%% Copyright (C) 1992,1994 Joergen Backelin
%%
%% Bergman is distributed in the hope that it will be useful,
%% but WITHOUT ANY WARRANTY.  No author or distributor
%% accepts responsibility to anyone for the consequences of using it
%% or for whether it serves any particular purpose or works at all,
%% unless he says so in writing.  Refer to the Bergman General Public
%% License for full details.

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

% Created 1992-02-28.


% Import: ; .
% Export: MonIdealMember, MonIdealUnionNonMember, MONIDEALUNION,
%	  MonIdealUnionNonMember!&Colon; !*!&StandardBoundInputMonomial.

(OFF RAISE)

(GLOBAL '(niTreeMon))

(FLUID '(!*!&StandardBoundInputMonomial))

%%%%	Monomial ideal handling.    %%%%


% Uses "immediate push mode", since no action is taken on nodes.

(DE MonIdealMember (pmon tmon)
 (PROG	()
	(StandardBindPMon!&Tree pmon tmon)
  Ml	(COND ((OR (NOT (Move!&GetStBTreeNode))
		   (StBValue!< (GetStBPMonValue) (GetStBTreeValue)))
	       (COND ((StBLeft)
		      (RETURN NIL))
		     (T
		      (PopStB)
		      (GO Ml))))
	      ((StBRight)
	       (RETURN T)))
	(PushStB)
	(GO Ml) ))

% Presumes pmon not in tmon.

(DE MonIdealUnionNonMember (pmon tmon)
 (PROG	(AA)
	(StandardBindPMon!&Tree pmon tmon)
	% First loop: Insert pmon into tmon.
  Fl	(COND ((OR (NOT (GetNextStBTreeNode))
		   (StBValue!< (GetStBPMonValue) (GetNextStBTreeValue)))
	       (SETQ AA (StBPos))
	       (StBTreeAddBranch)
	       (PopStBTo AA)
	       (COND ((Move!&GetNextStBTreeNode)
		      (COND ((StBRight) (CutStBTreeNode) (GO Pop))
			    (T (GO Psh))))
		     (T
		      (COND ((StBLeft) (RETURN tmon))
			    (T (GO Pop)))))))
	% No StBRight test here, since we KNOW pmon not in tmon.
	(COND ((StBValueEQ (GetNextStBTreeValue) (GetStBPMonValue))
	       (PushNextStB))
	      (T
	       (MoveStBTreeNode)))
	(GO Fl)

	% Second loop: Remove multiples of pmon from tmon.
  Pop	(PopStB)
  Lng	(COND ((NOT (Move!&GetNextStBTreeNode))
	       (COND ((StBLeft)
		      (RETURN tmon))
		     (T
		      (GO Pop)))))
  Psh	(PushNextStB)
  Mv	(COND ((StBValue!> (GetStBPMonValue) (GetNextStBTreeValue))
	       (COND ((Move!&GetNextStBTreeNode) (GO Mv))
		     (T (GO Pop))))
	      ((NOT (StBRight))
	       (GO Psh)))
	(CutStBTreeNode)
  PopA	(PopStB)
	(COND ((NOT (BarrenStBTreeNode))
	       (GO Lng)))
	(AmputeStBTreeNode)
	(COND ((LongerStBTreeNode)
	       (GO Psh))
	      ((StBLeft)
	       (RETURN tmon)))
	(GO PopA) ))


(DE MONIDEALUNION (pmon tmon)
 (COND	((NOT (MonIdealMember pmon tmon))
	 (MonIdealUnionNonMember pmon tmon))) )

% Presumes pmon not in tmon. pmon is added to tmon, and (tmon : pmon) is
% formed as a non-interned monomial tree niTreeMon. niTreeMon is returned.

(DE MonIdealUnionNonMember!&Colon (pmon tmon)
 (PROG	(AA CC)
	(StandardBindPMon!&Tree pmon tmon)
	(ClearniTreeMon)
	% First loop: Insert pmon into tmon.
  Fl	(COND ((OR (NOT (GetNextStBTreeNode))
		   (StBValue!< (GetStBPMonValue) (GetNextStBTreeValue)))
	       (SETQ AA (StBPos))
	       (SETQ CC (StBTreeAddBranch))
	       (PopStBTo AA)
	       (COND ((Move!&GetNextStBTreeNode)
		      (COND ((StBRight)
			     (AlternativeMonIdealUnionRightmostNonMember
			      niTreeMon)
			     (CutStBTreeNode)
			     (GO Pop))
			    (T
			     (GO Psh))))
		     (T
		      (COND ((StBLeft) (GO thrd))
			    (T (GO Pop)))))))
	% No StBRight test here, since we KNOW pmon not in tmon.
	(COND ((StBValueEQ (GetStBPMonValue) (GetNextStBTreeValue))
	       (PushNextStB))
	      (T
	       (MoveStBTreeNode)))
	(GO Fl)

	% Second loop: Remove multiples of pmon from tmon, and add their
	% multiples to niTreeMon (as new 'rightest' elements).
  Pop	(PopStB)
  Lng	(COND ((NOT (Move!&GetNextStBTreeNode))
	       (COND ((StBLeft)
		      (GO thrd))
		     (T
		      (GO Pop)))))
  Psh	(PushNextStB)
  Mv	(COND ((StBValue!> (GetStBPMonValue) (GetNextStBTreeValue))
	       (COND ((Move!&GetNextStBTreeNode) (GO Mv))
		     (T (GO Pop))))
	      ((NOT (StBRight))
	       (GO Psh)))
	(AlternativeMonIdealUnionRightmostNonMember niTreeMon)
	(CutStBTreeNode)
  PopA	(PopStB)
	(COND ((NOT (BarrenStBTreeNode))
	       (GO Lng)))
	(AmputeStBTreeNode)
	(COND ((LongerStBTreeNode)
	       (GO Psh))
	      ((StBLeft)
	       (GO thrd)))
	(GO PopA)

	% Third loop: For each (remaining) monomial in tmon, add
	% the "natural number difference" of m and pmon (also called
	% "m monus pmon").
	%  Here, "immediate pushing" is used.
  thrd	(PutStBTree tmon)
	(MoveStBTreeNode)
  Psh3	(Push!&MoveStB)
	(COND ((NOT (StBRight))
	       (GO Psh3))
	      ((NOT (Mon!= CC (GetStBTreeLeaf)))
	       (AlternativeMonIdealUnionMon niTreeMon)))
  Pop3	(PopStB)
	(COND ((Move!&GetStBTreeNode)
	       (GO Psh3))
	      ((StBLeft)
	       (RETURN niTreeMon)))
	(GO Pop3) ))

%  Uses the alternative binding. (New-formed pmon) - (content of
% !*!&StandardBoundPMon) is added to the previously alternatively bound
% tmon, irrespective of the possible membership of the former in the
% latter.

(DE AlternativeMonIdealUnionMon (tmon)
 (PROG	(AA BB)
	% First loop: Form the 'monus vector' (as 'pmon').
	(InitAlternativeBindPosition)
  Fl	(PutAltBPMon (SETQ BB (StBValueNatDiff (GetAltStBTreeValue)
						    (GetAltStBPMonValue))))
	(COND ((NOT (AltBRight))
	       (PushAltBPos)
	       (GO Fl)))

	% Second loop: Check if pmon is in tmon.
	(InitAlternativeBindPosition)
	(PutAltBTree tmon)
  Sl	(COND ((OR (NOT (Move!&GetAltBTreeNode))
		   (StBValue!< (GetAltBPMonValue) (GetAltBTreeValue)))
	       (COND ((AltBLeft)
		      (InitAlternativeBindPosition)
		      (PutAltBTree tmon)
		      (GO Thl))
		     (T
		      (PopAltB)
		      (GO Sl))))
	      ((AltBRight)
	       (RETURN T)))
	(PushAltB)
	(GO Sl)

	% Third loop: Insert pmon into tmon.
  Thl	(COND ((OR (NOT (GetNextAltBTreeNode))
		   (StBValue!< (GetAltBPMonValue) (GetNextAltBTreeValue)))
	       (SETQ AA (AltBPos))
	       (AltBTreeAddBranch)
	       (PopAltBTo AA)
	       (COND ((Move!&GetNextAltBTreeNode)
		      (COND ((AltBRight) (CutAltBTreeNode) (GO Pop))
			    (T (GO Psh))))
		     (T
		      (COND ((AltBLeft) (RETURN tmon))
			    (T (GO Pop)))))))
	% No AltBRight test here, since we KNOW pmon not in tmon.
	(COND ((StBValueEQ (GetNextAltBTreeValue) (GetAltBPMonValue))
	       (PushNextAltB))
	      (T
	       (MoveAltBTreeNode)))
	(GO Thl)
	
	% Fourth loop: Remove multiples of pmon from tmon.
  Pop	(PopAltB)
  Lng	(COND ((NOT (Move&GetNextAltBTreeNode))
	       (COND ((AltBLeft)
		      (RETURN tmon))
		     (T
		      (GO Pop)))))
  Psh	(PushNextAltB)
  Mv	(COND ((StBValue!> (GetAltBPMonValue) (GetNextAltBTreeValue))
	       (COND ((Move!&GetNextAltBTreeNode) (GO Mv))
		     (T (GO Pop))))
	      ((NOT (AltBRight))
	       (GO Psh)))
	(CutAltBTreeNode)
  PopA	(PopAltB)
	(COND ((NOT (BarrenAltBTreeNode))
	       (GO Lng)))
	(AmputeAltBTreeNode)
	(COND ((LongerAltBTreeNode)
	       (GO Psh))
	      ((AltBLeft)
	       (RETURN tmon)))
	(GO PopA) ))

% In this variant, we know that the new pmon is not a member, and that it
% will be the "rightmost" member in the augmented tree. Thus, no nodes
% need to be removed; and the addition may be done by simplified tests.

(DE AlternativeMonIdealUnionRightmostNonMember (tmon)
 (PROG	(BB)
	(InitAlternativeBindPosition)
	(PutAltBTree tmon)
  Ml	(PutAltBPMon (SETQ BB (StBValueDIFFERENCE (GetAltNextStBTreeValue)
						    (GetAltStBPMonValue))))
  Ml!'	(COND ((NOT (GetNextAltBTreeNode))
	       (AltBTreeAddBranch!&PutPMonMinusValues))
	      ((StBValueEQ BB (GetNextAltBTreeValue))
	       (PushNextAltB)
	       (GO Ml))
	      (T
	       (MoveAltBTreeNode)
	       (GO Ml!'))) ))

(DE StBTreeAddBranch ()
 (PROG	(AA)
	(SETQ AA (COND (!*!&StandardBoundInputMonomial)
		       (T (StBPMonIntern))))
  Ml	(InsertStBTreeNode (MakeTreeNode (GetStBPMonValue)))
	(COND ((StBRight)
	       (InsertNextStBTreeLeaf AA)
	       (RETURN AA)))
	(PushNextStB)
	(GO Ml) ))

% In Standard "immediate push mode".

(DE AltBTreeAddBranch ()
 (PROG	()
  Ml	(InsertAltBTreeNode (MakeTreeNode (GetAltBPMonValue)))
	(COND ((AltBRight)
	       (RETURN (InsertNextAltBTreeLeaf (AltBPMonIntern)))))
	(PushNextAltB)
	(GO Ml) ))

% In Standard "immediate push mode".

(DE AltBTreeAddBranch!&PutPMonMonusValues ()
 (PROG	()
  Ml	(InsertAltBTreeNode (MakeTreeNode (GetAltBPMonValue)))
	(COND ((AltBRight)
	       (RETURN (InsertNextAltBTreeLeaf (AltBPMonIntern)))))
	(PushNextAltB)
	(PutAltBPMon (StBValueNatDiff (GetAltStBTreeValue)
					  (GetAltStBPMonValue)))
	(GO Ml) ))

% In Standard "mediate push mode".

(DE AltBTreeAddBranch!&PutPMonMinusValues ()
 (PROG	()
  Ml	(InsertAltBTreeNode (MakeTreeNode (GetAltBPMonValue)))
	(COND ((AltBRight)
	       (RETURN (InsertNextAltBTreeLeaf (AltBPMonIntern)))))
	(PushNextAltB)
	(PutAltBPMon (StBValueDIFFERENCE (GetAltNextStBTreeValue)
					     (GetAltStBPMonValue)))
	(GO Ml) ))


(ON RAISE)
