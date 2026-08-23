@echo off
echo Desativando serviços AMD Crash...
sc stop AMD Crash Defender Service
sc config "AMD Crash Defender Service" start= disabled
pause
