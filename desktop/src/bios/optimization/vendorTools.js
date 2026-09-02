'use strict';

// Integração com as ferramentas oficiais dos fabricantes de placa-mãe.
//
// Cada ferramenta é executada pelo caminho instalado (detectado no scan) e
// direcionada ao módulo de BIOS/ajuste da marca, em vez de tentar gravar bytes
// na NVRAM de forma insegura. A alteração concreta é confirmada dentro da
// própria ferramenta pelo usuário; o Orion NUNCA inventa offsets (ver efiVar).
//
// Segurança:
//   1. Só age quando a ferramenta do fabricante foi realmente detectada.
//   2. Não escreve nada na firmware por conta própria — apenas abre a ferramenta.
//   3. Em mock, retorna sucesso simulado sem abrir janela.

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const VENDOR_TOOL_KEYS = {
  gigabyte: ['gigabyteGcc', 'gigabyteEasyTune'],
  asus: ['asusArmoury', 'asusAiSuite'],
  msi: ['msiCenter'],
  asrock: ['asrockTuning']
};

const TOOL_LABELS = {
  gigabyteGcc: 'GIGABYTE Control Center',
  gigabyteEasyTune: 'GIGABYTE EasyTune',
  asusArmoury: 'ASUS Armoury Crate',
  asusAiSuite: 'ASUS AI Suite III',
  msiCenter: 'MSI Center',
  asrockTuning: 'ASRock A-Tuning'
};

function toolExecutables() {
  const pf = process.env['ProgramFiles'] || 'C:\\Program Files';
  const pf86 = process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)';
  return {
    gigabyteGcc: [
      path.join(pf, 'GIGABYTE', 'Control Center', 'CCC.exe'),
      path.join(pf86, 'GIGABYTE', 'Control Center', 'CCC.exe')
    ],
    gigabyteEasyTune: [
      path.join(pf, 'GIGABYTE', 'EasyTune', 'EasyTune.exe'),
      path.join(pf86, 'GIGABYTE', 'EasyTune', 'EasyTune.exe')
    ],
    asusArmoury: [
      path.join(pf, 'ASUS', 'Armoury Crate', 'ArmouryCrate.exe'),
      path.join(pf86, 'ASUS', 'Armoury Crate', 'ArmouryCrate.exe')
    ],
    asusAiSuite: [
      path.join(pf86, 'ASUS', 'AI Suite III', 'AsusFanControlService.exe'),
      path.join(pf, 'ASUS', 'AI Suite III', 'AsusFanControlService.exe')
    ],
    msiCenter: [
      path.join(pf86, 'MSI', 'MSI Center', 'MSI.Central.Server.exe'),
      path.join(pf, 'MSI', 'MSI Center', 'MSI.Central.Server.exe')
    ],
    asrockTuning: [
      path.join(pf, 'ASRock', 'A-Tuning', 'A-Tuning.exe'),
      path.join(pf86, 'ASRock', 'A-Tuning', 'A-Tuning.exe')
    ]
  };
}

function firstExisting(paths) {
  for (const p of paths) {
    try {
      if (fs.existsSync(p)) return p;
    } catch (_) { /* ignore */ }
  }
  return null;
}

// Resolve qual ferramenta está instalada para o fabricante da placa.
function detectedToolKey(extra, boardVendor) {
  const vt = (extra && extra.vendorTools) || {};
  const keys = VENDOR_TOOL_KEYS[boardVendor] || [];
  for (const key of keys) {
    if (vt[key]) return key;
  }
  return null;
}

// Capacidade: se a ferramenta do fabricante estiver instalada, o item entra em
// modo automático (o Orion abre a ferramenta e o usuário confirma a alteração).
function capabilityFor(item, scan) {
  const extra = (scan && scan.extra) || {};
  const board = (scan && scan.profile && scan.profile.motherboard) || {};
  const toolKey = detectedToolKey(extra, board.vendorKey);
  if (!toolKey) {
    return {
      ok: false,
      mode: 'manual',
      reason: 'Nenhuma ferramenta oficial deste fabricante foi detectada.'
    };
  }
  return {
    ok: true,
    mode: 'auto',
    requiresAdmin: false,
    vendorTool: toolKey,
    tool: TOOL_LABELS[toolKey] || toolKey,
    reason: `${TOOL_LABELS[toolKey] || toolKey} instalada. O Orion abre a ferramenta para confirmar a alteração.`
  };
}

// Executa a ferramenta do fabricante (modo real) ou simula (mock).
function launchTool(toolKey) {
  const exes = toolExecutables()[toolKey] || [];
  const exe = firstExisting(exes);
  if (!exe) return null;
  try {
    const child = spawn(exe, [], {
      windowsHide: false,
      detached: false,
      stdio: 'ignore'
    });
    child.on('error', () => {});
    return exe;
  } catch (_) {
    return null;
  }
}

async function apply(item, scan, ctx) {
  const extra = (scan && scan.extra) || {};
  const board = (scan && scan.profile && scan.profile.motherboard) || {};
  const toolKey = detectedToolKey(extra, board.vendorKey);

  if (ctx && ctx.mock) {
    return {
      ok: true,
      message: `Ferramenta do fabricante aberta (mock).`
    };
  }

  if (!toolKey) {
    return {
      ok: false,
      manual: true,
      message: 'Nenhuma ferramenta oficial foi detectada para esta placa. Abra a BIOS manualmente para confirmar a alteração.'
    };
  }

  const launched = launchTool(toolKey);
  if (!launched) {
    return {
      ok: false,
      message: 'A ferramenta do fabricante foi detectada, mas o executável não pôde ser iniciado.'
    };
  }

  return {
    ok: true,
    message: `${TOOL_LABELS[toolKey] || toolKey} aberto. Confirme a alteração (${item.name}) nela e reinicie quando indicado.`,
    snapshot: {
      type: 'vendor_tool',
      tool: toolKey,
      toolLabel: TOOL_LABELS[toolKey] || toolKey,
      board: board.boardProduct
    }
  };
}

module.exports = {
  VENDOR_TOOL_KEYS,
  TOOL_LABELS,
  toolExecutables,
  firstExisting,
  detectedToolKey,
  capabilityFor,
  apply
};
