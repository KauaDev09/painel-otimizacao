'use strict';

// GameBoostService — diagnóstico gamer e MODO JOGO (sessão de boost).
// 1) Diagnóstico somente-leitura dos recursos que afetam jogos.
// 2) GameMode: inicia um jogo/app com boost — plano de energia de alto
//    desempenho + prioridade "Alta" no processo — e desfaz tudo quando o
//    jogo fecha, sem precisar de novo prompt de administrador.

const fs = require('fs');
const path = require('path');
const { execFile } = require('child_process');
const psRunner = require('../hardware/psRunner');
const { asArray } = require('../utils/asArray');

const HIGH_PERF_GUID = '8c5e7fda-e8bf-4a96-9a85-a6e23a8c635c';
const BALANCED_GUID = '381b4222-f694-41f0-9685-ff5bb260df2e';
const GUID_RX = '([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})';

function psEscapeSingle(s) {
  return String(s).replace(/'/g, "''");
}

// ---------------------------------------------------------------------------
// Diagnóstico
// ---------------------------------------------------------------------------

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
  const ULTIMATE_GUID = 'e9a42b02-d5df-448d-b5b2-5c8dc21de839';
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

// ---------------------------------------------------------------------------
// MODO JOGO — sessão de boost com app/jogo escolhido pelo usuário
// ---------------------------------------------------------------------------

/**
 * Gera o script PowerShell (elevado) de uma sessão de jogo.
 * O helper roda ELEVADO e:
 *   1) salva o plano de energia atual;
 *   2) ativa o plano Alto Desempenho;
 *   3) escreve session.json com stage=pending (sinal de "UAC aceito");
 *   4) lança o jogo SEM elevação via explorer.exe (evita problemas com anti-cheat);
 *   5) quando o processo aparece, seta prioridade "Alta";
 *   6) aguarda o jogo fechar e restaura o plano anterior automaticamente;
 *   7) escreve stage=ended em session.json e sai.
 * Tudo isso com UM único prompt de administrador, no início da sessão.
 */
function buildSessionStartScript({ sessionFile, game }) {
  const exe = game.path;
  return [
    "$ErrorActionPreference = 'SilentlyContinue'",
    "$ProgressPreference = 'SilentlyContinue'",
    '[Console]::OutputEncoding = [System.Text.Encoding]::UTF8',
    'function Save-Stage([string]$stage, [int]$p, [string]$prev) {',
    '  $o = [ordered]@{',
    '    stage = $stage',
    '    gameId = $gameId',
    '    gameName = $gameName',
    '    pid = $p',
    '    processName = $baseName',
    '    previousScheme = $prev',
    '    startedAt = $startedAtStr',
    '    endedAt = $null',
    '  }',
    '  $o | ConvertTo-Json -Compress | Set-Content -LiteralPath $sessionFile -Encoding UTF8',
    '}',
    `$sessionFile = '${psEscapeSingle(sessionFile)}'`,
    `$exe = '${psEscapeSingle(exe)}'`,
    `$gameId = '${psEscapeSingle(game.id)}'`,
    `$gameName = '${psEscapeSingle(game.name)}'`,
    '$baseName = [System.IO.Path]::GetFileNameWithoutExtension($exe)',
    '$startedAt = Get-Date',
    '$startedAtStr = $startedAt.ToString("o")',
    // Plano de energia anterior
    '$schemes = powercfg /getactivescheme 2>$null',
    '$m = [regex]::Match("$schemes", "' + GUID_RX + '", "IgnoreCase")',
    '$prev = if ($m.Success) { $m.Groups[1].Value.ToLower() } else { $null }',
    // Ativa Alto Desempenho
    `powercfg /setactive ${HIGH_PERF_GUID} 2>$null`,
    'if ($LASTEXITCODE -ne 0) { $dup = powercfg /duplicatescheme ' + HIGH_PERF_GUID + ' 2>$null; $dm = [regex]::Match("$dup", "' + GUID_RX + '", "IgnoreCase"); if ($dm.Success) { powercfg /setactive $dm.Groups[1].Value } }',
    // stage=pending = helper rodando (UAC aceito)
    'Save-Stage "pending" 0 $prev',
    // Lança o jogo SEM elevação, via shell do usuário (evita anti-cheat sensível)
    'Start-Process -FilePath "explorer.exe" -ArgumentList $exe',
    // Localiza o processo (até ~20s) e eleva a prioridade para "Alta"
    '$found = $null',
    'for ($i = 0; $i -lt 40; $i++) {',
    '  Start-Sleep -Milliseconds 500',
    '  $c = @(Get-Process -ErrorAction SilentlyContinue | Where-Object { $_.ProcessName -eq $baseName -and $_.StartTime -gt $startedAt.AddSeconds(-2) })',
    '  if ($c.Count -gt 0) { $found = $c | Sort-Object StartTime | Select-Object -First 1; break }',
    '}',
    'if ($found) {',
    '  try { $found.PriorityClass = "High" } catch {}',
    '  Save-Stage "running" $found.Id $prev',
    '  while (-not $found.HasExited) { Start-Sleep -Seconds 2; try { $found.Refresh() } catch { break } }',
    '  Start-Sleep -Milliseconds 800',
    '} else {',
    '  Save-Stage "ended" 0 $prev',
    '}',
    // Restaura o plano anterior (mesmo processo elevado → sem novo UAC)
    'if ($prev) { powercfg /setactive $prev 2>$null }',
    '$endObj = [ordered]@{ stage="ended"; gameId=$gameId; gameName=$gameName; pid=0; processName=$baseName; previousScheme=$prev; startedAt=$startedAtStr; endedAt=(Get-Date).ToString("o") } | ConvertTo-Json -Compress | Set-Content -LiteralPath $sessionFile -Encoding UTF8',
    'exit 0'
  ].join('\n');
}

function buildSessionKillScript() {
  return [
    '$ErrorActionPreference = "SilentlyContinue"',
    `powercfg /setactive ${HIGH_PERF_GUID} 2>$null`,
    'exit 0'
  ].join('\n');
}

function windowsPowershellPath() {
  return path.join(
    process.env.SystemRoot || 'C:\\Windows',
    'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe'
  );
}

/**
 * Escreve um helper .ps1 temporário e o executa ELEVADO (UAC), sem esperar o
 * processo terminar (detached). Usado pela sessão de jogo, que vive até o
 * jogo fechar. Retorna { ok:true } imediatamente.
 */
function runElevatedDetached(scriptBody, baseDir) {
  return new Promise((resolve) => {
    try {
      fs.mkdirSync(baseDir, { recursive: true });
      const helper = path.join(baseDir, `gb-session-${Date.now()}.ps1`);
      fs.writeFileSync(helper, '\ufeff' + scriptBody, 'utf8');
      const psExe = windowsPowershellPath();
      const launcher =
        'Start-Process -FilePath ' + JSON.stringify(psExe) +
        ' -ArgumentList ' + JSON.stringify(['-NoProfile', '-NonInteractive', '-WindowStyle', 'Hidden', '-ExecutionPolicy', 'Bypass', '-File', helper]) +
        ' -Verb RunAs -WindowStyle Hidden';
      execFile(psExe, ['-NoProfile', '-NonInteractive', '-Command', launcher], { windowsHide: true }, (err) => {
        if (err) console.error('[gameboost] Falha ao iniciar helper elevado (UAC cancelado?):', err.message);
      });
      resolve({ ok: true, helper });
    } catch (err) {
      resolve({ ok: false, error: err.message });
    }
  });
}

class GameMode {
  constructor() {
    this.dir = null;
    this.win = null;
    this.monitor = null;
    this.pending = false;
    this.pendingSince = null;
    this.pendingNotified = false;
    this.session = null; // { running, pid, processName, gameName, startedAt } — espelho main
  }

  setStoreDir(dir) { this.dir = dir; }
  setMainWindow(win) { this.win = win; }

  gamesFile() { return path.join(this.dir, 'games.json'); }
  sessionFile() { return path.join(this.dir, 'session.json'); }

  _emit(payload) {
    if (this.win && !this.win.isDestroyed()) {
      try { this.win.webContents.send('gameboost:session', payload); } catch (_) { /* ignora */ }
    }
  }

  list() {
    try {
      return JSON.parse(fs.readFileSync(this.gamesFile(), 'utf8'));
    } catch (_) {
      return [];
    }
  }

  add({ path: exe, name }) {
    if (!exe || !fs.existsSync(exe)) throw new Error('O caminho do aplicativo não existe.');
    const ext = path.extname(exe).toLowerCase();
    if (ext !== '.exe' && ext !== '.lnk' && ext !== '.bat') {
      throw new Error('Escolha um executável (.exe) ou atalho (.lnk) do jogo.');
    }
    const games = this.list();
    const id = 'g' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    const friendly = name || path.basename(exe, path.extname(exe));
    const item = { id, path: exe, name: friendly, addedAt: new Date().toISOString() };
    games.push(item);
    fs.mkdirSync(this.dir, { recursive: true });
    fs.writeFileSync(this.gamesFile(), JSON.stringify(games, null, 2), 'utf8');
    return item;
  }

  remove(id) {
    const games = this.list().filter((g) => String(g.id) !== String(id));
    fs.mkdirSync(this.dir, { recursive: true });
    fs.writeFileSync(this.gamesFile(), JSON.stringify(games, null, 2), 'utf8');
    return { ok: true };
  }

  status() {
    let disk = null;
    try { disk = JSON.parse(fs.readFileSync(this.sessionFile(), 'utf8')); } catch (_) { /* ausente */ }
    return {
      running: !!(this.session && this.session.running) || !!(disk && disk.stage === 'running'),
      pending: !!(disk && disk.stage === 'pending'),
      session: this.session || (disk && { running: disk.stage === 'running', pid: disk.pid, processName: disk.processName, gameName: disk.gameName })
    };
  }

  clearStale() {
    try { fs.unlinkSync(this.sessionFile()); } catch (_) { /* nenhum */ }
    this.session = null;
    this.pending = null;
    this.pendingSince = null;
    this.pendingNotified = false;
  }

  async start(gameId) {
    if (!this.dir) throw new Error('GameMode não inicializado.');
    const game = this.list().find((g) => String(g.id) === String(gameId));
    if (!game) throw new Error('Jogo/app não encontrado na lista.');

    const st = this.status();
    if (st.running || st.pending) throw new Error('Já existe uma sessão de boost ativa. Encerre-a primeiro.');

    this.clearStale();
    const res = await runElevatedDetached(buildSessionStartScript({ sessionFile: this.sessionFile(), game }), this.dir);
    if (!res.ok) throw new Error(res.error || 'Falha ao iniciar a sessão.');
    this.pending = true;
    this.pendingSince = Date.now();
    this.startMonitor();
    return { ok: true, pending: true, gameName: game.name, message: 'Aguardando permissão de administrador (UAC)...' };
  }

  async stop() {
    const st = this.status();
    const wasRunning = st.running;
    this.stopMonitor();
    this.clearStale();
    this._emit({ state: 'stopped', message: 'Boost encerrado. O plano de energia será restaurado quando o jogo fechar.' });
    if (wasRunning && process.platform === 'win32') {
      // Garante o plano Alto Desempenho enquanto o jogo ainda roda (o helper
      // só restaura quando o jogo sair) — verificação acessória, sem elevação.
      try {
        // Tenta apenas ativar alta performance SEM elevação (não deve exigir UAC
        // se o helper já está elevado e mudou o esquema). Se falhar, ignora.
        const ps = windowsPowershellPath();
        execFile(ps, ['-NoProfile', '-NonInteractive', '-WindowStyle', 'Hidden', '-Command', buildSessionKillScript()], { windowsHide: true }, () => {});
      } catch (_) { /* ignora */ }
    }
    return { ok: true, message: 'Sessão encerrada.' };
  }

  startMonitor() {
    if (this.monitor) return;
    this.monitor = setInterval(() => {
      let disk = null;
      try { disk = JSON.parse(fs.readFileSync(this.sessionFile(), 'utf8')); } catch (_) { /* ausente */ }

      // Aguardando UAC há mais de 60s sem sinal → assumir cancelamento.
      if (this.pending && !disk && this.pendingSince && Date.now() - this.pendingSince > 60000) {
        this.stopMonitor();
        this.clearStale();
        this._emit({ state: 'cancelled', message: 'Permissão de administrador não concedida. A sessão não foi iniciada.' });
        return;
      }

      if (!disk) { this.session = null; return; }

      if (disk.stage === 'running' && !(this.session && this.session.running)) {
        this.session = { running: true, pid: disk.pid, processName: disk.processName, gameName: disk.gameName, startedAt: disk.startedAt };
        this.pending = false;
        this.pendingSince = null;
        this._emit({ state: 'running', session: this.session, message: `${disk.gameName} rodando com boost de prioridade e energia.` });
      }

      if (disk.stage === 'pending') {
        this.pending = true;
        if (!this.pendingNotified) {
          this.pendingNotified = true;
          this._emit({ state: 'running', message: 'Sessão iniciada. Localizando o processo do jogo...' });
        }
      }

      if (disk.stage === 'ended') {
        this.stopMonitor();
        this.session = null;
        this.pending = false;
        this.pendingNotified = false;
        this._emit({ state: 'ended', message: 'Jogo encerrado. Plano de energia restaurado automaticamente.' });
        try { fs.unlinkSync(this.sessionFile()); } catch (_) { /* limpo */ }
      }
    }, 3000);
  }

  stopMonitor() {
    if (this.monitor) { clearInterval(this.monitor); this.monitor = null; }
  }
}

module.exports = { GameBoostService, GameMode };
