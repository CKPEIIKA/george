%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%
%  Non-comm module top-of-the-top stuff:                    %
%  Added by SK & VU 96-08-18                                %
% %%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%

%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%
%% Copyright (C) 1996,1997,1999,2003 Svetlana Cojocaru and Victor
%% Ufnarovski
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
(OFF RAISE)

%  Preliminary version. Especially file checking should be
% changed later./JoeB


%	CHANGES:

%  Replaced *NONCOMMUTATIVE by a call to GETRINGTYPE./JoeB 2003-08-25


(GLOBAL '(OutModFile ScInput InModFile !*HSisLoaded !*PBSERIES))

(ON PBSERIES)

(SeriesInit)

(DF MODULEHSERIES (files)
%      (InRingFile  InModFile GbOutFile HsOutFile)
 (PROG (TEMP  GbOutFile HsOutFile !*USERMODE)
    (SETQ ScInput NIL)
    (COND ((EQ (GETRINGTYPE) 'COMMUTATIVE)
                (PRIN2 "*** I turn on noncommutativity")
                (TERPRI)
                (NONCOMMIFY))
    )
    (COND ((NOT !*HSisLoaded)
	   (EVAL (LIST 'LOAD HSERIESFILE!*))
	   (ON HSisLoaded)))
    (ON PBSERIES)
%    (OFF USERMODE)
    (OFF SAVERECVALUES)

    (SETQ LENG (LENGTH files))
    (COND ( (EQ LENG 0)  (ScreenInput) )
          ( (EQ LENG 1) (PRIN2 "***It must be two input files")(TERPRI)
                        (PRIN2 "Input data from the keyboard")(TERPRI)
                        (ScreenInput) )
           ( (EQ LENG 2) ( CheckInput files)  )
           ( (EQ LENG 3) (CheckOutputGB files) (CheckInput files) )
           ( (EQ LENG 4) (CheckOutputGB files)
                         (CheckOutputHs files)
                         (CheckInput files)
          )
    )

    (COND (GbOutFile (DOP GbOutFile) (PrintForAnick)  )
          (T  (DEGREEOUTPREPARE))
    )
    (SETALGOUTMODE ALG)
    (GROEBNERINIT)
    (GROEBNERKERNEL)
    (CALCTOLIMIT MAXDEG)
    (TDEGREEHSERIESOUT MAXDEG)
    (SETQ OLDHILBERTSERIES INVHILBERTSERIES)
    (SETQ TEMP (ASSOC 1 OLDHILBERTSERIES))
    (RPLACD TEMP (PLUS NMODGEN (CDR TEMP)))
    (RENEWSERIES)
    (COND ((NOT ScInput) (DSKIN InModFile))
          (T (PRIN2 "Now input ONLY the module relations:")
             (PRIN2 "    r1, ..., rm;") (TERPRI)
             (PRIN2 "where  r1, ..., rm are the module relations.")
             (TERPRI) (ALGFORMINPUT)
          )
    )
    (GROEBNERKERNEL)
    (GROEBNERFINISH)
    (COND (HsOutFile
           (SETQ OutModFile (OPEN HsOutFile 'OUTPUT))   )
          (T (SETQ OutModFile NIL)   )
    )

    (CALCMODHSERIES OLDHILBERTSERIES)

    (COND (HsOutFile  (CLOSE OutModFile))
    )
 ))

(ON RAISE)

