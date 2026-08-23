'use strict';

// Analyzer — pipeline completo da análise:
//   detecção -> motor de recomendações -> pontuação
// Não depende do Electron (testável via CLI).

const { runDetection } = require('./detector');
const { BIOSRecommendationEngine } = require('../recommendations/engine');
const { computeScores } = require('./scorer');

async function runAnalysis(onStep = () => {}) {
  const engine = new BIOSRecommendationEngine();
  const profile = await runDetection(onStep);
  const recommendationResult = engine.evaluate(profile);
  const scores = computeScores(profile);

  return {
    profile,
    recommendations: recommendationResult.recommendations,
    counts: recommendationResult.counts,
    groups: recommendationResult.groups,
    alerts: recommendationResult.alerts,
    doNotTouch: recommendationResult.doNotTouch,
    vendorMenuBank: recommendationResult.vendorMenuBank,
    scores
  };
}

module.exports = { runAnalysis };
