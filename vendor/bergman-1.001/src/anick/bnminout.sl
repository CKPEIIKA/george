%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%
%% Copyright (C) 2001,2004 Svetlana Cojocaru, Victor Ufnarovski
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

%  Created 2001-08-03 to compute Betti numbers for right modules /SK & VU 

%  CHANGES

%  Changed the name WarningIfFiniteGB to WARNINGIFFINITEGB, and added
% checks that the degrees be numbers./JoeB 2004-04-28

(GLOBAL '(NMODGEN NLMODGEN NRMODGEN bnmScInput   bnmInputFile  bnmOutFile
 anresScInput ANICKRESOLUTIONOUTPUTFILE))

(ON PBSERIES)

(DE bnmScreenInput ()
 (PROG	  (objtp)
          (SETQ bnmScInput T)
          (PRIN2 "Input the Maximum Degree you want to calculate")(TERPRI)
          (SETMAXDEG (READ))
          (COND ( (EQ (SETQ objtp (GETOBJECTTYPE)) 'MODULE)
		  (PRIN2 "Input the number of the module variables")(TERPRI)
		  (SETQ NMODGEN (READ)))
                ( (EQ objtp 'TWOMODULES)
		  (PRIN2 "Input the number of the right  module variables")
		  (TERPRI)
		  (SETQ NRMODGEN (READ))
		  (PRIN2 "Input the number of the left  module variables")
		  (TERPRI)
		  (SETQ NLMODGEN (READ))	)

          )%COND
          (PRIN2 "Now input all ring and then all module variables.") 
          (TERPRI)
	  (COND ((EQ objtp 'TWOMODULES) 
		 (PRIN2 "Right module variables should be before the left ones.")))
          (PRIN2 "Input  the ring ideal and module relations in algebraic form  thus:")
          (TERPRI) (PRIN2 "      vars v1, ..., vn;") (TERPRI)
          (PRIN2 "       r1, ..., rm;") (TERPRI)
          (PRIN2 "where v1, ..., vn are all the variables, and r1, ..., rm the  relations.")
          (TERPRI)
          (ALGFORMINPUT) ))
%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%
%%% Factor-algebra     calculations, input   SK&VU 02-06-11 %%%
%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%
(DE FactAlgScreenInput ()
 (PROGN     
    (SETQ bnmScInput T)
    (PRIN2 "Input the Maximum Degree you want to calculate")(TERPRI)
    (SETMAXDEG (READ))
    (PRIN2 "Now input all ring variables, a dummy variable (D),")
    (TERPRI)
    (PRIN2 "and copies of the ring variables (in this order), in this manner:")
    (TERPRI)
    (PRIN2 "    vars x1, ..., xn, D, y1, ..., yn;")  (TERPRI)
    (PRIN2 "(where x1,..., xn are the ring varables,") (TERPRI)
    (PRIN2 "and y1,...,yn their copies)")     (TERPRI)
    (PRIN2 "Then input  the ring ideal relations (in ordinary algebraic form);")
    (TERPRI)
    (PRIN2 "but the factor algebra relations in the form") (TERPRI)
    (PRIN2 "     D*r1, ..., D*rm,") (TERPRI)
    (PRIN2 "where r1, ..., rm are the relations.") (TERPRI)
	%    (PRIN2 "Finally, input the dummy commutators")
        %   (TERPRI)
        %  (PRIN2 "   y1*D-D*x1, ..., ym*D-D*ym;")
     (ALGFORMINPUT)
))    
%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%
%%% Hochschild homologi calculations, input  SK&VU 02-06-10 %%%
%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%
(DE HochScreenInput ()
 (PROG	  (objtp)
          (SETQ bnmScInput T)
          (PRIN2 "Input the Maximum Degree you want to calculate")(TERPRI)
          (SETMAXDEG (READ))
          (TERPRI)
          (SETQ NRMODGEN 1)
          (TERPRI)
	  (SETQ NLMODGEN 1)	
          (PRIN2 "Now input all ring variables, copies of the ring variables,")
          (TERPRI)
	  (PRIN2 "  and two dummy variable (D1,D2) (in this order), in this manner:")
	  (TERPRI)
	  (PRIN2 "    vars x1, ..., xn,  y1, ..., yn, D1, D2;")
	  (TERPRI)
	  (PRIN2 "(where x1,..., xn are the ring varables,")
	  (TERPRI)
	  (PRIN2 "and y1,...,yn their copies)")
	  (TERPRI)
	  (PRIN2 "Then input  the ring ideal relations (in ordinary algebraic form);")
	  (TERPRI)
          (PRIN2 "       r1, ..., rm;") (TERPRI)      
          (TERPRI)
          (ALGFORMINPUT) ))

(DE bnmCheckInput (files)
  (COND ( (NOT  (FILEP (CAR files)) )
          (PRIN2 "***Input file must exist")  (TERPRI)
          (PRIN2 "Input data from the keyboard")  (TERPRI)
          (bnmScreenInput)
        )
        (T
           (SETQ bnmInputFile (CAR files))
           (SETQ bnmScInput NIL)
           (DSKIN bnmInputFile)
        )
  )
)

(DE bnmCheckOutput (files )
   (COND ( (NOT (STRINGP (CADR files)) )
           (PRIN2 "***Incorrect output file.") (TERPRI)
           (PRIN2 "Do you agree to use the file outf____.bn as output ?" )
           (TERPRI)
           (COND ( (YESP "Type Yes or No")
                   (SETQ bnmOutFile "outf____.bn")
                   (PRIN2 "outf____.bn is used as output file") (TERPRI)
                   (PRIN2 "Don't forget to rename it after calculations. " )
                   (TERPRI)
                )
                (T
                   (PRIN2 "No output file. Screen output") (TERPRI)
                         
                )
           )
         )
         (T (SETQ bnmOutFile (CADR files)))
   )
)



(DE anresScreenInput ()
          (SETQ anresScInput T)
          (PRIN2 "Input the Maximum Degree you want to calculate")(TERPRI)
          (SETMAXDEG (READ))
          (TERPRI)
          (PRIN2 "Now input in-variables and ideal generators in algebraic form, thus:")
          (TERPRI) (PRIN2 "     vars v1, ..., vn;") (TERPRI)
          (PRIN2 "      r1, ..., rm;") (TERPRI)
          (PRIN2 "where v1, ..., vn are the variables, and r1, ..., rm the generators.")
          (TERPRI)
          (ALGFORMINPUT)
)

    %Print a warning message. SK&VU, 08-15-01
    % Changed to upper case name; introduced checks. JoeB, 2004-04-28
(DE WARNINGIFFINITEGB ()
   (PROGN
     (TERPRI)
     (COND ((AND (NUMBERP (GETCURRENTDEGREE))
		 (NUMBERP (GETMAXDEG))
		 (LESSP (GETCURRENTDEGREE) (GETMAXDEG)))
            (PRIN2 "Groebner basis is finite.") (TERPRI) 
            (PRIN2 "If you want to continue calculations until the maximal degree")
            (TERPRI)
            (PRIN2 "type (CALCULATEANICKRESOLUTIONTOLIMIT (GETMAXDEG))") 
            (TERPRI) 
            )
       )%end of cond
))




(ON RAISE)


