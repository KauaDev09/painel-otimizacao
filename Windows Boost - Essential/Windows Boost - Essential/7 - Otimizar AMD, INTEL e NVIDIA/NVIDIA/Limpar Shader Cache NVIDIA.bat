@echo off
echo Limpando Shader Cache NVIDIA...
del /s /f /q "%LOCALAPPDATA%\NVIDIA\DXCache\*"
del /s /f /q "%LOCALAPPDATA%\NVIDIA\GLCache\*"
pause
