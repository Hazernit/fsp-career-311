import assert from 'node:assert/strict';
import { readdirSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { DatabaseSync } from 'node:sqlite';

const base = process.env.FSP_BASE_URL || 'http://127.0.0.1:5173';
if (!['127.0.0.1', 'localhost'].includes(new URL(base).hostname)) throw new Error('White-box integration fixtures are restricted to a local preview.');
const results = [], started = Date.now();
class Client {
  cookie = '';
  async request(path, body, method, expected = 200, extraHeaders = {}) {
    const response = await fetch(base + '/api' + path, { method: method || (body === undefined ? 'GET' : 'POST'), headers: { ...(this.cookie ? { cookie: this.cookie } : {}), ...(body === undefined ? {} : { 'content-type': 'application/json', origin: new URL(base).origin }), ...extraHeaders }, body: body === undefined ? undefined : JSON.stringify(body) });
    const current = new Map(this.cookie.split('; ').filter(Boolean).map(item => [item.split('=')[0], item]));
    for (const cookie of response.headers.getSetCookie()) current.set(cookie.split('=')[0], cookie.split(';')[0]);
    this.cookie = [...current.values()].join('; ');
    if (response.headers.get('content-type')?.includes('application/pdf')) { assert.equal(response.status, expected); return new Uint8Array(await response.arrayBuffer()); }
    const raw = await response.text();
    let json;
    try { json = JSON.parse(raw); } catch { assert.ok(expected >= 400, `${path}: unexpected non-JSON success response`); json = { error: { code: 'HTTP_ERROR', message: raw } }; }
    assert.equal(response.status, expected, `${path}: ${JSON.stringify(json)}`);
    return expected < 400 ? json.data : json.error;
  }
}
const test = async (name, fn) => { const time = Date.now(); await fn(); results.push({ name, passed: true, durationMs: Date.now() - time }); console.log(`PASS ${name}`); };
const anon = new Client(), candidate = new Client(), otherCandidate = new Client(), employer = new Client(), otherEmployer = new Client(), registered = new Client();
let candidateUser, employerUser, profile, demand, invitation, exam, vacancy, firstQuestionnaire, application;
function findSqlite(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = resolve(dir, entry.name);
    if (entry.isFile() && entry.name.endsWith('.sqlite')) return path;
    if (entry.isDirectory()) { const found = findSqlite(path); if (found) return found; }
  }
}
function localDatabase(readOnly=true) {
  const path = findSqlite(resolve(process.env.FSP_TEST_D1_DIR || (process.env.FSP_DATA_DIR ? `${process.env.FSP_DATA_DIR}/v3/d1` : '.wrangler/state/v3/d1')));
  if (!path) throw new Error('Local D1 state not found; build, migrate and start the preview first.');
  return new DatabaseSync(path, { readOnly });
}
function referenceAnswers(examId) {
  const db = localDatabase();
  try { const row = db.prepare('SELECT exam_json FROM test_attempts WHERE id = ?').get(examId); const exam = JSON.parse(row.exam_json); return Object.fromEntries(Object.entries(exam.answerKey).map(([id, answer]) => [id, answer.optionId])); }
  finally { db.close(); }
}
function legacySnapshotFixture(demandId) {
  const db=localDatabase(false);
  try {
    const payload=JSON.parse(db.prepare('SELECT original_json FROM demands WHERE id = ?').get(demandId).original_json);
    payload[0].bio='Предыдущая версия: https://t.me/historical_snapshot_311 и @historic_owner_311';
    delete payload[0].roles;delete payload[0].softSkills;
    const saved=JSON.stringify(payload);
    db.prepare('UPDATE demands SET original_json = ? WHERE id = ?').run(saved,demandId);
    return saved;
  } finally { db.close(); }
}

try {
  await test('Anonymous access denied', async () => { await anon.request('/profile', undefined, undefined, 401); await anon.request('/invitations', undefined, undefined, 401); });
  await test('Email registration requires consent and confirmation', async () => {
    await registered.request('/auth/register', { email: `test-${Date.now()}@fsp.invalid`, password: 'ReliablePass123', name: 'Тестовый участник', role: 'candidate', consentProcessing: false }, undefined, 400);
    const email = `integration-${Date.now()}@fsp.invalid`;
    const user = await registered.request('/auth/register', { email, password: 'ReliablePass123', name: 'Тестовый участник', role: 'candidate', consentProcessing: true });
    assert.equal(user.emailVerified, false);
    for (const path of ['/profile','/questionnaires/history']) assert.equal((await registered.request(path,undefined,undefined,403)).code,'EMAIL_NOT_VERIFIED');
    for (const [path,body] of [['/tests/start',{specialization:'backend',grade:'junior'}],['/questionnaires',{industry:'Образование',specialization:'backend',claimedGrade:'junior'}]]) assert.equal((await registered.request(path,body,undefined,403)).code,'EMAIL_NOT_VERIFIED');
    const confirmation = await registered.request('/auth/confirmation'); assert.equal(confirmation.demoMode, true);
    const token = new URL(confirmation.confirmationUrl).searchParams.get('verify'); assert.ok(token);
    assert.equal((await registered.request('/auth/verify',{token:'0'.repeat(64)},undefined,400)).code,'INVALID_CONFIRMATION');
    const verified = await registered.request('/auth/verify', { token }); assert.equal(verified.emailVerified, true);
    await registered.request('/auth/verify', { token }, undefined, 400);
    await registered.request('/auth/logout', {}); const session = await registered.request('/session'); assert.equal(session.user, null);
    await registered.request('/auth/login', { email, password: 'WrongPass123' }, undefined, 401);
    await registered.request('/auth/login', { email, password: 'ReliablePass123' });
  });
  await test('Demo roles create separate server sessions', async () => {
    candidateUser = await candidate.request('/auth/demo', { role: 'candidate' }); employerUser = await employer.request('/auth/demo', { role: 'employer' });
    await otherCandidate.request('/auth/demo', { role: 'candidate' }); await otherEmployer.request('/auth/demo', { role: 'employer' });
    assert.notEqual(candidateUser.id, employerUser.id); profile = await candidate.request('/profile'); assert.equal(profile.verifiedGrade, null);
  });
  await test('Role separation and CSRF origin enforced', async () => {
    await employer.request('/tests/start', { specialization: 'backend', grade: 'junior' }, undefined, 403);
    await candidate.request('/demands', { title: 'Чужая роль' }, undefined, 403);
    await candidate.request('/profile', { name: 'Нельзя сохранить' }, 'PATCH', 403, { origin: 'https://untrusted.example' });
  });
  await test('Profile edits cannot forge grade or FSP verification', async () => {
    await candidate.request('/profile', { verifiedGrade: 'middle', fspVerified: true }, 'PATCH', 400);
    await candidate.request('/profile', { name: 'Тестовый разработчик', phone: '+7 000 000-11-22', skills: ['Python', 'SQL', 'HTTP', 'Git'], consentPublication: true, isPublic: true }, 'PATCH');
    profile = await candidate.request('/profile'); assert.equal(profile.verifiedGrade, null); assert.equal(profile.fspVerified, false);
    await candidate.request('/profile',{roles:'Backend'},'PATCH',400);
    await candidate.request('/profile',{softSkills:Array(31).fill('Командная работа')},'PATCH',400);
    await candidate.request('/profile',{roles:['x'.repeat(81)]},'PATCH',400);
    await candidate.request('/profile',{roles:[' Backend-разработчик ','Backend-разработчик',profile.email,'@career_contacts_311','https://t.me/career_contacts_311'],softSkills:['Командная работа',profile.phone,'https://telegram.me/team_311']},'PATCH');
    profile=await candidate.request('/profile');
    assert.deepEqual(profile.roles,['Backend-разработчик',profile.email,'@career_contacts_311','https://t.me/career_contacts_311']); assert.deepEqual(profile.softSkills,['Командная работа',profile.phone,'https://telegram.me/team_311']);
    await candidate.request('/fsp/link', { fspId: 'invented-id', proofCode: '1234' }, undefined, 400);
  });
  await test('A saved own questionnaire with a required industry gates the exact test category',async()=>{
    assert.equal((await candidate.request('/tests/start',{specialization:'backend',grade:'middle'},undefined,409)).code,'QUESTIONNAIRE_REQUIRED');
    await candidate.request('/questionnaires',{industry:'  ',specialization:'backend',claimedGrade:'middle'},undefined,400);
    await candidate.request('/questionnaires',{industry:'Образование',specialization:'backend',claimedGrade:'middle',verifiedGrade:'middle'},undefined,400);
    await candidate.request('/questionnaires',{industry:'Образование',specialization:'backend',claimedGrade:'middle',userId:candidateUser.id},undefined,400);
    await employer.request('/questionnaires',{industry:'Образование',specialization:'backend',claimedGrade:'middle'},undefined,403);
    await employer.request('/questionnaires/history',undefined,undefined,403);
    firstQuestionnaire=await candidate.request('/questionnaires',{industry:' Образование ',specialization:'backend',claimedGrade:'middle'},undefined,201);
    assert.deepEqual(Object.keys(firstQuestionnaire).sort(),['id','industry','specialization','claimedGrade','createdAt'].sort());
    assert.equal(firstQuestionnaire.industry,'Образование'); assert.equal((await candidate.request('/profile')).verifiedGrade,null);
    assert.deepEqual(await otherCandidate.request('/questionnaires/history'),[]);
    assert.deepEqual(await candidate.request('/questionnaires/history'),[firstQuestionnaire]);
    assert.equal((await candidate.request('/tests/start',{specialization:'backend',grade:'junior'},undefined,409)).code,'QUESTIONNAIRE_REQUIRED');
    await candidate.request('/questionnaires',{id:firstQuestionnaire.id,industry:'Изменение',specialization:'backend',claimedGrade:'middle'},'PATCH',404);
    assert.deepEqual(await candidate.request('/questionnaires/history'),[firstQuestionnaire]);
  });
  await test('Private answer key and seed absent from exam response', async () => {
    exam = await candidate.request('/tests/start', { specialization: 'backend', grade: 'middle' }); assert.equal(exam.questions.length, 12);
    assert.equal((await candidate.request('/tests/start',{specialization:'backend',grade:'middle'})).id,exam.id);
    const json = JSON.stringify(exam); assert.ok(!json.includes('answerKey')); assert.ok(!json.includes('optionId')); assert.ok(!json.includes('seed'));
    await otherCandidate.request(`/tests/${exam.id}/submit`, { answers: {} }, undefined, 404);
  });
  await test('Failed middle test does not downgrade and permits initial junior test', async () => {
    const failed = await candidate.request(`/tests/${exam.id}/submit`, { answers: {} }); assert.equal(failed.passed, false); assert.equal(failed.verifiedGrade, null);
    await candidate.request(`/tests/${exam.id}/submit`, { answers: {} }, undefined, 409);
    await candidate.request('/questionnaires',{industry:'Образование',specialization:'backend',claimedGrade:'junior'},undefined,201);
    exam = await candidate.request('/tests/start', { specialization: 'backend', grade: 'junior' });
  });
  await test('Reference answers confirm category and recorded skill evidence', async () => {
    const result = await candidate.request(`/tests/${exam.id}/submit`, { answers: referenceAnswers(exam.id) });
    assert.equal(result.passed, true); assert.equal(result.score, 100); assert.equal(result.verifiedGrade, 'junior');
    profile = await candidate.request('/profile'); assert.equal(profile.verifiedGrade, 'junior'); assert.ok(profile.demonstratedSkills.includes('SQL'));
    const later=await candidate.request('/questionnaires',{industry:'Медиа',specialization:'frontend',claimedGrade:'middle'},undefined,201);
    const afterQuestionnaire=await candidate.request('/profile');
    assert.equal(afterQuestionnaire.specialization,'backend'); assert.equal(afterQuestionnaire.verifiedGrade,'junior'); assert.equal(afterQuestionnaire.claimedGrade,'middle');
    assert.equal((await candidate.request('/tests/start',{specialization:'frontend',grade:'middle'},undefined,409)).code,'GRADE_COOLDOWN');
    const history=await candidate.request('/questionnaires/history');
    assert.equal(history[0].id,later.id);assert.deepEqual(history.find(x=>x.id===firstQuestionnaire.id),firstQuestionnaire);
    await candidate.request('/questionnaires',{industry:'Образование',specialization:'backend',claimedGrade:'middle'},undefined,201);
    assert.equal((await candidate.request('/tests/start', { specialization: 'backend', grade: 'middle' }, undefined, 409)).code,'GRADE_COOLDOWN');
    assert.equal((await candidate.request('/tests/history')).length, 2);
  });
  await test('Category catalogue is stably ranked on verified evidence and redacts new profile arrays',async()=>{
    const path='/candidates?specialization=backend&grade=junior';
    const list=await employer.request(path), repeat=await employer.request(path);
    assert.deepEqual(list.map(x=>x.id),repeat.map(x=>x.id));
    assert.ok(list.length>0);assert.ok(list.every(x=>x.score>0 && x.score<=100 && x.achievementBonus>=0 && x.achievementBonus<=5 && x.reasons.length));
    for(let i=1;i<list.length;i++) assert.ok(list[i-1].score>list[i].score || (list[i-1].score===list[i].score && list[i-1].id.localeCompare(list[i].id)<=0));
    const own=list.find(x=>x.id===candidateUser.id);assert.ok(own.roles.includes('Backend-разработчик'));assert.ok(own.softSkills.includes('Командная работа'));
    for(const value of [profile.email,profile.phone,'@career_contacts_311','t.me/career_contacts_311','telegram.me/team_311','answerKey','password_hash','demo_token','exam_json']) assert.ok(!JSON.stringify(list).includes(value));
  });
  await test('Employer finds verified candidates with explanations and no contacts', async () => {
    demand = await employer.request('/demands', { title: 'Backend Junior', description: 'Разработка API и SQL для образовательного продукта.', specialization: 'backend', grade: 'junior', skills: ['SQL', 'HTTP'], mustHave: ['SQL'], industry: 'Образование', salaryFrom: 100000, salaryTo: 140000 }, undefined, 201);
    const match = await employer.request(`/demands/${demand.id}/match`, {}); assert.ok(match.original.length > 0); assert.ok(match.original.every(x => x.verifiedGrade === 'junior'));
    assert.ok(match.original.some(x => x.id === candidateUser.id)); assert.ok(match.original.every(x => Array.isArray(x.reasons) && x.reasons.length));
    assert.ok(!JSON.stringify(match).includes(profile.email)); assert.ok(!JSON.stringify(match).includes(profile.phone));
    for(const value of ['@career_contacts_311','t.me/career_contacts_311','telegram.me/team_311']) assert.ok(!JSON.stringify(match).includes(value));
    await otherEmployer.request(`/demands/${demand.id}`, undefined, undefined, 404);
  });
  await test('Contact is hidden in candidate API and PDF before acceptance', async () => {
    const card = await employer.request(`/candidates/${candidateUser.id}`); assert.equal(card.contacts, null); assert.equal(card.contactUnlocked, false);
    for(const value of [profile.email,profile.phone,'@career_contacts_311','t.me/career_contacts_311','telegram.me/team_311']) assert.ok(!JSON.stringify(card).includes(value));
    const pdf = await employer.request(`/candidates/${candidateUser.id}/pdf`); assert.ok(pdf.length > 1000); mkdirSync('tests/results', { recursive: true }); writeFileSync('tests/results/profile-locked.pdf', pdf);
    writeFileSync('tests/results/profile-own.pdf',await candidate.request('/profile/pdf'));
  });
  await test('Invitation requires salary and only target candidate may respond', async () => {
    await employer.request('/invitations', { candidateId: candidateUser.id, description: 'Работа над API', contactMethod: 'Email' }, undefined, 400);
    await employer.request('/invitations', { candidateId: candidateUser.id, salaryFrom: 140000, salaryTo: 100000, description: 'Работа над API', contactMethod: 'Email' }, undefined, 400);
    invitation = await employer.request('/invitations', { candidateId: candidateUser.id, demandId: demand.id, salaryFrom: 100000, salaryTo: 140000, description: 'Работа над API, гибрид, продуктовая команда.', contactMethod: 'Email после согласия' }, undefined, 201);
    await otherCandidate.request(`/invitations/${invitation.id}/respond`, { decision: 'accepted' }, undefined, 404);
    await employer.request(`/invitations/${invitation.id}/respond`, { decision: 'accepted' }, undefined, 403);
  });
  await test('Acceptance grants contacts only to the inviting employer', async () => {
    await candidate.request(`/invitations/${invitation.id}/respond`, { decision: 'accepted' });
    const unlocked = await employer.request(`/candidates/${candidateUser.id}`); assert.equal(unlocked.contacts.email, profile.email); assert.equal(unlocked.contacts.phone, profile.phone);
    assert.deepEqual(unlocked.roles,profile.roles);assert.deepEqual(unlocked.softSkills,profile.softSkills);
    const locked = await otherEmployer.request(`/candidates/${candidateUser.id}`); assert.equal(locked.contacts, null);
    const outgoing = await employer.request('/invitations'); assert.equal(outgoing.find(x => x.id === invitation.id).status, 'accepted');
    await candidate.request(`/invitations/${invitation.id}/respond`, { decision: 'declined' }, undefined, 409);
    writeFileSync('tests/results/profile-unlocked.pdf', await employer.request(`/candidates/${candidateUser.id}/pdf`));
  });
  await test('Filtering keeps the persisted original shortlist', async () => {
    const before = await employer.request(`/demands/${demand.id}`); await employer.request('/candidates?specialization=frontend&grade=middle'); const after = await employer.request(`/demands/${demand.id}`);
    assert.deepEqual(after.original.map(x => x.id), before.original.map(x => x.id));
    // Simulate a genuine stored pre-upgrade shape that has no new arrays and a Telegram contact.
    const legacy=legacySnapshotFixture(demand.id);
    const safe=await employer.request(`/demands/${demand.id}`);
    assert.deepEqual(safe.original.map(x=>x.id),before.original.map(x=>x.id));
    assert.ok(!JSON.stringify(safe).includes('t.me/historical_snapshot_311'));assert.ok(!JSON.stringify(safe).includes('@historic_owner_311'));
    assert.deepEqual(safe.original[0].roles,[]);assert.deepEqual(safe.original[0].softSkills,[]);
    const db=localDatabase();
    try {assert.equal(db.prepare('SELECT original_json FROM demands WHERE id = ?').get(demand.id).original_json,legacy);} finally {db.close();}
  });
  await test('Publication withdrawal removes discovery and stale shortlist entries', async () => {
    await candidate.request('/profile', { consentPublication: false, isPublic: false }, 'PATCH');
    const found = await otherEmployer.request('/candidates?specialization=backend&grade=junior'); assert.ok(!found.some(x => x.id === candidateUser.id));
    await otherEmployer.request(`/candidates/${candidateUser.id}`, undefined, undefined, 404);
    const stored = await employer.request(`/demands/${demand.id}`); assert.ok(!stored.original.some(x => x.id === candidateUser.id));
    assert.equal((await employer.request(`/candidates/${candidateUser.id}`)).contacts.email, profile.email);
  });
  await test('Processing withdrawal denies candidate cards even after acceptance', async () => {
    // Contact-looking free text must also stop leaking through historical invitation DTOs.
    await candidate.request('/profile', { name: `Участник ${profile.email} ${profile.phone}`, consentProcessing: false }, 'PATCH');
    for (const viewer of [employer, otherEmployer]) {
      assert.equal((await viewer.request(`/candidates/${candidateUser.id}`, undefined, undefined, 404)).code, 'CANDIDATE_NOT_FOUND');
      assert.ok(!(await viewer.request('/candidates')).some(x => x.id === candidateUser.id));
    }
    assert.equal((await candidate.request('/profile')).consentProcessing, false);
    assert.ok(!(await employer.request(`/demands/${demand.id}`)).original.some(x => x.id === candidateUser.id));
  });
  await test('Processing withdrawal denies employer PDF export for accepted and foreign pairs', async () => {
    for (const viewer of [employer, otherEmployer]) {
      assert.equal((await viewer.request(`/candidates/${candidateUser.id}/pdf`, undefined, undefined, 404)).code, 'CANDIDATE_NOT_FOUND');
    }
  });
  await test('Processing withdrawal redacts contacts in accepted invitation lists', async () => {
    for (const viewer of [employer, candidate]) {
      const invitations = await viewer.request('/invitations');
      const accepted = invitations.find(x => x.id === invitation.id);
      assert.equal(accepted.status, 'accepted'); assert.equal(accepted.contacts, null);
      assert.ok(!JSON.stringify(accepted).includes(profile.email)); assert.ok(!JSON.stringify(accepted).includes(profile.phone));
    }
    assert.ok(!(await otherEmployer.request('/invitations')).some(x => x.id === invitation.id));
  });
  await test('Published vacancies and self-application are persisted', async () => {
    vacancy = await employer.request('/vacancies', { demandId: demand.id }, undefined, 201); const all = await registered.request('/vacancies'); assert.ok(all.some(x => x.id === vacancy.id));
    await registered.request(`/vacancies/${vacancy.id}/apply`, {}); const own = await registered.request('/profile');
    assert.equal((await employer.request(`/candidates/${own.id}`)).contacts.email, own.email);
    assert.equal((await otherEmployer.request(`/candidates/${own.id}`, undefined, undefined, 404)).code, 'CANDIDATE_NOT_FOUND');
  });
  await test('Only application parties see statuses and only the owning employer can change them',async()=>{
    const own=await registered.request('/profile');
    application=(await registered.request('/applications')).find(x=>x.vacancyId===vacancy.id);
    assert.equal(application.status,'sent');assert.equal(application.candidateId,own.id);assert.equal(application.employerId,employerUser.id);
    assert.ok(application.title && application.company && application.salaryFrom>0 && application.updatedAt===application.createdAt);
    assert.ok(!('contacts' in application));assert.ok(!('email' in application));
    assert.deepEqual((await employer.request('/applications')).find(x=>x.id===application.id),application);
    assert.ok(!(await otherEmployer.request('/applications')).some(x=>x.id===application.id));
    assert.ok(!(await otherCandidate.request('/applications')).some(x=>x.id===application.id));
    await registered.request(`/applications/${application.id}/status`,{status:'accepted'},undefined,403);
    await otherEmployer.request(`/applications/${application.id}/status`,{status:'accepted'},undefined,404);
    await employer.request(`/applications/${application.id}/status`,{status:'sent'},undefined,400);
    await employer.request(`/applications/${application.id}/status`,{status:'viewed',candidateId:own.id},undefined,400);
    const viewed=await employer.request(`/applications/${application.id}/status`,{status:'viewed'});
    assert.equal(viewed.status,'viewed');assert.deepEqual((await registered.request('/applications')).find(x=>x.id===application.id),viewed);
    const accepted=await employer.request(`/applications/${application.id}/status`,{status:'accepted'});
    assert.equal(accepted.status,'accepted');
    assert.deepEqual(await employer.request(`/applications/${application.id}/status`,{status:'accepted'}),accepted);
    assert.equal((await employer.request(`/applications/${application.id}/status`,{status:'declined'},undefined,409)).code,'APPLICATION_FINAL');
    await registered.request(`/vacancies/${vacancy.id}/apply`,{});
    assert.deepEqual((await registered.request('/applications')).find(x=>x.id===application.id),accepted);
    await otherCandidate.request(`/vacancies/${vacancy.id}/apply`,{});
    const otherApplication=(await otherCandidate.request('/applications')).find(x=>x.vacancyId===vacancy.id);
    assert.equal((await employer.request(`/applications/${otherApplication.id}/status`,{status:'declined'})).status,'declined');
    assert.equal((await otherCandidate.request('/applications')).find(x=>x.id===otherApplication.id).status,'declined');
    assert.equal((await employer.request(`/applications/${otherApplication.id}/status`,{status:'accepted'},undefined,409)).code,'APPLICATION_FINAL');
  });
  await test('Processing consent gates self-application access and restoration remains employer-specific', async () => {
    const own = await registered.request('/profile');
    await registered.request('/profile', { name:`Участник ${own.email}`,consentProcessing: false }, 'PATCH');
    for (const viewer of [employer, otherEmployer]) {
      assert.equal((await viewer.request(`/candidates/${own.id}`, undefined, undefined, 404)).code, 'CANDIDATE_NOT_FOUND');
      assert.equal((await viewer.request(`/candidates/${own.id}/pdf`, undefined, undefined, 404)).code, 'CANDIDATE_NOT_FOUND');
    }
    await registered.request(`/vacancies/${vacancy.id}/apply`, {}, undefined, 403);
    assert.ok(!JSON.stringify(await employer.request('/applications')).includes(own.email));
    assert.equal((await registered.request('/questionnaires',{industry:'Образование',specialization:'backend',claimedGrade:'junior'},undefined,403)).code,'CONSENT_REQUIRED');
    await registered.request('/profile', { consentProcessing: true }, 'PATCH');
    assert.equal((await employer.request(`/candidates/${own.id}`)).contacts.email, own.email);
    await otherEmployer.request(`/candidates/${own.id}`, undefined, undefined, 404);
    await otherEmployer.request(`/candidates/${own.id}/pdf`, undefined, undefined, 404);
    // Accepted invitation permission also remains scoped after processing consent is restored.
    await candidate.request('/profile', { consentProcessing: true, name: 'Тестовый разработчик' }, 'PATCH');
    assert.equal((await employer.request(`/candidates/${candidateUser.id}`)).contacts.email, profile.email);
    assert.equal((await employer.request('/invitations')).find(x => x.id === invitation.id).contacts.email, profile.email);
    await otherEmployer.request(`/candidates/${candidateUser.id}`, undefined, undefined, 404);
  });
  const report = { kind: 'local-white-box-integration', passed: results.length, failed: 0, durationMs: Date.now() - started, results, pdfExpectedEmail: profile.email, pdfExpectedPhone: profile.phone,pdfExpectedRole:'Backend-разработчик',pdfExpectedSoftSkill:'Командная работа',pdfExpectedMessengerContacts:['@career_contacts_311','https://t.me/career_contacts_311','https://telegram.me/team_311'], note: 'Reference answers read only from local server storage by the test harness; one owned test demand snapshot is seeded with an old-version contact fixture to verify upgrade-safe redaction without rewriting stored history. This validates mechanics, not human ability. Local email confirmation uses a private demo-outbox; no real external mail delivery was exercised.' };
  mkdirSync('tests/results', { recursive: true }); writeFileSync('tests/results/api-local.json', JSON.stringify(report, null, 2));
  console.log(`${results.length} integration checks passed in ${report.durationMs}ms.`);
} catch (error) {
  mkdirSync('tests/results', { recursive: true }); writeFileSync('tests/results/api-local.json', JSON.stringify({ passed: results.length, failed: 1, results, error: String(error), durationMs: Date.now() - started }, null, 2));
  console.error(error); process.exitCode = 1;
}
