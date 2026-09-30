;;; ECL compatibility shims for bergman's CLISP build.
;;; The upstream sources are copied and patched in a build directory only.

(si::package-lock "COMMON-LISP" nil)
(rename-package "COMMON-LISP" "COMMON-LISP" '("CL" "LISP"))

;;; ECL's default bytecode loader executes under its serialization package
;;; and readtable. Bergman's INTERN and RAISE require the caller's context.
;;; Use ECL syntax for decoding only, then execute in Bergman's context.
(ext:install-bytecodes-compiler)
(defun george-load-bytecodes (file verbose print external-format)
  (declare (ignore verbose print))
  (if (member (pathname-name file) '("environ" "environ0") :test #'equal)
      (si:load-source file nil nil external-format)
      (with-open-file (in file :external-format external-format)
        (loop for forms = (si::with-ecl-io-syntax (read in nil nil))
              while forms do (mapc #'funcall forms))))
  nil)
(push (cons "fas" #'george-load-bytecodes) ext:*load-hooks*)
(push (cons "b" #'george-load-bytecodes) ext:*load-hooks*)
;;; An extensionless group (hseries, auxil, ...) takes precedence over the
;;; individual module with the same basename and a .fas suffix.
(push (cons nil #'si:load-source) ext:*load-hooks*)
(set-syntax-from-char #\! #\\)
(set-syntax-from-char #\% #\;)

(unless (find-package "SYS")
  (defpackage "SYS" (:use "COMMON-LISP")))

(unless (fboundp 'sys::getenv)
  (defun sys::getenv (name)
    (ext:getenv name)))

(unless (fboundp 'sys::line-position)
  (defun sys::line-position (&optional (stream *standard-output*))
    (or (si:file-column (or stream *standard-output*)) 0)))

;;; The generated ECL runtime loads Bergman directly and does not save a
;;; platform-specific Lisp image. The build removes CLISP's SAVEINITMEM call.
