import { bindings, database, newId, one, run, timestamp } from './db';
import { ApiError, bad, choice, clientKey, cookie, createSession, demoMode, email, equalSecret, hash, passwordDigest, publicUser, randomToken, rateLimit, sessionUser, string } from './security';
import type { UserRow } from './security';
import { ensureSeed, seedDemoInvitation } from './seed';

export interface AuthResult { data: unknown; cookie?: string|string[]; }
function passwordValue(value: unknown): string {
  if (typeof value !== 'string' || !value.trim() || value.length > 128) bad('Пароль должен содержать от 1 до 128 символов.');
  return value;
}
async function verification(userId: string, address: string, request: Request): Promise<string> {
  const token = randomToken();
  const url = `${new URL(request.url).origin}/?verify=${token}`;
  await run('INSERT INTO verification_tokens(token_hash,user_id,expires_at,demo_token) VALUES(?,?,?,?)', await hash(token), userId, new Date(Date.now() + 86400000).toISOString(), demoMode() ? token : null);
  if (!demoMode()) {
    const config = bindings();
    if (!config.RESEND_API_KEY || !config.EMAIL_FROM) throw new ApiError(503, 'MAIL_NOT_CONFIGURED', 'Почта не настроена. Включите демо-режим или настройте доставку email.');
    const response = await fetch('https://api.resend.com/emails', { method: 'POST', headers: { 'Authorization': `Bearer ${config.RESEND_API_KEY}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ from: config.EMAIL_FROM, to: [address], subject: 'Подтвердите email — ФСП Карьера', text: `Подтвердите email, открыв ссылку: ${url}\nСсылка действует 24 часа. Если вы не регистрировались, проигнорируйте письмо.` }), signal: AbortSignal.timeout(10000) });
    if (!response.ok) throw new ApiError(503, 'MAIL_DELIVERY_FAILED', 'Не удалось доставить письмо. Войдите и повторите отправку позже.');
  }
  return url;
}
export async function authAction(path: string, body: Record<string, unknown>, request: Request): Promise<AuthResult> {
  if (path === 'register') {
    await rateLimit(`register:${clientKey(request)}`, 15, 3600000);
    const address = email(body.email);
    const password = passwordValue(body.password);
    if (password.length < 10) bad('Пароль должен содержать не менее 10 символов.');
    const role = choice(body.role, ['candidate','employer'] as const, 'роль');
    const name = string(body.name, 'имя', 150, true);
    if (body.consentProcessing !== true) bad('Для регистрации необходимо согласие на обработку данных.');
    if (!demoMode() && (!bindings().RESEND_API_KEY || !bindings().EMAIL_FROM)) throw new ApiError(503, 'MAIL_NOT_CONFIGURED', 'Настройте доставку email или используйте демонстрационный режим.');
    const existing = await one('SELECT id FROM users WHERE email = ?', address);
    if (existing) throw new ApiError(409, 'EMAIL_EXISTS', 'Этот email уже зарегистрирован.');
    const id = newId('user');
    const salt = randomToken(16);
    const digest = await passwordDigest(password, salt);
    const now = timestamp();
    await database().batch([
      database().prepare('INSERT INTO users(id,email,password_hash,password_salt,role,email_verified,consent_processing,created_at) VALUES(?,?,?,?,?,0,1,?)').bind(id,address,digest,salt,role,now),
      database().prepare('INSERT INTO profiles(id,name,company,contact_name,contact_email,updated_at) VALUES(?,?,?,?,?,?)').bind(id,name,role === 'employer' ? name : '',role === 'employer' ? name : '',role === 'employer' ? address : '',now),
    ]);
    const user = (await one<UserRow>('SELECT * FROM users WHERE id = ?', id))!;
    // Session is established before delivery, so a transient mail error can be recovered with resend.
    const sessionCookie = await createSession(id, request);
    try { await verification(id,address,request); } catch (error) {
      if (error instanceof ApiError) return { data: { ...publicUser(user), mailError: error.message }, cookie: sessionCookie };
      return { data: { ...publicUser(user), mailError: 'Не удалось доставить письмо; повторите отправку.' }, cookie: sessionCookie };
    }
    return { data: publicUser(user), cookie: sessionCookie };
  }
  if (path === 'login') {
    const address = email(body.email);
    const password = passwordValue(body.password);
    await rateLimit(`login:${address}:${clientKey(request)}`, 10, 900000);
    const user = await one<UserRow>('SELECT * FROM users WHERE email = ?', address);
    // Spend the same password work for unknown addresses and disabled seed accounts.
    const digest = await passwordDigest(password, user?.password_salt || 'unknown-address-salt');
    if (!user || !equalSecret(digest,user.password_hash)) throw new ApiError(401, 'INVALID_CREDENTIALS', 'Неверный email или пароль.');
    return { data: publicUser(user), cookie: await createSession(user.id,request) };
  }
  if (path === 'verify') {
    const token = string(body.token,'код подтверждения',64,true);
    if (!/^[a-f0-9]{64}$/.test(token)) bad('Некорректный код подтверждения.');
    const tokenHash = await hash(token);
    const pending = await one<{user_id:string;expires_at:string;used_at:string|null}>('SELECT * FROM verification_tokens WHERE token_hash = ?',tokenHash);
    if (!pending || pending.used_at || pending.expires_at <= timestamp()) throw new ApiError(400, 'INVALID_CONFIRMATION', 'Ссылка недействительна или истекла.');
    await database().batch([
      database().prepare('UPDATE users SET email_verified = 1 WHERE id = ?').bind(pending.user_id),
      database().prepare('UPDATE verification_tokens SET used_at = ?, demo_token = NULL WHERE user_id = ?').bind(timestamp(),pending.user_id),
    ]);
    const user = (await one<UserRow>('SELECT * FROM users WHERE id = ?', pending.user_id))!;
    return { data: publicUser(user), cookie: await createSession(user.id,request) };
  }
  if (path === 'logout') {
    const token = request.headers.get('cookie')?.split(';').map(x=>x.trim()).find(x=>x.startsWith('fsp_session='))?.slice(12);
    if (token) await run('DELETE FROM sessions WHERE token_hash = ?', await hash(token));
    return { data: {}, cookie: cookie('',request,true) };
  }
  if (path === 'resend') {
    const user = (await sessionUser(request,true,undefined,false))!;
    if (user.email_verified) return { data: { sent: false, emailVerified: true } };
    await rateLimit(`resend:${user.id}`,3,900000);
    await verification(user.id,user.email,request);
    return { data: { sent: true, demoMode: demoMode() } };
  }
  if (path === 'demo') {
    if (!demoMode()) throw new ApiError(404, 'DEMO_DISABLED', 'Демо-режим отключён.');
    await rateLimit(`demo:${clientKey(request)}`,60,3600000);
    const role = choice(body.role,['candidate','employer'] as const,'роль');
    await ensureSeed();
    let pairToken = body.fresh !== true ? request.headers.get('cookie')?.split(';').map(x=>x.trim()).find(x=>x.startsWith('fsp_demo_pair='))?.slice(14) : undefined;
    let pair = pairToken && /^[a-f0-9]{64}$/.test(pairToken) ? await one<{candidate_id:string|null;employer_id:string|null}>('SELECT * FROM demo_pairs WHERE token_hash = ? AND expires_at > ?',await hash(pairToken),timestamp()) : null;
    if (!pair || !pairToken) {
      pairToken = randomToken();
      await run('INSERT INTO demo_pairs(token_hash,expires_at) VALUES(?,?)',await hash(pairToken),new Date(Date.now()+7*86400000).toISOString());
      pair = {candidate_id:null,employer_id:null};
    }
    const pairCookie = `fsp_demo_pair=${pairToken}; Path=/; HttpOnly; SameSite=Lax; Max-Age=604800${new URL(request.url).protocol === 'https:' ? '; Secure' : ''}`;
    const existingId = role === 'candidate' ? pair.candidate_id : pair.employer_id;
    if (existingId) {
      const existingUser = await one<UserRow>('SELECT * FROM users WHERE id = ?',existingId);
      if (existingUser) return {data:{...publicUser(existingUser),demo:true},cookie:[await createSession(existingId,request),pairCookie]};
    }
    const id = newId('demo');
    const now = timestamp();
    const address = `${id}@fsp.invalid`;
    await database().batch([
      database().prepare('INSERT INTO users(id,email,password_hash,password_salt,role,email_verified,consent_processing,created_at) VALUES(?,?,?,\'\',?,1,1,?)').bind(id,address,'disabled',role,now),
      database().prepare(`INSERT INTO profiles(id,name,title,city,phone,bio,skills,experience_years,industry,specialization,claimed_grade,is_public,consent_publication,company,description,contact_name,contact_email,contact_method,is_synthetic,updated_at) VALUES(?,?,?,?,?,?,?,1,?,'backend','junior',1,1,?,?,?,?,?,1,?)`).bind(
        id, role === 'candidate' ? 'Александра · демо-профиль' : 'Команда продукта', role === 'candidate' ? 'Backend-разработчик' : '', 'Москва', '+7 000 000-00-00',
        role === 'candidate' ? 'Синтетический профиль. Разрабатываю API на Python, использую SQL и Git. Подтвердите навыки тестом — категория пока не присвоена.' : '',
        role === 'candidate' ? JSON.stringify(['Python','SQL','Git','REST','Тестирование']) : '[]', 'Информационные технологии',
        role === 'employer' ? 'Орбита · демо-компания' : '', role === 'employer' ? 'Продуктовая команда с понятными задачами и открытой зарплатой. Синтетическая компания демо-стенда.' : '',
        role === 'employer' ? 'Мария · демо-рекрутер' : '', address, 'Email после принятия', now,
      ),
    ]);
    if (role === 'candidate') await seedDemoInvitation(id);
    await run(`UPDATE demo_pairs SET ${role === 'candidate' ? 'candidate_id' : 'employer_id'} = ? WHERE token_hash = ?`,id,await hash(pairToken));
    const user = (await one<UserRow>('SELECT * FROM users WHERE id = ?',id))!;
    return { data: {...publicUser(user),demo:true}, cookie: [await createSession(id,request),pairCookie] };
  }
  throw new ApiError(404,'NOT_FOUND','Метод не найден.');
}
export async function confirmation(request: Request) {
  const user = (await sessionUser(request,true,undefined,false))!;
  if (user.email_verified) return { demoMode: demoMode(), emailVerified: true };
  if (!demoMode()) return { demoMode: false, emailVerified: false };
  const row = await one<{demo_token:string}>('SELECT demo_token FROM verification_tokens WHERE user_id = ? AND used_at IS NULL AND expires_at > ? AND demo_token IS NOT NULL ORDER BY expires_at DESC LIMIT 1',user.id,timestamp());
  return { demoMode: true, confirmationUrl: row ? `${new URL(request.url).origin}/?verify=${row.demo_token}` : null };
}
