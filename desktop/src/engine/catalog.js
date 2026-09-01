'use strict';

// Catalog — catálogo central de otimizações.
// Cada item define: nome, categoria, descrição, benefício, risco, se exige
// administrador, se pede confirmação, a quais perfis pertence, se é PRO e
// como aplicar/desfazer. Nenhum comando vem da interface: a UI apenas
// referencia ids deste catálogo.

const path = require('path');

const CATEGORIES = {
  windows: 'Windows',
  cpu: 'CPU',
  gpu: 'GPU',
  ram: 'RAM',
  rede: 'Rede',
  armazenamento: 'Armazenamento',
  energia: 'Energia',
  inicializacao: 'Inicialização',
  jogos: 'Jogos',
  limpeza: 'Limpeza',
  seguranca: 'Segurança'
};

const CATEGORY_ICONS = {
  windows: 'windows',
  cpu: 'cpu',
  gpu: 'gpu',
  ram: 'ram',
  rede: 'network',
  armazenamento: 'storage',
  energia: 'power',
  inicializacao: 'startup',
  jogos: 'gaming',
  limpeza: 'cleaning',
  seguranca: 'security'
};

const RISK_LABELS = {
  low: 'Baixo',
  medium: 'Médio',
  high: 'Alto'
};

function script(rel) { return { type: 'script', file: rel }; }
function ps(text) { return { type: 'ps', script: text }; }
// Undo via backup de registro capturado antes da aplicação.
function undoBackup() { return { type: 'backup' }; }

const SERVICES_TRIMMED = ['wisvc', 'DPS', 'TermService', 'WbioSrvc', 'TabletInputService', 'wuauserv', 'DiagTrack', 'W32Time', 'WaaSMedicSvc', 'RetailDemo', 'bthserv', 'DoSvc', 'Spooler', 'RemoteRegistry', 'SessionEnv', 'PcaSvc', 'Fax'];
const servicesUndoPs =
  SERVICES_TRIMMED.map((s) => `sc config "${s}" start= demand 2>$null; sc config "${s}" start= auto 2>$null`).join('\n') +
  `\nStart-Service Spooler,wuauserv,DPS -ErrorAction SilentlyContinue`;

const IFEO_EXES = ['FortniteClient-Win64-Shipping.exe', 'GTA5.exe', 'FiveM_b2372_GTAProcess.exe', 'cs2.exe', 'Rdr2.exe', 'PlayRDR2.exe', 'Valorant.exe', 'Minecraft.exe', 'RobloxPlayerBeta.exe', 'Cod.exe', 'BlackOpsColdWar.exe'];

const ITEMS = [
  // ==================== WINDOWS / PRIVACIDADE / PERFORMANCE ====================
  {
    id: 'win.telemetry.off',
    name: 'Desativar telemetria do Windows',
    category: 'windows',
    description: 'Reduz a coleta de dados de diagnóstico enviada à Microsoft (políticas de telemetria e serviço DiagTrack).',
    benefit: 'Menos processos em segundo plano e mais privacidade.',
    risk: 'low',
    requiresAdmin: true,
    confirm: false,
    profiles: ['safe', 'balanced', 'performance', 'gaming', 'work', 'laptop'],
    proOnly: true,
    apply: script('windows/performance/Desativar Windows Telemetria (Coleta de dados).bat'),
    undo: ps(`Remove-ItemProperty -Path 'HKLM:\\SOFTWARE\\Policies\\Microsoft\\Windows\\DataCollection' -Name AllowTelemetry -ErrorAction SilentlyContinue; Set-Service DiagTrack -StartupType Automatic -ErrorAction SilentlyContinue; Start-Service DiagTrack -ErrorAction SilentlyContinue`),
    registryKeys: ['HKLM\\SOFTWARE\\Policies\\Microsoft\\Windows\\DataCollection']
  },
  {
    id: 'win.activity.history.off',
    name: 'Desativar histórico de atividade',
    category: 'windows',
    description: 'Impede o Windows de registrar e sincronizar o histórico de atividades do usuário.',
    benefit: 'Mais privacidade e menos escrita em disco.',
    risk: 'low',
    requiresAdmin: true,
    confirm: false,
    profiles: ['safe', 'balanced', 'performance', 'gaming', 'work'],
    proOnly: true,
    apply: script('windows/performance/Desativar histórico de atividade.bat'),
    undo: ps(`Set-ItemProperty -Path 'HKLM:\\SOFTWARE\\Policies\\Microsoft\\Windows\\System' -Name PublishUserActivities -Value 1; Set-ItemProperty -Path 'HKLM:\\SOFTWARE\\Policies\\Microsoft\\Windows\\System' -Name UploadUserActivities -Value 1`),
    registryKeys: ['HKLM\\SOFTWARE\\Policies\\Microsoft\\Windows\\System']
  },
  {
    id: 'win.animations.off',
    name: 'Desativar animações do sistema',
    category: 'energia',
    description: 'Remove as animações de janelas e menus do Windows.',
    benefit: 'Interface mais direta e leve, útil em PCs modestos. GRATUITO.',
    risk: 'low',
    requiresAdmin: false,
    confirm: false,
    profiles: ['balanced', 'performance', 'gaming'],
    proOnly: false,
    apply: script('windows/performance/Desativar Animações no Sistema.bat'),
    undo: ps(`Set-ItemProperty -Path 'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\VisualEffects' -Name VisualFXSetting -Value 0`),
    registryKeys: ['HKCU\\Control Panel\\Desktop\\WindowMetrics']
  },
  {
    id: 'win.auto.updates.off',
    name: 'Desativar atualizações automáticas',
    category: 'windows',
    description: 'Desativa o serviço do Windows Update para impedir atualizações e reinícios automáticos.',
    benefit: 'Controle total sobre quando atualizar. ATENÇÃO: seu PC fica sem correções de segurança até reativar.',
    risk: 'high',
    requiresAdmin: true,
    confirm: true,
    profiles: [],
    proOnly: true,
    apply: script('windows/performance/Desativar atualizações automaticas.bat'),
    undo: ps(`Set-Service wuauserv -StartupType Manual -ErrorAction SilentlyContinue; Set-Service UsoSvc -StartupType Automatic -ErrorAction SilentlyContinue; Set-Service WaaSMedicSvc -StartupType Manual -ErrorAction SilentlyContinue; Set-Service DoSvc -StartupType Automatic -ErrorAction SilentlyContinue; Start-Service wuauserv -ErrorAction SilentlyContinue`)
  },
  {
    id: 'win.bing.search.off',
    name: 'Desativar pesquisa web no menu Iniciar',
    category: 'windows',
    description: 'Remove os resultados da web (Bing) da pesquisa do menu Iniciar.',
    benefit: 'Pesquisa local instantânea, sem latência de rede.',
    risk: 'low',
    requiresAdmin: false,
    confirm: false,
    profiles: ['safe', 'balanced', 'performance', 'gaming', 'work'],
    proOnly: true,
    apply: script('windows/performance/Desativar Bing Search.bat'),
    undo: ps(`Remove-ItemProperty -Path 'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Search' -Name BingSearchEnabled -ErrorAction SilentlyContinue`),
    registryKeys: ['HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Search']
  },
  {
    id: 'win.cortana.off',
    name: 'Desativar Cortana',
    category: 'windows',
    description: 'Desativa o assistente Cortana e seus processos em segundo plano.',
    benefit: 'Libera memória e CPU em máquinas com poucos recursos.',
    risk: 'low',
    requiresAdmin: true,
    confirm: false,
    profiles: ['balanced', 'performance', 'gaming'],
    proOnly: true,
    apply: script('windows/performance/Desativar Cortana.bat'),
    undo: ps(`Remove-ItemProperty -Path 'HKLM:\\SOFTWARE\\Policies\\Microsoft\\Windows\\Windows Search' -Name AllowCortana -ErrorAction SilentlyContinue`),
    registryKeys: ['HKLM\\SOFTWARE\\Policies\\Microsoft\\Windows\\Windows Search']
  },
  {
    id: 'win.visual.effects.off',
    name: 'Ajustar efeitos visuais para desempenho',
    category: 'energia',
    description: 'Define os efeitos visuais do Windows para o modo "melhor desempenho".',
    benefit: 'Mais fluidez em PCs integrados ou modestos; aparência mais simples.',
    risk: 'medium',
    requiresAdmin: false,
    confirm: true,
    profiles: [],
    proOnly: true,
    apply: script('windows/performance/Desativar efeitos visuais.bat'),
    undo: ps(`Set-ItemProperty -Path 'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\VisualEffects' -Name VisualFXSetting -Value 0`),
    registryKeys: ['HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\VisualEffects']
  },
  {
    id: 'win.hibernation.off',
    name: 'Desativar hibernação',
    category: 'energia',
    description: 'Desliga a hibernação e remove o arquivo hiberfil.sys do disco.',
    benefit: `Libera espaço equivalente a parte da RAM instalada. Em desktops não há perda prática.`,
    risk: 'medium',
    requiresAdmin: true,
    confirm: true,
    profiles: ['performance', 'gaming'],
    proOnly: true,
    apply: script('windows/performance/Desativar Hibernação.bat'),
    undo: ps('powercfg /h on')
  },
  {
    id: 'win.indexing.off',
    name: 'Desativar indexação de arquivos',
    category: 'armazenamento',
    description: 'Desativa o serviço de pesquisa/indexação do Windows (WSearch).',
    benefit: 'Menos leitura/escrita constante em SSDs e mais recursos livres. A busca de arquivos fica mais lenta.',
    risk: 'medium',
    requiresAdmin: true,
    confirm: true,
    profiles: [],
    proOnly: true,
    apply: script('windows/performance/Desativar indexação.bat'),
    undo: ps(`Set-Service WSearch -StartupType delayed-auto -ErrorAction SilentlyContinue; Start-Service WSearch -ErrorAction SilentlyContinue`)
  },
  {
    id: 'win.w32time.off',
    name: 'Desativar serviço de horário do Windows',
    category: 'windows',
    description: 'Desativa a sincronização automática de relógio (W32Time).',
    benefit: 'Um processo a menos. O relógio pode desajustar com o tempo.',
    risk: 'medium',
    requiresAdmin: true,
    confirm: false,
    profiles: [],
    proOnly: true,
    apply: script('windows/performance/Desativar Serviço de Relógio do Windows.bat'),
    undo: ps('Set-Service W32Time -StartupType Manual; Start-Service W32Time -ErrorAction SilentlyContinue; w32tm /resync')
  },
  {
    id: 'win.services.trim',
    name: 'Desativar serviços desnecessários',
    category: 'windows',
    description: 'Desativa uma lista de serviços considerados dispensáveis (diagnóstico, fax, impressão, Bluetooth, Windows Update etc.).',
    benefit: 'Menos processos e memória usada. ATENÇÃO: desativa impressão, Bluetooth e Windows Update até ser revertido.',
    risk: 'high',
    requiresAdmin: true,
    confirm: true,
    profiles: [],
    proOnly: true,
    apply: script('windows/performance/Desativar seviços.bat'),
    undo: ps(servicesUndoPs),
    registryKeys: SERVICES_TRIMMED.map((s) => `HKLM\\SYSTEM\\CurrentControlSet\\Services\\${s}`)
  },
  {
    id: 'win.search.suggestions.off',
    name: 'Desativar sugestões de pesquisa',
    category: 'windows',
    description: 'Remove sugestões e destaques da pesquisa do Windows.',
    benefit: 'Menu Iniciar mais limpo e responsivo.',
    risk: 'low',
    requiresAdmin: false,
    confirm: false,
    profiles: ['safe', 'balanced', 'performance', 'gaming', 'work'],
    proOnly: true,
    apply: script('windows/performance/Desativar Sugestões de Pesquisa.bat'),
    undo: ps(`Remove-ItemProperty -Path 'HKCU:\\SOFTWARE\\Policies\\Microsoft\\Windows\\Explorer' -Name DisableSearchBoxSuggestions -ErrorAction SilentlyContinue`),
    registryKeys: ['HKCU\\SOFTWARE\\Policies\\Microsoft\\Windows\\Explorer']
  },
  {
    id: 'win.transparency.off',
    name: 'Desativar transparência do Windows',
    category: 'energia',
    description: 'Desativa efeitos de transparência/acrylic das janelas.',
    benefit: 'Leve ganho de fluidez e bateria. GRATUITO.',
    risk: 'low',
    requiresAdmin: false,
    confirm: false,
    profiles: ['balanced', 'performance', 'gaming', 'laptop'],
    proOnly: false,
    apply: script('windows/performance/Desativar Transparência do Windows.bat'),
    undo: ps(`Set-ItemProperty -Path 'HKCU:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Themes\\Personalize' -Name EnableTransparency -Value 1`),
    registryKeys: ['HKCU\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Themes\\Personalize']
  },
  {
    id: 'win.vbs.off',
    name: 'Desativar VBS / Isolamento do núcleo',
    category: 'seguranca',
    description: 'Desativa a Segurança Baseada em Virtualização (VBS/HVCI) e o hipervisor.',
    benefit: 'Pode aumentar FPS em jogos (5–10% em alguns casos). REDUZ a segurança contra exploits de kernel.',
    risk: 'high',
    requiresAdmin: true,
    confirm: true,
    profiles: [],
    proOnly: true,
    rebootRequired: true,
    apply: script('windows/performance/Desativar VBS (Isolamento de núcleo).bat'),
    undo: ps(`Set-ItemProperty -Path 'HKLM:\\SYSTEM\\CurrentControlSet\\Control\\DeviceGuard' -Name EnableVirtualizationBasedSecurity -Value 1; New-Item -Path 'HKLM:\\SYSTEM\\CurrentControlSet\\Control\\DeviceGuard\\Scenarios\\HypervisorEnforcedCodeIntegrity' -Force | Out-Null; Set-ItemProperty -Path 'HKLM:\\SYSTEM\\CurrentControlSet\\Control\\DeviceGuard\\Scenarios\\HypervisorEnforcedCodeIntegrity' -Name Enabled -Value 1; bcdedit /set hypervisorlaunchtype auto`),
    registryKeys: ['HKLM\\SYSTEM\\CurrentControlSet\\Control\\DeviceGuard']
  },
  {
    id: 'power.tweaks.reg',
    name: 'Ajustes avançados de energia',
    category: 'energia',
    description: 'Aplica ajustes finos nos planos de energia (latência USB, comportamento do processador).',
    benefit: 'Resposta mais consistente do sistema sob carga.',
    risk: 'medium',
    requiresAdmin: true,
    confirm: false,
    profiles: ['performance', 'gaming'],
    proOnly: true,
    apply: script('windows/performance/Ajustes de energia.reg'),
    undo: undoBackup(),
    registryKeys: ['HKLM\\SYSTEM\\CurrentControlSet\\Control\\Power\\PowerSettings']
  },
  {
    id: 'fs.lastaccess.off',
    name: 'Otimizar acesso ao sistema de arquivos',
    category: 'armazenamento',
    description: 'Desativa o registro de "último acesso" em arquivos NTFS.',
    benefit: 'Menos escrita em disco ao navegar por pastas com muitos arquivos.',
    risk: 'low',
    requiresAdmin: true,
    confirm: false,
    profiles: ['balanced', 'performance', 'gaming'],
    proOnly: true,
    apply: script('windows/performance/Aumentar velocidade ao abrir pastas e arquivos.reg'),
    undo: undoBackup(),
    registryKeys: ['HKLM\\SYSTEM\\CurrentControlSet\\Control\\FileSystem']
  },
  {
    id: 'win.prefetch.superfetch.off',
    name: 'Desabilitar Prefetch e Superfetch',
    category: 'ram',
    description: 'Desativa os mecanismos de pré-carregamento do Windows.',
    benefit: 'Em SSDs pode reduzir escrita em disco. Em HDs mecânicos pode PIORAR abertura de programas.',
    risk: 'medium',
    requiresAdmin: true,
    confirm: true,
    profiles: [],
    proOnly: true,
    apply: script('windows/performance/Desabilitar Prefetch e Superfetch.reg'),
    undo: undoBackup(),
    registryKeys: ['HKLM\\SYSTEM\\CurrentControlSet\\Control\\Session Manager\\Memory Management\\PrefetchParameters']
  },
  {
    id: 'win.smartscreen.off',
    name: 'Desabilitar SmartScreen',
    category: 'seguranca',
    description: 'Desativa o filtro SmartScreen do Explorer.',
    benefit: 'Elimina atrasos ao abrir executáveis baixados. REDUZ proteção contra malware.',
    risk: 'high',
    requiresAdmin: true,
    confirm: true,
    profiles: [],
    proOnly: true,
    apply: script('windows/performance/Desabilitar SmartSceen e Downloads Blocks.reg'),
    undo: ps(`Set-ItemProperty -Path 'HKLM:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Explorer' -Name SmartScreenEnabled -Value 'RequireAdmin'`),
    registryKeys: ['HKLM\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Explorer']
  },
  {
    id: 'games.dvr.off',
    name: 'Desativar Game DVR / gravação em plano de fundo',
    category: 'jogos',
    description: 'Desativa a gravação automática de clipes do Xbox Game Bar.',
    benefit: 'Ganho direto de FPS em muitos jogos. GRATUITO.',
    risk: 'low',
    requiresAdmin: false,
    confirm: false,
    profiles: ['performance', 'gaming'],
    proOnly: false,
    apply: script('windows/performance/Desativar Game DVR.reg'),
    undo: undoBackup(),
    registryKeys: ['HKCU\\System\\GameConfigStore', 'HKCU\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\GameDVR']
  },
  {
    id: 'games.xbox.services.off',
    name: 'Desativar serviços do Xbox',
    category: 'jogos',
    description: 'Desativa serviços de save na nuvem e rede social do Xbox.',
    benefit: 'Menos serviços residentes. ATENÇÃO: quebra saves na nuvem/Game Pass até reverter.',
    risk: 'medium',
    requiresAdmin: true,
    confirm: true,
    profiles: [],
    proOnly: true,
    apply: script('windows/performance/Desativar Serviços Xbox.reg'),
    undo: undoBackup(),
    registryKeys: ['HKLM\\SYSTEM\\CurrentControlSet\\Services\\XblGameSave', 'HKLM\\SYSTEM\\CurrentControlSet\\Services\\XboxNetApiSvc', 'HKLM\\SYSTEM\\CurrentControlSet\\Services\\XboxGipSvc', 'HKLM\\SYSTEM\\CurrentControlSet\\Services\\XblAuthManager']
  },
  {
    id: 'fs.oplocks.on',
    name: 'Otimização de compartilhamento de arquivos',
    category: 'rede',
    description: 'Habilita oplocks do servidor SMB para operações de arquivo mais ágeis.',
    benefit: 'Melhor throughput em acessos locais e de rede.',
    risk: 'low',
    requiresAdmin: true,
    confirm: false,
    profiles: ['balanced', 'performance', 'gaming'],
    proOnly: true,
    apply: script('windows/performance/Habilitar a otimização do sistema de arquivos.reg'),
    undo: undoBackup(),
    registryKeys: ['HKLM\\SYSTEM\\CurrentControlSet\\Services\\LanmanServer\\Parameters']
  },

  // ==================== NATIVAS (PowerShell inline) ====================
  {
    id: 'power.highperformance',
    name: 'Plano de energia: Alto desempenho',
    category: 'energia',
    description: 'Ativa o plano de energia de alto desempenho do Windows.',
    benefit: 'CPU responde sem escalonamento agressivo. Consome mais energia. GRATUITO.',
    risk: 'low',
    requiresAdmin: true,
    confirm: false,
    profiles: ['performance', 'gaming'],
    proOnly: false,
    apply: ps('powercfg /setactive 8c5e7fda-e8bf-4a96-9a85-a6e23a8c635c 2>$null; if ($LASTEXITCODE -ne 0) { $dup = powercfg /duplicatescheme 8c5e7fda-e8bf-4a96-9a85-a6e23a8c635c 2>$null; if ($dup -match ([regex]\'([0-9a-f\-]{36})\')) { powercfg /setactive $Matches[1] } }'),
    undo: null,
    statusProbe: 'powercfg /getactivescheme'
  },
  {
    id: 'net.dns.flush',
    name: 'Limpar cache DNS',
    category: 'rede',
    description: 'Limpa o cache de resolução de DNS do Windows.',
    benefit: 'Resolve erros de conexão/site antigo em cache. GRATUITO.',
    risk: 'low',
    requiresAdmin: false,
    confirm: false,
    profiles: [],
    proOnly: false,
    apply: ps('Clear-DnsClientCache; ipconfig /flushdns | Out-Null'),
    undo: null
  },
  {
    id: 'net.tcp.optimize',
    name: 'Otimizações TCP para jogos',
    category: 'rede',
    description: 'Ajusta TcpAckFrequency/TCPNoDelay nas interfaces ativas (menor latência em alguns cenários).',
    benefit: 'Pode reduzir ligeiramente a latência online.',
    risk: 'medium',
    requiresAdmin: true,
    confirm: true,
    profiles: ['gaming'],
    proOnly: true,
    apply: ps(`$ifs = Get-NetAdapter | Where-Object Status -eq 'Up'; foreach ($if in $ifs) { $k = "HKLM:\\SYSTEM\\CurrentControlSet\\Services\\Tcpip\\Parameters\\Interfaces\\$($if.InterfaceGuid)"; if (-not (Test-Path $k)) { New-Item -Path $k -Force | Out-Null }; Set-ItemProperty -Path $k -Name TcpAckFrequency -Value 1 -Type DWord; Set-ItemProperty -Path $k -Name TCPNoDelay -Value 1 -Type DWord }`),
    undo: ps(`$ifs = Get-NetAdapter | Where-Object Status -eq 'Up'; foreach ($if in $ifs) { $k = "HKLM:\\SYSTEM\\CurrentControlSet\\Services\\Tcpip\\Parameters\\Interfaces\\$($if.InterfaceGuid)"; Remove-ItemProperty -Path $k -Name TcpAckFrequency -ErrorAction SilentlyContinue; Remove-ItemProperty -Path $k -Name TCPNoDelay -ErrorAction SilentlyContinue }`),
    registryKeys: []
  },
  {
    id: 'net.winsock.reset',
    name: 'Redefinir Winsock e pilha TCP/IP',
    category: 'rede',
    description: 'Restaura a pilha de rede do Windows ao padrão (netsh winsock reset + int ip reset).',
    benefit: 'Corrige problemas persistentes de rede. Exige reiniciar o PC.',
    risk: 'high',
    requiresAdmin: true,
    confirm: true,
    profiles: [],
    proOnly: true,
    rebootRequired: true,
    apply: ps('netsh winsock reset; netsh int ip reset; ipconfig /flushdns'),
    undo: null
  },
  {
    id: 'ram.workingset.trim',
    name: 'Reduzir conjuntos de trabalho (RAM)',
    category: 'ram',
    description: 'Trima os working sets dos processos do usuário, devolvendo páginas à lista disponível.',
    benefit: 'Aumenta a RAM disponível imediatamente após uso intenso. Efeito temporário.',
    risk: 'low',
    requiresAdmin: true,
    confirm: false,
    profiles: [],
    proOnly: true,
    apply: ps(`Add-Type -Name K32 -Namespace Win32 -MemberDefinition '[DllImport("psapi.dll")] public static extern bool EmptyWorkingSet(IntPtr hProcess);'; Get-Process | Where-Object { $_.MainWindowHandle -eq 0 -and $_.Id -ne $PID } | ForEach-Object { try { [Win32.K32]::EmptyWorkingSet($_.Handle) } catch {} } | Out-Null`),
    undo: null
  },
  {
    id: 'storage.optimize.drives',
    name: 'Otimizar unidades (TRIM/Desfragmentar)',
    category: 'armazenamento',
    description: 'Executa a otimização nativa do Windows em todas as unidades (ReTrim em SSD, desfragmentação em HDD).',
    benefit: 'Mantém a velocidade de leitura/gravação das unidades.',
    risk: 'low',
    requiresAdmin: true,
    confirm: false,
    profiles: ['balanced', 'performance', 'gaming', 'work'],
    proOnly: true,
    apply: ps('Get-Volume | Where-Object DriveLetter | ForEach-Object { Optimize-Volume -DriveLetter $_.DriveLetter -Verbose -ErrorAction SilentlyContinue } | Out-Null'),
    undo: null
  },

  // ==================== GAME BOOST GENÉRICO ====================
  {
    id: 'games.task.priority',
    name: 'Priorizar tarefas de jogos no sistema',
    category: 'jogos',
    description: 'Eleva a prioridade de agendamento (CPU/GPU) da classe de tarefas "Games" do Windows.',
    benefit: 'Jogos recebem mais atenção do escalonador.',
    risk: 'low',
    requiresAdmin: true,
    confirm: false,
    profiles: ['performance', 'gaming'],
    proOnly: true,
    apply: script('gaming/priority/Forçar o windows a priorizar tarefas de jogos.reg'),
    undo: undoBackup(),
    registryKeys: ['HKLM\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion\\Multimedia\\SystemProfile\\Tasks\\Games']
  },
  {
    id: 'games.ifeo.priority',
    name: 'Prioridade alta para executáveis de jogos',
    category: 'jogos',
    description: 'Configura prioridade de CPU alta (IFEO PerfOptions) para os principais executáveis de jogos conhecidos.',
    benefit: 'O jogo roda com prioridade alta automaticamente ao abrir.',
    risk: 'low',
    requiresAdmin: true,
    confirm: false,
    profiles: ['gaming'],
    proOnly: true,
    apply: script('gaming/priority/Aumentar Prioridade de jogos no Sistema.bat'),
    undo: ps(IFEO_EXES.map((e) => `Remove-Item -LiteralPath 'HKLM:\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion\\Image File Execution Options\\${e}\\PerfOptions' -Recurse -Force -ErrorAction SilentlyContinue`).join('\n'))
  },

  // ==================== DEBLOAT ====================
  ...[
    ['debloat.ads.off', 'Desativar anúncios e sugestões', 'Desativar Anúncios e sugestões', 'Remove anúncios e sugestões de apps do Windows.', 'low'],
    ['debloat.copilot.off', 'Remover Copilot', 'Desativar Copilot', 'Desativa e remove o Copilot do sistema.', 'low'],
    ['debloat.linkedin', 'Remover LinkedIn', 'Linkedin', 'Remove o app LinkedIn pré-instalado.', 'low'],
    ['debloat.store', 'Remover Loja do Windows', 'Loja do Windows', 'Remove a Microsoft Store.', 'medium'],
    ['debloat.phone.link', 'Remover Vincular celular', 'Vincular celular', 'Remove o app Vincular (Phone Link).', 'low'],
    ['debloat.whatsapp', 'Remover WhatsApp', 'Whatsapp', 'Remove o app WhatsApp pré-instalado.', 'low'],
    ['debloat.3dbuilder', 'Remover 3D Builder', 'Windows 3Dbuilder', 'Remove o 3D Builder.', 'low'],
    ['debloat.alarms', 'Remover Alarmes e Relógio', 'Windows Alarms', 'Remove Alarmes e Relógio.', 'low'],
    ['debloat.calculator', 'Remover Calculadora', 'Windows Calculadora', 'Remove a Calculadora do Windows.', 'medium'],
    ['debloat.calendar', 'Remover Calendário e Correio', 'Windows Calendario', 'Remove os apps Calendar/Mail.', 'low'],
    ['debloat.camera', 'Remover Câmera', 'Windows Camera', 'Remove o app Câmera.', 'medium'],
    ['debloat.getstarted', 'Remover Dicas (Get Started)', 'Windows Getstarted', 'Remove o app Dicas.', 'low'],
    ['debloat.groove', 'Remover Groove Música', 'Windows Groove Música', 'Remove o Groove Música.', 'low'],
    ['debloat.maps', 'Remover Mapas', 'Windows maps', 'Remove o app Mapas.', 'low'],
    ['debloat.messaging', 'Remover Messaging', 'Windows Messaging', 'Remove o app Messaging.', 'low'],
    ['debloat.music', 'Remover Música (Media)', 'Windows Music', 'Remove apps de música/filmes pré-instalados.', 'low'],
    ['debloat.news', 'Remover Notícias', 'Windows News', 'Remove o app Notícias.', 'low'],
    ['debloat.officehub', 'Remover Office Hub', 'Windows Officehub', 'Remove o hub do Office (MyOffice).', 'low'],
    ['debloat.onedrive', 'Remover OneDrive', 'Windows OneDrive', 'Remove o cliente OneDrive integrado.', 'high'],
    ['debloat.people', 'Remover People', 'Windows People', 'Remove o app Pessoas.', 'low'],
    ['debloat.photos', 'Remover Fotos', 'Windows Photos', 'Remove o app Fotos do Windows.', 'medium'],
    ['debloat.xbox.app', 'Remover app Xbox', 'Windows Xbox', 'Remove o aplicativo Xbox (não afeta os serviços tratados separadamente).', 'medium']
  ].map(([id, name, fileBase, description, risk]) => ({
    id,
    name,
    category: 'limpeza',
    description,
    benefit: 'Sistema mais limpo e com menos processos. Pode ser revertido em Restauração > Restaurar apps removidos.',
    risk,
    requiresAdmin: true,
    confirm: risk !== 'low',
    profiles: [],
    proOnly: true,
    apply: script(`windows/debloat/${fileBase}.bat`),
    undo: script('windows/debloat/REVERTA OS DEBLOATERS.bat'),
    undoNote: 'Restaura TODOS os apps removidos pelo debloat.'
  })),
  {
    id: 'debloat.reinstall.all',
    name: 'Restaurar apps removidos',
    category: 'limpeza',
    description: 'Reinstala todos os aplicativos removidos pelo debloat.',
    benefit: 'Volta ao estado padrão dos apps do Windows.',
    risk: 'low',
    requiresAdmin: true,
    confirm: false,
    profiles: [],
    proOnly: true,
    apply: script('windows/debloat/REVERTA OS DEBLOATERS.bat'),
    undo: null
  },
  {
    id: 'debloat.full',
    name: 'Debloat completo',
    category: 'limpeza',
    description: 'Executa o debloater avançado (remove pacotes, telemetria e serviços em lote).',
    benefit: 'Redução significativa de processos. Reversível pelos itens individuais.',
    risk: 'high',
    requiresAdmin: true,
    confirm: true,
    profiles: [],
    proOnly: true,
    apply: script('windows/debloat/iGust Debloater.bat'),
    undo: script('windows/debloat/REVERTA OS DEBLOATERS.bat'),
    undoNote: 'O revert restaura os apps; serviços podem exigir ponto de restauração.'
  },

  // ==================== PERFIS POR JOGO ====================
  ...[
    ['games.fivem', 'FiveM', 'Otimizar FIVE M.bat', 'cs2.exe|FiveM'],
    ['games.gtav', 'GTA V', 'Otimizar GTA V.bat', 'GTA5.exe'],
    ['games.valorant', 'Valorant', 'Otimizar Valorant.bat', 'VALORANT'],
    ['games.cs2', 'Counter-Strike 2', 'Otimizar CS2.bat', 'cs2.exe'],
    ['games.fortnite', 'Fortnite', 'Otimizar Fortnite.bat', 'FortniteClient'],
    ['games.warzone', 'Warzone', 'Otimizar WARZONE.bat', 'Call of Duty'],
    ['games.cod', 'Call of Duty (Black Ops)', 'Otimizar CALL OF DUTY BLACK OPS (TODOS).bat', 'BlackOps'],
    ['games.minecraft', 'Minecraft', 'Otimizar Minecraft.bat', 'Minecraft'],
    ['games.roblox', 'Roblox', 'Otimizar ROBLOX.bat', 'Roblox'],
    ['games.rdr2', 'Red Dead Redemption 2', 'Otimizar RED DEAD REDEMPTION 2.bat', 'RDR2|Rdr2'],
    ['games.battlefield', 'Battlefield', 'Otimizar BATTLEFIELD (TODOS).bat', 'Battlefield']
  ].map(([id, game, file]) => ({
    id,
    name: `Perfil completo: ${game}`,
    category: 'jogos',
    description: `Aplica o conjunto de otimizações para ${game}: prioridade do processo, Game DVR desativado, serviços dispensáveis desligados e ajustes de energia.`,
    benefit: 'Mais FPS estável e menos stutter durante o jogo.',
    risk: 'high',
    requiresAdmin: true,
    confirm: true,
    profiles: [],
    proOnly: true,
    apply: script(`gaming/games/${file}`),
    undo: ps(servicesUndoPs),
    registryKeys: ['HKCU\\System\\GameConfigStore']
  })),

  // ==================== GPU / DRIVERS ====================
  {
    id: 'gpu.nvidia.telemetry.off',
    name: 'NVIDIA: desativar telemetria',
    category: 'gpu',
    description: 'Desativa o serviço de telemetria do driver NVIDIA.',
    benefit: 'Menos processos em segundo plano da NVIDIA.',
    risk: 'low',
    requiresAdmin: true,
    confirm: false,
    profiles: ['performance', 'gaming'],
    proOnly: true,
    vendor: 'nvidia',
    apply: script('gpu/nvidia/Desativar Telemetria NVIDIA.bat'),
    undo: ps('Set-Service NvTelemetryContainer -StartupType Disabled -ErrorAction SilentlyContinue')
  },
  {
    id: 'gpu.nvidia.hags.off',
    name: 'NVIDIA: desativar agendamento de GPU por hardware',
    category: 'gpu',
    description: 'Desativa o HAGS (Hardware Accelerated GPU Scheduling).',
    benefit: 'Em algumas configurações reduz latência/stutter. Em outras piora — teste antes/depois.',
    risk: 'medium',
    requiresAdmin: true,
    confirm: true,
    profiles: [],
    proOnly: true,
    vendor: 'nvidia',
    rebootRequired: true,
    apply: script('gpu/nvidia/Desativar HGS.reg'),
    undo: undoBackup(),
    registryKeys: ['HKLM\\SYSTEM\\CurrentControlSet\\Control\\GraphicsDrivers']
  },
  {
    id: 'gpu.nvidia.mpo.off',
    name: 'NVIDIA: desativar MPO (Multiplane Overlay)',
    category: 'gpu',
    description: 'Desativa o Multiplane Overlay do compositor do Windows.',
    benefit: 'Corrige flicker/stutter em alguns monitores e jogos.',
    risk: 'medium',
    requiresAdmin: true,
    confirm: true,
    profiles: [],
    proOnly: true,
    vendor: 'nvidia',
    apply: script('gpu/nvidia/Desativar MPO.reg'),
    undo: undoBackup(),
    registryKeys: ['HKLM\\SOFTWARE\\Microsoft\\Windows\\Dwm']
  },
  {
    id: 'gpu.nvidia.shadowplay.off',
    name: 'NVIDIA: desativar ShadowPlay',
    category: 'gpu',
    description: 'Desativa a gravação ShadowPlay da NVIDIA.',
    benefit: 'Libera encoder/captura usada em segundo plano.',
    risk: 'low',
    requiresAdmin: true,
    confirm: false,
    profiles: ['performance', 'gaming'],
    proOnly: true,
    vendor: 'nvidia',
    apply: script('gpu/nvidia/Desativar NVIDIA ShadowPlay.reg'),
    undo: undoBackup(),
    registryKeys: ['HKLM\\SOFTWARE\\NVIDIA Corporation\\Global\\ShadowPlay']
  },
  {
    id: 'gpu.nvidia.shadercache.clean',
    name: 'NVIDIA: limpar cache de shaders',
    category: 'limpeza',
    description: 'Apaga o cache DirectX/OpenGL da NVIDIA.',
    benefit: 'Corrige stutter após atualização de driver. Os shaders são recompilados.',
    risk: 'low',
    requiresAdmin: false,
    confirm: false,
    profiles: [],
    proOnly: true,
    vendor: 'nvidia',
    apply: script('gpu/nvidia/Limpar Shader Cache NVIDIA.bat'),
    undo: null
  },
  {
    id: 'gpu.amd.overlay.telemetry.off',
    name: 'AMD: desativar overlay e telemetria',
    category: 'gpu',
    description: 'Desativa conteúdo web e atualização automática do Software AMD.',
    benefit: 'Menos processos da Radeon Settings.',
    risk: 'low',
    requiresAdmin: true,
    confirm: false,
    profiles: ['performance', 'gaming'],
    proOnly: true,
    vendor: 'amd',
    apply: script('gpu/amd/Desativar AMD Overlay e Telemetria.reg'),
    undo: undoBackup(),
    registryKeys: ['HKLM\\SOFTWARE\\AMD\\CN']
  },
  {
    id: 'gpu.amd.hags.off',
    name: 'AMD: desativar agendamento de GPU por hardware',
    category: 'gpu',
    description: 'Desativa o HAGS para GPUs AMD.',
    benefit: 'Pode estabilizar FPS em certos títulos.',
    risk: 'medium',
    requiresAdmin: true,
    confirm: true,
    profiles: [],
    proOnly: true,
    vendor: 'amd',
    rebootRequired: true,
    apply: script('gpu/amd/Desativar Hardware Accelerated GPU Scheduling.reg'),
    undo: undoBackup(),
    registryKeys: ['HKLM\\SYSTEM\\CurrentControlSet\\Control\\GraphicsDrivers']
  },
  {
    id: 'gpu.amd.mpo.off',
    name: 'AMD: desativar MPO',
    category: 'gpu',
    description: 'Desativa o Multiplane Overlay no Windows.',
    benefit: 'Corrige flicker/travamentos de composição.',
    risk: 'medium',
    requiresAdmin: true,
    confirm: true,
    profiles: [],
    proOnly: true,
    vendor: 'amd',
    apply: script('gpu/amd/Desativar MPO.reg'),
    undo: undoBackup(),
    registryKeys: ['HKLM\\SOFTWARE\\Microsoft\\Windows\\Dwm']
  },
  {
    id: 'gpu.amd.ulps.off',
    name: 'AMD: desativar ULPS',
    category: 'gpu',
    description: 'Desativa o Ultra Low Power State (relevante para CrossFire/multi-GPU).',
    benefit: 'Evita quedas de clock e stutter em setups multi-GPU.',
    risk: 'medium',
    requiresAdmin: true,
    confirm: true,
    profiles: [],
    proOnly: true,
    vendor: 'amd',
    rebootRequired: true,
    apply: script('gpu/amd/Desativar ULPS (Stutter e quedas de clock).reg'),
    undo: undoBackup(),
    registryKeys: ['HKLM\\SYSTEM\\CurrentControlSet\\Services\\amdkmdag']
  },
  {
    id: 'gpu.amd.shadercache.force',
    name: 'AMD: forçar shader cache ativo',
    category: 'gpu',
    description: 'Força o shader cache da AMD sempre ligado.',
    benefit: 'Carregamento mais consistente em jogos.',
    risk: 'low',
    requiresAdmin: true,
    confirm: false,
    profiles: ['gaming'],
    proOnly: true,
    vendor: 'amd',
    apply: script('gpu/amd/Forçar Shader Cache sempre ativo (AMD).reg'),
    undo: undoBackup(),
    registryKeys: ['HKLM\\SYSTEM\\CurrentControlSet\\Services\\amdkmdag']
  },
  {
    id: 'gpu.amd.crashdefender.off',
    name: 'AMD: desativar Crash Defender',
    category: 'gpu',
    description: 'Desativa o serviço AMD Crash Defender.',
    benefit: 'Remove um serviço que pode conflitar com overlays.',
    risk: 'medium',
    requiresAdmin: true,
    confirm: true,
    profiles: [],
    proOnly: true,
    vendor: 'amd',
    apply: script('gpu/amd/Desativar AMD Crash Defender (serviços).bat'),
    undo: null,
    undoNote: 'Reative manualmente em services.msc (AMD Crash Defender Service).'
  },
  {
    id: 'gpu.intel.mpo.off',
    name: 'Intel: desativar MPO',
    category: 'gpu',
    description: 'Desativa o Multiplane Overlay para gráficos Intel.',
    benefit: 'Corrige flicker em notebooks Intel.',
    risk: 'medium',
    requiresAdmin: true,
    confirm: true,
    profiles: [],
    proOnly: true,
    vendor: 'intel',
    apply: script('gpu/intel/Desativar MPO (Multiplane Overlay).bat'),
    undo: undoBackup(),
    registryKeys: ['HKLM\\SOFTWARE\\Microsoft\\Windows\\Dwm']
  },
  {
    id: 'gpu.intel.priority.opt',
    name: 'Intel: otimização de prioridade',
    category: 'cpu',
    description: 'Ajusta Win32PrioritySeparation para favorecer o processo em primeiro plano.',
    benefit: 'Jogos/aplicativo focado recebem mais tempo de CPU.',
    risk: 'medium',
    requiresAdmin: true,
    confirm: false,
    profiles: ['performance', 'gaming'],
    proOnly: true,
    vendor: 'intel',
    apply: script('gpu/intel/Intel Priority Optimization.bat'),
    undo: ps(`Set-ItemProperty -Path 'HKLM:\\SYSTEM\\CurrentControlSet\\Control\\PriorityControl' -Name Win32PrioritySeparation -Value 2 -Type DWord`),
    registryKeys: ['HKLM\\SYSTEM\\CurrentControlSet\\Control\\PriorityControl']
  },
  {
    id: 'gpu.intel.timer.opt',
    name: 'Intel: otimização de timer (bcdedit)',
    category: 'cpu',
    description: 'Configura useplatformtick/disabledynamictick/tscsyncpolicy via bcdedit.',
    benefit: 'Timers mais consistentes em notebooks Intel antigos. Efeito varia por máquina.',
    risk: 'high',
    requiresAdmin: true,
    confirm: true,
    profiles: [],
    proOnly: true,
    vendor: 'intel',
    rebootRequired: true,
    apply: script('gpu/intel/Intel Timer Optimization (bcedit).bat'),
    undo: ps('bcdedit /deletevalue useplatformtick 2>$null; bcdedit /deletevalue disabledynamictick 2>$null; bcdedit /set tscsyncpolicy Default'),
    registryKeys: []
  }
];

// Itens informativos da página Drivers (ações que abrem fontes oficiais).
const DRIVER_DOWNLOAD_ITEMS = [
  { id: 'drivers.nvidia.download', vendor: 'nvidia', file: 'gpu/nvidia/Baixar Driver NVIDIA.bat' },
  { id: 'drivers.amd.download', vendor: 'amd', file: 'gpu/amd/Baixar Driver AMD.bat' },
  { id: 'drivers.intel.download', vendor: 'intel', file: 'gpu/intel/Baixar Driver INTEL.bat' }
];

function getItem(id) {
  return ITEMS.find((i) => i.id === id) || null;
}

// Scripts precisam existir como arquivos reais no disco (cmd.exe/reg.exe não
// leem dentro do app.asar) e alguns criam arquivos ao lado de si (%~dp0).
// scriptsSync espelha a pasta do instalador (resources/engine/scripts) para
// o AppData do usuário e devolve essa base gravável.
//
// IMPORTANTE: SCRIPTS_BASE é resolvido de forma lazy (sob demanda) para
// garantir que app.whenReady() já foi chamado antes de acessar userData.
const scriptsSync = require('./scriptsSync');
let _scriptsBase = null;

function getScriptsBase() {
  if (!_scriptsBase) _scriptsBase = scriptsSync.getScriptsBase();
  return _scriptsBase;
}

function resolveScript(relFile) {
  return path.join(getScriptsBase(), relFile);
}

module.exports = { CATEGORIES, CATEGORY_ICONS, RISK_LABELS, ITEMS, DRIVER_DOWNLOAD_ITEMS, getItem, resolveScript };
