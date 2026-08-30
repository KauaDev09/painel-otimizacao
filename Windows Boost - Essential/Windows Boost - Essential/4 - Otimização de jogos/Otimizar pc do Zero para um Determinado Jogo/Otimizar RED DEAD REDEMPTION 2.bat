@echo off
chcp 65001 >nul
cls
setlocal enabledelayedexpansion

set "line1=                   ▄▄ •  ▄▄▄· • ▌ ▄ ·. ▄▄▄ .    ▄▄▄▄·             .▄▄ · ▄▄▄▄▄▄▄▄ .▄▄▄  
set "line2=                  ▐█ ▀ ▪▐█ ▀█ ·██ ▐███▪▀▄.▀·    ▐█ ▀█▪▪     ▪     ▐█ ▀. •██  ▀▄.▀·▀▄ █·
set "line3=                  ▄█ ▀█▄▄█▀▀█ ▐█ ▌▐▌▐█·▐▀▀▪▄    ▐█▀▀█▄ ▄█▀▄  ▄█▀▄ ▄▀▀▀█▄ ▐█.▪▐▀▀▪▄▐▀▀▄ 
set "line4=                  ▐█▄▪▐█▐█ ▪▐▌██ ██▌▐█▌▐█▄▄▌    ██▄▪▐█▐█▌.▐▌▐█▌.▐▌▐█▄▪▐█ ▐█▌·▐█▄▄▌▐█•█▌
set "line5=                  ·▀▀▀▀  ▀  ▀ ▀▀  █▪▀▀▀ ▀▀▀     ·▀▀▀▀  ▀█▄▀▪ ▀█▄▀▪ ▀▀▀▀  ▀▀▀  ▀▀▀ .▀  ▀
set "line6=                                                                                       '
set "line7=                                              inicializando...
echo.


for /L %%i in (1,1,7) do (
    call echo %%line%%i%%
    REM delay ~250ms (ajuste -w para mais/menos ms)
    ping 127.0.0.1 -n 1 -w 120 >nul
)

timeout /t 3 >nul
cls

set /a randomico=%random% %% 4

:: COR BASE (Ciano neon)
set /a corBaseR=0
set /a corBaseG=255
set /a corBaseB=255

:: VARIAÇÃO (Ciano → Rosa neon)
set /a variacaoR=255     :: 0 → 255
set /a variacaoG=-255    :: 255 → 0
set /a variacaoB=-105    :: 255 → 150


set g=[92m
set r=[91m
set red=[04m
set l=[1m
set w=[0m
set b=[94m
set m=[95m
set p=[35m
set c=[35m
set d=[96m
set u=[0m
set z=[91m
set n=[96m
set y=[40;33m
set g2=[102m
set r2=[101m
set t=[40m
set gg=[93m
set q=[90m
set gr=[32m
set o=[38;5;202m
set bb=[38;5;74m
set nn=[38;5;82m
set rr=[1;91m
set blb=[1;94m
set bn=[1;38;5;129m
set ha=[38;5;203m
set frr=[38;2;0;255;255m
set fw=[97m
set "redd=[04m" 
set ha=[38;5;203m
set "fk=[92m" 
set "xv=[91m" 
set "spar=[04m" 
set "sof=[1m" 
set "ww=[0m" 
set "bvv=[94m" 
set "op=[96m" 
set "tq=[0m" 
set "mnb=[91m"
set "zi=[96m" 
set "er=[40;33m" 
set "po=[40m" 
set "pu=[93m" 
set "cya=[96m" 
set "ggg=[90m" 
set "rp=[35m" 
set "drp=[95m" 
set "dr=[38;5;90m" 

cls


title iGust Red Dead Redemption 2 Optimizer
cls
set "ESC="
cls

:menu

echo(

set "lines[0]=                        __________  ________    ________  
set "lines[1]=                        \______   \ \______ \   \_____  \ 
set "lines[2]=                         |       _/  |    |  \   /  ____/ 
set "lines[3]=                         |    |   \  |    `   \ /       \ 
set "lines[4]=                         |____|_  / /_______  / \_______ \
set "lines[5]=                                \/          \/          \/

for /L %%j in (0,1,82) do (
    set /a "corR=corBaseR + (variacaoR * %%j / 82)"
    set /a "corG=corBaseG + (variacaoG * %%j / 82)"
    set /a "corB=corBaseB + (variacaoB * %%j / 82)"
    set "esc[%%j]=!ESC![38;2;!corR!;!corG!;!corB!m"
)

for /L %%i in (0,1,5) do (
    set "texto=!lines[%%i]!"
    set "textoGradiente="
    for /L %%j in (0,1,82) do (
        set "char=!texto:~%%j,1!"
        if "!char!" == " " set "char= "
        set "textoGradiente=!textoGradiente!!esc[%%j]!!char!"
    )
    echo( !textoGradiente!!ESC![0m
)

echo.
echo                      Escolha a %op%opção%w% para %op%Otimizar%w% seu %op%jogo%w%:
echo.
echo.
echo                         %m%[ %m%1 %m%]%w% Criar Ponto de Restauração%w%
echo.
echo             %m%[ %m%2 %m%]%w% Aumentar prioridade        %m%[ %m%3 %m%]%w% Otimizar Red Dead 2
echo.
 
echo.
set /p jogo="Digite o numero: "
cls
if "%jogo%"=="1" goto ponto
if "%jogo%"=="2" goto prioridade
if "%jogo%"=="3" goto rd2

cls
goto :prioridadegames

:ponto
echo Criando ponto de Restauração...
reg add "HKLM\Software\Microsoft\Windows NT\CurrentVersion\SystemRestore" /v SystemRestorePointCreationFrequency /t REG_DWORD /d 0 /f >nul
powershell -Command "Checkpoint-Computer -Description 'iGust RestorePoint' -RestorePointType 'MODIFY_SETTINGS'"
echo(
echo Ponto de restauração criado com sucesso!
pause
cls
goto :prioridadegames

:prioridade
echo Aumentando prioridade do Red Dead Redemption 2...
reg add "HKEY_LOCAL_MACHINE\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Image File Execution Options\RDR2.exe" /f
reg add "HKEY_LOCAL_MACHINE\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Image File Execution Options\RDR2.exe\PerfOptions" /f
reg add "HKEY_LOCAL_MACHINE\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Image File Execution Options\RDR2.exe\PerfOptions" /v CpuPriorityClass /t REG_DWORD /d 3 /f
echo Prioridade do Red Dead Redemption 2 ajustada com sucesso!

pause

cls
goto :prioridadegames

:rd2
echo Otimizando Red Dead Redemption 2...

set CONFIG=%localappdata%\FortniteGame\Saved\Config\WindowsClient
echo [/Script/FortniteGame.FortGameUserSettings] > "%CONFIG%\Engine.ini"
echo bPreferD3D12=False >> "%CONFIG%\Engine.ini"

set CONFIG=%localappdata%\FortniteGame\Saved\Config\WindowsClient\GameUserSettings.ini

(
echo [ScalabilityGroups]
echo sg.ResolutionQuality=100
echo sg.ViewDistanceQuality=0
echo sg.AntiAliasingQuality=0
echo sg.ShadowQuality=0
echo sg.PostProcessQuality=0
echo sg.TextureQuality=0
echo sg.EffectsQuality=0
echo sg.FoliageQuality=0
) > "%CONFIG%"

rd /s /q "%localappdata%\FortniteGame\Saved\WebCache"

echo Desativando GameDVR e Xbox...

reg add "HKEY_CURRENT_USER\System\GameConfigStore" /v GameDVR_Enabled /t REG_DWORD /d 0 /f

reg add "HKEY_LOCAL_MACHINE\SOFTWARE\Policies\Microsoft\Windows\GameDVR" /v AllowGameDVR /t REG_DWORD /d 0 /f

echo Desativando tarefas agendadas desnecessárias...

schtasks /Change /TN "Microsoft\Windows\Customer Experience Improvement Program\Consolidator" /Disable
schtasks /Change /TN "Microsoft\Windows\Application Experience\ProgramDataUpdater" /Disable
schtasks /Change /TN "Microsoft\Windows\Autochk\Proxy" /Disable
schtasks /Change /TN "Microsoft\Windows\DiskDiagnostic\Microsoft-Windows-DiskDiagnosticDataCollector" /Disable

echo Desativando Serviços inuteis do Windows...
sc stop "wisvc"
sc config "wisvc" start= disabled

sc stop "DPS"
sc config "DPS" start= disabled

sc stop "TermService"
sc config "TermService" start= disabled

sc stop "WbioSrvc"
sc config "WbioSrvc" start= disabled

sc stop "TabletInputService"
sc config "TabletInputService" start= disabled

sc stop "wuauserv"
sc config "wuauserv" start= disabled

sc stop "DiagTrack"
sc config "DiagTrack" start= disabled

sc stop "W32Time"
sc config "W32Time" start= disabled

sc stop "WaaSMedicSvc"
sc config "WaaSMedicSvc" start= disabled

sc stop "RetailDemo"
sc config "RetailDemo" start= disabled

sc stop "igts"
sc config "igts" start= disabled

sc stop "bthserv"
sc config "bthserv" start= disabled

sc stop "DoSvc"
sc config "DoSvc" start= disabled

sc stop "Spooler"
sc config "Spooler" start= disabled

sc stop "RemoteRegistry"
sc config "RemoteRegistry" start= disabled

sc stop "SessionEnv"
sc config "SessionEnv" start= disabled

sc stop "PcaSvc"
sc config "PcaSvc" start= disabled

sc stop "Fax"
sc config "Fax" start= disabled

echo Desativando indexação...
sc stop "WSearch"
sc config "WSearch" start=disabled

Echo Desativando Efeitos Visuais...
reg add "HKCU\Software\Microsoft\Windows\CurrentVersion\Explorer\VisualEffects" /v VisualFXSetting /t REG_DWORD /d 2 /f
reg add "HKCU\Control Panel\Desktop" /v UserPreferencesMask /t REG_BINARY /d 90120000010000000000000000 /f
reg add "HKEY_CURRENT_USER\Control Panel\Desktop\WindowMetrics" /v MinAnimate /t REG_SZ /d 0 /f


reg add "HKLM\SOFTWARE\Policies\Microsoft\Windows\System" /v PublishUserActivities /t REG_DWORD /d 0 /f

Echo Desativando Atualizações automáticas...
net stop wuauserv
sc config wuauserv start= disabled
net stop bits
sc config bits start= disabled
net stop dosvc
sc config dosvc start= disabled
reg add "HKEY_LOCAL_MACHINE\SOFTWARE\Policies\Microsoft\Windows\WindowsUpdate\AU" /v "NoAutoUpdate" /t REG_DWORD /d 1 /f


echo Desativando o Cortana...
reg add "HKEY_LOCAL_MACHINE\SOFTWARE\Policies\Microsoft\Windows\Windows Search" /v AllowCortana /t REG_DWORD /d 0 /f
echo Cortana desativado!

echo Desabilitando a hibernação...
powercfg -h off
echo Hibernação desabilitada!

echo Desabilitando a Telemetria...
reg add "HKEY_LOCAL_MACHINE\SOFTWARE\Policies\Microsoft\Windows\DataCollection" /v "AllowTelemetry" /t REG_DWORD /d 0 /f
echo Telemetria desabilitada!


echo Fazendo Debbloater...
powershell -Command "Get-AppxPackage *Microsoft.Windows.Cortana* | Remove-AppxPackage"
powershell -Command "Get-AppxPackage *officehub* | Remove-AppxPackage"
powershell -Command "Get-AppxPackage *photos* | Remove-AppxPackage"
powershell -Command "Get-AppxPackage *phone* | Remove-AppxPackage"
powershell -Command "Get-AppxPackage *people* | Remove-AppxPackage"
powershell -Command "Get-AppxPackage *music* | Remove-AppxPackage"
powershell -Command "Get-AppxPackage *messaging* | Remove-AppxPackage"
powershell -Command "Get-AppxPackage *maps* | Remove-AppxPackage"
powershell -Command "Get-AppxPackage *groove* | Remove-AppxPackage"
powershell -Command "Get-AppxPackage *getstarted* | Remove-AppxPackage"
powershell -Command "Get-AppxPackage *calculator* | Remove-AppxPackage"
powershell -Command "Get-AppxPackage *alarms* | Remove-AppxPackage"
powershell -Command "Get-AppxPackage *3dbuilder* | Remove-AppxPackage"
powershell -Command "Get-AppxPackage *news* | Remove-AppxPackage"
powershell -Command "Get-AppxPackage *onedrive* | Remove-AppxPackage"

reg add "HKEY_CURRENT_USER\Software\Microsoft\Windows\CurrentVersion\Explorer\Advanced" /v ShowCopilotButton /t REG_DWORD /d 0 /f
reg add "HKEY_LOCAL_MACHINE\SOFTWARE\Policies\Microsoft\Windows\Windows Copilot" /v TurnOffWindowsCopilot /t REG_DWORD /d 1 /f
reg delete "HKEY_LOCAL_MACHINE\SOFTWARE\Microsoft\Windows\CurrentVersion\Policies\Explorer" /v HideCopilotButton /f
reg add "HKEY_LOCAL_MACHINE\SOFTWARE\Policies\Microsoft\Windows\Windows Search" /v "AllowCortana" /t REG_DWORD /d 0 /f
reg add "HKEY_CURRENT_USER\Software\Microsoft\Windows\CurrentVersion\ContentDeliveryManager" /v "SystemPaneSuggestionsEnabled" /t REG_DWORD /d 0 /f


Echo Enable Prefetcher e Superfetch
reg add "HKLM\SYSTEM\CurrentControlSet\Control\Session Manager\Memory Management\PrefetchParameters" /v EnablePrefetcher /t REG_DWORD /d 3 /f
reg add "HKLM\SYSTEM\CurrentControlSet\Control\Session Manager\Memory Management\PrefetchParameters" /v EnableSuperfetch /t REG_DWORD /d 3 /f

Echo Network Throttling
reg add "HKLM\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Multimedia\SystemProfile" /v NetworkThrottlingIndex /t REG_DWORD /d 4294967295 /f

Echo Games task priority
reg add "HKLM\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Multimedia\SystemProfile\Tasks\Games" /v "GPU Priority" /t REG_DWORD /d 8 /f
reg add "HKLM\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Multimedia\SystemProfile\Tasks\Games" /v Priority /t REG_DWORD /d 6 /f
reg add "HKLM\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Multimedia\SystemProfile\Tasks\Games" /v "Scheduling Category" /t REG_SZ /d High /f

Echo Serialize Timer Expiration
reg add "HKLM\SYSTEM\CurrentControlSet\Control\Session Manager\Power" /v SerializeTimerExpiration /t REG_DWORD /d 1 /f

Echo Large System Cache
reg add "HKLM\SYSTEM\CurrentControlSet\Control\Session Manager\Memory Management" /v LargeSystemCache /t REG_DWORD /d 0 /f

echo Limpando Cache do Windows...
set "windows=%windir%"
set "systemdrive=%systemdrive%"
set "userprofile=%userprofile%"
set "temp=%temp%"
set "history=%userprofile%\Local Settings\History"
set "cookies=%userprofile%\Cookies"
set "recent=%userprofile%\Recent"
set "printers=%systemroot%\system32\spool\printers"

del /s /f /q "%windows%\temp\*.*" 2>nul
del /s /f /q "%windows%\Prefetch\*.exe" 2>nul
del /s /f /q "%windows%\Prefetch\*.dll" 2>nul
del /s /f /q "%windows%\Prefetch\*.pf" 2>nul
del /s /f /q "%windows%\system32\dllcache\*.*" 2>nul
del /s /f /q "%systemdrive%\Temp\*.*" 2>nul
del /s /f /q "%temp%\*.*" 2>nul
del /s /f /q "%history%\*.*" 2>nul
del /s /f /q "%userprofile%\Local Settings\Temporary Internet Files\*.*" 2>nul
del /s /f /q "%userprofile%\Local Settings\Temp\*.*" 2>nul
del /s /f /q "%recent%\*.*" 2>nul
del /s /f /q "%cookies%\*.*" 2>nul

pause
cls
goto :prioridadegames