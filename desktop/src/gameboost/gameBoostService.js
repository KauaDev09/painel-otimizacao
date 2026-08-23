'use strict';

// GameBoostService — diagnóstico gamer somente-leitura.
// Avalia recursos do Windows que afetam jogos (Game Mode, HAGS, Game Bar/DVR,
// plano de energia, prioridades multimídia, apps em inicialização) e gera
// recomendações no mesmo formato do motor de BIOS. Nada é alterado.

const psRunner = require('../hardware/psRunner');
const { asArray } = require('../utils/asArray');

function script() {
  return `
$ErrorActionPreference = 'SilentlyContinue'
$ProgressPreference = 'SilentlyContinue'
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$out = [ordered]@{}

$out.gameMode = Get-ItemProperty 'HKCU:\\Software\\Microsoft\\GameBar' |
    Select-Object AutoGameModeEnabled, AllowAutoGameMode, UseNexusForGameBarEnabled

$out.gameDvr = Get-ItemProperty 'HKCU:\\System\\GameConfigStore' | Select-Object GameDVR_Enabled

$out.gameBarCapture = Get-ItemProperty 'HKCU:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\GameDVR' |
    Select-Object AppCaptureEnabled

$out.hags = Get-ItemProperty 'HKLM:\\SYSTEM\\CurrentControlSet\\Control\\GraphicsDrivers' |
    Select-Object HwSchMode

$out.sysProfile = Get-ItemProperty 'HKLM:\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion\\Multimedia\\SystemProfile' |
    Select-Object NetworkThrottlingIndex, SystemResponsiveness

$out.gamesTask = Get-ItemProperty 'HKLM:\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion\\Multimedia\\SystemProfile\\Tasks\\Games' |
    Select-Object 'GPU Priority', Priority, 'Scheduling Category'

$scheme = powercfg /getactivescheme 2>$null
$out.powerScheme = "$scheme"

$rUser = (Get-Item 'HKCU:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Run' -ErrorAction SilentlyContinue)
$rMachine = (Get-Item 'HKLM:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Run' -ErrorAction SilentlyContinue)
$out.startup = [ordered]@{
    user = if ($rUser) { @($rUser.Property).Count } else { 0 }
    machine = if ($rMachine) { @($rMachine.Property).Count } else { 0 }
}

$out | ConvertTo-Json -Depth 3 -Compress
`;
}

async function collect() {
  const { stdout, stderr } = await psRunner.runPowerShell(script(), 30000);
  if (!stdout || !stdout.trim().startsWith('{')) {
    throw new Error(`Coletor Game Boost não retornou JSON. stderr: ${String(stderr).slice(0, 200)}`);
  }
  return JSON.parse(stdout.trim());
}

function tri(v) { return v == null ? null : Boolean(v); }

function buildResult(raw) {
  const gameModeRaw = raw.gameMode || {};
  // AutoGameModeEnabled: 1=on 0=off; ausente => padrão do Windows = ativado
  let gameMode;
  if (gameModeRaw.AutoGameModeEnabled === 0) gameMode = false;
  else if (gameModeRaw.AutoGameModeEnabled === 1) gameMode = true;
  else if (gameModeRaw.AllowAutoGameMode === 0) gameMode = false;
  else gameMode = null;

  const dvrVal = raw.gameDvr ? raw.gameDvr.GameDVR_Enabled : null;
  const captureVal = raw.gameBarCapture ? raw.gameBarCapture.AppCaptureEnabled : null;
  const dvrActive = dvrVal === 0 ? false : captureVal === 0 ? false : dvrVal === 1 || captureVal === 1 ? true : null;

  const hagsVal = raw.hags ? raw.hags.HwSchMode : null; // 2=on 1=off ausente=default(off p/ HW antigo)
  const hags = hagsVal === 2 ? true : hagsVal === 1 ? false : null;

  const sysProfile = raw.sysProfile || {};
  const netThrottle = typeof sysProfile.NetworkThrottlingIndex === 'number' ? sysProfile.NetworkThrottlingIndex : null;
  const sysResp = typeof sysProfile.SystemResponsiveness === 'number' ? sysProfile.SystemResponsiveness : null;

  const gamesTaskRaw = raw.gamesTask || {};
  const gamesPriority = gamesTaskRaw.Priority ?? null;

  const schemeText = String(raw.powerScheme || '');
  const schemeName = (schemeText.match(/\(([^)]+)\)/) || [null, null])[1] || (schemeText || '').trim() || null;
  const schemeGuidMatch = schemeText.match(/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i);
  const schemeGuid = schemeGuidMatch ? schemeGuidMatch[1].toLowerCase() : null;
  // GUIDs oficiais dos planos do Windows
  const HIGH_PERF_GUID = '8c5e7fda-e8bf-4a96-9a85-a6e23a8c635c';
  const ULTIMATE_GUID = 'e9a42b02-d5df-448d-b5b2-5c8dc21de839';
  const BALANCED_GUID = '381b4222-f694-41f0-9685-ff5bb260df2e';
  const nameLooksHighPerf = /high performance|alto desempenho|desempenho alto|ultimate/i.test(schemeName || '');
  const isUltimate = schemeGuid === ULTIMATE_GUID;
  const isBalanced = schemeGuid === BALANCED_GUID;
  // Plano de alto desempenho: pelo GUID oficial ou, em esquemas OEM/duplicados, pelo nome.
  const isHighPerf = schemeGuid === HIGH_PERF_GUID ||
    (schemeGuid !== BALANCED_GUID && schemeGuid !== ULTIMATE_GUID && nameLooksHighPerf);

  const startup = {
    user: raw.startup ? raw.startup.user || 0 : 0,
    machine: raw.startup ? raw.startup.machine || 0 : 0
  };
  const startupTotal = startup.user + startup.machine;

  // ---- Recomendações ----
  const recs = [];
  const push = (r) => recs.push(r);

  if (gameMode === false) {
    push({
      id: 'gb-gamemode', name: 'Modo de Jogo desativado',
      effectiveLevel: 'recommended', risk: 'low', impact: 'medium', rebootRequired: false,
      statusText: 'Status: AutoGameModeEnabled = 0.',
      recommendation: 'Ative o Modo de Jogo nas Configurações do Windows.',
      reason: 'O Modo de Jogo prioriza o jogo no agendador e suspende atividades em segundo plano.',
      benefit: 'Estabilidade de FPS, principalmente com apps abertos.',
      compatibility: 'Windows 10 1709+ / Windows 11.',
      paths: ['Configurações → Jogos → Modo de Jogo'],
      steps: ['Abra Configurações → Jogos → Modo de Jogo', 'Ative "Modo de Jogo"'], notes: []
    });
  }

  if (dvrActive === true) {
    push({
      id: 'gb-gamedvr', name: 'Captura em segundo plano do Game Bar (DVR) ativa',
      effectiveLevel: 'recommended', risk: 'low', impact: 'medium', rebootRequired: false,
      statusText: 'Status: gravação de fundo da Game Bar habilitada.',
      recommendation: 'Desative a gravação em segundo plano se você não usa captura de clipes.',
      reason: 'A gravação contínua consome GPU/Codificador e memória durante o jogo.',
      benefit: 'Mais frames estáveis em GPUs integradas ou de entrada.',
      compatibility: 'Desative apenas se não utiliza os recursos de captura.',
      paths: ['Configurações → Jogos → Capturas', 'Configurações → Jogos → Modo de Jogo (gravação em segundo plano)'],
      steps: ['Configurações → Jogos → Capturas → desative "Gravar o que aconteceu"', 'Se preferir, mantenha apenas capturas manuais (Win+Alt+G)'], notes: []
    });
  }

  if (hags === false) {
    push({
      id: 'gb-hags', name: 'Agendamento de GPU acelerado por hardware (HAGS) desativado',
      effectiveLevel: 'optional', risk: 'low', impact: 'low', rebootRequired: true,
      statusText: 'Status: HwSchMode = 1 (off).',
      recommendation: 'Teste ativar o HAGS — em GPUs recentes pode reduzir latência; em antigas pode piorar.',
      reason: 'HAGS transfere o gerenciamento de filas da GPU para o próprio chip gráfico.',
      benefit: 'Latência menor em GPUs RTX/RX recentes com drivers atualizados.',
      compatibility: 'Requer GPU compatível (GTX 10xx+, RX 5600+) e driver atual. Efeito varia por jogo.',
      paths: ['Configurações → Sistema → Tela → Gráficos → Configurações de gráficos padrão'],
      steps: ['Ative "Agendamento de GPU acelerado por hardware"', 'Reinicie o computador', 'Teste nos seus jogos — se houver instabilidade, reverta'],
      notes: ['Efeito depende de driver/jogo: teste A/B antes de manter.']
    });
  }

  if (!isHighPerf && !isUltimate) {
    push({
      id: 'gb-power', name: isBalanced ? 'Plano de energia Equilibrado ativo' : 'Plano de energia não é Alto Desempenho',
      effectiveLevel: 'optional', risk: 'low', impact: 'medium', rebootRequired: false,
      statusText: `Status: ${schemeName ? `"${schemeName}"` : 'plano não identificado'}.`,
      recommendation: 'Para desktops, use o plano Alto Desempenho (ou Ultimate) durante jogos.',
      reason: 'Planos econômicos reduzem clock antes do necessário e atrasam respostas do disco/USB.',
      benefit: 'Clocks sustentados e menos micro-travadas.',
      compatibility: 'Em notebooks, prefira "Melhor desempenho" apenas conectado à tomada.',
      paths: ['Painel de Controle → Opções de Energia'],
      steps: ['Selecione "Alto desempenho"', '(Opcional) crie o plano Ultimate: powercfg -duplicatescheme e9a42b02-d5df-448d-b5b2-5c8dc21de839'],
      notes: []
    });
  }

  if (netThrottle != null && netThrottle !== 0xffffffff && netThrottle !== 4294967295) {
    push({
      id: 'gb-netthrottle', name: 'Limitação de rede multimídia no padrão',
      effectiveLevel: 'optional', risk: 'medium', impact: 'low', rebootRequired: true,
      statusText: `Status: NetworkThrottlingIndex = ${netThrottle}.`,
      recommendation: 'Jogadores avançados podem liberar o throttle de rede multimídia (valor FFFFFFFF).',
      reason: 'O Windows limita tráfego de rede enquanto reproduz multimídia; em jogos online isso adiciona jitter.',
      benefit: 'Menos variação de ping em alguns cenários.',
      compatibility: 'Alteração avançada de registro — faça backup antes.',
      paths: ['HKLM\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion\\Multimedia\\SystemProfile → NetworkThrottlingIndex'],
      steps: [], notes: ['Modo Técnico: alteração manual opcional, por sua conta e risco.']
    });
  }

  if (startupTotal > 12) {
    push({
      id: 'gb-startup', name: `${startupTotal} programas iniciam com o Windows`,
      effectiveLevel: 'recommended', risk: 'low', impact: 'medium', rebootRequired: false,
      statusText: `Status: ${startup.user} do usuário + ${startup.machine} da máquina.`,
      recommendation: 'Desative inicializadores/updaters que você não usa ao jogar.',
      reason: 'Processos em segundo plano disputam disco, RAM e CPU nos primeiros minutos.',
      benefit: 'Boot mais rápido e mais recursos livres no jogo.',
      compatibility: '—',
      paths: ['Gerenciador de Tarefas → Aplicativos de inicialização'],
      steps: ['Ctrl+Shift+Esc → guia Inicializar', 'Desative itens desnecessários (launchers, updaters)'], notes: []
    });
  }

  // ---- Pontuação ----
  let score = 100;
  const penalties = [];
  const pen = (p, why) => { score -= p; penalties.push({ pts: p, why }); };
  if (gameMode === false) pen(20, 'Modo de Jogo off');
  if (dvrActive === true) pen(15, 'Game DVR gravando em segundo plano');
  if (hags === false) pen(5, 'HAGS off (opcional)');
  if (!isHighPerf && !isUltimate) pen(15, 'Plano de energia equilibrado/econômico');
  if (startupTotal > 12) pen(Math.min(20, Math.floor((startupTotal - 12) * 1.5)), `${startupTotal} apps na inicialização`);
  score = Math.max(0, Math.min(100, score));

  return {
    ok: true,
    checks: [
      { key: 'gamemode', label: 'Modo de Jogo', value: gameMode, text: gameMode == null ? 'não determinado (padrão do Windows)' : gameMode ? 'Ativado' : 'Desativado' },
      { key: 'gamedvr', label: 'Gravação em segundo plano (Game DVR)', value: dvrActive == null ? null : !dvrActive, text: dvrActive == null ? 'não determinado' : dvrActive ? 'Ativa (custo de desempenho)' : 'Desativada' },
      { key: 'hags', label: 'HAGS (agendamento de GPU)', value: hags, text: hags == null ? 'não exposto pelo Windows/driver' : hags ? 'Ativado' : 'Desativado' },
      { key: 'power', label: 'Plano de energia', value: isHighPerf || isUltimate, text: schemeName || 'não foi possível determinar' },
      { key: 'netthrottle', label: 'Limitação de rede multimídia', value: netThrottle === 0xffffffff || netThrottle === 4294967295 ? true : null, text: netThrottle == null ? 'não determinado' : (netThrottle === 0xffffffff || netThrottle === 4294967295 ? 'Desativada (ideal p/ jogos online)' : 'No padrão do Windows') },
      { key: 'gamespriority', label: 'Prioridade do perfil "Games"', value: null, text: gamesPriority != null ? `Priority = ${gamesPriority}` : 'não determinado' },
      { key: 'startup', label: 'Programas na inicialização', value: startupTotal <= 12 ? true : false, text: `${startupTotal} (${startup.user} usuário · ${startup.machine} máquina)` }
    ],
    powerScheme: schemeName,
    startup,
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

class GameBoostService {
  analyze(onStep = () => {}) {
    onStep({ label: 'Verificando recursos de jogos do Windows...' });
    return collect().then(buildResult);
  }
}

module.exports = { GameBoostService };
