#!/bin/csh
# extracts $MACHINE and $proot settings from executable psl.
# The result is (hopefully) a file tmpvars, sourcing of which sets
# the variables.

## $tmpPSL should be set to an executable psl  before executing this.

rm -f tmpvars*
setenv tmpPSL /usr/local/bin/psl

$tmpPSL <auxil/fpslvars.sl

cat auxil/fpslv1 tmpvars1 auxil/fpslv2 tmpvars2 auxil/fpslv4 tmpvars4 > tmpvars
