%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%
%% Copyright (C) 2001 Svetlana Cojocaru, Victor Ufnarovski
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

%  Created 2001-08-06 to simplify Anick input /SK & VU 




(DE anresScreenInput ()
          (SETQ anresScInput T)
          (PRIN2 "Input the Maximum Degree you want to calculate")(TERPRI)
          (SETMAXDEG (READ))
          (PRIN2 "Input the name of the output file")(TERPRI)
          (SETQ ANICKRESOLUTIONOUTPUTFILE (READ))
          %(PRIN2 "Now input  all ring  variables.") (TERPRI)
          %(PRIN2 "Input  the ring ideal generators in algebraic form  thus:")
          %(TERPRI) (PRIN2 "      vars v1, ..., vn;") (TERPRI)
          %(PRIN2 "       r1, ..., rm;") (TERPRI)
          %(PRIN2 "where v1, ..., vn are all the variables, and r1, ..., rm the  generators.")
          (TERPRI)
          %(ALGFORMINPUT)
)


(DE anresCheckInput (arguments)
  (COND ( (NOT  (NUMBERP (CAR arguments)) )
          (PRIN2 "***No maximal degree")  (TERPRI)
          (PRIN2 "Input data from the keyboard")  (TERPRI)
          (anresScreenInput)
        )
        (T
           (SETMAXDEG (CAR arguments))
           (SETQ anresScInput NIL)
        )
  )

  (COND ( (NOT (STRINGP (CADR arguments)) )
           (PRIN2 "***Incorrect output file.") (TERPRI)
           (PRIN2 "Do you agree to use the file andifres.txt as output ?" )
           (TERPRI)
           (SETQ ANICKRESOLUTIONOUTPUTFILE "andifres.txt")
           (PRIN2 "andifres.txt is used as output file") (TERPRI)
          
         )
         (T (SETQ  ANICKRESOLUTIONOUTPUTFILE (CADR argumentss)))
   )



)


(ON RAISE)
