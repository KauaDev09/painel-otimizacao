@echo off
title Desativar Isolamento de Nucleo e VBS

net session >nul 2>&1
if %errorlevel% neq 0 (
    echo Execute este arquivo como administrador.
    pause
    exit /b
)

echo Desativando Integridade de Memoria...
reg add "HKLM\SYSTEM\CurrentControlSet\Control\DeviceGuard\Scenarios\HypervisorEnforcedCodeIntegrity" /v "Enabled" /t REG_DWORD /d 0 /f

echo Desativando VBS...
reg add "HKLM\SYSTEM\CurrentControlSet\Control\DeviceGuard" /v "EnableVirtualizationBasedSecurity" /t REG_DWORD /d 0 /f

echo Desativando inicializacao do Hypervisor...
bcdedit /set hypervisorlaunchtype off

echo.
echo Isolamento de Nucleo, HVCI e VBS foram desativados.
echo Reinicie o computador para aplicar.
pause