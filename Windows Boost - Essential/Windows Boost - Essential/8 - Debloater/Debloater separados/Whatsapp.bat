@echo off
title Remover WhatsApp

echo Removendo WhatsApp...

powershell -ExecutionPolicy Bypass -Command ^
"Get-AppxPackage *WhatsApp* | Remove-AppxPackage; ^
Get-AppxProvisionedPackage -Online | Where-Object {$_.DisplayName -like '*WhatsApp*'} | Remove-AppxProvisionedPackage -Online"
powershell -ExecutionPolicy Bypass -Command "Get-AppxPackage | Where-Object {$_.Name -match 'WhatsApp'} | Remove-AppxPackage; Get-AppxProvisionedPackage -Online | Where-Object {$_.DisplayName -match 'WhatsApp'} | Remove-AppxProvisionedPackage -Online"

echo.
echo Processo concluido!
pause