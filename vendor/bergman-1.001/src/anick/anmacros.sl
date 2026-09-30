%%
%  Macros for the anick-in-bergman module(s)

%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%
%% Copyright (C) 1996
%% Joergen Backelin and Alexander Podoplelov
%%
%% Bergman and Anick are distributed in the hope that they will be
%% useful, but WITHOUT ANY WARRANTY.  No author or distributor
%% accepts responsibility to anyone for the consequences of using them
%% or for whether they serve any particular purpose or work at all,
%% unless (s)he says so in writing.  Refer to the Bergman General Public
%% License for full details.

%% Everyone is granted permission to copy, modify and redistribute
%% bergman, but only under the conditions described in the
%% Bergman General Public License.   A copy of this license is
%% supposed to have been given to you along with bergman so you
%% can know your rights and responsibilities.  It should be in a
%% file named copyright.  Among other things, the copyright notice
%% and this notice must be preserved on all copies.
%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%


%  Created 1996-06-23.


(OFF RAISE)

% Changes:
% ChR -> Chn
% LOOKFOR ->
%

%  Chain handling macros:

(DM anChn!= (rrg) (CONS 'EQ (CDR rrg)))
(DM anChn2LowerChn (rrg) (CONS 'CDAR (CDR rrg)))
(DM anChn2HiChns (rrg) (CONS 'CDDR (CDR rrg)))
(DM anChn2LastVx (rrg) (CONS 'CAAR (CDR rrg)))
(DM anChn2Diff (rrg) (CONS 'CDADR (CDR rrg)))
(DM anChn2Length (rrg) (CONS 'CAADR (CDR rrg)))
(DM anSETHIGHERCHAINS (rrg)
    (LIST 'RPLACD (LIST 'CDR (CADR rrg)) (CADDR rrg)))
(DM anSetDiff (rrg)
    (LIST 'RPLACD (LIST 'CADR (CADR rrg)) (CADDR rrg)))


%  Semi-distributed tensor polynomial macros:

(DM anSDP0!? (rrg) (LIST 'NULL (CONS 'CDR (CDR rrg))))

(DM anSDPTail (rrg) (CONS 'CDR (CDR rrg)))
(DM anSDP2FirstSDPTm  (rrg) (CONS 'CAR (CDR rrg)))
(DM anSDP2FirstChn (rrg) (CONS 'CAAR (CDR rrg)))
(DM anSDP2FirstQPol (rrg) (CONS 'CDAR (CDR rrg)))
(DM anSDP2NextSDPTm  (rrg) (CONS 'CADR (CDR rrg)))
(DM anSDP2NextChn (rrg) (CONS 'CAADR (CDR rrg)))
(DM anSDP2NextQPol (rrg) (CONS 'CDADR (CDR rrg)))
(DM anSDPTm2Chn (rrg) (CONS 'CAR (CDR rrg)))
(DM anSDPTm2QPol (rrg) (CONS 'CDR (CDR rrg)))
(DM anChn!&QPol2SDPTm (rrg) (CONS 'CONS (CDR rrg)))
(DM anChn!&QPol2SDPTail (rrg)
    (LIST 'NCONS (CONS 'anChn!&QPol2SDPTm (CDR rrg))))

(DM anMakeNewSDP (rrg) (LIST 'NCONS 'NIL))

(DM anNextSDPTail (rrg) (LIST 'SETQ (CADR rrg) (CONS 'CDR (CDR rrg))))
(DM anAppendSDPTail (rrg) (CONS 'RPLACD (CDR rrg)))
(DM anCopySDP (rrg) (LIST 'CONS 'NIL (LIST 'DPLISTCOPY (CONS 'CDR (CDR rrg)))))

(DM anInsertSDPTm (rrg)
    (LIST 'RPLACD (CADR rrg) (LIST 'CONS (CADDR rrg) (LIST 'CDR (CADR rrg)))))
(DM anRemoveSDPTm (rrg) (LIST 'RPLACD (CADR rrg) (CONS 'CDDR (CDR rrg))))

(DM anReplaceChninSDPTm (rrg) (CONS 'RPLACA (CDR rrg)))
(DM anReplaceQPolinSDPTm (rrg) (CONS 'RPLACD (CDR rrg)))



(ON RAISE)
