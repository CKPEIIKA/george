@echo off
if -%1- == -- goto :usage 

set clisp=
if exist %1\clisp.exe set clisp=%1\clisp.exe
if -%clisp%- == -- goto :badlispdir
if exist %1\lisp.exe goto :badlispstruct
if not exist %1\full goto :badlispstruct
if not exist %1\full\lisp.exe goto :badlispstruct 
if not exist %1\full\lispinit.mem goto :badlispstruct 
rem I've got clisp in the var clisp
rem I need the var clispa: working clisp which uses the full set and more memory
set clispa=%clisp% -K full -m 20M

copy getbmroot_0.bat ..\..\..\getbmroot.bat > nul
cd ..\..\..
cd >>getbmroot.bat
call getbmroot.bat
del getbmroot.bat
rem Now I have bmroot (Bergman root)

set bmsrc=%bmroot%\src
set bmdomains=%bmroot%\domains
set bmaux=%bmroot%\auxil
set bmauxil=%bmroot%\auxil
set bmload=%bmroot%\lap\clisp\win9598nt
set bmexe=%bmroot%\bin\clisp\win9598nt

copy scripts\clisp\win9598nt\getbmvers_0.bat getbmvers.bat > nul
type auxil\version >> getbmvers.bat
call getbmvers.bat
del getbmvers.bat 

set clsrc=%bmroot%\scripts\clisp\win9598nt
set clbin=%bmroot%\bin\clisp\win9598nt
set clasrc=%bmaux%\clisp

%clispa% %clasrc%\prelisp.lsp
if ERRORLEVEL 1 goto :badlisp

echo Starting the installation...
echo Starting the installation... > bergman.log
echo Using Bergman root [%bmroot%]
echo Using Bergman root [%bmroot%] >> bergman.log
echo Using CLISP [%clispa%]
echo Using CLISP [%clispa%] >> bergman.log

cd bin\clisp\win9598nt

echo Copying files...
echo Copying files... >> bergman.log

rem Copying necessary files
copy %clsrc%\setcmp1.sl speccmp1.sl > nul
copy %clsrc%\setcmp2.sl speccmp2.sl > nul
copy %clsrc%\setlisp.sl speclisp.sl > nul
copy %clsrc%\setmacr.sl specmacr.sl > nul
copy %clsrc%\setmode.sl specmode.sl > nul
copy %clasrc%\versmacr.sl > nul
copy %clasrc%\environ0.lsp > nul
copy %clasrc%\environ.lsp > nul
copy %clasrc%\switches.lsp > nul
copy %clasrc%\envhead-cl.lsp + %clasrc%\compext-cl.lsp compext-cl.lsp > nul
copy %clasrc%\envhead-cl.lsp + %clasrc%\comphead-cl.lsp + %clasrc%\..\compile.sl + %clasrc%\comptail-cl.lsp compile-cl.lsp > nul
copy %clasrc%\envhead-cl.lsp + %clasrc%\comphead-cl.lsp + %clasrc%\..\compan.sl + %clasrc%\comptail-cl.lsp compan.lsp > nul
copy %clasrc%\envhead-cl.lsp + %clasrc%\bmhead-cl.lsp + %clasrc%\..\bmtop.sl + %clasrc%\bmtail-cl.lsp bmtop-cl.lsp > nul
copy %bmsrc%\alg2lsp.sl > nul
copy %clsrc%\bergman.pif > nul
copy %clasrc%\checkerr.lsp > nul
copy %clasrc%\mkenvv.lsp > nul

echo Creating fullversion...
echo Creating fullversion... >> bergman.log

rem Creating fullversion
del %bmauxil%\fullversion > nul
copy /b %bmauxil%\fvstart + %bmauxil%\version + %bmauxil%\fvend %bmauxil%\fullversion > nul

echo Deleting old binaries...
echo Deleting old binaries... >> bergman.log

rem Deleting old binaries
del %bmload%\*. > nul
del %bmload%\*.fas > nul
del %bmload%\*.lib > nul
del %bmexe%\lispinit.mem > nul
del %bmexe%\*. > nul
del %bmexe%\bergman.bat > nul
del %bmexe%\bergman.exe > nul
del %bmexe%\*.dll > nul

echo Compiling SL translation package...
echo Compiling SL translation package... >> bergman.log

rem Compiling  SL translation package (environ)
%clispa% < mkenvv.lsp >> bergman.log

echo Compiling SL extensions...
echo Compiling SL extensions... >> bergman.log

rem Compiling SL extensions
%clispa%  < compext-cl.lsp >> bergman.log

echo Compiling Bergman and HSeries...
echo Compiling Bergman and HSeries... >> bergman.log

rem Compiling Bergman and HSeries
%clispa% < compile-cl.lsp >> bergman.log

echo Compiling Anick...
echo Compiling Anick... >> bergman.log

rem Compiling Anick
%clispa% < compan.lsp >> bergman.log

echo Copying generated files...
echo Copying generated files... >> bergman.log

rem Copying generated files
copy %bmload%\*. > nul
copy %bmload%\alg2lsp.* > nul
copy %bmload%\alg2lsp.fas %bmload%\alg2lsp.b > nul

echo Generating the image...
echo Generating the image... >> bergman.log

rem Generating the image
%clispa% < bmtop-cl.lsp >> bergman.log

%clispa% checkerr.lsp 
if ERRORLEVEL 1 echo There are errors. Please check the log file

echo Copying necessary DLLs if any... 
echo Copying necessary DLLs if any... >> bergman.log

rem Copying necessary DLLs if any... 
copy %1\full\*.dll %bmexe% > nul 

echo Producing bergman.bat ...
echo Producing bergman.bat ... >> bergman.log

rem Producing bergman.bat ...
echo @echo off> bergman.bat
echo %bmexe%\bergman.exe -m 50M %%1 %%2 %%3 %%4 %%5 %%6 %%7 %%8 %%9 >> bergman.bat

copy %bmroot%\logs\clwin9598nt.log %bmroot%\logs\clwin9598nt.old  > nul
move bergman.log %bmroot%\logs\clwin9598nt.log  > nul

del *.sl > nul
del *.lsp > nul
del *.fas > nul
del *.lib > nul
del *.b > nul
del *. > nul
copy %bmload%\anick > nul
copy %bmload%\hseries > nul

echo Installation finished, check the log file
goto :end
:usage
echo Usage:
echo  %0 CLISP-dir
goto :end

:badlisp
echo You have an older lisp version
goto :end

:badlispdir
echo Wrong CLISP directory; %1\clisp.exe not found
goto :end  
 
:badlisstruct
echo Wrong (old?) CLISP directory structure: 
echo   nor %1\full\lisp.exe nor %1\full\lispinit.mem not found
echo   or %1\lisp.exe found 
echo Reinstall your CLISP
goto :end  
 
:end
echo Installation batch file terminated
pause
