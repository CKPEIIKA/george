;;
(cl:defpackage "ENVIRON0"
  (:size 1500) 
  (:use "COMMON-LISP" "EXT")   
  (:export bm-copy-function bm-copy-macro)
)

(eval-when (:COMPILE-TOPLEVEL :LOAD-TOPLEVEL :EXECUTE) (in-package "ENVIRON0"))
(TERPRI)
; KAE 2002-10-17 18:54:28 

(defun bm-copy-function (to from) 
  (cond 
    ( (fboundp to) (fmakunbound to) )
  )
  (setf (symbol-function to) (symbol-function from))
)

(defun bm-copy-macro (to from) 
  (cond 
    ( (fboundp to) (fmakunbound to) )
  )
 (setf (macro-function to) (macro-function from))
)

