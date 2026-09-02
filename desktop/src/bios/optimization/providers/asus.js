'use strict';

const { BaseBiosProvider } = require('./base');

class AsusProvider extends BaseBiosProvider {
  constructor() {
    super('asus', 'ASUS');
  }

  matches(scan) {
    return (scan.profile && scan.profile.motherboard && scan.profile.motherboard.vendorKey) === 'asus';
  }

  canApply(item, scan) {
    const base = super.canApply(item, scan);
    if (item.id === 'high_performance_plan') return base;
    if (base.ok) return base;
    return {
      ok: false,
      mode: 'manual',
      reason: 'ASUS não oferece API documentada e segura para alterar esta opção da BIOS a partir do Windows. Use AI Tweaker / Advanced.'
    };
  }
}

module.exports = { AsusProvider };
