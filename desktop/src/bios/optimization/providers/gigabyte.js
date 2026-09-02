'use strict';

const { BaseBiosProvider } = require('./base');

class GigabyteProvider extends BaseBiosProvider {
  constructor() {
    super('gigabyte', 'Gigabyte');
  }

  matches(scan) {
    const key = scan.profile && scan.profile.motherboard && scan.profile.motherboard.vendorKey;
    return key === 'gigabyte';
  }

  canApply(item, scan) {
    const base = super.canApply(item, scan);
    if (item.id === 'high_performance_plan') return base;
    if (base.ok) return base;
    const board = (scan.profile && scan.profile.motherboard && scan.profile.motherboard.boardProduct) || '';
    const note = /A520M\s*K\s*V2/i.test(board)
      ? 'Gigabyte A520M K V2: a UEFI não expõe API documentada para XMP/ReBAR a partir do Windows. Use o caminho Tweaker / Settings → IO Ports.'
      : 'Placas Gigabyte não oferecem API documentada e segura para esta opção a partir do Windows.';
    return { ok: false, mode: 'manual', reason: note };
  }
}

module.exports = { GigabyteProvider };
