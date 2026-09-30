%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%
%% Copyright (C) 1992,1994,1998,2004 Joergen Backelin
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

% 2004-05-02: Removed MkMonOne./JoeB

% 1995-06-19: EE --> ee ./JoeB

% 1994-09-08: inx --> pmon .

% Created 1992-03-27.

%  The procedures which use the internal pmon or mon structures should
% be collected here.

% Import: ; !*!&StandardBoundInputMonomial.
% Export: ; .

(OFF RAISE)

(GLOBAL '(niMon niMon1 MAXDEG))

(FLUID '(!*!&StandardBoundInputMonomial))

(DE DegLexTrivObstructionFactor (mon1 mon2)
 (PMon (SETQ !*!&StandardBoundInputMonomial mon1)))

(DE RevLexTrivObstructionFactor (mon1 mon2)
 (PMon (SETQ !*!&StandardBoundInputMonomial
	    (COND ((OR (BMI!= (CAR (PMon mon1)) 0)
		       (BMI!= (CAR (PMon mon2)) 0))
		   mon1)
		  (T
		   (MonInternCopy (CONS (COND ((BMI!< (CAR (PMon mon2))
						      (CAR (PMon mon1)))
					       (BMI!- (CAR (PMon mon1))
						      (CAR (PMon mon2))))
					      (T 0))
					(CDR (PMon mon1)))))))) )

(DE StagTrivObstructionFactor!&LCorOUT (mon1 mon2)
 (PROG	(AA BB CC DD ee FF)
	(SETQ AA (CDR (PMon mon1)))
	(SETQ BB (CDR (PMon mon2)))
	(SETQ CC (CDR niMon))
	(SETQ ee (COND ((BMI!< (CAR (PMon mon1)) (CAR (PMon mon2)))
			(CAR (PMon mon2)))
		       (T (CAR (PMon mon1)))))
	(RPLACA niMon ee)
  Ml	(COND ((EQ (CAR AA) 0)
	       (SETQ DD (CAR BB)))
	      ((EQ (CAR BB) 0)
	       (SETQ DD (CAR AA)))
	      ((BMI!< (CAR AA) (CAR BB))
	       (SETQ DD (CAR BB))
	       (SETQ FF T))
	      ((SETQ FF T)
	       (SETQ DD (CAR AA))))
	(SETQ ee (BMI!+ ee DD))
	(RPLACA CC DD)
	(COND ((SETQ CC (CDR CC))
	       (SETQ AA (CDR AA))
	       (SETQ BB (CDR BB))
	       (GO Ml)))
	(COND ((AND MAXDEG (BMI!< MAXDEG ee))
	       (RETURN NIL)))
	(niMonQuotient niMon (PMon mon2))
	(COND ((NOT FF)
	       (SETQ AA (PMon (SETQ !*!&StandardBoundInputMonomial
				   (MonInternCopy niMon1))))
	       (RETURN (CONS AA (CONS NIL (CONS ee AA)))))
	      ((AND MAXDEG (BMI!< MAXDEG
			       (BMI!+ (TOTALDEGREE (CDR (PMon mon1)))
				   (TOTALDEGREE (CDR (PMon mon2)))
				   (CAR AA))))
	       (RETURN (LIST niMon1 niMon ee))))
%	(SETQ BB (LISTCOPY niMon))
	(SETQ !*!&StandardBoundInputMonomial
	      (COND ((OR (BMI!= (CAR (PMon mon1)) 0)
			 (BMI!= (CAR (PMon mon2)) 0))
		     mon1)
		    (T
		     (MonInternCopy (CONS (BMI!- (CAR niMon) (CAR (PMon mon2)))
					  (CDR (PMon mon1)))))))
	(RETURN (CONS niMon1
		      (CONS niMon
			    (CONS ee
				  (PMon !*!&StandardBoundInputMonomial))))) ))

(DE StagLCorOUT (mon1 mon2)
 (PROG	(AA BB CC DD ee FF)
	(SETQ AA (CDR (PMon mon1)))
	(SETQ BB (CDR (PMon mon2)))
	(SETQ CC (CDR niMon))
	(SETQ ee (COND ((BMI!< (CAR (PMon mon1)) (CAR (PMon mon2)))
			(CAR (PMon mon2)))
		       (T (CAR (PMon mon1)))))
	(RPLACA niMon ee)
  Ml	(COND ((EQ (CAR AA) 0)
	       (SETQ DD (CAR BB)))
	      ((EQ (CAR BB) 0)
	       (SETQ DD (CAR AA)))
	      ((BMI!< (CAR AA) (CAR BB))
	       (SETQ DD (CAR BB))
	       (SETQ FF T))
	      ((SETQ FF T)
	       (SETQ DD (CAR AA))))
	(SETQ ee (BMI!+ ee DD))
	(RPLACA CC DD)
	(COND ((SETQ CC (CDR CC))
	       (SETQ AA (CDR AA))
	       (SETQ BB (CDR BB))
	       (GO Ml)))
	(COND ((AND FF (NOT (AND MAXDEG (BMI!< MAXDEG ee))))
	       (RETURN (CONS (niMonQuotient niMon (PMon mon2))
			     (CONS niMon ee))))) ))

% Note that this returns a monomial!!!

(DE MONQUOTIENT (pmon1 pmon2) (MonInternCopy (niMonQuotient pmon1 pmon2)))

(DE MonInternCopy (pmon)
 (PROG	(AA BB CC)
	(SETQ AA pmon)
	(SETQ BB MONLIST)
  Ml	(SETQ CC (CAR AA))
  Rl	(COND ((OR (NOT (CDR BB)) (MonIntPrecedence (CAADR BB) CC))
	       (RPLACD BB (CONS (NCONS CC) (CDR BB)))
	       (GO MkNew))
	      ((NOT (EQ CC (CAADR BB)))
	       (SETQ BB (CDR BB))
	       (GO Rl))
	      ((SETQ AA (CDR AA))
	       (SETQ BB (CADR BB))
	       (GO Ml)))
	(RETURN (CDADR BB))
  MkNew	(SETQ BB (CADR BB))
	(COND ((SETQ AA (CDR AA))
	       (RPLACD BB (NCONS (NCONS (CAR AA))))
	       (GO MkNew)))
	(RPLACD BB (PMon2NewMon (LISTCOPY pmon)))
	(RETURN (CDR BB)) ))

(DE RemPairFromMon (itm mon)
 (PROG	(AA BB)
	(SETQ BB (SETQ AA (GETMONAUGPROP mon 'Pairs)))
  Ml	(COND ((NOT (EQ (CADR BB) itm))
	       (SETQ BB (CDR BB))
	       (GO Ml)))
	(RPLACD BB (CDDR BB))
	(COND ((NOT (CDR AA))
	       (REMMONPROP mon 'Pairs))) ))

(DE StgMonDegLexify ()
 (PROGN	(COPYD 'TrivObstructionFactor 'DegLexTrivObstructionFactor)
	))

(DE StgMonRevLexify ()
 (PROGN	(COPYD 'TrivObstructionFactor 'RevLexTrivObstructionFactor)
	))
