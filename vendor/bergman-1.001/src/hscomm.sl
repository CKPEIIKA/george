%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%
%% Copyright (C) 2002,2004,2005 Svetlana Cojocaru,
%% Victor Ufnarovski, Joergen Backelin.
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

%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%
% Commutative Hilbert series calculation. Input/output procedures.	%
% Originally written by  SC&VU 28.06.2002				%
% Moved to a separate file JoeB 11.10.2002				%
%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%
%  Changed SERIESPRINTING, so that it works correctly with zero coeff
%  /ufn 2006-08-12 - and does not try to close Standard Output/JoeB
%  Changed SERIESPRINTING, so that it no longer destroys the value of
% HlbOutFile./JoeB 2005-01-18

%  Changed SeriesPrinting to SERIESPRINTING./JoeB 2004-05-08

% Removed the non-Standard procedure LEQ./JoeB 2002-10-16

(GLOBAL '(HlbOutFile HlbGbFile HlbScInput HlbInputFile MAXSERDEG))


(DE HlbScreenInput ()
          (SETQ HlbScInput T)
          (PRIN2 "Input the maximal power series degree you want to calculate")
          (TERPRI)
          (SETQ MAXSERDEG (READ))
          (PRIN2 "Now input in-variables and ideal generators in algebraic form, thus:")
	  (TERPRI) (PRIN2 "	vars v1, ..., vn;") (TERPRI)
	  (PRIN2 "	r1, ..., rm;") (TERPRI)
	  (PRIN2 "where v1, ..., vn are the variables, and r1, ..., rm the generators.")
          (TERPRI)
          (ALGFORMINPUT)
)


(DE HlbCheckInput (files)
  (COND ( (NOT  (FILEP (CAR files)) )
          (PRIN2 "***Input file must exist")  (TERPRI)
          (PRIN2 "Input data from the keyboard")  (TERPRI)
          (HlbScreenInput)
        )
        (T
           (SETQ HlbInputFile (CAR files))
           (SETQ HlbScInput NIL)
           (DSKIN HlbInputFile)
        )
  )
)


(DE HlbCheckOutput (files )
   (COND ( (NOT (STRINGP (CADDR files)) )
           (PRIN2 "***Incorrect output file.") (TERPRI)
           (PRIN2 "Do you agree to use the file outf____.hs as output ?" )
           (TERPRI)
           (COND ( (YESP "Type Yes or No")
                   (SETQ HlbOutFile "outf____.hs")
                   (PRIN2 "outf____.hs is used as output file") (TERPRI)
                   (PRIN2 "Don't forget to rename it after calculations. " )
                   (TERPRI)
                )
                (T
                   (PRIN2 "No output file. Screen output") (TERPRI)
                         
                )
           )
         )
         (T (SETQ HlbOutFile (CADDR files)))
   )


 (COND ( (NOT (STRINGP (CADR files)) )
           (PRIN2 "***Incorrect output file.") (TERPRI)
           (PRIN2 "Do you agree to use the file outf____.gb as output ?" )
           (TERPRI)
           (COND ( (YESP "Type Yes or No")
                   (SETQ HlbGbFile "outf____.gb")
                   (PRIN2 "outf____.gb is used as output file") (TERPRI)
                   (PRIN2 "Don't forget to rename it after calculations. " )
                   (TERPRI)
                )
                (T
                   (PRIN2 "No output file. Screen output") (TERPRI)
                         
                )
           )
         )
         (T (SETQ HlbGbFile (CADR files)))
   )



)


(DE SERIESPRINTING ()
(PROG (P Q deg oldchannel )

%         (COND (HlbOutFile
%           (SETQ HlbOutFile (OPEN HlbOutFile 'OUTPUT))   )
%           (T (SETQ HlbOutFile NIL)   )
%          )
%
%          (SETQ oldchannel (WRS HlbOutFile ))

          (SETQ oldchannel (WRS (COND (HlbOutFile (OPEN HlbOutFile 'OUTPUT)))))
  
          (SETQ P(REVERSE HILBERTNUMERATOR))
          (PRIN2 "Hilbert series numerator:   ")
          
       M2 (COND ( (NOT (NULL (CDR P)))
                  (SETQ Q (CDAR P))
                  (COND ((GREATERP Q 0 )
                         (PRIN2 "+")  
                        )
                  )
                  (PRIN2 Q)(PRIN2 "*t^")(PRIN2 (CAAR P))  
                  (SETQ P (CDR P))
                  (GO M2)
                 )
          )
          (SETQ Q (CDAR P))
          (COND ((GREATERP Q 0 )(PRIN2 "+")))  
          (PRIN2 Q)(PRIN2 "*t^")(PRIN2 (CAAR P)) 
          (TERPRI)
          (SETQ Q HILBERTDENOMINATOR)
          (PRIN2 "Hilbert series denominator:  ")
          (COND ((GREATERP Q 1)(PRIN2 "(1-t)^")(PRIN2 Q))
                ((EQ Q 1)(PRIN2 "1-t"))
                ( T ( PRIN2 "1"))
           )
          (TERPRI)


%Calculating and printing the power series coefficients


         (COND (  (GREATERP MAXSERDEG 0)
                  (PRIN2 "Hilbert power series:        ") 
                  (PRIN2 "1") %changed /ufn 2006-08-12 
                )
          )
          (SETQ deg 1)
       M1 (COND( (NOT (LESSP MAXSERDEG deg)) 
                 (SETQ P (TDEGREEHSERIESOUT deg ))
                 (COND ((GREATERP P 0) (PRIN2 "+"))) %changed /ufn 2006-08-12 
                 (COND ((GREATERP P 1)(PRIN2 P))) 
                 (COND ((LESSP 0 P)  %changed /ufn 2006-08-12 
                        (PRIN2 "t^")
                        (PRIN2 deg)
                       ))
                 (SETQ deg (ADD1 deg))
                 (GO M1)
                )
           ) 
          (COND ((GREATERP Q 0) (PRIN2 "...")))  %changed /ufn 2006-08-12 
          (TERPRI)

%       (WRS oldchannel)
%       (COND (HlbOutFile  (CLOSE HlbOutFile))
%       )

%       (COND ((SETQ P (WRS oldchannel))
%	      (CLOSE P)))

       (COND (HlbOutFile (CLOSE (WRS oldchannel)))
	     (T (WRS oldchannel)))

)
)

(ON RAISE)
