import { all, database, newId, one, timestamp } from './db';
import { ApiError, bad, choice, rateLimit, string } from './security';
import type { UserRow } from './security';
import type { Grade, Specialization } from '../domain/tests';

interface QuestionnaireRow {
  id: string; user_id: string; industry: string; specialization: Specialization; claimed_grade: Grade; created_at: string;
}
function questionnaireDto(row: QuestionnaireRow) {
  return { id: row.id, industry: row.industry, specialization: row.specialization, claimedGrade: row.claimed_grade, createdAt: row.created_at };
}
export async function createQuestionnaire(user: UserRow, body: Record<string, unknown>) {
  if (!user.consent_processing) throw new ApiError(403,'CONSENT_REQUIRED','Разрешите обработку данных для заполнения анкеты.');
  if (Object.keys(body).some(key => !['industry','specialization','claimedGrade'].includes(key))) bad('Запрос содержит недоступные поля анкеты.');
  const industry = string(body.industry,'отрасль',120,true);
  const specialization = choice(body.specialization,['backend','frontend'] as const,'специализацию');
  const claimedGrade = choice(body.claimedGrade,['junior','middle'] as const,'предполагаемый грейд');
  await rateLimit(`questionnaire:${user.id}`,30,3600000);
  const id = newId('questionnaire'), createdAt = timestamp();
  // Questionnaire self-assessment cannot change a previously verified category.
  // Persist history and profile context together; old records are never overwritten.
  await database().batch([
    database().prepare('INSERT INTO questionnaire_attempts(id,user_id,industry,specialization,claimed_grade,created_at) VALUES(?,?,?,?,?,?)').bind(id,user.id,industry,specialization,claimedGrade,createdAt),
    database().prepare('UPDATE profiles SET industry = ?, claimed_grade = ?, specialization = CASE WHEN verified_grade IS NULL THEN ? ELSE specialization END, updated_at = ? WHERE id = ?').bind(industry,claimedGrade,specialization,createdAt,user.id),
  ]);
  return {id,industry,specialization,claimedGrade,createdAt};
}
export async function questionnaireHistory(user: UserRow) {
  const rows = await all<QuestionnaireRow>('SELECT * FROM questionnaire_attempts WHERE user_id = ? ORDER BY created_at DESC, rowid DESC',user.id);
  return rows.map(questionnaireDto);
}
export async function requiredQuestionnaire(user: UserRow, specialization: Specialization, grade: Grade) {
  const latest = await one<QuestionnaireRow>('SELECT * FROM questionnaire_attempts WHERE user_id = ? ORDER BY created_at DESC, rowid DESC LIMIT 1',user.id);
  if (!latest || !latest.industry.trim() || latest.specialization !== specialization || latest.claimed_grade !== grade) {
    throw new ApiError(409,'QUESTIONNAIRE_REQUIRED','Сначала сохраните анкету с отраслью, выбранной специализацией и предполагаемым грейдом для этого теста.');
  }
  return latest;
}
