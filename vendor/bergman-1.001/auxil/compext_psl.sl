(SETQ TOPLOOPNAME!* "")

%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%
%% Copyright (C) (1992,1994,1995,1996,2002) 2005 Joergen Backelin
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


%%	Created from a copy of compile.sl 2005-06-30 -- 07-01


%	CHANGES:

% To begin with, only the most raw Standard Lisp procedures are
% expexted. Here follows three LAPINs (reading and evaling
% but suppressing printing from entire files).

(ERRORSET
   '(PROG (I!nR!e!a!d)
	  (RDS (OPEN "versmacr.sl" 'INPUT))
	  MAINLOOP
	  (COND ((EQ (SETQ I!nR!e!a!d (READ)) !$EOF!$)
		 (CLOSE (RDS NIL))
		 (RETURN T)))
	  (EVAL I!nR!e!a!d)
	  (GO MAINLOOP) )
    T
    NIL )


(ERRORSET
   '(PROG (I!nR!e!a!d)
	  (RDS (OPEN "specmode.sl" 'INPUT))
	  MAINLOOP
	  (COND ((EQ (SETQ I!nR!e!a!d (READ)) !$EOF!$)
		 (CLOSE (RDS NIL))
		 (RETURN T)))
	  (EVAL I!nR!e!a!d)
	  (GO MAINLOOP) )
    T
    NIL )


(ERRORSET
   '(PROG (I!nR!e!a!d)
	  (RDS (OPEN "specmacr.sl" 'INPUT))
	  MAINLOOP
	  (COND ((EQ (SETQ I!nR!e!a!d (READ)) !$EOF!$)
		 (CLOSE (RDS NIL))
		 (RETURN T)))
	  (EVAL I!nR!e!a!d)
	  (GO MAINLOOP) )
    T
    NIL )



(COND ((FILEP "speccmp1.sl")
       (ERRORSET
	'(PROG (I!nR!e!a!d)
	       (RDS (OPEN "speccmp1.sl" 'INPUT))
	       MAINLOOP
	       (COND ((EQ (SETQ I!nR!e!a!d (READ)) !$EOF!$)
		      (CLOSE (RDS NIL))
		      (RETURN T)))
	       (EVAL I!nR!e!a!d)
	       (GO MAINLOOP) )
	T
	NIL ) ))

(FASLOUT (MKBMPATHEXPAND "$bmload/slext"))
(DSKIN (MKBMPATHEXPAND "$bmsrc/slext.sl"))
(DSKIN (MKBMPATHEXPAND "$bmexe/speclisp.sl"))
(FASLEND)

(QUIT)
