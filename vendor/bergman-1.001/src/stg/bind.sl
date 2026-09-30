%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%
%% Copyright (C) 1992,1994,1998 Joergen Backelin
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



%  CHANGES:

% 1994-09-08: inx --> pmon .

% Created 1992-03-01.

(OFF RAISE)

(GLOBAL '(!&!*InnerEmbDim!&!* niMon niTreeMon !*!&BindPositionMax
	  !*!&StandardBindPosition !*!&StandardBindPMonVector
	  !*!&StandardBindTreeVector
	  !*!&AlternativeBindPosition !*!&AlternativeBindPMonVector
	  !*!&AlternativeBindTreeVector))

(DE BindInit ()
 (PROGN (SETQ !*!&BindPositionMax (SUB1 !&!*InnerEmbDim!&!*))
	(SETQ !*!&StandardBindPMonVector (MKVECT !*!&BindPositionMax))
	(SETQ !*!&StandardBindTreeVector (MKVECT !*!&BindPositionMax))
	(SETQ !*!&AlternativeBindPMonVector (MKVECT !*!&BindPositionMax))
	(SETQ !*!&AlternativeBindTreeVector (MKVECT !*!&BindPositionMax))
	(SETQ niTreeMon (NCONS NIL))
	))

(DE StandardBindPMon!&Tree (pmon tmon)
 (PROG	(AA)
	(InitStandardBindPosition)
	(SETQ AA pmon)
  Ml	(PutStBPMon (CAR AA))
	(COND ((StBRight)
	       (InitStandardBindPosition)
	       (PutStBTree tmon)
	       (RETURN NIL)))
	(SETQ !*!&StandardBindPosition (ADD1 !*!&StandardBindPosition))
	(SETQ AA (CDR AA))
	(GO Ml) ))

% Interning leaves of our trees could be done smartly. This is a preliminary,
% 'structured' and thus slower approach.

%(DE VECT2LIST (vec)
% (PROG	(AA BB CC DD)
%	(SETQ AA (SETQ CC (NCONS (GETV vec (SETQ BB 0)))))
%	(SETQ DD (UPBV vec))
%  Ml	(COND ((BMI!= BB DD)
%	       (RETURN AA)))
%	(RPLACD CC (NCONS (GETV vec (SETQ BB (ADD1 BB)))))
%	(SETQ CC (CDR CC))
%	(GO Ml) ))

(DE Vect2niMon (vec)
 (PROG	(AA BB)
	(SETQ AA niMon)
	(SETQ BB 0)
	Ml
	(RPLACA AA (GETV vec BB))
	(COND ((SETQ AA (CDR AA))
	       (SETQ BB (ADD1 BB))
	       (GO Ml))) ))

(DE StBPMonIntern ()
 (PROGN (Vect2niMon !*!&StandardBindPMonVector) (niMonIntern)))

(DE AltBPMonIntern ()
 (PROGN (Vect2niMon !*!&AlternativeBindPMonVector) (niMonIntern)))

(ON RAISE)
