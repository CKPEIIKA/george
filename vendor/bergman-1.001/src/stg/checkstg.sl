%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%
%% Copyright (C) 1992,1996,1998,2003 Joergen Backelin
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

%  Moved APPLYIFDEF0 to slext.sl./JoeB 1996-09-02

% Replaced !*NONCOMMUTATIVE by a call to NonCommP./JoeB 2003-08-28

% Created 92-03-29.

%  Takes care of the additional mode checking necessary in the stagger case.
% May be made unneccessary later, by integrating the routines with the ordinary
% bergman.

(OFF RAISE)

(GLOBAL '(commMONORDER STAGORDINARYMODULARFILE!*
	  STAGLOGEXPMODULARFILE!* STAGMODULO2FILE!* Modulus
	  !*MODLOGARITHMS !*Mod2IsLoaded!*!* PredModulus HalfModulus
          Composit!* MAKEPRIMEFILE!* MPFError!* PrimeFilePreAmble
          LOGVECT EXPVECT  BigNumbFile InumModLimit InumLogModLimit
          LogModLimit !*SAVEACCIDENTALREDUCIBILITYINFO))

(DE STAGTYPECHECKER ()
 (PROGN	(COND ((NonCommP)
	       (APPLYIFDEF0 '(GMNonCommify)))
	      ((EQ (GETCOMMORDER) 'TDEGREVLEX)
	       (APPLYIFDEF0 '(StgMonRevLexify GMCommify)))
	      (T
	       (APPLYIFDEF0 '(StgMonDegLexify GMCommify))))
	(COND ((OR (NOT Modulus) (EQ Modulus 0))
	       (APPLYIFDEF0 '(StgChar0ify)))
	      ((EQ Modulus 2)
	       (APPLYIFDEF0 '(StgChar2ify)))
	      ((EQ Modulus 'SF)
	       (APPLYIFDEF0 '(StgSFify)))
	      (!*MODLOGARITHMS
	       (APPLYIFDEF0 '(StgCharOddWithLogsify)))
	      (T
	       (APPLYIFDEF0 '(StgCharOddify))))
	(COND (!*SAVEACCIDENTALREDUCIBILITYINFO
	       (APPLYIFDEF0 '(LeadMonFactorInfoSave)))
	      (T
	       (APPLYIFDEF0 '(LeadMonFactorInfoUnsave))))
 ))

(DE LeadMonFactorInfoSave ()
 (PROGN	(COPYD 'MarkAccidentalReducible 'SaveMarkAccidentalReducible)
	(COPYD 'AccidentalReducibleLeadMon 'SavedAccidentalReducibleLeadMon) ))

(DE LeadMonFactorInfoUnsave ()
 (PROGN	(COPYD 'MarkAccidentalReducible 'GeneralMarkAccidentalReducible)
	(COPYD 'AccidentalReducibleLeadMon
	       'GeneralAccidentalReducibleLeadMon) ))

(ON RAISE)
