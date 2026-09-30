;;
; CLISP 2.34 or later needed
(let ((*need-version* 20000505))
 (cond ( (< (car (system::version)) *need-version*) (quit 1)) )
)