%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%
%% Copyright (C) 1992 Joergen Backelin
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

(PROG ()
(SETQ Prime prime)
(SETQ PrPrime (SUB1 Prime))
(SETQ HalfPrime (QUOTIENT Prime 2))
(EVAL (LIST 'LOAD !&!*PRIMAUXFILE))
(COND ((NOT PRIMLIST) (DSKIN !&!*PRLFILE)))
(SETQ PL (PENULTIMA PRIMLIST))
(COND ((EQ (DECIDE1 Prime) 'COMPOSITE)
       (SETQ !&!*DynAnswer Composite!*)
       (RETURN NIL)))

% Doing the job

(SETQ FIRSTPRIMROOT (FirstPrimitiveRoot))
(SETQ EXPVECT (MKVECT (TIMES2 2 Prime)))
(SETQ LOGVECT (MKVECT (TIMES2 2 Prime)))
(MakeEXP!&LOGVECTs (TIMES2 2 Prime))
(RETURN (SETQ !&!*DynAnswer 0))
)
