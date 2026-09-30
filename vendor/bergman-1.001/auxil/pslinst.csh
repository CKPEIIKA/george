#!/bin/csh
# auxil/pslinst.csh

# Problems (inter alia):

# - The psl procedure SYSTEM calls sh, not csh.

# - SYSTEM output is on the stdout, not respecting psl WRS (WRite Select).

# - Even if we could get around this, these psl procedures and behaviours
#   are (probably) not very standard.

# - The small script part
##   $tmpPSL <<EOR1>tmparch
##   (system "echo $MACHINE")
##   EOR1
#   collapses, because csh (tries to) expand $MACHINE BEFORE it is read by
#   the psl shell.


rm -f tmppi*

while test -z "$tmpPSL"; do
  tmpPSL=`which psl`;
  if [ -z "$tmpPSL" -o ! -x "$tmpPSL" ]; then
    echo "I cannot find the psl executable."
    echo "where is it?"
    set tmpPSL=$<
  fi
done

#$tmpPSL<"auxil/setenv.psl" > "/tmp.$$"
#. /tmp.$$

./auxil/pslvars.csh
source tmpvars

if [ -z "$MACHINE" -o -z "$proot" ]; then
  echo "Your psl $tmpPSL didn't set \$MACHINE and/or \$proot"
  echo "Something is terribly wrong with your $tmpPSL, please"
  echo "check your psl installation and restart"
  exit -1
fi

# $MACHINE and $proot are set.

# Now set the bmroot: ......


echo "I will now install bergman under psl using the following settings: "
% echo "PSL: $tmpPSL"
echo "MACHINE: $MACHINE"
echo "proot: $proot"
echo 
echo -n  "Is this ok (y/n)"
set ans=$<
# One might argue for a while loop around this giving
# the user an oportunity to practice using the keyboard.
switch ($ans)
 case [Yy]*:
	 ./scripts/$MACHINE/mkbergman $proot .
	 breaksw

 case [Nn]*:
	 echo "Ok; you may follow the instructions in ReadMe instead."
	 exit
endsw
     
