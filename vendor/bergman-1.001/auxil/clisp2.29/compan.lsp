;;
(SETQ TOPLOOPNAME!* "")
%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%
%% Copyright (C) 1996 Joergen Backelin
%%
%% Bergman is distributed in the hope that it will be useful,
%% but WITHOUT ANY WARRANTY.  No author or distributor
%% accepts responsibility to anyone for the consequences of using it
%% or for whether it serves any particular purpose or works at all,
%% unless (s)he says so in writing.  Refer to the Bergman General
%% License Public for full details.

%% Everyone is granted permission to copy, modify and redistribute
%% bergman, but only under the conditions described in the
%% Bergman General Public License.   A copy of this license is
%% supposed to have been given to you along with bergman so you
%% can know your rights and responsibilities.  It should be in a
%% file named copyright.  Among other things, the copyright notice
%% and this notice must be preserved on all copies.
%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%


%	CHANGES:
(C-OFF RAISE)
(LOAD "versmacr.sl")
(C-OFF RAISE)
(LOAD "specmode.sl")
(C-OFF RAISE)
(LOAD "specmacr.sl")
(C-OFF RAISE)
(COND ((PROBE-FILE (MKBMPATHEXPAND "speccmp1.sl"))
       (LOAD (MKBMPATHEXPAND "speccmp1.sl"))))

(C-OFF RAISE)
(COMPILE-AND-LOAD (MKBMPATHEXPAND "$bmsrc/slext.sl"))
(C-OFF RAISE)
(COMPILE-AND-LOAD (MKBMPATHEXPAND "$bmexe/speclisp.sl"))
(C-OFF RAISE)
(LOAD (MKBMPATHEXPAND "$bmsrc/macros.sl"))
(C-OFF RAISE)
(COMPILE-AND-LOAD (MKBMPATHEXPAND "$bmsrc/modes.sl"))
(C-OFF RAISE) (RECLAIM)
(LOAD (MKBMPATHEXPAND "$bmsrc/anick/anmacros.sl"))

(FASLOUT (MKBMPATHEXPAND "$bmload/anick"))
%(DSKIN (MKBMPATHEXPAND "$bmsrc/newdomain.sl"))
(C-OFF RAISE)
(COMPILE-AND-LOAD (MKBMPATHEXPAND "$bmsrc/anick/chrecord.sl"))
(C-OFF RAISE)
(COMPILE-AND-LOAD (MKBMPATHEXPAND "$bmsrc/anick/tenspol.sl"))
(C-OFF RAISE)
(COMPILE-AND-LOAD (MKBMPATHEXPAND "$bmsrc/anick/t_inout.sl"))
(C-OFF RAISE)
(COMPILE-AND-LOAD (MKBMPATHEXPAND "$bmsrc/anick/diffint.sl"))
(C-OFF RAISE)
(COMPILE-AND-LOAD (MKBMPATHEXPAND "$bmsrc/anick/anbetti.sl"))
(C-OFF RAISE)
(COMPILE-AND-LOAD (MKBMPATHEXPAND "$bmsrc/anick/gauss.sl"))
(C-OFF RAISE)
(COMPILE-AND-LOAD (MKBMPATHEXPAND "$bmsrc/anick/bnminout.sl"))
(C-OFF RAISE)
(COMPILE-AND-LOAD (MKBMPATHEXPAND "$bmsrc/anick/bnmbetti.sl"))
(C-OFF RAISE)
(COMPILE-AND-LOAD (MKBMPATHEXPAND "$bmsrc/anick/aninterf.sl"))
;(QUIT)
