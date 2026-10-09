import { database, newId, timestamp } from './db';
import { syntheticCandidates } from '../domain/seed';

export const SEED_EMPLOYER = 'seed_employer_fsp_demo';
export async function ensureSeed(): Promise<void> {
  const db = database();
  const exists = await db.prepare('SELECT key FROM seed_state WHERE key = ?').bind('portfolio-v1').first();
  if (exists) return;
  const now = timestamp();
  const statements: D1PreparedStatement[] = [];
  statements.push(db.prepare(`INSERT OR IGNORE INTO users(id,email,password_hash,password_salt,role,email_verified,consent_processing,created_at) VALUES(?,?,?,'','employer',1,1,?)`).bind(SEED_EMPLOYER, 'demo-employer@fsp.invalid', 'disabled', now));
  statements.push(db.prepare(`INSERT OR IGNORE INTO profiles(id,name,company,description,contact_name,contact_email,contact_method,is_synthetic,updated_at) VALUES(?,?,?,?,?,?,?,1,?)`).bind(SEED_EMPLOYER, 'Команда демо', 'Орбита · демо-компания', 'Синтетическая компания для демонстрации приглашений.', 'Демо-рекрутер', 'recruiter@fsp.invalid', 'Email', now));
  for (const candidate of syntheticCandidates) {
    statements.push(db.prepare(`INSERT OR IGNORE INTO users(id,email,password_hash,password_salt,role,email_verified,consent_processing,created_at) VALUES(?,?,?,'','candidate',1,1,?)`).bind(candidate.id, candidate.email, 'disabled', now));
    statements.push(db.prepare(`INSERT OR IGNORE INTO profiles(id,name,title,city,phone,bio,skills,experience_years,industry,specialization,claimed_grade,verified_grade,demonstrated_skills,test_score,last_verified_at,is_public,consent_publication,fsp_id,fsp_verified,achievements,is_synthetic,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,1,1,?,?,?,1,?)`).bind(
      candidate.id, candidate.name, candidate.title, candidate.city, candidate.phone, candidate.bio || '', JSON.stringify(candidate.skills), candidate.experienceYears, candidate.industry || '', candidate.specialization, candidate.claimedGrade, candidate.verifiedGrade,
      JSON.stringify(candidate.demonstratedSkills), candidate.testScore, '2026-01-01T00:00:00.000Z', candidate.fspId || null, (candidate.achievements || []).some(a => a.verified) ? 1 : 0, JSON.stringify(candidate.achievements || []), now,
    ));
  }
  statements.push(db.prepare('INSERT OR IGNORE INTO seed_state(key,created_at) VALUES(?,?)').bind('portfolio-v1', now));
  await db.batch(statements);
}
export async function seedDemoInvitation(candidateId: string): Promise<void> {
  await database().prepare(`INSERT INTO invitations(id,employer_id,candidate_id,salary_from,salary_to,description,contact_method,status,created_at) VALUES(?,?,?,90000,130000,?,?,'pending',?)`).bind(
    newId('invite'), SEED_EMPLOYER, candidateId, 'Демонстрационное приглашение. Ищем Backend Junior для команды продукта: API, SQL и автоматические тесты. Можно принять или отклонить, чтобы проверить раскрытие контактов.', 'Email после принятия', timestamp(),
  ).run();
}
