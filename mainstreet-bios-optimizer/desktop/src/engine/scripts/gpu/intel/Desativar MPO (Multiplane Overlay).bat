@echo off
echo Desativando MPO...

reg add "HKLM\SOFTWARE\Microsoft\Windows\Dwm" /v OverlayTestMode /t REG_DWORD /d 5 /f

echo MPO desativado!
echo Reinicie o PC para aplicar.
pause
