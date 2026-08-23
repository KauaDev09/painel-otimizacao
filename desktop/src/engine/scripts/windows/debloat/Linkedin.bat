@echo off
title Remover LinkedIn

echo Removendo LinkedIn...

powershell -ExecutionPolicy Bypass -Command ^
"Get-AppxPackage *LinkedIn* | Remove-AppxPackage; ^
Get-AppxProvisionedPackage -Online | Where-Object {$_.DisplayName -like '*LinkedIn*'} | Remove-AppxProvisionedPackage -Online"
powershell -ExecutionPolicy Bypass -Command "Get-AppxPackage | Where-Object {$_.Name -match 'LinkedIn'} | Remove-AppxPackage; Get-AppxProvisionedPackage -Online | Where-Object {$_.DisplayName -match 'LinkedIn'} | Remove-AppxProvisionedPackage -Online"

echo.
echo Processo concluido!
pause