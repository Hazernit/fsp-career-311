import { all, bindings, newId, one, run, timestamp } from './db';

export class ApiError extends Error {
  constructor(public status: number, public code: string, message: string) { super(message); }
}
export function bad(message: string): never { throw new ApiError(400, 'VALIDATION_ERROR', message); }
export const PASSWORD_ITERATIONS = 100000;
const encoder = new TextEncoder();
export function randomToken(bytes = 32) { return Array.from(crypto.getRandomValues(new Uint8Array(bytes)), b => b.toString(16).padStart(2, '0')).join(''); }
export async function hash(value: string): Promise<string> {
  return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', encoder.encode(value))), b => b.toString(16).padStart(2, '0')).join('');
}
export async function passwordDigest(password: string, salt: string): Promise<string> {
  const key = await crypto.subtle.importKey('raw', encoder.encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt: encoder.encode(salt), iterations: PASSWORD_ITERATIONS, hash: 'SHA-256' }, key, 256);
  return Array.from(new Uint8Array(bits), b => b.toString(16).padStart(2, '0')).join('');
}
export function equalSecret(a: string, b: string): boolean {
  let diff = a.length ^ b.length;
  for (let i = 0; i < Math.max(a.length, b.length); i++) diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  return diff === 0;
}
export function email(value: unknown): string {
  if (typeof value !== 'string') bad('Укажите email.');
  const result = value.trim().toLowerCase();
  if (result.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(result)) bad('Введите корректный email.');
  return result;
}
export function string(value: unknown, label: string, max = 500, required = false): string {
  if (value === undefined || value === null) { if (required) bad(`Укажите ${label}.`); return ''; }
  if (typeof value !== 'string') bad(`Поле «${label}» должно быть строкой.`);
  const result = value.trim();
  if (result.length > max || (required && !result)) bad(`Проверьте поле «${label}» (до ${max} символов).`);
  return result;
}
export function stringArray(value: unknown, label: string, max = 30): string[] {
  if (!Array.isArray(value) || value.length > max) bad(`Поле «${label}» должно быть списком (до ${max} элементов).`);
  return [...new Set(value.map(v => string(v, label, 80, true)))];
}
export function choice<T extends string>(value: unknown, options: readonly T[], label: string): T {
  if (typeof value !== 'string' || !options.includes(value as T)) bad(`Выберите ${label}.`);
  return value as T;
}
export function bool(value: unknown, label: string): boolean { if (typeof value !== 'boolean') bad(`Поле «${label}» должно быть boolean.`); return value; }
export function salary(from: unknown, to: unknown): [number, number] {
  if (!Number.isInteger(from) || !Number.isInteger(to) || Number(from) < 1 || Number(to) < Number(from) || Number(to) > 10000000) bad('Укажите зарплату от–до: целые рубли в месяц, от > 0, до ≥ от.');
  return [Number(from), Number(to)];
}
export function demoMode() { return bindings().DEMO_MODE !== 'false' && !bindings().RESEND_API_KEY; }
export async function requestJson(request: Request): Promise<Record<string, unknown>> {
  const origin = request.headers.get('origin');
  if (origin && origin !== new URL(request.url).origin) throw new ApiError(403, 'ORIGIN_DENIED', 'Запрос должен выполняться с этого сайта.');
  if (!request.headers.get('content-type')?.toLowerCase().startsWith('application/json')) throw new ApiError(415, 'JSON_REQUIRED', 'Используйте application/json.');
  if (Number(request.headers.get('content-length') || 0) > 65536) throw new ApiError(413,'PAYLOAD_TOO_LARGE','Слишком большой запрос.');
  const reader = request.body?.getReader();
  const decoder = new TextDecoder();
  let bytes = 0, text = '';
  if (reader) while (true) {
    const chunk = await reader.read();
    if (chunk.done) break;
    bytes += chunk.value.byteLength;
    if (bytes > 65536) { await reader.cancel(); throw new ApiError(413,'PAYLOAD_TOO_LARGE','Слишком большой запрос.'); }
    text += decoder.decode(chunk.value,{stream:true});
  }
  text += decoder.decode();
  let body: unknown;
  try { body = JSON.parse(text); } catch { bad('Некорректный JSON.'); }
  if (!body || typeof body !== 'object' || Array.isArray(body)) bad('Ожидается JSON-объект.');
  return body as Record<string, unknown>;
}
export async function rateLimit(key: string, limit: number, windowMs: number): Promise<void> {
  const safeKey = await hash(key);
  const since = new Date(Date.now() - windowMs).toISOString();
  const count = await one<{ count: number }>('SELECT COUNT(*) AS count FROM auth_attempts WHERE key = ? AND created_at > ?', safeKey, since);
  if ((count?.count ?? 0) >= limit) throw new ApiError(429, 'RATE_LIMITED', 'Слишком много попыток. Повторите позже.');
  await run('INSERT INTO auth_attempts(id,key,created_at) VALUES(?,?,?)', newId('rate'), safeKey, timestamp());
  // Bounded cleanup; requests do not share or expose raw client addresses.
  if (Math.random() < .02) await run('DELETE FROM auth_attempts WHERE created_at < ?', new Date(Date.now() - 86400000).toISOString());
}
export function clientKey(request: Request): string { return request.headers.get('cf-connecting-ip') || request.headers.get('x-forwarded-for')?.split(',')[0] || 'local'; }
export const CANDIDATE = 'candidate';
export const EMPLOYER = 'employer';
export interface UserRow { id: string; email: string; password_hash: string; password_salt: string; role: 'candidate'|'employer'; email_verified: number; consent_processing: number; created_at: string; }
export function publicUser(user: UserRow) { return { id: user.id, email: user.email, role: user.role, emailVerified: !!user.email_verified, consentProcessing: !!user.consent_processing }; }
export async function sessionUser(request: Request, required = true, role?: 'candidate'|'employer', verified = true): Promise<UserRow | null> {
  const token = request.headers.get('cookie')?.split(';').map(x => x.trim()).find(x => x.startsWith('fsp_session='))?.slice(12);
  const user = token && token.length === 64 ? await one<UserRow>('SELECT u.* FROM users u JOIN sessions s ON s.user_id = u.id WHERE s.token_hash = ? AND s.expires_at > ?', await hash(token), timestamp()) : null;
  if (!user) { if (required) throw new ApiError(401, 'AUTH_REQUIRED', 'Войдите в кабинет.'); return null; }
  if (role && user.role !== role) throw new ApiError(403, 'ROLE_DENIED', 'Эта функция доступна другой роли.');
  if (verified && !user.email_verified) throw new ApiError(403, 'EMAIL_NOT_VERIFIED', 'Подтвердите email, чтобы продолжить.');
  return user;
}
export async function createSession(userId: string, request: Request): Promise<string> {
  const token = randomToken();
  await run('INSERT INTO sessions(token_hash,user_id,created_at,expires_at) VALUES(?,?,?,?)', await hash(token), userId, timestamp(), new Date(Date.now() + 7 * 86400000).toISOString());
  return cookie(token, request);
}
export function cookie(token: string, request: Request, clear = false): string {
  return `fsp_session=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${clear ? 0 : 604800}${new URL(request.url).protocol === 'https:' ? '; Secure' : ''}`;
}
