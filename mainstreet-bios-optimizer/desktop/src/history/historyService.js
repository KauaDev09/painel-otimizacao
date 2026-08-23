'use strict';

// HistoryService — histórico local de análises (data, hardware, BIOS, score,
// recomendações) e comparação ANTES/DEPOIS. Não armazena informações pessoais
// além do necessário (nome do computador e hardware).

const fs = require('fs');
const path = require('path');

class HistoryService {
  constructor(dir) {
    this.dir = dir;
    this.file = path.join(dir, 'history.json');
    fs.mkdirSync(dir, { recursive: true });
  }

  _load() {
    try {
      const data = JSON.parse(fs.readFileSync(this.file, 'utf8'));
      return Array.isArray(data) ? data : [];
    } catch (_) {
      return [];
    }
  }

  _save(list) {
    fs.writeFileSync(this.file, JSON.stringify(list, null, 2), 'utf8');
  }

  saveFromResult(result, id) {
    const p = result.profile;
    const entry = {
      id: id || `a-${Date.now()}`,
      date: new Date().toISOString(),
      score: result.scores.overall,
      categories: Object.fromEntries(Object.entries(result.scores.categories).map(([k, v]) => [k, v.percent])),
      counts: { ...result.counts },
      hardware: {
        cpu: p.cpu.name,
        gpu: (p.gpu[0] && p.gpu[0].name) || null,
        ramTotalGB: p.ram.totalGB,
        ramConfigMHz: p.ram.minConfigMHz,
        motherboard: `${p.motherboard.vendorDisplay || '?'} ${p.motherboard.boardProduct || ''}`.trim(),
        bios: `${p.bios.vendor || '?'} ${p.bios.version || ''} (${p.bios.dateISO || '?'})`
      },
      bootMode: p.boot.mode,
      recommendations: result.recommendations.map((r) => ({ id: r.id, level: r.effectiveLevel }))
    };
    const list = this._load();
    list.unshift(entry);
    this._save(list.slice(0, 100)); // limite razoável de histórico local
    return entry;
  }

  list(limit = 50) {
    return this._load().slice(0, limit);
  }

  get(id) {
    return this._load().find((e) => e.id === id) || null;
  }

  compare(idBefore, idAfter) {
    const a = this.get(idBefore);
    const b = this.get(idAfter);
    if (!a || !b) return null;

    const catDelta = {};
    for (const cat of new Set([...Object.keys(a.categories), ...Object.keys(b.categories)])) {
      catDelta[cat] = { before: a.categories[cat] ?? null, after: b.categories[cat] ?? null };
    }
    const beforeRecs = new Map(a.recommendations.map((r) => [r.id, r.level]));
    const afterRecs = new Map(b.recommendations.map((r) => [r.id, r.level]));
    const changed = [];
    for (const [rid, lvl] of afterRecs) {
      if (!beforeRecs.has(rid)) changed.push({ id: rid, from: '—', to: lvl });
      else if (beforeRecs.get(rid) !== lvl) changed.push({ id: rid, from: beforeRecs.get(rid), to: lvl });
    }
    for (const [rid, lvl] of beforeRecs) {
      if (!afterRecs.has(rid)) changed.push({ id: rid, from: lvl, to: '—' });
    }

    return {
      before: a, after: b,
      scoreDelta: b.score - a.score,
      categoriesDelta: catDelta,
      countsDelta: {
        recommended: b.counts.recommended - a.counts.recommended,
        optional: b.counts.optional - a.counts.optional,
        critical: b.counts.critical - a.counts.critical
      },
      recommendationChanges: changed
    };
  }
}

module.exports = { HistoryService };
