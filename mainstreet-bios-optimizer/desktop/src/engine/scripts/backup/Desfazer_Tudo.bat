@echo off
cls
color 0A
setlocal EnableExtensions

net session >nul 2>&1
if not %errorLevel%==0 (
    echo.
    echo [!] Execute este arquivo como Administrador.
    echo    Clique com o botao direito e escolha: "Executar como administrador".
    echo.
    pause
    exit /b 1
)

echo =========================================================
echo      REVERSAO TOTAL DAS OTIMIZACOES E DEBLOATS
echo =========================================================
echo.

echo [1/12] Restaurando servicos do Windows...
sc config "wuauserv" start= auto >nul 2>&1
sc config "WSearch" start= delayed-auto >nul 2>&1
sc config "DiagTrack" start= auto >nul 2>&1
sc config "W32Time" start= auto >nul 2>&1
sc config "WaaSMedicSvc" start= auto >nul 2>&1
sc config "wisvc" start= auto >nul 2>&1
sc config "DPS" start= auto >nul 2>&1
sc config "TermService" start= auto >nul 2>&1
sc config "WbioSrvc" start= auto >nul 2>&1
sc config "TabletInputService" start= auto >nul 2>&1
sc config "bthserv" start= auto >nul 2>&1
sc config "DoSvc" start= auto >nul 2>&1
sc config "Spooler" start= auto >nul 2>&1
sc config "RemoteRegistry" start= auto >nul 2>&1
sc config "PcaSvc" start= auto >nul 2>&1
sc config "SessionEnv" start= auto >nul 2>&1
sc config "Fax" start= auto >nul 2>&1
for %%S in (wuauserv WSearch DiagTrack W32Time WaaSMedicSvc wisvc DPS TermService WbioSrvc TabletInputService bthserv DoSvc Spooler RemoteRegistry PcaSvc SessionEnv Fax) do (
    net start "%%S" >nul 2>&1
)

echo [2/12] Habilitando hibernacao...
powercfg -h on >nul 2>&1

echo [3/12] Restaurando configuracoes de busca e Cortana...
reg add "HKEY_LOCAL_MACHINE\SOFTWARE\Policies\Microsoft\Windows\Windows Search" /v AllowCortana /t REG_DWORD /d 1 /f >nul 2>&1
reg add "HKEY_CURRENT_USER\Software\Microsoft\Windows\CurrentVersion\Search" /v BingSearchEnabled /t REG_DWORD /d 1 /f >nul 2>&1
reg add "HKEY_CURRENT_USER\Software\Microsoft\Windows\CurrentVersion\Search" /v SearchHistoryEnabled /t REG_DWORD /d 1 /f >nul 2>&1
reg add "HKEY_CURRENT_USER\Software\Microsoft\Windows\CurrentVersion\ContentDeliveryManager" /v SystemPaneSuggestionsEnabled /t REG_DWORD /d 1 /f >nul 2>&1
reg add "HKEY_LOCAL_MACHINE\SOFTWARE\Policies\Microsoft\Windows\System" /v PublishUserActivities /t REG_DWORD /d 1 /f >nul 2>&1

echo [4/12] Restaurando Copilot e widgets...
reg add "HKEY_CURRENT_USER\Software\Microsoft\Windows\CurrentVersion\Explorer\Advanced" /v ShowCopilotButton /t REG_DWORD /d 1 /f >nul 2>&1
reg add "HKEY_LOCAL_MACHINE\SOFTWARE\Policies\Microsoft\Windows\Windows Copilot" /v TurnOffWindowsCopilot /t REG_DWORD /d 0 /f >nul 2>&1
reg add "HKEY_LOCAL_MACHINE\SOFTWARE\Microsoft\Windows\CurrentVersion\Policies\Explorer" /v HideCopilotButton /t REG_DWORD /d 0 /f >nul 2>&1

echo [5/12] Restaurando transparencia e efeitos visuais...
reg add "HKEY_CURRENT_USER\Software\Microsoft\Windows\CurrentVersion\Themes\Personalize" /v EnableTransparency /t REG_DWORD /d 1 /f >nul 2>&1
reg add "HKEY_CURRENT_USER\Software\Microsoft\Windows\CurrentVersion\Explorer\VisualEffects" /v VisualFXSetting /t REG_DWORD /d 1 /f >nul 2>&1

echo [6/12] Restaurando coleta de dados e telemetria...
reg add "HKEY_LOCAL_MACHINE\SOFTWARE\Policies\Microsoft\Windows\DataCollection" /v AllowTelemetry /t REG_DWORD /d 1 /f >nul 2>&1
reg add "HKEY_LOCAL_MACHINE\SOFTWARE\Microsoft\Windows\CurrentVersion\Policies\DataCollection" /v AllowTelemetry /t REG_DWORD /d 1 /f >nul 2>&1
reg add "HKEY_LOCAL_MACHINE\SOFTWARE\Policies\Microsoft\Windows\System" /v EnableActivityFeed /t REG_DWORD /d 1 /f >nul 2>&1

echo [7/12] Restaurando Game DVR...
reg add "HKEY_CURRENT_USER\System\GameConfigStore" /v GameDVR_Enabled /t REG_DWORD /d 1 /f >nul 2>&1
reg add "HKEY_LOCAL_MACHINE\SOFTWARE\Policies\Microsoft\Windows\GameDVR" /v AllowGameDVR /t REG_DWORD /d 1 /f >nul 2>&1

echo [8/12] Reativando tarefas agendadas desativadas...
schtasks /Change /TN "Microsoft\Windows\Customer Experience Improvement Program\Consolidator" /Enable >nul 2>&1
schtasks /Change /TN "Microsoft\Windows\Application Experience\ProgramDataUpdater" /Enable >nul 2>&1
schtasks /Change /TN "Microsoft\Windows\Autochk\Proxy" /Enable >nul 2>&1
schtasks /Change /TN "Microsoft\Windows\DiskDiagnostic\Microsoft-Windows-DiskDiagnosticDataCollector" /Enable >nul 2>&1


echo [9/12] Reativando seguranca padrao do Windows...
reg add "HKEY_LOCAL_MACHINE\SYSTEM\CurrentControlSet\Control\DeviceGuard\Scenarios\HypervisorEnforcedCodeIntegrity" /v Enabled /t REG_DWORD /d 1 /f >nul 2>&1


echo [10/12] Removendo ajustes de prioridade de jogos...
for %%G in (
    FortniteClient-Win64-Shipping
    GTA5
    FiveM_b2372_GTAProcess
    cs2
    javaw
    java
    VALORANT-Win64-Shipping
    RiotClientServices
    LeagueClient
    cod
    r5apex
    RobloxPlayerBeta
    GoW
    GoWRagnarok
    Multi Theft Auto
    gta_sa
    eurotrucks
    ets2
    RainbowSix
    bf3
    bf4
    bfh
    bf1
    bfv
    RDR2
    Minecraft.Windows
    bfv
    gta5
    apex
) do (
    reg delete "HKLM\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Image File Execution Options\%%G.exe\PerfOptions" /f >nul 2>&1
    reg delete "HKLM\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Image File Execution Options\%%G.exe" /f >nul 2>&1
)


echo [11/12] Restaurando apps do sistema se estiverem ausentes...
powershell -NoProfile -ExecutionPolicy Bypass -Command "Get-AppxPackage -AllUsers | Where-Object { $_.Name -match 'Microsoft.WindowsStore|Microsoft.XboxApp|Microsoft.Cortana|Microsoft.Photos|Microsoft.Maps|Microsoft.Messaging|Microsoft.Music|Microsoft.Groove|Microsoft.People|Microsoft.News|Microsoft.Calendar|Microsoft.Calculator|Microsoft.Camera|Microsoft.3DBuilder|Microsoft.GetStarted|Microsoft.OfficeHub|Microsoft.OneDrive|Microsoft.Alarms' } | ForEach-Object { Add-AppxPackage -DisableDevelopmentMode -Register \"$($_.InstallLocation)\AppxManifest.xml\" }" >nul 2>&1


echo [12/12] Finalizando...
net start "bits" >nul 2>&1
net start "cryptsvc" >nul 2>&1
net start "wuauserv" >nul 2>&1

echo.
echo =========================================================
echo      REVERSAO TOTAL CONCLUIDA
echo =========================================================
echo.
echo Tudo o que foi alterado pelos otimizadores foi restaurado.
echo Se quiser, pode reiniciar o Windows para aplicar algumas alteracoes
cho mais profundas do sistema.
echo.
echo Pressione qualquer tecla para sair...
pause >nul
exit /b 0
