'use strict';

// Classificação conservadora de risco e organização das recomendações.

const RISK_ORDER = { high: 3, medium: 2, low: 1, info: 0 };

class RiskAnalyzer {
  constructor() {}

  classify(recommendations) {
    const counts = { recommended: 0, optional: 0, critical: 0, informational: 0, advanced: 0 };
    const groups = { critical: [], recommended: [], optional: [], informational: [], advanced: [] };

    for (const rec of recommendations) {
      if (rec.advanced || rec.level === 'advanced') {
        rec.effectiveLevel = 'advanced';
        counts.advanced++;
        groups.advanced.push(rec);
      } else if (['critical', 'recommended', 'optional', 'informational'].includes(rec.level)) {
        rec.effectiveLevel = rec.level;
        counts[rec.level]++;
        groups[rec.level].push(rec);
      } else {
        rec.effectiveLevel = 'informational';
        counts.informational++;
        groups.informational.push(rec);
      }
    }

    const byRiskDesc = (a, b) => (RISK_ORDER[b.risk] || 0) - (RISK_ORDER[a.risk] || 0);
    for (const g of Object.values(groups)) g.sort(byRiskDesc);

    return { counts, groups };
  }

  // Configurações que NUNCA devem ser alteradas sem especialista — para o relatório.
  doNotTouchList(recommendations) {
    return recommendations
      .filter((r) => r.advanced || r.risk === 'high')
      .map((r) => ({ name: r.name, reason: r.reason }));
  }

  alerts(groups) {
    return groups.critical.map((r) => ({
      title: r.name,
      message: r.reason,
      severity: 'critical'
    }));
  }
}

module.exports = { RiskAnalyzer };
