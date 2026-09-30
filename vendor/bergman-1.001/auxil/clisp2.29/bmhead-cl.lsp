;;
(SETQ TOPLOOPNAME!* "")

%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%
%% Copyright (C) 2005 Joergen Backelin
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

% To begin with, only the most raw Standard Lisp procedures are
% expexted. Here follows three LAPINs (reading and evaling
% but suppressing printing from entire files).

(C-OFF RAISE)
(LOAD "versmacr.sl")
(C-OFF RAISE)
(LOAD "specmode.sl")
(C-OFF RAISE)
(LOAD "specmacr.sl")
(C-OFF RAISE)
(COND ((PROBE-FILE "speccmp1.sl")
	       (LOAD "speccmp1.sl")))

;slext
(C-OFF RAISE)
(LOAD (MKBMPATHEXPAND "$bmload/slext.fas"))
(C-OFF RAISE)
(LOAD (MKBMPATHEXPAND "$bmexe/speclisp.sl"))

(SETQ |*BMVersion*| (EXT:GETENV "bmvers"))
; ========== bmtop header for CLISP ended

