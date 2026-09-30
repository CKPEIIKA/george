;;
(SETQ TOPLOOPNAME!* "")

%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%
%% Copyright (C) 1992,1994,1995,1996,2002 Joergen Backelin
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

%  hscomm added./JoeB 2002-10-12

%  pbseries removed./JoeB 1999-11-04

%  modinout.sl, modes.sl added/JoeB 1997-09-17

%  The architecture handling adopted to `kzz type'/JoeB 1996-11-26.

%14.08.96 Svetlana Cojocaru, Victor Ufnarovski
%The module "full" is divided into two parts to respect the restriction
%on the length of a FASLOUT output file - no more than 64K.
%The module sermul.sl is included additionaly (series multiplication).


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

;(C-OFF RAISE)
;(LOAD (MKBMPATHEXPAND "$bmsrc/macros.sl"))
;(C-OFF RAISE)
;(RECLAIM)

; ========== header for CLISP ended

