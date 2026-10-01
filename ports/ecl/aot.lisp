;;; ECL C compiler adapter. The existing algebraic functions
;;; are read in Bergman's environment, then cross compiled for Wasm.
(require :cmp)
(defparameter *george-aot-directory* (ext:getenv "GEORGE_AOT_DIRECTORY"))
(defparameter *george-aot-runtime* (ext:getenv "GEORGE_AOT_RUNTIME"))
(defparameter *george-aot-prefix* (ext:getenv "GEORGE_ECL_WASM"))
(defparameter *george-aot-sources* nil)
(defparameter *george-aot-fallbacks* nil)
(defparameter *george-aot-compiling* nil)
;; These original routines retain malformed calls in legacy branches.
;; Keep their existing bytecode implementations instead of changing bodies.
(defparameter *george-aot-exclusions*
  '("instableMaybeReduceRedor" "stableMaybeReduceRedor"))

(defun george-aot-readtable ()
  (let ((table (copy-readtable nil)))
    (set-syntax-from-char #\! #\\ table)
    (set-syntax-from-char #\% #\; table)
    table))
(setf si::*keep-definitions* t)
(load "prelude.lisp")

(defun george-aot-remove-autoloads (source)
  ;; Native startup installs autoload macros for modules normally loaded as
  ;; bytecode. Remove placeholders for functions defined by this source
  ;; before evaluating it, so recursive calls compile as function calls.
  (let ((*readtable* (george-aot-readtable)))
    (setf (readtable-case *readtable*) :preserve)
    (with-open-file (stream source)
      (loop for form = (read stream nil :eof) until (eq form :eof)
            when (and (consp form) (symbolp (car form))
                      (member (symbol-name (car form)) '("DE" "DEFUN") :test #'equal)
                      (symbolp (second form)) (macro-function (second form)))
              do (fmakunbound (second form))))))

(defun george-aot-load-source (file verbose print external-format)
  (let* ((name (pathname-name file))
         (source (loop for directory in '("src/" "domains/" "auxil/")
                       for candidate = (concatenate 'string *george-aot-runtime*
                                                    "/" directory name ".sl")
                       when (probe-file candidate) return candidate)))
    (cond ((member name '("environ" "environ0") :test #'equal)
           (si:load-source file verbose print external-format))
          (source
           (pushnew source *george-aot-sources* :test #'equal)
           (george-aot-remove-autoloads source)
           (with-open-file (stream source :external-format external-format)
             (let ((*readtable* (if *george-aot-compiling*
                                   (george-aot-readtable) *readtable*)))
               (si:load-source stream verbose print external-format))))
          (t
           (pushnew (namestring file) *george-aot-fallbacks* :test #'equal)
           (george-load-bytecodes file verbose print external-format)))))
(push (cons "fas" #'george-aot-load-source) ext:*load-hooks*)
(push (cons "b" #'george-aot-load-source) ext:*load-hooks*)
(load "bmtop-cl.lsp")

;; CLEARPBSERIES is an autoload macro after ordinary startup. Resolve its
;; dependency before the C compiler snapshots macro definitions.
(IN-PACKAGE "Bergman")
(LAPIN (MKBMPATHEXPAND "$bmsrc/hmacro.sl"))
(LOAD "hseries")

(IN-PACKAGE #:CL-USER)
(SETF CL:*READTABLE* (CL:COPY-READTABLE NIL))

(defun george-aot-load-group (stream verbose print external-format)
  (let ((*readtable* (george-aot-readtable)))
    (si:load-source stream verbose print external-format)))

(defun george-aot-definition (symbol expression)
  (cond ((eq (first expression) 'ext::lambda-block)
         (let ((original-name (second expression))
               (arguments (third expression))
               (body (cdddr expression)))
           (if (eq original-name symbol)
               `(defun ,symbol ,arguments ,@body)
               (let ((declarations nil))
                 (loop while (and (consp (first body))
                                  (eq (caar body) 'declare))
                       do (push (pop body) declarations))
                 `(defun ,symbol ,arguments ,@(nreverse declarations)
                    (block ,original-name ,@body))))))
        ((eq (first expression) 'lambda)
         `(defun ,symbol ,(second expression) ,@(cddr expression)))
        (t (error "Unsupported lambda expression for ~S" symbol))))

(defun george-aot-build ()
  (let* ((symbols nil) (specials nil) (definitions nil) (aliases nil)
         (functions (make-hash-table :test #'eq))
         (target (c:read-target-info
                  (concatenate 'string *george-aot-prefix* "/target-info.lsp")))
         (directory (pathname (concatenate 'string *george-aot-directory* "/"))))
    (dolist (package '("Bergman" "ENVIRON0"))
      (do-symbols (symbol package)
        (when (eq (symbol-package symbol) (find-package package))
          (when (si:specialp symbol) (push symbol specials))
          (when (and (fboundp symbol) (not (macro-function symbol))
                     (not (special-operator-p symbol)))
            (push symbol symbols)))))
    (setf symbols (sort symbols #'string< :key #'symbol-name))
    (dolist (symbol symbols)
      (let ((function (fdefinition symbol)))
        (multiple-value-bind (expression closure name)
            (function-lambda-expression function)
          (when (and expression (not closure)
                     (not (member (symbol-name (if (symbolp name) name symbol))
                                  *george-aot-exclusions* :test #'equal)))
            (let ((previous (gethash function functions)))
              (if previous
                  (push `(si:fset ',symbol (fdefinition ',previous)) aliases)
                  (progn
                    (setf (gethash function functions) symbol)
                    (push (george-aot-definition symbol expression) definitions))))))))
    (setf definitions
          (mapcar (lambda (form)
                    `(,@(subseq form 0 3)
                      ;; Bergman's COPYD switches these function definitions
                      ;; at runtime. ECL's global OPTIMIZE proclamation does
                      ;; not apply extended policies; use a local declaration.
                      (declare (optimize (speed 3) (safety 2) (debug 0))
                               (ext:use-direct-C-call nil)
                               (notinline ,@symbols))
                      ,@(cdddr form)))
                  (nreverse definitions))
          aliases (nreverse aliases))
    (unless definitions (error "No function definitions were recovered"))
    ;; Generic functions such as MONFACTORP are replaced by COPYD when the
    ;; user changes a mode. Preserve that runtime dispatch after compilation.
    (let ((*print-readably* t) (*print-circle* t) (*print-pretty* nil)
          (*package* (find-package "Bergman"))
          (*readtable* (copy-readtable nil)))
      (with-open-file (stream (merge-pathnames "functions.lisp" directory)
                              :direction :output :if-exists :supersede)
        (write-line ";;; Generated from Bergman source; no algebraic changes." stream)
        ;; Read all definitions before expanding autoload macros: those
        ;; macros can temporarily change the reader's syntax and case.
        (write `(progn (in-package "Bergman")
                       (declaim (optimize (speed 3) (safety 2) (debug 0))
                                (special ,@specials) (notinline ,@symbols))
                       ,@definitions ,@aliases) :stream stream)
        (terpri stream))
      (with-open-file (stream (merge-pathnames "functions.txt" directory)
                              :direction :output :if-exists :supersede)
        (dolist (form definitions) (write (second form) :stream stream) (terpri stream))))
    ;; Installed ECL target information may refer to its original build
    ;; prefix. Relocate only compiler paths; retain its Wasm sizes/features.
    (dolist (key '(c::*ecl-include-directory* c::*ecl-library-directory*))
      (setf (cdr (assoc key target)) (concatenate 'string *george-aot-prefix* "/")))
    (setf (cdr (assoc 'c::*cc-flags* target))
          (concatenate 'string "-DECL_C_COMPATIBLE_VARIADIC_DISPATCH -Demscripten "
                       (or (ext:getenv "GEORGE_AOT_CC_FLAGS") "-O2")))
    (setf (cdr (assoc 'c:*cc-optimize* target)) "")
    (ext:install-c-compiler)
    (push (cons nil #'george-aot-load-group) ext:*load-hooks*)
    (let ((*readtable* (copy-readtable nil)) (*package* (find-package "Bergman"))
          (*george-aot-compiling* t))
      (multiple-value-bind (object warnings failure)
          (compile-file (merge-pathnames "functions.lisp" directory)
                        :target target :system-p t :c-file t :h-file t :data-file t)
        (format t "~&AOT functions=~D aliases=~D object=~S warnings=~S failure=~S~%"
                (length definitions) (length aliases) object warnings failure)
        (unless (and object (not failure)) (error "AOT compilation failed"))
        (c::compile-with-target-info
          (lambda ()
            (c:build-static-library (merge-pathnames "libgeorge-aot.a" directory)
                                    :lisp-files (list object)
                                    :init-name "init_george_aot"))
          target)
        (with-open-file (stream (merge-pathnames "compile.json" directory)
                                :direction :output :if-exists :supersede)
          (format stream "{~%  ~S: ~D,~%  ~S: ~D,~%  ~S: ~D,~%  ~S: ~A~%}~%"
                  "functions" (length definitions) "aliases" (length aliases)
                  "sourceModules" (length *george-aot-sources*)
                  "compilerFailure" (if failure "true" "false")))))))

(handler-case (progn (george-aot-build) (ext:quit 0))
  (error (condition) (format *error-output* "~&AOT failed: ~A~%" condition) (ext:quit 1)))
