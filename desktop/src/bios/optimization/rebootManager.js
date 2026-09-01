'use strict';

const { runElevatedCommand, isElevated } = require('./elevation');

async function requestReboot({ delaySec = 5, comment = 'Orion Optimizer — verificação de BIOS após reinício' } = {}) {
  const sec = Math.max(3, Math.min(60, Number(delaySec) || 5));
  const safeComment = String(comment).replace(/["&|<>^]/g, ' ').slice(0, 80);
  const cmd = `shutdown /r /t ${sec} /c "${safeComment}"`;
  const result = await runElevatedCommand(cmd, 20000);
  return {
    ok: result.code === 0,
    elevated: isElevated(),
    message: result.code === 0
      ? `Reinicialização solicitada (${sec}s).`
      : (result.error || `Falha ao solicitar reinício (código ${result.code}).`)
  };
}

module.exports = { requestReboot };
