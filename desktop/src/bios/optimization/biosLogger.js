'use strict';

const fs = require('fs');
const path = require('path');

const MAX_LINES = 800;

function stamp() {
  const d = new Date();
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  const ss = String(d.getSeconds()).padStart(2, '0');
  return `${hh}:${mm}:${ss}`;
}

class BiosOperationLogger {
  constructor(filePath) {
    this.filePath = filePath;
    this.lines = [];
    if (filePath) {
      try {
        const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        if (Array.isArray(parsed)) this.lines = parsed.slice(-MAX_LINES);
      } catch (_) { /* arquivo novo */ }
    }
  }

  log(message) {
    const line = `[${stamp()}] ${message}`;
    this.lines.push(line);
    if (this.lines.length > MAX_LINES) this.lines = this.lines.slice(-MAX_LINES);
    this._persist();
    return line;
  }

  boot() {
    this.lines.push('[BOOT]');
    this._persist();
  }

  getLines() {
    return this.lines.slice();
  }

  clear() {
    this.lines = [];
    this._persist();
  }

  _persist() {
    if (!this.filePath) return;
    try {
      fs.mkdirSync(path.dirname(this.filePath), { recursive: true });
      fs.writeFileSync(this.filePath, JSON.stringify(this.lines, null, 2), 'utf8');
    } catch (_) { /* persistência best-effort */ }
  }
}

module.exports = { BiosOperationLogger };
