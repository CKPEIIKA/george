;;
(cl:defpackage "BERGMAN-PACKAGE"
  (:size 1500)
  (:nicknames "Bergman" "BP")
  (:use "COMMON-LISP" "EXT" "ENVIRON0")
  (:shadow "COMMON-LISP"
           "SET"
           "MAP" "MAPC" "MAPCAR" "MAPCAN" "NTH" "NTHCDR" "OPEN" "PRINT" "TIME" "ERROR"
           "TIMES"
           "SQRT") ; From primaux.sl
  (:export
"DE" "DM" "DF" "GETD" "COPYD" "REMD"
"DEFSWITCH" "C-ON" "C-OFF" "ON" "OFF" "*RAISE" "DEFMODES"
"ADD1" "PLUS" "PLUS2" "INCR"
"MINUS" "SUB1" "DIFFERENCE" "DECR"
"TIMES" "TIMES2"
"DIVIDE" "QUOTIENT" "REMAINDER"
"MAX2" "MIN2"
"EQN" "NEQ" "GREATERP" "LESSP"
"FIXP"
"PAIRP" "EVLIS" "MEMQ" "ATSOC" "NCONS" "MAP" "MAPC" "MAPCAR" "MAPCAN"
"GETV" "MKVECT" "PUTV" "NTH" "NTHCDR" "PUT"
"FLAG1" "FLAGP" "REMFLAG1" "FLAG" "REMFLAG"
"$EOF$" "$EOL$"
;"LOAD"
"M-LAPIN" "M-DSKIN" "COMPILE-AND-LOAD" "RDS" "WRS" "OPEN"
"CHANNELFLUSH" "FLUSHCHANNEL"
"MKBMPATHEXPAND" "FILEP"
"GLOBALa" "GLOBAL" "FLUID" "TIME"
"ERROR" "ERRORSET" "CONTINUABLEERROR"
"GTBPS" "LINELENGTH" "IDP"
"anick" "hseries" "stg"
"DOUBLEQUOTE"
"CALLSHELL" "BANNER-OUTPUT"
))

(eval-when (:COMPILE-TOPLEVEL :LOAD-TOPLEVEL :EXECUTE) (IN-PACKAGE "Bergman"))
(TERPRI)

; Very base
;   SET
(eval-when (:COMPILE-TOPLEVEL :LOAD-TOPLEVEL :EXECUTE) (SHADOW 'SET) )
(defun SET (symbol value) (setf (symbol-value symbol) value))
; Definitions and special characters
;   !, %, DE, DM, DF, GETD, COPYD, REMD
;   DOUBLEQUOTE added by KAE 2005-07-31

(defun skipper (x y) (declare (ignore x y)) nil)
(set-macro-character #\! #'skipper)
(set-syntax-from-char #\! #\\)
(set-macro-character #\% #'skipper)
(set-syntax-from-char #\%  #\;)

(defmacro DE (x y &rest z) (append (list 'defun x y) z))

(defmacro DM (name (param) &rest body)
 `(defmacro ,name (&whole ,param &rest ignore)
   (declare (ignore ignore))
  ,@body)
)

(defmacro DF (name arg &body forms)
  `(defmacro ,name (&rest ,(car arg))
     `(let
        ((,',(car arg) (quote ,,(car arg))))
       ,',@forms
      )
   )
)

; DOUBLEQUOTE added by KAE 2005-07-31
(defvar DOUBLEQUOTE "\"")

;KAE 2002-09-06 17:45:10
;VER 27/08/2002 Changed GETD to be closer to PSL definition
;{expr, fexpr, macro, nexpr} . {code-pointer, lambda}
(defun GETD (x)
  (cond
    ((fboundp x) (cond
                     ((macro-function x)     (CONS 'MACRO (macro-function x))  )
                     ((special-operator-p x) nil                               )
                     (t                      (CONS 'EXPR  (symbol-function x)) )
                  )
    )
  )
)

;KAE 2002-10-18 18:59:55
;(defun COPYD (to from)
;  (if (getd from) (system::\%putd to (symbol-function from))
;                  (lisp:print (list "Can't COPYD" to "from" from)))
;)

;(eval-when (:COMPILE-TOPLEVEL :LOAD-TOPLEVEL :EXECUTE) (LISP:PRINT "before copyd") )

(defun COPYD (to from)
  (prog
   (x)
    (if (setq x (getd from))
          (cond
             ( (eq (car x) 'MACRO) (environ0:bm-copy-macro    to from))
             ( T                   (environ0:bm-copy-function to from)) )
          (lisp:print (list "Can't COPYD" to "from" from))
    )
  )
)

(defun REMD (name)
    (if (fboundp name)
        (prog1 (getd name)
               (fmakunbound name))
        nil)
)

; Switches
;   DEFSWITCH, C-ON, C-OFF, ON, OFF, *RAISE, DEFMODES

(defmacro make-switch-name (x)
  (concatenate 'string "*" (string x))
)

(defmacro DEFSWITCH
            (x &optional (on-form nil) (off-form nil) (init-value nil))
  `(let (temp)
   (progn
    (setq temp (intern (make-switch-name ,x)))
    (eval (list 'defvar temp ,init-value))
    (setf (get temp 'simpfg) (list (list t ,on-form) (list nil ,off-form)))
    (identity ',x)
   )
  )
)

(defmacro C-ON (x)
 `(let (temp)
   (eval-when (:COMPILE-TOPLEVEL :LOAD-TOPLEVEL :EXECUTE)
   (prog2 (setq temp (intern (make-switch-name ,x)))
;          (set temp t)
          (setf (symbol-value temp) t)
        (eval (car (cdar (get temp 'simpfg))))
  )))
)

(defmacro C-OFF (x)
 `(let (temp)
   (eval-when (:COMPILE-TOPLEVEL :LOAD-TOPLEVEL :EXECUTE)
   (prog2 (setq temp (intern (make-switch-name ,x)))
;          (set temp nil)
          (setf (symbol-value temp) nil)
        (eval (car (cdadr (get temp 'simpfg))))
  )))
)

(defmacro ON (x)
 `(let (temp)
;   (eval-when (:COMPILE-TOPLEVEL :LOAD-TOPLEVEL :EXECUTE)
   (prog2 (setq temp (intern (make-switch-name ,x)))
;          (set temp t)
          (setf (symbol-value temp) t)
        (eval (car (cdar (get temp 'simpfg))))
  ));)
)

(defmacro OFF (x)
 `(let (temp)
;   (eval-when (:COMPILE-TOPLEVEL :LOAD-TOPLEVEL :EXECUTE)
   (prog2 (setq temp (intern (make-switch-name ,x)))
;          (set temp nil)
          (setf (symbol-value temp) nil)
        (eval (car (cdadr (get temp 'simpfg))))
  ));)
)

; KAE 2004/05/13 RAISE definition converted to UPPER case
(DEFSWITCH RAISE '(SETF (READTABLE-CASE *READTABLE*) :UPCASE)
                 '(SETF (READTABLE-CASE *READTABLE*) :PRESERVE)
)
;(defswitch RAISE '(eval-when (eval load compile)
;  (setf (readtable-case *readtable*) :upcase))
;                 '(eval-when (eval load compile)
;  (setf (readtable-case *readtable*) :preserve))
;
;)
(ON RAISE)
;(defswitch RAISE)

(defmacro DEFMODES (x)
  (let (tempm temp tempd tempd1)
     (SETQ tempm (intern (concatenate 'string (string x) "-MODE")))
     (SETQ tempd1 `(DEFSWITCH ,tempm))
     (SETQ tempm (intern (concatenate 'string "*" (string x) "-MODE")))
     (setq temp (intern (concatenate 'string (string x) "-SPECIFIC")))
     (setq tempd
      `(defmacro ,temp (code)
                         (cond (,tempm code)
                          ))
     )
     (setq temp (intern (concatenate 'string (string x) "-AVOIDING")))
     (list  'let '() tempd1 tempd
               `(defmacro ,temp (code)
                         (cond ((NOT ,tempm) code)
                          ))

    T)
   )
)

; Arithmetic, comparison, integer type
;   ADD1, PLUS, PLUS2, INCR,
;   MINUS, SUB1, DIFFERENCE, DECR,
;   TIMES, TIMES2,
;   DIVIDE, QUOTIENT, REMAINDER,
;   MAX2, MIN2
;   EQN, NEQ, GREATERP, LESSP,
;   FIXP


(defun ADD1 (x) (1+ x))

(defmacro PLUS (&rest arg)
 (cons '+ arg)
)

(defun PLUS2 (x y) (+ x y))

(defmacro INCR (x &optional (y 1)) `(incf ,x ,y))

(defun MINUS (x) (- x))

(defun SUB1 (x) (1- x))

(defun DIFFERENCE (x y) (- x y))

(defmacro DECR (x &optional (y 1)) `(decf ,x ,y))

; KAE 2003/11/15 20:05
(eval-when (:COMPILE-TOPLEVEL :LOAD-TOPLEVEL :EXECUTE) (SHADOW 'TIMES) )

(defmacro TIMES (&rest arg)
 (cons '* arg)
)

(defun TIMES2 (x y) (* x y))

(defun DIVIDE (x y)
 (multiple-value-bind (x1 y1) (truncate x y) (cons x1 y1))
)

(defun QUOTIENT (x y)
  (if (and (integerp x) (integerp y))
      (truncate x y)
   (/ x y)))

(defun REMAINDER (x y) (rem x y))

(defun MAX2 (x y) (max x y))

(defun MIN2 (x y) (min x y))

(defun EQN (x y) (eql x y))

(defun NEQ (x y) (not (equal x y)))

(defun GREATERP (x y) (> x y))

(defun LESSP (x y) (< x y))

(defun FIXP (x) (integerp x))

; List and vector operations
;   PAIRP, EVLIS, MEMQ, ATSOC, NCONS, MAP, MAPC, MAPCAR, MAPCAN,
;   GETV, MKVECT, PUTV, NTH NTHCDR, PUT

(defun PAIRP (x)
  (and (listp x) x)
)

(defun EVLIS (u)
  (if (not (pairp u))
    ()
    (cons (eval (first u))
          (evlis (rest u))
    )
  )
)

(defun MEMQ (x y) (member x y :test #'eq))

; MOVED to slext.sl
;(defun ATSOC (x y) (assoc x y :test #'eq))

; MOVED to slext.sl
;(defun NCONS (itm) (cons itm nil))

(eval-when (:COMPILE-TOPLEVEL :LOAD-TOPLEVEL :EXECUTE) (shadow '(MAP MAPC MAPCAR MAPCAN)) )

(defun MAP (x y) (lisp:mapl y x) nil)

(defun MAPC (x y) (lisp:mapc y x) nil)

(defun MAPCAR (x y) (lisp:mapcar y x))

(defun MAPCAN (x y) (lisp:mapcan y x))

(defun GETV (x y) (svref x y))

(defun MKVECT (dim)
 (make-array (1+ dim))
)

(defun PUTV (vec ind what)
 (setf (svref vec ind) what)
)

(eval-when (:COMPILE-TOPLEVEL :LOAD-TOPLEVEL :EXECUTE) (SHADOW '(NTH NTHCDR)) )

(defun NTH (lst index)
 (LISP:NTH index lst)
)

(defun NTHCDR (lst index)
 (LISP:NTHCDR index lst)
)

(defun PUT (sym prop val) (SETF (GET sym prop) val))

; Flags
;   FLAG1, FLAGP, REMFLAG1, FLAG, REMFLAG

(defun FLAG1 (u v) (when (and (symbolp u) (symbolp v)) (setf (get u v) t)))

(defun FLAGP (u v) (and (symbolp u) (symbolp v) (get u v)))

(defun REMFLAG1 (u v) (when (and (symbolp u) (symbolp v)) (remprop u v)))

;(defun FLAG (u v) (lisp:mapcar `(lambda (x) (flag1 x (quote ,v)))  u))

;(defun REMFLAG (u v) (lisp:mapcar `(lambda (x) (remflag1 x (quote ,v)))  u))

(DEFUN FLAG (u v)
 (EVAL `(LISP:MAPCAR #'(LAMBDA (x) (FLAG1 x (QUOTE ,v)))  (QUOTE ,u)))
)

(DEFUN REMFLAG (u v)
 (EVAL `(LISP:MAPCAR #'(LAMBDA (x) (REMFLAG1 x (QUOTE ,v)))  (QUOTE ,u)))
)


; File operations
;   $EOF$, $EOL$,
;   LOAD
;   M-LAPIN, M-DSKIN, COMPILE-AND-LOAD, RDS, WRS, OPEN,
;                     ------ CHANNELFLUSH, FLUSHCHANNEL,
;   MKBMPATHEXPAND, FILEP
; FASLOUT, FASLEND deleted by KAE and JoeB 2005-08-01.
; LOAD added by KAE 2005-08-03

(proclaim '(special $EOF$ $EOL$))
(setq $EOF$ #\X)
(setf (get '$EOF$ 'CHAR-CODE) 26)
(setq $EOL$ #\NEWLINE)

;(eval-when (:COMPILE-TOPLEVEL :LOAD-TOPLEVEL :EXECUTE) (SHADOW 'LOAD) )

; a stub for LOAD: CLISP LOAD used now

;(DEFUN LOAD (file)
;  (LISP:LOAD file)
;)

;(DEFUN |LoaD*1| (file)
;  (LISP:LOAD file)
;)

;(DEFUN LOAD (lst)
; (LISP:MAPL '|LoaD*1| lst)
;)

(DEFUN M-LAPIN (|x| &OPTIONAL (|y| "lapin"))
  (WITH-OPEN-FILE (ISTREAM |x| :DIRECTION :INPUT)
    (PROG (*STANDARD-INPUT* |sav-raise|)
      (DECLARE (SPECIAL *RAISE))
      (SETQ |sav-raise| *RAISE)
      (SETF *STANDARD-INPUT* ISTREAM)
      (COND (*LOAD-VERBOSE*
       (TERPRI)
       (LISP:PRINC ";; ")
       (LISP:PRINC |y|)
       (LISP:PRINC ": loading file ")
       (LISP:PRINC |x|)
       (LISP:PRINC " ...")
       (TERPRI)
       T))
      (OFF RAISE)
      (LOOP WHILE (LISTEN ISTREAM) DO (EVAL (READ *STANDARD-INPUT* NIL $EOF$ NIL)))
      (COND (*LOAD-VERBOSE*
       (LISP:PRINC ";; ")
       (LISP:PRINC |y|)
       (LISP:PRINC ": loading of file ")
       (LISP:PRINC |x|)
       (LISP:PRINC " is finished.")
       (TERPRI)
       T))
       (LET (|tt| |zz| |$lastf$|)
        (SETQ |tt| (LENGTH |x|))
        (COND
          ((STRING= (SUBSEQ |x| (- |tt| 2)) "sl")
           (OFF RAISE)
           (COMPILE-FILE
            |x|
            :OUTPUT-FILE (SETQ |$lastf$|
                           (CONCATENATE
                             'STRING (MKBMPATHEXPAND "$bmload/")
                             (SUBSEQ
                               (SETQ |zz| (FILE-NAMESTRING (PARSE-NAMESTRING |x|)))
                               0
                               (- (LENGTH |zz|) 2)
                             )
                             "fas"
                           )
                         )
           )
           (OFF RAISE)
           (LOAD |$lastf$|)
          )
          (T (IDENTITY T))
        )
       )
      (COND (|sav-raise| (ON RAISE))
            (T (OFF RAISE))
      )
      (RETURN T)
    )
  )
)

(DEFUN M-DSKIN (x) (M-LAPIN x "dskin"))

(defun  COMPILE-AND-LOAD (|x|)
 (LET (|tt| |zz| |$lastf$|)
  (SETQ |tt| (LENGTH |x|))
  (COND
    ((STRING= (SUBSEQ |x| (- |tt| 2)) "sl")
     (OFF RAISE)
     (COMPILE-FILE
      |x|
      :OUTPUT-FILE (SETQ |$lastf$|
                     (CONCATENATE
                       'STRING (MKBMPATHEXPAND "$bmload/")
                       (SUBSEQ
                         (SETQ |zz| (FILE-NAMESTRING (PARSE-NAMESTRING |x|)))
                         0
                         (- (LENGTH |zz|) 2)
                       )
                       "fas"
                     )
                   )
     )
     (OFF RAISE)
     (LOAD |$lastf$|)
    )
    (T (IDENTITY T))
  )
 )
)

(defun RDS (stream)
  (when (null stream)
     (setf stream *terminal-io*))
  (prog1 *standard-input*
         (setf *standard-input* stream)))

(defun WRS (stream)
  (when (null stream)
     (setf stream *terminal-io*))
  (prog1 *standard-output*
         (setf *standard-output* stream)))

(eval-when (:COMPILE-TOPLEVEL :LOAD-TOPLEVEL :EXECUTE) (shadow 'open) )

(defun OPEN (file how)
  (cond ((eq how 'INPUT)
         (lisp:open file :direction :input))
        ((eq how 'OUTPUT)
         (lisp:open file :direction :output :if-exists :supersede))
  (T (lisp:error "***** Incorrect argumet to OPEN"))
  )
)

;(defun CHANNELFLUSH (stream) (force-output stream))

;(defun FLUSHCHANNEL (stream) (force-output stream))
;MOVED to slext.sl
;(defun |FlushChannel| (stream) (force-output stream))

; FASLOUT and FASLEND deleted by KAE and JoeB 2005-08-01
;(defun FASLOUT (x) (declare (ignore x)) t)

;(defun FASLEND () t)

;(declaim (inline FASLOUT FASLEND))

(defun MKBMPATHEXPAND (fstr)
  (let*
    ((p1 0)
     (p (cond
           ((setq p1 (search "/" fstr)) p1)
           (t (length fstr))
        )
     )
     (xa (subseq fstr 0 p))
     (xd (subseq fstr p))
    )
    (if (and (string/= xa "") (equal (char xa 0) #\$))
      (let
        ((xe (sys::getenv (subseq xa 1))))
        (cond
          (xe (concatenate 'string xe xd))
          (t (progn (sys::print (concatenate 'string "***** environment variable " xa " not defined")))
                    fstr
             )
        )
      )
      fstr
    )
  )
)

; MOVED to slext.sl
;(defun FILEP (x)
;   (cond ((probe-file x) t)
;         ( t nil)
;   )
;)

; Character and print operations
;   READCH, CHAR2STRING, READCHAR, UNREADCHAR, RATOM,
;   PRINT, PRIN2, TAB, COMPRESS, EXPLODE

(defun READCH () (read-char))

(defun CHAR2STRING (ch)
  (make-sequence 'string 1 :initial-element ch)
)

(defun READCHAR () (char-code (read-char)))

(defun UNREADCHAR (x) (unread-char (code-char x)))

; RATOM in PSL returns symbol not char

(defun identity-reader (stream chr_)
 (declare (ignore stream))
 (car (list (intern (string chr_))))
)

(defun star-reader (stream chr_)
 (declare (ignore chr_))
 (let (char2)
  (setq char2 (read-char stream))
  (cond ((eq char2 #\*) (identity '^))
        (T (progn
            (unread-char char2 stream)
            (identity '*)))
 ))
)

; VER (the problem of keeping *RAISE in non-top-level loops)

(defun RATOM ()
  (let
;    ( (save-readtable (copy-readtable))
    ( (save-readtable *readtable*)
      (temp nil)
    )
    (setq *readtable* (copy-readtable))
    (set-macro-character #\, #'identity-reader )
    (set-macro-character #\; #'identity-reader )
    (set-macro-character #\+ #'identity-reader )
    (set-macro-character #\- #'identity-reader )
;    (set-macro-character #\* #'identity-reader )
    (set-macro-character #\* #'star-reader )
    (set-macro-character #\^ #'identity-reader )
    (set-macro-character #\/ #'identity-reader )
    (set-macro-character #\: #'identity-reader )
;   ....
    (setq temp (read))
    (setq *readtable* save-readtable)
    temp
  )
)

(eval-when (:COMPILE-TOPLEVEL :LOAD-TOPLEVEL :EXECUTE) (shadow 'print) )

(defun PRINT (x &optional (stream *standard-output*))
         (prog1 (prin1 x stream) (terpri))
)

; PRIN2 is alike PRINC but PRINC does not handle correctly #\NEWLINE

(defun PRIN2 (&rest x)
  (lisp:mapc #'(lambda (z)
    (if (and (stringp z) (/= (length z) 0))
      (prog (temp (zz z))
ml
        (cond ((not (setq temp (position #\NEWLINE zz))) (princ zz))
              (t (progn (princ (subseq zz 0 temp))
                   (write-char #\NEWLINE)
                   (setq zz (subseq zz (1+ temp)))
                   (go ml)
               ) )
      ) )
      (princ z)
    ))
  x)
)

(defun format-tabulate (stream
                        &optional (colnum 1))
  (if (null colnum) (setq colnum 1))
  (let* ((new-colnum (max colnum 0))
         (pos (sys::line-position stream)))
      (if (< pos new-colnum)
        (format-padding (- new-colnum pos) #\Space stream)
        (progn (terpri) (format-padding new-colnum #\Space stream))

) ) )

(defun format-padding (count char stream)
  (dotimes (i count) (write-char char stream))
)

(defun TAB (x) (format-tabulate NIL x))

; KAE 2004/05/13 EXPLODE and COMPRESS redefined conformed to SL
; Old definitions; will be deleted later
;(DEFUN EXPLODE (ida)
;      (LISP:MAPCAR
;          #'(LAMBDA (idx)
;              (INTERN (STRING idx)))
;          (COERCE (STRING ida) 'LIST)))
;
;(DEFUN COMPRESS (lid)
;  (CAR (LIST (INTERN (COERCE
;    (LISP:MAPCAR
;      #'(LAMBDA (ch) (COERCE ch 'CHARACTER))
;      lid)
;    'STRING)))))

; COMPRESS-EXPLODE functions work for integers, floats, strings, and symbols only
; EXPLODE0 not exported; it's old EXPLODE renamed
(DEFUN EXPLODE0 (ida)
      (LISP:MAPCAR
          #'(LAMBDA (idx)
              (INTERN (STRING idx)))
          (COERCE (STRING ida) 'LIST)))

(DEFUN EXPLODE (ida)
  (COND ( (TYPEP ida 'SYMBOL)
          (EXPLODE0 ida)
        )
        ( (TYPEP ida 'NUMBER)
          (COND ((INTEGERP ida)
                 (EXPLODE0 (FORMAT NIL "~D" ida))
                )
                ((FLOATP ida)
                 (EXPLODE0 (FORMAT NIL "~G" ida))
                )
                (T NIL)
          )
        )
        ( (TYPEP ida 'STRING)
          (EXPLODE0 (CONCATENATE 'STRING "\"" ida "\"" ))
        )
        (T NIL)
  )
)
; COMPRESS0 not exported; it's old COMPRESS renamed
(DEFUN COMPRESS0 (lid)
  (CAR (LIST (INTERN (COERCE
    (LISP:MAPCAR
      #'(LAMBDA (ch) (COERCE ch 'CHARACTER))
      lid)
    'STRING)))))
; COMPRESS1 not exported; it's a part of the old COMPRESS making a string from exploded list
(DEFUN COMPRESS1 (lid)
   (COERCE
    (LISP:MAPCAR
      #'(LAMBDA (ch) (COERCE ch 'CHARACTER))
      lid)
    'STRING))

(DEFUN COMPRESS (lid)
  (COND ( (NULL lid)
          NIL
        )
        ( T
          (PROG (S V P L)
            (SETQ S (COMPRESS1 lid))
            (SETQ L (LENGTH S))
            (MULTIPLE-VALUE-SETQ (V P) (READ-FROM-STRING S))
            (COND ( (AND (= L P) (OR (TYPEP V 'INTEGER) (TYPEP V 'FLOAT) (TYPEP V 'STRING) ) )
                    (RETURN V)
                  )
                  ( T
                    (RETURN (COMPRESS0 lid))
                  )
            )
          )
        )
  )
)

; Miscellaneous
;   GLOBALa, GLOBAL, FLUID, TIME,
;   ERROR, ERRORSET, CONTINUABLEERROR,
;   GTBPS, LINELENGTH, IDP,
;   anick, hseries, stg, [variables]
;   CALLSHELL, BANNER-OUTPUT

; KAE, Joeb 2004/06/02 19:27 Chisinau
; added safe [variable]
; deleted 2005-07-31 by KAE

; KAE, Joeb 2004/06/05 11:29 Chisinau
; added stg [variable]

(DEFUN |GLOBALa| (ll)
   (LISP:MAPC #'(LAMBDA (lst)
     (COND
      ((BOUNDP lst) (EVAL (LIST 'DEFVAR lst)))
      (T (EVAL (LIST 'DEFVAR lst 'NIL)))
     ))
   ll)
 (EVAL `(PROCLAIM '(SPECIAL ,@ll)) )
)

(DEFMACRO GLOBAL (ll)
(print ll)
   (LISP:MAPC #'(LAMBDA (lst)
     (COND
      ((BOUNDP lst) (EVAL (LIST 'DEFVAR lst)))
      (T (EVAL `(DEFVAR ,lst NIL)))
     ))
;   (CADR ll))
   (EVAL ll))
(eval `(PROCLAIM `(SPECIAL ,@(CADR ,ll))) )
`(|GLOBALa| ,ll)
)


(defmacro FLUID (ll) `(GLOBAL ,ll))

(eval-when (:COMPILE-TOPLEVEL :LOAD-TOPLEVEL :EXECUTE) (shadow 'TIME) )

(defun TIME ()
 (car (list
  (round (* (/ (get-internal-run-time)
               internal-time-units-per-second
            )
            1000
         )
  )
 ))
)

(eval-when (:COMPILE-TOPLEVEL :LOAD-TOPLEVEL :EXECUTE) (shadow 'ERROR) )

(defvar EMSG!* "BERGMAN error")
(defvar |ErrorNum| 0)
(proclaim '(special EMSG!* |ErrorNum|))

(defun ERROR (num str)
    (SETQ |ErrorNum| num) (SETQ EMSG!* str) (lisp:error str))

;(defun ERRORSET (x y z) (declare (ignore y z)) (eval x))
(defun ERRORSET (frame msgp backtr) (declare (ignore backtr))
           (HANDLER-CASE (LIST (EVAL frame))
             (SIMPLE-ERROR () (PROGN
              (COND (msgp (LISP:PRINC (FORMAT NIL "***** ~A" EMSG!*)))
                    (T T))
              |ErrorNum|)))
)

;(defun CONTINUABLEERROR () T)
(defun CONTINUABLEERROR (&rest x) (declare (ignore x))
 (SETQ EMSG!* "BERGMAN continuable error")
 (SETQ |ErrorNum| 0)
 (CERROR "You will continue BERGMAN" ""))

(defun GTBPS (x) (declare (ignore x)) T)

(declaim (inline GTBPS))

(defun LINELENGTH (x) (declare (ignore x)) T)
(declaim (inline LINELENGTH))

(defun IDP (x) (symbolp x))

(defvar anick (MKBMPATHEXPAND "$bmexe/anick"))
(defvar |anick| (MKBMPATHEXPAND "$bmexe/anick"))

(defvar hseries (MKBMPATHEXPAND "$bmexe/hseries"))
(defvar |hseries| (MKBMPATHEXPAND "$bmexe/hseries"))

;(defvar safe (MKBMPATHEXPAND "$bmload/safe"))
;(defvar |safe| (MKBMPATHEXPAND "$bmload/safe"))

(defvar stg (MKBMPATHEXPAND "$bmload/stg"))
(defvar |stg| (MKBMPATHEXPAND "$bmload/stg"))

(defun CALLSHELL (f li) (declare (ignore f li))
 (LISP:PRINT "Can't execute system command")
)

;(eval-when (:COMPILE-TOPLEVEL :LOAD-TOPLEVEL :EXECUTE)
; (load "envvars.lsp")
;)

(defun BANNER-OUTPUT ()
  (DECLARE (SPECIAL |*BMVersion*|))
  (LISP:PRINC (FORMAT NIL "Welcome to the BERGMAN system. (v. ~A)" |*BMVersion*|))
  (ON RAISE)
  (TERPRI)
  (ENVIRON0::ENVVARSSET)
)

(SETQ *PRINT-CIRCLE* T)

(eval-when (:COMPILE-TOPLEVEL :LOAD-TOPLEVEL :EXECUTE)
 (load "switches.lsp")
)

(OFF RAISE)
