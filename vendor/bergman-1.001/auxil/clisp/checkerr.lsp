;;
(defun process (x)
 (cond ((search "***" x) (QUIT 1))   )
)

(defun check-errors (fname)

 (with-open-file (ifile fname)
  (LOOP WHILE (LISTEN ifile) DO (PROCESS (READ-LINE ifile)))
 ) 
)

(check-errors "bergman.log")