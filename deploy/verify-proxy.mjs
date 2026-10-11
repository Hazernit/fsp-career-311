import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';

const base = process.env.FSP_PROXY_TEST_URL || 'http://127.0.0.1:8080';
if (!['localhost', '127.0.0.1'].includes(new URL(base).hostname)) throw new Error('This test only uses a separate local validation database.');
const origin = process.env.FSP_PUBLIC_ORIGIN;
const token = process.env.FSP_GATEWAY_TOKEN;
if (!origin?.startsWith('https://') || !token) throw new Error('Set the HTTPS test origin and gateway test token.');
let cookie = '';
const checks = [];
const record = (name) => { checks.push({ name, passed: true }); console.log(`PASS ${name}`); };
async function request(path, body, { status = 200, authenticated = true, requestOrigin = origin, method } = {}) {
  const response = await fetch(base + path, {
    method: method || (body === undefined ? 'GET' : 'POST'),
    headers: { ...(authenticated ? { 'x-fsp-gateway-token': token } : {}), ...(cookie ? { cookie } : {}), ...(body === undefined ? {} : { 'content-type': 'application/json', origin: requestOrigin }) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  assert.equal(response.status, status, `${path}: unexpected status`);
  const cookies = response.headers.getSetCookie();
  for (const item of cookies) {
    assert.match(item, /; HttpOnly/); assert.match(item, /; SameSite=Lax/); assert.match(item, /; Secure/);
    const current = new Map(cookie.split('; ').filter(Boolean).map(value => [value.split('=')[0], value]));
    current.set(item.split('=')[0], item.split(';')[0]); cookie = [...current.values()].join('; ');
  }
  return response;
}

await request('/api/meta', undefined, { authenticated: false, status: 403 }); record('Direct backend requests fail without the gateway token');
const meta = await (await request('/api/meta')).json(); assert.equal(meta.data.demoMode, true); record('Authenticated gateway reaches metadata');
const html = await (await request('/?verify=test-query')).text(); assert.match(html, /ФСП Карьера/); record('SSR root and query route work');
await request('/api/auth/demo', { role: 'candidate' }, { requestOrigin: 'https://untrusted.example', status: 403 }); record('Foreign Origin is denied');
await request('/api/auth/demo', { role: 'candidate' }); assert.match(cookie, /fsp_session=/); assert.match(cookie, /fsp_demo_pair=/); record('Demo login creates Secure session and pairing cookies');
const demoSession = await (await request('/api/session')).json(); assert.equal(demoSession.data.user.role, 'candidate'); record('Cookie authentication survives a second request');
cookie = '';
const email = `proxy-${Date.now()}@fsp.invalid`, password = 'ProxyCheckPass123';
await request('/api/auth/register', { name: 'Проверка HTTPS', role: 'candidate', email, password, consentProcessing: true });
const confirmation = await (await request('/api/auth/confirmation')).json();
assert.equal(new URL(confirmation.data.confirmationUrl).origin, origin); record('Registration produces the external HTTPS confirmation URL');
await request('/api/auth/verify', { token: new URL(confirmation.data.confirmationUrl).searchParams.get('verify') }); record('Email confirmation succeeds behind the gateway');
await request('/api/profile', { name: 'Профиль после HTTPS', roles: ['Backend-разработчик'], softSkills: ['Командная работа'] }, { method: 'PATCH' });
const profile = await (await request('/api/profile')).json(); assert.equal(profile.data.name, 'Профиль после HTTPS'); record('Authenticated profile writes and reads work');
await request('/api/auth/logout', {}); assert.equal((await (await request('/api/session')).json()).data.user, null); record('Logout clears the HTTPS session');
await request('/api/auth/login', { email, password }); assert.equal((await (await request('/api/session')).json()).data.user.email, email); record('Registered participant can log in again');
const report = { status: 'pass', checks, localRuntimeOnly: true, cloudNetworkTested: false, testedOrigin: origin, tokenIncludedInReport: false };
if (process.env.FSP_PROXY_TEST_REPORT) writeFileSync(process.env.FSP_PROXY_TEST_REPORT, JSON.stringify(report, null, 2) + '\n');
console.log(`${checks.length} proxy checks passed.`);
