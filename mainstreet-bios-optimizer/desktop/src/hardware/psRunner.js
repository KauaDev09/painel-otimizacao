'use strict';

// Executa PowerShell (Windows PowerShell 5.1, presente no Windows 10/11) sem perfil,
// nao-interativo. O coletor e somente-leitura: apenas consultas CIM/WMI e leitura
// de chaves de registro. Nenhum comando de escrita e executado.

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const COLLECTOR_PATH = path.join(__dirname, 'collector.ps1');
const TIMEOUT_MS = 60000;

function toEncodedCommand(script) {
  return Buffer.from(script, 'utf16le').toString('base64');
}

function runPowerShell(script, timeoutMs = TIMEOUT_MS) {
  return new Promise((resolve, reject) => {
    const child = spawn(
      path.join(process.env.SystemRoot || 'C:\\Windows', 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe'),
      ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-EncodedCommand', toEncodedCommand(script)],
      { windowsHide: true }
    );

    let stdout = '';
    let stderr = '';
    let settled = false;

    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      child.kill();
      reject(new Error(`PowerShell timeout apos ${timeoutMs}ms`));
    }, timeoutMs);

    child.stdout.on('data', (d) => { stdout += d.toString('utf8'); });
    child.stderr.on('data', (d) => { stderr += d.toString('utf8'); });
    child.on('error', (err) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      reject(err);
    });
    child.on('close', () => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve({ stdout, stderr });
    });
  });
}

const CRITICAL_SECTIONS = ['cpu', 'system', 'board', 'bios', 'ram', 'gpu', 'os', 'osreg'];

function sectionHasData(v) {
  if (Array.isArray(v)) return v.length > 0 && Object.values(v[0] || {}).some((x) => x !== null);
  if (v && typeof v === 'object') return Object.values(v).some((x) => x !== null);
  return false;
}

function missingCritical(data) {
  return CRITICAL_SECTIONS.filter((k) => !sectionHasData(data[k]));
}

async function collectAll(log = () => {}) {
  const script = fs.readFileSync(COLLECTOR_PATH, 'utf8');

  // O serviço WMI/CIM pode falhar transitoriamente em algumas sessões; repete a
  // coleta inteira até obter as seções críticas ou esgotar as tentativas.
  // Falhas por seção ficam registradas em __errors para diagnóstico honesto.
  let lastData = null;
  let lastErr = null;
  const maxAttempts = 3;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    log(`Consultando CIM/WMI via PowerShell (tentativa ${attempt}/${maxAttempts})...`);
    try {
      const { stdout, stderr } = await runPowerShell(script);
      if (!stdout || !stdout.trim().startsWith('{')) {
        throw new Error(`Coletor não retornou JSON. stderr: ${stderr.slice(0, 300)}`);
      }
      const data = JSON.parse(stdout.trim());
      lastData = data;
      const missing = missingCritical(data);
      if (missing.length === 0) return data;
      log(`Seções sem dados: ${missing.join(', ')} — repetindo...`);
      lastErr = new Error(`Seções críticas ausentes: ${missing.join(', ')}. Erros: ${JSON.stringify(data.__errors || {}).slice(0, 400)}`);
    } catch (e) {
      lastErr = e;
      log('Coleta incompleta, repetindo...');
    }
    await new Promise((r) => setTimeout(r, 1000));
  }

  // Não falha o aplicativo inteiro: retorna o melhor resultado obtido.
  // As seções ausentes aparecerão como "Não foi possível determinar".
  if (lastData) {
    log(`Aviso: coleta parcial (${lastErr ? lastErr.message.slice(0, 200) : ''})`);
    return lastData;
  }
  throw lastErr;
}

function queryNvidiaSmi(timeoutMs = 8000) {
  return new Promise((resolve) => {
    try {
      const child = spawn('nvidia-smi', [
        '--query-gpu=name,pcie.link.gen.current,pcie.link.gen.max,pcie.link.width.current,pcie.link.width.max,driver_version,memory.total',
        '--format=csv,noheader'
      ], { windowsHide: true });
      let out = '';
      let done = false;
      const t = setTimeout(() => { if (!done) { done = true; child.kill(); resolve(null); } }, timeoutMs);
      child.stdout.on('data', (d) => { out += d.toString(); });
      child.on('error', () => { if (!done) { done = true; clearTimeout(t); resolve(null); } });
      child.on('close', (code) => {
        if (done) return;
        done = true;
        clearTimeout(t);
        resolve(code === 0 && out.trim() ? out : null);
      });
    } catch (_) {
      resolve(null);
    }
  });
}

module.exports = { collectAll, queryNvidiaSmi, runPowerShell };
