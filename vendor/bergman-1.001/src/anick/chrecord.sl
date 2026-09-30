%  Chains in anick.

%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%
%% Copyright (C) 1996
%% Joergen Backelin and Alexander Podoplelov
%%
%% Bergman and Anick are distributed in the hope that they will be
%% useful, but WITHOUT ANY WARRANTY.  No author or distributor
%% accepts responsibility to anyone for the consequences of using them
%% or for whether they serve any particular purpose or work at all,
%% unless (s)he says so in writing.  Refer to the Bergman General Public
%% License for full details.

%% Everyone is granted permission to copy, modify and redistribute
%% bergman, but only under the conditions described in the
%% Bergman General Public License.   A copy of this license is
%% supposed to have been given to you along with bergman so you
%% can know your rights and responsibilities.  It should be in a
%% file named copyright.  Among other things, the copyright notice
%% and this notice must be preserved on all copies.
%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%

%  Added (SET/GET)HOMMAXDEGREE, and corresponding HMax variants of
% CONSTRUCTNEWCHAINS, et cetera./JoeB 2005-06-25 -- 06-26

%	CHANGES:

%  $Log: chrecord.sl,v $
%  Revision 1.12  1999/11/19 11:38:33  joeb
%  (Minor corrections to the preceeding commitment.)
%
%  Revision 1.11  1999/11/15 16:26:14  joeb
%  Added the "length -1 chain" anUNITCHAIN representing the generator
%  of the homological degree 0 generator. Used this in order create
%  correct differentials of the 0-chains (for output purposes). Also
%  entered a anUNITCHAIN clause into PRINTCHAIN, making this slightly
%  slower as well. /JoeB
%
%  Revision 1.10  1999/11/05 15:07:10  joeb
%  Changed MONP to MON!?
%
%  Revision 1.9  1998/11/07 21:37:11  sanya
%  Mode settings handling are added
%
%  Revision 1.8  1998/11/07 17:11:33  joeb
%  Added anExtractChnModes/JoeB
%
%  Revision 1.7  1998/11/07 17:03:47  sanya
%  Modifications for modes of Chn
%
%  Revision 1.6  1998/11/05 15:48:27  sanya
%  Name changes of some functions
%
%  Revision 1.5  1998/11/04 15:50:46  joeb
%  *** empty log message ***
%
%  Revision 1.4  1998/11/04 13:53:16  joeb
%  Updated chrecord type documentation
%
%  Revision 1.3  1998/11/03 14:00:54  sanya
%  Modification of some source modules so that it is corresponds logically
%  more to advanced and developer guides. The TeX documentation is updated.
%
%  Revision 1.2  1998/10/24 14:50:04  sanya
%  A copy of all the anick source files from Joergen's directory.
%  These files are used in compilcation of the latest version of BERGMAN.
%
%Revision 1.2  1997/02/14  11:54:19  joeb
%Corrected name of 'redand' variable to 'quotpol' variable,
%and added a PreenQPol (as a preparation for positive
%characteristics coefficient domains)/JoeB
%

%  Created 1996-06-23.


%  Chains should contain or make accessible all relevant
% informations about the 'chains', i.e. the generators in the Anick
% resolution. They should only be accessed by means of the procedures
% and macros given the protocol.
%  The macros are found on the file anmacros.sl (which should be read
% in together with the bergman source file macros.sl at the time of
% compilation of this and other anick source files).

% Import: Mon!=, Mon!?, LeftMonFactorP, PMon, MonIntern1, MONPRINT,
%	  GETVARNO, MONINTERN, MODULEOBJECT; MONONE, NALGGEN, NMODGEN.

% Export:

(OFF RAISE)

(GLOBAL '(anchEdgeString!*  !*anchPrintEdgeString anCHAINS
	  anNEWCHAINS MONONE !*anDEBUG REDANDCOEFFONE ModeProperties!*
	  anUNITCHAIN NALGGEN NMODGEN NLMODGEN NRMODGEN
	  anbnmChainStartIndexLimits anbnmChainEndIndexLimits
	  !#!&MaxChainLength!#))

% (PUT 'ModeProperties!* '!*anchPrintEdgeString 'anFLIPFLAG)
% (PUT 'ModeProperties!* 'anchEdgeString!* 'anASSIGNSTRING)

%  In this implementation, a chain (Chn) is represented as dotted
% pair of dotted pairs: Chn = ( (Vx . Chn1)  .  ( (n . df)  .  ChnList) ),
% where Vx is the last vertex of the chain seen as a path in the graph,
% represented as an augmented monomial; n is the length of Chn; Chn1 is
% the "preceeding chain", i.e. the chain representing
% the unique chain of length n-1 which is a left factor of the chain
% represented by Chn; df either is NIL or is the calculated differential
% of the chain, represented by a semi-distributed tensor
% polynomial; and ChnList is a list of succeeding chains, i.e.,
% of chains representing chains of length n+1, eac of which has
% the chain represented by Chn as a left factor.

%  (As usual, the individual parts of chains should be accessed
% from other parts of anick only by the protocolled macros and
% procedures for this purpose. The internal representation may change
% without notice.)


%  If the chain chn is an n-chain then this returns a dotted pair
% (chn1 . augmon1), where the n+1 -chain "chn1" and the augmented monomial
% "augmon1" fulfil chn * augmon = chn1 * augmon1. It returns an error if
% there is no n+1 -chain left factor of chn * augmon. (IS THIS NECESSARY?)
%  Meaning of prog variables: List of chains (prolonging chn);
% Last vertex of the first of these; Right quotient pure polynomial.

(DE anPROLONGCHAIN (chn augmon)
 (PROG	(lcr vx rq)
	(COND (!*anDEBUG (PRIN2 "anPROLONGCHAIN <-- ")
	       (PRINTCHAIN chn) (PRIN2 ":") (MONPRINT augmon) (TERPRI)))
	(SETQ lcr (anChn2HiChns chn))
  Ml	(COND ((NOT lcr)
	       (ERROR 1001 "No prolongation found in anPROLONGCHAIN"))
	      ((Mon!= (SETQ vx (anChn2LastVx (CAR lcr))) augmon)
	       (COND (!*anDEBUG (PRIN2 "anPROLONGCHAIN --> ")
		      (PRINTCHAIN (CAR lcr)) (PRIN2 ":") (PRINT 1)))
	       (RETURN (CONS (CAR lcr) MONONE)))
	      ((SETQ rq (LeftMonFactorP (PMon vx) (PMon augmon)))
	       (SETQ vx (MonIntern1 rq))
	       (COND (!*anDEBUG (PRIN2 "anPROLONGCHAIN --> ")
		      (PRINTCHAIN (CAR lcr)) (PRIN2 ":")
		      (MONPRINT vx) (TERPRI)))
	       (RETURN (CONS (CAR lcr) vx))
	       %(RETURN (CONS (CAR lcr) (MonIntern1 rq)))
	       ))
	(SETQ lcr (CDR lcr))
	(GO Ml) ))


%  Print the vertices of the chain in a row.  The vertices are printed
% as strings of variable names. If  !*anchPrintEdgeString is ON, then
% print the value of anchEdgeString!* between them.
%  Meaning of PROG variables: List of vertices; (Previous) chain.

(DE PRINTCHAIN (chn)
 (PROG	(lv pc)
	(COND ((anChn!= chn anUNITCHAIN)
	       (PRIN2 1)
	       (RETURN 1)))
	(SETQ lv (NCONS (anChn2LastVx (SETQ pc chn))))
  Fl	(COND ((NOT (ZEROP (anChn2Length pc)))
	       (SETQ lv (CONS (anChn2LastVx
			       (SETQ pc (anChn2LowerChn pc)))
			      lv))
	       (GO Fl)))
	(MONPRINT (CAR lv))
  Sl	(COND ((SETQ lv (CDR lv))
	       (COND ( !*anchPrintEdgeString (PRIN2 anchEdgeString!*)))
	       (MONPRINT (CAR lv))
	       (GO Sl))) ))
%Converts a chain to an augmented monomial,
% VU, JoeB 02-06-28
(DE CHAIN2AUGMON (chn)
  (PROG(res)
  %    (PRIN2 "in CHAIN2AUGMON ")(PRINTCHAIN chn) (PRIN2 " of chain length ") (PRINT (anChn2Length chn))
   %   (PRIN2 "; Last Vertex = ") (MONPRINT (anChn2LastVx chn)) (TERPRI)      
      (SETQ res  (COND  ((anChn!= chn anUNITCHAIN) (PRIN2 "in CHAIN2AUGMON 1")(TERPRI) MONONE)
	       ((ZEROP (anChn2Length chn)) (anChn2LastVx chn))
	       (T (MONTIMES2 (PMon (CHAIN2AUGMON (anChn2LowerChn chn)))(PMon (anChn2LastVx chn))))))
% (PRIN2 "Result of CHAIN2AUGMON:") (MONPRINT res)
	       (RETURN res)
 ))


%  Depending on the object type mode, there may be restrictions on
% which of the potentially possibe chains actually to construct. There
% should be rich possibilities to handle this; whence the input
% procedures should be FEXPRs.
%  Meaning of PROG variables: Lower Limit, Higher Limit (inclusive).

%# SETCHAINSTARTS (any) : - ; FEXPR
(DF SETCHAINSTARTS (ints)
 (PROG	(ll hl)
	(COND ((OR (NOT (PAIRP ints))
		   (NOT (PAIRP (CDR ints)))
		   (NOT (FIXP (SETQ ll (EVAL (CAR ints)))))
		   (NOT (FIXP (SETQ hl (EVAL (CADR ints)))))
		   (LESSP hl ll)
		   (LESSP ll 0))
	       (ERROR 99 ints " bad input to SETCHAINSTARTS")))
	(SETQ anbnmChainStartIndexLimits (CONS ll hl)) ))

%# SETCHAINENDS (any) : - ; FEXPR
(DF SETCHAINENDS (ints)
 (PROG	(ll hl)
	(COND ((OR (NOT (PAIRP ints))
		   (NOT (PAIRP (CDR ints)))
		   (NOT (FIXP (SETQ ll (EVAL (CAR ints)))))
		   (NOT (FIXP (SETQ hl (EVAL (CADR ints)))))
		   (LESSP hl ll)
		   (LESSP ll 0))
	       (ERROR 99 ints " bad input to SETCHAINENDS")))
	(SETQ anbnmChainEndIndexLimits (CONS ll hl)) ))


%  Returns a list (chn1, chn2, ...) of new chains from an old
% one, chn,  and a total degree different number, degdiff. ch1, ch2 ... 
% represent the chains of length = 1 + length[chn] and
% total-degree = degdiff + totaldegree[chn], and with chn as a left factor.
%  Meaning of prog values: Return list; Input last vertex following
% vertices list position; New chain length.

(DE anOrdRingCONSTRUCTNEWCHAINS (chn degdiff)
 (PROG	(rt ip nl)
%	(COND (!*anDEBUG (PRIN2 "anCONSTRUCTNEWCHAINS<--")
%		(PRINTCHAIN chn) (PRIN2 " degdiff = ") (PRINT degdiff)))
	(SETQ rt (NCONS NIL))
	(SETQ ip (LGET (Mplst (anChn2LastVx chn)) 'InvRecDef))
	(SETQ nl (ADD1 (anChn2Length chn)))
  Ml	(COND (ip
	       (COND ((AND (Mon!? (CAR ip))
			   (EQN degdiff (TOTALDEGREE (PMon (CAR ip)))))
		      (ancrInsertChn (ancrMakeChain chn
							  NIL
							  (CAR ip)
							  NIL
							  nl)
				     rt)))
	       (SETQ ip (CDR ip))
	       (GO Ml))
	      ((NULL (SETQ rt (CDR rt)))
	       (RETURN NIL)))

	% Insert the new chains at chn and in anNEWCHAINS:
	(anSETHIGHERCHAINS chn (APPEND rt (anChn2HiChns chn)))
	(COND ((NULL (CDR (SETQ ip anNEWCHAINS)))
%	       (COND (!*anDEBUG (PRINT "anCONSTRUCTNEWCHAINS--> 1")))
	       (RETURN (RPLACD ip rt))))
	(SETQ nl (CAR rt))
  Sl	(COND ((anLESSCHAIN nl (CADR ip))
%	       (COND (!*anDEBUG (PRINT "anCONSTRUCTNEWCHAINS--> 2")))
	       (RETURN (RPLACD ip (NCONC rt (CDR ip)))))
	      ((CDR (SETQ ip (CDR ip)))
	       (GO Sl)))
	(RPLACD ip rt) ))


%  Only change compared to ordinary Ring variant: Doesn't create
% chains of length larger than the set maximum.

(DE anHMaxRingCONSTRUCTNEWCHAINS (chn degdiff)
 (PROG	(rt ip nl)
%	(COND (!*anDEBUG (PRIN2 "anCONSTRUCTNEWCHAINS<--")
%		(PRINTCHAIN chn) (PRIN2 " degdiff = ") (PRINT degdiff)))
	(COND ((BMI!< !#!&MaxChainLength!# (SETQ nl (ADD1 (anChn2Length chn))))
	       (RETURN NIL)))
	(SETQ rt (NCONS NIL))
	(SETQ ip (LGET (Mplst (anChn2LastVx chn)) 'InvRecDef))
  Ml	(COND (ip
	       (COND ((AND (Mon!? (CAR ip))
			   (EQN degdiff (TOTALDEGREE (PMon (CAR ip)))))
		      (ancrInsertChn (ancrMakeChain chn
							  NIL
							  (CAR ip)
							  NIL
							  nl)
				     rt)))
	       (SETQ ip (CDR ip))
	       (GO Ml))
	      ((NULL (SETQ rt (CDR rt)))
	       (RETURN NIL)))

	% Insert the new chains at chn and in anNEWCHAINS:
	(anSETHIGHERCHAINS chn (APPEND rt (anChn2HiChns chn)))
	(COND ((NULL (CDR (SETQ ip anNEWCHAINS)))
%	       (COND (!*anDEBUG (PRINT "anCONSTRUCTNEWCHAINS--> 1")))
	       (RETURN (RPLACD ip rt))))
	(SETQ nl (CAR rt))
  Sl	(COND ((anLESSCHAIN nl (CADR ip))
%	       (COND (!*anDEBUG (PRINT "anCONSTRUCTNEWCHAINS--> 2")))
	       (RETURN (RPLACD ip (NCONC rt (CDR ip)))))
	      ((CDR (SETQ ip (CDR ip)))
	       (GO Sl)))
	(RPLACD ip rt) ))


%  The only difference in the TwoModules variant is, that here
% we must explicitly test a potential new chain in order to
% ensure that it indeed ends in ring variables.

(DE anOrdTwoModulesCONSTRUCTNEWCHAINS (chn degdiff)
 (PROG	(rt ip nl)
%	(COND (!*anDEBUG (PRIN2 "anCONSTRUCTNEWCHAINS<--")
%		(PRINTCHAIN chn) (PRIN2 " degdiff = ") (PRIN2 degdiff)
%		(PRIN2 "; NALGGEN = ") (PRINT NALGGEN)))
	(SETQ rt (NCONS NIL))
	(SETQ ip (LGET (Mplst (anChn2LastVx chn)) 'InvRecDef))
	(SETQ nl (ADD1 (anChn2Length chn)))
  Ml	(COND (ip
	       (COND ((AND (Mon!? (CAR ip))
			   (EQN degdiff (TOTALDEGREE (PMon (CAR ip))))
			   (NOT (BMI!< (CDR anbnmChainEndIndexLimits)
				       (MonLeastSignifVar (CAR ip)))))
		      (ancrInsertChn (ancrMakeChain chn
							  NIL
							  (CAR ip)
							  NIL
							  nl)
				     rt)))
	       (SETQ ip (CDR ip))
	       (GO Ml))
	      ((NULL (SETQ rt (CDR rt)))
	       (RETURN NIL)))

	% Insert the new chains at chn and in anNEWCHAINS:
	(anSETHIGHERCHAINS chn (APPEND rt (anChn2HiChns chn)))
	(COND ((NULL (CDR (SETQ ip anNEWCHAINS)))
%	       (COND (!*anDEBUG (PRINT "anCONSTRUCTNEWCHAINS--> 1")))
	       (RETURN (RPLACD ip rt))))
	(SETQ nl (CAR rt))
  Sl	(COND ((anLESSCHAIN nl (CADR ip))
%	       (COND (!*anDEBUG (PRINT "anCONSTRUCTNEWCHAINS--> 2")))
	       (RETURN (RPLACD ip (NCONC rt (CDR ip)))))
	      ((CDR (SETQ ip (CDR ip)))
	       (GO Sl)))
	(RPLACD ip rt) ))


%  Only change compared to ordinary TwoModules variant: Doesn't
% create chains of length larger than the set maximum.

(DE anHMaxTwoModulesCONSTRUCTNEWCHAINS (chn degdiff)
 (PROG	(rt ip nl)
%	(COND (!*anDEBUG (PRIN2 "anCONSTRUCTNEWCHAINS<--")
%		(PRINTCHAIN chn) (PRIN2 " degdiff = ") (PRIN2 degdiff)
%		(PRIN2 "; NALGGEN = ") (PRINT NALGGEN)))
	(COND ((BMI!< !#!&MaxChainLength!# (SETQ nl (ADD1 (anChn2Length chn))))
	       (RETURN NIL)))
	(SETQ rt (NCONS NIL))
	(SETQ ip (LGET (Mplst (anChn2LastVx chn)) 'InvRecDef))
  Ml	(COND (ip
	       (COND ((AND (Mon!? (CAR ip))
			   (EQN degdiff (TOTALDEGREE (PMon (CAR ip))))
			   (NOT (BMI!< (CDR anbnmChainEndIndexLimits)
				       (MonLeastSignifVar (CAR ip)))))
		      (ancrInsertChn (ancrMakeChain chn
							  NIL
							  (CAR ip)
							  NIL
							  nl)
				     rt)))
	       (SETQ ip (CDR ip))
	       (GO Ml))
	      ((NULL (SETQ rt (CDR rt)))
	       (RETURN NIL)))

	% Insert the new chains at chn and in anNEWCHAINS:
	(anSETHIGHERCHAINS chn (APPEND rt (anChn2HiChns chn)))
	(COND ((NULL (CDR (SETQ ip anNEWCHAINS)))
%	       (COND (!*anDEBUG (PRINT "anCONSTRUCTNEWCHAINS--> 1")))
	       (RETURN (RPLACD ip rt))))
	(SETQ nl (CAR rt))
  Sl	(COND ((anLESSCHAIN nl (CADR ip))
%	       (COND (!*anDEBUG (PRINT "anCONSTRUCTNEWCHAINS--> 2")))
	       (RETURN (RPLACD ip (NCONC rt (CDR ip)))))
	      ((CDR (SETQ ip (CDR ip)))
	       (GO Sl)))
	(RPLACD ip rt) ))

(COPYD 'anRingCONSTRUCTNEWCHAINS 'anOrdRingCONSTRUCTNEWCHAINS)

(COPYD 'anTwoModulesCONSTRUCTNEWCHAINS 'anOrdTwoModulesCONSTRUCTNEWCHAINS)

% This routine should be called before the calculation of the Anick
% resolution to construct the chains for the chains of length
% zero, as a list (in increasing order).
%  Also construct the chain anUNITCHAIN of length -1.
%  Mening of prog variables: Return list of chains; Variable index;
% Variable as a monomial; Differential.

(DE anCONSTRUCTZEROCHAINS ()
 (PROG	(rt vi vm df)
	(SETQ vi (COND ((EQ (GETOBJECTTYPE) 'RING) (GETVARNO))
		       (T (CDR anbnmChainStartIndexLimits))))
	(SETQ NALGGEN
	      (COND ((OR (EQ (GETOBJECTTYPE) 'TWOMODULES)
			 (EQ (GETOBJECTTYPE) 'MODULE)
			 (EQ (GETOBJECTTYPE) 'FACTORALGEBRA))
		     (SUB1 (CAR anbnmChainStartIndexLimits)))
		    (T 0)))
	(SETQ anUNITCHAIN (ancrMakeChain NIL NIL MONONE NIL -1))
  Ml	(COND ((NOT (LESSP NALGGEN vi))
	       (RETURN (SETQ anCHAINS (NCONS (CONS 1 rt))))))
	(SETQ df (anMakeNewSDP))
	(anAppendSDPTail df
			 (anChn!&QPol2SDPTail
				anUNITCHAIN
				(Tm2QPol
				 (Cf!&Mon2Tm REDANDCOEFFONE
					     (SETQ vm
						   (MONINTERN (NCONS vi)))))))
	(SETQ rt (CONS (ancrMakeChain anUNITCHAIN NIL vm df 0)
		       rt))
	(SETQ vi (SUB1 vi))
	(GO Ml) ))


%  Converts data from one structure format to another - from the leading
% monomial of a new Groebner basis element to a 1-chain. Also calculates
% the differential of the chain.
%  Meaning of prog variables: Return chain differential; part thereof;
% return position; input position; new quotpol; new quotpol position;
% index of most significant variable; new index; input leading coefficient.

(DE anNEWGBELM2CHAIN (augmon)
 (PROG	(rt rp ip nq np ix ni ic)

	% First calculate the differential.
	(SETQ rp (SETQ rt (anMakeNewSDP)))
	(SETQ ic (Lc (SETQ ip (PPol (Mpt augmon)))))
	(SETQ ix (MonSignifVar (Lm ip)))
  Ml	(SETQ np (SETQ nq (Num!&Den2QPol REDANDCOEFFONE ic)))
  Sl	(ConcPol np (Cf!&Mon2Pol (RedorCoeff2RedandCoeff (Lc ip))
				(RestOfMon (Lm ip))))
	(COND ((AND (PolDecap ip)
		    (EQ (SETQ ni (MonSignifVar (Lm ip)))
			ix))
	       (PolDecap np)
	       (GO Sl)))
	(PreenQPol nq)
	(anAppendSDPTail rp (anChn!&QPol2SDPTail (ancrIndex2Chn ix) nq))
	(COND (ip
	       (anNextSDPTail rp)
	       (SETQ ix ni)
	       (GO Ml)))

	% Now put rp := the leading 0-chain; create the new chain;
	% and place it on rp.
%(PRIN2 "in anNEWGBELM2CHAIN, rt=") (PRETTYPRINTSDP rt) (TERPRI)
	(SETQ rt
	      (ancrMakeChain (SETQ rp (anSDP2NextChn rt))
				 NIL
				 (APol2Lm (anSDP2NextQPol rt))
				 rt
				 1))
	(anSETHIGHERCHAINS rp (CONS rt (anChn2HiChns rp)))
	(RETURN rt) ))


% Returns NIL if chn1 doesn't preceed chn2 in "monomial deglex" order.

(DE anLESSCHAIN (chn1 chn2)
 (PROG	(lg1 lg2 ncr)
	(COND (!*anDEBUG (PRIN2 "anLESSCHAIN <-- ")
	       (PRINTCHAIN chn1) (PRIN2 ", ") (PRINTCHAIN chn2) (TERPRI)))
	(COND ((anChn!= chn1 chn2)
	       (COND (!*anDEBUG (PRINT "anLESSCHAIN --> 1.")))
	       (RETURN NIL))
	      ((EQN (SETQ lg1 (anChn2Length chn1))
		    (SETQ lg2 (anChn2Length chn2)))
	       (RETURN (ancrLESSCHAIN1 chn1 chn2)))
	      ((LESSP lg1 lg2)
	       (SETQ ncr (anChn2LowerChn chn2))
	       (GO Sl)))
	(SETQ ncr (anChn2LowerChn chn1))

	Fl
	(COND ((EQN (SETQ lg1 (SUB1 lg1)) lg2)
	       (RETURN (ancrLESSCHAIN1 ncr chn2))))
	(SETQ ncr (anChn2LowerChn ncr))
	(GO Fl)

	Sl
	(COND ((EQN (SETQ lg2 (SUB1 lg2)) lg1)
	       (RETURN (ancrLESSCHAIN1 chn1 ncr))))
	(SETQ ncr (anChn2LowerChn ncr))
	(GO Sl) ))


%	AUXILIARIES:


(DE ancrLESSCHAIN1 (chn1 chn2)
 (COND	((anChn!= (anChn2LowerChn chn1) (anChn2LowerChn chn2))
	 (COND (!*anDEBUG (PRINT "anLESSCHAIN --> 2.")))
% changed MONLESSP to noncommLexMONLESS to work in the ELIM order too VU 020701
	 (noncommLexMONLESSP (PMon (anChn2LastVx chn1))
		   (PMon (anChn2LastVx chn2))))
	(T
	 (ancrLESSCHAIN1 (anChn2LowerChn chn1)
			     (anChn2LowerChn chn2)))) )

(DE ancrIndex2Chn (ix)
 (PROG	(c0)
	% ONLY FOR DEBUGGING; remove later:
	(COND ((OR (ATOM anCHAINS) (ATOM (CAR anCHAINS))) (ERROR 1001 "anCHAINS improperly set for ancrIndex2Chn")))
	(SETQ c0 (CDAR anCHAINS))
  Ml	% ONLY FOR DEBUGGING; remove later:
	(COND ((NULL c0) (PRIN2 "***** ") (PRIN2 ix) (TERPRI)
	       (ERROR 1001 "bad input to ancrIndex2Chn")))
	(COND ((EQ (MonSignifVar (anChn2LastVx (CAR c0))) ix)
	       (RETURN (CAR c0))))
	(SETQ c0 (CDR c0))
	(GO Ml) ))


(DE ancrInsertChn (chn auglchn)
 (PROG	(lcr)
	(COND ((NOT (CDR (SETQ lcr auglchn)))
	       (RETURN (RPLACD lcr (NCONS chn)))))
  Ml	(COND ((anLESSCHAIN chn (CADR lcr))
	       (RETURN (RPLACD lcr (CONS chn (CDR lcr)))))
	      ((CDR (SETQ lcr (CDR lcr)))
	       (GO Ml)))
	(RETURN (RPLACD lcr (NCONS chn))) ))


%  Create a new chain out of the lower chain, the higher
% chains (or their position), the last vertex, the differential
% (or its position), and the length of the chain, in this order.

(DE ancrMakeChain (chn lchn vx df lg)
 (CONS (CONS vx chn) (CONS (CONS lg df) lchn)))


%  Mode settings.


% Sets value for anchEdgeString!* variable and returns its old one.
(DE SETEDGESTRING (strng)
 (PROG	(OldEStr)
	(COND ((NOT (OR (STRINGP strng) (IDP strng)))
	       (ERROR 1011 "Bad input to SETEDGESTRING")))
	(SETQ OldEStr anchEdgeString!*)
	(SETQ anchEdgeString!* strng)
	(ON PRINTEDGESTRING)
	(RETURN OldEStr) ))

% Returns the value of string which is printed between chain vertexes.
(DE GETEDGESTRING () (PROGN anchEdgeString!*))

(COND ((NOT (GETEDGESTRING)) (SETEDGESTRING " ")))

(DE SETEDGESTRINGPRINTING (b)
 (PROG	(rt)
	(SETQ rt (GETEDGESTRINGPRINTING))
	(COND (b (ON anchPrintEdgeString))
	      (T (OFF anchPrintEdgeString)))
	(RETURN rt) ))

(DE GETEDGESTRINGPRINTING () (PROGN !*anchPrintEdgeString))

(DF SETHOMMAXDEGREE (gint)
 (PROG	(rt nr !*USERMODE !*REDEFMSG)
	(SETQ rt (GETHOMMAXDEGREE))
	(COND ((ATOM gint)
	       (SETQ nr gint))
	      ((AND (ATOM (CAR gint)) (NULL (CDR gint)))
	       (SETQ nr (CAR gint)))
	      (T
	       (GO Err)))
	(COND ((OR (NOT nr) (EQN nr 0))
	       (AnickUnsetHDegMax)
	       (SETQ !#!&MaxChainLength!# NIL)
	       (RETURN rt))
	      ((AND (NUMBERP nr) (LESSP 0 nr))
	       (AnickSetHDegMax)
	       (SETQ !#!&MaxChainLength!# (SUB1 nr))
	       (RETURN rt)))
  Err	(ERROR 99 gint " bad input to SETMAXDEGREE") ))

(DE GETHOMMAXDEGREE ()
 (COND ((NUMBERP !#!&MaxChainLength!#) (ADD1 !#!&MaxChainLength!#))) )

%# AnickSetHDegMax (int) : - ;
(DE AnickSetHDegMax (int)
 (PROGN	(COPYD 'anRingCONSTRUCTNEWCHAINS 'anHMaxRingCONSTRUCTNEWCHAINS)
	(COPYD 'anTwoModulesCONSTRUCTNEWCHAINS
	       'anHMaxTwoModulesCONSTRUCTNEWCHAINS)
	(COPYD 'anCONSTRUCTNEWCHAINS
	       (COND ((EQ (GETOBJECTTYPE) 'TWOMODULES)
		      'anTwoModulesCONSTRUCTNEWCHAINS)
		     (T
		      'anRingCONSTRUCTNEWCHAINS)))))

%# AnickUnsetHDegMax () : - ;
(DE AnickUnsetHDegMax ()
 (PROGN	(COPYD 'anRingCONSTRUCTNEWCHAINS 'anOrdRingCONSTRUCTNEWCHAINS)
	(COPYD 'anTwoModulesCONSTRUCTNEWCHAINS
	       'anOrdTwoModulesCONSTRUCTNEWCHAINS)
	(COPYD 'anCONSTRUCTNEWCHAINS
	       (COND ((EQ (GETOBJECTTYPE) 'TWOMODULES)
		      'anTwoModulesCONSTRUCTNEWCHAINS)
		     (T
		      'anRingCONSTRUCTNEWCHAINS)))))

(PUT 'ModeProperties!*
     'HOMMAXDEGREE
     (FUNCTION (LAMBDA (v a) (EVAL (LIST 'SETHOMMAXDEGREE a)))) )

(DE anExtractChnModes ()
 (LIST	(LIST 'HOMMAXDEGREE (GETHOMMAXDEGREE))
	(LIST 'EDGE!-STRING (GETEDGESTRING))
	(LIST 'EDGE!-STRING!-PRINTING (GETEDGESTRINGPRINTING)) ))

(ON RAISE)
