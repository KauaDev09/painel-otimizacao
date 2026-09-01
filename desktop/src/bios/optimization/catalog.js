'use strict';

// Catálogo interno de otimizações de BIOS/firmware e ajustes adjacentes
// verificáveis. A UI recebe apenas metadados + estado — nunca métodos de apply.

const ITEMS = [
  {
    id: 'xmp',
    operation: 'enable_xmp',
    name: 'XMP',
    description: 'Ativar o perfil XMP dos módulos para usar a frequência anunciada pelo fabricante.',
    category: 'memory',
    level: 'recommended',
    risk: 'low',
    impact: 'medium',
    requiresReboot: true,
    rollbackSupported: false,
    memoryProfile: 'xmp'
  },
  {
    id: 'expo',
    operation: 'enable_expo',
    name: 'EXPO',
    description: 'Ativar o perfil EXPO (AMD DDR5) para usar a frequência anunciada pelos módulos.',
    category: 'memory',
    level: 'recommended',
    risk: 'low',
    impact: 'medium',
    requiresReboot: true,
    rollbackSupported: false,
    memoryProfile: 'expo'
  },
  {
    id: 'docp',
    operation: 'enable_docp',
    name: 'DOCP',
    description: 'Ativar D.O.C.P. (nome ASUS para o perfil de memória em plataformas AMD).',
    category: 'memory',
    level: 'recommended',
    risk: 'low',
    impact: 'medium',
    requiresReboot: true,
    rollbackSupported: false,
    memoryProfile: 'docp'
  },
  {
    id: 'above_4g',
    operation: 'enable_above_4g',
    name: 'Above 4G Decoding',
    description: 'Permitir mapeamento de BAR acima de 4 GB — pré-requisito do Resizable BAR.',
    category: 'gpu',
    level: 'recommended',
    risk: 'low',
    impact: 'medium',
    requiresReboot: true,
    rollbackSupported: false
  },
  {
    id: 'resizable_bar',
    operation: 'enable_resizable_bar',
    name: 'Resizable BAR',
    description: 'Permitir que a CPU acesse toda a VRAM de uma vez quando a plataforma suportar.',
    category: 'gpu',
    level: 'recommended',
    risk: 'low',
    impact: 'medium',
    requiresReboot: true,
    rollbackSupported: false
  },
  {
    id: 'csm',
    operation: 'disable_csm',
    name: 'CSM',
    description: 'Desativar o Compatibility Support Module para usar UEFI nativo e recursos modernos.',
    category: 'boot',
    level: 'critical',
    risk: 'medium',
    impact: 'medium',
    requiresReboot: true,
    rollbackSupported: false
  },
  {
    id: 'secure_boot',
    operation: 'enable_secure_boot',
    name: 'Secure Boot',
    description: 'Validar a cadeia de inicialização. Segurança e compatibilidade — não é ajuste de FPS.',
    category: 'boot',
    level: 'informational',
    risk: 'info',
    impact: 'low',
    requiresReboot: true,
    rollbackSupported: false
  },
  {
    id: 'cpb',
    operation: 'enable_cpb',
    name: 'AMD Core Performance Boost',
    description: 'Garantir o boost de fábrica do Ryzen (frequências máximas automáticas).',
    category: 'cpu',
    level: 'optional',
    risk: 'low',
    impact: 'medium',
    requiresReboot: true,
    rollbackSupported: false
  },
  {
    id: 'virtualization',
    operation: 'enable_virtualization',
    name: 'Virtualização (SVM / VT-x)',
    description: 'Ativar virtualização no firmware quando for usar hipervisores ou alguns anti-cheats.',
    category: 'cpu',
    level: 'optional',
    risk: 'low',
    impact: 'low',
    requiresReboot: true,
    rollbackSupported: false
  },
  {
    id: 'high_performance_plan',
    operation: 'enable_high_performance_plan',
    name: 'Plano de energia Alto desempenho',
    description: 'Aplicar o plano de energia de alto desempenho do Windows (método nativo e verificável).',
    category: 'power',
    level: 'optional',
    risk: 'low',
    impact: 'medium',
    requiresReboot: false,
    rollbackSupported: true
  }
];

const MANUAL_PATHS = {
  gigabyte: {
    xmp: ['Tweaker → Extreme Memory Profile (XMP/EXPO)'],
    expo: ['Tweaker → Extreme Memory Profile (XMP/EXPO)'],
    docp: ['Tweaker → Extreme Memory Profile (XMP/EXPO)'],
    above_4g: ['Settings → IO Ports → Above 4G Decoding'],
    resizable_bar: ['Settings → IO Ports → Re-Size BAR Support'],
    csm: ['BIOS → Boot → CSM Support'],
    secure_boot: ['BIOS → Boot → Secure Boot'],
    cpb: ['Tweaker → Advanced CPU Settings → Core Performance Boost'],
    virtualization: ['Tweaker → Advanced CPU Settings → SVM Mode']
  },
  asus: {
    xmp: ['AI Tweaker → Ai Overclock Tuner → XMP'],
    expo: ['AI Tweaker → Ai Overclock Tuner → EXPO'],
    docp: ['AI Tweaker → Ai Overclock Tuner → D.O.C.P.'],
    above_4g: ['Advanced → PCI Subsystem Settings → Above 4G Decoding'],
    resizable_bar: ['Advanced → PCI Subsystem Settings → Re-Size BAR Support'],
    csm: ['Boot → CSM (Compatibility Support Module)'],
    secure_boot: ['Boot → Secure Boot'],
    cpb: ['Advanced → AMD Overclocking → Core Performance Boost'],
    virtualization: ['Advanced → CPU Configuration → SVM Mode / Intel Virtualization']
  },
  msi: {
    xmp: ['OC → Extreme Memory Profile (XMP) / A-XMP'],
    expo: ['OC → Extreme Memory Profile (XMP)/EXPO'],
    docp: ['OC → A-XMP (Profile 1)'],
    above_4g: ['Settings → Advanced → PCI Subsystem Settings → Above 4G Decoding'],
    resizable_bar: ['Settings → Advanced → PCI Subsystem Settings → Re-Size BAR Support'],
    csm: ['Settings → Boot → Boot mode select / CSM'],
    secure_boot: ['Settings → Secure Boot'],
    cpb: ['OC → Advanced CPU Configuration → Core Performance Boost'],
    virtualization: ['OC → Advanced CPU Configuration → SVM Mode']
  },
  asrock: {
    xmp: ['OC Tweaker → DRAM Profile Configuration → XMP 2.0 Profile 1'],
    expo: ['OC Tweaker → DRAM Profile Configuration → EXPO'],
    docp: ['OC Tweaker → DRAM Profile Configuration → XMP / EOCP'],
    above_4g: ['Advanced → Chipset Configuration → Above 4G Decoding'],
    resizable_bar: ['Advanced → Chipset Configuration → Resizable BAR'],
    csm: ['Boot → CSM'],
    secure_boot: ['Security → Secure Boot'],
    cpb: ['OC Tweaker → AMD Overclocking → Core Performance Boost'],
    virtualization: ['Advanced → CPU Configuration → SVM Mode']
  }
};

const DEFAULT_PATHS = {
  xmp: ['BIOS → Menu de Overclock/Memória → Extreme Memory Profile (XMP)'],
  expo: ['BIOS → Menu de Overclock/Memória → EXPO'],
  docp: ['BIOS → AI Tweaker / Overclock → D.O.C.P.'],
  above_4g: ['BIOS → PCIe / Advanced → Above 4G Decoding'],
  resizable_bar: ['BIOS → PCIe / Advanced → Re-Size BAR Support'],
  csm: ['BIOS → Boot → CSM'],
  secure_boot: ['BIOS → Security / Boot → Secure Boot'],
  cpb: ['BIOS → Advanced / OC → Core Performance Boost'],
  virtualization: ['BIOS → Advanced → SVM Mode / Intel Virtualization Technology'],
  high_performance_plan: ['Windows → Opções de energia → Alto desempenho']
};

const MANUAL_STEPS = {
  xmp: [
    'Reinicie o computador e entre na BIOS (Del, F2 ou F10).',
    'Abra o menu Tweaker / OC / AI Tweaker.',
    'Localize Extreme Memory Profile (XMP).',
    'Selecione Profile 1 e salve (F10).',
    'Após o Windows iniciar, abra o Orion para confirmar a nova frequência.'
  ],
  expo: [
    'Reinicie e entre na BIOS.',
    'Abra o menu de memória/overclock.',
    'Ative EXPO Profile 1.',
    'Salve e reinicie.',
    'Confirme a frequência no Orion.'
  ],
  docp: [
    'Reinicie e entre na BIOS ASUS.',
    'AI Tweaker → Ai Overclock Tuner → D.O.C.P.',
    'Selecione o perfil dos módulos, salve e reinicie.',
    'Confirme a frequência no Orion.'
  ],
  above_4g: [
    'Atualize o driver da GPU.',
    'Entre na BIOS e ative Above 4G Decoding.',
    'Salve. Em muitas placas o Resizable BAR só aparece depois deste passo.',
    'Reinicie e confirme no painel do driver / Orion.'
  ],
  resizable_bar: [
    'Ative Above 4G Decoding primeiro, se ainda não estiver ativo.',
    'Ative Re-Size BAR Support / Smart Access Memory.',
    'Confirme que o CSM está desativado e o boot é UEFI.',
    'Salve, reinicie e valide no driver da GPU.'
  ],
  csm: [
    'Confirme que o disco do sistema é GPT.',
    'Entre na BIOS → Boot → CSM e desative.',
    'Garanta que o Windows aparece como opção UEFI antes de salvar.',
    'Se o sistema não iniciar, reative o CSM.'
  ],
  secure_boot: [
    'Confirme boot UEFI/GPT.',
    'BIOS → Security/Boot → Secure Boot → Enabled.',
    'Pode ser necessário restaurar chaves padrão (Windows UEFI Mode).',
    'Salve e teste a inicialização.'
  ],
  cpb: [
    'Entre na BIOS.',
    'Tweaker / OC → Advanced CPU Settings → Core Performance Boost = Auto/Enabled.',
    'Não altere outros parâmetros dessa área.',
    'Salve e reinicie.'
  ],
  virtualization: [
    'Entre na BIOS.',
    'Ative SVM Mode (AMD) ou Intel Virtualization Technology.',
    'Salve e reinicie.',
    'Confirme no Orion se o firmware passou a reportar virtualização.'
  ],
  high_performance_plan: [
    'O Orion aplica o plano via powercfg (API oficial do Windows).',
    'Pode aparecer um prompt UAC.',
    'A verificação é imediata — sem reinício.'
  ]
};

function pathsFor(vendorKey, id) {
  const v = MANUAL_PATHS[vendorKey];
  if (v && v[id]) return v[id].slice();
  return (DEFAULT_PATHS[id] || ['Consultar o manual da placa-mãe']).slice();
}

function itemById(id) {
  return ITEMS.find((x) => x.id === id) || null;
}

function itemByOperation(operation) {
  return ITEMS.find((x) => x.operation === operation) || null;
}

module.exports = { ITEMS, MANUAL_PATHS, DEFAULT_PATHS, MANUAL_STEPS, pathsFor, itemById, itemByOperation };
