'use strict';

const catalog = require('./catalog');
const { HIGH_PERF } = require('./extraScan');

async function snapshotFor(item, scan) {
  if (item.id === 'high_performance_plan') {
    const power = scan.extra && scan.extra.power;
    return {
      type: 'power_plan',
      guid: power && power.guid,
      name: power && power.name
    };
  }
  const cap = scan && scan.efiCap && scan.efiCap[item.id];
  if (cap && cap.ok && cap.mode === 'auto' && cap.variable) {
    const { runPsRead } = require('./efiVar');
    const read = await runPsRead([cap.variable], cap.guid);
    const cur = read.ok && read.vars[cap.variable.toLowerCase()];
    if (cur && cur.readable) {
      return {
        type: 'efi_var',
        variable: cap.variable,
        guid: cap.guid,
        offset: cap.offset,
        originalBytesHex: cur.bytesHex,
        board: scan.profile && scan.profile.motherboard && scan.profile.motherboard.boardProduct
      };
    }
  }
  return {
    type: 'manual',
    note: 'Rollback automático indisponível — reverter na BIOS.'
  };
}

function canRollback(item, snapshot) {
  if (snapshot && snapshot.type === 'efi_var' && snapshot.originalBytesHex) return true;
  if (!item || !item.rollbackSupported) return false;
  if (item.id === 'high_performance_plan') {
    return !!(snapshot && snapshot.guid && snapshot.guid !== HIGH_PERF);
  }
  return false;
}

module.exports = { snapshotFor, canRollback, itemById: catalog.itemById };
