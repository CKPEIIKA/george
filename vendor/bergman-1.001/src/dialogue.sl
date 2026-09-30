% General interactive dialogue and help procedures.
%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%
%% Copyright (C) 1999,2003,2004,2005 Joergen Backelin
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

%	Created 2003 from scratch; but later QuizIds!*
%	and OneOfAskRead (written 1999) were moved here.
%	First version integrated with bergman: 2004-04-17.


%	CHANGES:

%  Added!&Char0RedefList!* and !&Char0RemdList!* to INTERNALLISTS.
% /JoeB 2006-08-05

%  Added !$!#ProcessingGbes!#!* to INTERNALLISTS./JoeB 2005-08-04

%  <Starting to extend dialogue>

%  Added HELPFROMFILES, RESPOND,!&!*DialogueHelpHelpString!&!*,
% !&!*DialogueLoopHelpString!&!*, !&!*DialogueBreakHelpString!&!*,
% !&!*DialogueSkipHelpString!&!*, !&!*DialogueHelpStrings!&!*,
% LoopIds!*, SkipItemIds!*./JoeB 2005-01---

%  Added QuizIdP. Changed some !$!&InternalList!#!* item names.
% /JoeB 2004-05-02

% Import: ...
%	  and the !$!&InternalList!#!* CDRs.

% Export: QuizIdP, OneOfAskRead;
%	  QuizIds!*.

% Available: DIALOGUE, RESPOND, HELPPRINT, GETHELPFILE, SETHELPFILE,
%	     HELPFROMFILES, INTERNALLIST.

(OFF RAISE)

(FLUID '(PROMPTSTRING!*))

(GLOBAL '(QuizIds!* BreakIds!*
	  LoopIds!* SkipItemIds!*
	  SimpleDialogue QuestionDialogue
	  !&!*DialogueHelpHelpString!&!*
	  !&!*DialogueLoopHelpString!&!*
	  !&!*DialogueBreakHelpString!&!*
	  !&!*DialogueSkipHelpString!&!*
	  !&!*DialogueHelpStrings!&!*
	  !*!&ObjectKinds!#
	  !&!*HelpStopChar!&!* !&!*HelpFile!&!*
	  !&!*HelpNAInfoString!&!*
	  !$!&InternalLists!#!*))



% Global variables settings.

(SETQ !$!&InternalLists!#!*
      '((HELPSTRINGS . QuizIds!*)
	(LISTS . !$!&InternalLists!#!*)
	(MODES . !$!&ListOfModes!#!*)
	(MODECLASHES . !$!&ClashList!#!*)
%	(OBJECTTYPES . !#!&ObjectType)
	(RESOLUTIONTYPESS . !$!&ResolutionTypes!#!*)
	(RINGTYPES . !$!&RingTypes!#!*)
	(STRATEGIES . !$!&Strategies!#!*)
	(PROCESS . !$!#ProcessingGbes!#!*)
	(CHAR0PROCEDURES . !&Char0RedefList!*)
	(OTHERCOEFFSPROCEDURES . !&Char0RemdList!*)))

(SETQ QuizIds!* '(!? HELP help Help hELP H h))

(SETQ BreakIds!* '(BREAK break Break bREAK B b !))
(SETQ B 'B)   (SETQ b 'b)

(SETQ LoopIds!* '(L l LOOP loop Loop lOOP LISP lisp Lisp lISP))

(SETQ SkipItemIds!* '(S s SKIP skip Skip sKIP))

(SETQ !*!&ObjectKinds!# '(GRC NGRC GRNC NGRNC))

(COND ((NOT !&!*HelpStopChar!&!*)
       (SETQ !&!*HelpStopChar!&!* '!)))

(COND ((NOT !&!*HelpFile!&!*)
       (SETQ !&!*HelpFile!&!* "$bmroot/doc/helptexts")))

(COND ((NOT !&!*HelpNAInfoString!&!*)
       (SETQ !&!*HelpNAInfoString!&!*
	     "*** No help found for ")))

%# QuizIdP (any) : bool ;
(DE QuizIdP (inp)
 (OR (MEMQ inp QuizIds!*)
     (AND (PAIRP inp)
	  (OR (MEMQ (CAR inp) QuizIds!*)
	      (MEMQ (CDR inp) QuizIds!*)
	      (AND (PAIRP (CDR inp))
		   (MEMQ (CADR inp) QuizIds!*))))) )

%# OneOfAskRead (lany) : sexpr ;
(DE OneOfAskRead (lid)
 (PROG	(ip)
	(COND ((NOT (SETQ ip lid))
	       (PRIN2 "(No alternatives exist?)")
	       (TERPRI)
	       (RETURN NIL)))
	(PRIN2 " - One of the following: ")
  Ml	(PRIN2 (COND ((PAIRP ip) (CAR ip))
		     (T ip)))
	(COND ((AND (PAIRP ip) (SETQ ip (CDR ip)))
	       (PRIN2 ", ")
	       (GO Ml)))
	(TERPRI)
	(RETURN (PROMPTREAD "?? > ")) ))

%  The main user interface dialogue procedure.
% Could be used in an ERRORSET, in order to create a
% new top-loop for bergman in general, or for some
% special situations.

%# DIALOGUE (id,...) : bool ; FEXPR 
(DF DIALOGUE (names)
 (PROG	(rt PROMPTSTRING!* bod) % Beginning of dialogue
	% Check if names is a pair, and in so if its CAR evals to a
	% file-name. If so, process this file! Else,
	(COND ((FILEP "startup")
	       (ERRORSET '(LAPIN "startup") T NIL)))
	(SETQ PROMPTSTRING!* "dialogue> ")
	(SETQ bod T)
  Fl	(COND ((AND (PAIRP (SETQ rt (ERRORSET '(Dialogue1) T NIL)))
		    (MEMQ (CAR rt) BreakIds!*))
	       (RETURN T))
	      ((AND (PAIRP rt) (EQ (CAR rt) 'SimpleDialogue))
	       (GO Sl)))
	(GO Fl)
  Sl	(COND ((AND (PAIRP (SETQ rt (ERRORSET '(Dialogue2) T NIL)))
		    (MEMQ (CAR rt) BreakIds!*))
	       (RETURN T))
	      ((AND (PAIRP rt) (EQ rt 'QuestionDialogue))
	       (GO Fl)))
	(GO Sl)
	(RETURN T) ))

%  Auxiliaries to DIALOGUE.

%# Dialogue1 () : id
(DE Dialogue1 ()
 (PROG	(rt)
	% (SETQ PROMPTSTRING!* "? ")
  Ml	(TERPRI)
	(PRIN2 "What kinds of objects do you plan to work with?")
	(TERPRI)
	(SETQ rt (OneOfAskRead !*!&ObjectKinds!#))
	(COND ((EQ rt 'GRC)
	       (COMMIFY)
	       (CLEARHOMOGENISATION))
	      ((EQ rt 'NGRC)
	       (COMMIFY)
	       (ON HOMOGENISATION))
	      ((EQ rt 'GRNC)
	       (NONCOMMIFY)
	       (CLEARHOMOGENISATION))
	      ((EQ rt 'NGRNC)
	       (NONCOMMIFY)
	       (ON HOMOGENISATION))
	      ((MEMQ rt BreakIds!*)
	       (RETURN rt))
	      ((MEMQ rt QuizIds!*)
	       (RESPOND !&!*DialogueHelpStrings!&!*)
	       (GO Ml))
	      ((AND (PAIRP rt) (PAIRP (CDR rt)) (MEMQ (CAR rt) QuizIds!*))
	       (HELPFROMFILES (CADR rt) NIL -1)
	       (GO Ml))
	      ((NOT (MEMQ rt LoopIds!*))
	       (PRIN2 "Your input ")
	       (PRIN2 rt)
	       (PRIN2 " is bad. (In order to leave the dialogue, write break.)")
	       (PRIN2 "Try again:")
	       (GO Ml)))
	(PRINT "About to leave Dialogue1")
	(RETURN 'SimpleDialogue) ))


%# Dialogue2 () : any
(DE Dialogue2 ()
 (PRINT (EVAL (READ))) )

%  Print each element in a set of message strings or of lists of
% printable objects, separated by newlines.
% The list items may also be atoms, evaluating to printable objects;
% or lists of elements evaluable to printable objects. I the latter case,
% such objects are printed space separated.

%# RESPOND (lany) : bool ;
(DE RESPOND (MsgStrngs)
 (PROG	()
  Ml	(COND ((PAIRP MsgStrngs)
	       (COND ((ATOM (CAR MsgStrngs))
		      (PRIN2 (EVAL (CAR MsgStrngs))))
		     (T
		      (PRIN2 (CONSTANTLIST2STRING (EVLIS (CAR MsgStrngs))))))
	       (TERPRI)
	       (SETQ MsgStrngs (CDR MsgStrngs))
	       (GO Ml))) ))

% Dialogue help string settings. (Should it be done by user
% available procedures?)

(SETQ !&!*DialogueHelpHelpString!&!*
 " ** For help on an item <foo>, type  (HELP <foo>)")

(SETQ !&!*DialogueLoopHelpString!&!*
 " ** For entering a Lisp loop, type  LOOP")

(SETQ !&!*DialogueBreakHelpString!&!*
 " ** For exiting the dialogue, type  BREAK")

(SETQ !&!*DialogueSkipHelpString!&!*
 " ** For skipping a dialogue item, type SKIP")

(SETQ !&!*DialogueHelpStrings!&!*
 '(!&!*DialogueHelpHelpString!&!* % !&!*DialogueSkipHelpString!&!*
   !&!*DialogueBreakHelpString!&!* !&!*DialogueLoopHelpString!&!*))


% Help text reader main procedures.

%  Given a (possibly transformed) help item and an (existing)
% file, search the latter for an initial occurence of the
% latter. If found, print the text following it. If not, and
% the third argument is true, then inform on the failure.

% Meaning of PROG variables: Input Channel;
% last read Character or Word.

%# HelpSearchPrint ( id, string, bool ) : bool ;
(DE HelpSearchPrint (Itm Fil FailInf)
 (PROG	(ic cw !*RAISE)
	(SETQ ic (RDS (OPEN Fil 'INPUT)))
	(ON RAISE)
  ML	(COND ((EQ (SETQ cw (READ)) !$EOF!$)
	       (RDS ic)
	       (RETURN (COND (FailInf (NoHelpFound Itm)))))
	      ((EQUAL cw Itm)
	       (OFF RAISE)
	       (GO PL)))
  SL	(COND ((EQ (SETQ cw (READCH)) !&!*HelpStopChar!&!*)
	       (GO ML))
	      ((NOT (EQ cw !$EOF!$))
	       (GO SL)))
	(RDS ic)
	(RETURN (COND (FailInf (NoHelpFound Itm))))
  PL	(COND ((NOT (EQ (SETQ cw (READCH)) !&!*HelpStopChar!&!*))
	       (PRINC cw)
	       (GO PL)))
	(RDS ic)
	(RETURN T) ))

%# NoHelpFound (id) : - ;
(DE NoHelpFound (Itm)
 (PROGN	(TERPRI)
	(PRIN2 !&!*HelpNAInfoString!&!*)
	(PRIN2 Itm)
	(TERPRI)
	() ))

% Non-checking, non-flexible, to get things going:

%# HELPPRINT (uip) : bool ; FEXPR
(DF HELPPRINT (U)
 (HelpSearchPrint (CAR U) !&!*HelpFile!&!* T) )

% Auxiliaries for customising the help.

%# SETHELPFILE (uip) : string ; FEXPR
(DF SETHELPFILE (U)
 (PROG	(ip rt)
	 (SETQ rt !&!*HelpFile!&!*)
	(SETQ ip (COND ((ATOM U)
			U)
		       ((ATOM (CAR U))
			(CAR U))
		       ((AND (EQ (CAAR U) 'QUOTE) (PAIRP (CDAR U)))
			(CADAR U))))
	(COND ((STRINGP ip)
	        (SETQ !&!*HelpFile!&!* ip))
	      ((NOT ip)
	       (PRIN2 "*** Old help file ")
	       (PRIN2 !&!*HelpFile!&!*)
	       (PRIN2 " replaced by the default ")
	       (PRINT "./localhelp")
	       (SETQ !&!*HelpFile!&!* "$bmroot/doc/helptexts"))
	      (T
	       (ERROR 0 "Bad input to SETHELPFILE")))
	(RETURN rt) ))

%# GETHELPFILE () : string ;
(DE GETHELPFILE () (PROGN !&!*HelpFile!&!*) )

% For specialised help, from locally specified files.
% First argument: List of help files; to search for help for
% the second argument. Search stops when help is found, or the
% files are exhausted. Third argument: The global help
% file should be searched first, last, or not at all, depending on
% whether the last argument is a positive number, a negative number,
% or neither.

%# HELPFROMFILES (lfile, id, gint) : bool ;
(DE HELPFROMFILES (FNames U GlToo)
 (PROG	()
	(SETQ GlToo (COND ((NUMBERP GlToo)
			    (COND ((LESSP GlToo 0) -1)
				  ((EQN GlToo 0) 0)
				  (T 1)))
			  (T 0)))
	(COND ((NOT (AND (IDP U) (LISTP FNames)))
	       (ERROR 0 "Bad input to SETHELPFILE")))
	(COND ((AND (EQN GlToo 1)
		    (HelpSearchPrint U !&!*HelpFile!&!* NIL))
	       (RETURN T)))
  Ml	(COND ((NOT FNames)
	       (COND ((AND (EQN GlToo -1)
			   (HelpSearchPrint U !&!*HelpFile!&!* NIL))
		      (RETURN T))
		     (T
		      (RETURN (NoHelpFound U)))))
	      ((HelpSearchPrint U (CAR FNames) NIL)
	       (RETURN T)))
	(SETQ FNames (CDR FNames))
	(GO Ml) ))
		      


% For the inquisitive user.

%# INTERNALLIST (id bool) : any ;
(DE INTERNALLIST (Itm State)
  (PROG	(rt inp1 inp2) % rt not used??
	(COND ((OR (NOT Itm)
		   (MEMQ (SETQ inp1 Itm) QuizIds!*)
		   (AND (PAIRP inp1)
			(EQ (CAR inp1) 'QUOTE)
			(PAIRP (CDR inp1))
			(MEMQ (CADR inp1) QuizIds!*)))
	       (RESPOND '("** INTERNALLIST should be given two arguments."
			  "** The second one should be NIL/Non-NIL, if you wish"
			  "** a printing/output of the list. The first argument:"))
	       (SETQ inp1 (OneOfAskRead
			  (MAPCAR !$!&InternalLists!#!* (FUNCTION CAR))))
	       (PRIN2 "** The second argument:")
	       (SETQ inp2 (OneOfAskRead '(NIL T))))
	      (T
	       (COND ((NOT (ASSOC inp1 !$!&InternalLists!#!*))
		      (SETQ inp1 (EVAL inp1))))
	       (SETQ inp2 State)))
	(COND ((NOT (SETQ inp1 (ASSOC inp1 !$!&InternalLists!#!*)))
	       (ERROR 99 "Bad input to INTERNALLIST"))
	      (inp2 (RETURN (COPY (EVAL (CDR inp1))))))
	(PRETTYPRINT (EVAL (CDR inp1))) ))

(ON RAISE)
