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


title iGust Game Priority
cls
set "ESC="
cls

:prioridadegames

echo(
set "lines[0]=                              .__  ________                __   
set "lines[1]=                              |__|/  _____/ __ __  _______/  |_ 
set "lines[2]=                              |  /   \  ___|  |  \/  ___/\   __\
set "lines[3]=                     Game     |  \    \_\  \  |  /\___ \  |  |      Booster
set "lines[4]=                              |__|\______  /____//____  > |__|  
set "lines[5]=                                         \/           \/        



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

echo                            Escolha o %op%jogo%w% que voce quer %op%priorizar%w%:
echo.
echo       %m%[ %m%1 %m%]%w% Fortnite                                          %m%[ %m%2 %m%]%w% Gta V
echo.
echo       %m%[ %m%3 %m%]%w% FiveM                                             %m%[ %m%4 %m%]%w% CS2
echo.
echo       %m%[ %m%5 %m%]%w% Minecraft                                         %m%[ %m%6 %m%]%w% Valorant
echo.
echo       %m%[ %m%7 %m%]%w% League of Legends                                 %m%[ %m%8 %m%]%w% Warzone
echo.
echo       %m%[ %m%9 %m%]%w% Apex Legends                                      %m%[ %m%10 %m%]%w% Roblox
echo.
echo       %m%[ %m%11 %m%]%w% God Of War (2018 e ragnarok)                     %m%[ %m%12 %m%]%w% MTA 
echo.
echo       %m%[ %m%13 %m%]%w% Euro Truck Simulator (1 e 2)                     %m%[ %m%14 %m%]%w% Tom Clancy's Rainbow Six Siege
echo.   
echo       %m%[ %m%15 %m%]%w% Cult of the Lamb                                 %m%[ %m%16 %m%]%w% ULTRAKILL
echo.      
echo       %m%[ %m%17 %m%]%w% Blood Strike                                     %m%[ %m%18 %m%]%w% Arena Breakout
echo.    
echo       %m%[ %m%19 %m%]%w% Resident Evil 4 Remake                           %m%[ %m%20 %m%]%w% Resident Evil 2 Remake
echo.    
echo       %m%[ %m%21 %m%]%w% Resident Evil Village                            %m%[ %m%22 %m%]%w% Free Fire + Bluestacks
echo.    
echo       %m%[ %m%23 %m%]%w% Battlefield 2042                                 %m%[ %m%24 %m%]%w% Battlefield 4
echo.    
echo       %m%[ %m%25 %m%]%w% The last Of US 1 e 2                             %m%[ %m%26 %m%]%w% PUBG
echo.
echo       %m%[ %m%27 %m%]%w% Rocket League                                    %m%[ %m%28 %m%]%w% Cyberpunk 2077
echo.
echo       %m%[ %m%29 %m%]%w% Terraria                                         %m%[ %m%30 %m%]%w% Red Dead Redemption 2
echo.
echo       %m%[ %m%31 %m%]%w% Battlefield 6                                    %m%[ %m%32 %m%]%w% Choo Choo Charles
echo.
echo       %m%[ %m%33 %m%]%w% Hell Let Loose                                   %m%[ %m%34 %m%]%w% Farming Simulator 22
echo.
echo       %m%[ %m%35 %m%]%w% Farming Simulator 25                             %m%[ %m%36 %m%]%w% Hollow Knight
echo.
echo       %m%[ %m%37 %m%]%w% Genshin Impact                                   %m%[ %m%38 %m%]%w% Point Blank
echo.
echo       %m%[ %m%39 %m%]%w% My Summer Car                                    %m%[ %m%40 %m%]%w% DayZ
echo.
echo       %m%[ %m%41 %m%]%w% Street Fighter 6                                 %m%[ %m%42 %m%]%w% Rust
echo.
echo       %m%[ %m%43 %m%]%w% Chivalry 2                                       %m%[ %m%44 %m%]%w% Subnautica + Below zero
echo.
echo       %m%[ %m%45 %m%]%w% Left 4 dead 1 e 2                                %m%[ %m%46 %m%]%w% Marvel Rivals
echo.
echo       %m%[ %m%47 %m%]%w% Warface                                          %m%[ %m%48 %m%]%w% Deadlock
echo.
echo       %m%[ %m%49 %m%]%w% Cuphead                                          %m%[ %m%50 %m%]%w% Escape from tarkov
echo.
echo       %m%[ %m%51 %m%]%w% Death stranding 1 e 2                            %m%[ %m%52 %m%]%w% Poppy Playtime (*todos)
echo.
echo       %m%[ %m%53 %m%]%w% Resident evil Requiem                            %m%[ %m%54 %m%]%w% PES (todos)
echo. 
echo       %m%[ %m%55 %m%]%w% Dead By Daylight                                 %m%[ %m%56 %m%]%w% EA 26 (fifa)
echo.
echo       %m%[ %m%57 %m%]%w% Final Fantasy XIV                                %m%[ %m%58 %m%]%w% Marvel Rivals
echo.
echo       %m%[ %m%59 %m%]%w% Ghost Of Tsushima                                %m%[ %m%60 %m%]%w% SKYRIM
echo.
echo       %m%[ %m%61 %m%]%w% Days Gone                                        %m%[ %m%62 %m%]%w% Palworld
echo.
echo       %m%[ %m%63 %m%]%w% Crossfire                                        %m%[ %m%64 %m%]%w% Warframe
echo.
echo       %m%[ %m%65 %m%]%w% The Isle                                         %m%[ %m%66 %m%]%w% SnowRunner
echo.
echo       %m%[ %m%67 %m%]%w% Rematch                                          %m%[ %m%68 %m%]%w% Meccha Chameleon
echo.
echo                                        %op%[ %op%69 %op%]%op% Fechar%w%
echo.

set /p jogo="Digite o numero: "
cls
if "%jogo%"=="1" goto priorizar_fortnite
if "%jogo%"=="2" goto priorizar_gtav
if "%jogo%"=="3" goto priorizar_fivem
if "%jogo%"=="4" goto priorizar_cs2
if "%jogo%"=="5" goto priorizar_minecraft
if "%jogo%"=="6" goto priorizar_valorant
if "%jogo%"=="7" goto priorizar_lol
if "%jogo%"=="8" goto priorizar_warzone
if "%jogo%"=="9" goto priorizar_apex
if "%jogo%"=="10" goto priorizar_roblox
if "%jogo%"=="11" goto priorizar_gow
if "%jogo%"=="12" goto priorizar_mta
if "%jogo%"=="13" goto priorizar_ets
if "%jogo%"=="14" goto priorizar_r6
if "%jogo%"=="15" goto priorizar_cult
if "%jogo%"=="16" goto priorizar_ultrakill
if "%jogo%"=="17" goto priorizar_bloodstrike
if "%jogo%"=="18" goto priorizar_arenabreakout
if "%jogo%"=="19" goto priorizar_residentevil4remake
if "%jogo%"=="20" goto priorizar_residentevil2remake
if "%jogo%"=="21" goto priorizar_residentevilvillage
if "%jogo%"=="22" goto priorizar_freefire
if "%jogo%"=="23" goto priorizar_battlefield2042
if "%jogo%"=="24" goto priorizar_battlefield4
if "%jogo%"=="25" goto priorizar_tlol
if "%jogo%"=="26" goto priorizar_pubg
if "%jogo%"=="27" goto priorizar_rocketleague
if "%jogo%"=="28" goto priorizar_cyberpunk
if "%jogo%"=="29" goto priorizar_terraria
if "%jogo%"=="30" goto priorizar_rdr2
if "%jogo%"=="31" goto priorizar_battlefield6
if "%jogo%"=="32" goto priorizar_choochoo
if "%jogo%"=="33" goto priorizar_hll
if "%jogo%"=="34" goto priorizar_fs22
if "%jogo%"=="35" goto priorizar_fs25
if "%jogo%"=="36" goto priorizar_hollowknight
if "%jogo%"=="37" goto priorizar_genshin
if "%jogo%"=="38" goto priorizar_pointblank
if "%jogo%"=="39" goto priorizar_mysummercar
if "%jogo%"=="40" goto priorizar_dayz
if "%jogo%"=="41" goto priorizar_sf6
if "%jogo%"=="42" goto priorizar_rust
if "%jogo%"=="43" goto priorizar_chivalry2
if "%jogo%"=="44" goto priorizar_subnautica
if "%jogo%"=="45" goto priorizar_left4dead
if "%jogo%"=="46" goto priorizar_marvelrivals
if "%jogo%"=="47" goto priorizar_warface
if "%jogo%"=="48" goto priorizar_deadlock
if "%jogo%"=="49" goto priorizar_cuphead
if "%jogo%"=="50" goto priorizar_escapefromtarkov
if "%jogo%"=="51" goto priorizar_deathstranding
if "%jogo%"=="52" goto priorizar_poppyplaytime
if "%jogo%"=="53" goto priorizar_re9
if "%jogo%"=="54" goto priorizar_pes
if "%jogo%"=="55" goto priorizar_dbd
if "%jogo%"=="56" goto priorizar_fc26
if "%jogo%"=="57" goto priorizar_ffxiv
if "%jogo%"=="58" goto priorizar_marvel
if "%jogo%"=="59" goto priorizar_got
if "%jogo%"=="60" goto priorizar_skyrim
if "%jogo%"=="61" goto priorizar_daysgone
if "%jogo%"=="62" goto priorizar_palworld
if "%jogo%"=="63" goto priorizar_crossfire
if "%jogo%"=="64" goto priorizar_warframe
if "%jogo%"=="65" goto priorizar_theisle
if "%jogo%"=="66" goto priorizar_snowrunner
if "%jogo%"=="67" goto priorizar_rematch
if "%jogo%"=="68" goto priorizar_meccha
if "%jogo%"=="69" goto exit
cls
goto :prioridadegames

:priorizar_fortnite
echo Aumentando prioridade do Fortnite...
reg add "HKEY_LOCAL_MACHINE\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Image File Execution Options\FortniteClient-Win64-Shipping.exe" /f
reg add "HKEY_LOCAL_MACHINE\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Image File Execution Options\FortniteClient-Win64-Shipping.exe\PerfOptions" /f
reg add "HKEY_LOCAL_MACHINE\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Image File Execution Options\FortniteClient-Win64-Shipping.exe\PerfOptions" /v CpuPriorityClass /t REG_DWORD /d 3 /f
pause
goto :prioridadegames

:priorizar_gtav
echo Aumentando prioridade do GTA V...
reg add "HKEY_LOCAL_MACHINE\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Image File Execution Options\GTA5.exe" /f
reg add "HKEY_LOCAL_MACHINE\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Image File Execution Options\GTA5.exe\PerfOptions" /f
reg add "HKEY_LOCAL_MACHINE\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Image File Execution Options\GTA5.exe\PerfOptions" /v CpuPriorityClass /t REG_DWORD /d 3 /f
pause
goto :prioridadegames

:priorizar_fivem
echo Aumentando prioridade do FiveM...
reg add "HKEY_LOCAL_MACHINE\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Image File Execution Options\FiveM_b2372_GTAProcess.exe" /f
reg add "HKEY_LOCAL_MACHINE\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Image File Execution Options\FiveM_b2372_GTAProcess.exe\PerfOptions" /f
reg add "HKEY_LOCAL_MACHINE\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Image File Execution Options\FiveM_b2372_GTAProcess.exe\PerfOptions" /v CpuPriorityClass /t REG_DWORD /d 3 /f
pause
goto :prioridadegames

:priorizar_cs2
echo Aumentando prioridade do CS2...
reg add "HKEY_LOCAL_MACHINE\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Image File Execution Options\cs2.exe" /f
reg add "HKEY_LOCAL_MACHINE\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Image File Execution Options\cs2.exe\PerfOptions" /f
reg add "HKEY_LOCAL_MACHINE\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Image File Execution Options\cs2.exe\PerfOptions" /v CpuPriorityClass /t REG_DWORD /d 3 /f
pause
goto :prioridadegames

:priorizar_minecraft
echo Aumentando prioridade do Minecraft...
reg add "HKEY_LOCAL_MACHINE\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Image File Execution Options\javaw.exe" /f
reg add "HKEY_LOCAL_MACHINE\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Image File Execution Options\javaw.exe\PerfOptions" /f
reg add "HKEY_LOCAL_MACHINE\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Image File Execution Options\javaw.exe\PerfOptions" /v CpuPriorityClass /t REG_DWORD /d 3 /f
pause
goto :prioridadegames

:priorizar_valorant
echo Aumentando prioridade do Valorant...
reg add "HKEY_LOCAL_MACHINE\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Image File Execution Options\VALORANT-Win64-Shipping.exe" /f
reg add "HKEY_LOCAL_MACHINE\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Image File Execution Options\VALORANT-Win64-Shipping.exe\PerfOptions" /f
reg add "HKEY_LOCAL_MACHINE\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Image File Execution Options\VALORANT-Win64-Shipping.exe\PerfOptions" /v CpuPriorityClass /t REG_DWORD /d 3 /f
pause
goto :prioridadegames

:priorizar_lol
echo Aumentando prioridade do League of Legends...
reg add "HKEY_LOCAL_MACHINE\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Image File Execution Options\LeagueClient.exe" /f
reg add "HKEY_LOCAL_MACHINE\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Image File Execution Options\LeagueClient.exe\PerfOptions" /f
reg add "HKEY_LOCAL_MACHINE\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Image File Execution Options\LeagueClient.exe\PerfOptions" /v CpuPriorityClass /t REG_DWORD /d 3 /f
pause
goto :prioridadegames

:priorizar_warzone
echo Aumentando prioridade do Warzone...
reg add "HKEY_LOCAL_MACHINE\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Image File Execution Options\cod.exe" /f
reg add "HKEY_LOCAL_MACHINE\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Image File Execution Options\cod.exe\PerfOptions" /f
reg add "HKEY_LOCAL_MACHINE\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Image File Execution Options\cod.exe\PerfOptions" /v CpuPriorityClass /t REG_DWORD /d 3 /f
pause
goto :prioridadegames

:priorizar_apex
echo Aumentando prioridade do Apex Legends...
reg add "HKEY_LOCAL_MACHINE\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Image File Execution Options\r5apex.exe" /f
reg add "HKEY_LOCAL_MACHINE\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Image File Execution Options\r5apex.exe\PerfOptions" /f
reg add "HKEY_LOCAL_MACHINE\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Image File Execution Options\r5apex.exe\PerfOptions" /v CpuPriorityClass /t REG_DWORD /d 3 /f
pause
goto :prioridadegames

:priorizar_roblox
echo Aumentando prioridade do Roblox...
reg add "HKEY_LOCAL_MACHINE\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Image File Execution Options\RobloxPlayerBeta.exe" /f
reg add "HKEY_LOCAL_MACHINE\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Image File Execution Options\RobloxPlayerBeta.exe\PerfOptions" /f
reg add "HKEY_LOCAL_MACHINE\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Image File Execution Options\RobloxPlayerBeta.exe\PerfOptions" /v CpuPriorityClass /t REG_DWORD /d 3 /f
pause
goto :prioridadegames

:priorizar_gow
echo Aumentando prioridade do God of War...
reg add "HKLM\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Image File Execution Options\GoW.exe" /f
reg add "HKLM\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Image File Execution Options\GoW.exe\PerfOptions" /f
reg add "HKLM\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Image File Execution Options\GoW.exe\PerfOptions" /v CpuPriorityClass /t REG_DWORD /d 3 /f
pause
goto :prioridadegames

:priorizar_gow_ragnarok
echo Aumentando prioridade do God of War Ragnarok...
reg add "HKLM\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Image File Execution Options\GoWRagnarok.exe" /f
reg add "HKLM\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Image File Execution Options\GoWRagnarok.exe\PerfOptions" /f
reg add "HKLM\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Image File Execution Options\GoWRagnarok.exe\PerfOptions" /v CpuPriorityClass /t REG_DWORD /d 3 /f
pause
goto :prioridadegames

:priorizar_mta
echo Aumentando prioridade do MTA: San Andreas...
reg add "HKLM\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Image File Execution Options\Multi Theft Auto.exe" /f
reg add "HKLM\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Image File Execution Options\Multi Theft Auto.exe\PerfOptions" /f
reg add "HKLM\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Image File Execution Options\Multi Theft Auto.exe\PerfOptions" /v CpuPriorityClass /t REG_DWORD /d 3 /f
reg add "HKLM\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Image File Execution Options\gta_sa.exe" /f
reg add "HKLM\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Image File Execution Options\gta_sa.exe\PerfOptions" /f
reg add "HKLM\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Image File Execution Options\gta_sa.exe\PerfOptions" /v CpuPriorityClass /t REG_DWORD /d 3 /f
pause
goto :prioridadegames

:priorizar_ets1
echo Aumentando prioridade do Euro Truck Simulator 1...
reg add "HKLM\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Image File Execution Options\eurotrucks.exe" /f
reg add "HKLM\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Image File Execution Options\eurotrucks.exe\PerfOptions" /f
reg add "HKLM\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Image File Execution Options\eurotrucks.exe\PerfOptions" /v CpuPriorityClass /t REG_DWORD /d 3 /f
pause
goto :prioridadegames

:priorizar_ets2
echo Aumentando prioridade do Euro Truck Simulator 2...
reg add "HKLM\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Image File Execution Options\ets2.exe" /f
reg add "HKLM\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Image File Execution Options\ets2.exe\PerfOptions" /f
reg add "HKLM\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Image File Execution Options\ets2.exe\PerfOptions" /v CpuPriorityClass /t REG_DWORD /d 3 /f
pause
goto :prioridadegames

:priorizar_r6
echo Aumentando prioridade do Rainbow Six Siege...
reg add "HKLM\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Image File Execution Options\RainbowSix.exe" /f
reg add "HKLM\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Image File Execution Options\RainbowSix.exe\PerfOptions" /f
reg add "HKLM\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Image File Execution Options\RainbowSix.exe\PerfOptions" /v CpuPriorityClass /t REG_DWORD /d 3 /f
pause
goto :prioridadegames


:priorizar_cult
echo Aumentando prioridade do Cult Of the Lamb...
reg add "HKLM\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Image File Execution Options\CultOfTheLamb.exe" /f
reg add "HKLM\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Image File Execution Options\CultOfTheLamb.exe\PerfOptions" /f
reg add "HKLM\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Image File Execution Options\CultOfTheLamb.exe\PerfOptions" /v CpuPriorityClass /t REG_DWORD /d 3 /f
echo Feito com Sucesso!
pause
goto :prioridadegames

:priorizar_ultrakill
echo Aumentando prioridade do Ultrakill...
reg add "HKLM\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Image File Execution Options\ULTRAKILL.exe" /f
reg add "HKLM\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Image File Execution Options\ULTRAKILL.exe\PerfOptions" /f
reg add "HKLM\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Image File Execution Options\ULTRAKILL.exe\PerfOptions" /v CpuPriorityClass /t REG_DWORD /d 3 /f
echo Feito com Sucesso!
pause
goto :prioridadegames

:priorizar_bloodstrike
echo Aumentando prioridade do BloodStrike...
reg add "HKLM\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Image File Execution Options\BloodStrike.exe" /f
reg add "HKLM\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Image File Execution Options\BloodStrike.exe\PerfOptions" /f
reg add "HKLM\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Image File Execution Options\BloodStrike.exe\PerfOptions" /v CpuPriorityClass /t REG_DWORD /d 3 /f
echo Feito com Sucesso!
pause
goto :prioridadegames

:priorizar_arenabreakout
echo Aumentando prioridade do Arena Breakout...
reg add "HKLM\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Image File Execution Options\ArenaBreakout.exe" /f
reg add "HKLM\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Image File Execution Options\ArenaBreakout.exe\PerfOptions" /f
reg add "HKLM\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Image File Execution Options\ArenaBreakout.exe\PerfOptions" /v CpuPriorityClass /t REG_DWORD /d 3 /f
echo Feito com Sucesso!
pause
goto :prioridadegames

:priorizar_residentevil4remake
echo Aumentando prioridade do Resident Evil 4 Remake...
reg add "HKLM\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Image File Execution Options\re4.exe" /f
reg add "HKLM\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Image File Execution Options\re4.exe\PerfOptions" /f
reg add "HKLM\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Image File Execution Options\re4.exe\PerfOptions" /v CpuPriorityClass /t REG_DWORD /d 3 /f
echo Feito com Sucesso!
pause
goto :prioridadegames

:priorizar_residentevil2remake
echo Aumentando prioridade do Resident Evil 2 Remake...
reg add "HKLM\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Image File Execution Options\re2.exe" /f
reg add "HKLM\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Image File Execution Options\re2.exe\PerfOptions" /f
reg add "HKLM\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Image File Execution Options\re2.exe\PerfOptions" /v CpuPriorityClass /t REG_DWORD /d 3 /f
echo Feito com Sucesso!
pause
goto :prioridadegames

:priorizar_residentevilvillage
echo Aumentando prioridade do Resident Evil Village...
reg add "HKLM\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Image File Execution Options\re8.exe" /f
reg add "HKLM\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Image File Execution Options\re8.exe\PerfOptions" /f
reg add "HKLM\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Image File Execution Options\re8.exe\PerfOptions" /v CpuPriorityClass /t REG_DWORD /d 3 /f
echo Feito com Sucesso!
pause
goto :prioridadegames


:priorizar_freefire
echo Aumentando prioridade do Free Fire...
reg add "HKLM\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Image File Execution Options\HD-Player.exe" /f
reg add "HKLM\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Image File Execution Options\HD-Player.exe\PerfOptions" /f
reg add "HKLM\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Image File Execution Options\HD-Player.exe\PerfOptions" /v CpuPriorityClass /t REG_DWORD /d 3 /f
echo Feito com Sucesso!
pause
goto :prioridadegames

:priorizar_battlefield2042
echo Aumentando prioridade do Battlefield 2042...
reg add "HKLM\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Image File Execution Options\BF2042.exe" /f
reg add "HKLM\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Image File Execution Options\BF2042.exe\PerfOptions" /f
reg add "HKLM\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Image File Execution Options\BF2042.exe\PerfOptions" /v CpuPriorityClass /t REG_DWORD /d 3 /f
echo Feito com Sucesso!
pause
goto :prioridadegames

:priorizar_battlefield4
echo Aumentando prioridade do Battlefield 4...
reg add "HKLM\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Image File Execution Options\bf4.exe" /f
reg add "HKLM\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Image File Execution Options\bf4.exe\PerfOptions" /f
reg add "HKLM\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Image File Execution Options\bf4.exe\PerfOptions" /v CpuPriorityClass /t REG_DWORD /d 3 /f
Echo Feito com Sucesso!
pause
goto :prioridadegames

:priorizar_tlou1
echo Aumentando prioridade do The Last of Us Part I & II...
reg add "HKEY_LOCAL_MACHINE\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Image File Execution Options\tlou-i.exe" /f
reg add "HKEY_LOCAL_MACHINE\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Image File Execution Options\tlou-i.exe\PerfOptions" /f
reg add "HKEY_LOCAL_MACHINE\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Image File Execution Options\tlou-i.exe\PerfOptions" /v CpuPriorityClass /t REG_DWORD /d 3 /f
reg add "HKEY_LOCAL_MACHINE\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Image File Execution Options\tlou-ii.exe" /f
reg add "HKEY_LOCAL_MACHINE\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Image File Execution Options\tlou-ii.exe\PerfOptions" /f
reg add "HKEY_LOCAL_MACHINE\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Image File Execution Options\tlou-ii.exe\PerfOptions" /v CpuPriorityClass /t REG_DWORD /d 3 /f
echo Feito com Sucesso!
pause
goto :prioridadegames

:priorizar_pubg
echo Aumentando prioridade do PUBG...
reg add "HKEY_LOCAL_MACHINE\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Image File Execution Options\tslgame.exe" /f
reg add "HKEY_LOCAL_MACHINE\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Image File Execution Options\tslgame.exe\PerfOptions" /f
reg add "HKEY_LOCAL_MACHINE\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Image File Execution Options\tslgame.exe\PerfOptions" /v CpuPriorityClass /t REG_DWORD /d 3 /f
echo Feito com Sucesso!
pause
goto :prioridadegames

:priorizar_rocketleague
echo Aumentando prioridade do Rocket League...
reg add "HKEY_LOCAL_MACHINE\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Image File Execution Options\RocketLeague.exe" /f
reg add "HKEY_LOCAL_MACHINE\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Image File Execution Options\RocketLeague.exe\PerfOptions" /f
reg add "HKEY_LOCAL_MACHINE\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Image File Execution Options\RocketLeague.exe\PerfOptions" /v CpuPriorityClass /t REG_DWORD /d 3 /f
echo Feito com Sucesso!
pause
goto :prioridadegames

:priorizar_cyberpunk
echo Aumentando prioridade do Cyberpunk 2077...
reg add "HKEY_LOCAL_MACHINE\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Image File Execution Options\Cyberpunk2077.exe" /f
reg add "HKEY_LOCAL_MACHINE\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Image File Execution Options\Cyberpunk2077.exe\PerfOptions" /f
reg add "HKEY_LOCAL_MACHINE\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Image File Execution Options\Cyberpunk2077.exe\PerfOptions" /v CpuPriorityClass /t REG_DWORD /d 3 /f
echo Feito com Sucesso!
pause
goto :prioridadegames

:priorizar_terraria
echo Aumentando prioridade do Terraria...
reg add "HKEY_LOCAL_MACHINE\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Image File Execution Options\Terraria.exe" /f
reg add "HKEY_LOCAL_MACHINE\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Image File Execution Options\Terraria.exe\PerfOptions" /f
reg add "HKEY_LOCAL_MACHINE\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Image File Execution Options\Terraria.exe\PerfOptions" /v CpuPriorityClass /t REG_DWORD /d 3 /f
echo Feito com Sucesso!
pause
goto :prioridadegames

:priorizar_rdr2
echo Aumentando prioridade do Red Dead Redemption 2...
reg add "HKEY_LOCAL_MACHINE\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Image File Execution Options\RDR2.exe" /f
reg add "HKEY_LOCAL_MACHINE\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Image File Execution Options\RDR2.exe\PerfOptions" /f
reg add "HKEY_LOCAL_MACHINE\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Image File Execution Options\RDR2.exe\PerfOptions" /v CpuPriorityClass /t REG_DWORD /d 3 /f
echo Feito com Sucesso!
pause
goto :prioridadegames

:priorizar_battlefield6
echo Aumentando prioridade do Battlefield 6...
reg add "HKLM\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Image File Execution Options\BF6.exe" /f
reg add "HKLM\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Image File Execution Options\BF6.exe\PerfOptions" /f
reg add "HKLM\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Image File Execution Options\BF6.exe\PerfOptions" /v CpuPriorityClass /t REG_DWORD /d 3 /f
pause
goto :prioridadegames

:priorizar_choochoo
echo Aumentando prioridade do Choo Choo Charles...
reg add "HKLM\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Image File Execution Options\Charles.exe" /f
reg add "HKLM\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Image File Execution Options\Charles.exe\PerfOptions" /f
reg add "HKLM\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Image File Execution Options\Charles.exe\PerfOptions" /v CpuPriorityClass /t REG_DWORD /d 3 /f
pause
goto :prioridadegames

:priorizar_hll
echo Aumentando prioridade do Hell Let Loose...
reg add "HKLM\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Image File Execution Options\HLL.exe" /f
reg add "HKLM\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Image File Execution Options\HLL.exe\PerfOptions" /f
reg add "HKLM\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Image File Execution Options\HLL.exe\PerfOptions" /v CpuPriorityClass /t REG_DWORD /d 3 /f
pause
goto :prioridadegames

:priorizar_fs22
echo Aumentando prioridade do Farming Simulator 22...
reg add "HKLM\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Image File Execution Options\FarmingSimulator2022.exe" /f
reg add "HKLM\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Image File Execution Options\FarmingSimulator2022.exe\PerfOptions" /f
reg add "HKLM\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Image File Execution Options\FarmingSimulator2022.exe\PerfOptions" /v CpuPriorityClass /t REG_DWORD /d 3 /f
pause
goto :prioridadegames

:priorizar_fs25
echo Aumentando prioridade do Farming Simulator 25...
reg add "HKLM\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Image File Execution Options\FarmingSimulator2025.exe" /f
reg add "HKLM\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Image File Execution Options\FarmingSimulator2025.exe\PerfOptions" /f
reg add "HKLM\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Image File Execution Options\FarmingSimulator2025.exe\PerfOptions" /v CpuPriorityClass /t REG_DWORD /d 3 /f
pause
goto :prioridadegames

:priorizar_hollowknight
echo Aumentando prioridade do Hollow Knight...
reg add "HKLM\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Image File Execution Options\hollow_knight.exe" /f
reg add "HKLM\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Image File Execution Options\hollow_knight.exe\PerfOptions" /f
reg add "HKLM\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Image File Execution Options\hollow_knight.exe\PerfOptions" /v CpuPriorityClass /t REG_DWORD /d 3 /f
pause
goto :prioridadegames

:priorizar_genshin
echo Aumentando prioridade do Genshin Impact...
reg add "HKLM\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Image File Execution Options\GenshinImpact.exe" /f
reg add "HKLM\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Image File Execution Options\GenshinImpact.exe\PerfOptions" /f
reg add "HKLM\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Image File Execution Options\GenshinImpact.exe\PerfOptions" /v CpuPriorityClass /t REG_DWORD /d 3 /f
pause
goto :prioridadegames

:priorizar_pointblank
echo Aumentando prioridade do Point Blank...
reg add "HKLM\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Image File Execution Options\PointBlank.exe" /f
reg add "HKLM\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Image File Execution Options\PointBlank.exe\PerfOptions" /f
reg add "HKLM\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Image File Execution Options\PointBlank.exe\PerfOptions" /v CpuPriorityClass /t REG_DWORD /d 3 /f
pause
goto :prioridadegames

:priorizar_mysummercar
echo Aumentando prioridade do My Summer Car...
reg add "HKLM\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Image File Execution Options\mysummercar.exe" /f
reg add "HKLM\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Image File Execution Options\mysummercar.exe\PerfOptions" /f
reg add "HKLM\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Image File Execution Options\mysummercar.exe\PerfOptions" /v CpuPriorityClass /t REG_DWORD /d 3 /f
pause
goto :prioridadegames

:priorizar_dayz
echo Aumentando prioridade do DayZ...
reg add "HKLM\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Image File Execution Options\DayZ.exe" /f
reg add "HKLM\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Image File Execution Options\DayZ.exe\PerfOptions" /f
reg add "HKLM\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Image File Execution Options\DayZ.exe\PerfOptions" /v CpuPriorityClass /t REG_DWORD /d 3 /f
pause
goto :prioridadegames

:priorizar_sf6
echo Aumentando prioridade do Street Fighter 6...
reg add "HKLM\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Image File Execution Options\StreetFighter6.exe" /f
reg add "HKLM\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Image File Execution Options\StreetFighter6.exe\PerfOptions" /f
reg add "HKLM\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Image File Execution Options\StreetFighter6.exe\PerfOptions" /v CpuPriorityClass /t REG_DWORD /d 3 /f
pause
goto :prioridadegames

:priorizar_rust
echo Aumentando prioridade do Rust...
reg add "HKLM\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Image File Execution Options\RustClient.exe" /f
reg add "HKLM\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Image File Execution Options\RustClient.exe\PerfOptions" /f
reg add "HKLM\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Image File Execution Options\RustClient.exe\PerfOptions" /v CpuPriorityClass /t REG_DWORD /d 3 /f
pause
goto :prioridadegames

:priorizar_re9
echo Aumentando prioridade do Resident Evil Requiem...
reg add "HKLM\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Image File Execution Options\RustClient.exe" /f
reg add "HKLM\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Image File Execution Options\RustClient.exe\PerfOptions" /f
reg add "HKLM\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Image File Execution Options\RustClient.exe\PerfOptions" /v CpuPriorityClass /t REG_DWORD /d 3 /f
pause
goto :prioridadegames

:priorizar_chivalry2
echo Aumentando prioridade do Chivalry 2...
reg add "HKEY_LOCAL_MACHINE\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Image File Execution Options\Chivalry2-Win64-Shipping.exe" /f
reg add "HKEY_LOCAL_MACHINE\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Image File Execution Options\Chivalry2-Win64-Shipping.exe\PerfOptions" /f
reg add "HKEY_LOCAL_MACHINE\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Image File Execution Options\Chivalry2-Win64-Shipping.exe\PerfOptions" /v CpuPriorityClass /t REG_DWORD /d 3 /f

pause
goto :prioridadegames

:priorizar_subnautica
echo Aumentando prioridade do Subnautica...
reg add "HKEY_LOCAL_MACHINE\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Image File Execution Options\Subnautica.exe" /f
reg add "HKEY_LOCAL_MACHINE\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Image File Execution Options\Subnautica.exe\PerfOptions" /f
reg add "HKEY_LOCAL_MACHINE\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Image File Execution Options\Subnautica.exe\PerfOptions" /v CpuPriorityClass /t REG_DWORD /d 3 /f
pause
goto :prioridadegames

:priorizar_left4dead
echo Aumentando prioridade do Left 4 Dead...
reg add "HKEY_LOCAL_MACHINE\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Image File Execution Options\left4dead.exe" /f
reg add "HKEY_LOCAL_MACHINE\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Image File Execution Options\left4dead.exe\PerfOptions" /f
reg add "HKEY_LOCAL_MACHINE\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Image File Execution Options\left4dead.exe\PerfOptions" /v CpuPriorityClass /t REG_DWORD /d 3 /f
reg add "HKEY_LOCAL_MACHINE\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Image File Execution Options\left4dead2.exe" /f
reg add "HKEY_LOCAL_MACHINE\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Image File Execution Options\left4dead2.exe\PerfOptions" /f
reg add "HKEY_LOCAL_MACHINE\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Image File Execution Options\left4dead2.exe\PerfOptions" /v CpuPriorityClass /t REG_DWORD /d 3 /f
pause
goto :prioridadegames

:priorizar_marvelrivals
echo Aumentando prioridade do Marvel Rivals...
reg add "HKEY_LOCAL_MACHINE\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Image File Execution Options\MarvelRivals.exe" /f
reg add "HKEY_LOCAL_MACHINE\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Image File Execution Options\MarvelRivals.exe\PerfOptions" /f
reg add "HKEY_LOCAL_MACHINE\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Image File Execution Options\MarvelRivals.exe\PerfOptions" /v CpuPriorityClass /t REG_DWORD /d 3 /f
pause
goto :prioridadegames

:priorizar_warface
echo Aumentando prioridade do Warface...
reg add "HKEY_LOCAL_MACHINE\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Image File Execution Options\Warface.exe" /f
reg add "HKEY_LOCAL_MACHINE\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Image File Execution Options\Warface.exe\PerfOptions" /f
reg add "HKEY_LOCAL_MACHINE\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Image File Execution Options\Warface.exe\PerfOptions" /v CpuPriorityClass /t REG_DWORD /d 3 /fpause
pause
goto :prioridadegames

:priorizar_deadlock
echo Aumentando prioridade do Deadlock...
reg add "HKEY_LOCAL_MACHINE\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Image File Execution Options\Deadlock.exe" /f
reg add "HKEY_LOCAL_MACHINE\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Image File Execution Options\Deadlock.exe\PerfOptions" /f
reg add "HKEY_LOCAL_MACHINE\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Image File Execution Options\Deadlock.exe\PerfOptions" /v CpuPriorityClass /t REG_DWORD /d 3 /f
pause
goto :prioridadegames

:priorizar_cuphead
echo Aumentando prioridade do Cuphead...
reg add "HKEY_LOCAL_MACHINE\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Image File Execution Options\Cuphead.exe" /f
reg add "HKEY_LOCAL_MACHINE\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Image File Execution Options\Cuphead.exe\PerfOptions" /f
reg add "HKEY_LOCAL_MACHINE\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Image File Execution Options\Cuphead.exe\PerfOptions" /v CpuPriorityClass /t REG_DWORD /d 3 /f
pause
goto :prioridadegames

:priorizar_escapefromtarkov
echo Aumentando prioridade do Escape From Tarkov...
reg add "HKEY_LOCAL_MACHINE\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Image File Execution Options\EscapeFromTarkov.exe" /f
reg add "HKEY_LOCAL_MACHINE\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Image File Execution Options\EscapeFromTarkov.exe\PerfOptions" /f
reg add "HKEY_LOCAL_MACHINE\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Image File Execution Options\EscapeFromTarkov.exe\PerfOptions" /v CpuPriorityClass /t REG_DWORD /d 3 /f
pause
goto :prioridadegames

:priorizar_deathstranding
echo Aumentando prioridade do Death Stranding...
reg add "HKEY_LOCAL_MACHINE\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Image File Execution Options\ds.exe" /f
reg add "HKEY_LOCAL_MACHINE\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Image File Execution Options\ds.exe\PerfOptions" /f
reg add "HKEY_LOCAL_MACHINE\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Image File Execution Options\ds.exe\PerfOptions" /v CpuPriorityClass /t REG_DWORD /d 3 /f
reg add "HKEY_LOCAL_MACHINE\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Image File Execution Options\DeathStranding2.exe" /f
reg add "HKEY_LOCAL_MACHINE\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Image File Execution Options\DeathStranding2.exe\PerfOptions" /f
reg add "HKEY_LOCAL_MACHINE\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Image File Execution Options\DeathStranding2.exe\PerfOptions" /v CpuPriorityClass /t REG_DWORD /d 3 /f
pause
goto :prioridadegames

:priorizar_poppyplaytime
echo Aumentando prioridade do Poppy Playtime Chapter...
reg add "HKLM\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Image File Execution Options\Poppy_Playtime.exe" /f
reg add "HKLM\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Image File Execution Options\Poppy_Playtime.exe\PerfOptions" /f
reg add "HKLM\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Image File Execution Options\Poppy_Playtime.exe\PerfOptions" /v CpuPriorityClass /t REG_DWORD /d 3 /f
reg add "HKLM\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Image File Execution Options\Playtime_Multiplayer.exe" /f
reg add "HKLM\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Image File Execution Options\Playtime_Multiplayer.exe\PerfOptions" /f
reg add "HKLM\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Image File Execution Options\Playtime_Multiplayer.exe\PerfOptions" /v CpuPriorityClass /t REG_DWORD /d 3 /f
reg add "HKLM\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Image File Execution Options\ProjectPlaytime.exe" /f
reg add "HKLM\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Image File Execution Options\ProjectPlaytime.exe\PerfOptions" /f
reg add "HKLM\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Image File Execution Options\ProjectPlaytime.exe\PerfOptions" /v CpuPriorityClass /t REG_DWORD /d 3 /f
reg add "HKLM\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Image File Execution Options\PoppyPlaytimeChapter4.exe" /f
reg add "HKLM\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Image File Execution Options\PoppyPlaytimeChapter4.exe\PerfOptions" /f
reg add "HKLM\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Image File Execution Options\PoppyPlaytimeChapter4.exe\PerfOptions" /v CpuPriorityClass /t REG_DWORD /d 3 /f
reg add "HKLM\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Image File Execution Options\PoppyPlaytimeChapter5.exe" /f
reg add "HKLM\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Image File Execution Options\PoppyPlaytimeChapter5.exe\PerfOptions" /f
reg add "HKLM\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Image File Execution Options\PoppyPlaytimeChapter5.exe\PerfOptions" /v CpuPriorityClass /t REG_DWORD /d 3 /f
pause
goto :prioridadegames

:priorizar_pes
echo Aumentando prioridade do PES...
reg add "HKLM\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Image File Execution Options\PES2017.exe" /f
reg add "HKLM\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Image File Execution Options\PES2017.exe\PerfOptions" /f
reg add "HKLM\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Image File Execution Options\PES2017.exe\PerfOptions" /v CpuPriorityClass /t REG_DWORD /d 3 /f

reg add "HKLM\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Image File Execution Options\PES2018.exe" /f
reg add "HKLM\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Image File Execution Options\PES2018.exe\PerfOptions" /f
reg add "HKLM\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Image File Execution Options\PES2018.exe\PerfOptions" /v CpuPriorityClass /t REG_DWORD /d 3 /f

reg add "HKLM\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Image File Execution Options\PES2019.exe" /f
reg add "HKLM\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Image File Execution Options\PES2019.exe\PerfOptions" /f
reg add "HKLM\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Image File Execution Options\PES2019.exe\PerfOptions" /v CpuPriorityClass /t REG_DWORD /d 3 /f

reg add "HKLM\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Image File Execution Options\PES2020.exe" /f
reg add "HKLM\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Image File Execution Options\PES2020.exe\PerfOptions" /f
reg add "HKLM\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Image File Execution Options\PES2020.exe\PerfOptions" /v CpuPriorityClass /t REG_DWORD /d 3 /f

reg add "HKLM\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Image File Execution Options\eFootball.exe" /f
reg add "HKLM\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Image File Execution Options\eFootball.exe\PerfOptions" /f
reg add "HKLM\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Image File Execution Options\eFootball.exe\PerfOptions" /v CpuPriorityClass /t REG_DWORD /d 3 /f
pause
goto :prioridadegames

:priorizar_dbd
echo Aumentando prioridade do Dead by Daylight...
reg add "HKLM\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Image File Execution Options\DeadByDaylight-Win64-Shipping.exe" /f
reg add "HKLM\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Image File Execution Options\DeadByDaylight-Win64-Shipping.exe\PerfOptions" /f
reg add "HKLM\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Image File Execution Options\DeadByDaylight-Win64-Shipping.exe\PerfOptions" /v CpuPriorityClass /t REG_DWORD /d 3 /f
pause
goto :prioridadegames

:priorizar_fc26
echo Aumentando prioridade do EA SPORTS FC 26...
reg add "HKLM\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Image File Execution Options\FC26.exe" /f
reg add "HKLM\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Image File Execution Options\FC26.exe\PerfOptions" /f
reg add "HKLM\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Image File Execution Options\FC26.exe\PerfOptions" /v CpuPriorityClass /t REG_DWORD /d 3 /f
pause
goto :prioridadegames

:priorizar_ffxiv
echo Aumentando prioridade do Final Fantasy XIV...
reg add "HKLM\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Image File Execution Options\ffxiv_dx11.exe" /f
reg add "HKLM\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Image File Execution Options\ffxiv_dx11.exe\PerfOptions" /f
reg add "HKLM\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Image File Execution Options\ffxiv_dx11.exe\PerfOptions" /v CpuPriorityClass /t REG_DWORD /d 3 /f
pause
goto :prioridadegames

:priorizar_marvel
echo Aumentando prioridade do Marvel Rivals...
reg add "HKLM\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Image File Execution Options\MarvelRivals.exe" /f
reg add "HKLM\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Image File Execution Options\MarvelRivals.exe\PerfOptions" /f
reg add "HKLM\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Image File Execution Options\MarvelRivals.exe\PerfOptions" /v CpuPriorityClass /t REG_DWORD /d 3 /f
pause
goto :prioridadegames

:priorizar_got
echo Aumentando prioridade do Ghost of Tsushima...
reg add "HKLM\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Image File Execution Options\GhostOfTsushima.exe" /f
reg add "HKLM\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Image File Execution Options\GhostOfTsushima.exe\PerfOptions" /f
reg add "HKLM\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Image File Execution Options\GhostOfTsushima.exe\PerfOptions" /v CpuPriorityClass /t REG_DWORD /d 3 /f
pause
goto :prioridadegames

:priorizar_skyrim
echo Aumentando prioridade do Skyrim...
reg add "HKLM\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Image File Execution Options\SkyrimSE.exe" /f
reg add "HKLM\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Image File Execution Options\SkyrimSE.exe\PerfOptions" /f
reg add "HKLM\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Image File Execution Options\SkyrimSE.exe\PerfOptions" /v CpuPriorityClass /t REG_DWORD /d 3 /f
pause
goto :prioridadegames

:priorizar_daysgone
echo Aumentando prioridade do Days Gone...
reg add "HKLM\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Image File Execution Options\DaysGone.exe" /f
reg add "HKLM\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Image File Execution Options\DaysGone.exe\PerfOptions" /f
reg add "HKLM\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Image File Execution Options\DaysGone.exe\PerfOptions" /v CpuPriorityClass /t REG_DWORD /d 3 /f
pause
goto :prioridadegames

:priorizar_palworld
echo Aumentando prioridade do Palworld...
reg add "HKLM\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Image File Execution Options\Palworld-Win64-Shipping.exe" /f
reg add "HKLM\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Image File Execution Options\Palworld-Win64-Shipping.exe\PerfOptions" /f
reg add "HKLM\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Image File Execution Options\Palworld-Win64-Shipping.exe\PerfOptions" /v CpuPriorityClass /t REG_DWORD /d 3 /f
pause
goto :prioridadegames

:priorizar_crossfire
echo Aumentando prioridade do CrossFire...
reg add "HKLM\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Image File Execution Options\crossfire.exe" /f
reg add "HKLM\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Image File Execution Options\crossfire.exe\PerfOptions" /f
reg add "HKLM\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Image File Execution Options\crossfire.exe\PerfOptions" /v CpuPriorityClass /t REG_DWORD /d 3 /f
pause
goto :prioridadegames

:priorizar_warframe
echo Aumentando prioridade do Warframe...
reg add "HKLM\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Image File Execution Options\Warframe.x64.exe" /f
reg add "HKLM\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Image File Execution Options\Warframe.x64.exe\PerfOptions" /f
reg add "HKLM\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Image File Execution Options\Warframe.x64.exe\PerfOptions" /v CpuPriorityClass /t REG_DWORD /d 3 /f
pause
goto :prioridadegames

:priorizar_theisle
echo Aumentando prioridade do The Isle...
reg add "HKLM\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Image File Execution Options\TheIsleClient-Win64-Shipping.exe" /f
reg add "HKLM\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Image File Execution Options\TheIsleClient-Win64-Shipping.exe\PerfOptions" /f
reg add "HKLM\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Image File Execution Options\TheIsleClient-Win64-Shipping.exe\PerfOptions" /v CpuPriorityClass /t REG_DWORD /d 3 /f
pause
goto :prioridadegames

:priorizar_snowrunner
echo Aumentando prioridade do SnowRunner...
reg add "HKLM\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Image File Execution Options\SnowRunner.exe" /f
reg add "HKLM\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Image File Execution Options\SnowRunner.exe\PerfOptions" /f
reg add "HKLM\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Image File Execution Options\SnowRunner.exe\PerfOptions" /v CpuPriorityClass /t REG_DWORD /d 3 /f
pause
goto :prioridadegames

:priorizar_rematch
echo Aumentando prioridade do REMATCH...
reg add "HKLM\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Image File Execution Options\REMATCH.exe" /f
reg add "HKLM\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Image File Execution Options\REMATCH.exe\PerfOptions" /f
reg add "HKLM\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Image File Execution Options\REMATCH.exe\PerfOptions" /v CpuPriorityClass /t REG_DWORD /d 3 /f
pause
goto :prioridadegames

:priorizar_meccha
echo Aumentando prioridade do Meccha Chameleon...
reg add "HKLM\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Image File Execution Options\MecchaChameleon.exe" /f
reg add "HKLM\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Image File Execution Options\MecchaChameleon.exe\PerfOptions" /f
reg add "HKLM\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Image File Execution Options\MecchaChameleon.exe\PerfOptions" /v CpuPriorityClass /t REG_DWORD /d 3 /f
pause
goto :prioridadegames


