%   General coefficient field (domain) procedures and mode changers.

%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%
%% Copyright (C) 1992,1994,1996,1997,1998,2005 Joergen Backelin
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

%  CHANGES:

%  Included an optional disabling of FAST-INTEGERS, by means of a new
% switch !*PROHIBIT_FASTINTS!&!*./JoeB 2006-08-01

%  Improved handling of the macros GetHalfcMod and GetPredcMod.
% /JoeB 2005-01-06

%  Corrected BIGARITHP. GETD --> DEFP./JoeB 1999-07-02

%  Declared more fluids./JoeB

%  Removed ! within double quotes./JoeB 1998-10-22

%  Added the option SF ( = Reduce Standard Forms) to SETMODULUS;
% and the procedure GETMODULUS./JoeB 1998-07-04.

%  Re-organised mode changing: Moved RESTORECHAR0 definition and
% AddTo!&Char0Lists definition and calls to char0.sl. Moved
% DENSECONTENTS and SPARSECONTENTS to modes.sl.
%  /JoeB 1997-05-22 - 09-17

%  Removed Cf*, Cf!/, CfLinComb, and CfSemiLinComb from
% !&Char0RedefList./JoeB 1997-02-24

%  Added !&!*PRIMAUXFILE as last argument in call to MAKEPRIMEFILE!*.
% /JoeB 1997-01-14

%  Removed irredundancies from the Char0Lists./JoeB 1996-08-09

%  Unified and moved content taking mode changers here./JoeB 1996-07-04

%  Moved RESTORECHAR0 call from SetMod2 to SETMODULUS2/JoeB 1996-06-22

%  Removed spurious AlgTermPrint, AlgFirstTermPrint/Joeb 1996-04-22

% Import: CALLSHELL, PAIRCOPYD, APPENDLCHARTOID; ORDINARYMODULARFILE!*,
%	  LOGEXPMODULARFILE!*, MODULO2FILE!*, MAKEPRIMEFILE!*,
%	  PrimeFilePreAmble, !&!*DYNAMICMAKELOGTABLEFILE.
% Export: DomainInit.
% Available: SETMODULUS, GETMODULUS; !*MODLOGARITHMS, !*NOBIGNUM; (SF).

% Meanings of the variables:
% Ordinary and logarithms - exponent method using full names of the
% modular coefficients files, respectively; Full name of characteristic 2
% file; Coefficient field
% characteristic; Employing modular logarithms - exponents method;

(GLOBAL '(ORDINARYMODULARFILE!* LOGEXPMODULARFILE!* MODULO2FILE!* Modulus
	  !*MODLOGARITHMS !*Mod2IsLoaded!*!* PredModulus HalfModulus
	  Composit!* MAKEPRIMEFILE!* !&!*PRIMAUXFILE MPFError!*
	  PrimeFilePreAmble LOGVECT EXPVECT  BigNumbFile InumModLimit
	  InumLogModLimit LogModLimit !*NOBIGNUM !&!*DYNAMICMAKELOGTABLEFILE
	  !*DYNAMICLOGTABLES !*Bignums!&Are!&Loaded SF !*PROHIBIT_FASTINTS!&!*))

(FLUID '(!*FAST!-INTEGERS))

(COND ((NOT InumModLimit) (SETQ InumModLimit 32767)))
(COND ((NOT InumLogModLimit) (SETQ InumLogModLimit 32767)))
(COND ((NOT LogModLimit) (SETQ LogModLimit 32767)))
(SETQ Composit!* 2031)
(SETQ MPFError!* 537)


% Auxiliaries for big integer (bignum) handling.
(DM BIGARITHP (arrg) '!*Bignums!&Are!&Loaded)



% Initiation, for GROEBNERINIT. Assumes that the domain is well set
% before this, and does not change before GROEBNERKERNEL.
%  The last clause is specific for PSL, and makes the compiler to
% compile <, >, +, - etc as machine instructions for inums (without
% type controls); unless this is repressed by turning on
% PROHIBIT_FASTINTS!&!*.

(DE DomainInit ()
 (PROGN (COND ((AND (NOT !*NOBIGNUM)
		    (OR (NOT Modulus)
			(AND (NUMBERP Modulus)
			     (GREATERP Modulus
				       (COND (!*MODLOGARITHMS InumLogModLimit)
					     (T InumModLimit))))))
	       (COND (BigNumbFile
		      (EVAL (LIST 'LOAD BigNumbFile))
		      (ON Bignums!&Are!&Loaded))))
	      ((NOT !*PROHIBIT_FASTINTS!&!*)
	       (ON FAST-INTEGERS))) ))

% For modular arithmetic:

% REALLY BAD: I have doubled naming conventions and should merge them!
(GLOBAL '(Prime PrPrime HalfPrime Composit!* MPFError Arguments
	  !&!*ASKSTRONG !&!*NEWNUMBER PRIMLIST
	  FIRSTPRIMROOT EXPVECT LOGVECT OutFile
	  !&!*PRIMAUXFILE !&!*PRLFILE))
(FLUID '(!&!*DynAnswer))

%  In order to help a user not to bother with the quote, SF should be
% a constant. (Alternatively, change SETMODULUS to FEXPR!)

(SETQ SF 'SF)

(DE SETMODULUS (prime)
 (PROG	(!*COMP EXV primefile !&!*DynAnswer)
	(COND ((OR (EQN prime 0) (EQ prime NIL))
	       (RESTORECHAR0)
	       (RETURN T))
	      ((EQN prime 2)
	       (SETMODULUS2)
	       (RETURN T))
	      % Option available only in bergman-under-reduce:
	      ((AND (EQ prime 'SF) (DEFP 'SETREDUCESFCOEFFS))
	       (SETREDUCESFCOEFFS)
	       (RETURN T))
	      ((OR (NOT (FIXP prime)) (LESSP prime 2))
	       (GO Err))
	      ((AND !*MODLOGARITHMS (LESSP LogModLimit prime))
	       (OFF MODLOGARITHMS)
	       (PRIN2 "*** New characteristic ")
	       (PRIN2 prime)
	       (PRIN2 " > ")
	       (PRIN2 LogModLimit)
	       (PRIN2 " = LogModLimit;")
	       (TERPRI)
	       (PRIN2 "	thus, MODLOGARITHMS now is turned off.")
	       (TERPRI)))
	(RESTORECHAR0)
	(SETQ Modulus prime)
	(EVAL (LIST 'DM 'GetcMod '(rrg) prime))
	(EVAL (LIST 'DM 'GetHalfcMod '(rrg) (QUOTIENT prime 2)))
	(EVAL (LIST 'DM 'GetPredcMod '(rrg) (SUB1 prime)))
	(ON COMP)
	(COND ((NOT !*MODLOGARITHMS)
	       (LAPIN ORDINARYMODULARFILE!*)
	       (GO End))
	      ((NOT (FILEP (SETQ primefile
				 (APPENDNUMBERTOSTRING prime
						       PrimeFilePreAmble))))
	       (COND ((OR (EVENP prime)
			  (EQ (SETQ EXV (COND (!*DYNAMICLOGTABLES
					       (LAPIN
						!&!*DYNAMICMAKELOGTABLEFILE)
					       !&!*DynAnswer)
					      (T
					       (CALLSHELL
						MAKEPRIMEFILE!*
						(LIST prime
						      Composit!*
						      MPFError!*
						      primefile
						      !&!*PRIMAUXFILE)))))
			      Composit!*))
		      (PRIN2 "*** ") (PRIN2 prime)
		      (PRIN2 " not prime?") (TERPRI)
		      (GO Err))
		     ((EQ EXV MPFError!*)
		      (PRIN2 "*** Error within the ""make prime file"" shell")
		      (TERPRI)
		      (GO Err)))))
	(SETQ PredModulus (SUB1 prime))
	(SETQ HalfModulus (QUOTIENT PredModulus 2))
	(LAPIN primefile)
	(LAPIN LOGEXPMODULARFILE!*)
  End	(RETURN T)
  Err	(ERROR 0 "SETMODULUS given input it can't handle (yet)") ))

(DE GETMODULUS () (PROGN Modulus))

(DE SETMODULUS2 ()
    (COND (!*Mod2IsLoaded!*!*
	   (RESTORECHAR0)
	   (SetMod2))
	  (T % (FILEP MODULO2FILE!*) % Should be a "dressed" test!
	   (EVAL (LIST 'LOAD MODULO2FILE!*))
	   (ON Mod2IsLoaded!*!*)
	   (RESTORECHAR0)
	   (SetMod2))
	  (T (ERROR 0 "No mod 2 file found"))) )


(ON RAISE)
