'use strict';

const { test } = require('node:test');
const assert = require('node:assert');
const http = require('http');

const { normalizeGpuVendor, normalizeGpuVendors } = require('../src/lib/gpuVendor');

test('normalizeGpuVendor reconhece os três fabricantes do catálogo', () => {
  assert.strictEqual(normalizeGpuVendor('NVIDIA'), 'nvidia');
  assert.strictEqual(normalizeGpuVendor('GeForce RTX 4060'), 'nvidia');
  assert.strictEqual(normalizeGpuVendor('AMD'), 'amd');
  assert.strictEqual(normalizeGpuVendor('Advanced Micro Devices, Inc.'), 'amd');
  assert.strictEqual(normalizeGpuVendor('Radeon RX 6800'), 'amd');
  assert.strictEqual(normalizeGpuVendor('Intel'), 'intel');
  assert.strictEqual(normalizeGpuVendor('Intel(R) UHD Graphics'), 'intel');
});

test('normalizeGpuVendor devolve null quando não reconhece', () => {
  assert.strictEqual(normalizeGpuVendor('Microsoft Basic Display Adapter'), null);
  assert.strictEqual(normalizeGpuVendor(''), null);
  assert.strictEqual(normalizeGpuVendor(null), null);
});

test('normalizeGpuVendors deduplica e ignora desconhecidos', () => {
  assert.deepStrictEqual(
    normalizeGpuVendors(['NVIDIA', 'nvidia', 'Intel', 'Microsoft Basic Render', 'AMD']).sort(),
    ['amd', 'intel', 'nvidia']
  );
  assert.deepStrictEqual(normalizeGpuVendors([]), []);
});

test('postJsonStream parseia eventos SSE e resolve no done', async () => {
  process.env.SEVEN_ALLOW_HTTP = '1';
  const { postJsonStream } = require('../src/license/apiClient');

  const server = http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/event-stream' });
    res.write('event: meta\ndata: {"model":"x"}\n\n');
    res.write('event: delta\ndata: {"text":"Olá "}\n\n');
    res.write('event: delta\ndata: {"text":"mundo"}\n\n');
    res.write('event: done\ndata: {"ok":true,"reply":"Olá mundo","usage":{"used":1}}\n\n');
    res.end();
  });

  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const port = server.address().port;
  const deltas = [];
  try {
    const result = await postJsonStream(
      `http://127.0.0.1:${port}`,
      '/api/v1/sevenia/chat/stream',
      { message: 'oi' },
      { onEvent: (ev, data) => { if (ev === 'delta') deltas.push(data.text); } }
    );
    assert.strictEqual(result.reply, 'Olá mundo');
    assert.deepStrictEqual(deltas, ['Olá ', 'mundo']);
  } finally {
    await new Promise((r) => server.close(r));
  }
});

test('postJsonStream rejeita com código do evento de erro', async () => {
  process.env.SEVEN_ALLOW_HTTP = '1';
  const { postJsonStream } = require('../src/license/apiClient');

  const server = http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/event-stream' });
    res.write('event: error\ndata: {"code":"SEVENIA_UPSTREAM_RATE_LIMIT","message":"sem cota"}\n\n');
    res.end();
  });

  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const port = server.address().port;
  try {
    await assert.rejects(
      postJsonStream(`http://127.0.0.1:${port}`, '/x', {}, {}),
      (err) => err.code === 'SEVENIA_UPSTREAM_RATE_LIMIT' && /sem cota/.test(err.message)
    );
  } finally {
    await new Promise((r) => server.close(r));
  }
});
