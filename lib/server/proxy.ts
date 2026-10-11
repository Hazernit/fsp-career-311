interface ProxyConfig {
  FSP_PUBLIC_ORIGIN?: unknown;
  FSP_GATEWAY_TOKEN?: unknown;
}

function sameToken(a: string, b: string): boolean {
  let different = a.length ^ b.length;
  for (let index = 0; index < Math.max(a.length, b.length); index++) {
    different |= (a.charCodeAt(index) || 0) ^ (b.charCodeAt(index) || 0);
  }
  return different === 0;
}

function denied(status: number): Response {
  return Response.json({ error: { code: status === 503 ? 'PROXY_NOT_CONFIGURED' : 'GATEWAY_REQUIRED', message: 'Стенд доступен через публичный HTTPS-адрес.' } }, { status, headers: { 'cache-control': 'no-store' } });
}

/** Accept the external URL only from the configured gateway, never from client forwarding headers. */
export function prepareProxyRequest(request: Request, config: ProxyConfig): Request | Response {
  const origin = typeof config.FSP_PUBLIC_ORIGIN === 'string' ? config.FSP_PUBLIC_ORIGIN : '';
  const token = typeof config.FSP_GATEWAY_TOKEN === 'string' ? config.FSP_GATEWAY_TOKEN : '';
  if (!origin && !token) return request;
  if (!origin || !/^[a-f0-9]{64}$/.test(token)) return denied(503);

  let publicUrl: URL;
  try { publicUrl = new URL(origin); } catch { return denied(503); }
  if (publicUrl.protocol !== 'https:' || publicUrl.username || publicUrl.password || publicUrl.search || publicUrl.hash || publicUrl.pathname !== '/' || publicUrl.origin !== origin.replace(/\/$/, '')) return denied(503);
  if (!sameToken(request.headers.get('x-fsp-gateway-token') || '', token)) return denied(403);

  const internalUrl = new URL(request.url);
  publicUrl.pathname = internalUrl.pathname;
  publicUrl.search = internalUrl.search;
  const forwarded = new Request(publicUrl, request);
  forwarded.headers.delete('x-fsp-gateway-token');
  forwarded.headers.delete('cf-connecting-ip');
  forwarded.headers.delete('x-forwarded-for');
  forwarded.headers.delete('forwarded');
  forwarded.headers.set('host', publicUrl.host);
  forwarded.headers.set('x-forwarded-host', publicUrl.host);
  forwarded.headers.set('x-forwarded-proto', 'https');
  return forwarded;
}
