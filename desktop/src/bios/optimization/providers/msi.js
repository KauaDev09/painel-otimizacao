'use strict';

const { BaseBiosProvider } = require('./base');

class MSIProvider extends BaseBiosProvider {
  constructor() {
    super('msi', 'MSI');
  }

  matches(scan) {
    return (scan.profile && scan.profile.motherboard && scan.profile.motherboard.vendorKey) === 'msi';
  }

  canApply(item, scan) {
    const base = super.canApply(item, scan);
    if (item.id === 'high_performance_plan') return base;
    if (base.ok) return base;
    return {
      ok: false,
      mode: 'manual',
      reason: 'MSI não oferece API documentada e segura para alterar esta opção da BIOS a partir do Windows. Use o menu OC.'
    };
  }
}

module.exports = { MSIProvider };
