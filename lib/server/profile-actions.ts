import { database, parseJson, run, timestamp } from './db';
import { ownProfile, profileRow } from './profiles';
import { ApiError, bad, bool, choice, email, string, stringArray } from './security';
import type { UserRow } from './security';
import { mockFspRegistry } from '../domain/seed';

export async function updateProfile(user: UserRow, body: Record<string, unknown>) {
  const allowed = user.role === 'candidate'
    ? ['name','title','city','phone','bio','skills','experienceYears','industry','specialization','claimedGrade','consentProcessing','consentPublication','isPublic']
    : ['company','website','description','contactName','contactEmail','contactMethod'];
  if (Object.keys(body).some(k=>!allowed.includes(k))) bad('Запрос содержит недоступные поля профиля.');
  const row = await profileRow(user.id);
  const values: unknown[] = [];
  const fields: string[] = [];
  const put = (column:string,value:unknown) => { fields.push(`${column} = ?`);values.push(value); };
  const mapping: Record<string,[string,number]> = user.role === 'candidate'
    ? {name:['name',150],title:['title',180],city:['city',100],phone:['phone',40],bio:['bio',5000],industry:['industry',120]}
    : {company:['company',200],website:['website',500],description:['description',5000],contactName:['contact_name',150],contactMethod:['contact_method',200]};
  for (const [key,[column,max]] of Object.entries(mapping)) if (key in body) {
    const value = string(body[key],key,max,key === 'name' || key === 'company');
    if (key === 'website' && value) { try { const url = new URL(value); if (!['https:','http:'].includes(url.protocol)) bad('Сайт должен начинаться с https:// или http://.'); } catch { bad('Укажите полный адрес сайта.'); } }
    put(column,value);
  }
  if ('skills' in body) put('skills',JSON.stringify(stringArray(body.skills,'навыки')));
  if ('experienceYears' in body) {
    if (typeof body.experienceYears !== 'number' || !Number.isFinite(body.experienceYears) || body.experienceYears < 0 || body.experienceYears > 70) bad('Опыт должен быть числом от 0 до 70 лет.');
    put('experience_years',body.experienceYears);
  }
  if ('specialization' in body) {
    const spec = choice(body.specialization,['backend','frontend'] as const,'специализацию');
    if (row.verified_grade && row.specialization !== spec) throw new ApiError(409,'VERIFIED_SPECIALIZATION','Подтверждённая категория меняется после теста другой специализации.');
    put('specialization',spec);
  }
  if ('claimedGrade' in body) put('claimed_grade',choice(body.claimedGrade,['junior','middle'] as const,'предполагаемый грейд'));
  let processing = !!user.consent_processing;
  let publication = !!row.consent_publication;
  let visible = !!row.is_public;
  if ('consentProcessing' in body) processing = bool(body.consentProcessing,'согласие на обработку');
  if ('consentPublication' in body) publication = bool(body.consentPublication,'согласие на публикацию');
  if ('isPublic' in body) visible = bool(body.isPublic,'публикация профиля');
  if (user.role === 'candidate') {
    if (visible && (!publication || !processing)) visible = false;
    put('is_public',visible ? 1 : 0);
    put('consent_publication',publication ? 1 : 0);
  }
  if ('contactEmail' in body) put('contact_email',email(body.contactEmail));
  put('updated_at',timestamp());
  values.push(user.id);
  const statements = [database().prepare(`UPDATE profiles SET ${fields.join(', ')} WHERE id = ?`).bind(...values)];
  if ('consentProcessing' in body) statements.push(database().prepare('UPDATE users SET consent_processing = ? WHERE id = ?').bind(processing ? 1 : 0,user.id));
  await database().batch(statements);
  return ownProfile(await profileRow(user.id),{...user,consent_processing:processing ? 1 : 0});
}
export async function linkFsp(user: UserRow, body: Record<string, unknown>) {
  const fspId = string(body.fspId,'ID ФСП',80,true);
  const proofCode = string(body.proofCode,'код подтверждения',100,true);
  const registry = mockFspRegistry;
  const entry = registry.find(x=>x.fspId === fspId && x.proofCode === proofCode);
  if (!entry) throw new ApiError(400,'FSP_IDENTITY_NOT_VERIFIED','ID и код не совпадают с демо-реестром. Произвольный ID не подтверждает достижения.');
  await run('UPDATE profiles SET fsp_id = ?, fsp_verified = 1, achievements = ?, updated_at = ? WHERE id = ?',fspId,JSON.stringify(entry.achievements),timestamp(),user.id);
  return ownProfile(await profileRow(user.id),user);
}
export async function unlinkFsp(user: UserRow) {
  await run('UPDATE profiles SET fsp_id = NULL, fsp_verified = 0, achievements = ?, updated_at = ? WHERE id = ?','[]',timestamp(),user.id);
  return ownProfile(await profileRow(user.id),user);
}
