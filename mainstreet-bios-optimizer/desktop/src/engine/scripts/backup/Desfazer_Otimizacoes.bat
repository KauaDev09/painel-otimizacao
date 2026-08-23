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

echo ===================================================
echo      REVERSAO RAPIDA DAS OTIMIZACOES DO WINDOWS
echo ===================================================
echo.
echo [1/10] Restaurando servicos do sistema...

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

echo [2/10] Habilitando hibernacao...
powercfg -h on >nul 2>&1

echo [3/10] Restaurando configuracoes de pesquisa e Cortana...
reg add "HKEY_LOCAL_MACHINE\SOFTWARE\Policies\Microsoft\Windows\Windows Search" /v AllowCortana /t REG_DWORD /d 1 /f >nul 2>&1
reg add "HKEY_CURRENT_USER\Software\Microsoft\Windows\CurrentVersion\Search" /v BingSearchEnabled /t REG_DWORD /d 1 /f >nul 2>&1
reg add "HKEY_CURRENT_USER\Software\Microsoft\Windows\CurrentVersion\Search" /v SearchHistoryEnabled /t REG_DWORD /d 1 /f >nul 2>&1
reg add "HKEY_CURRENT_USER\Software\Microsoft\Windows\CurrentVersion\ContentDeliveryManager" /v SystemPaneSuggestionsEnabled /t REG_DWORD /d 1 /f >nul 2>&1
reg add "HKEY_LOCAL_MACHINE\SOFTWARE\Policies\Microsoft\Windows\System" /v PublishUserActivities /t REG_DWORD /d 1 /f >nul 2>&1

echo [4/10] Restaurando Copilot...
reg add "HKEY_CURRENT_USER\Software\Microsoft\Windows\CurrentVersion\Explorer\Advanced" /v ShowCopilotButton /t REG_DWORD /d 1 /f >nul 2>&1
reg add "HKEY_LOCAL_MACHINE\SOFTWARE\Policies\Microsoft\Windows\Windows Copilot" /v TurnOffWindowsCopilot /t REG_DWORD /d 0 /f >nul 2>&1
reg add "HKEY_LOCAL_MACHINE\SOFTWARE\Microsoft\Windows\CurrentVersion\Policies\Explorer" /v HideCopilotButton /t REG_DWORD /d 0 /f >nul 2>&1

echo [5/10] Restaurando transparencia e visual effects...
reg add "HKEY_CURRENT_USER\Software\Microsoft\Windows\CurrentVersion\Themes\Personalize" /v EnableTransparency /t REG_DWORD /d 1 /f >nul 2>&1
reg add "HKEY_CURRENT_USER\Software\Microsoft\Windows\CurrentVersion\Explorer\VisualEffects" /v VisualFXSetting /t REG_DWORD /d 1 /f >nul 2>&1

echo [6/10] Restaurando telemetria e coleta de dados...
reg add "HKEY_LOCAL_MACHINE\SOFTWARE\Policies\Microsoft\Windows\DataCollection" /v AllowTelemetry /t REG_DWORD /d 1 /f >nul 2>&1
reg add "HKEY_LOCAL_MACHINE\SOFTWARE\Microsoft\Windows\CurrentVersion\Policies\DataCollection" /v AllowTelemetry /t REG_DWORD /d 1 /f >nul 2>&1
reg add "HKEY_LOCAL_MACHINE\SOFTWARE\Policies\Microsoft\Windows\System" /v EnableActivityFeed /t REG_DWORD /d 1 /f >nul 2>&1

echo [7/10] Restaurando Game DVR...
reg add "HKEY_CURRENT_USER\System\GameConfigStore" /v GameDVR_Enabled /t REG_DWORD /d 1 /f >nul 2>&1
reg add "HKEY_LOCAL_MACHINE\SOFTWARE\Policies\Microsoft\Windows\GameDVR" /v AllowGameDVR /t REG_DWORD /d 1 /f >nul 2>&1

echo [8/10] Restaurando tarefas agendadas desativadas...
schtasks /Change /TN "Microsoft\Windows\Customer Experience Improvement Program\Consolidator" /Enable >nul 2>&1
schtasks /Change /TN "Microsoft\Windows\Application Experience\ProgramDataUpdater" /Enable >nul 2>&1
schtasks /Change /TN "Microsoft\Windows\Autochk\Proxy" /Enable >nul 2>&1
schtasks /Change /TN "Microsoft\Windows\DiskDiagnostic\Microsoft-Windows-DiskDiagnosticDataCollector" /Enable >nul 2>&1

:: Security-related fallback: re-enable Virtualization-Based Security if it was disabled.
echo [9/10] Reativando protecao padrao do Windows...
reg add "HKEY_LOCAL_MACHINE\SYSTEM\CurrentControlSet\Control\DeviceGuard\Scenarios\HypervisorEnforcedCodeIntegrity" /v Enabled /t REG_DWORD /d 1 /f >nul 2>&1

:: Common Windows update toggle fallback.
echo [10/10] Finalizando e reiniciando servicos essenciais...
net start "wuauserv" >nul 2>&1
net start "bits" >nul 2>&1
net start "cryptsvc" >nul 2>&1

echo.
echo ===================================================
echo      REVERSAO CONCLUIDA
echo ===================================================
echo.
echo Ajustes comuns restaurados.
echo Se algum jogo ou aplicativo ainda estiver com prioridade alterada,
echo a otimizacao especifica do jogo pode exigir a remocao
echo das entradas de "Image File Execution Options" manualmente.
echo.
echo Pressione qualquer tecla para sair...
pause >nul
exit /b 0
