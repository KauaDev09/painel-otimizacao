# Orion Optimizer - Coletor de informacoes de hardware/BIOS.
# Executa consultas CIM/WMI e leituras de registro SOMENTE-LEITURA.
# Nenhuma alteracao de sistema e feita por este script.
$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

$out = [ordered]@{}
$errors = [ordered]@{}

function Sec {
    param([string]$Name, [scriptblock]$Block, [switch]$List)
    # O servico WMI/CIM pode falhar transitoriamente logo apos o boot ou sob carga;
    # cada secao tenta ate 3 vezes antes de registrar falha honesta em __errors.
    # -List garante ARRAY na saida mesmo com um unico elemento
    # (ConvertTo-Json do PS 5.1 desfaz arrays de 1 item).
    for ($attempt = 1; $attempt -le 3; $attempt++) {
        try {
            $r = & $Block
            if ($null -ne $r) {
                if ($List) { $out[$Name] = @($r) } else { $out[$Name] = $r }
            } else { $out[$Name] = $null }
            return
        } catch {
            if ($attempt -eq 3) {
                $out[$Name] = $null
                $errors[$Name] = $_.Exception.Message
            } else {
                Start-Sleep -Milliseconds (400 * $attempt)
            }
        }
    }
}

Sec 'cpu' -List {
    Get-CimInstance Win32_Processor | Select-Object `
        Name, Manufacturer, NumberOfCores, NumberOfLogicalProcessors,
        MaxClockSpeed, CurrentClockSpeed, SocketDesignation,
        VirtualizationFirmwareEnabled, Architecture, Description, Revision
}

Sec 'system' -List {
    Get-CimInstance Win32_ComputerSystem | Select-Object `
        Manufacturer, Model, SystemFamily, PCSystemType, HypervisorPresent,
        TotalPhysicalMemory
}

Sec 'board' -List {
    Get-CimInstance Win32_BaseBoard | Select-Object Manufacturer, Product, Version
}

Sec 'chassis' -List {
    Get-CimInstance Win32_SystemEnclosure | Select-Object ChassisTypes
}

Sec 'bios' -List {
    Get-CimInstance Win32_BIOS | Select-Object Manufacturer, SMBIOSBIOSVersion, Name,
        @{ n = 'ReleaseDateStr'; e = { if ($_.ReleaseDate) { $_.ReleaseDate.ToString('yyyy-MM-dd') } } },
        SMBIOSMajorVersion, SMBIOSMinorVersion
}

Sec 'ram' -List {
    Get-CimInstance Win32_PhysicalMemory | Select-Object `
        BankLabel, DeviceLocator, Capacity, Speed, ConfiguredClockSpeed,
        MinVoltage, MaxVoltage, ConfiguredVoltage, Manufacturer, PartNumber,
        SMBIOSMemoryType, FormFactor, TypeDetail
}

Sec 'slots' -List {
    Get-CimInstance Win32_PhysicalMemoryArray | Select-Object MemoryDevices
}

Sec 'gpu' -List {
    Get-CimInstance Win32_VideoController |
        Select-Object Name, AdapterCompatibility, DriverVersion,
        @{ n = 'DriverDateStr'; e = { if ($_.DriverDate) { $_.DriverDate.ToString('yyyy-MM-dd') } } },
        AdapterRAM, VideoModeDescription, Status, PNPDeviceID, VideoProcessor
}

Sec 'os' -List {
    Get-CimInstance Win32_OperatingSystem | Select-Object Caption, Version, BuildNumber, OSArchitecture
}

Sec 'osreg' -List {
    Get-ItemProperty 'HKLM:\SOFTWARE\Microsoft\Windows NT\CurrentVersion' |
        Select-Object ProductName, DisplayVersion, CurrentBuildNumber, UBR, EditionID, InstallationType
}

Sec 'boot' {
    @{
        fwEnv = $env:firmware_type
        peReg = (Get-ItemProperty -Path 'HKLM:\SYSTEM\CurrentControlSet\Control' -Name 'PEFirmwareType' -ErrorAction SilentlyContinue).PEFirmwareType
    }
}

Sec 'secureboot' {
    @{
        reg = (Get-ItemProperty -Path 'HKLM:\SYSTEM\CurrentControlSet\Control\SecureBoot\State' -Name 'UEFISecureBootEnabled' -ErrorAction SilentlyContinue).UEFISecureBootEnabled
    }
}

Sec 'tpm' -List {
    Get-CimInstance -Namespace 'root\cimv2\Security\MicrosoftTpm' -ClassName Win32_Tpm |
        Select-Object IsEnabled_InitialValue, IsActivated_InitialValue, IsOwned_InitialValue, SpecVersion
}

Sec 'tpmPnp' -List {
    Get-CimInstance Win32_PnPEntity -Filter "Name LIKE '%Trusted Platform%' OR Name LIKE '%Platform Security%'" |
        Select-Object Name, PNPDeviceID
}

Sec 'disks' -List {
    $sysLetter = ($env:SystemDrive).TrimEnd(':')
    Get-Partition -DriveLetter $sysLetter -ErrorAction SilentlyContinue |
        Get-Disk | Select-Object Number, FriendlyName, PartitionStyle, BusType,
        @{ n = 'SizeGB'; e = { [math]::Round($_.Size / 1GB) } }
}

Sec 'gpumem' -List {
    $res = @()
    $cls = 'HKLM:\SYSTEM\CurrentControlSet\Control\Class\{4d36e968-e325-11ce-bfc1-08002be10318}'
    $keys = Get-ChildItem $cls -ErrorAction SilentlyContinue | Where-Object { $_.PSChildName -match '^0[0-9]+$' }
    foreach ($k in $keys) {
        $p = Get-ItemProperty -Path $k.PSPath -ErrorAction SilentlyContinue
        if ($p -and $p.DriverDesc) {
            $memBytes = $null
            if ($p.'qwMemorySize') {
                $b = [byte[]]$p.'qwMemorySize'
                if ($b.Length -ge 8) { $memBytes = [BitConverter]::ToUInt64($b, 0) }
            }
            $res += [pscustomobject]@{ desc = $p.DriverDesc; memBytes = $memBytes; matchId = $p.MatchingDeviceId }
        }
    }
    if ($res.Count -gt 0) { $res } else { $null }
}

$out['__errors'] = $errors
$out | ConvertTo-Json -Depth 6 -Compress
