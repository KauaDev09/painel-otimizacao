'use strict';

const { spawn, spawnSync } = require('child_process');
const path = require('path');
const fs = require('fs');
const os = require('os');

function psExe() {
  return path.join(process.env.SystemRoot || 'C:\\Windows', 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe');
}

function isElevated() {
  try {
    const out = spawnSync('net', ['session'], {
      windowsHide: true, timeout: 5000, encoding: 'utf8'
    });
    return out.status === 0;
  } catch (_) {
    return false;
  }
}

function runHidden(exe, args, timeoutMs) {
  return new Promise((resolve) => {
    const child = spawn(exe, args, { windowsHide: true });
    let stdout = '';
    let stderr = '';
    let settled = false;
    const finish = (r) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(r);
    };
    const timer = setTimeout(() => {
      try { child.kill(); } catch (_) { /* ignore */ }
      finish({ code: 1, stdout, stderr, error: 'Tempo esgotado.' });
    }, timeoutMs);
    child.stdout.on('data', (d) => { stdout += d.toString('utf8'); });
    child.stderr.on('data', (d) => { stderr += d.toString('utf8'); });
    child.on('error', (err) => finish({ code: 1, stdout, stderr, error: err.message }));
    child.on('close', (code) => finish({ code: code == null ? 1 : code, stdout, stderr }));
  });
}

// Executa SOMENTE o comando informado, com UAC pontual.
// O comando é montado internamente — nunca vem da UI.
async function runElevatedCommand(commandLine, timeoutMs = 60000) {
  if (isElevated()) {
    return runHidden('cmd.exe', ['/c', commandLine], timeoutMs);
  }
  const stamp = Date.now();
  const scriptPath = path.join(os.tmpdir(), `orion-bios-${stamp}-${process.pid}.cmd`);
  fs.writeFileSync(scriptPath, `@echo off\r\nchcp 65001 >nul\r\n${commandLine}\r\nexit /b %errorlevel%\r\n`, 'utf8');
  const psCommand =
    "$p = Start-Process -FilePath 'cmd.exe' " +
    `-ArgumentList '/c','"${scriptPath}"' ` +
    '-Verb RunAs -WindowStyle Hidden -PassThru -Wait; exit $p.ExitCode';
  const result = await runHidden(psExe(), ['-NoProfile', '-NonInteractive', '-Command', psCommand], timeoutMs + 30000);
  try { fs.unlinkSync(scriptPath); } catch (_) { /* ignore */ }
  if (result.code === 1223) {
    result.error = result.error || 'Permissão de administrador negada.';
  }
  return result;
}

module.exports = { isElevated, runHidden, runElevatedCommand };
