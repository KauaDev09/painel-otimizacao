@echo off
REM Correção rápida do Windows — apenas SFC + DISM RestoreHealth.
REM Ordem recomendada pela Microsoft: RestoreHealth primeiro, depois SFC.
REM Sem pause (o orquestrador do painel usa <nul e pause gerava falso erro).
REM NÃO executa chkdsk (exige reboot e pode parecer "reset" do PC).

setlocal
set "ERR=0"

echo [ORION] DISM RestoreHealth...
dism /online /cleanup-image /restorehealth
if errorlevel 1 set "ERR=%ERRORLEVEL%"

echo [ORION] SFC /scannow...
sfc /scannow
if errorlevel 1 set "ERR=%ERRORLEVEL%"

exit /b %ERR%
