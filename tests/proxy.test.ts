import test from 'node:test';
import assert from 'node:assert/strict';
import { prepareProxyRequest } from '../lib/server/proxy.ts';

const token = 'a1'.repeat(32);
const origin = 'https://example.apigw.yandexcloud.net';
const config = { FSP_PUBLIC_ORIGIN: origin, FSP_GATEWAY_TOKEN: token };

test('the unconfigured local preview retains its original request', () => {
  const request = new Request('http://127.0.0.1:8080/api/meta');
  assert.equal(prepareProxyRequest(request, {}), request);
});

test('partial, HTTP and malformed proxy configuration fails closed', () => {
  for (const broken of [{ FSP_PUBLIC_ORIGIN: origin }, { FSP_GATEWAY_TOKEN: token }, { ...config, FSP_PUBLIC_ORIGIN: 'http://example.com' }, { ...config, FSP_PUBLIC_ORIGIN: origin + '/another' }, { ...config, FSP_GATEWAY_TOKEN: 'short' }]) {
    const result = prepareProxyRequest(new Request('http://10.0.0.2:8080/'), broken);
    assert(result instanceof Response);
    assert.equal(result.status, 503);
  }
});

test('forwarding headers cannot open direct access or choose the HTTPS origin', () => {
  for (const offered of ['', token.slice(1), 'b2'.repeat(32)]) {
    const result = prepareProxyRequest(new Request('http://10.0.0.2:8080/api/session', { headers: { 'x-fsp-gateway-token': offered, 'x-forwarded-host': 'attacker.example', 'x-forwarded-proto': 'https' } }), config);
    assert(result instanceof Response);
    assert.equal(result.status, 403);
  }
});

test('authenticated gateway preserves body, cookie, path, query and original Origin', async () => {
  const request = new Request('http://10.0.0.2:8080/api/auth/login?next=%2Fprofile&tag=a&tag=b', {
    method: 'POST', body: JSON.stringify({ email: 'demo@fsp.invalid', password: 'ExamplePass123' }),
    headers: { 'content-type': 'application/json', cookie: 'fsp_session=example', origin, 'x-fsp-gateway-token': token, 'cf-connecting-ip': '203.0.113.1', 'x-forwarded-for': '203.0.113.2', 'x-forwarded-host': 'attacker.example', 'x-forwarded-proto': 'http', forwarded: 'host=attacker.example' },
  });
  const result = prepareProxyRequest(request, config);
  assert(result instanceof Request);
  assert.equal(result.url, origin + '/api/auth/login?next=%2Fprofile&tag=a&tag=b');
  assert.equal(result.headers.get('origin'), origin);
  assert.equal(result.headers.get('cookie'), 'fsp_session=example');
  assert.equal(result.headers.get('host'), new URL(origin).host);
  assert.equal(result.headers.get('x-forwarded-proto'), 'https');
  for (const name of ['x-fsp-gateway-token', 'cf-connecting-ip', 'x-forwarded-for', 'forwarded']) assert.equal(result.headers.get(name), null);
  assert.deepEqual(await result.json(), { email: 'demo@fsp.invalid', password: 'ExamplePass123' });
});

test('a malicious Origin is preserved for the application CSRF check', () => {
  const result = prepareProxyRequest(new Request('http://10.0.0.2:8080/api/profile', { headers: { 'x-fsp-gateway-token': token, origin: 'https://attacker.example' } }), config);
  assert(result instanceof Request);
  assert.notEqual(result.headers.get('origin'), new URL(result.url).origin);
});
