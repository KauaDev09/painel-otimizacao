'use strict';

// OptimizationRunner — execução silenciosa em lote com UAC único.
// Porta para Node do motor do Mainstreet Optimizer (src/runner.py):
//   - Nenhum processo mostra janela de console (windowsHide).
//   - Scripts de uma operação são agrupados num orquestrador .cmd temporário e
//     executados com UMA ÚNICA elevação UAC quando necessário.
//   - stdout/stderr de cada passo vai para um arquivo de log interno.
//   - O código de saída de cada passo é capturado por marcadores no log.
//   - Só executa caminhos validados (extensão conhecida + arquivo existe).
//   - Nenhum comando vem digitado pelo usuário — sempre itens do catálogo.

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const ALLOWED_SUFFIXES = new Set(['.bat', '.cmd', '.reg', '.ps1']);
const SEQUENCE_TIMEOUT_MS = 30 * 60 * 1000; // 30 min por sequência
const MARK_SEQ_START = '@@MSO_SEQ_START@@';
const MARK_SEQ_END = '@@MSO_SEQ_END@@';
const stepStartMark = (i) => `@@MSO_STEP_${i}_START@@`;
const stepEndMark = (i) => `@@MSO_STEP_${i}_END@@`;

let logsDir = null;
function setLogsDir(dir) {
  logsDir = dir;
  fs.mkdirSync(dir, { recursive: true });
}

function validatePath(file) {
  let p;
  try { p = path.resolve(file); } catch (_) { return { error: 'Caminho inválido.' }; }
  if (!fs.existsSync(p)) return { error: `Arquivo não encontrado: ${path.basename(p)}` };
  if (!ALLOWED_SUFFIXES.has(path.extname(p).toLowerCase())) {
    return { error: `Tipo de arquivo não permitido: ${path.extname(p)}` };
  }
  return { resolved: p };
}

function isElevated() {
  try {
    // net session exige admin; falha rápida e sem janela.
    const out = require('child_process').spawnSync('net', ['session'], {
      windowsHide: true, timeout: 5000, encoding: 'utf8'
    });
    return out.status === 0;
  } catch (_) {
    return false;
  }
}

function friendlyError(exitCode, name) {
  if (exitCode === -1073741510 || exitCode === 3221225786) return `${name}: interrompido.`;
  if (exitCode === 1223) return `${name}: permissão de administrador negada.`;
  return `${name} falhou (código ${exitCode}).`;
}

function buildOrchestrator(steps, logPath) {
  const stamp = Date.now();
  const orchPath = path.join(path.dirname(logPath), `seq-${stamp}-${process.pid}.cmd`);
  const lines = [
    '@echo off',
    'chcp 65001 >nul',
    `set "MSO_LOG=${logPath}"`,
    `echo ${MARK_SEQ_START}>> "%MSO_LOG%"`
  ];
  steps.forEach((step, i) => {
    const ext = path.extname(step.path).toLowerCase();
    lines.push(`echo ${stepStartMark(i)}>> "%MSO_LOG%"`);
    let command;
    if (ext === '.reg') command = `reg import "${step.path}"`;
    else if (ext === '.ps1') {
      command = `powershell -NoProfile -NonInteractive -ExecutionPolicy Bypass -File "${step.path}"`;
    } else command = `call "${step.path}"`;
    // < nul evita travar em scripts com pause/choice; saída só no log.
    lines.push(`${command} < nul >> "%MSO_LOG%" 2>&1`);
    lines.push(`echo ${stepEndMark(i)}%errorlevel%>> "%MSO_LOG%"`);
  });
  lines.push(`echo ${MARK_SEQ_END}>> "%MSO_LOG%"`);
  fs.writeFileSync(orchPath, lines.join('\r\n') + '\r\n', 'utf8');
  return orchPath;
}

function launchElevated(orchPath) {
  // Elevação única e silenciosa via PowerShell (janela oculta).
  const psCommand =
    "$p = Start-Process -FilePath 'cmd.exe' " +
    `-ArgumentList '/c','\\"${orchPath}\\"' ` +
    '-Verb RunAs -WindowStyle Hidden -PassThru -Wait; exit $p.ExitCode';
  return spawnProc(psExe(), ['-NoProfile', '-NonInteractive', '-Command', psCommand], SEQUENCE_TIMEOUT_MS + 300000);
}

function launchNormal(orchPath) {
  return new Promise((resolve) => {
    const child = spawn('cmd.exe', ['/c', orchPath], { windowsHide: true });
    let settled = false;
    const timer = setTimeout(() => {
      if (!settled) { settled = true; child.kill(); resolve({ code: 1, error: 'A otimização demorou demais e foi interrompida.' }); }
    }, SEQUENCE_TIMEOUT_MS);
    child.on('error', (err) => { if (!settled) { settled = true; clearTimeout(timer); resolve({ code: 1, error: String(err.message || err) }); } });
    child.on('close', (code) => { if (!settled) { settled = true; clearTimeout(timer); resolve({ code: code == null ? 1 : code }); } });
  });
}

function psExe() {
  return path.join(process.env.SystemRoot || 'C:\\Windows', 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe');
}

function spawnProc(exe, args, timeoutMs) {
  return new Promise((resolve) => {
    const child = spawn(exe, args, { windowsHide: true });
    let settled = false;
    const finish = (r) => { if (!settled) { settled = true; clearTimeout(timer); resolve(r); } };
    const timer = setTimeout(() => { child.kill(); finish({ code: 1, error: 'Tempo esgotado ao elevar permissões.' }); }, timeoutMs);
    child.on('error', (err) => finish({ code: 1, error: `Não foi possível executar: ${err.message}` }));
    child.on('close', (code) => finish({ code: code == null ? 1 : code }));
  });
}

/**
 * Executa uma sequência [{name, path}] silenciosamente.
 * Retorna { results: [{name, ok, message}], logText, launchError }.
 */
async function runSteps(stepsInput, { onStepEnd } = {}) {
  if (!logsDir) throw new Error('LogsDir do runner não configurado.');
  const prepared = [];       // passos validados
  const resultMap = new Map(); // index em prepared -> resultado mutável
  const results = [];        // resultados na ordem original da entrada

  for (const step of stepsInput || []) {
    const v = validatePath(step.path);
    if (v.error) {
      results.push({ name: step.name, ok: false, message: v.error });
      if (onStepEnd) onStepEnd(step.name, false, v.error);
    } else {
      const entry = { name: step.name, ok: false, message: 'Aguardando' };
      resultMap.set(prepared.length, entry);
      prepared.push({ name: step.name, path: v.resolved });
      results.push(entry);
    }
  }
  if (!prepared.length) return { results, logText: '', launchError: null };

  const logPath = path.join(logsDir, `run-${Date.now()}.log`);
  const orchPath = buildOrchestrator(prepared, logPath);

  // Observador do arquivo de log: captura códigos de saída por passo.
  const seenEnd = new Set();
  let tailStop = false;
  const tailPromise = (async () => {
    while (!tailStop) {
      try {
        if (fs.existsSync(logPath)) {
          const text = fs.readFileSync(logPath, 'utf8');
          const re = /@@MSO_STEP_(\d+)_END@@(-?\d+)/g;
          let m;
          while ((m = re.exec(text)) !== null) {
            const idx = Number(m[1]);
            const code = Number(m[2]);
            if (!seenEnd.has(idx) && resultMap.has(idx)) {
              seenEnd.add(idx);
              const res = resultMap.get(idx);
              const ok = code === 0;
              res.ok = ok;
              res.message = ok ? `${res.name} concluído.` : friendlyError(code, res.name);
              if (onStepEnd) onStepEnd(res.name, ok, res.message);
            }
          }
          if (text.includes(MARK_SEQ_END)) break;
        }
      } catch (_) { /* arquivo pode estar em escrita */ }
      await new Promise((r) => setTimeout(r, 150));
    }
  })();

  let launch;
  if (isElevated()) {
    launch = await launchNormal(orchPath);
  } else {
    launch = await launchElevated(orchPath);
    if (launch.code === 1223) {
      launch.error = 'Execução cancelada — permissão de administrador negada.';
    }
  }

  tailStop = true;
  await Promise.race([tailPromise, new Promise((r) => setTimeout(r, 2000))]);

  // Passos sem STEP_END (UAC cancelado / falha geral).
  for (const [idx, res] of resultMap) {
    if (!seenEnd.has(idx)) {
      res.ok = false;
      res.message = launch.error || 'Não foi possível concluir este passo.';
      if (onStepEnd) onStepEnd(res.name, false, res.message);
    }
  }

  let logText = '';
  try { logText = fs.readFileSync(logPath, 'utf8'); } catch (_) { /* ignora */ }

  try { fs.rmSync(orchPath, { force: true }); } catch (_) { /* ignora */ }
  pruneLogs();

  return { results, logText, launchError: launch.error || null };
}

/** Executa um único script (.bat/.reg/.ps1). */
async function runSingle(name, file, opts) {
  const { results, logText } = await runSteps([{ name, path: file }], opts);
  return { result: results[0] || { name, ok: false, message: 'Falha desconhecida.' }, logText };
}

/**
 * Executa conteúdo PowerShell inline e devolve {code, stdout, stderr}.
 * Somente para comandos internos do aplicativo — nunca entrada do usuário.
 */
function runPowerShellInline(script, timeoutMs = 120000) {
  return new Promise((resolve) => {
    const child = spawn(
      psExe(),
      ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass',
        '-EncodedCommand', Buffer.from(script, 'utf16le').toString('base64')],
      { windowsHide: true }
    );
    let stdout = '';
    let stderr = '';
    let settled = false;
    const finish = (r) => { if (!settled) { settled = true; clearTimeout(timer); resolve(r); } };
    const timer = setTimeout(() => { child.kill(); finish({ code: 1, stdout, stderr, error: `PowerShell timeout após ${timeoutMs}ms` }); }, timeoutMs);
    child.stdout.on('data', (d) => { stdout += d.toString('utf8'); });
    child.stderr.on('data', (d) => { stderr += d.toString('utf8'); });
    child.on('error', (err) => finish({ code: 1, stdout, stderr, error: String(err.message || err) }));
    child.on('close', (code) => finish({ code: code == null ? 1 : code, stdout, stderr, error: null }));
  });
}

function pruneLogs(max = 30) {
  try {
    const logs = fs.readdirSync(logsDir)
      .filter((f) => f.startsWith('run-') && f.endsWith('.log'))
      .sort();
    for (const old of logs.slice(0, Math.max(0, logs.length - max))) {
      fs.rmSync(path.join(logsDir, old), { force: true });
    }
  } catch (_) { /* ignora */ }
}

module.exports = { setLogsDir, runSteps, runSingle, runPowerShellInline, isElevated, ALLOWED_SUFFIXES };
