export type Role = "candidate" | "employer";
export type Specialization = "backend" | "frontend";
export type Grade = "junior" | "middle";
export type User = {
  id: string;
  email: string;
  role: Role;
  emailVerified: boolean;
  mailError?: string;
};
export type Achievement = {
  id?: string;
  event?: string;
  title?: string;
  discipline?: string;
  date?: string;
  result?: string;
  source?: string;
  team?: boolean;
  verified?: boolean;
};
export type Candidate = {
  id: string;
  name: string;
  title: string;
  city: string;
  phone?: string;
  email?: string;
  bio?: string;
  skills: string[];
  demonstratedSkills?: string[];
  experienceYears?: number;
  industry?: string;
  specialization: Specialization;
  claimedGrade?: Grade;
  verifiedGrade: Grade | null;
  testScore?: number | null;
  category?: string | null;
  consentProcessing?: boolean;
  consentPublication?: boolean;
  isPublic?: boolean;
  fspId?: string | null;
  fspVerified: boolean;
  achievements: Achievement[];
  nextGradeEligibleAt?: string | null;
  gradeVerifiedAt?: string | null;
  contactUnlocked?: boolean;
  contacts?: { email: string; phone?: string } | null;
  score?: number;
  achievementBonus?: number;
  reasons?: string[];
  gaps?: string[];
};
export type Employer = {
  id: string;
  company: string;
  website?: string;
  description?: string;
  contactName?: string;
  contactEmail?: string;
  contactMethod?: string;
};
export type Profile = Candidate | Employer;
export type Recommendation = Candidate;
export type Demand = {
  id: string;
  title: string;
  description: string;
  specialization: Specialization;
  grade: Grade;
  skills: string[];
  mustHave: string[];
  industry?: string;
  salaryFrom?: number;
  salaryTo?: number;
  createdAt: string;
  original: Recommendation[] | null;
};
export type Invitation = {
  id: string;
  candidateId: string;
  employerId: string;
  demandId?: string;
  company: string;
  candidateName: string;
  title: string;
  description: string;
  contactMethod: string;
  salaryFrom: number;
  salaryTo: number;
  status: "pending" | "accepted" | "declined";
  createdAt: string;
  respondedAt?: string | null;
  contacts: { email: string; phone?: string } | null;
};
export type Question = {
  id: string;
  prompt: string;
  options: { id: string; text: string }[];
  skill: string;
  kind?: string;
};
export type Exam = {
  id: string;
  specialization: Specialization;
  grade: Grade;
  questions: Question[];
  expiresAt: string;
  durationSeconds: number;
};
export type TestFeedback = {
  skill?: string;
  questionId?: string;
  correct?: boolean;
  message?: string;
  explanation?: string;
  rationale?: string;
  prompt?: string;
  correctAnswer?: string;
};
export type TestResult = {
  id?: string;
  specialization?: Specialization;
  grade?: Grade;
  passed: boolean;
  score: number;
  threshold: number;
  verifiedGrade?: Grade | null;
  category?: string | null;
  feedback: TestFeedback[];
  nextEligibleAt?: string | null;
  submittedAt?: string;
  demonstratedSkills?: string[];
};
export type Meta = {
  demoMode: boolean;
  categories: {
    id?: string;
    specialization: Specialization;
    grade: Grade;
    label?: string;
  }[];
  registryExamples: { fspId: string; proofCode: string; name: string }[];
  algorithmVersion: string;
};
export type Vacancy = {
  id: string;
  title: string;
  company: string;
  description: string;
  specialization: Specialization;
  grade: Grade;
  skills: string[];
  salaryFrom?: number;
  salaryTo?: number;
  applied?: boolean;
  employerId?: string;
};
export const specName = (s?: string) =>
  s === "frontend" ? "Frontend" : s === "backend" ? "Backend" : "Не выбрана";
export const gradeName = (g?: string | null) =>
  g ? g.charAt(0).toUpperCase() + g.slice(1) : "Не подтверждён";
export const categoryName = (
  c: Pick<Candidate, "specialization" | "verifiedGrade">,
) => `${specName(c.specialization)} · ${gradeName(c.verifiedGrade)}`;
export const money = (n: number) => new Intl.NumberFormat("ru-RU").format(n);
export const shortDate = (d?: string | null) =>
  d
    ? new Intl.DateTimeFormat("ru-RU", {
        day: "numeric",
        month: "short",
      }).format(new Date(d))
    : "—";
export const words = (s: string) =>
  Array.from(
    new Set(
      s
        .split(/[,;\n]+/)
        .map((x) => x.trim())
        .filter(Boolean),
    ),
  );
export const initials = (s?: string) =>
  (s || "?")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((x) => x[0])
    .join("")
    .toUpperCase();
export async function api<T>(
  path: string,
  body?: unknown,
  method?: string,
): Promise<T> {
  const response = await fetch(path, {
    method: method || (body === undefined ? "GET" : "POST"),
    credentials: "same-origin",
    headers:
      body === undefined ? undefined : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const result = (await response.json().catch(() => ({
    error: { message: "Сервер вернул неполный ответ. Попробуйте ещё раз." },
  }))) as { data?: unknown; error?: { message?: string } };
  if (!response.ok || result.error)
    throw new Error(result.error?.message || "Не удалось выполнить действие.");
  return result.data as T;
}
