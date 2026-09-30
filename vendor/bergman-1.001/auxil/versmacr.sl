%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%
%% Copyright (C) 1994 Joergen Backelin
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


% CREATED 1994-09-02, out of a fragment of the old macros.sl/JoeB

% This file should collect the set-up version dependence macros.
% It is written in pure Standard Lisp, where there is no inbuilt
% environment version handler. It should be read rather early
% by various make files.

(GLOBAL '(!*PSL!-MODE	% Restricted or extended psl, alone or
			% as a reduce base.
	  !*SL!-MODE	% Standard Lisp.
	  !*CL!-MODE	% Common Lisp.
	  !*CSL!-MODE	% Codemist Standard Lisp.
	  !*REDUCE!-MODE % Some lisp that is a base for Reduce.
	  !*UNIX!-MODE	% Unix operating system.
	  !*MSDOS!-MODE % MsDos operating system.
))

(SETQ *RAISE NIL)

(DM PSL!-SPECIFIC (code)
    (COND (!*PSL!-MODE (CADR code))))

(DM SL!-SPECIFIC (code)
    (COND (!*SL!-MODE (CADR code))))

(DM CL!-SPECIFIC (code)
    (COND (!*CL!-MODE (CADR code))))

(DM CSL!-SPECIFIC (code)
    (COND (!*CSL!-MODE (CADR code))))

(DM REDUCE!-SPECIFIC (code)
    (COND (!*REDUCE!-MODE (CADR code))))

(DM UNIX!-SPECIFIC (code)
    (COND (!*UNIX!-MODE (CADR code))))

(DM MSDOS!-SPECIFIC (code)
    (COND (!*MSDOS!-MODE (CADR code))))

(DM PSL!-AVOIDING (code)
    (COND ((NOT !*PSL!-MODE) (CADR code))))

(DM SL!-AVOIDING (code)
    (COND ((NOT !*SL!-MODE) (CADR code))))

(DM CL!-AVOIDING (code)
    (COND ((NOT !*CL!-MODE) (CADR code))))

(DM CSL!-AVOIDING (code)
    (COND ((NOT !*CSL!-MODE) (CADR code))))

(DM REDUCE!-AVOIDING (code)
    (COND ((NOT !*REDUCE!-MODE) (CADR code))))

(DM UNIX!-AVOIDING (code)
    (COND ((NOT !*UNIX!-MODE) (CADR code))))

(DM MSDOS!-AVOIDING (code)
    (COND ((NOT !*MSDOS!-MODE) (CADR code))))
