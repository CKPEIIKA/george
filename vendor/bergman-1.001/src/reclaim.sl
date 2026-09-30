%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%
%% Copyright (C) 1992,1994,1998,2003,2005 Joergen Backelin
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


%  Split AmputeMons into comm and noncomm variants. The noncomm
% one now should ampute all monomials of degree not more than
% the current degree. (Hence also removed the warning.)
% /JoeB 2005-06-25

%  More macros introduced in AmputeMons. Moved PROLONGTWOWAYLIST
% and INITTWOWAYLIST to slext.sl. Introduced CLEARTWOWAYLIST.
% Changed REDUCTIVITY inspection; and moved its initiation to
% bmtop.sl./JoeB 2005-06-25

%  Replaced *NONCOMMUTATIVE by ((Non)CommP)./JoeB 2003-08-25

% 92-02-19: No Null(InPols) test in the non-commutative case.
%   Macros introduced in AmputeMons.

% 91-12-31: Corrected the non-commutative ReclaimList updating.

% 91-12-29: AwayP now takes the position before the monomial (not the
%    monomial itself) for its argument.

% 91-12-28: Replaced the use of niMon with the use of a specific 'reclaim'
%    structure. Introduced initialization, up-dating, and restoring of this
%    by specific functions, which may be called by GROEBNERINIT and changed
%    by the mode changing procedures. In this way, e. g. non-commutative use
%    of AmputeMons gets feasible.

% 91-10-27: Introduced the general macros (i.e., Mpt).

(OFF RAISE)


% Import: Potentially the internal EXPONENTS structure, and everything else!
% Export: MonReclaim, ReclaimInit, ReclaimCommify, ReclaimNonCommify.
% Available: PROLONGTWOWAYLIST, INITTWOWAYLIST.

% REDUCTIVITY on means: inhibit cannibalism of MONLIST, loosing space
% efficiency but retaining the full possibility to reduce new polynomials.
(GLOBAL '(MONLIST InPols !&!*InnerEmbDim!&!* ReclaimList))

% Minor sophistication at the moment.
% REDUCTIVITY off assumes to imply that the Groebner basis
% will never be USED for anything, since the potentional for reducing
% additional polynomials is cannibalized by this gc.
% In the non-commutative case, only (all) the monomials of current
% degree (cDeg) are removed; thus we may and must remove also when
% there is non-processed input left.

%# MonReclaim () : - ;
(DE MonReclaim ()
 (PROGN (OR (GETREDUCTIVITY)
	    (AND InPols (CommP))
	    (AmputeMons))
	(RECLAIM) ))

% Shall mon be taken away? Yes, if not it is an SPairs element. These are
% identified by having lists of dotted pairs for POINTERs.
% In the non-commytative case, they are identified by the 0 that marks
% their length. (In other words, we reclaim precisely the monomials of current
% degree.)

(DE commAwayP (placeofmon)
    (NOT (AND (PAIRP (Mpt (CDR placeofmon)))
	      (PAIRP (CAR (Mpt (CDR placeofmon)))))) )

(DE noncommAwayP (placeofmon)
    (BMI!= (CAR placeofmon) 0) )

% Removing monomials from MONLIST.
% Recall that MONLIST is a tree. Each of its nodes is a list, where the
% CAR is  an atom (NIL or a number), and the CDR constitites a MONOMIAL for
% the leaves, and else is a list of the underlying nodes. The length from
% root to leaf in the commutative case is always the # of (non-reduced)
% variables, which equals !&!*InnerEmbDim!&!*. In the non-commutative case
% it is cDeg+1. The removals are done by going through all paths down
% from the root, removing "unnecessary" monomials, and at higher levels
% amputing such nodes which no longer have any subnodes (always leaving
% the top node, of course). For this purpose, ReclaimList is used as
% a kind of stack, remembering the nodes above the current node AA. In
% order to make "pushing" down or "popping" up in the tree as easy as
% "moving" to the next subnode at a given level, the objects on ReclaimList are
% first turned to structures with pointers both up and down. (Cdar goes
% up, Cdr goes down, Caar is the position PRECEEDING the node. The latter
% feature makes it easy to ampute by means of Rplacd.)

%  Note that (comm)MonIntern must be run BEFORE (comm)InitReclaimList, in
% order to set !&!*InnerEmbDim!&!*.

%#  ReclaimInit () : - ;
(DE ReclaimInit ()
  (COND ((NOT (GETREDUCTIVITY)) (InitReclaimList))))

(DE commInitReclaimList ()
  (SETQ ReclaimList (INITTWOWAYLIST (ADD1 !&!*InnerEmbDim!&!*))))

(DE noncommInitReclaimList ()
  (SETQ ReclaimList (INITTWOWAYLIST 2)))

(DE commUpDateReclaimList () (PROGN NIL))

(DE noncommUpDateReclaimList ()
    (SETQ ReclaimList
	  (PROLONGTWOWAYLIST (DIFFERENCE (PLUS cDeg 2) (LENGTH ReclaimList))
			     ReclaimList)) )

(DE commAmputeMons NIL
 (PROG	(AA)
	(UpDateReclaimList)
	(PutTwW ReclaimList MONLIST)
	(SETQ AA ReclaimList)
  Ml	(COND ((NOT (LongerTwW AA))		% A monomial; to be amputed?
	       (COND ((AwayP (GetTwW AA))	% Yes.
		      (RPLACD (GetFormerTwW AA)
			      (CDDR (GetFormerTwW AA)))) % Ampute (and move)!
		     ((RPLACA (CADAR AA)
			      (CDR (GetFormerTwW AA))))) % No; just move!
	       (PopTwW AA)))			% Pop!
  Ml!'	(COND ((LongerTreeNode!@TwW AA)		% Is there a new subnode here?
	       (RPLACA (CADR AA) (CADAAR AA))	% Yes. Push!
	       (PushTwW AA)
	       (GO Ml))
	      ((NOT (PopTwW AA))		% No. Pop!
	       (CLEARTWOWAYLIST ReclaimList))	% Finished! Clean up and exit!
	      ((EQ (GetNextTwW AA)		% Is the subnode leafless?
		   (CADR (GetTwW AA)))		% Yes:
	       (RPLACD (GetTwW AA)
		       (CDDR (GetTwW AA)))	% Ampute (and move)!
	       (GO Ml!'))
	      (T
	       (MvTreeNode!@TwW AA)		% No; just move!
	       (GO Ml!'))) ))

(DE noncommAmputeMons NIL
 (PROG	(AA)
	(UpDateReclaimList)
	(PutTwW ReclaimList MONLIST)
	(SETQ AA ReclaimList)
  Ml	(COND ((NOT (LongerTwW AA))		% At cDeg. Do we have a
						% monomial (to be amputed)?
	       (COND ((AwayP (GetTwW AA))	% Yes.
		      (RPLACD (GetFormerTwW AA)
			      (CDDR (GetFormerTwW AA)))) % Ampute (and move)!
		     ((RPLACA (CADAR AA)
			      (CDR (GetFormerTwW AA))))) % No; just move!
	       (PopTwW AA)))			% Pop!
  Ml!'	(COND ((LongerTreeNode!@TwW AA)		% Is there a new subnode here?
	       (COND ((AwayP (CADAAR AA))	% Yes. Is it a monomial?
		      (RPLACD (GetTwW AA)	       %% Yes! Ampute!
			      (CDDR (GetTwW AA)))
		      (GO Ml!'))
		     (T
		      (RPLACA (CADR AA) (CADAAR AA))   %% No! Push!
		      (PushTwW AA)
		      (GO Ml))))
	      ((NOT (PopTwW AA))		% No. Pop!
	       (CLEARTWOWAYLIST ReclaimList))	% Finished! Clean up and exit!
	      ((EQ (GetNextTwW AA)		% Is the subnode leafless?
		   (CADR (GetTwW AA)))		% Yes:
	       (RPLACD (GetTwW AA)
		       (CDDR (GetTwW AA)))	% Ampute (and move)!
	       (GO Ml!'))
	      (T
	       (MvTreeNode!@TwW AA)		% No; just move!
	       (GO Ml!'))) ))

(DE ReclaimCommify ()
 (PROGN (COPYD 'InitReclaimList 'commInitReclaimList)
	(COPYD 'UpDateReclaimList 'commUpDateReclaimList)
	(COPYD 'AwayP 'commAwayP)
	(COPYD 'AmputeMons 'commAmputeMons) ))

(DE ReclaimNonCommify ()
 (PROGN (COPYD 'InitReclaimList 'noncommInitReclaimList)
	(COPYD 'UpDateReclaimList 'noncommUpDateReclaimList)
	(COPYD 'AwayP 'noncommAwayP)
	(COPYD 'AmputeMons 'noncommAmputeMons) ))

% Commutativity is the default:
(ReclaimCommify)

(ON RAISE)
