@echo off
echo Aplicando optimizacoes de timer...

bcdedit /set useplatformtick yes
bcdedit /set disabledynamictick yes
bcdedit /set tscsyncpolicy Enhanced

pause