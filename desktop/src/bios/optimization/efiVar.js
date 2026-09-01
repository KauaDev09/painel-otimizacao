'use strict';

// Módulo de escrita de variáveis EFI (NVRAM) para otimizações de firmware.
//
// Regras de segurança (obrigatórias):
//   1. NUNCA gravar uma variável que não tenha sido lida antes (sem backup não há apply).
//   2. Só há apply quando existe um OFFSET VERIFICADO para a placa na base de offsets.
//      A base vem de `efiOffsets.json` em userData/bios — offsets não são inventados aqui.
//   3. Todo apply é byte-exato e reversível: os bytes originais ficam no snapshot e
//      o rollback restaura exatamente o que havia antes.
//   4. Após gravar, o módulo relê a variável; se o resultado não bater com o esperado,
//      restaura os bytes originais automaticamente e reporta falha.
//   5. Se a API do Windows rejeitar a leitura/escrita, o módulo falha de forma
//      segura — nunca continua "às cegas".

const fs = require('fs');
const os = require('os');
const path = require('path');
const { runHidden, runElevatedCommand } = require('./elevation');

const AMI_SETUP_GUID = '{E2C95E0B-5A9F-46D5-BE6A-70A6BA6F5A53}';
const INSYDE_SETUP_GUID = '{8BE4DF61-93CA-11D2-AA0D-00E098032B8C}';
const VAR_ATTRS = 0x7; // EFI_VARIABLE_NON_VOLATILE | BOOTSERVICE_ACCESS | RUNTIME_ACCESS

// Variável de setup onde cada otimização costuma residir. O OFFSET dentro da
// variável é o que determina o bit — é isso que vem da base de offsets.
const ITEM_VARS = {
  xmp: 'MemSetup',
  expo: 'MemSetup',
  docp: 'MemSetup',
  above_4g: 'PchSetup',
  resizable_bar: 'SaSetup',
  csm: 'Setup',
  secure_boot: 'Setup',
  cpb: 'CpuSetup',
  virtualization: 'CpuSetup'
};

const PROBE_VARS = ['Setup', 'CpuSetup', 'SaSetup', 'PchSetup', 'MemSetup'];

let offsetsDir = null;
let configCache = null;

// ---------------------------------------------------------------------------
// Base de offsets.
// Estrutura de cada entrada:
//   { item, board (regex, opcional), variable, offset, size, andMask, value, note }
// Exemplo (fictício — só ilustra o formato; valores reais exigem engenharia reversa
// da BIOS instalada e NÃO são fornecidos por padrão):
//   { item: 'resizable_bar', board: 'B650 AORUS', variable: 'SaSetup',
//     offset: 0x450F, size: 1, andMask: 0xFE, value: 0x01, note: 'offset comunidade' }
const DEFAULT_OFFSETS = [];

function setBiosDir(dir) {
  offsetsDir = dir || null;
  configCache = null;
}

function loadOffsets() {
  if (configCache) return configCache;
  const merged = [...DEFAULT_OFFSETS];
  if (offsetsDir) {
    const cfg = path.join(offsetsDir, 'efiOffsets.json');
    try {
      if (fs.existsSync(cfg)) {
        const parsed = JSON.parse(fs.readFileSync(cfg, 'utf8'));
        if (Array.isArray(parsed.offsets)) merged.push(...parsed.offsets);
      }
    } catch (_) {
      /* config inválida é ignorada — nunca derruba o app */
    }
  }
  configCache = merged;
  return merged;
}

function offsetFor(itemId, board) {
  const boardStr = String(board || '');
  const entries = loadOffsets().filter((e) => e && e.item === itemId);
  for (const e of entries) {
    if (e.board) {
      try {
        if (!new RegExp(e.board, 'i').test(boardStr)) continue;
      } catch (_) {
        continue;
      }
    }
    return e;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Scripts PowerShell (P/Invoke nas APIs nativas de firmware).
// Usa aspas simples no JS para que os `$`/`{}` do PowerShell fiquem literais.

function readScriptText() {
  return [
    'param([string]$Names, [string]$Guid)',
    '$ErrorActionPreference = "SilentlyContinue"',
    'Add-Type -TypeDefinition @\"',
    'using System;',
    'using System.Runtime.InteropServices;',
    'public static class FWEnv {',
    '  [DllImport("kernel32.dll", SetLastError=true, CharSet=CharSet.Unicode, EntryPoint="GetFirmwareEnvironmentVariableW")]',
    '  public static extern uint GetFirmwareEnvironmentVariableW(string lpName, string lpGuid, byte[] pBuffer, uint nSize);',
    '}',
    '\"@',
    'function Read-Var([string]$Name, [string]$Guid) {',
    '  $size = 65536',
    '  $buf = New-Object byte[] $size',
    '  $hr = [FWEnv]::GetFirmwareEnvironmentVariableW($Name, $Guid, $buf, $size)',
    '  if ($hr -eq 0) {',
    '    $err = [System.Runtime.InteropServices.Marshal]::GetLastWin32Error()',
    '    Write-Output ("ERR:" + $Name + ":" + $err)',
    '    return',
    '  }',
    '  $out = New-Object byte[] $hr',
    '  [Array]::Copy($buf, $out, $hr)',
    '  $sb = New-Object System.Text.StringBuilder',
    '  foreach ($b in $out) { [void]$sb.Append($b.ToString("x2")) }',
    '  Write-Output ("READ:" + $Name + ":" + $out.Length + ":" + $sb.ToString())',
    '}',
    'foreach ($n in $Names.Split(",")) {',
    '  if ($n.Trim().Length -gt 0) { Read-Var $n.Trim() $Guid }',
    '}',
    'exit 0',
    ''
  ].join('\r\n');
}

// Script elevado e ATÔMICO: lê a variável, aplica o offset, grava e confere.
// Devolve o hex original e o novo para persistir como snapshot com rollback real.
function applyScriptText() {
  return [
    'param([string]$Name, [string]$Guid, [int]$Offset, [int]$Size, [string]$AndMask, [string]$Value, [int]$Attrs)',
    '$ErrorActionPreference = "Stop"',
    'Add-Type -TypeDefinition @\"',
    'using System;',
    'using System.Runtime.InteropServices;',
    'public static class FWA {',
    '  [DllImport("kernel32.dll", SetLastError=true, CharSet=CharSet.Unicode, EntryPoint="GetFirmwareEnvironmentVariableW")]',
    '  public static extern uint GetFirmwareEnvironmentVariableW(string lpName, string lpGuid, byte[] pBuffer, uint nSize);',
    '  [DllImport("kernel32.dll", SetLastError=true, CharSet=CharSet.Unicode, EntryPoint="SetFirmwareEnvironmentVariableExW")]',
    '  public static extern uint SetFirmwareEnvironmentVariableExW(string lpName, string lpGuid, byte[] pBuffer, uint nSize, uint dwAttributes);',
    '}',
    '\"@',
    'function Get-Hex([string]$n, [string]$g) {',
    '  $size = 65536',
    '  $buf = New-Object byte[] $size',
    '  $hr = [FWA]::GetFirmwareEnvironmentVariableW($n, $g, $buf, $size)',
    '  if ($hr -eq 0) { return $null }',
    '  $out = New-Object byte[] $hr',
    '  [Array]::Copy($buf, $out, $hr)',
    '  $sb = New-Object System.Text.StringBuilder',
    '  foreach ($b in $out) { [void]$sb.Append($b.ToString("x2")) }',
    '  return $sb.ToString()',
    '}',
    'function Set-Hex([string]$n, [string]$g, [string]$hex, [int]$attrs) {',
    '  $bytes = New-Object byte[] ($hex.Length / 2)',
    '  for ($i = 0; $i -lt $bytes.Length; $i++) { $bytes[$i] = [Convert]::ToByte($hex.Substring($i * 2, 2), 16) }',
    '  $hr = [FWA]::SetFirmwareEnvironmentVariableExW($n, $g, $bytes, [uint32]$bytes.Length, [uint32]$attrs)',
    '  return ($hr -ne 0)',
    '}',
    'function Hex-At([string]$hex, [int]$off, [int]$sz) {',
    '  $v = [int64]0',
    '  for ($i = 0; $i -lt $sz; $i++) {',
    '    $b = [int64][Convert]::ToByte($hex.Substring(($off + $i) * 2, 2), 16)',
    '    $v = $v -bor ($b -shl (8 * $i))',
    '  }',
    '  return $v',
    '}',
    'function Set-At([string]$hex, [int]$off, [int]$sz, [int64]$val) {',
    '  $bytes = New-Object byte[] ($hex.Length / 2)',
    '  for ($i = 0; $i -lt $bytes.Length; $i++) { $bytes[$i] = [Convert]::ToByte($hex.Substring($i * 2, 2), 16) }',
    '  for ($i = 0; $i -lt $sz; $i++) {',
    '    $b = [int](($val -shr (8 * $i)) -band 0xff)',
    '    $bytes[$off + $i] = [byte]$b',
    '  }',
    '  $sb = New-Object System.Text.StringBuilder',
    '  foreach ($b in $bytes) { [void]$sb.Append($b.ToString("x2")) }',
    '  return $sb.ToString()',
    '}',
    '$hex = Get-Hex $Name $Guid',
    'if ($null -eq $hex) {',
    '  $err = [System.Runtime.InteropServices.Marshal]::GetLastWin32Error()',
    '  Write-Output ("ERR:READ:" + $err)',
    '  exit 1',
    '}',
    '$sizeMask = [int64]1',
    'for ($i = 0; $i -lt (8 * $Size); $i++) { $sizeMask = ($sizeMask -shl 1) -bor 1 }',
    '$cur = Hex-At $hex $Offset $Size',
    '$am = [int64]([Convert]::ToInt64($AndMask, 10)) -band $sizeMask',
    '$vl = [int64]([Convert]::ToInt64($Value, 10)) -band $sizeMask',
    '$next = ($cur -band $am) -bor $vl',
    'if ($next -eq $cur) {',
    '  Write-Output ("UNCHANGED:" + $hex)',
    '  exit 0',
    '}',
    '$newHex = Set-At $hex $Offset $Size $next',
    'if (-not (Set-Hex $Name $Guid $newHex $Attrs)) {',
    '  $err2 = [System.Runtime.InteropServices.Marshal]::GetLastWin32Error()',
    '  Write-Output ("ERR:WRITE:" + $err2)',
    '  exit 1',
    '}',
    '$after = Get-Hex $Name $Guid',
    'if ($null -ne $after -and $after -eq $newHex) {',
    '  Write-Output ("RESULT:" + $hex + ":" + $newHex)',
    '  exit 0',
    '}',
    '[void](Set-Hex $Name $Guid $hex $Attrs)',
    'Write-Output "ERRVERIFY"',
    'exit 1',
    ''
  ].join('\r\n');
}

// Restauração elevada: grava os bytes originais e confere a leitura pós-escrita.
function restoreScriptText() {
  return [
    'param([string]$Name, [string]$Guid, [string]$BytesHex, [int]$Attrs)',
    '$ErrorActionPreference = "Stop"',
    'Add-Type -TypeDefinition @\"',
    'using System;',
    'using System.Runtime.InteropServices;',
    'public static class FWR {',
    '  [DllImport("kernel32.dll", SetLastError=true, CharSet=CharSet.Unicode, EntryPoint="GetFirmwareEnvironmentVariableW")]',
    '  public static extern uint GetFirmwareEnvironmentVariableW(string lpName, string lpGuid, byte[] pBuffer, uint nSize);',
    '  [DllImport("kernel32.dll", SetLastError=true, CharSet=CharSet.Unicode, EntryPoint="SetFirmwareEnvironmentVariableExW")]',
    '  public static extern uint SetFirmwareEnvironmentVariableExW(string lpName, string lpGuid, byte[] pBuffer, uint nSize, uint dwAttributes);',
    '}',
    '\"@',
    'function Get-Hex([string]$n, [string]$g) {',
    '  $size = 65536',
    '  $buf = New-Object byte[] $size',
    '  $hr = [FWR]::GetFirmwareEnvironmentVariableW($n, $g, $buf, $size)',
    '  if ($hr -eq 0) { return $null }',
    '  $out = New-Object byte[] $hr',
    '  [Array]::Copy($buf, $out, $hr)',
    '  $sb = New-Object System.Text.StringBuilder',
    '  foreach ($b in $out) { [void]$sb.Append($b.ToString("x2")) }',
    '  return $sb.ToString()',
    '}',
    'function Set-Hex([string]$n, [string]$g, [string]$hex, [int]$attrs) {',
    '  $bytes = New-Object byte[] ($hex.Length / 2)',
    '  for ($i = 0; $i -lt $bytes.Length; $i++) { $bytes[$i] = [Convert]::ToByte($hex.Substring($i * 2, 2), 16) }',
    '  $hr = [FWR]::SetFirmwareEnvironmentVariableExW($n, $g, $bytes, [uint32]$bytes.Length, [uint32]$attrs)',
    '  return ($hr -ne 0)',
    '}',
    '$hex = $BytesHex.Trim()',
    'if (($hex.Length % 2) -ne 0) { Write-Output "ERR:oddhex"; exit 1 }',
    'if (-not (Set-Hex $Name $Guid $hex $Attrs)) {',
    '  $err = [System.Runtime.InteropServices.Marshal]::GetLastWin32Error()',
    '  Write-Output ("ERRWRITE:" + $err)',
    '  exit 1',
    '}',
    '$after = Get-Hex $Name $Guid',
    'if ($null -ne $after -and $after -eq $hex) { Write-Output "OK"; exit 0 }',
    'Write-Output "ERRVERIFY"',
    'exit 1',
    ''
  ].join('\r\n');
}

function writeTempScript(scriptText) {
  const p = path.join(os.tmpdir(), `orion-efi-${Date.now()}-${process.pid}-${Math.random().toString(16).slice(2)}.ps1`);
  fs.writeFileSync(p, scriptText, 'utf8');
  return p;
}

function psExe() {
  return path.join(process.env.SystemRoot || 'C:\\Windows', 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe');
}

function parseVarLine(line) {
  const m = String(line).match(/^READ:([^:]+):(\d+):([0-9a-f]+)$/i);
  if (m) return { name: m[1], size: Number(m[2]), bytesHex: m[3].toLowerCase() };
  return null;
}

function parseErrLine(line) {
  const m = String(line).match(/^ERR:([^:]+):(.+)$/);
  if (m) return { name: m[1], code: m[2].trim() };
  return null;
}

async function runPsRead(names, guid) {
  const scriptPath = writeTempScript(readScriptText());
  try {
    const result = await runHidden(
      psExe(),
      ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-NonInteractive', '-File', scriptPath, '-Names', names.join(','), '-Guid', guid],
      30000
    );
    if (result.code !== 0 && !(/READ:|ERR:/).test(result.stdout)) {
      return { ok: false, error: result.error || `Firmware scan falhou (código ${result.code}).` };
    }
    const out = {};
    const lines = String(result.stdout || '').split(/\r?\n/);
    for (const line of lines) {
      const r = parseVarLine(line);
      if (r) {
        out[r.name.toLowerCase()] = { readable: true, size: r.size, bytesHex: r.bytesHex };
        continue;
      }
      const e = parseErrLine(line);
      if (e) out[e.name.toLowerCase()] = { readable: false, errorCode: e.code };
    }
    return { ok: true, vars: out };
  } finally {
    try { fs.unlinkSync(scriptPath); } catch (_) { /* ignore */ }
  }
}

async function runPsApply(name, guid, entry, attrs) {
  const scriptPath = writeTempScript(applyScriptText());
  try {
    const andMask = entry.andMask == null ? -1 : Number(entry.andMask) & 0xffffffff;
    const commandLine =
      `powershell.exe -NoProfile -ExecutionPolicy Bypass -NonInteractive -File "${scriptPath}" ` +
      `-Name ${name} -Guid ${guid} -Offset ${Number(entry.offset)} -Size ${Number(entry.size) || 1} ` +
      `-AndMask ${andMask} -Value ${Number(entry.value) & 0xffffffff} -Attrs ${attrs}`;
    const result = await runElevatedCommand(commandLine, 90000);
    const text = String(result.stdout || '');
    const res = (/^RESULT:([0-9a-f]+):([0-9a-f]+)$/im).exec(text);
    if (res) {
      return { ok: true, originalBytesHex: res[1], bytesHex: res[2] };
    }
    if (/^UNCHANGED:([0-9a-f]+)$/im.test(text)) {
      const m = (/^UNCHANGED:([0-9a-f]+)$/im).exec(text);
      return { ok: true, unchanged: true, originalBytesHex: m[1], bytesHex: m[1] };
    }
    if (/^ERRVERIFY/im.test(text)) {
      return { ok: false, restored: true, error: 'A gravação NVRAM não foi confirmada — bytes originais restaurados.' };
    }
    if (/^ERR:READ:(\d+)/im.test(text)) {
      const m = (/^ERR:READ:(\d+)/im).exec(text);
      return { ok: false, error: `O firmware recusou a leitura da variável (erro ${m[1]}). Nada foi alterado.` };
    }
    if (/^ERR:WRITE:(\d+)/im.test(text)) {
      const m = (/^ERR:WRITE:(\d+)/im).exec(text);
      return { ok: false, error: `O firmware recusou a gravação (erro ${m[1]}). Nada foi alterado.` };
    }
    return { ok: false, error: result.error || `Aplicação NVRAM falhou (código ${result.code}).'` };
  } finally {
    try { fs.unlinkSync(scriptPath); } catch (_) { /* ignore */ }
  }
}

async function runPsRestore(name, guid, bytesHex, attrs) {
  const scriptPath = writeTempScript(restoreScriptText());
  try {
    const commandLine =
      `powershell.exe -NoProfile -ExecutionPolicy Bypass -NonInteractive -File "${scriptPath}" ` +
      `-Name ${name} -Guid ${guid} -BytesHex ${bytesHex} -Attrs ${attrs}`;
    const result = await runElevatedCommand(commandLine, 60000);
    const text = String(result.stdout || '');
    if (/^OK/im.test(text)) return { ok: true };
    const m = (/^ERRWRITE:(\d+)/im).exec(text);
    if (m) return { ok: false, error: `O firmware recusou a restauração da NVRAM (erro ${m[1]}).` };
    return { ok: false, error: 'A restauração NVRAM foi gravada, mas a conferência não confirmou os bytes iniciais.' };
  } finally {
    try { fs.unlinkSync(scriptPath); } catch (_) { /* ignore */ }
  }
}

// ---------------------------------------------------------------------------
// Aplicação de offset byte-exata (little-endian).

function applyOffset(bytesHex, entry) {
  const bytes = Buffer.from(bytesHex, 'hex');
  const offset = Number(entry.offset);
  const size = Number(entry.size) || 1;
  if (!Number.isFinite(offset) || offset < 0 || offset + size > bytes.length) {
    return { ok: false, error: 'Offset fora dos limites da variável de firmware.' };
  }
  const sizeMask = size === 4 ? 0xffffffff : (size === 2 ? 0xffff : 0xff);
  let current = 0;
  for (let i = 0; i < size; i++) current |= bytes[offset + i] << (8 * i);
  const andMask = entry.andMask == null ? sizeMask : (Number(entry.andMask) & sizeMask);
  const value = (Number(entry.value) & sizeMask) | 0;
  const next = (current & andMask) | value;
  if (next === current) {
    return { ok: true, bytesHex, unchanged: true, size, offset };
  }
  const out = Buffer.from(bytes);
  for (let i = 0; i < size; i++) out[offset + i] = (next >> (8 * i)) & 0xff;
  return { ok: true, bytesHex: out.toString('hex'), unchanged: false, size, offset };
}

// ---------------------------------------------------------------------------
// Probe de capacidade (usado no scan).

function firmwareVendor(scan) {
  const vendor = String(((scan && scan.profile && scan.profile.bios) || {}).vendor || '').toLowerCase();
  if (/insyde/.test(vendor)) return 'insyde';
  if (/american megatrends|ami|award|phoenix/i.test(vendor)) return 'ami';
  return 'ami';
}

function probeGuids(scan) {
  const vendor = firmwareVendor(scan);
  return vendor === 'insyde' ? [INSYDE_SETUP_GUID] : [AMI_SETUP_GUID, INSYDE_SETUP_GUID];
}

async function probeVariables(scan) {
  const PRIVILEGE_ERRS = new Set(['5', '1314', '998', '1300']);
  const results = [{ ok: false, vars: {} }];
  let privilegeLimited = false;
  for (const guid of probeGuids(scan)) {
    const r = await runPsRead(PROBE_VARS, guid);
    results.push(r);
    r.guid = guid;
    const errs = Object.keys(r.vars).map((k) => r.vars[k].errorCode).filter(Boolean);
    if (errs.length && errs.every((c) => PRIVILEGE_ERRS.has(String(c)))) privilegeLimited = true;
    if (r.ok && Object.keys(r.vars).length) {
      const readableSome = Object.keys(r.vars).some((k) => r.vars[k].readable);
      if (readableSome) return r;
      privilegeLimited = true;
    }
  }
  const readable = results.filter((r2) => r2.ok && Object.keys(r2.vars).length);
  if (readable.length) return Object.assign(readable[0], { privilegeLimited });
  const last = results[results.length - 1];
  return {
    ok: last.ok,
    vars: {},
    privilegeLimited,
    error: last.error || (privilegeLimited ? 'Privilégio insuficiente para ler variáveis de firmware (será lido no apply elevado).' : 'Firmware não expõe variáveis de setup via Windows.')
  };
}

async function probeCapabilities(scan) {
  const probe = await probeVariables(scan);
  const board = (scan.profile && scan.profile.motherboard && scan.profile.motherboard.boardProduct) || '';
  const out = {};
  for (const itemId of Object.keys(ITEM_VARS)) {
    const offset = offsetFor(itemId, board);
    const varName = offset && offset.variable ? offset.variable : (ITEM_VARS[itemId] || 'Setup');
    const info = probe.vars[varName.toLowerCase()];

    if (offset) {
      const readableNow = Boolean(probe.ok && info && info.readable);
      if (readableNow || probe.privilegeLimited) {
        out[itemId] = {
          ok: true,
          mode: 'auto',
          requiresAdmin: true,
          variable: varName,
          guid: probe.guid,
          offset,
          reason: readableNow
            ? 'NVRAM de setup exposta com offset verificado. Alteração byte-exata com rollback automático.'
            : 'NVRAM com offset verificado; a aplicação é feita com privilégio elevado e checada antes de gravar.'
        };
        continue;
      }
    }

    if (!offset) {
      out[itemId] = {
        ok: false,
        mode: 'manual',
        reason: probe.privilegeLimited
          ? 'Não há offset verificado para esta placa na base NVRAM.'
          : 'Seria necessário um offset verificado na base NVRAM para automatizar esta opção.'
      };
      continue;
    }
    out[itemId] = {
      ok: false,
      mode: 'manual',
      reason: 'A variável de setup desta BIOS não foi exposta ao Windows — alteração manual necessária.'
    };
  }
  return out;
}

// ---------------------------------------------------------------------------
// Apply / restore (chamados pelos providers).

async function applyEfi(itemId, scan, ctx) {
  const cap = (scan && scan.efiCap && scan.efiCap[itemId]) || null;
  if (!cap || !cap.ok || cap.mode !== 'auto' || !cap.offset) {
    const err = new Error('Aplicação via NVRAM indisponível para esta placa.');
    err.code = 'MANUAL_ONLY';
    throw err;
  }
  if (ctx && ctx.mock) {
    return { ok: true, message: `NVRAM ${cap.variable} modificada (mock).` };
  }
  const result = await runPsApply(cap.variable, cap.guid, cap.offset, VAR_ATTRS);
  if (!result.ok) {
    return { ok: false, message: result.error };
  }
  if (result.unchanged) {
    return {
      ok: true,
      message: 'A configuração já está como solicitado na NVRAM (sem alteração necessária).',
      unchanged: true
    };
  }
  return {
    ok: true,
    message: `NVRAM ${cap.variable} modificada (offset 0x${Number(cap.offset.offset).toString(16)}). Reinicie para validar.`,
    snapshot: {
      type: 'efi_var',
      variable: cap.variable,
      guid: cap.guid,
      offset: cap.offset,
      originalBytesHex: result.originalBytesHex,
      bytesHex: result.bytesHex
    }
  };
}

async function restoreEfi(snapshot, ctx) {
  if (!snapshot || snapshot.type !== 'efi_var' || !snapshot.originalBytesHex) {
    return { ok: false, manual: true, message: 'Rollback manual — reverta a opção na BIOS.' };
  }
  if (ctx && ctx.mock) {
    return { ok: true, message: 'Rollback NVRAM restaurado (mock).' };
  }
  const written = await runPsRestore(snapshot.variable, snapshot.guid, snapshot.originalBytesHex, VAR_ATTRS);
  return {
    ok: written.ok,
    message: written.ok
      ? `NVRAM ${snapshot.variable} restaurada ao estado original.`
      : (written.error || 'Restauração NVRAM não confirmada.')
  };
}

module.exports = {
  AMI_SETUP_GUID,
  INSYDE_SETUP_GUID,
  ITEM_VARS,
  setBiosDir,
  loadOffsets,
  offsetFor,
  applyOffset,
  probeCapabilities,
  applyEfi,
  restoreEfi,
  firmwareVendor,
  readScriptText,
  applyScriptText,
  restoreScriptText,
  runPsRead,
  runPsApply,
  runPsRestore
};