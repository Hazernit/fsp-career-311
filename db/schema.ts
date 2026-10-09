import { sql } from 'drizzle-orm';
import { sqliteTable, text, integer, real, index, uniqueIndex } from 'drizzle-orm/sqlite-core';

export const users = sqliteTable('users', {
  id: text('id').primaryKey(), email: text('email').notNull().unique(), passwordHash: text('password_hash').notNull(),
  passwordSalt: text('password_salt').notNull(), role: text('role').notNull(), emailVerified: integer('email_verified').notNull().default(0),
  consentProcessing: integer('consent_processing').notNull().default(1), createdAt: text('created_at').notNull(),
});
export const profiles = sqliteTable('profiles', {
  id: text('id').primaryKey().references(() => users.id), name: text('name').notNull().default(''), title: text('title').notNull().default(''),
  city: text('city').notNull().default(''), phone: text('phone').notNull().default(''), bio: text('bio').notNull().default(''),
  skills: text('skills').notNull().default('[]'), experienceYears: real('experience_years').notNull().default(0), industry: text('industry').notNull().default(''),
  specialization: text('specialization').notNull().default('backend'), claimedGrade: text('claimed_grade').notNull().default('junior'),
  verifiedGrade: text('verified_grade'), demonstratedSkills: text('demonstrated_skills').notNull().default('[]'), testScore: real('test_score').notNull().default(0),
  lastVerifiedAt: text('last_verified_at'), isPublic: integer('is_public').notNull().default(0), consentPublication: integer('consent_publication').notNull().default(0),
  fspId: text('fsp_id'), fspVerified: integer('fsp_verified').notNull().default(0), achievements: text('achievements').notNull().default('[]'),
  company: text('company').notNull().default(''), website: text('website').notNull().default(''), description: text('description').notNull().default(''),
  contactName: text('contact_name').notNull().default(''), contactEmail: text('contact_email').notNull().default(''), contactMethod: text('contact_method').notNull().default('Email'),
  isSynthetic: integer('is_synthetic').notNull().default(0), updatedAt: text('updated_at').notNull(),
}, (t) => [index('profiles_category_idx').on(t.specialization, t.verifiedGrade, t.isPublic)]);
export const sessions = sqliteTable('sessions', {
  tokenHash: text('token_hash').primaryKey(), userId: text('user_id').notNull().references(() => users.id), createdAt: text('created_at').notNull(), expiresAt: text('expires_at').notNull(),
}, (t) => [index('sessions_user_idx').on(t.userId)]);
export const verificationTokens = sqliteTable('verification_tokens', {
  tokenHash: text('token_hash').primaryKey(), userId: text('user_id').notNull().references(() => users.id), expiresAt: text('expires_at').notNull(), usedAt: text('used_at'),
  // Only demo pending-session endpoint may read this; real delivery stores no plaintext token.
  demoToken: text('demo_token'),
});
export const authAttempts = sqliteTable('auth_attempts', {
  id: text('id').primaryKey(), key: text('key').notNull(), createdAt: text('created_at').notNull(),
}, (t) => [index('auth_attempts_window_idx').on(t.key, t.createdAt)]);
export const testAttempts = sqliteTable('test_attempts', {
  id: text('id').primaryKey(), userId: text('user_id').notNull().references(() => users.id), specialization: text('specialization').notNull(), grade: text('grade').notNull(),
  examJson: text('exam_json').notNull(), createdAt: text('created_at').notNull(), expiresAt: text('expires_at').notNull(), submittedAt: text('submitted_at'), resultJson: text('result_json'),
}, (t) => [index('test_user_idx').on(t.userId, t.createdAt), uniqueIndex('active_test_user_idx').on(t.userId).where(sql`${t.submittedAt} IS NULL`)]);
export const demands = sqliteTable('demands', {
  id: text('id').primaryKey(), employerId: text('employer_id').notNull().references(() => users.id), title: text('title').notNull(), description: text('description').notNull(),
  specialization: text('specialization').notNull(), grade: text('grade').notNull(), skills: text('skills').notNull(), mustHave: text('must_have').notNull(), industry: text('industry').notNull().default(''),
  salaryFrom: integer('salary_from'), salaryTo: integer('salary_to'), originalJson: text('original_json'), algorithmVersion: text('algorithm_version'), createdAt: text('created_at').notNull(),
}, (t) => [index('demand_employer_idx').on(t.employerId)]);
export const invitations = sqliteTable('invitations', {
  id: text('id').primaryKey(), employerId: text('employer_id').notNull().references(() => users.id), candidateId: text('candidate_id').notNull().references(() => users.id),
  demandId: text('demand_id').references(() => demands.id), salaryFrom: integer('salary_from').notNull(), salaryTo: integer('salary_to').notNull(), description: text('description').notNull(),
  contactMethod: text('contact_method').notNull(), status: text('status').notNull().default('pending'), createdAt: text('created_at').notNull(), respondedAt: text('responded_at'),
}, (t) => [index('invite_candidate_idx').on(t.candidateId), index('invite_employer_idx').on(t.employerId)]);
export const vacancies = sqliteTable('vacancies', {
  id: text('id').primaryKey(), demandId: text('demand_id').notNull().references(() => demands.id).unique(), employerId: text('employer_id').notNull().references(() => users.id), createdAt: text('created_at').notNull(),
});
export const applications = sqliteTable('applications', {
  id: text('id').primaryKey(), vacancyId: text('vacancy_id').notNull().references(() => vacancies.id), candidateId: text('candidate_id').notNull().references(() => users.id),
  employerId: text('employer_id').notNull().references(() => users.id), createdAt: text('created_at').notNull(),
}, (t) => [uniqueIndex('application_unique_idx').on(t.vacancyId, t.candidateId)]);
export const seedState = sqliteTable('seed_state', { key: text('key').primaryKey(), createdAt: text('created_at').notNull() });

export const demoPairs = sqliteTable('demo_pairs', {tokenHash:text('token_hash').primaryKey(),candidateId:text('candidate_id').references(()=>users.id),employerId:text('employer_id').references(()=>users.id),expiresAt:text('expires_at').notNull()});
