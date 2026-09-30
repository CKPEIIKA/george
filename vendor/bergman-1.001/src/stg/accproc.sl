%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%
%% Copyright (C) 1992,1993,2004 Joergen Backelin
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


%	CHANGES

% 2004-05-02: MonOne --> MONONE ./JoeB


%  Created 1992-03-24. Procedures for staggering Groebner basis elements
% properties access handling. See accmacros.sl for further notes.

(OFF RAISE)

(GLOBAL '(MONONE))

% May be moved to accmacros:
(DE PutMonSubs!=Acc (mon)
 (PROGN	(PutMonSubs mon (Mon2Subs mon))
	(PutMonSubs!-Acc mon (Mon2Subs MONONE)) ))
