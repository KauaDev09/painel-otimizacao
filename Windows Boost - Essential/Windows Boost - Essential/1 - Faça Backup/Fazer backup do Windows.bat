@echo off
title Backup do Registro do Windows

echo Criando pasta de backup...
if not exist "%~dp0Backup_Regedit" mkdir "%~dp0Backup_Regedit"

echo Fazendo backup do Registro...

reg export HKLM "%~dp0Backup_Regedit\HKLM.reg" /y
reg export HKCU "%~dp0Backup_Regedit\HKCU.reg" /y
reg export HKCR "%~dp0Backup_Regedit\HKCR.reg" /y
reg export HKU "%~dp0Backup_Regedit\HKU.reg" /y
reg export HKCC "%~dp0Backup_Regedit\HKCC.reg" /y

echo.
echo Backup do regedit concluido com sucesso!
echo Arquivos salvos em: Backup_Regedit
echo Criando ponto de Restauração...
reg add "HKLM\Software\Microsoft\Windows NT\CurrentVersion\SystemRestore" /v SystemRestorePointCreationFrequency /t REG_DWORD /d 0 /f >nul
powershell -Command "Checkpoint-Computer -Description 'iGust Windows Boost' -RestorePointType 'MODIFY_SETTINGS'"
echo(
echo Backup concluido!
pause
