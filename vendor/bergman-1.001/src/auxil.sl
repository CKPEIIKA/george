%	Auxiliary procedures for 'odd purposes'.
%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%
%% Copyright (C) 1992,1994,1995,1996,1997,1999,2002,2004,2006
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

%  CHANGES:

% 2006-08-07: Modernised INPOLS2GBASIS; which now also returns T if
% successful./JoeB

% 2004-04-28 -- 05-11: Added ALERTCHAN handling./JoeB

% 2002-10-11: '(LAMBDA ...) --> (FUNCTION (LAMBDA ...))./JoeB

% 1999-07-04: FlushChannel --> FLUSHCHANNEL./JoeB

% 1997-11-04: Added [GET/SET]CURRENTDEGREE./JoeB

% 1997-09-17: Moved weights handling to modes.sl./JoeB

% 1996-08-30: COPYLIST corrected to LISTCOPY./JoeB

% 1996-04-22: Call AlgPureMonPrint instead of AlgFirstTermPrint/JoeB


(OFF RAISE)

% This contains various extra routines, which may be employed in order to
% utilise the groebner programme for slightly different purposes.

% Imports: Everything.
% Exports: Nothing..... Well, !&!#ErrAlertChan!*.
% Available: INPOLS2GBASIS, FINDALLCRITPAIRS, DEGREELMOUTPUT,
%	     GETCURRENTDEGREE, SETCURRENTDEGREE.

(GLOBAL '(InPols GBasis MINDEG MAXDEG cDeg !*!#EACImmediateClose))

(FLUID '(!&!#ErrAlertChan!*))


% Set or unset the !&!#ErrAlertChan!*.

%# ALERTCHAN (string) : - ;
(DE ALERTCHAN (errfile)
 (COND ((NOT errfile)
	(COND (!&!#ErrAlertChan!*
	       (CLOSE !&!#ErrAlertChan!*)))
	(SETQ !&!#ErrAlertChan!* NIL))
       (T
	(SETQ !&!#ErrAlertChan!* (OPEN errfile 'OUTPUT)))) )

%# GETALERTCHAN () ; genany
(DE GETALERTCHAN () (PROGN !&!#ErrAlertChan!*))

%# SETDIRECTALERTCLOSING (bool) : bool ;
%# GETDIRECTALERTCLOSING () : bool ;
(DefineGSSF DIRECTALERTCLOSING !#EACImmediateClose)

%(DE SETDIRECTALERTCLOSING (status)
% (PROG	(rt)
%	(SETQ rt (GETDIRECTALERTCLOSING))
%	(COND (status (ON !#EACImmediateClose))
%	      (T (OFF !#EACImmediateClose)))
%	(RETURN rt) ))
%
%(DE GETDIRECTALERTCLOSING () (PROGN !*!#EACImmediateClose) )

%  PROG variables: ReTurn value; old OutputChannel; modified Close Status.

%# FILEALERT (string id) : bool ;
(DE FILEALERT (msg closestatus)
 (PROG	(rt oc cs)
	(COND ((EQ closestatus 'MAYBE)
	       (SETQ cs (GETDIRECTALERTCLOSING)))
	      (T (SETQ cs closestatus)))
	(SETQ rt (NOT (NOT !&!#ErrAlertChan!*)))
	(COND (!&!#ErrAlertChan!* (SETQ oc (WRS !&!#ErrAlertChan!*))))
	(PRIN2 msg)
	(TERPRI)
	(COND ((AND !&!#ErrAlertChan!* cs)
	       (CLOSE (WRS oc))
	       (SETQ !&!#ErrAlertChan!* NIL))
	      (!&!#ErrAlertChan!*
	       (WRS oc)
	       (FLUSHCHANNEL !&!#ErrAlertChan!*)))
	(RETURN rt) ))


% If a gbasis is read in (as InPols), it is moved to GBasis.
% You then may make a new input, and start reduccing.

%% (DE INPOLS2GBASIS ()
%%  (PROG	(AA BB CC)
%% 	(SETQ AA InPols)
%% 	(SETQ GBasis (NCONS NIL))
%% 	(SETQ CC GBasis)
%%   Ml	(SETQ BB (CDAR AA))
%%   Sl	(RPLACD CC (NCONS (CAR BB)))
%% 	(SETQ CC (CDR CC))
%% 	(Redand2Redor (CAR CC))
%% 	(RPLACA (CAR CC) (LENGTH (CDAR CC))) % Bad: priority setting.
%% 	(RPLACA (CDADAR CC) (NCONS (CAR CC)))
%% 	(RPLACA CC (CDADAR CC))
%% 	(COND ((SETQ BB (CDR BB))
%% 	       (GO Sl))
%% 	      ((SETQ AA (CDR AA))
%% 	       (GO Ml)))
%% 	(SETQ InPols NIL) ))

%  An alternative, old, from stg.sl. Perhaps a compromise best?

% (DE FORMALINPUT2GBASIS ()
%  (PROGN (PutLeadMonPtrsinPolDegList InPols)
%	(SETQ GBasis (CONS NIL (PolList2LeadMonList (DEGLIST2LIST InPols)))) ))

%  Improved, better modularised, macrotic version 2006-08-07/JoeB.
%  Now returns T if successful (while returning NIL and doing nothing,
% if InPols is empty).
%  Meaning of PROG variables: (possible re-listed) Input Position;
% GBasis Position.

%# INPOLS2GBASIS () : bool ;
(DE INPOLS2GBASIS ()
 (PROG	(ip gbp)
	(COND ((NOT (SETQ ip (DEGORITEMLIST2LIST InPols)))
	       (RETURN NIL)))
	(SETQ gbp (SETQ GBasis (NCONS NIL)))
  Ml	(RPLACD gbp (NCONS (CAR ip)))
	(SETQ gbp (CDR gbp))
	(Redand2Redor (CAR gbp))
	(PutredPriority (CAR gbp)
			(CALCREDUCTORPRIORITY (CAR gbp)))
	(PutMpt (Lm (CAR gbp)) (CAR gbp))
	(RPLACA gbp (Lm (CAR gbp)))
	(COND ((SETQ ip (CDR ip))
	       (GO Ml)))
	(SETQ InPols NIL)
	(RETURN T) ))


% Calculate and save critical pairs, in degrees from MINDEG to MAXDEG
% inclusive. (Defaults are: No boundaries. If specified, the first
% argument is MINDEG and the second is MAXDEG. Value not given or =T
% indicates: Use the global values.

(DF FINDALLCRITPAIRS (bounds)
 (PROG	(lowbound highbound Gbpos1 Gbpos2 tmp)
	(COND ((AND (PAIRP bounds) (NUMBERP (SETQ tmp (EVAL (CAR bounds)))))
	       (SETQ lowbound tmp))
	      (T
	       (SETQ lowbound MINDEG)))
	(COND ((AND (PAIRP bounds)
		    (PAIRP (CDR bounds))
		    (NUMBERP (SETQ tmp (EVAL (CADR bounds)))))
	       (SETQ highbound tmp))
	      (T
	       (SETQ highbound MAXDEG)))
	(SETQ Gbpos1 GBasis)
 ))


% Like DEGREEOUTPUT, but only prints the leading monomials.

(DE DEGREELMOUTPUT NIL
 (PROG	(cChan)
	(COND
	 ((NOT (CDR cGBasis)) (RETURN NIL)))
	(SETQ cChan (WRS GBasOutChan))
	(PRIN2 "% ") (PRINT cDeg)
	(MAPC (CDR cGBasis) (FUNCTION (LAMBDA (xxayy)
					      (AlgPureMonPrint xxayy)
					      (TERPRI))))
	(TERPRI)
	(COND (GBasOutChan (FLUSHCHANNEL GBasOutChan)))
	 (WRS cChan) ))


(DE GETCURRENTDEGREE () cDeg)

(DE SETCURRENTDEGREE (n)
 (COND ((AND n (OR (NOT (FIXP n)) (LESSP n 0)))
	(ERROR 99
	  "Bad input to SETCURRENTDEGREE: not a non-negative integer or NIL"))
       (T
	(SETQ cDeg n))))

(ON RAISE)
