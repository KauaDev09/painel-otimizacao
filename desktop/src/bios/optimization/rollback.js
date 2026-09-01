'use strict';

const catalog = require('./catalog');
const { HIGH_PERF } = require('./extraScan');

function snapshotFor(item, scan) {
  if (item.id === 'high_performance_plan') {
    const power = scan.extra && scan.extra.power;
    return {
      type: 'power_plan',
      guid: power && power.guid,
      name: power && power.name
    };
  }
  return {
    type: 'manual',
    note: 'Rollback automático indisponível — reverter na BIOS.'
  };
}

function canRollback(item, snapshot) {
  if (!item || !item.rollbackSupported) return false;
  if (item.id === 'high_performance_plan') {
    return !!(snapshot && snapshot.guid && snapshot.guid !== HIGH_PERF);
  }
  return false;
}

module.exports = { snapshotFor, canRollback, itemById: catalog.itemById };
