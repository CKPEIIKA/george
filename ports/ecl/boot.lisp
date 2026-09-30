(defpackage #:george
  (:use #:common-lisp)
  (:export #:initialize #:evaluate-text))

(in-package #:george)

(defun initialize ()
  (handler-case
      (progn
        (setf *load-verbose* nil *compile-verbose* nil)
        (load "prelude.lisp")
        (load "bmtop-cl.lsp")
        (setf *package* (find-package "Bergman"))
        (setf (readtable-case *readtable*) :upcase)
        t)
    (error (condition)
      (format *error-output* "Bergman startup failed: ~A~%" condition)
      nil)))

(defun evaluate-text (source echo-values)
  (handler-case
      (let ((*package* (find-package "Bergman"))
            (*standard-input* *standard-input*)
            (*standard-output* *standard-output*)
            (*error-output* *error-output*))
        (with-input-from-string (input source)
          (loop for form = (read input nil :eof)
                until (eq form :eof)
                for value = (eval form)
                when echo-values do (format t "~&~S~%" value)))
        (finish-output)
        t)
    (error (condition)
      (format *error-output* "Error: ~A~%" condition)
      nil)))
