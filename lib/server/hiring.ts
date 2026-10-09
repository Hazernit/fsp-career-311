import { all, database, newId, one, parseJson, run, timestamp } from './db';
import { ApiError, bad, choice, salary, string, stringArray } from './security';
import type { UserRow } from './security';
import { candidateBase, matchingCandidates, profileRow, publicCandidate, unlocked } from './profiles';
import type { ProfileRow } from './profiles';
import { ALGORITHM_VERSION, extractDemandSkills, normalizeSkill, rankCandidates } from '../domain/matching';
import type { Recommendation } from '../domain/matching';
import { ensureSeed } from './seed';
import { redactContactText } from './privacy';

export interface DemandRow {id:string;employer_id:string;title:string;description:string;specialization:'backend'|'frontend';grade:'junior'|'middle';skills:string;must_have:string;industry:string;salary_from:number|null;salary_to:number|null;original_json:string|null;algorithm_version:string|null;created_at:string;}
interface InvitationRow {id:string;employer_id:string;candidate_id:string;demand_id:string|null;salary_from:number;salary_to:number;description:string;contact_method:string;status:string;created_at:string;responded_at:string|null;company:string;candidate_name:string;title:string;candidate_email:string;candidate_phone:string;candidate_consent_processing:number;}
export function demandDto(row: DemandRow) {
  return {id:row.id,title:row.title,description:row.description,specialization:row.specialization,grade:row.grade,skills:parseJson<string[]>(row.skills,[]),mustHave:parseJson<string[]>(row.must_have,[]),industry:row.industry,salaryFrom:row.salary_from,salaryTo:row.salary_to,createdAt:row.created_at,algorithmVersion:row.algorithm_version};
}
export async function ownedDemand(user: UserRow, id: string): Promise<DemandRow> {
  const row = await one<DemandRow>('SELECT * FROM demands WHERE id = ? AND employer_id = ?',id,user.id);
  if (!row) throw new ApiError(404,'DEMAND_NOT_FOUND','Потребность не найдена.');
  return row;
}
export async function safeOriginal(user: UserRow, row: DemandRow): Promise<Recommendation[]|null> {
  if (!row.original_json) return null;
  const original = parseJson<Recommendation[]>(row.original_json,[]);
  if (!original.length) return [];
  // Keep the saved ranking internally; current privacy controls every subsequent disclosure.
  const visible = await all<{id:string}>(`SELECT p.id FROM profiles p JOIN users u ON u.id=p.id WHERE p.is_public=1 AND p.consent_publication=1 AND u.consent_processing=1`);
  const permitted = await all<{candidate_id:string}>(`SELECT candidate_id FROM invitations WHERE employer_id=? AND status='accepted' UNION SELECT candidate_id FROM applications WHERE employer_id=?`,user.id,user.id);
  const visibleIds = new Set(visible.map(x=>x.id));
  const permittedIds = new Set(permitted.map(x=>x.candidate_id));
  return original.filter(candidate=>visibleIds.has(candidate.id)).map(candidate=>({...candidate,contactUnlocked:permittedIds.has(candidate.id)}));
}
export async function listDemands(user: UserRow) {
  const rows = await all<DemandRow>('SELECT * FROM demands WHERE employer_id = ? ORDER BY created_at DESC LIMIT 100',user.id);
  return Promise.all(rows.map(async row=>({...demandDto(row),original:await safeOriginal(user,row),originalCount:parseJson<unknown[]>(row.original_json,[]).length})));
}
export async function createDemand(user: UserRow, body: Record<string, unknown>) {
  const title = string(body.title,'название потребности',200,true);
  const description = string(body.description,'описание потребности',10000,true);
  const specialization = choice(body.specialization,['backend','frontend'] as const,'специализацию');
  const grade = choice(body.grade,['junior','middle'] as const,'грейд');
  const explicit = body.skills === undefined ? [] : stringArray(body.skills,'навыки');
  const skills = [...new Set([...explicit,...extractDemandSkills(description)].map(normalizeSkill))];
  const mustHave = body.mustHave === undefined ? [] : stringArray(body.mustHave,'обязательные навыки').map(normalizeSkill);
  const industry = string(body.industry,'отрасль',120);
  let salaryFrom: number|null = null, salaryTo: number|null = null;
  if (body.salaryFrom != null || body.salaryTo != null) [salaryFrom,salaryTo] = salary(body.salaryFrom,body.salaryTo);
  const id = newId('demand');
  await run('INSERT INTO demands(id,employer_id,title,description,specialization,grade,skills,must_have,industry,salary_from,salary_to,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)',id,user.id,title,description,specialization,grade,JSON.stringify(skills),JSON.stringify(mustHave),industry,salaryFrom,salaryTo,timestamp());
  return {...demandDto(await ownedDemand(user,id)),original:null,originalCount:0};
}
export async function demandDetail(user: UserRow, id: string) {
  const row = await ownedDemand(user,id);
  return {...demandDto(row),original:await safeOriginal(user,row),originalCount:parseJson<unknown[]>(row.original_json,[]).length};
}
export async function matchDemand(user: UserRow, id: string) {
  await ensureSeed();
  let row = await ownedDemand(user,id);
  const demand = demandDto(row);
  const candidates = await matchingCandidates(user.id);
  if (!row.original_json) {
    const original = rankCandidates(candidates,demand);
    // Concurrent match requests never overwrite the first persisted snapshot.
    await run('UPDATE demands SET original_json = ?, algorithm_version = ? WHERE id = ? AND employer_id = ? AND original_json IS NULL',JSON.stringify(original),ALGORITHM_VERSION,id,user.id);
    row = await ownedDemand(user,id);
  }
  return {demand:demandDto(row),original:await safeOriginal(user,row),originalCount:parseJson<unknown[]>(row.original_json,[]).length,categories:[{specialization:row.specialization,grade:row.grade,label:`${row.specialization === 'backend' ? 'Backend' : 'Frontend'} · ${row.grade === 'junior' ? 'Junior' : 'Middle'}`,count:candidates.filter(c=>c.specialization === row.specialization && c.verifiedGrade === row.grade).length}],algorithmVersion:row.algorithm_version || ALGORITHM_VERSION};
}
export async function browseCandidates(user: UserRow, params: URLSearchParams) {
  await ensureSeed();
  let candidates = await matchingCandidates(user.id);
  const specialization = params.get('specialization');
  const grade = params.get('grade');
  const fspOnly = params.get('fspOnly') === 'true' || params.get('fspOnly') === '1';
  const requested = (params.get('skills') || '').split(',').map(x=>normalizeSkill(x.trim())).filter(Boolean);
  if (specialization) candidates = candidates.filter(x=>x.specialization===specialization);
  if (grade) candidates = candidates.filter(x=>x.verifiedGrade===grade);
  if (fspOnly) candidates = candidates.filter(x=>x.fspVerified);
  if (requested.length) candidates = candidates.filter(x=>requested.every(s=>x.skills.map(normalizeSkill).includes(s) || x.demonstratedSkills.map(normalizeSkill).includes(s)));
  const permitted = await all<{candidate_id:string}>(`SELECT candidate_id FROM invitations WHERE employer_id=? AND status='accepted' UNION SELECT candidate_id FROM applications WHERE employer_id=?`,user.id,user.id);
  const ids = new Set(permitted.map(x=>x.candidate_id));
  return candidates.map(c=>({...c,score:0,achievementBonus:0,reasons:[],gaps:[],contactUnlocked:ids.has(c.id)}));
}
async function invitationRows(where: string, ...args: unknown[]): Promise<InvitationRow[]> {
  return all<InvitationRow>(`SELECT i.*, ep.company, cp.name AS candidate_name, COALESCE(d.title, cp.title) AS title, u.email AS candidate_email, cp.phone AS candidate_phone, u.consent_processing AS candidate_consent_processing
    FROM invitations i JOIN profiles ep ON ep.id=i.employer_id JOIN profiles cp ON cp.id=i.candidate_id JOIN users u ON u.id=i.candidate_id LEFT JOIN demands d ON d.id=i.demand_id
    WHERE ${where} ORDER BY i.created_at DESC LIMIT 200`,...args);
}
function invitationDto(row: InvitationRow) {
  const revealContacts = row.status === 'accepted' && !!row.candidate_consent_processing;
  return {id:row.id,candidateId:row.candidate_id,employerId:row.employer_id,demandId:row.demand_id,company:row.company,candidateName:revealContacts ? row.candidate_name : redactContactText(row.candidate_name),title:revealContacts ? row.title : redactContactText(row.title),description:row.description,contactMethod:row.contact_method,salaryFrom:row.salary_from,salaryTo:row.salary_to,status:row.status,createdAt:row.created_at,respondedAt:row.responded_at,contacts:revealContacts ? {email:row.candidate_email,phone:row.candidate_phone} : null};
}
export async function listInvitations(user: UserRow) {
  return (await invitationRows(user.role === 'candidate' ? 'i.candidate_id = ?' : 'i.employer_id = ?',user.id)).map(invitationDto);
}
export async function createInvitation(user: UserRow, body: Record<string, unknown>) {
  const candidateId = string(body.candidateId,'кандидат',100,true);
  await publicCandidate(candidateId,user.id);
  const company = await profileRow(user.id);
  if (!company.company.trim()) bad('Сначала заполните название компании.');
  const [salaryFrom,salaryTo] = salary(body.salaryFrom,body.salaryTo);
  const description = string(body.description,'описание приглашения',10000,true);
  const contactMethod = string(body.contactMethod,'способ связи',200,true);
  const demandId = body.demandId ? string(body.demandId,'потребность',100,true) : null;
  if (demandId) await ownedDemand(user,demandId);
  const pending = await one('SELECT id FROM invitations WHERE employer_id = ? AND candidate_id = ? AND status = ?',user.id,candidateId,'pending');
  if (pending) throw new ApiError(409,'INVITATION_PENDING','Этому кандидату уже отправлено приглашение.');
  const id = newId('invite');
  await run('INSERT INTO invitations(id,employer_id,candidate_id,demand_id,salary_from,salary_to,description,contact_method,status,created_at) VALUES(?,?,?,?,?,?,?,? ,\'pending\',?)',id,user.id,candidateId,demandId,salaryFrom,salaryTo,description,contactMethod,timestamp());
  return invitationDto((await invitationRows('i.id = ? AND i.employer_id = ?',id,user.id))[0]);
}
export async function respondInvitation(user: UserRow, id: string, body: Record<string, unknown>) {
  const decision = choice(body.decision,['accepted','declined'] as const,'решение');
  if (decision === 'accepted' && !user.consent_processing) throw new ApiError(403,'CONSENT_REQUIRED','Разрешите обработку данных перед раскрытием контактов.');
  const existing = await one<{status:string}>('SELECT status FROM invitations WHERE id = ? AND candidate_id = ?',id,user.id);
  if (!existing) throw new ApiError(404,'INVITATION_NOT_FOUND','Приглашение не найдено.');
  if (existing.status !== 'pending') throw new ApiError(409,'INVITATION_FINAL','Решение уже принято.');
  const result = await run('UPDATE invitations SET status = ?, responded_at = ? WHERE id = ? AND candidate_id = ? AND status = ?',decision,timestamp(),id,user.id,'pending');
  if (!result.meta.changes) throw new ApiError(409,'INVITATION_FINAL','Решение уже принято.');
  return invitationDto((await invitationRows('i.id = ? AND i.candidate_id = ?',id,user.id))[0]);
}
export async function publishVacancy(user: UserRow, body: Record<string, unknown>) {
  const demandId = string(body.demandId,'потребность',100,true);
  const demand = await ownedDemand(user,demandId);
  if (demand.salary_from === null || demand.salary_to === null) bad('Для публикации вакансии задайте зарплату в потребности.');
  const employer = await profileRow(user.id);
  if (!employer.company) bad('Заполните профиль компании.');
  const existing = await one<{id:string}>('SELECT id FROM vacancies WHERE demand_id = ? AND employer_id = ?',demandId,user.id);
  if (existing) return {id:existing.id,demandId};
  const id = newId('vacancy');
  await run('INSERT INTO vacancies(id,demand_id,employer_id,created_at) VALUES(?,?,?,?)',id,demandId,user.id,timestamp());
  return {id,demandId};
}
export async function listVacancies(user: UserRow) {
  const rows = await all<DemandRow & {vacancy_id:string;company:string;website:string;vacancy_created_at:string}>(`SELECT d.*, v.id AS vacancy_id,v.created_at AS vacancy_created_at,p.company,p.website FROM vacancies v JOIN demands d ON d.id=v.demand_id JOIN profiles p ON p.id=v.employer_id ORDER BY v.created_at DESC LIMIT 100`);
  const applications = user.role === 'candidate' ? await all<{vacancy_id:string}>('SELECT vacancy_id FROM applications WHERE candidate_id = ?',user.id) : [];
  return rows.map(row=>({...demandDto(row),id:row.vacancy_id,demandId:row.id,company:row.company,website:row.website,createdAt:row.vacancy_created_at,applied:applications.some(a=>a.vacancy_id===row.vacancy_id)}));
}
export async function applyVacancy(user: UserRow, id: string) {
  if (!user.consent_processing) throw new ApiError(403,'CONSENT_REQUIRED','Разрешите обработку данных перед откликом.');
  const vacancy = await one<{employer_id:string}>('SELECT employer_id FROM vacancies WHERE id = ?',id);
  if (!vacancy) throw new ApiError(404,'VACANCY_NOT_FOUND','Вакансия не найдена.');
  const applicationId = newId('application');
  await run('INSERT OR IGNORE INTO applications(id,vacancy_id,candidate_id,employer_id,created_at) VALUES(?,?,?,?,?)',applicationId,id,user.id,vacancy.employer_id,timestamp());
  return {vacancyId:id,applied:true,contactEmployerId:vacancy.employer_id};
}
