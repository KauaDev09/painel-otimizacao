'use strict';

// HardwareDetectionService — camada central de coleta.
// Orquestra os serviços de detecção e monta o perfil normalizado do sistema.
// TODOS os dados vêm de consultas reais (PowerShell/CIM/WMI/Registro, somente-leitura).
// O que o Windows não expõe permanece null/unknown — nada é inventado.

const psRunner = require('../hardware/psRunner');
const { asArray } = require('../utils/asArray');
const { detectCpu } = require('../hardware/cpuService');
const { detectMemory } = require('../hardware/memoryService');
const { detectGpus } = require('../hardware/gpuService');
const { detectMotherboard } = require('../hardware/motherboardService');
const { detectOs, detectDisks } = require('../hardware/osService');
const { detectBios } = require('../bios/biosService');
const { detectBootMode, detectSecureBoot, detectTpm, detectVirtualization } = require('../bios/systemStateService');
const { APP_VERSION } = require('../config/appConfig');

function labelVirt(status) {
  switch (status) {
    case 'enabled_hypervisor_running': return 'Ativada (hipervisor em execução)';
    case 'enabled_firmware': return 'Ativada (firmware)';
    case 'off_or_hidden_by_hypervisor': return 'Desativada ou oculta por hipervisor';
    default: return 'Não foi possível determinar';
  }
}

function labelTpm(state) {
  switch (state) {
    case 'present_enabled': return 'Presente e ativado';
    case 'present_disabled': return 'Presente e desativado';
    case 'present_unknown': return 'Presente — estado não determinado sem administrador';
    default: return 'Não foi possível determinar';
  }
}

async function runDetection(onStep = () => {}) {
  const t0 = Date.now();

  const steps = [
    ['collect', 'Coletando informações via CIM/WMI...'],
    ['cpu', 'Identificando processador...'],
    ['memory', 'Analisando memória RAM...'],
    ['gpu', 'Identificando GPU e driver...'],
    ['board', 'Identificando placa-mãe e BIOS...'],
    ['state', 'Verificando UEFI, Secure Boot, TPM e virtualização...']
  ];
  for (const [key, label] of steps) onStep({ key, label });

  const raw = await psRunner.collectAll((msg) => onStep({ key: 'collect', label: msg }));
  onStep({ key: 'gpu-smi', label: 'Consultando utilitários do fabricante da GPU...' });
  const nvidiaSmi = await psRunner.queryNvidiaSmi();

  onStep({ key: 'analyze', label: 'Analisando configuração...' });

  // ---- Serviços individuais ----
  const cpu = detectCpu(raw);
  const ram = detectMemory(raw);
  const gpuList = detectGpus(raw, nvidiaSmi);
  const motherboard = detectMotherboard(raw);
  const bios = detectBios(raw);
  const os = detectOs(raw);
  const disk = detectDisks(raw);

  const bootMode = detectBootMode(raw);
  const secureBoot = detectSecureBoot(raw);
  const tpm = detectTpm(raw);

  const hypervisorPresent = Boolean(
    asArray(raw.system)[0] && asArray(raw.system)[0].HypervisorPresent === true
  );
  const virtStatus = detectVirtualization(cpu, hypervisorPresent);

  const primaryGpu = gpuList.find((g) => !g.isIntegrated) || gpuList[0] || null;
  const hasModernRebarCapable = gpuList.some((g) => g.gen === 'modern_rebar_capable');

  const profile = {
    meta: {
      appVersion: APP_VERSION,
      analyzedAt: new Date().toISOString(),
      durationMs: null,
      hostname: process.env.COMPUTERNAME || null,
      elevated: false,
      disclaimer: 'Ferramenta somente-leitura. Nenhuma alteração de BIOS/firmware/sistema foi realizada.'
    },
    os: { detected: true, ...os },
    cpu: {
      ...cpu,
      isRyzen: /ryzen/i.test(cpu.name || ''),
      unlockedLabel: cpu.unlocked === null ? 'não determinado' : (cpu.unlocked ? 'sim' : 'não')
    },
    motherboard,
    bios,
    ram: {
      ...ram,
      layoutIsMixed: ['mixed', 'mixed_part_matched_size'].includes(ram.layout),
      perModuleGBList: ram.perModuleGB || [],
      configSpeedList: ram.configSpeeds || [],
      ratedSpeedList: ram.ratedSpeeds || []
    },
    gpu: gpuList,
    gpuSummary: {
      hasDiscrete: gpuList.some((g) => !g.isIntegrated),
      hasModernRebarCapable,
      primaryName: primaryGpu ? primaryGpu.name : '—'
    },
    boot: { mode: bootMode },
    disk,
    secureBoot,
    tpm: { ...tpm, stateLabel: labelTpm(tpm.state) },
    virtStatus,
    virtStatusLabel: labelVirt(virtStatus)
  };

  profile.meta.durationMs = Date.now() - t0;
  profile.raw = raw; // dados brutos para exportação técnica
  return profile;
}

module.exports = { runDetection };
