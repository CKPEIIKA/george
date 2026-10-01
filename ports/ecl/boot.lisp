(defpackage #:george
  (:use #:common-lisp)
  (:export #:initialize #:evaluate-text))

(in-package #:george)

;; Browser evaluation has no keyboard. Signal before attempting a read,
;; including reads hidden inside user functions, macros or redirected RDS.
;; This is deliberately not SIMPLE-ERROR: Bergman's ERRORSET would catch it
;; and try reading/skipping the rest of a nonexistent input line.
(define-condition keyboard-input-unavailable (error) ()
  (:report (lambda (condition stream)
             (declare (ignore condition))
             (format stream "Keyboard input is unavailable. Supply an input file, e.g. (simple ~S ~S)."
                     "input.bg" "out.gb"))))

(defclass unavailable-input (gray:fundamental-character-input-stream) ())
(defmethod gray:stream-read-char ((stream unavailable-input))
  (declare (ignore stream))
  (error 'keyboard-input-unavailable))
(defmethod gray:stream-listen ((stream unavailable-input))
  (declare (ignore stream))
  nil)

(defun require-input-file (file)
  (unless file (error 'keyboard-input-unavailable))
  (unless (and (or (stringp file) (pathnamep file)) (probe-file file))
    (error "Cannot open ~S." file)))

(defun install-file-checks ()
  ;; DF commands take literal filenames. Check inside the expansion, at
  ;; execution time, so a preceding form may create the file. CL functions
  ;; such as NCPBHGROEBNER already signal missing files in WITH-OPEN-FILE.
  ;; These checks are a property of the noninteractive ECL host, in both
  ;; algebra modes; native Bergman's interactive commands remain available.
  (dolist (name '("SIMPLE" "STAGSIMPLE" "RABBIT" "HILBERT" "ANICK"
                  "BETTI" "MODULEBETTINUMBERS" "LEFTMODULEBETTINUMBERS"
                  "TWOMODBETTINUMBERS" "FACTALGBETTINUMBERS" "HOCHSCHILD"))
    (let* ((symbol (find-symbol name "Bergman"))
           (original (and symbol (macro-function symbol))))
      (when original
        (setf (macro-function symbol)
              (lambda (form environment)
                `(progn (require-input-file ',(second form))
                        ,(funcall original form environment))))))))

(defun initialize ()
  (handler-case
      (progn
        (setf *load-verbose* nil *compile-verbose* nil)
        (load "prelude.lisp")
        (load "bmtop-cl.lsp")
        (setf *package* (find-package "Bergman"))
        (setf (readtable-case *readtable*) :upcase)
        (install-file-checks)
        ;; Complete the startup line here; do not leak its trailing T into
        ;; the first command's output or strip legitimate user values in JS.
        (fresh-line)
        (finish-output)
        t)
    (error (condition)
      (format *error-output* "Bergman startup failed: ~A~%" condition)
      nil)))

(defun evaluate-text (source echo-values)
  (let* ((saved-readtable *readtable*)
         (saved-case (readtable-case saved-readtable))
         (raise (find-symbol "*RAISE" "Bergman"))
         (saved-raise (symbol-value raise)))
   (handler-case
      (let ((*package* (find-package "Bergman"))
            (*standard-input* (make-instance 'unavailable-input))
            (*standard-output* *standard-output*)
            (*error-output* *error-output*)
            (*terminal-io* (make-two-way-stream (make-instance 'unavailable-input)
                                              *standard-output*)))
        (with-input-from-string (input source)
          (loop for form = (read input nil :eof)
                until (eq form :eof)
                for value = (eval form)
                when echo-values do (format t "~&~S~%" value)))
        (finish-output)
        t)
    (ext:storage-exhausted (condition)
      ;; STORAGE-EXHAUSTED inherits from SERIOUS-CONDITION, not ERROR.
      ;; Return a distinct status while ECL's safety area is still available.
      (setf *readtable* saved-readtable
            (readtable-case saved-readtable) saved-case
            (symbol-value raise) saved-raise)
      (format *error-output* "Memory exhausted: ~A~%" condition)
      (finish-output *error-output*)
      2)
    (error (condition)
      (setf *readtable* saved-readtable
            (readtable-case saved-readtable) saved-case
            (symbol-value raise) saved-raise)
      (if (typep condition 'file-error)
          (format *error-output* "Error: Cannot open ~S. ~A~%"
                  (file-error-pathname condition) condition)
          (format *error-output* "Error: ~A~%" condition))
      (finish-output *error-output*)
      nil))))
