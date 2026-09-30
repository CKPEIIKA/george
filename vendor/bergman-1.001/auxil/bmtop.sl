%%
%% bmtop.sl %%
%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%
%% Copyright (C) 1992,1994,1996,1998,2001,2002,2003,2005
%% Joergen Backelin
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

%  Added SETMAXDEG./JoeB 2007-08-21

%  Added SETDEGREEWISE and STABILISE./JoeB 2005-08-04 -- 06-08-01.

% Moved the first and last parts of the file to the new files bmhead_psl.sl
% and bmtail_psl.sl, respectively, and made LOAD load but one file at each call,
% for better compatibility with clisp. /JoeB 2005-07-31 -- 08-01

%  Added SETREDUCTIVITY./JoeB 2005-06-25

%  Changed ALGOUTMODE default setting to ALG./JoeB 2005-06-20

%  Added SETQUICKLOWTERMSHANDLING./JoeB 2005-01-22

%  Declared !*OBSOLETENAMESINFORM GLOBAL (instead of FLUID).
% /JoeB 2003-08-28

% Added DEGREVLEXIFY, SETNORESOLUTION. /JoeB 2002-06-26 -- 07-12

%  Added SETRINGOBJECT. /JoeB 2001-08-03

%  PBSERIESFILE!* removed; !*PBSisLoaded --> !*HSisLoaded.
% /JoeB 1999-11-04

%  GETD --> DEFP./JoeB 1999-07-02

%  Re-declared HISTORYLIST!*. Removed ALGOUTMODE./JoeB 1999-06-29

%  Declared more fluids and globals. Added MODULESHSERIESFILE!*.
% /JoeB 1999-06-26

%  Moved MODULEHSERIES to topproc.sl. Added GLOBALs and FLUIDs.
% /Joeb 1998-10-22 -- 10-23

%  Added HSERIESFILE!*, !*HSisLoaded, preliminary version of
% MODULEHSERIES/JoeB 1998-02-28.

%  Added !*Bignums!&Are!&Loaded flag setting in Reduce mode
% /JoeB 1998-02-11.

%  Moved global flag resettings towards end of file/JoeB 1997-01-07.

%  Adopted to `kzz like' architecture handling/JoeB 1996-11-27.

% 1996-08-14: Since "full" now is split into two, both must be loaded.


% To begin with, only the most raw Standard Lisp procedures were
% expexted; whence it is imperative that the file be preceeded by
% some kind of 'header file'.


(FLUID '(!*USERMODE !*REDEFMSG))

(PSL!-SPECIFIC (PROGN
  (OFF USERMODE)
  (OFF REDEFMSG)
%  (OFF GC)
))

(GLOBAL '(SPairs cSPairs GBasis cGBasis InPols cInPols MAXDEG
	  BigNumbFile InumModLimit LogModLimit EMBDIM MAOaux
	  !*Bignums!&Are!&Loaded HSERIESFILE!*
	  !*HSisLoaded MONLIST !&!*InnerEmbDim!&!*
	  ReclaimList NOOFSPOLCALCS NOOFNILREDUCTIONS !*CUSTSHOW
	  !*PBSERIES !*SAVERECVALUES !*POSLEADCOEFFS
	  !*IMMEDIATEFULLREDUCTION !*NOBIGNUM BMVERSIONSTRING
	  !*OBSOLETENAMESINFORM)
)

(FLUID '(HISTORYLIST!* oldoutfi PBoutfi Houtfi oldded))

%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%
%14.08.96 Svetlana Cojocaru, Victor Ufnarovski.
%Respecting the restriction on the FASLOUT output file length (no more
%than 64K) the "full" module was divided into two parts : "full" and "full1".
%It is necessary to load both of them.
%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%

(LOAD "full")		% Main procedures, and extras:
(LOAD  "full1")
(LOAD  "auxil")
% (DSKIN "$bmroot/src/debug.sl") % For development use only.

(COND ((FILEP (MKBMPATHEXPAND "$bmload/alg2lsp.b"))
       (LOAD "alg2lsp"))
      (T (PRIN2 "*** alg2lsp binary does not exists") (TERPRI)))


% User-friendly (?) top-of-the-top:

(OFF RAISE)
(LAPIN (MKBMPATHEXPAND "$bmauxil/topproc.sl"))


% Set-up dependent extra loads, et cetera:

(COND ((FILEP "specbrg2.sl") (LAPIN "specbrg2.sl")))

(OFF RAISE)


% Here is a (hopefully complete) list of file names and file name suffixes
% used by bergman automatic file reading commands. PSL suffixes are not
% added.
%  Some names are identifiers in capitals; these are translated to lower
% case letters by the PSL procedure LOAD.


%	This "should" be the 'locally' most efficient bignum module:
(PSL!-SPECIFIC
  (SETQ BigNumbFile 'ZBIG)
)

%	In reduces, bignums should already be loaded:
(REDUCE!-SPECIFIC
  (PROGN (SETQ BigNumbFile NIL)
	 (ON NOBIGNUM)
	 (ON Bignums!&Are!&Loaded))
)

%(SETQ HSERIESFILE!* "hseries")
(SETQ HSERIESFILE!* (MKBMPATHEXPAND "$bmload/hseries"))
(SETQ MODULESHSERIESFILE!* (MKBMPATHEXPAND "$bmsrc/modhser.sl"))

(SETQ ORDINARYMODULARFILE!* (MKBMPATHEXPAND "$bmsrc/odd.sl"))
(SETQ LOGEXPMODULARFILE!* (MKBMPATHEXPAND "$bmsrc/logodd.sl"))
%(SETQ MODULO2FILE!* "char2")
(SETQ MODULO2FILE!* (MKBMPATHEXPAND "$bmload/char2"))

(PSL!-SPECIFIC
 (SETQ MAKEPRIMEFILE!* (MKBMPATHEXPAND "$bmshells/mkprimefile"))
)
(SETQ PrimeFilePreAmble (MKBMPATHEXPAND "$bmdomains/P"))

% For dynmktab.sl (Dynamic making of 'modular logarithm' tables).
(SETQ !&!*PRIMAUXFILE (MKBMPATHEXPAND "$bmload/primaux"))
(SETQ !&!*PRLFILE (MKBMPATHEXPAND "$bmdomains/PRL"))
(SETQ !&!*DYNAMICMAKELOGTABLEFILE
      (MKBMPATHEXPAND "$bmdomains/dynmktab.sl"))

% The following SHOULD BE SET ARCHITECTURE DEPENDENTLY!
% Regard these settings as default values only.
(SETQ InumModLimit (SUB1 (EXPT 2 15)))
(SETQ InumLogModLimit (SUB1 (EXPT 2 30)))
(SETQ LogModLimit (EXPT 2 20))

% Default SAWS files setting (which may be overruled by assigning
% other values before or after the file loading):
% (SETQ INITPRIORITYSTART 0)
% (SETQ INITPRIORITYSTEPLENGTH 32)
% (SETQ REPRIORITYSTEPLENGTH 16)

% Some flags and modes, default settings/initiations.
% (May be changed by "local.sl" settings, if you wish.)

(ON SAVERECVALUES) (ON POSLEADCOEFFS)
(SETRINGOBJECT)
(SETQUICKLOWTERMSHANDLING)
(SETNORESOLUTION)
(DEGREVLEXIFY)
(COMMIFY)
(CLEARWEIGHTS)
(RESTORECHAR0)
(SETDEGREEWISE)
(STABILISE)
(SETMAXDEG NIL)
(SETCASESENSALGIN T)
(SETALGOUTMODE ALG)
(SETREDUCTIVITY T)

(ON IMMEDIATEFULLREDUCTION)
(ON STANDARDANICKMODES)

(PROGN (RDS (OPEN (MKBMPATHEXPAND "$bmauxil/fullversion") 'INPUT))
       (SETQ BMVERSIONSTRING (READ))
       (CLOSE (RDS NIL)))

% Last chances of interactions;
% e.g., set-up specific flag and mode settings:

(COND ((FILEP "specbrg3.sl") (LAPIN "specbrg3.sl")))


% For possible future use. Patching should be done `globally'.

(COND ((FILEP (MKBMPATHEXPAND "$bmroot/patches.sl"))
       (LAPIN (MKBMPATHEXPAND "$bmroot/patches.sl"))))


% For local modifications:

(COND ((FILEP "local.sl") (LAPIN "local.sl")))


% Restore normal global flags settings.

(ON RAISE)
(ON USERMODE) (ON REDEFMSG)
