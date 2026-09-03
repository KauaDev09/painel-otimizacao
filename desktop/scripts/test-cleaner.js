'use strict';

const { spawnSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const psExe = path.join(process.env.SystemRoot || 'C:\\Windows', 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe');

const runner = require('../src/engine/runner');
const cleaner = require('../src/engine/cleanerService');
const repair = require('../src/engine/repairService');

async function main() {
  const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'orion-cleaner-test-'));
  const logsDir = path.join(tmpRoot, 'logs');
  runner.setLogsDir(logsDir);

  const work = runner.getWorkDir();
  const tempPrefix = path.resolve(os.tmpdir()).toLowerCase();
  if (path.resolve(work).toLowerCase().startsWith(tempPrefix + path.sep) ||
      path.resolve(work).toLowerCase() === tempPrefix) {
    throw new Error(`workDir não pode ficar no TEMP: ${work}`);
  }

  const origRunSteps = runner.runSteps;
  let captured = null;
  runner.runSteps = async (steps) => {
    captured = steps;
    for (const s of steps) {
      if (!fs.existsSync(s.path)) throw new Error(`script ausente: ${s.path}`);
      const resolved = path.resolve(s.path);
      const resolvedLc = resolved.toLowerCase();
      if (resolvedLc === tempPrefix || resolvedLc.startsWith(tempPrefix + path.sep)) {
        throw new Error(`script gravado no TEMP: ${resolved}`);
      }
      const rel = path.relative(work, resolved);
      if (rel.startsWith('..') || path.isAbsolute(rel)) {
        throw new Error(`script fora do workDir: ${resolved}`);
      }
      const text = fs.readFileSync(s.path, 'utf8');
      if (!/exit 0/i.test(text)) throw new Error(`script sem exit 0: ${s.path}`);
      if (/Cache DNS|Lixeira/.test(s.name)) {
        const r = spawnSync(psExe, [
          '-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', s.path
        ], { windowsHide: true, encoding: 'utf8', timeout: 30000 });
        if (r.status !== 0) {
          throw new Error(`${s.name} saiu ${r.status}: ${(r.stderr || r.stdout || '').slice(0, 400)}`);
        }
      }
    }
    return {
      results: steps.map((s) => ({ name: s.name, ok: true, message: `${s.name} concluído.` })),
      launchError: null
    };
  };

  const ids = cleaner.listTargets().map((t) => t.id);
  const res = await cleaner.clean(ids);
  if (!res.ok) throw new Error('clean() deveria retornar ok com runSteps mockado');
  if (!captured || captured.length !== ids.length) throw new Error('passos incompletos');

  const last = captured[captured.length - 1];
  if (last.name !== 'Arquivos temporários do usuário') {
    throw new Error(`temp.user deve ser o último passo, veio: ${last.name}`);
  }

  const origRepairSteps = runner.runSteps;
  runner.runSteps = async (steps) => {
    for (const s of steps) {
      if (!fs.existsSync(s.path)) throw new Error(`repair script ausente: ${s.path}`);
      if (path.resolve(s.path).toLowerCase().startsWith(tempPrefix)) {
        throw new Error(`repair script no TEMP: ${s.path}`);
      }
    }
    return { results: steps.map((s) => ({ name: s.name, ok: true })), launchError: null };
  };
  const repairRes = await repair.runRepair('repair.sfc');
  if (!repairRes.ok) throw new Error('runRepair mock falhou');
  runner.runSteps = origRepairSteps;

  runner.runSteps = origRunSteps;

  const sizes = await cleaner.measureTargets(ids);
  for (const id of ids) {
    if (!(id in sizes)) throw new Error(`medida ausente: ${id}`);
    if (sizes[id] != null && !(Number.isFinite(sizes[id]) && sizes[id] >= 0)) {
      throw new Error(`medida inválida ${id}=${sizes[id]}`);
    }
  }

  fs.rmSync(tmpRoot, { recursive: true, force: true });
  console.log('ok', {
    workDir: work,
    measured: Object.fromEntries(ids.map((id) => [id, sizes[id]]))
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
