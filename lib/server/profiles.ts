import { all, one, parseJson } from './db';
import type { MatchCandidate } from '../domain/matching';
import type { UserRow } from './security';
import { ApiError } from './security';
import { redactContactText } from './privacy';

export interface ProfileRow {
  id: string; name: string; title: string; city: string; phone: string; bio: string; skills: string; roles: string; soft_skills: string; experience_years: number; industry: string;
  specialization: 'backend'|'frontend'; claimed_grade: 'junior'|'middle'; verified_grade: 'junior'|'middle'|null;
  demonstrated_skills: string; test_score: number; last_verified_at: string|null; is_public: number; consent_publication: number;
  fsp_id: string|null; fsp_verified: number; achievements: string; company: string; website: string; description: string; contact_name: string; contact_email: string; contact_method: string;
  is_synthetic: number; updated_at: string;
}
export async function profileRow(id: string): Promise<ProfileRow> {
  const row = await one<ProfileRow>('SELECT * FROM profiles WHERE id = ?', id);
  if (!row) throw new ApiError(404, 'PROFILE_NOT_FOUND', 'Профиль не найден.');
  return row;
}
export function category(specialization: string, grade: string|null) { return grade ? `${specialization === 'backend' ? 'Backend' : 'Frontend'} · ${grade === 'middle' ? 'Middle' : 'Junior'}` : null; }
export function candidateBase(row: ProfileRow, revealFreeformContacts = false) {
  const safe = revealFreeformContacts ? (value:string)=>value : redactContactText;
  return {
    id: row.id, name: safe(row.name), title: safe(row.title), city: safe(row.city), bio: safe(row.bio), specialization: row.specialization, claimedGrade: row.claimed_grade,
    verifiedGrade: row.verified_grade, category: category(row.specialization, row.verified_grade), skills: parseJson<string[]>(row.skills, []).map(safe),
    roles: parseJson<string[]>(row.roles, []).map(safe), softSkills: parseJson<string[]>(row.soft_skills, []).map(safe),
    demonstratedSkills: parseJson<string[]>(row.demonstrated_skills, []), testScore: row.test_score, industry: safe(row.industry),
    experienceYears: row.experience_years, fspVerified: !!row.fsp_verified, achievements: parseJson(row.achievements, []),
    lastVerifiedAt: row.last_verified_at, synthetic: !!row.is_synthetic,
  };
}
export function ownProfile(row: ProfileRow, user: UserRow) {
  if (user.role === 'employer') return { id: row.id, company: row.company, website: row.website, description: row.description, contactName: row.contact_name, contactEmail: row.contact_email, contactMethod: row.contact_method };
  return { ...candidateBase(row,true), phone: row.phone, email: user.email, consentProcessing: !!user.consent_processing, consentPublication: !!row.consent_publication, isPublic: !!row.is_public,
    fspId: row.fsp_id, nextGradeEligibleAt: row.last_verified_at ? new Date(new Date(row.last_verified_at).getTime() + 90 * 86400000).toISOString() : null };
}
export async function unlocked(employerId: string, candidateId: string): Promise<boolean> {
  const permission = await one<{ id: string }>(`SELECT id FROM invitations WHERE employer_id = ? AND candidate_id = ? AND status = 'accepted'
    UNION ALL SELECT id FROM applications WHERE employer_id = ? AND candidate_id = ? LIMIT 1`, employerId, candidateId, employerId, candidateId);
  return !!permission;
}
export async function publicCandidate(candidateId: string, employerId: string) {
  const row = await one<ProfileRow & { email: string; consent_processing: number }>(`SELECT p.*, u.email, u.consent_processing FROM profiles p JOIN users u ON u.id = p.id WHERE p.id = ? AND u.role = 'candidate'`, candidateId);
  if (!row || !row.consent_processing) throw new ApiError(404, 'CANDIDATE_NOT_FOUND', 'Кандидат не найден.');
  const access = await unlocked(employerId, candidateId);
  // An existing conversation survives publication withdrawal only while processing consent remains active.
  if ((!row.is_public || !row.consent_publication) && !access) throw new ApiError(404, 'CANDIDATE_NOT_FOUND', 'Кандидат не найден.');
  return { ...candidateBase(row,access), contactUnlocked: access, contacts: access ? { email: row.email, phone: row.phone } : null };
}
export async function matchingCandidates(): Promise<MatchCandidate[]> {
  const rows = await all<ProfileRow>(`SELECT p.* FROM profiles p JOIN users u ON u.id = p.id WHERE u.role = 'candidate' AND u.email_verified = 1 AND u.consent_processing = 1 AND p.is_public = 1 AND p.consent_publication = 1 AND p.verified_grade IS NOT NULL ORDER BY p.id`);
  // Never copy database rows into public ranking DTOs: contacts are excluded structurally.
  return rows.map(row => ({ ...candidateBase(row), category: category(row.specialization, row.verified_grade) || undefined, contactUnlocked: false }));
}
