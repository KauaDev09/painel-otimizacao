@echo off

echo Otimizando prioridade do sistema...

reg add "HKLM\SYSTEM\CurrentControlSet\Control\PriorityControl" /v Win32PrioritySeparation /t REG_DWORD /d 38 /f

echo Concluido!
pause
