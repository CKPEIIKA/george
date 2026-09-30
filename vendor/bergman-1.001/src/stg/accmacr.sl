%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%
%% Copyright (C) 1992,1994,1998,1999 Joergen Backelin
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


%  Created 1992-03-04. Macros for staggering Groebner basis elements
% properties access handling.

%  The properties are stored in a particular structure on the monomial
% property list, labelled StaggerStuff, of the leading monomial of a (pre-
% liminary) Groebner basis element. It is organised thus:
%
% ((priority . substatial degree - accidental degree)
%  (priority position . substantial degree) trailing prohibition ideal).
%
%  The priority is represented by an integer. Inserting new priorities
% among the old ones may make it necessary to renumber the priorities.
% (Then the priorities are changed to new integers, but the order of the
% priorities of different Groebner basis elements is preserved.) In order
% to make this feasible with minor trouble, a record of all the priorities
% (including the corresponding leading monomials) are kept on a separate
% structure. Furthermore, the position of the priority item on this
% structure corresponding to a certain leading monomial is accessible as
% the "priority position" on its StaggerStuff.
%  The accidental degree of the monomial is its pure part ("pmon", list of
% exponents) or some entity depending linearly on this, while the sub-
% stantial degree is the corresponding index list or entity for the "in-
% herited" or "sugar" multidegree of the Groebner basis element. Its value
% depends on the history of the element; it is always greater than or equal
% to the accidental degree, and equal to it iff the element is one of the
% original input ideal generators.
%  The prohibition ideal, the ideal of monomials whose products with the
% Groebner basis elements are NOT considered as members of the staggered
% linear system of generators, is represented by its minimal monomial
% generators. The structure on which it is saved needs a "dummy" CAR,
% an "augmentation" (in order to be able to insert or remove ideals
% destructively by means of RPLACD/RPLACA). The (pripos . subs) pair is
% used as such a dummy. (It is in no way influenced by the prohid handling.)
%  For comparision purposes, most often the subs-acc AND the priority are
% used. (There might even be efficiency gained by blending them into ONE com-
% parison number.) Thus, the pair (pri . subs - acc) may be accessed and pro-
% cessed as a unit.
%  In some incidences, a substance and a priority is considered together,
% without direct connection to a monomial. We then must save not just the
% priority, but a part of the staggerstuff where it is found, since this
% priority may have to be changed when new priorities are inserted. Thus
% we represent the SubsPri by ((pri . subs - acc) . subs), where the first
% pair is the Subs!-AccPri of some monomial.

(OFF RAISE)

(GLOBAL '(StgStf))

% (Pri!< (Mon2Pri (Lm CC)) PR) Properly on its own "primacros" file?
% (MkStaggerPairs AA)

(DM MakeStaggerStuff (rrg)
    (LIST 'LPUT (CONS 'CAR (CDR rrg)) ''StgStf '(LIST (LIST ()) (LIST ()))))
(DM GetStaggerStuff (rrg) (LIST 'LGET (CONS 'CDAR (CDR rrg)) ''StgStf))
(DM GetMonSubs!-AccPri (rrg) (LIST 'CAR (CONS 'GetStaggerStuff (CDR rrg))))
(DM GetMonSubs!-Acc (rrg) (LIST 'CDR (CONS 'GetMonSubs!-AccPri (CDR rrg))))
(DM GetMonPri (rrg) (LIST 'CAR (CONS 'GetMonSubs!-AccPri (CDR rrg))))
(DM GetMonSubs (rrg) (LIST 'CDADR (CONS 'GetStaggerStuff (CDR rrg))))
(DM GetMonPriPos (rrg) (LIST 'CAADR (CONS 'GetStaggerStuff (CDR rrg))))
(DM GetMonProhId (rrg) (LIST 'CDR (CONS 'GetStaggerStuff (CDR rrg))))
(DM PutMonSubs!-AccPri (rrg)
    (LIST 'RPLACA (LIST 'GetStaggerStuff (CADR rrg)) (CADDR rrg)))
(DM PutMonSubs!-Acc (rrg)
    (LIST 'RPLACD (LIST 'GetMonSubs!-AccPri (CADR rrg)) (CADDR rrg)))
(DM PutMonPri (rrg)
    (LIST 'RPLACA (LIST 'GetMonSubs!-AccPri (CADR rrg)) (CADDR rrg)))
(DM PutMonSubs (rrg)
    (LIST 'RPLACD (LIST 'CADR (LIST 'GetStaggerStuff (CADR rrg))) (CADDR rrg)))
(DM Subs!&Mon2Subs!-Acc (rrg)
    (LIST 'Subs!- (CADR rrg) (CONS 'Mon2Subs (CDDR rrg))))
(DM PutMonPriPos (rrg)
    (LIST 'RPLACA (LIST 'CADR (LIST 'GetStaggerStuff (CADR rrg))) (CADDR rrg)))
(DM TransferMonProhId (rrg)
    (LIST 'RPLACD
	  (LIST 'CDR (LIST 'GetStaggerStuff (CADR rrg)))
	  (CONS 'CDR (CDDR rrg))))
(DM PutPosPri (rrg) (LIST 'PutMonPri (LIST 'GetTwW (CADR rrg)) (CADDR rrg)))
(DM Pos2Pri (rrg) (LIST 'GetMonPri (CONS 'GetTwW (CDR rrg))))
(DM Subs!-AccPri2Subs!-Acc (rrg) (CONS 'CDR (CDR rrg)))
(DM Subs!-AccPri2Pri (rrg) (CONS 'CAR (CDR rrg)))
(DM Subs!-AccPri!< (rrg)
    (LIST 'COND
	  (LIST (LIST 'Subs!=
		      (LIST 'Subs!-AccPri2Subs!-Acc (CADR rrg))
		      (LIST 'Subs!-AccPri2Subs!-Acc (CADDR rrg)))
		(LIST 'Pri!<
		      (LIST 'Subs!-AccPri2Pri (CADR rrg))
		      (LIST 'Subs!-AccPri2Pri (CADDR rrg))))
	  (LIST T
		(LIST 'Subs!<
		      (LIST 'Subs!-AccPri2Subs!-Acc (CADR rrg))
		      (LIST 'Subs!-AccPri2Subs!-Acc (CADDR rrg))))))
(DM Subs!-AccPri!<3 (rrg)
    (LIST 'COND
	  (LIST (LIST 'Subs!=
		      (LIST 'Subs!-AccPri2Subs!-Acc (CADR rrg))
		      (CADDR rrg))
		(LIST 'Pri!<
		      (LIST 'Subs!-AccPri2Pri (CADR rrg))
		      (CADDDR rrg)))
	  (LIST T
		(LIST 'Subs!<
		      (LIST 'Subs!-AccPri2Subs!-Acc (CADR rrg))
		      (CADDR rrg)))))


% Substance-Priority (of a polynomial or critical pair) handling:

(DM Subs!-AccPri!+Acc (rrg)
    (LIST 'CONS (CADR rrg) (LIST 'Subs!+ (LIST 'CDR (CADR rrg)) (CADDR rrg))))
(DM SubsPri2Subs (rrg) (CONS 'CDR (CDR rrg)))
(DM SubsPri2Pri (rrg) (CONS 'CAAR (CDR rrg)))
(DM SubsPri!< (rrg)
    (LIST 'COND
	  (LIST (LIST 'Subs!=
		      (LIST 'SubsPri2Subs (CADR rrg))
		      (LIST 'SubsPri2Subs (CADDR rrg)))
		(LIST 'Pri!<
		      (LIST 'SubsPri2Pri (CADR rrg))
		      (LIST 'SubsPri2Pri (CADDR rrg))))
	  (LIST T
		(LIST 'Subs!<
		      (LIST 'SubsPri2Subs (CADR rrg))
		      (LIST 'SubsPri2Subs (CADDR rrg))))))


% Priorities:

(DM Pri!< (rrg) (CONS 'BMI!< (CDR rrg)))
