'use strict';

const { BaseBiosProvider } = require('./base');

class AsrockProvider extends BaseBiosProvider {
  constructor() {
    super('asrock', 'ASRock');
  }

  matches(scan) {
    return (scan.profile && scan.profile.motherboard && scan.profile.motherboard.vendorKey) === 'asrock';
  }

  canApply(item, scan) {
    const base = super.canApply(item, scan);
    if (item.id === 'high_performance_plan') return base;
    if (base.ok) return base;
    return {
      ok: false,
      mode: 'manual',
      reason: 'ASRock não oferece API documentada e segura para alterar esta opção da BIOS a partir do Windows. Use OC Tweaker / Advanced.'
    };
  }
}

module.exports = { AsrockProvider };
