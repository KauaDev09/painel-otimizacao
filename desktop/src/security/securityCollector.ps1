# Orion Optimizer - Coletor de seguranca (Microsoft Defender e protecoes do Windows).
# Consultas SOMENTE-LEITURA: cmdlets Get-Mp*, Get-NetFirewallProfile, CIM e leitura de registro.
# Nenhuma alteracao de sistema e feita por este script.
$ErrorActionPreference = 'SilentlyContinue'
$ProgressPreference = 'SilentlyContinue'
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

$out = [ordered]@{}
$errors = [ordered]@{}

function Sec {
    param([string]$Name, [scriptblock]$Block, [switch]$List)
    try {
        $r = & $Block
        if ($null -ne $r) {
            if ($List) { $out[$Name] = @($r) } else { $out[$Name] = $r }
        } else { $out[$Name] = $null }
    } catch {
        $out[$Name] = $null
        $errors[$Name] = $_.Exception.Message
    }
}

function IsoDate { param($d) if ($d) { $d.ToString('o') } else { $null } }

# ---- Microsoft Defender ----
Sec 'defender' {
    $s = Get-MpComputerStatus
    [ordered]@{
        available            = [bool]$s
        amServiceEnabled     = $s.AMServiceEnabled
        antivirusEnabled     = $s.AntivirusEnabled
        realTimeEnabled      = $s.RealTimeProtectionEnabled
        behaviorMonitor      = $s.BehaviorMonitorEnabled
        ioavProtection       = $s.IoavProtectionEnabled
        nisEnabled           = $s.NISEnabled
        tamperProtected      = $s.IsTamperProtected
        signatureVersion     = $s.AntivirusSignatureVersion
        engineVersion        = $s.EngineVersion
        signatureLastUpdated = IsoDate $s.AntivirusSignatureLastUpdated
        quickScanStart       = IsoDate $s.QuickScanStartTime
        quickScanEnd         = IsoDate $s.QuickScanEndTime
        fullScanStart        = IsoDate $s.FullScanStartTime
        fullScanEnd          = IsoDate $s.FullScanEndTime
    }
}

Sec 'defenderPrefs' {
    $p = Get-MpPreference
    [ordered]@{
        disableRealtime   = $p.DisableRealtimeMonitoring
        puaProtection     = $p.PUAProtection
        mapsReporting     = $p.MAPSReporting
        exclusionCount    = @($p.ExclusionPath).Count + @($p.ExclusionProcess).Count + @($p.ExclusionExtension).Count
    }
}

# ---- Ameacas detectadas (verificacao de malware) ----
Sec 'threats' -List {
    Get-MpThreat | Select-Object ThreatID, ThreatName, SeverityID, IsActive, DidThreatExecute
}

Sec 'threatDetections' -List {
    Get-MpThreatDetection | Select-Object `
        @{ n = 'InitialDetectionTimeStr'; e = { IsoDate $_.InitialDetectionTime } },
        ThreatID, ProcessName, Resources
}

# ---- Antivirus registrados no Windows Security Center ----
Sec 'avProducts' -List {
    Get-CimInstance -Namespace 'root/SecurityCenter2' -ClassName AntiVirusProduct |
        Select-Object displayName, productState,
        @{ n = 'timestampStr'; e = { $_.timestamp } }
}

# ---- Firewall ----
Sec 'firewall' -List {
    Get-NetFirewallProfile | Select-Object Name, Enabled
}

# ---- UAC ----
Sec 'uac' {
    $u = Get-ItemProperty 'HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Policies\System'
    [ordered]@{ enableLua = $u.EnableLUA; consentPrompt = $u.ConsentPromptBehaviorAdmin }
}

# ---- SmartScreen ----
Sec 'smartscreen' {
    @{
        explorer = (Get-ItemProperty 'HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Explorer' -ErrorAction SilentlyContinue).SmartScreenEnabled
        edge     = (Get-ItemProperty 'HKLM:\SOFTWARE\Policies\Microsoft\Edge' -ErrorAction SilentlyContinue).SmartScreenEnabled
    }
}

# ---- Windows Update (configuracao basica via registro) ----
Sec 'winupdate' {
    $au = Get-ItemProperty 'HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\WindowsUpdate\Auto Update' -ErrorAction SilentlyContinue
    $pol = Get-ItemProperty 'HKLM:\SOFTWARE\Policies\Microsoft\Windows\WindowsUpdate\AU' -ErrorAction SilentlyContinue
    [ordered]@{ noAutoUpdate = $pol.NoAutoUpdate; auOptions = $pol.AUOptions; lastWait = $null }
}

$out['__errors'] = $errors
$out | ConvertTo-Json -Depth 5 -Compress
