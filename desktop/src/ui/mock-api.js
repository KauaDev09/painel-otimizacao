'use strict';

// ============================================================
// MOCK OrionAPI — dados fictícios para preview no navegador
// ============================================================

const MOCK_HARDWARE = {
  cpu: {
    name: 'AMD Ryzen 7 5800X 8-Core Processor',
    brand: 'AMD',
    cores: 8,
    threads: 16,
    baseClockMhz: 3800,
    currentClockMhz: 4200,
    boostClockMhz: 4700,
    architecture: 'Zen 3',
    socket: 'AM4',
    unlockedLabel: 'Sim'
  },
  motherboard: {
    vendorDisplay: 'ASUSTeK Computer INC.',
    boardProduct: 'ROG STRIX B550-F GAMING',
    chipset: 'B550',
    formFactor: 'ATX',
    isOem: false
  },
  bios: {
    vendor: 'American Megatrends Inc.',
    version: '2423',
    dateISO: '2024-08-15',
    smbiosVersion: '3.3'
  },
  ram: {
    totalGB: 32,
    count: 2,
    slotsTotal: 4,
    ddrType: 'DDR4',
    minConfigMHz: 3200,
    maxRatedMHz: 3600,
    profile: 'active_or_no_profile',
    dualChannelLikely: true,
    manufacturers: ['Corsair'],
    partNumbers: ['CMK16GX4M2B3200C16'],
    modules: [
      { slot: 'DIMM_A1', sizeGB: 16, type: 'DDR4', configMHz: 3200 },
      { slot: 'DIMM_B1', sizeGB: 16, type: 'DDR4', configMHz: 3200 }
    ]
  },
  gpu: [{
    name: 'NVIDIA GeForce RTX 3070',
    vramMB: 8192,
    driver: '31.0.15.3623',
    driverDate: '2024-06-10',
    pcieGenMax: 4,
    linkWidthMax: 'x16',
    isIntegrated: false
  }],
  os: {
    caption: 'Windows 11 Pro',
    displayVersion: '23H2',
    build: '22631.3880',
    arch: 'x64',
    pcType: 'Desktop'
  },
  boot: { mode: 'UEFI' },
  disk: { partitionStyle: 'GPT' },
  secureBoot: 'enabled',
  tpm: { stateLabel: 'Ativado (fTPM 2.0)' },
  virtStatusLabel: 'Ativado (VT-x / AMD-V)'
};

function delay(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function rand(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function pick(arr) {
  return arr[rand(0, arr.length - 1)];
}

const MOCK_RECOMMENDATIONS = [
  {
    id: 'rec-001',
    name: 'Ativar Precision Boost Overdrive (PBO)',
    reason: 'O PBO permite que o processador Boost além dos limites padrão, aumentando o desempenho multithread com segurança térmica controlada.',
    statusText: 'Status: Desativado',
    recommendation: 'Ativar PBO na BIOS',
    effectiveLevel: 'recommended',
    risk: 'low',
    impact: 'medium',
    benefit: 'Aumento de ~5-10% em cargas multithread',
    compatibility: 'Compatível com AMD Ryzen 5000 series',
    paths: ['Advanced > AMD Overclocking > Precision Boost Overdrive'],
    steps: ['Reinicie o PC e entre na BIOS', 'Navegue até AMD Overclocking', 'Ative Precision Boost Overdrive', 'Salve e reinicie'],
    notes: ['Monitor temperaturas após ativar'],
    rebootRequired: true
  },
  {
    id: 'rec-002',
    name: 'AtivarResizable BAR (ReBAR)',
    reason: 'Resizable BAR permite que a CPU acesse toda a VRAM da GPU de uma vez, melhorando desempenho em jogos.',
    statusText: 'Status: Desativado',
    recommendation: 'Ativar Above 4G Decoding e Re-Size BAR Support',
    effectiveLevel: 'critical',
    risk: 'low',
    impact: 'high',
    benefit: 'Ganho de 5-15% em FPS em títulos compatíveis',
    compatibility: 'Requer GPU NVIDIA RTX 30+ ou AMD RX 6000+',
    paths: ['Advanced > PCI Subsystem Settings > Above 4G Decoding', 'Advanced > PCI Subsystem Settings > Re-Size BAR Support'],
    steps: ['Ative Above 4G Decoding', 'Ative Re-Size BAR Support', 'Salve e reinicie'],
    notes: [],
    rebootRequired: true
  },
  {
    id: 'rec-003',
    name: 'Habilitar XMP/EXPO Profile',
    reason: 'A memória está operando abaixo da velocidade anunciada. Ativar o perfil XMP/EXPO faz a RAM rodar na frequência correta.',
    statusText: 'Status: 3200 MHz (módulos de 3600 MHz)',
    recommendation: 'Ativar perfil XMP II na BIOS',
    effectiveLevel: 'recommended',
    risk: 'low',
    impact: 'medium',
    benefit: 'Melhor desempenho em aplicações sensíveis à memória',
    compatibility: 'Depende da placa-mãe e da memória',
    paths: ['Ai Tweaker > AI Overclock Tuner > XMP II'],
    steps: ['Entre na BIOS', 'Navegue até Ai Tweaker', 'Selecione XMP II', 'Salve e reinicie'],
    notes: ['Se instabilizar, tente XMP I ou diminua a frequência'],
    rebootRequired: true
  },
  {
    id: 'rec-004',
    name: 'Ativar SVM Mode (Virtualização AMD)',
    reason: 'A virtualização está desativada, impedindo o uso de VMs, WSL2 e containeres Docker.',
    statusText: 'Status: Desativado',
    recommendation: 'Ativar SVM Mode na BIOS',
    effectiveLevel: 'critical',
    risk: 'low',
    impact: 'high',
    benefit: 'Permite WSL2, Docker e máquinas virtuais',
    compatibility: 'AMD Ryzen — SVM Mode',
    paths: ['Advanced > CPU Configuration > SVM Mode'],
    steps: ['Entre na BIOS', 'Navegue até CPU Configuration', 'Ative SVM Mode', 'Salve e reinicie'],
    notes: [],
    rebootRequired: true
  },
  {
    id: 'rec-005',
    name: 'Desativar Erros CEP (DRAM Training)',
    reason: 'Foram detectados erros de treinamento DRAM, possivelmente causados por overclock instável.',
    statusText: 'Status: Erros detectados nos logs',
    recommendation: 'Resetar BIOS para defaults e reativar XMP',
    effectiveLevel: 'optional',
    risk: 'medium',
    impact: 'low',
    benefit: 'Maior estabilidade do sistema',
    compatibility: 'Geral',
    paths: ['Exit > Load Optimized Defaults', 'Ai Tweaker > XMP II'],
    steps: ['Carregue defaults', 'Reative XMP', 'Teste estabilidade com memtest'],
    notes: ['Faça backup das configurações atuais'],
    rebootRequired: true
  },
  {
    id: 'rec-006',
    name: 'Configurar Cooling Policy para Performance',
    reason: 'A política de resfriamento está em modo silencioso, limitando o boost do processador.',
    statusText: 'Status: Silencioso',
    recommendation: 'Alterar para modo Performance',
    effectiveLevel: 'informational',
    risk: 'low',
    impact: 'low',
    benefit: 'Manter boost por mais tempo sob carga',
    compatibility: 'Geral',
    paths: ['Monitor > CPU Fan Profile > Performance'],
    steps: ['Entre na BIOS', 'Vá em Monitor', 'Altere o perfil do cooler'],
    notes: ['Pode aumentar ruído do cooler'],
    rebootRequired: false
  },
  {
    id: 'rec-007',
    name: 'Ativar Fast Boot',
    reason: 'O Fast Boot desconsidera dispositivos desnecessários na inicialização, reduzindo o tempo de boot.',
    statusText: 'Status: Desativado',
    recommendation: 'Ativar Fast Boot na BIOS',
    effectiveLevel: 'optional',
    risk: 'low',
    impact: 'low',
    benefit: 'Redução de ~5-10s no tempo de boot',
    compatibility: 'Geral',
    paths: ['Boot > Fast Boot > Enabled'],
    steps: ['Entre na BIOS', 'Vá em Boot', 'Ative Fast Boot'],
    notes: [],
    rebootRequired: true
  }
];

const MOCK_ITEMS = [
  { id: 'win-001', name: 'Desativar telemetria do Windows', description: 'Reduz a coleta de dados enviados à Microsoft.', benefit: 'Melhora privacidade e reduz uso de rede', category: 'windows', risk: 'low', profiles: ['performance', 'gaming'], proOnly: false, rebootRequired: false, requiresAdmin: true, confirm: false, riskLabel: 'RISCO BAIXO' },
  { id: 'win-002', name: 'Desativar efeitos visuais', description: 'Remove animações e transições do Windows.', benefit: 'Libera recursos da GPU e reduz input lag', category: 'windows', risk: 'low', profiles: ['performance', 'gaming'], proOnly: false, rebootRequired: false, requiresAdmin: false, confirm: false, riskLabel: 'RISCO BAIXO' },
  { id: 'win-003', name: 'Otimizar agenda de tarefas', description: 'Desativa tarefas agendadas desnecessárias.', benefit: 'Reduz uso de CPU em segundo plano', category: 'windows', risk: 'low', profiles: ['balanced', 'performance'], proOnly: false, rebootRequired: false, requiresAdmin: true, confirm: false, riskLabel: 'RISCO BAIXO' },
  { id: 'gaming-001', name: 'Ativar Game Mode', description: 'Ativa o modo de jogos do Windows.', benefit: 'Prioriza recursos para jogos', category: 'jogos', risk: 'low', profiles: ['gaming'], proOnly: false, rebootRequired: false, requiresAdmin: false, confirm: false, riskLabel: 'RISCO BAIXO' },
  { id: 'gaming-002', name: 'Otimizar plano de energia High Performance', description: 'Altera o plano de energia para máximo desempenho.', benefit: 'CPU opera em clocks mais altos', category: 'jogos', risk: 'low', profiles: ['gaming', 'performance'], proOnly: false, rebootRequired: false, requiresAdmin: true, confirm: false, riskLabel: 'RISCO BAIXO' },
  { id: 'net-001', name: 'Otimizar TCP Auto Tuning', description: 'Ajusta o buffer de recepção TCP.', benefit: 'Melhora throughput de rede', category: 'rede', risk: 'low', profiles: ['performance', 'gaming'], proOnly: false, rebootRequired: false, requiresAdmin: true, confirm: false, riskLabel: 'RISCO BAIXO' },
  { id: 'limpeza-001', name: 'Limpar cache de updates do Windows', description: 'Remove arquivos temporários de atualizações.', benefit: 'Libera espaço em disco', category: 'limpeza', risk: 'low', profiles: ['safe', 'balanced'], proOnly: false, rebootRequired: false, requiresAdmin: true, confirm: false, riskLabel: 'RISCO BAIXO' }
];

const MOCK_PROFILES = [
  { id: 'safe', name: 'Seguro', description: 'Apenas otimizações de baixo risco.', icon: '🛡️' },
  { id: 'balanced', name: 'Equilibrado', description: 'Boa relação entre desempenho e estabilidade.', icon: '⚖️' },
  { id: 'performance', name: 'Desempenho', description: 'Maximiza FPS e throughput.', icon: '⚡' },
  { id: 'gaming', name: 'Gamer', description: 'Ideal para jogos competitivos.', icon: '🎮' },
  { id: 'work', name: 'Trabalho', description: 'Estabilidade para produtividade.', icon: '💼' },
  { id: 'laptop', name: 'Notebook', description: 'Equilíbrio entre bateria e desempenho.', icon: '💻' }
];

const MOCK_CLEAN_TARGETS = [
  { id: 'temp-files', name: 'Arquivos temporários do Windows', description: 'Thumbs.db, arquivos .tmp e cache de atualizações.', requiresAdmin: true },
  { id: 'temp-browser', name: 'Cache de navegadores', description: 'Chrome, Edge e Firefox cache.', requiresAdmin: false },
  { id: 'temp-logs', name: 'Logs do sistema', description: 'Arquivos .log em C:\\Windows\\Temp.', requiresAdmin: true },
  { id: 'temp-crash', name: 'Dumps de crash', description: 'Arquivos de dump de erro do Windows.', requiresAdmin: true }
];

const MOCK_REPAIR_OPTIONS = [
  { id: 'sfc', name: 'Verificação SFC', description: 'Verifica e corrige arquivos do sistema.', estimatedMinutes: 10, requiresAdmin: true },
  { id: 'dism', name: 'Reparo DISM', description: 'Repara a imagem do Windows.', estimatedMinutes: 15, requiresAdmin: true },
  { id: 'chkdsk', name: 'Verificação de disco', description: 'Verifica erros no sistema de arquivos.', estimatedMinutes: 8, requiresAdmin: true }
];

const MOCK_OPERATIONS = [
  {
    id: 'op-001',
    ts: Date.now() - 86400000,
    label: '3 otimização(ões) manual(is)',
    profile: 'gaming',
    itemCount: 3,
    successCount: 3,
    items: [
      { id: 'win-001', name: 'Desativar telemetria', hasBackup: true },
      { id: 'win-002', name: 'Desativar efeitos visuais', hasBackup: true },
      { id: 'gaming-001', name: 'Ativar Game Mode', hasBackup: false }
    ],
    results: [
      { ok: true },
      { ok: true },
      { ok: true }
    ]
  }
];

const MOCK_STARTUP = [
  { name: 'OneDrive', source: 'HKCU\\Run', scope: 'Usuário', impact: 'Baixo', command: '"C:\\Users\\User\\AppData\\Local\\Microsoft\\OneDrive\\OneDrive.exe" /background', enabled: true },
  { name: 'Spotify', source: 'HKCU\\Run', scope: 'Usuário', impact: 'Médio', command: '"C:\\Users\\User\\AppData\\Roaming\\Spotify\\Spotify.exe"', enabled: true },
  { name: 'Discord', source: 'HKCU\\Run', scope: 'Usuário', impact: 'Médio', command: '"C:\\Users\\User\\AppData\\Local\\Discord\\Update.exe" --processStart Discord', enabled: false },
  { name: 'Windows Security', source: 'HKLM\\Run', scope: 'Máquina', impact: 'Alto', command: '"C:\\Program Files\\Windows Defender\\MSASCuiL.exe"', enabled: true }
];

const MOCK_PROCESSES = [
  { name: 'orion-optimizer.exe', pid: 1234, manufacturer: 'Orion', cpuSec: 12.5, ramMB: 85, priority: 'Normal', critical: false },
  { name: 'chrome.exe', pid: 2345, manufacturer: 'Google LLC', cpuSec: 45.2, ramMB: 1200, priority: 'Normal', critical: false },
  { name: 'svchost.exe', pid: 890, manufacturer: 'Microsoft', cpuSec: 5.1, ramMB: 45, priority: 'Normal', critical: true },
  { name: 'dwm.exe', pid: 456, manufacturer: 'Microsoft', cpuSec: 2.3, ramMB: 120, priority: 'High', critical: true },
  { name: 'explorer.exe', pid: 678, manufacturer: 'Microsoft', cpuSec: 8.7, ramMB: 95, priority: 'Normal', critical: true },
  { name: 'steam.exe', pid: 3456, manufacturer: 'Valve', cpuSec: 22.1, ramMB: 350, priority: 'Normal', critical: false }
];

const MOCK_MONITOR = {
  cpu: { usagePercent: 35, label: 'AMD Ryzen 7 5800X', cores: 8, threads: 16 },
  gpu: { usagePercent: 12, label: 'NVIDIA RTX 3070', vramMB: 8192, vramUsedMB: 2048 },
  ram: { usagePercent: 58, totalGB: 32, usedGB: 18.6 },
  disk: { usagePercent: 22, readMBs: 120, writeMBs: 45 },
  net: { downKbps: 12500, upKbps: 3200, label: 'Ethernet' },
  temp: { cpuCelsius: 52, gpuCelsius: 41 }
};

const MOCK_BENCHMARK_RESULTS = [
  {
    id: 'bench-001',
    ts: Date.now() - 3600000,
    cpuSingle: 1520,
    cpuMulti: 12800,
    ramGBs: 42.5,
    diskReadMBs: 3500,
    diskWriteMBs: 2800
  },
  {
    id: 'bench-002',
    ts: Date.now() - 7200000,
    cpuSingle: 1480,
    cpuMulti: 12100,
    ramGBs: 40.2,
    diskReadMBs: 3200,
    diskWriteMBs: 2600
  }
];

const MOCK_HISTORY = [
  {
    id: 'hist-001',
    date: Date.now() - 86400000,
    score: 72,
    hardware: {
      cpu: 'AMD Ryzen 7 5800X',
      ramTotalGB: 32,
      ramConfigMHz: 3200,
      motherboard: 'ASUS ROG STRIX B550-F',
      bios: 'AMI 2423'
    },
    counts: { recommended: 3, optional: 2, critical: 1 }
  },
  {
    id: 'hist-002',
    date: Date.now() - 172800000,
    score: 65,
    hardware: {
      cpu: 'AMD Ryzen 7 5800X',
      ramTotalGB: 32,
      ramConfigMHz: 2666,
      motherboard: 'ASUS ROG STRIX B550-F',
      bios: 'AMI 2201'
    },
    counts: { recommended: 4, optional: 3, critical: 2 }
  }
];

function buildScores(recommendations) {
  const categories = {
    'BIOS': { percent: 72 },
    'CPU': { percent: 85 },
    'RAM': { percent: 68 },
    'GPU': { percent: 90 },
    'Sistema': { percent: 78 }
  };
  const overall = Math.round(Object.values(categories).reduce((a, c) => a + c.percent, 0) / Object.keys(categories).length);
  return { overall, categories };
}

function buildCounts(recs) {
  return {
    recommended: recs.filter((r) => r.effectiveLevel === 'recommended').length,
    optional: recs.filter((r) => r.effectiveLevel === 'optional').length,
    critical: recs.filter((r) => r.effectiveLevel === 'critical').length,
    advanced: recs.filter((r) => r.effectiveLevel === 'advanced').length
  };
}

// ============================================================
// Mock global
// ============================================================

let _licenseState = {
  active: true,
  plan: 'PRO',
  expiresAt: new Date(Date.now() + 365 * 86400000).toISOString(),
  daysLeft: 360,
  offlineGrace: false,
  key: 'ORION-XXXX-YYYY-ZZZZ'
};

const _listeners = {
  licenseChanged: [],
  serviceStep: [],
  engineStep: [],
  step: [],
  downloadProgress: [],
  installing: []
};

window.OrionAPI = {
  analyze: async () => {
    for (let i = 0; i < 5; i++) {
      await delay(400);
      const steps = ['Detectando hardware...', 'Lendo BIOS...', 'Analisando configurações...', 'Calculando pontuação...', 'Gerando recomendações...'];
      _listeners.step.forEach((cb) => cb({ key: `step-${i}`, label: steps[i] }));
    }
    const recs = MOCK_RECOMMENDATIONS;
    return { overall: 72, scores: buildScores(recs), counts: buildCounts(recs) };
  },

  getLast: async () => {
    const recs = MOCK_RECOMMENDATIONS;
    return {
      profile: MOCK_HARDWARE,
      scores: buildScores(recs),
      counts: buildCounts(recs),
      recommendations: recs,
      groups: {
        critical: recs.filter((r) => r.effectiveLevel === 'critical'),
        recommended: recs.filter((r) => r.effectiveLevel === 'recommended'),
        optional: recs.filter((r) => r.effectiveLevel === 'optional'),
        informational: recs.filter((r) => r.effectiveLevel === 'informational'),
        advanced: []
      }
    };
  },

  onStep: (cb) => { _listeners.step.push(cb); },
  onLicenseChanged: (cb) => { _listeners.licenseChanged.push(cb); },
  onServiceStep: (cb) => { _listeners.serviceStep.push(cb); },
  onEngineStep: (cb) => { _listeners.engineStep.push(cb); },

  licenseGetState: async () => _licenseState,
  licenseActivate: async (key) => {
    await delay(1000);
    _licenseState = { ..._licenseState, active: true, key };
    _listeners.licenseChanged.forEach((cb) => cb(_licenseState));
    return { ok: true };
  },
  licenseRefresh: async () => _licenseState,

  generateReport: async () => {
    await delay(500);
    return { htmlPath: 'C:\\Users\\User\\Documents\\orion-report.html', dir: 'C:\\Users\\User\\Documents' };
  },
  exportRaw: async () => {
    await delay(300);
    return 'C:\\Users\\User\\Documents\\orion-raw.json';
  },
  openPath: async () => {},
  openExternal: async () => {},

  historyList: async () => MOCK_HISTORY,
  historyCompare: async () => ({
    before: MOCK_HISTORY[1],
    after: MOCK_HISTORY[0],
    scoreDelta: 7,
    categoriesDelta: {
      'BIOS': { before: 60, after: 72 },
      'CPU': { before: 80, after: 85 },
      'RAM': { before: 55, after: 68 },
      'GPU': { before: 88, after: 90 },
      'Sistema': { before: 72, after: 78 }
    },
    countsDelta: { recommended: -1, optional: -1, critical: -1 }
  }),

  securityAnalyze: async () => {
    await delay(1500);
    return {
      score: 85,
      penalties: [{ why: 'Firewall Público desativado', pts: 5 }, { why: 'PUA Protection off', pts: 10 }],
      threatCount: 2,
      activeThreatCount: 0,
      threats: [
        { name: 'Trojan:Win32/Wacatac.B!ml', detectedAt: Date.now() - 86400000, severityId: 2, severityLabel: 'Médio', active: false, executed: false, resources: ['C:\\Temp\\file.exe'], process: 'unknown' },
        { name: 'PUA:Win32/Puabundler', detectedAt: Date.now() - 172800000, severityId: 1, severityLabel: 'Baixo', active: false, executed: true, resources: ['C:\\Users\\User\\Downloads\\setup.exe'], process: 'setup.exe' }
      ],
      defender: {
        realTimeEnabled: true,
        antivirusEnabled: true,
        tamperProtected: true,
        signatureVersion: '1.411.23.0',
        signatureLastUpdated: true,
        signatureAgeDays: 1,
        lastQuickScan: Date.now() - 3600000,
        lastQuickScanAgeDays: 0
      },
      avProducts: [
        { name: 'Microsoft Defender Antivirus', enabled: true }
      ],
      firewall: { domain: true, private: true, public: false },
      uac: { enableLua: true },
      smartscreen: { explorer: 'Warn' },
      preferences: { puaProtection: 0, exclusions: 2 },
      recommendations: []
    };
  },
  securityQuickScan: async () => {
    await delay(500);
    return { started: true, note: 'Verificação rápida iniciada em segundo plano.' };
  },

  gameBoostAnalyze: async () => {
    await delay(1200);
    return {
      score: 88,
      powerScheme: 'Alto desempenho',
      penalties: [{ why: 'Game Bar gravando em segundo plano', pts: 5 }, { why: 'Notificações de apps ativas', pts: 7 }],
      checks: [
        { label: 'Game Mode', value: true, text: 'Ativado' },
        { label: 'Plano de energia', value: true, text: 'Alto desempenho' },
        { label: 'Game Bar', value: false, text: 'Desativado' },
        { label: 'Gravação de tela', value: false, text: 'Desativado' },
        { label: 'HAGS', value: true, text: 'Ativado' },
        { label: 'Notificações', value: false, text: 'Desativado' }
      ],
      counts: { recommended: 1, optional: 1, critical: 0 },
      recommendations: MOCK_RECOMMENDATIONS.slice(0, 2)
    };
  },

  engineListItems: async () => MOCK_ITEMS,
  engineGetProfiles: async () => MOCK_PROFILES,
  engineGetDrivers: async () => [
    { id: 'driver-nvidia', vendor: 'nvidia' },
    { id: 'driver-amd', vendor: 'amd' },
    { id: 'driver-intel', vendor: 'intel' }
  ],
  engineApply: async () => {
    await delay(800);
    return { ok: true, restorePoint: { ok: true, message: 'Ponto de restauração criado.' }, results: MOCK_ITEMS.slice(0, 3).map(() => ({ ok: true, message: 'Aplicado' })) };
  },
  engineUndoItem: async () => ({ ok: true, message: 'Item revertido com sucesso.' }),
  engineUndoOperation: async () => ({ ok: true, message: 'Operação revertida.' }),
  engineListOperations: async () => MOCK_OPERATIONS,
  engineGetOperation: async () => MOCK_OPERATIONS[0],

  cleanerTargets: async () => MOCK_CLEAN_TARGETS,
  cleanerMeasure: async () => ({ 'temp-files': 1250, 'temp-browser': 800, 'temp-logs': 350, 'temp-crash': 120 }),
  cleanerClean: async (ids) => ({ results: ids.map(() => ({ ok: true })) }),

  repairOptions: async () => MOCK_REPAIR_OPTIONS,
  repairRun: async () => { await delay(1000); return { ok: true }; },
  repairQuickFix: async () => { await delay(1500); return { ok: true }; },

  monitorSnapshot: async () => MOCK_MONITOR,

  startupList: async () => MOCK_STARTUP,
  startupSetEnabled: async () => ({ ok: true }),

  processList: async () => MOCK_PROCESSES,
  processKill: async () => ({ ok: true }),
  processSetPriority: async () => ({ ok: true }),

  networkInfo: async () => ({ adapters: [{ name: 'Ethernet', ip: '192.168.1.100', mac: 'AA:BB:CC:DD:EE:FF', speed: 1000, type: 'Ethernet' }] }),
  networkPingTest: async () => ({ host: '8.8.8.8', avgMs: 12, minMs: 8, maxMs: 18, loss: 0 }),
  networkDnsTest: async () => ({ server: '8.8.8.8', domain: 'google.com', resolved: true, timeMs: 5 }),

  benchmarkList: async () => MOCK_BENCHMARK_RESULTS,
  benchmarkRun: async () => {
    await delay(3000);
    return {
      cpuSingle: 1540,
      cpuMulti: 13100,
      ramGBs: 43.2,
      diskReadMBs: 3600,
      diskWriteMBs: 2900,
      improvement: { cpuSingle: 1.3, cpuMulti: 2.3, ramGBs: 1.6 }
    };
  },

  settingsGet: async () => ({
    techMode: false, startWithWindows: false, minimizeToTray: false,
    notifications: true, createRestorePoint: true, confirmBeforeApply: true,
    defaultProfile: 'balanced', monitorInterval: 1, autoUpdate: true
  }),
  settingsSet: async () => ({ ok: true }),

  updateCheck: async () => ({
    available: true,
    update: {
      version: '2.1.0',
      url: 'https://example.com/OrionOptimizer-Setup-2.1.0.exe',
      changelog: 'Correções de estabilidade, novo módulo de otimização de rede, melhorias no Game Boost.',
      mandatory: false,
      releasedAt: new Date().toISOString()
    },
    currentVersion: '2.0.0'
  }),
  updateDownload: async (url) => {
    // Simula download com progresso
    for (let i = 0; i <= 100; i += 5) {
      await delay(100);
      _listeners.downloadProgress.forEach((cb) => cb({
        percent: i,
        received: Math.round((i / 100) * 45 * 1024 * 1024),
        total: 45 * 1024 * 1024
      }));
    }
    return { ok: true, filePath: 'C:\\Temp\\OrionOptimizer-Setup-2.1.0.exe' };
  },
  updateInstall: async (filePath) => {
    await delay(500);
    _listeners.installing.forEach((cb) => cb({ message: 'Instalando atualização... O aplicativo será reiniciado.' }));
    return { ok: true };
  },
  updateCancel: async () => { return { ok: true }; },
  onDownloadProgress: (cb) => { _listeners.downloadProgress.push(cb); },
  onInstalling: (cb) => { _listeners.installing.push(cb); },
  getAppMeta: async () => ({ version: '2.0.0', buildDate: '2026-08-20', electron: '31.7.7', node: '20.x' }),
  appHealth: async () => ({ ok: true, api: 'online', license: 'valid' })
};

// Simulate initial license state
setTimeout(() => {
  _listeners.licenseChanged.forEach((cb) => cb(_licenseState));
}, 100);
