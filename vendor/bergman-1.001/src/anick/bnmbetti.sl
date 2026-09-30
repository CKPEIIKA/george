%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%
%
%     Betti numbers calculation for modules
%
%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%

%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%
%% Copyright (C) 1996,2001,2002
%% Alexander Podoplelov, Joergen Backelin
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

%  Created 2001-08-06 out of a copy of the file anbetti.sl,
% in order to allow for calculation of more general Betti numbers.
% We assume that we have a resolution Y_* of a right module M,
% represented by a degree-list of chains
% (where degrees are total degrees); and a left module N,
% represented by a degree-list of "normal words", i.e., of
% non-reducible monomials.

%  From subsets of these, various cartesian products may be
% formed. For each such of the relevant total-degree and
% homological degrees, the differentioal should be calculated,
% and turned into a matrix line. Then the rank of the matrix
% should be calculated.

%  Thus, the chains in the original file anbetti.sl should
% be replaced by dotted pairs (chain . normal word); with
% ensuing changes of homological degree calculation, rank
% calculation, et cetera.

%  First of all, a 'more precise' version of anCHAINS,
% anbnmSORTEDCHAINS, should be kept and updated. Likewise should
% the degree-list bnmLeftModuleNormalWords.


%	CHANGES

% Corrected anbtbnmTwoModulesMAKEMATRIX, so that it is defined with and
% calls one argument./JoeB 2002-10-10

(OFF RAISE)

(GLOBAL '(anZERO anBETTINUMS anCURRENTBETTINUMS btMacMx anCHAINS
	  anbnmSORTEDCHAINS bnmLeftModuleNormalWords anbnmTensorMons
	  anbnmTensorMonsAccess anbnmNewTensorMonsAccess
	  anbnmIndexLimits NALGGEN NLMODGEN NRMODGEN
	  anbnmLModNormalMonStartIndexLimits
	  anbnmLModNormalMonEndIndexLimits))


(DM anbnmPair2AMon (rrg) (CONS 'CAR (CDR rrg)))
(DM anbnmPair2Chn (rrg) (CONS 'CDR (CDR rrg)))
(DE anbnmChn!&AMon2Pair (chn amon)
 (INTERNPAIR chn amon (CDR anbnmTensorMonsAccess)) )

%  Creates a degree-list w.r.t. homological degree, out of the
% degree item of anCHAINS. If such ones are formed, the resulting
% list is placed on anbnmSORTEDCHAINS, and returned. Else, NIL
% is returned.
%  Meaning of PROG variables: remaining InPut list; ReTurn list;
% Return list Position; Return list Element position; Homological
% Degree of input chain.

%# anUPDATESORTEDCHAINS (degno) : gen(degno.dlchain) ;
(DE anUPDATESORTEDCHAINS (deg)
 (PROG	(ip rt rp re hd)
	(COND ((NOT (AND (SETQ ip (ATSOC deg anCHAINS))
			 (CDR ip)))
	       (RETURN NIL)))
	(SETQ rt (NCONS deg))
  Ml	(COND ((NOT (SETQ ip (CDR ip)))
	       (SETQ anbnmSORTEDCHAINS
		     (CONS rt anbnmSORTEDCHAINS))
	       (RETURN rt)))
	(SETQ rp rt)
	(SETQ hd (anChn2Length (CAR ip)))
  Sl	(COND ((OR (NOT (CDR rp)) (BMI!< hd (CAADR rp)))
	       (RPLACD rp (CONS (LIST hd (CAR ip)) (CDR rp)))
	       (GO Ml))
	      ((NOT (BMI!= hd (CAAR (SETQ rp (CDR rp)))))
	       (GO Sl)))
	(SETQ re (CAR rp))
  Tl	(COND ((CDR re)
	       (SETQ re (CDR re))
	       (GO Tl)))
	(RPLACD re (NCONS (CAR ip)))
	(GO Ml) ))


% For potentially different situations, the identifier anbnmIndexLimits
% is used for setting the limits for the indices of the variables with
% which the LMNW's (Left Module Normal Words) are to be prepended.

%# anbnmSetIndexLimits ( ) : - ;
(DE anbnmSetIndexLimits () (SETQ anbnmIndexLimits (CONS 0 NALGGEN)) )

%  Meaning of PROG variables: Variable Index; Index Limit; ReTurn list.

%# anbnmLMNWInit ( ) : - ;
(DE anbnmLMNWInit ()
 (PROG	(vi il rt)
	(SETQ vi (CDR anbnmLModNormalMonEndIndexLimits))
	(SETQ il (SUB1 (CAR anbnmLModNormalMonEndIndexLimits)))
	Ml
	(COND ((BMI!< il vi)
	       (SETQ rt (CONS (MONINTERN (LIST vi)) rt))
	       (SETQ vi (SUB1 vi))
	       (GO Ml)))
	(SETQ bnmLeftModuleNormalWords (NCONS (CONS 1 rt))) ))
	

%# anbnmUpdateLMNW (degno) : gen(degno.laugmon) ;
(DE anbnmUpdateLMNW (deg)
 (PROG	(rt)
   (COND ((SETQ rt
		(noncommordweightsNormalWords deg
					      bnmLeftModuleNormalWords
					      anbnmLModNormalMonStartIndexLimits))
	  (SETQ bnmLeftModuleNormalWords
		(CONS rt bnmLeftModuleNormalWords))
	  (RETURN rt)) )))


%  Makes a list and an accesslist for all pairs (chn,augmon) of
% chains of homological degree hd and of left module normal words,
% such that the sum of the total degrees is deg. Returns the
% number of such pairs.

%  In practise, we want the LIST for the present hd (for going
% through item by item, calculating differentials); but the ACCESS
% for the preceeding hd (since that's the one of the tensor
% monomials appearing in the differentials). We solve this by
% creating a new access list, after saving the old one as the
% relevant one.)

%  SHOULD BE CHANGED, IF TOTAL DEGREE CONVENTIONS CHANGE. Now, I
% assume that both chains and normal words have POSITIVE total
% degrees.

%  Meaning of PROG variables: ReTurn value; Chain Input list;
% Normal Word Input list; Degree Number.


%# anbnmListTensorMons (degno, degno) : int ;
(DE anbnmListTensorMons (deg hd)
 (PROG	(rt ci nwi dn)
%	(PRIN2 "anbnmListTensorMons <-- ") (PRIN2 deg) (PRIN2 " ") (PRINT hd)
	(SETQ rt 0)
	(SETQ anbnmTensorMons (NCONS hd))
	(SETQ anbnmTensorMonsAccess anbnmNewTensorMonsAccess)
	(SETQ anbnmNewTensorMonsAccess (NCONS hd))
	(SETQ dn deg)
  Ml	(COND ((BMI!= 0 (SETQ dn (SUB1 dn)))
%	       (PRIN2 "anbnmListTensorWords --> ") (PRINT rt)
	       (RETURN rt))
	      ((AND (SETQ ci (ATSOC dn anbnmSORTEDCHAINS))
		    (SETQ ci (ATSOC hd (CDR ci)))
		    (SETQ nwi (ATSOC (BMI!- deg dn)
				     bnmLeftModuleNormalWords)))
%	       (PRIN2 "Will enter XSETPRODUCT with deg = ") (PRINT deg)
	       (SETQ rt (PLUS (XSETPRODUCT (CDR ci)
					   (CDR nwi)
					   anbnmNewTensorMonsAccess
					   anbnmTensorMons)
			      rt))))
	(GO Ml) ))




% This procedure initializes variables which are used to collect
% information about Betti Numbers. It should be called before
% Anick calculation.
(DE anbnmTwoModulesBETTIINIT ()
 (PROGN
   (SETQ anBETTINUMS (NCONS NIL))
   (SETQ btMacMx NIL)
 )
)


%# anbtbnmTwoModulesMakeMatrixLine (id:ldpany, pol:sdp) : lcoeff ;
%         Returns a list of coefficients which are extracted from the pol.
%	  The tensor polynomial is regarded as fully distributed. ALL
%	  coefficients of distributed tensor monomials are sought.
%	  The interned dotted pairs corresponding to those tensor monomials
%	  appearing are placed into
%	  "id" list.  Extracted coefficients are arranged according to the
%	  list "id" which is updated every time.
% colsIDlist = ( NIL (amonn.chnn) ... (amon2.chn2) (amon1.chn1) ).

(DE anbtbnmTwoModulesMakeMatrixLine (colsIDlist sdp)
 (PROG	(a rt locols lcp ch pl tm)
        (SETQ a (anSDPTail sdp))
   L1   (SETQ ch (anSDP2FirstChn a))
	(SETQ pl (anSDP2FirstQPol a))
   Subl	(SETQ tm (QPol2LRatTm pl))
	(SETQ locols
	      (CONS (CONS (anbnmChn!&AMon2Pair ch (Mon tm))
			  (Cf tm))
		    locols))
	(COND ((PPol!? (RemoveNextTm pl))
	       (GO Subl))
	      ((anNextSDPTail a)
	       (GO L1)))
	(COND ( (NULL locols) (RETURN NIL) ) )
	(SETQ locols (CONS NIL locols) )
	(COND ( (NULL (SETQ a (CDR colsIDlist))) (GO L4) ) )
	(SETQ rt (TCONC NIL NIL))
   L2	(COND ( (NOT (CDR (SETQ lcp locols))) (GO L5) ))
   L3   (COND ( (anChn!= (CAR a) (CAADR lcp))
		(TCONC rt (CDADR lcp)) % extracting the coefficient
		(RPLACD lcp (CDDR lcp))
	      )
	      
	      ( (NULL (CDR (SETQ lcp (CDR lcp)))) (TCONC rt anZERO) )
	      ( T (GO L3) )
	)
	(COND ( (SETQ a (CDR a)) (GO L2) ) )
	(SETQ rt (CDAR rt))
   L4   (COND ( (NULL (SETQ locols (CDR locols))) (RETURN rt) ) )
	(RPLACD colsIDlist (CONS (CAAR locols) (CDR colsIDlist)))
	(SETQ rt (CONS (CDAR locols) rt))
	(GO L4)
   L5	(TCONC rt anZERO)
	(COND ( (SETQ a (CDR a)) (GO L5) ) )
	(RETURN (CDAR rt))
 )
)


%    anbtMAKEMATRIX (order:int, chains:lchn) : llcoeff ;
%	but for the TwoModules version, order is irrelevant. Instead
%	of chains, we work with "tensor monomials" (in practice: dpchnmon).
%# anbtbnmTwoModulesMAKEMATRIX (ltensmon) : matrix ;
(DE anbtbnmTwoModulesMAKEMATRIX (tmons)
 (PROG  (cols i rt cp)
	(SETQ cols (NCONS NIL))
	(SETQ cp tmons)
  Ml	(COND ((NULL (SETQ cp (CDR cp)))
	       (RETURN (anbtALIGN rt)))
	      ((AND (anChn2Diff (anbnmPair2Chn (CAR cp)))
		    (SETQ i (anCONCATTENSPOLMON (anChn2Diff
						 (anbnmPair2Chn (CAR cp)))
						(anbnmPair2AMon (CAR cp))))
		    (anSDPTail i))
	       (SETQ rt (CONS (anbtbnmTwoModulesMakeMatrixLine cols i)
			      rt))))
        (GO Ml) ))


%         The procedure accepts as its argument a list which is an
%	  element of the anCHAINS degree list. More precisely,
%	  its tail is a list of chains, but the first element equals
%	  their homological degree. The procedure updates Betti
%	  numbers which are storied in anCURRENTBETTINUMS for this
%	  particular homological degree. anCURRENTBETTINUMS is some
%	  tail of the anBETTINUMS list.
% chains - an element from anCHAINS - is hardly employed in this
% variant. It is only used in order to extract the current degree
% information.

%# anTwoModulesBETTI (chains:lchn) : - ;
(DE anTwoModulesBETTI (chains)
 (PROG	(Qc Qn Rc Rn order top chns B lp cp)
	% (SETQ chns (CDR chains))
	(SETQ top (CAR chains))
	(SETQ order (SETQ Rc 0))
	(SETQ cp anBETTINUMS)
	% (anUPDATESORTEDCHAINS top)% Done in anifTwoModulesResolutionFixDegree
	(anbnmUpdateLMNW top)
   L2	(COND ((CDR cp)
	       (SETQ cp (CDR cp))
	       (GO L2)))
	(SETQ lp cp)
   L3	(COND ((BMI!= (SETQ Qc (anbnmListTensorMons top order)) 0)
	       (COND ((BMI!< (SETQ order (ADD1 order)) top)
		      (GO L3))
		     (T
		      (GO End)))))
   L1	(SETQ Qn (anbnmListTensorMons top (ADD1 order)))
	(SETQ Rn
	      (COND ((OR (EQ Qn 0) (EQ (ADD1 order) top)) 0)
		    (T
		     (anRANK (anbtbnmTwoModulesMAKEMATRIX anbnmTensorMons)))))
        (SETQ B (DIFFERENCE Qc (PLUS2 Rc Rn)))
        (COND ( (NEQ B 0)
		(RPLACD cp (NCONS (CONS (CONS order top) B) ))
		(SETQ cp (CDR cp))
		(anbtMacSet order top B)
        ))
        (SETQ Qc Qn)
        (SETQ Rc Rn)
        (SETQ order (ADD1 order))
        (COND ( (LESSP order top) (GO L1) ))
	% Here conditional printing of the new BETTINUMs should be inserted;
	% or (more modularised):
  End	(SETQ anCURRENTBETTINUMS (CDR lp))
	(SETQ anbnmTensorMons NIL)
	(SETQ anbnmTensorMonsAccess NIL)
	(SETQ anbnmNewTensorMonsAccess NIL) ))


(ON RAISE)
