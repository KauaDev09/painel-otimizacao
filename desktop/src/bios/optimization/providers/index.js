'use strict';

const { GigabyteProvider } = require('./gigabyte');
const { AsusProvider } = require('./asus');
const { MSIProvider } = require('./msi');
const { AsrockProvider } = require('./asrock');
const { GenericProvider } = require('./generic');

const PROVIDERS = [
  new GigabyteProvider(),
  new AsusProvider(),
  new MSIProvider(),
  new AsrockProvider(),
  new GenericProvider()
];

function selectProvider(scan) {
  for (const p of PROVIDERS) {
    if (p.id !== 'generic' && p.matches(scan)) return p;
  }
  return PROVIDERS.find((p) => p.id === 'generic');
}

function providerById(id) {
  return PROVIDERS.find((p) => p.id === id) || null;
}

module.exports = { PROVIDERS, selectProvider, providerById };
