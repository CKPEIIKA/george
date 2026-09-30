(SETQ TOPLOOPNAME!* "")

%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%
%% Copyright (C) 1992,1994,1995,1996,2002,2005 Joergen Backelin
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

% Added syzmod.sl./ufn 07-08-2006

%  Moved first instructions to new header./JoeB 2005-06-30 -- 07-01

% dialogue added./JoeB 2004-04-17

% hscomm added./JoeB 2002-10-12

%  pbseries removed./JoeB 1999-11-04

%  modinout.sl, modes.sl added/JoeB 1997-09-17

%  The architecture handling adopted to `kzz type'/JoeB 1996-11-26.

%14.08.96 Svetlana Cojocaru, Victor Ufnarovski
%The module "full" is divided into two parts to respect the restriction
%on the length of a FASLOUT output file - no more than 64K.
%The module sermul.sl is included additionaly (series multiplication).


(LAPIN (MKBMPATHEXPAND "$bmsrc/macros.sl"))
(OFF RAISE)
(RECLAIM)

% modes.sl contains some macro definitions used later; thus
% compile it first!

(GROUPCOMP (MKBMPATHEXPAND "$bmload/full"))
% (OFF USERMODE)
(ITEMCOMP "$bmsrc/modes.sl")
(ITEMCOMP "$bmsrc/main.sl")
(ITEMCOMP "$bmsrc/inout.sl")
(ITEMCOMP "$bmsrc/monom.sl")
(ITEMCOMP "$bmsrc/ncmonom.sl")
(ITEMCOMP "$bmsrc/normwd.sl")
(ITEMCOMP "$bmsrc/reclaim.sl")
(ITEMCOMP "$bmsrc/polynom.sl")
(ITEMCOMP "$bmsrc/reduct.sl")
(FASLEND)
(RECLAIM)

%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%
%14.08.96 Svetlana Cojocaru, Victor Ufnarovski
%The module "full" is divided into two parts to respect the restriction
%on the length of a FASLOUT output file - no more than 64K.
%The module sermul.sl is included additionaly (series multiplication).
%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%

(GROUPCOMP (MKBMPATHEXPAND "$bmload/full1"))
(ITEMCOMP "$bmsrc/coeff.sl")
(ITEMCOMP "$bmsrc/char0.sl")
(ITEMCOMP "$bmsrc/strategy.sl")
(ITEMCOMP "$bmsrc/dialogue.sl")
(ITEMCOMP "$bmsrc/syzmod.sl")
(FASLEND)
(RECLAIM)

% Compilation of auxiliary units:

% Removed 1999-11-04, since pbseries now is subsumed in hseries./JoeB
%(FASLOUT (MKBMPATHEXPAND "$bmload/pbseries"))
%(DSKIN (MKBMPATHEXPAND "$bmsrc/pbseries.sl"))
%(FASLEND)
%(RECLAIM)

(COND ((FILEP (MKBMPATHEXPAND "$bmexe/alg2lsp.sl"))
       (GROUPCOMP (MKBMPATHEXPAND "$bmload/alg2lsp"))
       (ITEMCOMP "$bmexe/alg2lsp.sl")
       (FASLEND)
       (RECLAIM))
      (T
       (PRIN2 "*** I could not find alg2lsp.sl; hope it's OK")
       (TERPRI)))

(GROUPCOMP (MKBMPATHEXPAND "$bmload/char2"))
(ITEMCOMP "$bmsrc/char2.sl")
(FASLEND)
(RECLAIM)

% Extras (under development):
(GROUPCOMP (MKBMPATHEXPAND "$bmload/auxil"))
(ITEMCOMP "$bmsrc/auxil.sl")
(ITEMCOMP "$bmsrc/homog.sl")
(FASLEND)
(RECLAIM)

% Staggering substantial stuff:
% (OFF REDEFMSG) (OFF USERMODE) (ON GC)
(LAPIN (MKBMPATHEXPAND "$bmsrc/stg/accmacr.sl"))
(LAPIN (MKBMPATHEXPAND "$bmsrc/stg/subsmacr.sl"))
(LAPIN (MKBMPATHEXPAND "$bmsrc/stg/midmacr.sl"))
(OFF RAISE)
% (ON REDEFMSG)
(GROUPCOMP (MKBMPATHEXPAND "$bmload/stg"))
(ITEMCOMP "$bmsrc/stg/checkstg.sl")
(ITEMCOMP "$bmsrc/stg/accproc.sl")
(ITEMCOMP "$bmsrc/stg/subsproc.sl")
(ITEMCOMP "$bmsrc/stg/stg.sl")
(ITEMCOMP "$bmsrc/stg/monomstg.sl")
(ITEMCOMP "$bmsrc/stg/bind.sl")
(ITEMCOMP "$bmsrc/stg/write.sl")
(ITEMCOMP "$bmsrc/stg/ideal.sl")
(FASLEND)
(RECLAIM)

%  New July and August 1996:
(LAPIN (MKBMPATHEXPAND "$bmsrc/hmacro.sl"))
(GROUPCOMP (MKBMPATHEXPAND "$bmload/hseries"))
(ITEMCOMP "$bmsrc/hseries.sl")
(ITEMCOMP "$bmsrc/hscomm.sl")
(ITEMCOMP "$bmsrc/modinout.sl")
(ITEMCOMP "$bmsrc/sermul.sl")
(FASLEND)
(RECLAIM)

% Set-up dependent compilation demands, et cetera.

(COND ((FILEP (MKBMPATHEXPAND "$bmexe/speccmp2.sl"))
       (LAPIN (MKBMPATHEXPAND "$bmexe/speccmp2.sl"))))
