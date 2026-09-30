;;
; Rewritten by KAE 2006-07-31 Mon 11:06:39
; CLISP 2.39 or later needed
; Change major and minor version at necessity
(USE-PACKAGE "EXT")
(let ((*need-major-version* 2) 
      (*need-minor-version* 39)
      (version-string (lisp-implementation-version)))
  (princ (format nil "The necessary version of CLISP is at least ~D.~D" *need-major-version* *need-minor-version*))
  (terpri)
  (princ (format nil "You use version ~A" version-string))
  (multiple-value-bind (version-regexp-match major-version-regexp-match minor-version-regexp-match) 
                       (regexp:match "\\([0123456789]*\\).\\([0123456789]*\\)[ -]" version-string)
    ; Some additional checks can guarantee the correspondence of version-string format
    ; Example of version-string produced by (lisp-implementation-version):
    ; "2.39 (2006-07-16) (built on stnt067 [192.168.0.1])"                    
    ;(print (regexp:match-start version-regexp-match))       ; should be 0
    ;(print (regexp:match-end version-regexp-match))         ; should be x>0
    ;(print (regexp:match-start major-version-regexp-match)) ; should be 0
    ;(print (regexp:match-end major-version-regexp-match))   ; should be y<x-1
    ;(print (regexp:match-start minor-version-regexp-match)) ; should be y+1
    ;(print (regexp:match-end minor-version-regexp-match))   ; should be x-1
    ;(print (substring v (regexp:match-start version-regexp-match) (regexp:match-end minor-version-regexp-match)))
    (cond ( (< (values (read-from-string (substring version-string (regexp:match-start major-version-regexp-match) (regexp:match-end major-version-regexp-match)))) 
               *need-major-version*) (quit 1)) )
    (cond ( (< (values (read-from-string (substring version-string (regexp:match-start minor-version-regexp-match) (regexp:match-end minor-version-regexp-match)))) 
               *need-minor-version*) (quit 1)) )
  )
)
