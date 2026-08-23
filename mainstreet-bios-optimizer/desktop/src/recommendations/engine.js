'use strict';

// BIOSRecommendationEngine
// Recebe o perfil do sistema (detectado de verdade via WMI/CIM) e avalia o banco
// de regras em /rules. Nenhuma regra é "mock": todas dependem de campos reais do
// perfil; quando o Windows não expõe um dado, ele é null/unknown e as condições
// simplesmente não disparam ou exibem "Não foi possível determinar".

const { loadRules } = require('../rules');
const { RiskAnalyzer } = require('./riskAnalyzer');

const UNKNOWN = '—';

class BIOSRecommendationEngine {
  constructor() {
    const { rules, vendors } = loadRules();
    this.rules = rules;
    this.vendors = vendors;
    this.riskAnalyzer = new RiskAnalyzer();
  }

  // ---------- Interpolação {caminho.para.campo} ----------
  resolve(pathStr, profile) {
    return String(pathStr)
      .split('.')
      .reduce((acc, k) => (acc === null || acc === undefined ? undefined : acc[k]), profile);
  }

  interpolate(template, profile) {
    if (!template) return '';
    return template.replace(/\{([a-zA-Z0-9_.]+)\}/g, (_, p) => {
      let v = this.resolve(p, profile);
      if (v === undefined || v === null) v = UNKNOWN;
      if (Array.isArray(v)) v = v.join(', ');
      return String(v);
    });
  }

  // ---------- Avaliador de condições ----------
  evalCondition(cond, profile) {
    if (!cond) return true;
    if (cond.all) return cond.all.every((c) => this.evalCondition(c, profile));
    if (cond.any) return cond.any.some((c) => this.evalCondition(c, profile));
    if (cond.not) return !this.evalCondition(cond.not, profile);

    const value = this.resolve(cond.f, profile);
    switch (cond.op) {
      case 'eq': return String(value) === String(cond.v);
      case 'ne': return String(value) !== String(cond.v);
      case 'in': return cond.v.map(String).includes(String(value));
      case 'gt': return Number(value) > Number(cond.v);
      case 'gte': return Number(value) >= Number(cond.v);
      case 'lt': return Number(value) < Number(cond.v);
      case 'lte': return Number(value) <= Number(cond.v);
      case 'true': return value === true;
      case 'false': return value === false;
      case 'null': return value === null || value === undefined;
      case 'notNull': return value !== null && value !== undefined;
      default:
        throw new Error(`Operador de condição desconhecido: ${cond.op}`);
    }
  }

  // ---------- Caminhos por fabricante ----------
  buildPaths(rule, vendorKey, isOem) {
    const paths = [];
    if (vendorKey && Array.isArray(rule.paths[vendorKey])) paths.push(...rule.paths[vendorKey]);
    else if (Array.isArray(rule.pathDefault)) paths.push(...rule.pathDefault);
    else if (typeof rule.pathDefault === 'string') paths.push(rule.pathDefault);

    const notes = [];
    const vf = vendorKey ? this.vendors[vendorKey] : null;
    if (vf && vf.globalNotes) notes.push(...vf.globalNotes);
    if (isOem) notes.push('Em computadores OEM (Acer/Dell/HP/Lenovo), as opções de BIOS são frequentemente limitadas pelo fabricante.');
    return { paths, notes };
  }

  buildSteps(rule, profile) {
    const steps = Array.isArray(rule.steps) ? rule.steps.slice() : [];
    return steps;
  }

  statusTextFor(rule, profile) {
    if (rule.statusField) {
      const cur = this.resolve(rule.statusField, profile);
      const map = rule.statusMap || {};
      return map[cur] !== undefined ? `Status: ${map[cur]}` : `Status: ${cur !== undefined && cur !== null ? cur : UNKNOWN}`;
    }
    return this.interpolate(rule.statusText, profile) || 'Status: Não foi possível determinar.';
  }

  evaluate(profile) {
    const vendorKey = profile.motherboard.vendorKey;
    const isOem = Boolean(profile.motherboard.isOem);

    const recommendations = [];
    for (const rule of this.rules) {
      try {
        if (!this.evalCondition(rule.when, profile)) continue;

        const { paths, notes } = this.buildPaths(rule, vendorKey, isOem);
        recommendations.push({
          id: rule.id,
          name: rule.name,
          category: rule.category,
          level: rule.level,
          risk: rule.risk,
          impact: rule.impact || 'low',
          advanced: Boolean(rule.advanced),
          techOnly: Boolean(rule.techOnly),
          rebootRequired: Boolean(rule.rebootRequired),
          statusText: this.statusTextFor(rule, profile),
          recommendation: this.interpolate(rule.recommendationText, profile),
          reason: this.interpolate(rule.reason, profile),
          benefit: this.interpolate(rule.benefit, profile),
          compatibility: this.interpolate(rule.compatibility, profile),
          paths,
          steps: this.buildSteps(rule, profile),
          notes: [...(rule.notes || []), ...notes]
        });
      } catch (e) {
        // Regra com defeito não deve derrubar a análise inteira.
        console.error(`[engine] Falha ao avaliar regra ${rule.id}:`, e.message);
      }
    }

    const { counts, groups } = this.riskAnalyzer.classify(recommendations);
    return {
      recommendations,
      counts,
      groups,
      alerts: this.riskAnalyzer.alerts(groups),
      doNotTouch: this.riskAnalyzer.doNotTouchList(recommendations),
      vendorMenuBank: vendorKey && this.vendors[vendorKey] ? this.vendors[vendorKey].menuBank : null
    };
  }
}

module.exports = { BIOSRecommendationEngine };
