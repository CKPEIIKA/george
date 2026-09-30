%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%
%% Copyright (CC) 1992,1994,1998 Joergen Backelin
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


%  Created 1992-03-24. Macros for substance handling.
%  Concerns the "inner structure" of substance handling, while the
% "outer access" be through the acc macros and procedures.

%  For now, the substances be in exactly the same form as the index lists.
% In particular, Subs!< (as MONLESSP) must not be applied with equal 
% arguments.

(DM Subs!= (rrg) (CONS 'EQ (CDR rrg)))
(DM Subs!< (rrg) (CONS 'MONLESSP (CDR rrg)))
%(DM TDegSubs!< (rrg)
%    (LIST 'BMI!< (LIST 'TOTALDEGREE (CADR rrg)) (CONS 'TOTALDEGREE (CDDR rrg))))
(DM PMon2Subs (rrg) (CADR rrg))
(DM Mon2Subs (rrg) (LIST 'PMon2Subs (CONS 'PMon (CDR rrg))))
(DM Subs!- (rrg) (LIST 'Mon2Subs (CONS 'MONQUOTIENT (CDR rrg))))
(DM Subs!+ (rrg) (LIST 'Mon2Subs (CONS 'MonTimes (CDR rrg))))
