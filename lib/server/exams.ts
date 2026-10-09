import { all, database, newId, one, parseJson, timestamp } from './db';
import { ApiError, bad, choice, rateLimit } from './security';
import type { UserRow } from './security';
import { category, profileRow } from './profiles';
import { canStartExam, evaluateExam, generateExam, publicExam } from '../domain/tests';

interface AttemptRow {id:string;user_id:string;specialization:'backend'|'frontend';grade:'junior'|'middle';exam_json:string;created_at:string;expires_at:string;submitted_at:string|null;result_json:string|null;}
function examView(row: AttemptRow) {
  const exam = JSON.parse(row.exam_json);
  return { ...publicExam(exam), id:row.id, expiresAt:row.expires_at, createdAt:row.created_at };
}
export async function currentExam(user: UserRow) {
  const row = await one<AttemptRow>('SELECT * FROM test_attempts WHERE user_id = ? AND submitted_at IS NULL AND expires_at > ? ORDER BY created_at DESC LIMIT 1',user.id,timestamp());
  return row ? examView(row) : null;
}
export async function startExam(user: UserRow, body: Record<string, unknown>) {
  const specialization = choice(body.specialization,['backend','frontend'] as const,'специализацию');
  const grade = choice(body.grade,['junior','middle'] as const,'грейд');
  if (!user.consent_processing) throw new ApiError(403,'CONSENT_REQUIRED','Разрешите обработку данных для проверки компетенций.');
  const profile = await profileRow(user.id);
  const policy = canStartExam({specialization,grade,verifiedSpecialization:profile.verified_grade ? profile.specialization : undefined,verifiedGrade:profile.verified_grade || undefined,lastVerifiedAt:profile.last_verified_at || undefined});
  if (!policy.allowed) throw new ApiError(409,'GRADE_COOLDOWN',policy.reason || `Следующее подтверждение доступно ${policy.nextEligibleAt}.`);
  const active = await one<AttemptRow>('SELECT * FROM test_attempts WHERE user_id = ? AND submitted_at IS NULL AND expires_at > ? ORDER BY created_at DESC LIMIT 1',user.id,timestamp());
  if (active) {
    if (active.specialization === specialization && active.grade === grade) return examView(active);
    throw new ApiError(409,'EXAM_ACTIVE','Сначала завершите текущий тест или дождитесь окончания его времени.');
  }
  const last = await one<AttemptRow>('SELECT * FROM test_attempts WHERE user_id = ? AND specialization = ? AND grade = ? AND submitted_at IS NOT NULL ORDER BY submitted_at DESC LIMIT 1',user.id,specialization,grade);
  if (last && new Date(last.submitted_at!).getTime() + 10*60000 > Date.now()) throw new ApiError(409,'ATTEMPT_COOLDOWN','Повтор этого уровня доступен через 10 минут. После первой неудачи можно сразу выбрать уровень ниже.');
  await rateLimit(`exam:${user.id}`,10,3600000);
  const exam = generateExam({specialization,grade,seed:crypto.randomUUID(),durationSeconds:600});
  const id = newId('test');
  const createdAt = timestamp();
  const expiresAt = new Date(Date.now() + exam.durationSeconds*1000).toISOString();
  await database().prepare('UPDATE test_attempts SET submitted_at = ?, result_json = ? WHERE user_id = ? AND submitted_at IS NULL AND expires_at <= ?').bind(createdAt,JSON.stringify({passed:false,score:0,threshold:75,expired:true,submittedAt:createdAt}),user.id,createdAt).run();
  await database().prepare('INSERT INTO test_attempts(id,user_id,specialization,grade,exam_json,created_at,expires_at) VALUES(?,?,?,?,?,?,?)').bind(id,user.id,specialization,grade,JSON.stringify(exam),createdAt,expiresAt).run();
  return {...publicExam(exam),id,createdAt,expiresAt};
}
export async function submitExam(user: UserRow, id: string, body: Record<string, unknown>) {
  if (!user.consent_processing) throw new ApiError(403,'CONSENT_REQUIRED','Разрешите обработку данных для проверки компетенций.');
  const row = await one<AttemptRow>('SELECT * FROM test_attempts WHERE id = ? AND user_id = ?',id,user.id);
  if (!row) throw new ApiError(404,'EXAM_NOT_FOUND','Тест не найден.');
  if (row.submitted_at) throw new ApiError(409,'EXAM_ALREADY_SUBMITTED','Результат уже сохранён.');
  if (row.expires_at <= timestamp()) throw new ApiError(409,'EXAM_EXPIRED','Время теста истекло. Начните новый вариант.');
  const exam = JSON.parse(row.exam_json);
  const answers = body.answers;
  if (!answers || typeof answers !== 'object' || Array.isArray(answers)) bad('Ожидается объект ответов.');
  const answerMap = answers as Record<string, unknown>;
  const questions = exam.questions as Array<{id:string;options:Array<{id:string}>}>;
  if (Object.keys(answerMap).some(id=>!questions.some(q=>q.id===id)) || Object.entries(answerMap).some(([id,answer])=>typeof answer !== 'string' || !questions.find(q=>q.id===id)!.options.some(o=>o.id===answer))) bad('Запрос содержит неизвестный вопрос или вариант ответа.');
  const result = evaluateExam(exam,answerMap as Record<string,string>);
  const profile = await profileRow(user.id);
  const submittedAt = timestamp();
  const verifiedGrade = result.passed ? row.grade : profile.verified_grade;
  const verifiedSpecialization = result.passed ? row.specialization : profile.specialization;
  const fullResult = {...result,verifiedGrade,category:category(verifiedSpecialization,verifiedGrade),submittedAt,nextEligibleAt:result.passed ? new Date(Date.now()+90*86400000).toISOString() : (profile.last_verified_at ? new Date(new Date(profile.last_verified_at).getTime()+90*86400000).toISOString() : null)};
  const resultJson = JSON.stringify(fullResult);
  const statements = [database().prepare('UPDATE test_attempts SET submitted_at = ?, result_json = ? WHERE id = ? AND user_id = ? AND submitted_at IS NULL AND expires_at > ?').bind(submittedAt,resultJson,id,user.id,submittedAt)];
  if (result.passed) statements.push(database().prepare(`UPDATE profiles SET specialization = ?, claimed_grade = ?, verified_grade = ?, demonstrated_skills = ?, test_score = ?, last_verified_at = ?, updated_at = ?
    WHERE id = ? AND EXISTS(SELECT id FROM test_attempts WHERE id = ? AND submitted_at = ? AND result_json = ?)`).bind(row.specialization,row.grade,row.grade,JSON.stringify(result.demonstratedSkills),result.score,submittedAt,submittedAt,user.id,id,submittedAt,resultJson));
  const results = await database().batch(statements);
  if (!results[0].meta.changes) throw new ApiError(409,'EXAM_ALREADY_SUBMITTED','Результат уже сохранён другим запросом.');
  return fullResult;
}
export async function testHistory(user: UserRow) {
  const rows = await all<AttemptRow>('SELECT * FROM test_attempts WHERE user_id = ? AND submitted_at IS NOT NULL ORDER BY submitted_at DESC LIMIT 100',user.id);
  return rows.map(row=>({id:row.id,specialization:row.specialization,grade:row.grade,...parseJson<Record<string,unknown>>(row.result_json,{}),submittedAt:row.submitted_at}));
}
