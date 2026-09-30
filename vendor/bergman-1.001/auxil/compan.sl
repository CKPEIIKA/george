(SETQ TOPLOOPNAME!* "")
%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%
%% Copyright (C) 1996,2001,2005 Joergen Backelin
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


%	CHANGES:

%  Moved first instructions to new header./JoeB 2005-06-30 -- 07-01

(LAPIN (MKBMPATHEXPAND "$bmsrc/macros.sl"))
(OFF RAISE) (RECLAIM)
(DSKIN (MKBMPATHEXPAND "$bmsrc/anick/anmacros.sl"))

(GROUPCOMP (MKBMPATHEXPAND "$bmload/anick"))
%(ITEMCOMP "$bmsrc/newdomain.sl")
(ITEMCOMP "$bmsrc/anick/chrecord.sl")
(ITEMCOMP "$bmsrc/anick/tenspol.sl")
(ITEMCOMP "$bmsrc/anick/t_inout.sl")
(ITEMCOMP "$bmsrc/anick/diffint.sl")
(ITEMCOMP "$bmsrc/anick/anbetti.sl")
(ITEMCOMP "$bmsrc/anick/gauss.sl")
(ITEMCOMP "$bmsrc/anick/bnminout.sl")
(ITEMCOMP "$bmsrc/anick/bnmbetti.sl")
(ITEMCOMP "$bmsrc/anick/aninterf.sl")
(FASLEND)
