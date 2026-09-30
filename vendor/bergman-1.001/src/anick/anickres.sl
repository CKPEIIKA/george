(DF ANICKRES (arguments)
%      (maxdeg  anresOutFile )

    
    (SETQ anresScInput NIL)
    (LOAD ANICK)
    (ON CALCBETTI)
    (ON ONFLYBETTI)
    (COND ((EQ (GETRINGTYPE) 'COMMUTATIVE)
                (PRIN2 "*** I turn on noncommutativity")
                (TERPRI)
                (NONCOMMIFY))
    )
   
    
    (SETQ LENG (LENGTH files))
    (COND ( (EQ LENG 0)  (anresScreenInput ))
        
           ( (EQ LENG 2) (anresCheckInput arguments) )
           
    )
     

  
 )





