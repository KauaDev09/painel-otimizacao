'use strict';

// SecurityService — análise de segurança do Windows (Microsoft Defender,
// firewall, UAC, SmartScreen) e verificação de malware.
// - Somente leitura: cmdlets Get-Mp*, Get-NetFirewallProfile, CIM e registro.
// - A única ação disponível é iniciar a Verificação Rápida nativa do
//   Microsoft Defender (Start-MpScan), executada em segundo plano, sem janela.

const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');
const psRunner = require('../hardware/psRunner');
const { asArray } = require('../utils/asArray');

const COLLECTOR_PATH = path.join(__dirname, 'securityCollector.ps1');

function isoOrNull(v) {
  if (!v) return null;
  const d = new Date(typeof v === 'string' && /^\d+$/.test(v) ? Number(v) : v);
  return isNaN(d.getTime()) ? null : d.toISOString();
}

function ageDays(iso) {
  if (!iso) return null;
  return Math.max(0, Math.floor((Date.now() - Date.parse(iso)) / 86400000));
}

const SEVERITY_LABEL = {
  0: 'Indeterminada', 1: 'Baixa', 2: 'Moderada', 4: 'Alta', 5: 'Severa', 6: 'Crítica'
};

// productState do SecurityCenter2: bit 0x1000 = proteção ativa; nibble baixo de byte3 = assinaturas (0x10 desatualizado)
function decodeProductState(state) {
  if (typeof state !== 'number') return { enabled: null, upToDate: null };
  return {
    enabled: (state & 0x1000) !== 0,
    upToDate: (state & 0x00f0) === 0 ? true : false
  };
}

async function collect() {
  const script = fs.readFileSync(COLLECTOR_PATH, 'utf8');
  const { stdout, stderr } = await psRunner.runPowerShell(script, 45000);
  if (!stdout || !stdout.trim().startsWith('{')) {
    throw new Error(`Coletor de segurança não retornou JSON. stderr: ${String(stderr).slice(0, 200)}`);
  }
  return JSON.parse(stdout.trim());
}

function buildResult(raw) {
  const d = raw.defender || {};
  const prefs = raw.defenderPrefs || {};
  const threatsRaw = asArray(raw.threats);
  const detectionsRaw = asArray(raw.threatDetections);
  const detByThreatId = new Map();
  for (const det of detectionsRaw) {
    if (!det || det.ThreatID == null) continue;
    if (!detByThreatId.has(det.ThreatID)) detByThreatId.set(det.ThreatID, []);
    detByThreatId.get(det.ThreatID).push(det);
  }

  const threats = threatsRaw.filter(Boolean).map((t) => {
    const dets = detByThreatId.get(t.ThreatID) || [];
    const first = dets[0] || {};
    return {
      name: t.ThreatName || `Ameaça ${t.ThreatID}`,
      severityId: t.SeverityID ?? null,
      severityLabel: SEVERITY_LABEL[t.SeverityID] || 'Indeterminada',
      active: Boolean(t.IsActive),
      executed: Boolean(t.DidThreatExecute),
      detectedAt: first.InitialDetectionTimeStr || null,
      process: first.ProcessName || null,
      resources: asArray(first.Resources).slice(0, 5)
    };
  }).sort((a, b) => (b.severityId || 0) - (a.severityId || 0));

  const avProducts = asArray(raw.avProducts).filter(Boolean).map((a) => ({
    name: a.displayName || 'Desconhecido',
    ...decodeProductState(a.productState)
  }));

  const fwProfiles = {};
  for (const p of asArray(raw.firewall)) {
    if (p && p.Name) fwProfiles[String(p.Name).toLowerCase()] = Boolean(p.Enabled);
  }
  const firewall = {
    domain: fwProfiles.domain ?? null,
    private: fwProfiles.private ?? null,
    public: fwProfiles.public ?? null
  };

  const uac = {
    enableLua: raw.uac ? raw.uac.enableLua === 1 : null,
    consentPrompt: raw.uac ? raw.uac.consentPrompt ?? null : null
  };

  const smartscreen = {
    explorer: (raw.smartscreen && raw.smartscreen.explorer) || null,
    edge: (raw.smartscreen && raw.smartscreen.edge) || null
  };

  const winupdate = {
    noAutoUpdate: raw.winupdate ? raw.winupdate.noAutoUpdate ?? null : null
  };

  const sigAge = ageDays(d.signatureLastUpdated);

  // ---- Recomendações (mesmo formato usado pelo motor de BIOS) ----
  const recs = [];
  const push = (r) => recs.push(r);

  if (d.available === false) {
    push({
      id: 'sec-defender-missing',
      name: 'Antivírus Microsoft Defender indisponível',
      effectiveLevel: 'critical', risk: 'high', impact: 'high', rebootRequired: false,
      statusText: `Status: serviço do Defender não respondeu à consulta.`,
      recommendation: 'Verifique o Windows Security e restaure o antivírus.',
      reason: 'Nenhum produto antivírus foi localizado — o sistema pode estar desprotegido.',
      benefit: 'Proteção contra malware restaurada.',
      compatibility: 'Windows 10/11 com Microsoft Defender.',
      paths: ['Configurações → Privacidade e segurança → Segurança do Windows'],
      steps: ['Abra o Windows Security', 'Em "Proteção contra vírus e ameaças", verifique se algum antivírus está ativo', 'Reative o Microsoft Defender ou instale um antivírus confiável'],
      notes: []
    });
  } else {
    if (d.realTimeEnabled === false) {
      push({
        id: 'sec-defender-realtime',
        name: 'Proteção em tempo real desativada',
        effectiveLevel: 'critical', risk: 'high', impact: 'high', rebootRequired: false,
        statusText: 'Status: RealTimeProtectionEnabled = False.',
        recommendation: 'Reative a proteção em tempo real no Windows Security imediatamente.',
        reason: 'Sem proteção em tempo real, malwares podem executar livremente entre verificações.',
        benefit: 'Bloqueio imediato de ameaças na execução.',
        compatibility: 'Pode ser bloqueado por políticas corporativas ou por outro antivírus ativo.',
        paths: ['Windows Security → Proteção contra vírus e ameaças → Configurações'],
        steps: ['Abra o Windows Security', 'Ative "Proteção em tempo real"', 'Se reativar sozinho não funcionar, verifique Proteção contra adulteração'],
        notes: prefs.disableRealtime === true ? ['A política DisableRealtimeMonitoring está ativa no registro — verifique regras de grupo.'] : []
      });
    }
    if (sigAge != null && sigAge > 7) {
      push({
        id: 'sec-defender-signatures',
        name: 'Assinaturas de vírus desatualizadas',
        effectiveLevel: 'recommended', risk: 'medium', impact: 'medium', rebootRequired: false,
        statusText: `Status: última atualização há ${sigAge} dia(s).`,
        recommendation: 'Atualize as inteligências de segurança do Defender (Protection Update).',
        reason: 'Assinaturas antigas deixam novas ameaças passarem despercebidas.',
        benefit: 'Detecção das ameaças mais recentes.',
        compatibility: 'Requer acesso à internet/Microsoft Update.',
        paths: ['Windows Security → Proteção contra vírus e ameaças → Verificar atualizações'],
        steps: ['Abra o Windows Security', 'Clique em "Proteção contra vírus e ameaças"', 'Em "Atualizações de proteção contra vírus e spyware", clique em Verificar atualizações'],
        notes: []
      });
    }
    if (prefs.puaProtection != null && prefs.puaProtection < 1) {
      push({
        id: 'sec-pua',
        name: 'Proteção contra aplicativos potencialmente indesejados (PUA) inativa',
        effectiveLevel: 'optional', risk: 'low', impact: 'medium', rebootRequired: false,
        statusText: 'Status: PUAProtection = ' + String(prefs.puaProtection),
        recommendation: 'Ative a proteção PUA no Defender.',
        reason: 'PUAs incluem adware/bundlers que degradam o desempenho em jogos.',
        benefit: 'Menos adware e programas indesejados.',
        compatibility: 'Windows 10/11.',
        paths: ['PowerShell (admin): Set-MpPreference -PUAProtection Enabled'],
        steps: [], notes: []
      });
    }
  }

  const fwOff = ['domain', 'private', 'public'].filter((k) => firewall[k] === false);
  if (fwOff.length) {
    push({
      id: 'sec-firewall',
      name: 'Firewall do Windows Desativado (' + fwOff.map(fw => ({ domain: 'Domínio', private: 'Privado', public: 'Público' })[fw]).join(', ') + ')',
      effectiveLevel: 'critical', risk: 'high', impact: 'high', rebootRequired: false,
      statusText: 'Status: perfil(is) ' + fwOff.join('/') + ' com Enabled=False.',
      recommendation: 'Reative o Firewall do Windows Defender para todos os perfis.',
      reason: 'Sem firewall, conexões de entrada não solicitadas são aceitas.',
      benefit: 'Bloqueio de acessos remotos indesejados.',
      compatibility: 'Não se aplica se outro firewall gerencia os perfis.',
      paths: ['Painel de Controle → Firewall do Windows Defender → Ativar ou desativar'],
      steps: [], notes: []
    });
  }

  if (uac.enableLua === false) {
    push({
      id: 'sec-uac',
      name: 'Controle de Conta de Usuário (UAC) desativado',
      effectiveLevel: 'recommended', risk: 'medium', impact: 'medium', rebootRequired: true,
      statusText: 'Status: EnableLUA = 0.',
      recommendation: 'Reative o UAC.',
      reason: 'Sem UAC, processos maliciosos ganham privilégios silenciosamente.',
      benefit: 'Barreira contra escalonamento silencioso de privilégios.',
      compatibility: '—',
      paths: ['Painel de Controle → Contas de Usuário → Alterar configurações do Controle de Conta de Usuário'],
      steps: [], notes: []
    });
  }

  const activeThreats = threats.filter((t) => t.active);
  if (threats.length) {
    push({
      id: 'sec-threats',
      name: `${threats.length} ameaça(s) registrada(s) pelo Defender${activeThreats.length ? ` — ${activeThreats.length} ATIVA(S)` : ''}`,
      effectiveLevel: activeThreats.length ? 'critical' : 'recommended',
      risk: activeThreats.length ? 'high' : 'medium', impact: 'medium', rebootRequired: false,
      statusText: `Status: ${activeThreats.length} ativa(s); total registrado: ${threats.length}.`,
      recommendation: activeThreats.length
        ? 'Execute uma Verificação Completa e trate as ameaças ativas.'
        : 'Revise o histórico — execute uma verificação completa para confirmar limpeza.',
      reason: 'O Microsoft Defender registrou detecções de malware nesta máquina.',
      benefit: 'Sistema livre de malware ativo.',
      compatibility: '—',
      paths: ['Windows Security → Proteção contra vírus e ameaças → Histórico de proteção'],
      steps: [], notes: []
    });
  }

  const quickScanEndAge = ageDays(d.quickScanEnd);
  if (quickScanEndAge == null) {
    push({
      id: 'sec-no-scan',
      name: 'Nenhuma verificação rápida concluída encontrada',
      effectiveLevel: 'recommended', risk: 'medium', impact: 'low', rebootRequired: false,
      statusText: 'Status: QuickScanEndTime vazio.',
      recommendation: 'Execute uma Verificação Rápida agora (botão nesta tela).',
      reason: 'Verificações periódicas detectam ameaças dormentes.',
      benefit: 'Confirmação de que o sistema está limpo.',
      compatibility: '—',
      paths: ['Windows Security → Proteção contra vírus e ameaças → Opções de exame'],
      steps: [], notes: []
    });
  }

  // ---- Pontuação ----
  let score = 100;
  const penalties = [];
  const pen = (pts, why) => { score -= pts; penalties.push({ pts, why }); };

  if (d.available === false) pen(60, 'Defender indisponível');
  else {
    if (d.realTimeEnabled === false) pen(40, 'Proteção em tempo real desativada');
    if (d.antivirusEnabled === false) pen(25, 'Antivírus desativado');
    if (sigAge != null && sigAge > 7) pen(15, `Assinaturas com ${sigAge} dia(s)`);
    if (prefs.puaProtection != null && prefs.puaProtection < 1) pen(5, 'PUA protection off');
  }
  if (fwOff.length) pen(20, 'Firewall desativado');
  if (uac.enableLua === false) pen(15, 'UAC desativado');
  if (activeThreats.length) pen(25, `${activeThreats.length} ameaça(s) ativa(s)`);
  else if (threats.length) pen(8, `${threats.length} ameaça(s) no histórico`);
  if (!avProducts.some((a) => a.enabled)) pen(30, 'Nenhum antivírus ativo no Security Center');
  score = Math.max(0, Math.min(100, score));

  return {
    ok: true,
    errors: raw.__errors || {},
    defender: {
      available: d.available ?? null,
      realTimeEnabled: d.realTimeEnabled ?? null,
      antivirusEnabled: d.antivirusEnabled ?? null,
      behaviorMonitor: d.behaviorMonitor ?? null,
      tamperProtected: d.tamperProtected ?? null,
      signatureVersion: d.signatureVersion || null,
      engineVersion: d.engineVersion || null,
      signatureLastUpdated: d.signatureLastUpdated || null,
      signatureAgeDays: sigAge,
      lastQuickScan: d.quickScanEnd || null,
      lastQuickScanAgeDays: quickScanEndAge,
      lastFullScan: d.fullScanEnd || null
    },
    preferences: {
      puaProtection: prefs.puaProtection ?? null,
      exclusions: prefs.exclusionCount ?? null
    },
    avProducts,
    firewall,
    uac,
    smartscreen,
    winupdate,
    threats,
    threatCount: threats.length,
    activeThreatCount: activeThreats.length,
    score,
    penalties,
    recommendations: recs,
    counts: {
      critical: recs.filter((r) => r.effectiveLevel === 'critical').length,
      recommended: recs.filter((r) => r.effectiveLevel === 'recommended').length,
      optional: recs.filter((r) => r.effectiveLevel === 'optional').length
    },
    analyzedAt: new Date().toISOString()
  };
}

class SecurityService {
  analyze(onStep = () => {}) {
    onStep({ label: 'Consultando Microsoft Defender...' });
    return collect().then(buildResult);
  }

  // Inicia a Verificação Rápida nativa do Defender em segundo plano (sem janela).
  quickScanStart(onStep = () => {}) {
    onStep({ label: 'Iniciando verificação rápida do Microsoft Defender...' });
    return new Promise((resolve) => {
      try {
        const child = spawn(
          path.join(process.env.SystemRoot || 'C:\\Windows', 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe'),
          ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command', 'Start-MpScan -ScanType QuickScan'],
          { windowsHide: true, detached: true, stdio: 'ignore' }
        );
        child.unref();
        resolve({ started: true, note: 'Verificação iniciada. Ela roda em segundo plano; consulte novamente em alguns minutos para ver o resultado.' });
      } catch (e) {
        resolve({ started: false, error: e.message });
      }
    });
  }
}

module.exports = { SecurityService };
