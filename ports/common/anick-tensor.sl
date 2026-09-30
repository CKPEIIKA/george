%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%
%% George safe-mode Anick tensor operations, 2026-09-30.
%% Copyright (C) 2026 the George contributors.
%% Distributed under the Bergman General Public License and GPL-2.0-or-later.
%% Injected into the disposable tenspol.sl build copy by behavior-patches.py.
%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%

(OFF RAISE)
(GLOBAL '(GEORGELEGACYMODE))

% Order tensor terms by the entire chain word followed by its leading
% coefficient word. Mixed degrees can change this order after reduction.
(DE GEORGETENSDPTmLESSP (sdtm1 sdtm2)
 (PROG (m1 m2)
  (SETQ m1 (anHIGHESTTENSMONOM2PureMon sdtm1))
  (SETQ m2 (anHIGHESTTENSMONOM2PureMon sdtm2))
  (RETURN (AND (NOT (EQ m1 m2)) (MONLESSP m1 m2)))))

% Stable insertion sort with the augmented-list predecessor convention.
% The original restore routine can put a moved term one position too far.
(DE GEORGESORTSDP (sdtp)
 (PROG (terms term a)
  (SETQ terms (CDR sdtp)) (RPLACD sdtp NIL)
  Next (COND ((NULL terms) (RETURN sdtp)))
  (SETQ term (CAR terms)) (SETQ terms (CDR terms)) (SETQ a sdtp)
  Find (COND ((AND (CDR a)
                   (NOT (anTENSDPTmLESSP (anSDP2NextSDPTm a) term)))
              (anNextSDPTail a) (GO Find)))
  (anInsertSDPTm a term) (GO Next)))

% Changing a coefficient polynomial may move its chain to any position.
% Merge by chain identity, remove zeros, then restore the full tensor order.
% As in the original routine, inserted second-input polynomials are scaled.
(DE GEORGEADDTENSPOLS (sdp1 sdp2 cf)
 (PROG (a b)
  (SETQ b (CDR sdp2))
  Next (COND ((NULL b) (RETURN (anSORTSDTp sdp1))))
  (SETQ a sdp1)
  Find (COND ((NULL (CDR a))
              (DestructQPolCoeffTimes (anSDP2FirstQPol b) cf)
              (anInsertSDPTm a (anSDP2FirstSDPTm b)))
             ((anChn!= (anSDP2NextChn a) (anSDP2FirstChn b))
              (COND ((NULL (DestructQPolSimpSemiLinComb
                             (anSDP2NextQPol a) (anSDP2FirstQPol b) cf))
                     (anRemoveSDPTm a))))
             (T (anNextSDPTail a) (GO Find)))
  (anNextSDPTail b) (GO Next)))

(ON RAISE)
