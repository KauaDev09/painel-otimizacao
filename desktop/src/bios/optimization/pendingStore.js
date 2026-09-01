'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

class PendingStore {
  constructor(filePath) {
    this.filePath = filePath;
  }

  _load() {
    try {
      const data = JSON.parse(fs.readFileSync(this.filePath, 'utf8'));
      return Array.isArray(data.operations) ? data : { operations: [] };
    } catch (_) {
      return { operations: [] };
    }
  }

  _save(data) {
    fs.mkdirSync(path.dirname(this.filePath), { recursive: true });
    fs.writeFileSync(this.filePath, JSON.stringify(data, null, 2), 'utf8');
  }

  list() {
    return this._load().operations;
  }

  getPending() {
    return this.list().filter((op) => op.status === 'pending_reboot' || op.status === 'verifying');
  }

  getBySetting(setting) {
    return this.list().filter((op) => op.setting === setting);
  }

  create(partial) {
    const data = this._load();
    const op = {
      operationId: crypto.randomBytes(8).toString('hex'),
      setting: partial.setting,
      operation: partial.operation,
      requestedAt: new Date().toISOString(),
      status: partial.status || 'pending_reboot',
      provider: partial.provider || null,
      applyMethod: partial.applyMethod || 'manual',
      expectedState: partial.expectedState,
      previousState: partial.previousState || null,
      hardware: partial.hardware || null,
      rollbackSupported: !!partial.rollbackSupported,
      rollbackSnapshot: partial.rollbackSnapshot || null,
      dryRun: !!partial.dryRun,
      note: partial.note || null
    };
    data.operations.push(op);
    this._save(data);
    return op;
  }

  update(operationId, patch) {
    const data = this._load();
    const op = data.operations.find((x) => x.operationId === operationId);
    if (!op) return null;
    Object.assign(op, patch, { updatedAt: new Date().toISOString() });
    this._save(data);
    return op;
  }

  history() {
    return this.list().slice(-80);
  }
}

module.exports = { PendingStore };
