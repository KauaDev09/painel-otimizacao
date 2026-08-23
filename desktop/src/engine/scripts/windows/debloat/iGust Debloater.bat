@echo off
chcp 65001 >nul
cls
setlocal enabledelayedexpansion

set "line1=                                       .__  ________                __   
set "line2=                                       |__|/  _____/ __ __  _______/  |_ 
set "line3=                                       |  /   \  ___|  |  \/  ___/\   __\
set "line4=                                       |  \    \_\  \  |  /\___ \  |  |      
set "line5=                                       |__|\______  /____//____  > |__|  
set "line6=                                                  \/           \/
set "line7=.                                                                
set "line8=                                               inicializando..."
echo.                                                        

for /L %%i in (1,1,8) do (
    echo !line%%i!
    ping 127.0.0.1 -n 1 -w 120 >nul
)


timeout /t 3 >nul
cls

REM ========== continua o seu script abaixo ==========

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


title iGust Debloater
cls
set "ESC="
cls

:menu

echo(
set "lines[0]=                              (                                                
set "lines[1]=                              )\ )            )  (                )            
set "lines[2]=                             (()/(     (   ( /(  )\         )  ( /(   (   (    
set "lines[3]=                              /(_))   ))\  )\())((_) (   ( /(  )\()) ))\  )(   
set "lines[4]=                             (_))_   /((_)((_)\  _   )\  )(_))(_))/ /((_)(()\  
set "lines[5]=                              |   \ (_))  | |(_)| | ((_)((_)_ | |_ (_))   ((_)
set "lines[6]=                              | |) |/ -_) | '_ \| |/ _ \/ _` ||  _|/ -_) | '_| 
set "lines[7]=                              |___/ \___| |_.__/|_|\___/\__,_| \__|\___| |_|   

for /L %%j in (0,1,82) do (
    set /a "corR=corBaseR + (variacaoR * %%j / 82)"
    set /a "corG=corBaseG + (variacaoG * %%j / 82)"
    set /a "corB=corBaseB + (variacaoB * %%j / 82)"
    set "esc[%%j]=!ESC![38;2;!corR!;!corG!;!corB!m"
)

for /L %%i in (0,1,7) do (
    set "texto=!lines[%%i]!"
    set "textoGradiente="
    for /L %%j in (0,1,82) do (
        set "char=!texto:~%%j,1!"
        if "!char!" == " " set "char= "
        set "textoGradiente=!textoGradiente!!esc[%%j]!!char!"
    )
    echo( !textoGradiente!!ESC![0m
)


echo 	 	 %q%

echo(
echo.
echo               %op%[ %op%1 %op%]%op% Criar Ponto de Restauração                 %op%[ %op%2 %op%]%op% Usar todos (CUIDADO)
echo.
echo               %m%[ %m%3 %m%]%w% Remover officehub                          %m%[ %m%4 %m%]%w% Remover Cortana  
echo.
echo               %m%[ %m%5 %m%]%w% Remover Copilot                            %m%[ %m%6 %m%]%w% Remover Loja do Windows 
echo.  
echo               %m%[ %m%7 %m%]%w% Remover a Xbox                             %m%[ %m%8 %m%]%w% Remover Windows Photos 
echo. 
echo               %m%[ %m%9 %m%]%w% Remover Windows People                     %m%[ %m%10 %m%]%w% Remover Windows Music 
echo. 
echo               %m%[ %m%11 %m%]%w% Remover Windows Messaging                 %m%[ %m%12 %m%]%w% Remover Windows Maps 
echo. 
echo               %m%[ %m%13 %m%]%w% Remover Windows Groove                    %m%[ %m%14 %m%]%w% Remover Windows GetStarted 
echo. 
echo               %m%[ %m%15 %m%]%w% Remover Calendário                        %m%[ %m%16 %m%]%w% Remover Calculadora 
echo. 
echo               %m%[ %m%17 %m%]%w% Remover Windows Alarms                    %m%[ %m%18 %m%]%w% Remover 3DBuilder 
echo. 
echo               %m%[ %m%19 %m%]%w% Remover Windows Câmera                    %m%[ %m%20 %m%]%w% Remover Notícias 
echo. 
echo               %m%[ %m%21 %m%]%w% Remover OneDrive                          %m%[ %m%22 %m%]%w% Remover Anúncios e sugestões 
echo.                                 
echo               %m%[ %m%23 %m%]%w% Remover Emails                            %m%[ 24 %m%]%w% Remover Outlook 
echo.                                 
echo               %m%[ %m%25 %m%]%w% Remover Assistência Rápida                %m%[ 26 %m%]%w% Remover Microsoft To do
echo.                                 
echo               %m%[ %m%27 %m%]%w% Remover Solitaire e jogos Casuais         %m%[ 28 %m%]%w% Remover Clima
echo.                                 
echo               %m%[ 29 %m%]%w%Remover Hub de Comentários%w%                 %op%[ %op%30 %op%]%op% Reverter Debloaters%w%
echo.                                 
echo               %op%[ 31 %op%]Sair%w%                                       %op%[ %op%32 %op%]%op% Outras Otimizações%w%
echo.
echo.
set /p opcao="Escolha uma opção:%w% "%w%


if %opcao% equ 1 goto opcao1
if %opcao% equ 2 goto opcao2
if %opcao% equ 3 goto opcao3
if %opcao% equ 4 goto opcao4
if %opcao% equ 5 goto opcao5
if %opcao% equ 6 goto opcao6
if %opcao% equ 7 goto opcao7
if %opcao% equ 8 goto opcao8
if %opcao% equ 9 goto opcao9
if %opcao% equ 10 goto opcao10
if %opcao% equ 11 goto opcao11
if %opcao% equ 12 goto opcao12
if %opcao% equ 13 goto opcao13
if %opcao% equ 14 goto opcao14
if %opcao% equ 15 goto opcao15
if %opcao% equ 16 goto opcao16
if %opcao% equ 17 goto opcao17
if %opcao% equ 18 goto opcao18
if %opcao% equ 19 goto opcao19
if %opcao% equ 20 goto opcao20
if %opcao% equ 21 goto opcao21
if %opcao% equ 22 goto opcao22
if %opcao% equ 23 goto opcao23
if %opcao% equ 24 goto opcao24
if %opcao% equ 25 goto opcao25
if %opcao% equ 26 goto opcao26
if %opcao% equ 27 goto opcao27
if %opcao% equ 28 goto opcao28
if %opcao% equ 29 goto opcao29
if %opcao% equ 30 goto opcao30
if %opcao% equ 31 goto sair
if %opcao% equ 32 goto opcao32


echo Opção inválida. Tente novamente.
pause
cls
goto :menu

:sair
Echo Saindo do programa...
echo 1
echo 2
echo 3
exit

:opcao1
cls
echo Criando ponto de Restauração...
reg add "HKLM\Software\Microsoft\Windows NT\CurrentVersion\SystemRestore" /v SystemRestorePointCreationFrequency /t REG_DWORD /d 0 /f >nul
powershell -Command "Checkpoint-Computer -Description 'Game Booster RestorePoint' -RestorePointType 'MODIFY_SETTINGS'"
echo(
echo Ponto de restauração criado com sucesso!
pause
cls
goto :menu

:opcao2
cls
echo Removendo todos programas inúteis do Windows...

powershell -Command "Get-AppxPackage *Microsoft.Windows.Cortana* | Remove-AppxPackage"
powershell -Command "Get-AppxPackage *officehub* | Remove-AppxPackage"
powershell -Command "Get-AppxPackage *store* | Remove-AppxPackage"
powershell -Command "Get-AppxPackage *xbox* | Remove-AppxPackage"
powershell -Command "Get-AppxPackage *photos* | Remove-AppxPackage"
powershell -Command "Get-AppxPackage *phone* | Remove-AppxPackage"
powershell -Command "Get-AppxPackage *people* | Remove-AppxPackage"
powershell -Command "Get-AppxPackage *music* | Remove-AppxPackage"
powershell -Command "Get-AppxPackage *messaging* | Remove-AppxPackage"
powershell -Command "Get-AppxPackage *maps* | Remove-AppxPackage"
powershell -Command "Get-AppxPackage *groove* | Remove-AppxPackage"
powershell -Command "Get-AppxPackage *getstarted* | Remove-AppxPackage"
powershell -Command "Get-AppxPackage *calendar* | Remove-AppxPackage"
powershell -Command "Get-AppxPackage *calculator* | Remove-AppxPackage"
powershell -Command "Get-AppxPackage *alarms* | Remove-AppxPackage"
powershell -Command "Get-AppxPackage *3dbuilder* | Remove-AppxPackage"
powershell -Command "Get-AppxPackage *camera* | Remove-AppxPackage"
powershell -Command "Get-AppxPackage *news* | Remove-AppxPackage"
powershell -Command "Get-AppxPackage *onedrive* | Remove-AppxPackage"
powershell -Command "Get-AppxPackage *FeedbackHub* | Remove-AppxPackage"
powershell -Command "Get-AppxPackage *windowscommunicationsapps* | Remove-AppxPackage"
powershell -Command "Get-AppxPackage *QuickAssist* | Remove-AppxPackage"
powershell -Command "Get-AppxPackage *todos* | Remove-AppxPackage"
powershell -Command "Get-AppxPackage *solitaire* | Remove-AppxPackage"
powershell -Command "Get-AppxPackage *xboxGamingOverlay* | Remove-AppxPackage"
powershell -Command "Get-AppxPackage *Weather* | Remove-AppxPackage"

reg add "HKEY_CURRENT_USER\Software\Microsoft\Windows\CurrentVersion\Explorer\Advanced" /v ShowCopilotButton /t REG_DWORD /d 0 /f
reg add "HKEY_LOCAL_MACHINE\SOFTWARE\Policies\Microsoft\Windows\Windows Copilot" /v TurnOffWindowsCopilot /t REG_DWORD /d 1 /f
reg delete "HKEY_LOCAL_MACHINE\SOFTWARE\Microsoft\Windows\CurrentVersion\Policies\Explorer" /v HideCopilotButton /f
reg add "HKEY_LOCAL_MACHINE\SOFTWARE\Policies\Microsoft\Windows\Windows Search" /v "AllowCortana" /t REG_DWORD /d 0 /f
reg add "HKEY_CURRENT_USER\Software\Microsoft\Windows\CurrentVersion\ContentDeliveryManager" /v "SystemPaneSuggestionsEnabled" /t REG_DWORD /d 0 /f
echo Debloater Feito com Sucesso! :)
pause
cls
goto :menu

:opcao3
cls
echo Removendo Officehub...

powershell -Command "Get-AppxPackage *officehub* | Remove-AppxPackage"

echo Debloater Feito com Sucesso! :)
pause
cls
goto :menu

:opcao4
cls
echo Removendo Cortana...

powershell -Command "Get-AppxPackage *Microsoft.Windows.Cortana* | Remove-AppxPackage"

echo Debloater Feito com Sucesso! :)
pause
cls
goto :menu

:opcao5
cls
echo Removendo Copilot...

powershell -command "Get-AppxPackage *Copilot* | Remove-AppxPackage"
powershell -command "Get-AppxPackage -AllUsers *Copilot* | Remove-AppxPackage"
powershell -command "Get-AppxProvisionedPackage -Online | Where-Object {$_.DisplayName -like '*Copilot*'} | Remove-AppxProvisionedPackage -Online"

echo Debloater Feito com Sucesso! :)
pause
cls
goto :menu

:opcao6
cls
echo Removendo Loja do Windows...

powershell -Command "Get-AppxPackage *store* | Remove-AppxPackage"

echo Debloater Feito com Sucesso! :)
pause
cls
goto :menu

:opcao7
cls
echo Removendo a Xbox do Windows...

powershell -Command "Get-AppxPackage *xbox* | Remove-AppxPackage"

echo Debloater Feito com Sucesso! :)
pause
cls
goto :menu

:opcao8
cls
echo Removendo Windows photo...

powershell -Command "Get-AppxPackage *photos* | Remove-AppxPackage"

echo Debloater Feito com Sucesso! :)
pause
cls
goto :menu

:opcao9
cls
echo Removendo Windows Phone...

powershell -Command "Get-AppxPackage *phone* | Remove-AppxPackage"

echo Debloater Feito com Sucesso! :)
pause
cls
goto :menu

:opcao10
cls
echo Removendo Windows Music...

powershell -Command "Get-AppxPackage *music* | Remove-AppxPackage"

echo Debloater Feito com Sucesso! :)
pause
cls
goto :menu

:opcao11
cls
echo Removendo Windows Messaging...

powershell -Command "Get-AppxPackage *messaging* | Remove-AppxPackage"

echo Debloater Feito com Sucesso! :)
pause
cls
goto :menu

:opcao12
cls
echo Removendo Windows Maps...

powershell -Command "Get-AppxPackage *maps* | Remove-AppxPackage"

echo Debloater Feito com Sucesso! :)
pause
cls
goto :menu

:opcao13
cls
echo Removendo Windows Groove...

powershell -Command "Get-AppxPackage *groove* | Remove-AppxPackage"

echo Debloater Feito com Sucesso! :)
pause
cls
goto :menu

:opcao14
cls
echo Removendo Windows Getstarted...

powershell -Command "Get-AppxPackage *getstarted* | Remove-AppxPackage"

echo Debloater Feito com Sucesso! :)
pause
cls
goto :menu

:opcao15
cls
echo Removendo Windows Calendário...

powershell -Command "Get-AppxPackage *calendar* | Remove-AppxPackage"

echo Debloater Feito com Sucesso! :)
pause
cls
goto :menu

:opcao16
cls
echo Removendo Calculadora Do Windows...

powershell -Command "Get-AppxPackage *calculator* | Remove-AppxPackage"

echo Debloater Feito com Sucesso! :)
pause
cls
goto :menu

:opcao17
cls
echo Removendo Windows Alarmes...

powershell -Command "Get-AppxPackage *alarms* | Remove-AppxPackage"

echo Debloater Feito com Sucesso! :)
pause
cls
goto :menu

:opcao18
cls
echo Removendo Windows 3DBuilder...

powershell -Command "Get-AppxPackage *3dbuilder* | Remove-AppxPackage"

echo Debloater Feito com Sucesso! :)
pause
cls
goto :menu

:opcao19
cls
echo Removendo Windows Câmera...

powershell -Command "Get-AppxPackage *camera* | Remove-AppxPackage"

echo Debloater Feito com Sucesso! :)
pause
cls
goto :menu

:opcao20
cls
echo Removendo Notícias do Windows...

powershell -Command "Get-AppxPackage *news* | Remove-AppxPackage"

echo Debloater Feito com Sucesso! :)
pause
cls
goto :menu

:opcao21
cls
echo Removendo OneDrive...

powershell -Command "Get-AppxPackage *onedrive* | Remove-AppxPackage"

echo Debloater Feito com Sucesso! :)
pause
cls
goto :menu

:opcao22
cls
echo Removendo Anúncios e sugestões...

powershell -command "Set-ItemProperty HKCU:\Software\Microsoft\Windows\CurrentVersion\ContentDeliveryManager SystemPaneSuggestionsEnabled 0"
powershell -command "Set-ItemProperty HKCU:\Software\Microsoft\Windows\CurrentVersion\ContentDeliveryManager 'SubscribedContent-338393Enabled' 0"
powershell -command "Set-ItemProperty HKCU:\Software\Microsoft\Windows\CurrentVersion\ContentDeliveryManager 'SubscribedContent-353694Enabled' 0"
powershell -command "Set-ItemProperty HKCU:\Software\Microsoft\Windows\CurrentVersion\ContentDeliveryManager 'SubscribedContent-353696Enabled' 0"
powershell -command "Set-ItemProperty HKCU:\Software\Microsoft\Windows\CurrentVersion\ContentDeliveryManager 'SubscribedContent-338389Enabled' 0"
powershell -command "Set-ItemProperty HKCU:\Software\Microsoft\Windows\CurrentVersion\ContentDeliveryManager 'SubscribedContent-310093Enabled' 0"
powershell -command "Set-ItemProperty HKCU:\Software\Microsoft\Windows\CurrentVersion\ContentDeliveryManager 'SubscribedContent-353698Enabled' 0"
powershell -command "Set-ItemProperty HKCU:\Software\Microsoft\Windows\CurrentVersion\ContentDeliveryManager SoftLandingEnabled 0"

powershell -command "Set-ItemProperty HKCU:\Software\Microsoft\Windows\CurrentVersion\Explorer\Advanced Start_TrackProgs 0"
powershell -command "Set-ItemProperty HKCU:\Software\Microsoft\Windows\CurrentVersion\Explorer\Advanced Start_TrackDocs 0"

powershell -command "Set-ItemProperty HKCU:\Software\Microsoft\Windows\CurrentVersion\Explorer ShowRecent 0"
powershell -command "Set-ItemProperty HKCU:\Software\Microsoft\Windows\CurrentVersion\Explorer ShowRecommended 0"

echo Debloater Feito com Sucesso! :)
pause
cls
goto :menu

:opcao23
cls
echo Removendo Emails....
powershell -Command "Get-AppxPackage *windowscommunicationsapps* | Remove-AppxPackage"

echo Debloater Feito com Sucesso! :)
pause
cls
goto :menu


:opcao24
cls
echo Removendo Outlook...
powershell -Command "Get-AppxPackage *Outlook* | Remove-AppxPackage"

echo Debloater Feito com Sucesso! :)
pause
cls
goto :menu

:opcao25
cls
echo Removendo Assistência Rápida...
powershell -Command "Get-AppxPackage *QuickAssist* | Remove-AppxPackage"

echo Debloater Feito com Sucesso! :)
pause
cls
goto :menu

:opcao26
cls
echo Removendo Microsoft To Do...
powershell -Command "Get-AppxPackage *todos* | Remove-AppxPackage"

echo Debloater Feito com Sucesso! :)
pause
cls
goto :menu

:opcao27
cls
echo Removendo Solitaire e Jogos Casuais...
powershell -Command "Get-AppxPackage *solitaire* | Remove-AppxPackage"
powershell -Command "Get-AppxPackage *xboxGamingOverlay* | Remove-AppxPackage"

echo Debloater Feito com Sucesso! :)
pause
cls
goto :menu

:opcao28
cls
Removendo Clima...
powershell -Command "Get-AppxPackage *Weather* | Remove-AppxPackage"

echo Debloater Feito com Sucesso! :)
pause
cls
goto :menu

:opcao29
cls
echo Removendo Hub de Comentários...
powershell -Command "Get-AppxPackage *FeedbackHub* | Remove-AppxPackage"

echo Debloater Feito com Sucesso! :)
pause
cls
goto :menu

:opcao30
cls
echo Revertendo Debloater e configuracoes...
reg add "HKEY_LOCAL_MACHINE\SOFTWARE\Policies\Microsoft\Windows\Windows Search" /v AllowCortana /t REG_DWORD /d 1 /f
reg add "HKEY_LOCAL_MACHINE\SOFTWARE\Policies\Microsoft\Windows\Windows Copilot" /v TurnOffWindowsCopilot /t REG_DWORD /d 0 /f
reg add "HKEY_CURRENT_USER\Software\Microsoft\Windows\CurrentVersion\Explorer\Advanced" /v ShowCopilotButton /t REG_DWORD /d 1 /f
reg add "HKEY_CURRENT_USER\Software\Microsoft\Windows\CurrentVersion\ContentDeliveryManager" /v SystemPaneSuggestionsEnabled /t REG_DWORD /d 1 /f
reg add "HKEY_CURRENT_USER\Software\Microsoft\Windows\CurrentVersion\ContentDeliveryManager" /v SoftLandingEnabled /t REG_DWORD /d 1 /f
reg add "HKEY_CURRENT_USER\Software\Microsoft\Windows\CurrentVersion\Explorer" /v ShowRecent /t REG_DWORD /d 1 /f
reg add "HKEY_CURRENT_USER\Software\Microsoft\Windows\CurrentVersion\Explorer" /v ShowRecommended /t REG_DWORD /d 1 /f
reg add "HKEY_CURRENT_USER\Software\Microsoft\Windows\CurrentVersion\Explorer\Advanced" /v Start_TrackProgs /t REG_DWORD /d 1 /f
reg add "HKEY_CURRENT_USER\Software\Microsoft\Windows\CurrentVersion\Explorer\Advanced" /v Start_TrackDocs /t REG_DWORD /d 1 /f

echo %r%Abrindo arquivo adicional, aperte ENTER para abrir! %w%
set /p "= " 
echo abrindo arquivo .txt
start "" "%~dp0Reverter Debloat.txt"

echo Debloater Revertido com Sucesso!
pause
cls
goto menu

:opcao32
cls
echo Abrindo Otimizações...
start https://youtu.be/qCciwx_yNqE?si=rVdF6ydU8mZbZfuM
echo Baixe o script, se inscreve e deixa o like :)
pause
cls
goto menu