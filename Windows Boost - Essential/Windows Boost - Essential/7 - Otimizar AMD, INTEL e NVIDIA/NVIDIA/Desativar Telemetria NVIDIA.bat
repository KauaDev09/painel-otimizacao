@echo off
echo Desativando telemetria NVIDIA...

sc stop NvTelemetryContainer
sc config NvTelemetryContainer start= disabled

sc stop NVDisplay.ContainerLocalSystem
sc config NVDisplay.ContainerLocalSystem start= auto

pause
