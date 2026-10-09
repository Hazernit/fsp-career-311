import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { performance } from 'node:perf_hooks';

const base = process.env.FSP_BASE_URL || 'http://127.0.0.1:5173';
const response = await fetch(`${base}/api/auth/demo`, { method: 'POST', headers: { 'content-type': 'application/json', origin: new URL(base).origin }, body: JSON.stringify({ role: 'employer' }) });
assert.ok(response.ok);
const cookie = response.headers.getSetCookie().map(v => v.split(';')[0]).join('; ');
const endpoint = `${base}/api/candidates?specialization=backend&grade=junior`;
for (let i = 0; i < 5; i++) await fetch(endpoint, { headers: { cookie } }).then(r => r.json());
const latencies = [], errors = [];
const concurrency = 20, total = 100;
let issued = 0;
const started = performance.now();
await Promise.all(Array.from({ length: concurrency }, async () => {
  while (issued < total) {
    issued++; const start = performance.now();
    try { const res = await fetch(endpoint, { headers: { cookie } }); const body = await res.json(); if (!res.ok || !Array.isArray(body.data)) errors.push(res.status); }
    catch (error) { errors.push(String(error)); }
    latencies.push(performance.now() - start);
  }
}));
latencies.sort((a,b) => a-b);
const quantile = (fraction) => Math.round(latencies[Math.ceil(latencies.length*fraction)-1] * 10) / 10;
const report = { scenario: 'authenticated candidate browse on a warm local Worker and seeded SQLite/D1', total, concurrency, errors: errors.length, p50Ms: quantile(.5), p95Ms: quantile(.95), p99Ms: quantile(.99), durationMs: Math.round(performance.now()-started), node: process.version, platform: process.platform, generatedAt: new Date().toISOString(), limitation: 'Localhost and a small synthetic portfolio; this is not a production capacity estimate.' };
mkdirSync('tests/results', { recursive: true }); writeFileSync('tests/results/load-local.json', JSON.stringify(report, null, 2)); console.log(report);
assert.equal(errors.length, 0, JSON.stringify(errors));
