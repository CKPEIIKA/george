COMMENT 1995-07-12: Below follows the results of a joint try to (re)write a
StandardForm coefficient domain module for bergman in reduce syntax, partially
merging with the CALI source code. Thus the copyright of the following belongs
in parts to J. Backelin, in parts to H.-G. Graebe;

LISP;
ON RAISE;
global '(gb!a!s!i!s
         noofspolcalcs
         !*immediatefullreduction
         noofnilreductions);
%         !*t!a!k!ed!e!n!s!ec!o!n!t!e!n!t!s);

dm(c!f0,!c!f!s(),0);
dm(c!f1,!c!f!s(),1);
dm(c!f0!?,!c!f!s(),'zerop . cdr !c!f!s);
dm(c!f1!?,!c!f!s(),list('eq,cadr !c!f!s,1));
dm(c!f!*,!c!f!s(),'times2 . cdr !c!f!s);
dm(c!f!/,!c!f!s(),'quotient . cdr !c!f!s);
dm(c!fl!i!nc!o!m!b,!c!f!s(),
   list('plus2,
        list('times2,cadr !c!f!s,caddr !c!f!s),
        list('times2,cadddr !c!f!s,car cddddr !c!f!s)));
dm(c!fs!e!m!il!i!nc!o!m!b,!c!f!s(),
   list('plus2,cadr !c!f!s,list('times2,caddr !c!f!s,cadddr !c!f!s)));
symbolic procedure c!h!a!r0p!o!lc!o!n!t!e!n!t!&u!ns!i!g!nl!c !p!o!l; 
   if p!o!lt!a!i!l !p!o!l
     then c!h!a!r0p!o!lnq!u!o!t(!p!o!l,
                                if l!c !p!o!l>0 then c!h!a!r0p!o!lgcd !p!o!l
                                 else  - c!h!a!r0p!o!lgcd !p!o!l)
    else if p!u!tl!c(!p!o!l,c!f1()) then 0;
symbolic procedure c!h!a!r0p!o!lc!o!n!t!e!n!t !p!o!l; 
   if p!o!lt!a!i!l !p!o!l then p!o!lnq!u!o!t(!p!o!l,p!o!lgcd !p!o!l)
    else if p!u!tl!c(!p!o!l,1) then 0;
symbolic procedure c!h!a!r0r!e!d!u!c!ep!o!ls!t!e!p(!a!u!g!r!e!d!a!n!d,
                                                   !r!e!d!a!n!d!p!o!s,
                                                   !p!u!r!e!r!e!d!o!r,
                                                   !n!i!m!o!n!q!u!o!t); 
   begin scalar !g!c!d!c!f!s; 
      !g!c!d!c!f!s := 
       c!h!a!r0c!o!e!f!f!sgcd!:!d(l!c p!o!lt!a!i!l !r!e!d!a!n!d!p!o!s,
                                  l!c !p!u!r!e!r!e!d!o!r); 
      c!h!a!r0p!o!ll!i!nc!o!m!b(!a!u!g!r!e!d!a!n!d,!r!e!d!a!n!d!p!o!s,
                                p!o!lt!a!i!l !p!u!r!e!r!e!d!o!r,
                                car !g!c!d!c!f!s,cdr !g!c!d!c!f!s,
                                !n!i!m!o!n!q!u!o!t)
   end;
symbolic procedure s!p!a!r!s!ec!o!n!t!e!n!tc!h!a!r0s!u!b!t!r!a!c!tr!e!d!a!n!d1(!
a!u!g!r!e!d!a!n!d,!p!l!a!c!e,!p!o!l); begin scalar aa; aa := c!h!a!r0c!o!e!f!f!s
gcd!:!d(l!c p!o!lt!a!i!l !p!l!a!c!e,l!c !p!o!l); s!p!a!r!s!ec!o!n!t!e!n!tc!h!a!r
0s!i!m!pp!o!ll!i!nc!o!m!b(!a!u!g!r!e!d!a!n!d,!p!l!a!c!e,p!o!lt!a!i!l !p!o!l,car 
aa,cdr aa); return if pp!o!l!? !a!u!g!r!e!d!a!n!d then !a!u!g!r!e!d!a!n!d end;
symbolic procedure d!e!n!s!ec!o!n!t!e!n!tc!h!a!r0s!u!b!t!r!a!c!tr!e!d!a!n!d1(!a!
u!g!r!e!d!a!n!d,!p!l!a!c!e,!p!o!l); begin scalar aa; aa := c!h!a!r0c!o!e!f!f!sgc
d!:!d(l!c p!o!lt!a!i!l !p!l!a!c!e,l!c !p!o!l); aa := d!e!n!s!ec!o!n!t!e!n!tc!h!a
!r0s!i!m!pp!o!ll!i!nc!o!m!b(!a!u!g!r!e!d!a!n!d,!p!l!a!c!e,p!o!lt!a!i!l !p!o!l,ca
r aa,cdr aa); if pp!o!l!? !a!u!g!r!e!d!a!n!d then if p!o!lt!a!i!l pp!o!l !a!u!g!
r!e!d!a!n!d then c!h!a!r0p!o!lnq!u!o!t(pp!o!l !a!u!g!r!e!d!a!n!d,aa) else if p!u
!tl!c(pp!o!l !a!u!g!r!e!d!a!n!d,c!f1()) then 0 end;
copyd('c!h!a!r0s!u!b!t!r!a!c!tr!e!d!o!r1,
      'd!e!n!s!ec!o!n!t!e!n!tc!h!a!r0s!u!b!t!r!a!c!tr!e!d!a!n!d1);
symbolic procedure d!e!n!s!ec!o!n!t!e!n!tc!h!a!r0p!r!e!e!nr!e!d!a!n!d(progn,
                                                                      nil); 
   0;
copyd('s!p!a!r!s!ec!o!n!t!e!n!tc!h!a!r0p!r!e!e!nr!e!d!a!n!d,
      'c!h!a!r0p!o!lc!o!n!t!e!n!t!&u!ns!i!g!nl!c);
copyd('c!h!a!r0p!r!e!e!nr!e!d!o!r,
      'd!e!n!s!ec!o!n!t!e!n!tc!h!a!r0p!r!e!e!nr!e!d!a!n!d);
symbolic procedure c!h!a!r0r!e!d!o!rm!o!nm!u!l!t(!r!e!d!o!r,!p!m!o!n); 
   begin scalar rt; 
      o!r!d!i!n!a!r!yc!o!n!cp!o!lm!o!nm!u!l!t(rt := !m!kap!o!l(),
                                              pp!o!l !r!e!d!o!r,
                                              !p!m!o!n); 
      return rt
   end;
symbolic procedure d!e!n!s!ec!o!n!t!e!n!tc!h!a!r0r!e!d!a!n!d2r!e!d!o!r !p!r!e!d!
a!n!d; nil;
copyd('s!p!a!r!s!ec!o!n!t!e!n!tc!h!a!r0r!e!d!a!n!d2r!e!d!o!r,
      'c!h!a!r0p!o!lc!o!n!t!e!n!t!&u!ns!i!g!nl!c);
symbolic procedure c!h!a!r0d!e!s!t!r!u!c!tr!e!d!o!r2r!e!d!a!n!d !r!e!d!o!r; 
   <<nil>>;
symbolic procedure c!h!a!r0i!nc!o!e!f!f2r!e!d!a!n!dc!o!e!f!f !n!u!m!b; !n!u!m!b;
symbolic procedure c!h!a!r0r!e!d!a!n!dc!o!e!f!f2o!u!tc!o!e!f!f !c!f; !c!f;
symbolic procedure c!h!a!r0r!e!d!o!rc!o!e!f!f2o!u!tc!o!e!f!f !c!f; !c!f;
symbolic procedure c!h!a!r0r!e!d!a!n!dc!o!e!f!f1!? !c!f; c!f1!? !c!f;
symbolic procedure c!h!a!r0r!e!d!o!rc!o!e!f!f1!? !c!f; c!f1!? !c!f;
symbolic procedure densecontents; 
   <<on t!a!k!ed!e!n!s!ec!o!n!t!e!n!t!s; 
     copyd('c!h!a!r0s!u!b!t!r!a!c!tr!e!d!a!n!d1,
           'd!e!n!s!ec!o!n!t!e!n!tc!h!a!r0s!u!b!t!r!a!c!tr!e!d!a!n!d1); 
     copyd('c!h!a!r0r!e!d!a!n!d2r!e!d!o!r,
           'd!e!n!s!ec!o!n!t!e!n!tc!h!a!r0r!e!d!a!n!d2r!e!d!o!r); 
     copyd('c!h!a!r0p!r!e!e!nr!e!d!a!n!d,
           'd!e!n!s!ec!o!n!t!e!n!tc!h!a!r0p!r!e!e!nr!e!d!a!n!d); 
     if not m!o!d!u!l!u!s or eqn(m!o!d!u!l!u!s,0)
       then copyd('s!u!b!t!r!a!c!tr!e!d!a!n!d1,
                  'd!e!n!s!ec!o!n!t!e!n!tc!h!a!r0s!u!b!t!r!a!c!tr!e!d!a!n!d1)>>;
symbolic procedure sparsecontents; 
   <<on t!a!k!es!p!a!r!s!ec!o!n!t!e!n!t!s; 
     copyd('c!h!a!r0s!u!b!t!r!a!c!tr!e!d!a!n!d1,
           's!p!a!r!s!ec!o!n!t!e!n!tc!h!a!r0s!u!b!t!r!a!c!tr!e!d!a!n!d1); 
     copyd('c!h!a!r0r!e!d!a!n!d2r!e!d!o!r,
           's!p!a!r!s!ec!o!n!t!e!n!tc!h!a!r0r!e!d!a!n!d2r!e!d!o!r); 
     copyd('c!h!a!r0p!r!e!e!nr!e!d!a!n!d,
           's!p!a!r!s!ec!o!n!t!e!n!tc!h!a!r0p!r!e!e!nr!e!d!a!n!d); 
     if not m!o!d!u!l!u!s or eqn(m!o!d!u!l!u!s,0)
       then copyd('s!u!b!t!r!a!c!tr!e!d!a!n!d1,
                  
         's!p!a!r!s!ec!o!n!t!e!n!tc!h!a!r0s!u!b!t!r!a!c!tr!e!d!a!n!d1)>>;
symbolic procedure c!h!a!r0p!o!lnm!u!l!t(!r!e!d!a!n!d,!c!o!e!f); 
   begin scalar aa; 
      if c!f1!? !c!o!e!f then return t; 
      aa := !r!e!d!a!n!d; 
    m!l: 
      p!u!tl!c(aa,c!f!*(l!c aa,!c!o!e!f)); 
      if p!o!ld!e!c!a!p aa then go to m!l
   end;
symbolic procedure c!h!a!r0c!o!n!cp!o!lnm!u!l!t(!r!e!t!u!r!n!s!t!a!r!t,
                                                !p!o!l,!c!o!e!f); 
   begin scalar aa,bb; 
      if c!f1!? !c!o!e!f
        then c!o!n!cp!o!l(!r!e!t!u!r!n!s!t!a!r!t,dplistcopy !p!o!l); 
      aa := !p!o!l; 
      bb := !r!e!t!u!r!n!s!t!a!r!t; 
    m!l: 
      c!o!n!cp!o!l(bb,t!m2p!o!l c!f!&m!o!n2t!m(c!f!*(l!c aa,!c!o!e!f),l!m aa)); 
      if p!o!ld!e!c!a!p aa then p!o!ld!e!c!a!p bb
   end;
symbolic procedure c!h!a!r0p!o!lp!a!r!tnm!u!l!t(!r!e!d!a!n!d,!p!l!a!c!e,
                                                !c!o!e!f); 
   begin scalar aa; 
      if c!f1!? !c!o!e!f then return t; 
      aa := !r!e!d!a!n!d; 
    m!l: 
      p!u!tl!c(aa,c!f!*(l!c aa,!c!o!e!f)); 
      if not p!o!ld!e!c!a!p aa eq !p!l!a!c!e then go to m!l
   end;
symbolic procedure c!h!a!r0p!o!lnq!u!o!t(!r!e!d!a!n!d,!c!o!e!f); 
   begin scalar aa; 
      if c!f1!? !c!o!e!f then return t; 
      aa := !r!e!d!a!n!d; 
    m!l: 
      p!u!tl!c(aa,c!f!/(l!c aa,!c!o!e!f)); 
      if p!o!ld!e!c!a!p aa then go to m!l
   end;
symbolic procedure c!h!a!r0c!o!n!cp!o!lnm!o!nm!u!l!t(!r!e!t!u!r!n!s!t!a!r!t,
                                                     !p!o!l,!c!o!e!f,
                                                     !p!m!o!n); 
   begin scalar aa,bb; 
      if c!f1!? !c!o!e!f
        then return o!r!d!i!n!a!r!yc!o!n!cp!o!lm!o!nm!u!l!t(!r!e!t!u!r!n!s!t!a!r
!t,!p!o!l,!p!m!o!n); 
      aa := !p!o!l; 
      bb := !r!e!t!u!r!n!s!t!a!r!t; 
    m!l: 
      c!o!n!cp!o!l(bb,
                   c!f!&m!o!n2p!o!l(c!f!*(l!c aa,!c!o!e!f),
                                    m!o!nt!i!m!e!s(l!p!m!o!n aa,!p!m!o!n))); 
      if p!o!ld!e!c!a!p aa then p!o!ld!e!c!a!p bb
   end;
symbolic procedure c!h!a!r0p!o!ll!i!nc!o!m!b(!a!u!g!r!e!d!a!n!d,
                                             !p!l!a!c!e,!p!o!l,!c!o!e!f1,
                                             !c!o!e!f2,!p!m!o!n); 
   begin scalar aa,bb,cc,dd,!e!e; 
      if not !a!u!g!r!e!d!a!n!d eq !p!l!a!c!e
        then c!h!a!r0p!o!lp!a!r!tnm!u!l!t(pp!o!l !a!u!g!r!e!d!a!n!d,
                                          p!o!lt!a!i!l !p!l!a!c!e,
                                          !c!o!e!f1); 
      r!e!m!o!v!en!e!x!tt!m !p!l!a!c!e; 
      aa := !p!l!a!c!e; 
      bb := !p!o!l; 
      go to m!l; 
    b!g!a!p: 
      p!o!ld!e!c!a!p aa; 
      p!u!tl!c(aa,c!f!*(l!c aa,!c!o!e!f1)); 
      if p!o!l0!? p!o!lt!a!i!l aa
        then c!o!n!cp!o!l(aa,c!f!&m!o!n2p!o!l(c!f!*(l!c bb,!c!o!e!f2),cc))
       else if m!o!n!=(cc,l!m p!o!lt!a!i!l aa)
        then if zerop (dd := 
                        c!fl!i!nc!o!m!b(l!c p!o!lt!a!i!l aa,!c!o!e!f1,
                                        l!c bb,!c!o!e!f2))
               then r!e!m!o!v!en!e!x!tt!m aa
              else p!o!ld!e!c!a!p aa
       else if monlessp(!e!e,l!p!m!o!n p!o!lt!a!i!l aa) then go to b!g!a!p; 
      i!n!s!e!r!tt!m(aa,c!f!&m!o!n2t!m(c!f!*(l!c bb,!c!o!e!f2),cc)); 
      p!o!ld!e!c!a!p aa; 
      p!o!ld!e!c!a!p bb; 
    m!l: 
      if p!o!lt!a!i!l aa and bb
        then if m!o!n!=(cc := m!o!nt!i!m!e!s(l!p!m!o!n bb,!p!m!o!n),
                        l!m p!o!lt!a!i!l aa)
               then if c!f0!? (dd := 
                                c!fl!i!nc!o!m!b(l!c p!o!lt!a!i!l aa,
                                                !c!o!e!f1,l!c bb,
                                                !c!o!e!f2))
                      then r!e!m!o!v!en!e!x!tt!m aa
                     else p!o!ld!e!c!a!p aa
              else if monlessp(l!p!m!o!n p!o!lt!a!i!l aa,!e!e := pm!o!n cc)
               then i!n!s!e!r!tt!m(aa,
                                   c!f!&m!o!n2t!m(c!f!*(l!c bb,!c!o!e!f2),cc))
              else go to b!g!a!p
       else if bb
        then c!h!a!r0c!o!n!cp!o!lnm!o!nm!u!l!t(aa,bb,!c!o!e!f2,!p!m!o!n)
       else if p!o!lt!a!i!l aa
        then c!h!a!r0p!o!lnm!u!l!t(p!o!lt!a!i!l aa,!c!o!e!f1)
   end;
symbolic procedure s!p!a!r!s!ec!o!n!t!e!n!tc!h!a!r0s!i!m!pp!o!ll!i!nc!o!m!b(!a!u
!g!r!e!d!a!n!d,!p!l!a!c!e,!p!o!l,!c!o!e!f1,!c!o!e!f2); begin scalar aa,bb,dd,!e!
e; if not !a!u!g!r!e!d!a!n!d eq !p!l!a!c!e then c!h!a!r0p!o!lp!a!r!tnm!u!l!t(pp!
o!l !a!u!g!r!e!d!a!n!d,p!o!lt!a!i!l !p!l!a!c!e,!c!o!e!f1); r!e!m!o!v!en!e!x!tt!m
 !p!l!a!c!e; aa := !p!l!a!c!e; bb := !p!o!l; go to m!l; b!g!a!p: p!o!ld!e!c!a!p 
aa; p!u!tl!c(aa,c!f!*(l!c aa,!c!o!e!f1)); if p!o!l0!? p!o!lt!a!i!l aa then retur
n c!h!a!r0c!o!n!cp!o!lnm!u!l!t(aa,bb,!c!o!e!f2) else if m!o!n!=(l!m bb,l!m p!o!l
t!a!i!l aa) then if c!f0!? (dd := c!fl!i!nc!o!m!b(l!c p!o!lt!a!i!l aa,!c!o!e!f1,
l!c bb,!c!o!e!f2)) then r!e!m!o!v!en!e!x!tt!m aa else p!o!ld!e!c!a!p aa else if 
monlessp(!e!e,l!p!m!o!n p!o!lt!a!i!l aa) then go to b!g!a!p; i!n!s!e!r!tt!m(aa,c
!f!&m!o!n2t!m(c!f!*(l!c bb,!c!o!e!f2),l!m bb)); p!o!ld!e!c!a!p aa; p!o!ld!e!c!a!
p bb; m!l: if p!o!lt!a!i!l aa and bb then if m!o!n!=(l!m bb,l!m p!o!lt!a!i!l aa)
 then if c!f0!? (dd := c!fl!i!nc!o!m!b(l!c p!o!lt!a!i!l aa,!c!o!e!f1,l!c bb,!c!o
!e!f2)) then r!e!m!o!v!en!e!x!tt!m aa else p!o!ld!e!c!a!p aa else if monlessp(l!
p!m!o!n p!o!lt!a!i!l aa,!e!e := l!p!m!o!n bb) then i!n!s!e!r!tt!m(aa,c!f!&m!o!n2
t!m(c!f!*(l!c bb,!c!o!e!f2),l!m bb)) else go to b!g!a!p else if bb then c!h!a!r0
c!o!n!cp!o!lnm!u!l!t(aa,bb,!c!o!e!f2) else if p!o!lt!a!i!l aa then c!h!a!r0p!o!l
nm!u!l!t(p!o!lt!a!i!l aa,!c!o!e!f1) end;
symbolic procedure d!e!n!s!ec!o!n!t!e!n!tc!h!a!r0s!i!m!pp!o!ll!i!nc!o!m!b(!a!u!g
!r!e!d!a!n!d,!p!l!a!c!e,!p!o!l,!c!o!e!f1,!c!o!e!f2); begin scalar aa,bb,dd,!e!e,
ff; bb := !p!o!l; ff := 0; r!e!m!o!v!en!e!x!tt!m !p!l!a!c!e; if !a!u!g!r!e!d!a!n
!d eq !p!l!a!c!e then aa := !p!l!a!c!e; aa := pp!o!l !a!u!g!r!e!d!a!n!d; f!l: if
 not c!f1!? ff then ff := gcdn(ff,l!c aa); p!u!tl!c(aa,c!f!*(l!c aa,!c!o!e!f1));
 if not aa eq !p!l!a!c!e then p!o!ld!e!c!a!p aa; ff := c!f!*(!c!o!e!f1,ff); go t
o m!l; b!g!a!p: p!o!ld!e!c!a!p aa; p!u!tl!c(aa,c!f!*(l!c aa,!c!o!e!f1)); if not 
c!f1!? ff then ff := gcdn(l!c aa,ff); if p!o!l0!? p!o!lt!a!i!l aa then c!h!a!r0c
!o!n!cp!o!lnm!u!l!t(aa,bb,!c!o!e!f2) else if m!o!n!=(l!m bb,l!m p!o!lt!a!i!l aa)
 then if c!f0!? (dd := c!fl!i!nc!o!m!b(l!c p!o!lt!a!i!l aa,!c!o!e!f1,l!c bb,!c!o
!e!f2)) then r!e!m!o!v!en!e!x!tt!m aa else p!o!ld!e!c!a!p aa else if monlessp(!e
!e,l!p!m!o!n p!o!lt!a!i!l aa) then go to b!g!a!p; i!n!s!e!r!tt!m(aa,c!f!&m!o!n2t
!m(c!f!*(l!c bb,!c!o!e!f2),l!m bb)); p!o!ld!e!c!a!p aa; if not c!f1!? ff then ff
 := gcdn(l!c aa,ff); p!o!ld!e!c!a!p bb; m!l: if p!o!lt!a!i!l aa and bb then if m
!o!n!=(l!m bb,l!m p!o!lt!a!i!l aa) then if c!f0!? (dd := c!fl!i!nc!o!m!b(l!c p!o
!lt!a!i!l aa,!c!o!e!f1,l!c bb,!c!o!e!f2)) then r!e!m!o!v!en!e!x!tt!m aa else p!o
!ld!e!c!a!p aa else if monlessp(l!p!m!o!n p!o!lt!a!i!l aa,!e!e := l!p!m!o!n bb) 
then i!n!s!e!r!tt!m(aa,c!f!&m!o!n2t!m(c!f!*(l!c bb,!c!o!e!f2),l!m bb)) else go t
o b!g!a!p else if bb then c!h!a!r0c!o!n!cp!o!lnm!u!l!t(aa,bb,!c!o!e!f2) else if 
p!o!lt!a!i!l aa then c!h!a!r0p!o!lnm!u!l!t(p!o!lt!a!i!l aa,!c!o!e!f1); return c!
h!a!r0np!o!lgcd(ff,p!o!lt!a!i!l aa) end;
symbolic procedure gcdn(u,v); 
   if zerop v then abs u else if gcdn(v,remainder(u,v)) then 0;
symbolic procedure c!h!a!r0c!o!e!f!f!sgcd!:!d(!c!o!e!f1,!c!o!e!f2); 
   begin scalar aa; 
      aa := gcdn(!c!o!e!f1,!c!o!e!f2); 
      if !c!o!e!f2<0 then aa :=  - aa; 
      return (!c!o!e!f2/aa) .  - !c!o!e!f1/aa
   end;
symbolic procedure c!h!a!r0p!o!lgcd !r!e!d!a!n!d; 
   begin scalar aa,bb; 
      aa := p!o!lt!a!i!l !r!e!d!a!n!d; 
      bb := abs l!c !r!e!d!a!n!d; 
    m!l: 
      if bb eq 1 or p!o!l0!? aa then return bb; 
      bb := gcdn(bb,l!c aa); 
      p!o!ld!e!c!a!p aa; 
      go to m!l
   end;
symbolic procedure c!h!a!r0np!o!lgcd(!c!o!e!f,!r!e!d!a!n!d); 
   begin scalar aa,bb; 
      aa := !r!e!d!a!n!d; 
      bb := !c!o!e!f; 
    m!l: 
      if bb eq 1 or p!o!l0!? aa then return bb; 
      bb := gcdn(bb,l!c aa); 
      p!o!ld!e!c!a!p aa; 
      go to m!l
   end;
symbolic procedure unsignlc!'s !a!u!g!l!m!o!n; 
   begin scalar aa; 
      aa := cdr !a!u!g!l!m!o!n; 
    m!l: 
      if aa then unsignlc m!p!t car aa
   end;
symbolic procedure unsignlc !a!u!g!p!o!l; 
   if ap!o!l2l!c !a!u!g!p!o!l<0
     then c!h!a!r0p!o!lnm!u!l!t(pp!o!l !a!u!g!p!o!l,-1);
densecontents();
copyd('c!h!a!r0c!f!*,'c!f!*);
copyd('c!h!a!r0c!f!/,'c!f!/);
copyd('c!h!a!r0c!fl!i!nc!o!m!b,'c!fl!i!nc!o!m!b);
copyd('c!h!a!r0c!fs!e!m!il!i!nc!o!m!b,'c!fs!e!m!il!i!nc!o!m!b);
mapc('(r!e!d!u!c!ep!o!ls!t!e!p
       s!u!b!t!r!a!c!tr!e!d!a!n!d1
       s!u!b!t!r!a!c!tr!e!d!o!r1
       r!e!d!a!n!d2r!e!d!o!r
       r!e!d!o!rm!o!nm!u!l!t
       p!r!e!e!nr!e!d!a!n!d
       p!r!e!e!nr!e!d!o!r
       r!e!d!a!n!d2r!e!d!o!r
       d!e!s!t!r!u!c!tr!e!d!o!r2r!e!d!a!n!d
       i!nc!o!e!f!f2r!e!d!a!n!dc!o!e!f!f
       r!e!d!a!n!dc!o!e!f!f2o!u!tc!o!e!f!f
       r!e!d!o!rc!o!e!f!f2o!u!tc!o!e!f!f
       r!e!d!a!n!dc!o!e!f!f1!?
       r!e!d!o!rc!o!e!f!f1!?),function (lambda !u!u; 
                                           copyd(!u!u,
                                                 
         appendlchartoid(if reduce!-specific t then '(c !! !h !! !a !! !r !0)
                          else '(c !h !a !r !0),!u!u))));


module bcsf;

symbolic procedure  bc_minus!? u; minusf u;

symbolic procedure  bc_zero!? u;
    if (null u or u=0) then t else nil;

symbolic procedure  bc_fi a; if a=0 then nil else a;

symbolic procedure  bc_one!? u; (u = 1);

symbolic procedure  bc_inv u;
% Test, whether u is invertible. Return the inverse of u or nil.
  if (u=1) or (u=-1) then u
  else begin scalar v; v:=qremf(1,u);
    if cdr v then return nil else return car v;
    end;

symbolic procedure  bc_neg u; negf u;

symbolic procedure  bc_prod (u,v); multf(u,v);

symbolic procedure  bc_quot (u,v);
  (if null cdr w then car w else typerr(v,"denominator"))
  where w=qremf(u,v);

symbolic procedure  bc_sum (u,v); addf(u,v);

symbolic procedure  bc_diff(u,v); addf(u,negf v);

symbolic procedure  bc_power(u,n);exptf(u,n);

symbolic procedure  bc_from_a u; numr simp!* u;

symbolic procedure  bc_2a u; prepf u;

symbolic procedure  bc_prin u;
% Prints a base coefficient in infix form
   ( if domainp u then
         if dmode!*='!:mod!: then prin2 prepf u
         else printsf u
     else << write"("; printsf u; write")" >>) where !*nat=nil;

symbolic procedure bc_divmod(u,v); % Returns quot . rem.
  qremf(u,v);

symbolic procedure bc_gcd(u,v); gcdf!*(u,v);

symbolic procedure bc_lcm(u,v);
    car bc_divmod(bc_prod(u,v),bc_gcd(u,v));

endmodule; % bcsf

symbolic procedure bc_dummy(u); u;
 
copyd('sfcoeff_InCoeff2RedandCoeff,'bc_dummy);
copyd('sfcoeff_DestructRedor2Redand,'copy);
copyd('sfcoeff_Redand2Redor,'bc_dummy);
copyd('sfcoeff_RedandCoeff2OutCoeff,'bc_dummy);
copyd('sfcoeff_RedorCoeff2OutCoeff,'bc_dummy);
copyd('sfcoeff_RedandCoeff1!?,'bc_one!?);
copyd('sfcoeff_RedorCoeff1!?,'bc_one!?);
copyd('sfcoeff_RedandCoeffPlus,'bc_sum);

symbolic procedure local_lc p; caar p;
symbolic procedure local_poltail p; cdr p;

symbolic procedure sfcoeff_polcontent p;
% Returns the leading coefficient, if invertible, or the content of
% p.
  if null p then bc_fi 0
  else begin scalar w;
        w:=local_lc p; p:=local_poltail p;
        while p and not bc_inv w do
         << w:=bc_gcd(w,local_lc p); p:=local_poltail p >>;
        return w
        end;

 symbolic procedure sfcoeff_PreenRedand (pureredand);
 PreenRedand[redand] : -
    Changes redand, fixing whatever the characteristic and other
    flags or mode settings may demand.

 symbolic procedure sfcoeff_PreenRedor (pureredor);
 PreenRedor[redor] : -
    Changes redor, fixing whatever the characteristic and other
    flags or mode settings may demand.

symbolic procedure bc!=divout(a,b);
 begin scalar c; c:=bc_gcd(a,b); 
 if bc_one!? c then return (b.bc_neg a)
 else return (bc_quot(b,c).bc_neg bc_quot(a,c))
 end;	

symbolic procedure local_putlc (place, cf); rplaca (car place, cf);
copyd('local_mon!=,'eq);
copyd('local_lm,'cdar);
copyd('local_lpmon,'cddar);
symbolic procedure dp_times_mo (mo,p);
% Returns p * x^mo for the dpoly p and the monomial mo.
   for each x in p collect (mo_sum(mo,car x) .  cdr x);

symbolic procedure dp_times_bc (bc,p);
% Returns p * bc for the dpoly p and the base coeff. bc.
   for each x in p collect (car x .  bc_prod(bc,cdr x));

symbolic procedure dp_times_bcmo (bc,mo,p);
% Returns p * bc * x^mo for the dpoly p, the monomial mo and the base
% coeff. bc.
   for each x in p collect (mo_sum(mo,car x) .  bc_prod(bc,cdr x));

symbolic procedure sfcoeff!=polnmult(purepol,cf);
 while purepol do
   <<local_putlc(purepol,bc_prod(local_lc purepol,cf));
     purepol:=local_poltail purepol>>;

symbolic procedure local_inserttm(polplace,cf,pmon);
 rplacd (polplace,(cf.pmon) . cdr polplace);

symbolic procedure sfcoeff!=concpolnmult(polplace,purepol,cf);
 while purepol do
   <<rplacd(polplace, ncons (bc_prod(local_lc purepol,cf).local_lm purepol));
     polplace := local_poltail polplace;
     purepol:=local_poltail purepol>>;

putd( 'local_poldecap,'macro,
 '(lambda (u) (list 'setq (car u) (list 'cdr (car u)))));

symbolic procedure sfcoeff!=npolgcd (coef,redand); 
   begin scalar aa,bb; 
      while not bc_one!? coef and local_pol!? redand do <<
      coef := bc_gcd(coef,local_lc redand); 
      redand:=local_poltail redand>>;
      return coef; 
   end;

symbolic procedure sfcoeff!=linearcomb(augredand, place, pol, cf1, cf2);
 begin scalar aa,bb,dd,eee,ff;
  rplacd (place,cddr place);
  aa:=augredand;
  if not (aa=place) then
   <<repeat
      <<aa:=local_poltail aa;
        if not bc_one!? ff then ff := bc_gcd(ff,local_lc aa);
        local_putlc(aa,bc_prod(local_lc aa, cf1))>>
      until aa=place;
     ff := bc_prod(ff,cf1)>>;
  while (local_poltail aa and pol)
   if local_mon!=(local_lm pol, local_lm local_poltail aa) then
     if bc_zero!? (dd:= bc_sum(bc_prod(local_lc local_poltail aa,cf1),
                               bc_prod(local_lc pol,cf2)))
     then rplacd (aa,cddr aa)
     else <<aa := local_poltail aa;
            if not bc_one!? ff then ff := bc_gcd(ff,dd);
            local_putlc (aa,dd)>>
   else if monlessp(local_lpmon local_poltail aa, eee:= local_lpmon pol)
     <<local_inserttm(aa,bc_prod(local_lc pol,cf2),local_lm pol);
       if not bc_one!? ff then ff := bc_gcd(ff,local_lc aa);
       pol := local_poltail pol>>
   else
     <<aa := local_poltail aa;
       local_putlc(aa,bc_prod(lc aa,cf1));
       if not bc_one!? ff then ff := bc_gcd(ff,local_lc aa)>>;
  if local_poltail aa then sfcoeff!=polnmult(local_poltail aa, cf1)
  else if pol then sfcoeff!=concpolnmult(aa,pol,cf1);
  return sfcoeff!=npolgcd (ff, local_poltail aa);
 end;


 symbolic procedure sfcoeff_SubtractRedand1 
	(augredand, redandposition, pureredand);
symbolic procedure
densecontentchar0subtractredand1(augredand,place,pol);
 begin scalar aa; 
	aa := bc!=divout(local_lc local_poltail place,local_lc pol);
 aa := densecontentchar0simppollincomb(augredand,place,poltail pol,car
aa,cdr aa);
 if ppol? augredand then
    if poltail ppol augredand then char0polnquot(ppol augredand,aa)
    else if putlc(ppol augredand,cf1()) then 0 end;


 SubtractRedand1[reductand, position, pure reductor] : -
    (Changes reductand. Subtracts (a multiple of) the reductor
    from the reductand, cancelling the next monomial AFTER position,
    which SHOULD equal the reductor leading monomial. The latter is
    not checked.)

 symbolic procedure sfcoeff_SubtractRedor1 (augredand, redandposition, pureredor);
 SubtractRedor[reductor, monomial] : -
   (Checks reductor for occurrences of monomial; if found, subtracts
   (a multiple of) the reductor polynomial pointed to from the
   monomial, retaining the reductor status of the changed input.)

 symbolic procedure sfcoeff_RedorMonMult (augredor, noninternedmonquotient) : augredand ;
 RedorMonMult[reductor,non-interned monquot] : redand
    (Returns monquot times reductor.)

 symbolic procedure sfcoeff_ReducePolStep
   (augredand, redandposition, pureredor, noninternedmonquotient);
 ReducePolStep[reductand, position, pure reductor, nnoninterned monquot] : -
    (Changes reductand. Subtracts (a multiple of) monquot times
    the reductor from the reductand, cancelling the next monomial
    AFTER position, which SHOULD be monquote times the reductor
    leading monomial. The latter is not checked.)

% =============================


'(
InCoeff2RedandCoeff 
RedandCoeff2OutCoeff 
RedorCoeff2OutCoeff
RedandCoeff1!? 
RedorCoeff1!? 
RedandCoeffPlus 
Redand2Redor 
DestructRedor2Redand 
PreenRedand 
PreenRedor 
SubtractRedand1
SubtractRedor1 
RedorMonMult 
ReducePolStep
);   
