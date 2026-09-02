'use strict';

const { BaseBiosProvider } = require('./base');

class GenericProvider extends BaseBiosProvider {
  constructor() {
    super('generic', 'Genérico');
  }

  matches() {
    return true;
  }

  canApply(item, scan) {
    const base = super.canApply(item, scan);
    if (item.id === 'high_performance_plan') return base;
    if (base.ok) return base;
    return {
      ok: false,
      mode: 'manual',
      reason: 'Fabricante sem método automático confiável. Siga o guia manual da BIOS.'
    };
  }
}

module.exports = { GenericProvider };
