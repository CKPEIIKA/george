%  Internal Lie monomial handling.
%  Extra macro file: liemacro.sl
%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%
%% Copyright (C) 2000 Joergen Backelin
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


%	Created 2000-08-07.


%	CHANGES:

% Import: Potentially, EVERYTHING from ncmonom.sl.
% Export: MonLieify.

(OFF RAISE)

(GLOBAL '(bml!#OddVars

))

(FLUID '(NOOFBADINPUTMONOMIALS !*!&bmlMonInFailure

))


	%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%
	%%%					%%%
	%%%	AUXILIARY PROCEDURES		%%%
	%%%					%%%
	%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%

%# bmlMonInFailure (lvarno) : -
(DE bmlMonInFailure (lvar)
 (PROGN	(COND ((FIXP NOOFBADINPUTMONOMIALS)
	       (SETQ NOOFBADINPUTMONOMIALS
		     (ADD1 NOOFBADINPUTMONOMIALS))))
	(COND ((EQ !*!&bmlMonInFailure 'VERBOSE)
	       (PRIN2 "*** Irregular input ")
	       (PRIN2 lvar)
	       (PRIN2 " to MONINTERN.")
	       (PRIN2 "*** Consider correcting input, or changing input mode.")
	       (TERPRI))) ))

%# bmlNcw2Par (liencw) : liepar ;
(DE bmlNcw2Par (ncpmon)
 (PROG	(ip rt)
	(SETQ ip liencw)
  Ml	(COND ((EQ (CAR ip) 0)
	       (RETURN ip))
	      ((bmlVarNo2Par (CAR ip))
	       (SETQ rt (NOT rt))))
	(SETQ ip (CDR ip))
	(GO Ml) ))


	%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%
	%%%					%%%
	%%%	EXPORTED PROCEDURES		%%%
	%%%					%%%
	%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%

%  MONLIST structure: In the `upper nodes', organised as in
% the noncomm case, by associated non-commutative words (ncw's).
% However, as one ncw may be associated to several lie monomials,
% this node will have sub-nodes corresponding to the negated
% forms of these lie monomials. The noncomm monomial will be
% assumed to be initiated on the form ((NIL) . lvar 0). The
% tail will be retained, in order to facilitate the unique ncw
% feature. The (NIL) list later may be replaced by a list of
% nodes (<r> <Neg> <Neg> ...), where <r> ::= <NIL>|<T>|<Neg>,
% Neg ::= negated lie monomial, and the appearing Neg are
% sorted in lex decreasing order with respect to their ncw's.
% <r> is T if the word is not regular or quasi regular, the
% negation of the unique (quasi) regular lie monomial with
% this ncw, if this exists and is constructed, and NIL if the
% regularity is not resolved.

%  The internalisation procedure depends of the chosen input mode.


%  Input as regular monomials:
%  Meaning of PROG variables: MONTREE node; return value;
% Associated non-commutative word;
%# reglieMONINTERN (lvarno) : augmon ;
(DE reglieMONINTERN (lvar)
 (PROG	(nd rt aw)
	(COND ((SETQ rt (Mpt (SETQ nd (noncommMONINTERN lvar))))
	       (COND ((EQ rt T)
		      (bmlMonInFailure lvar)
		      (RETURN NIL))
		     (T
		      (RETURN (bmlNeg2Norm rt))))))
	(SETQ aw (PMon nd))
	(SETQ rt (bmlDeg!&Par!&Ncw2NewPNorm (noncommTOTALDEGREE aw)
					    (bmlNcw2Par aw)
					    aw))
	))


%# lieMONLISPOUT (puremon) : lispform_monomial ;
%# lieMonAlgOutprep (puremon) : algform_output_monomial ;
%# lieMONLESSP (Mon1:puremon, Mon2:puremon) : bool ;
%# lieMONTIMES2 (Mon1:puremon, Mon2:puremon) : augmon ;
%# lieMonTimes (Mon:puremon, MonQ:monquot) : augmon ;
%# lieniMonQuotient (Mon1:puremon, Mon2:puremon) : monquot ;
%# lieMONFACTORP (Mon1:puremon, Mon2:puremon) : mon_factor_data ;
%# liePreciseniMonQuotient (Mon1:puremon, Mon2:puremon, Pos:mon_factor_data) : monquot ;
%# lieTOTALDEGREE (Mon:puremon) : degree ;
 
%# lieniMonIntern ( ) : augmon ;
%# lieLCorOUT (puremon1 puremon2), et cetera: Badly modularised?




%	Setting the exported functions:

%# MonLieify () : - ;
(DE MonLieify ()
 (PROGN (COPYD 'MONINTERN 'lieMONINTERN)
	(COPYD 'MonIntern1 'lieMonIntern1)
	(COPYD 'MONLESSP 'lieMONLESSP)
	(COPYD 'MONFACTORP 'lieMONFACTORP)
	(COPYD 'MonFactorP1 'lieMonFactorP1)
	(COPYD 'LeftMonFactorP 'lieLeftMonFactorP)
	(COPYD 'ListMonFactorP 'lieListMonFactorP)
%	(COPYD 'EarlyMonFactorP 'lieEarlyMonFactorP)
	(COPYD 'MonTimes 'lieMonTimes)
	(COPYD 'MONTIMES2 'lieMONTIMES2)
	(COPYD 'niMonQuotient 'lieniMonQuotient)
	(COPYD 'niMonQuotient1 'lieniMonQuotient1)
	(COPYD 'PreciseniMonQuotient 'liePreciseniMonQuotient)
%	(COPYD 'LCauto 'lieLCauto)
%	(COPYD 'LC2 'lieLC2)
	(COPYD 'TOTALDEGREE 'lieTOTALDEGREE)
	(COPYD 'MonomialInit 'lieMonomialInit)
	(COPYD 'RestOfMon 'lieRestOfMon)
	(COPYD 'MonSignifVar 'CADR)
	(COPYD 'GETVARNO 'lieGETVARNO)
	(COPYD 'MONLISPOUT 'lieMONLISPOUT)
	(COPYD 'MonAlgOutprep 'lieMonAlgOutprep)
	(COPYD 'IOWeights2Weights 'LISTCOPY)
	(COPYD 'Weights2IOWeights 'LISTCOPY)
 ))

(ON RAISE)