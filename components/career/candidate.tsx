"use client";
import { useCallback, useEffect, useState } from "react";
import {
  pruneExamDrafts,
  removeExamDraft,
  restoreExamDraft,
  saveExamDraft,
} from "./exam-draft";
import {
  ArrowDownToLine,
  ArrowLeft,
  ArrowRight,
  Award,
  BookOpen,
  Check,
  CheckCircle2,
  ChevronRight,
  Clock3,
  Code2,
  FileCheck2,
  Link2,
  LockKeyhole,
  Play,
  ShieldCheck,
  Sparkles,
  Unlink,
  XCircle,
} from "lucide-react";
import {
  api,
  categoryName,
  gradeName,
  money,
  shortDate,
  specName,
  words,
  type Candidate,
  type Exam,
  type Grade,
  type Invitation,
  type Meta,
  type QuestionnaireRecord,
  type Specialization,
  type TestResult,
  type User,
} from "./types";
import {
  Avatar,
  Badge,
  Button,
  Empty,
  Field,
  Loading,
  Modal,
  ScoreRing,
  SectionTitle,
  SkillTags,
  Toggle,
} from "./primitives";

type Props = {
  profile: Candidate;
  user: User;
  meta: Meta;
  invitations: Invitation[];
  navigate: (view: string) => void;
  refresh: () => Promise<void>;
  notify: (message: string, error?: boolean) => void;
};
export function CandidateOverview({
  profile,
  meta,
  invitations,
  navigate,
}: Props) {
  const pending = invitations.filter((i) => i.status === "pending");
  const completeness = Math.round(
    ([
      profile.name,
      profile.title,
      profile.city,
      profile.bio,
      profile.skills?.length,
      profile.verifiedGrade,
      profile.consentPublication,
    ].filter(Boolean).length /
      7) *
      100,
  );
  return (
    <>
      <SectionTitle
        eyebrow="ЛИЧНЫЙ КАБИНЕТ"
        title={`Здравствуйте, ${profile.name?.split(" ")[0] || "кандидат"}`}
        description="Ваша карьера начинается с того, что вы умеете."
        action={
          <a
            className="button secondary"
            href="/api/profile/pdf"
            target="_blank"
            rel="noreferrer"
          >
            <ArrowDownToLine size={16} /> Скачать резюме
          </a>
        }
      />
      <div className="candidate-overview-grid">
        <section className="profile-hero card">
          <div className="profile-hero-top">
            <Avatar name={profile.name} />
            <Badge tone={profile.verifiedGrade ? "green" : "amber"}>
              {profile.verifiedGrade ? (
                <>
                  <ShieldCheck size={13} /> Грейд подтверждён
                </>
              ) : (
                "Пройдите проверку навыков"
              )}
            </Badge>
          </div>
          <h2>{profile.name}</h2>
          <p>{profile.title || "Добавьте профессиональный заголовок"}</p>
          <div className="profile-category">
            <Code2 size={19} />
            <span>{categoryName(profile)}</span>
          </div>
          <div className="progress-label">
            <span>Готовность профиля</span>
            <strong>{completeness}%</strong>
          </div>
          <div className="progress-track">
            <span style={{ width: `${completeness}%` }} />
          </div>
          <button className="text-link" onClick={() => navigate("profile")}>
            Настроить профиль <ArrowRight size={15} />
          </button>
        </section>
        <section className="overview-invites card">
          <div className="card-title">
            <h2>Предложения для вас</h2>
            <span className="count-badge">{pending.length}</span>
          </div>
          {pending.length ? (
            pending.slice(0, 2).map((inv) => (
              <button
                className="invite-preview"
                key={inv.id}
                onClick={() => navigate("invitations")}
              >
                <div className="company-icon">{inv.company.slice(0, 1)}</div>
                <div>
                  <strong>{inv.company}</strong>
                  <p>{inv.title}</p>
                  <span>
                    {money(inv.salaryFrom)}–{money(inv.salaryTo)} ₽
                  </span>
                </div>
                <ChevronRight size={17} />
              </button>
            ))
          ) : (
            <div className="small-empty">
              <BriefcaseIcon />
              <p>
                Когда работодатель пригласит вас,
                <br />
                условия появятся здесь.
              </p>
            </div>
          )}
          <button className="text-link" onClick={() => navigate("invitations")}>
            Все приглашения <ArrowRight size={15} />
          </button>
        </section>
      </div>
      <div className="candidate-next-grid">
        <section className="card next-test">
          <div className="feature-icon blue">
            <FileCheck2 size={23} />
          </div>
          <div>
            <span className="micro-label">ПОДТВЕРЖДЁННЫЕ КОМПЕТЕНЦИИ</span>
            <h2>
              {profile.verifiedGrade
                ? "Проверка, которой можно доверять"
                : "Покажите свой уровень"}
            </h2>
            <p>
              Разные варианты по единому плану. Результат формирует вашу
              категорию и профиль навыков.
            </p>
            {profile.demonstratedSkills?.length ? (
              <SkillTags skills={profile.demonstratedSkills} verified />
            ) : null}
            <Button onClick={() => navigate("test")} variant="secondary">
              {profile.verifiedGrade ? "История и тестирование" : "Пройти тест"}
              <ArrowRight size={16} />
            </Button>
          </div>
        </section>
        <section className="card next-fsp">
          <div className="feature-icon">
            <Award size={24} />
          </div>
          <span className="micro-label">СПОРТИВНОЕ ПРОГРАММИРОВАНИЕ</span>
          <h2>
            {profile.fspVerified
              ? "Ваши достижения связаны"
              : "Добавьте достижения ФСП"}
          </h2>
          <p>
            {profile.fspVerified
              ? `${profile.achievements?.length || 0} достижений из демонстрационного реестра. Бонус учитывается внутри подтверждённого грейда.`
              : "Свяжите ID участника и подтвердите связь. Достижения дают ограниченный бонус при подборе."}
          </p>
          <button
            className="text-link"
            onClick={() => navigate("achievements")}
          >
            {profile.fspVerified ? "Посмотреть достижения" : "Связать профиль"}
            <ArrowRight size={15} />
          </button>
        </section>
      </div>
      <div className="privacy-strip">
        <LockKeyhole size={18} />
        <div>
          <strong>
            {profile.isPublic && profile.consentPublication
              ? "Профиль доступен работодателям"
              : "Профиль пока скрыт от работодателей"}
          </strong>
          <p>
            Контакты остаются закрыты до принятия приглашения или вашего
            отклика.
          </p>
        </div>
        <button className="text-link" onClick={() => navigate("profile")}>
          Приватность <ArrowRight size={14} />
        </button>
      </div>
      {meta.demoMode && (
        <p className="demo-footnote">
          Демонстрационный кабинет. Профиль и история ФСП используют
          синтетические данные.
        </p>
      )}
    </>
  );
}
function BriefcaseIcon() {
  return <BookOpen size={25} />;
}

export function CandidateProfile({ profile, user, refresh, notify }: Props) {
  const [form, setForm] = useState({
    ...profile,
    skillsText: (profile.skills || []).join(", "),
    rolesText: (profile.roles || []).join(", "),
    softSkillsText: (profile.softSkills || []).join(", "),
  });
  const [busy, setBusy] = useState(false);
  const [saveError, setSaveError] = useState("");
  const set = (key: string, value: unknown) =>
    setForm((f) => ({ ...f, [key]: value }));
  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaveError("");
    const roles = words(form.rolesText);
    const softSkills = words(form.softSkillsText);
    for (const [label, entries] of [
      ["Роли в команде", roles],
      ["Софт-скиллы", softSkills],
    ] as const) {
      if (entries.length > 30 || entries.some((entry) => entry.length > 80)) {
        setSaveError(`${label}: до 30 значений, каждое не длиннее 80 символов.`);
        return;
      }
    }
    setBusy(true);
    try {
      const saved = await api<Candidate>(
        "/api/profile",
        {
          name: form.name,
          title: form.title,
          city: form.city,
          phone: form.phone,
          bio: form.bio,
          skills: words(form.skillsText),
          roles,
          softSkills,
          experienceYears: Number(form.experienceYears || 0),
          industry: form.industry,
          specialization: form.specialization,
          claimedGrade: form.claimedGrade || "junior",
          consentProcessing: !!form.consentProcessing,
          consentPublication: !!form.consentPublication,
          isPublic: !!form.isPublic,
        },
        "PATCH",
      );
      setForm({
        ...saved,
        skillsText: (saved.skills || []).join(", "),
        rolesText: (saved.roles || []).join(", "),
        softSkillsText: (saved.softSkills || []).join(", "),
      });
      await refresh();
      notify("Профиль сохранён");
    } catch (e) {
      const message =
        e instanceof Error ? e.message : "Не удалось сохранить профиль";
      setSaveError(message);
      notify(message, true);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <SectionTitle
        eyebrow="ПРОФИЛЬ"
        title="Ваш опыт и компетенции"
        description="Расскажите о себе. Подтверждённые тестом навыки появятся отдельно."
        action={
          <a
            className="button secondary"
            href="/api/profile/pdf"
            target="_blank"
            rel="noreferrer"
          >
            <ArrowDownToLine size={16} /> PDF-резюме
          </a>
        }
      />
      <form onSubmit={save} className="profile-form-grid">
        <section className="card form-card">
          <h2>Основная информация</h2>
          <div className="form-grid">
            <Field label="Имя и фамилия">
              <input
                required
                maxLength={120}
                value={form.name || ""}
                onChange={(e) => set("name", e.target.value)}
              />
            </Field>
            <Field label="Город">
              <input
                value={form.city || ""}
                maxLength={120}
                onChange={(e) => set("city", e.target.value)}
                placeholder="Москва"
              />
            </Field>
            <Field label="Профессиональный заголовок">
              <input
                value={form.title || ""}
                maxLength={160}
                onChange={(e) => set("title", e.target.value)}
                placeholder="Backend-разработчик"
              />
            </Field>
            <Field
              label="Телефон"
              hint="Скрыт до принятия приглашения или отклика"
            >
              <input
                type="tel"
                value={form.phone || ""}
                maxLength={40}
                onChange={(e) => set("phone", e.target.value)}
                placeholder="+7 999 123-45-67"
              />
            </Field>
            <Field label="Специализация">
              <select
                value={form.specialization || "backend"}
                onChange={(e) => set("specialization", e.target.value)}
              >
                <option value="backend">Backend</option>
                <option value="frontend">Frontend</option>
              </select>
            </Field>
            <Field
              label="Предполагаемый уровень"
              hint="Грейд подтверждается отдельным тестом"
            >
              <select
                value={form.claimedGrade || "junior"}
                onChange={(e) => set("claimedGrade", e.target.value)}
              >
                <option value="junior">Junior</option>
                <option value="middle">Middle</option>
              </select>
            </Field>
            <Field label="Отрасль">
              <input
                value={form.industry || ""}
                maxLength={120}
                onChange={(e) => set("industry", e.target.value)}
                placeholder="Финтех, образование, e-commerce"
              />
            </Field>
            <Field label="Опыт работы, лет">
              <input
                type="number"
                min="0"
                max="50"
                step="0.5"
                value={form.experienceYears || 0}
                onChange={(e) => set("experienceYears", e.target.value)}
              />
            </Field>
          </div>
          <Field
            label="Навыки из резюме"
            hint="Через запятую. Эти навыки считаются заявленными, пока не проверены тестом."
          >
            <input
              value={form.skillsText}
              onChange={(e) => set("skillsText", e.target.value)}
              placeholder="TypeScript, SQL, API"
              maxLength={1000}
            />
          </Field>
          <div className="form-grid">
            <Field
              label="Роли в команде"
              hint="Через запятую. Роли описывают ваш опыт, а не подтверждённый грейд."
            >
              <input
                value={form.rolesText}
                onChange={(e) => set("rolesText", e.target.value)}
                placeholder="Разработчик, тимлид, аналитик"
                maxLength={1000}
              />
            </Field>
            <Field
              label="Софт-скиллы"
              hint="Через запятую. Указывайте навыки, которые можете подтвердить примерами."
            >
              <input
                value={form.softSkillsText}
                onChange={(e) => set("softSkillsText", e.target.value)}
                placeholder="Командная работа, коммуникация"
                maxLength={1000}
              />
            </Field>
          </div>
          <Field label="О себе и проектах">
            <textarea
              rows={5}
              value={form.bio || ""}
              onChange={(e) => set("bio", e.target.value)}
              maxLength={3000}
              placeholder="Какие задачи решали, за что отвечали, какой результат получили?"
            />
          </Field>
          {saveError && (
            <p className="inline-error" role="alert">
              {saveError}
            </p>
          )}
          <div className="form-save">
            <Button busy={busy} type="submit">
              Сохранить профиль <Check size={16} />
            </Button>
            <span>Изменения вступают в силу после сохранения</span>
          </div>
        </section>
        <aside className="profile-settings">
          <section className="card form-card">
            <h2>Приватность</h2>
            <Toggle
              checked={!!form.isPublic}
              onChange={(v) => set("isPublic", v)}
              label="Виден работодателям"
              description="Работодатели смогут найти ваш профиль в подборке."
            />
            <Toggle
              checked={!!form.consentPublication}
              onChange={(v) => set("consentPublication", v)}
              label="Согласие на публикацию"
              description="Разрешаю показывать имя, опыт, навыки и достижения в подборке."
            />
            <Toggle
              checked={!!form.consentProcessing}
              onChange={(v) => set("consentProcessing", v)}
              label="Обработка данных"
              description="Разрешаю использовать данные для тестирования и подбора работы."
            />
            <div className="info-note">
              <LockKeyhole size={16} />
              <p>Телефон и email закрыты, даже когда профиль опубликован.</p>
            </div>
            <div className="account-email">
              <span className="micro-label">EMAIL АККАУНТА</span>
              <p>{user.email}</p>
              <Badge tone={user.emailVerified ? "green" : "amber"}>
                {user.emailVerified ? "Подтверждён" : "Ожидает подтверждения"}
              </Badge>
            </div>
          </section>
          <section className="card form-card">
            <h2>Результат проверки</h2>
            <Badge tone={profile.verifiedGrade ? "blue" : "neutral"}>
              {categoryName(profile)}
            </Badge>
            <p className="muted">
              Изменение опыта и навыков в резюме не меняет подтверждённый грейд.
            </p>
            <SkillTags skills={profile.demonstratedSkills} verified />
          </section>
        </aside>
      </form>
    </>
  );
}

export function CandidateAchievements({
  profile,
  meta,
  refresh,
  notify,
}: Props) {
  const [id, setId] = useState("");
  const [proof, setProof] = useState("");
  const [busy, setBusy] = useState(false);
  async function link(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await api("/api/fsp/link", { fspId: id.trim(), proofCode: proof.trim() });
      await refresh();
      notify("Демо-профиль ФСП связан");
    } catch (e) {
      notify(e instanceof Error ? e.message : "Не удалось связать ID", true);
    } finally {
      setBusy(false);
    }
  }
  async function unlink() {
    setBusy(true);
    try {
      await api("/api/fsp/unlink", {});
      await refresh();
      notify("Связь с ФСП удалена");
    } catch (e) {
      notify(e instanceof Error ? e.message : "Не удалось удалить связь", true);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <SectionTitle
        eyebrow="ДОСТИЖЕНИЯ"
        title="Из соревнований — в профиль"
        description="Подтверждённые достижения дополняют компетенции, проверенные тестом."
      />
      <div className="achievement-layout">
        <section className="card achievement-main">
          <div className="fsp-banner">
            <img
              src="/brand/fsp-blue.svg"
              alt="Федерация спортивного программирования"
            />
            <Badge tone="amber">Демонстрационный реестр</Badge>
          </div>
          {profile.fspVerified ? (
            <>
              <div className="linked-heading">
                <ShieldCheck size={23} />
                <div>
                  <h2>Профиль связан</h2>
                  <p>
                    ID участника: <span className="mono">{profile.fspId}</span>
                  </p>
                </div>
                <Button variant="ghost" busy={busy} onClick={unlink}>
                  <Unlink size={16} /> Отвязать
                </Button>
              </div>
              <div className="achievement-list">
                {(profile.achievements || []).length ? (
                  profile.achievements.map((a, i) => (
                    <article key={a.id || i} className="achievement-item">
                      <div className="achievement-medal">
                        <Award size={24} />
                      </div>
                      <div>
                        <h3>{a.event || a.title || "Соревнование ФСП"}</h3>
                        <p>
                          {a.discipline || "Спортивное программирование"} ·{" "}
                          {shortDate(a.date)}
                        </p>
                        <div>
                          <Badge tone="blue">{a.result || "Участие"}</Badge>
                          {a.team && <Badge>Командный результат</Badge>}
                        </div>
                        <small>
                          Источник: {a.source || "Демо-адаптер ФСП"}
                        </small>
                      </div>
                      <ShieldCheck size={18} className="fsp-check" />
                    </article>
                  ))
                ) : (
                  <Empty
                    title="История пока пуста"
                    text="Связь подтверждена, но в реестре нет доступных достижений."
                  />
                )}
              </div>
            </>
          ) : (
            <>
              <h2>Свяжите ID участника</h2>
              <p className="muted">
                Нужны ID и код подтверждения связи. Произвольный ID не создаёт
                подтверждённое достижение.
              </p>
              <form onSubmit={link} className="form-stack">
                <Field label="ID ФСП">
                  <input
                    required
                    value={id}
                    onChange={(e) => setId(e.target.value)}
                    placeholder="Например, FSP-DEMO-001"
                    maxLength={80}
                  />
                </Field>
                <Field label="Код подтверждения">
                  <input
                    required
                    value={proof}
                    onChange={(e) => setProof(e.target.value)}
                    placeholder="Код из демо-реестра"
                    maxLength={80}
                  />
                </Field>
                <Button busy={busy} type="submit">
                  <Link2 size={16} /> Связать профиль
                </Button>
              </form>
            </>
          )}
        </section>
        <aside>
          <section className="card form-card">
            <div className="feature-icon blue">
              <ShieldCheck size={23} />
            </div>
            <h2>Как это влияет на подбор</h2>
            <p className="muted">
              Достижения дают ограниченный бонус внутри вашей подтверждённой
              категории. Они не заменяют тест и не компенсируют отсутствующий
              обязательный навык.
            </p>
            <div className="info-note">
              <Award size={17} />
              <p>
                Командное достижение показывается как командное — без оценки
                личного вклада.
              </p>
            </div>
          </section>
          {meta.registryExamples?.length > 0 && (
            <section className="card form-card demo-fixtures">
              <span className="micro-label">ДАННЫЕ ДЛЯ ПРОВЕРКИ</span>
              <p>
                Синтетические записи для демонстрации интеграции. Выберите
                пример, затем нажмите «Связать».
              </p>
              {meta.registryExamples.map((ex) => (
                <button
                  key={ex.fspId}
                  onClick={() => {
                    setId(ex.fspId);
                    setProof(ex.proofCode);
                  }}
                >
                  <strong>{ex.name}</strong>
                  <span>{ex.fspId}</span>
                  <small>Код: {ex.proofCode}</small>
                </button>
              ))}
            </section>
          )}
        </aside>
      </div>
    </>
  );
}

export function CandidateTest({ profile, user, refresh, notify }: Props) {
  const [exam, setExam] = useState<Exam | null>(null);
  const [history, setHistory] = useState<TestResult[]>([]);
  const [questionnaires, setQuestionnaires] = useState<QuestionnaireRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [industry, setIndustry] = useState(profile.industry || "");
  const [questionnaireError, setQuestionnaireError] = useState("");
  const [spec, setSpec] = useState<Specialization>(
    profile.specialization || "backend",
  );
  const [grade, setGrade] = useState<Grade>(profile.claimedGrade || "junior");
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [index, setIndex] = useState(0);
  const [result, setResult] = useState<TestResult | null>(null);
  const [remaining, setRemaining] = useState(0);
  const [confirm, setConfirm] = useState(false);
  useEffect(() => {
    let active = true;
    Promise.all([
      api<Exam | null>("/api/tests/current"),
      api<TestResult[]>("/api/tests/history"),
      api<QuestionnaireRecord[]>("/api/questionnaires/history"),
    ])
      .then(([e, h, records]) => {
        if (active) {
          const draft = e
            ? restoreExamDraft(e, user.id)
            : { answers: {}, index: 0 };
          pruneExamDrafts(user.id, e?.id);
          setAnswers(draft.answers);
          setIndex(draft.index);
          setExam(e);
          setHistory(h);
          setQuestionnaires(records);
          setLoading(false);
        }
      })
      .catch((e) => {
        if (active) {
          setLoading(false);
          notify(e.message, true);
        }
      });
    return () => {
      active = false;
    };
  }, [notify, user.id]);
  useEffect(() => {
    if (exam) saveExamDraft(exam.id, user.id, answers, index);
  }, [exam, answers, index, user.id]);
  useEffect(() => {
    if (!exam) return;
    const update = () =>
      setRemaining(
        Math.max(
          0,
          Math.ceil((new Date(exam.expiresAt).getTime() - Date.now()) / 1000),
        ),
      );
    update();
    const timer = setInterval(update, 1000);
    return () => clearInterval(timer);
  }, [exam]);
  async function start(event: React.FormEvent) {
    event.preventDefault();
    setQuestionnaireError("");
    if (!industry.trim()) {
      setQuestionnaireError("Укажите отрасль, в которой хотите работать.");
      return;
    }
    setBusy(true);
    setResult(null);
    try {
      const questionnaire = await api<QuestionnaireRecord>("/api/questionnaires", {
        industry: industry.trim(),
        specialization: spec,
        claimedGrade: grade,
      });
      setQuestionnaires((records) => [questionnaire, ...records]);
      const e = await api<Exam>("/api/tests/start", {
        specialization: spec,
        grade,
      });
      const draft = restoreExamDraft(e, user.id);
      pruneExamDrafts(user.id, e.id);
      setExam(e);
      setAnswers(draft.answers);
      setIndex(draft.index);
    } catch (e) {
      const message =
        e instanceof Error ? e.message : "Не удалось начать тест";
      setQuestionnaireError(message);
      notify(message, true);
    } finally {
      setBusy(false);
    }
  }
  async function submit() {
    if (!exam) return;
    setBusy(true);
    try {
      const res = await api<TestResult>(`/api/tests/${exam.id}/submit`, {
        answers,
      });
      removeExamDraft(exam.id);
      setResult(res);
      setExam(null);
      setConfirm(false);
      await refresh();
      setHistory(await api<TestResult[]>("/api/tests/history"));
      notify(
        res.passed
          ? "Грейд подтверждён"
          : "Результат сохранён. Посмотрите рекомендации.",
      );
    } catch (e) {
      notify(
        e instanceof Error ? e.message : "Не удалось отправить ответы",
        true,
      );
    } finally {
      setBusy(false);
    }
  }
  if (loading) return <Loading text="Проверяем текущую попытку…" />;
  if (exam) {
    const q = exam.questions[index];
    const answered = Object.keys(answers).length;
    const expired = remaining <= 0;
    return (
      <>
        <SectionTitle
          eyebrow="ПРОВЕРКА КОМПЕТЕНЦИЙ"
          title={`${specName(exam.specialization)} · ${gradeName(exam.grade)}`}
          description="Выберите один ответ. Можно вернуться к любому вопросу до отправки."
          action={
            <div className={`test-timer ${remaining < 60 ? "urgent" : ""}`}>
              <Clock3 size={18} />
              {Math.floor(remaining / 60)}:
              {String(remaining % 60).padStart(2, "0")}
            </div>
          }
        />
        <div className="exam-layout">
          <section className="card exam-question">
            <div className="question-meta">
              <span className="micro-label">
                ВОПРОС {index + 1} ИЗ {exam.questions.length}
              </span>
              <Badge tone="blue">{q.skill}</Badge>
            </div>
            <h2 className="question-prompt">{q.prompt}</h2>
            <div className="answer-options">
              {q.options.map((option, i) => (
                <label
                  key={option.id}
                  className={`answer-option ${answers[q.id] === option.id ? "selected" : ""}`}
                >
                  <input
                    type="radio"
                    name={q.id}
                    value={option.id}
                    checked={answers[q.id] === option.id}
                    disabled={expired || busy}
                    onChange={() =>
                      setAnswers((a) => ({ ...a, [q.id]: option.id }))
                    }
                  />
                  <span className="option-letter">
                    {String.fromCharCode(65 + i)}
                  </span>
                  <span>{option.text}</span>
                  {answers[q.id] === option.id && <CheckCircle2 size={18} />}
                </label>
              ))}
            </div>
            <div className="question-footer">
              <Button
                variant="ghost"
                disabled={index === 0 || busy}
                onClick={() => setIndex((i) => i - 1)}
              >
                <ArrowLeft size={15} /> Назад
              </Button>
              {index < exam.questions.length - 1 ? (
                <Button
                  variant="secondary"
                  onClick={() => setIndex((i) => i + 1)}
                >
                  Следующий вопрос <ArrowRight size={15} />
                </Button>
              ) : (
                <Button disabled={expired} onClick={() => setConfirm(true)}>
                  Проверить результат <Check size={16} />
                </Button>
              )}
            </div>
            {expired && (
              <p className="inline-error">
                Время попытки истекло. Обновите страницу, чтобы начать новую
                попытку.
              </p>
            )}
          </section>
          <aside className="card exam-navigation">
            <h3>Ваш прогресс</h3>
            <div className="progress-label">
              <span>Ответов</span>
              <strong>
                {answered} / {exam.questions.length}
              </strong>
            </div>
            <div className="progress-track">
              <span
                style={{
                  width: `${(answered / exam.questions.length) * 100}%`,
                }}
              />
            </div>
            <div className="question-grid">
              {exam.questions.map((question, i) => (
                <button
                  key={question.id}
                  aria-label={`Перейти к вопросу ${i + 1}${answers[question.id] ? ", ответ выбран" : ""}`}
                  className={`${i === index ? "current" : ""} ${answers[question.id] ? "answered" : ""}`}
                  onClick={() => setIndex(i)}
                >
                  {i + 1}
                </button>
              ))}
            </div>
            <div className="info-note">
              <LockKeyhole size={16} />
              <p>
                Ответы проверяются на сервере. Во время теста ключи правильных
                ответов недоступны.
              </p>
            </div>
            <Button
              variant="secondary"
              disabled={expired}
              onClick={() => setConfirm(true)}
              className="full"
            >
              Завершить тест
            </Button>
          </aside>
        </div>
        {confirm && (
          <Modal title="Отправить ответы?" onClose={() => setConfirm(false)}>
            <p className="modal-description">
              Вы ответили на {answered} из {exam.questions.length} вопросов.{" "}
              {answered < exam.questions.length
                ? "Пропущенные вопросы будут засчитаны как неверные. Вы можете вернуться и заполнить их."
                : "После отправки ответы нельзя будет изменить."}
            </p>
            <div className="modal-actions">
              <Button variant="secondary" onClick={() => setConfirm(false)}>
                Вернуться к тесту
              </Button>
              <Button busy={busy} onClick={submit}>
                Отправить на проверку
              </Button>
            </div>
          </Modal>
        )}
      </>
    );
  }
  return (
    <>
      <SectionTitle
        eyebrow="ПРОВЕРКА КОМПЕТЕНЦИЙ"
        title="Подтвердите свой грейд"
        description="Единый план проверки, разные задания, прозрачный результат."
      />
      {result && (
        <section
          className={`card result-card ${result.passed ? "passed" : "failed"}`}
        >
          <div className="result-heading">
            <div className="result-icon">
              {result.passed ? (
                <CheckCircle2 size={30} />
              ) : (
                <BookOpen size={30} />
              )}
            </div>
            <div>
              <p className="eyebrow">РЕЗУЛЬТАТ ПОПЫТКИ</p>
              <h2>
                {result.passed
                  ? "Уровень подтверждён"
                  : "Есть над чем поработать"}
              </h2>
              <p>
                {result.passed
                  ? `Категория: ${result.category || categoryName(profile)}`
                  : "Грейд не понижается автоматически. Можно проверить более низкий уровень или подготовиться к повторной попытке."}
              </p>
            </div>
            <ScoreRing score={result.score} />
          </div>
          <div className="result-metrics">
            <span>
              Порог прохождения: <strong>{result.threshold}%</strong>
            </span>
            <span>
              Ваш результат: <strong>{Math.round(result.score)}%</strong>
            </span>
          </div>
          {result.feedback?.length > 0 && (
            <details className="feedback-details">
              <summary>
                Разбор ответов <ChevronRight size={15} />
              </summary>
              <div>
                {result.feedback.map((f, i) => (
                  <p key={f.questionId || i}>
                    {f.correct === false ? (
                      <XCircle size={15} />
                    ) : (
                      <CheckCircle2 size={15} />
                    )}
                    <span>
                      <strong>{f.skill || `Вопрос ${i + 1}`}</strong>
                      {f.rationale ||
                        f.explanation ||
                        f.message ||
                        f.prompt ||
                        "Результат проверки сохранён"}
                    </span>
                  </p>
                ))}
              </div>
            </details>
          )}
        </section>
      )}
      <div className="test-start-grid">
        <form className="card test-start-card" onSubmit={start}>
          <div className="feature-icon blue">
            <FileCheck2 size={26} />
          </div>
          <h2>Анкета перед проверкой навыков</h2>
          <p className="muted">
            Укажите отрасль, специализацию и предполагаемый уровень. Анкета
            сохранится в истории. Категория присваивается по результату теста.
          </p>
          <div className="form-grid">
            <div className="questionnaire-industry">
              <Field label="Отрасль" hint="Например, финтех, образование или e-commerce.">
                <input
                  required
                  value={industry}
                  onChange={(e) => setIndustry(e.target.value)}
                  placeholder="В какой отрасли хотите работать?"
                  maxLength={120}
                  disabled={busy}
                  aria-invalid={!!questionnaireError && !industry.trim()}
                />
              </Field>
            </div>
            <Field label="Специализация">
              <select
                value={spec}
                onChange={(e) => setSpec(e.target.value as Specialization)}
                disabled={busy}
              >
                <option value="backend">Backend</option>
                <option value="frontend">Frontend</option>
              </select>
            </Field>
            <Field label="Предполагаемый грейд" hint="Это ваш выбор уровня теста. Он ещё не подтверждён.">
              <select
                value={grade}
                onChange={(e) => setGrade(e.target.value as Grade)}
                disabled={busy}
              >
                <option value="junior">Junior</option>
                <option value="middle">Middle</option>
              </select>
            </Field>
          </div>
          <div className="test-facts">
            <span>
              <Clock3 size={16} /> До 10 минут
            </span>
            <span>
              <Code2 size={16} /> Вариативные задания
            </span>
            <span>
              <ShieldCheck size={16} /> Серверная проверка
            </span>
          </div>
          {questionnaireError && (
            <p className="inline-error" role="alert">
              {questionnaireError}
            </p>
          )}
          <Button busy={busy} type="submit">
            <Play size={16} /> Сохранить анкету и начать тест
          </Button>
          <p className="fine-print">
            Проверяемый стек:{" "}
            {spec === "backend"
              ? "Python, SQL, HTTP и основы разработки"
              : "JavaScript, HTML/CSS, React и основы разработки"}
            . Изменение подтверждённой категории доступно раз в 90 дней. Первая
            неудача не блокирует попытку на уровень ниже.
          </p>
        </form>
        <section className="card test-standard">
          <p className="micro-label">КАК ФОРМИРУЕТСЯ КАТЕГОРИЯ</p>
          <div className="numbered-step">
            <span>1</span>
            <div>
              <h3>Равное покрытие</h3>
              <p>
                Каждый вариант проверяет одинаковый набор компетенций своего
                направления и уровня.
              </p>
            </div>
          </div>
          <div className="numbered-step">
            <span>2</span>
            <div>
              <h3>Контролируемые варианты</h3>
              <p>
                Меняются параметры и порядок ответов. Оценка опирается на
                проверенные эталоны.
              </p>
            </div>
          </div>
          <div className="numbered-step">
            <span>3</span>
            <div>
              <h3>Навыки отдельно от резюме</h3>
              <p>
                Работодатель увидит, какие компетенции подтверждены тестом, а
                какие вы заявили самостоятельно.
              </p>
            </div>
          </div>
        </section>
      </div>
      <div className="test-history-grid">
        <section className="card history-card questionnaire-history">
          <div className="card-title">
            <h2>История анкет</h2>
            <Badge>{questionnaires.length}</Badge>
          </div>
          <p className="history-description">
            Сохранённый выбор перед проверкой. Заявленный грейд не заменяет результат теста.
          </p>
          {questionnaires.length ? (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Отрасль</th>
                    <th>Специализация</th>
                    <th>Заявленный грейд</th>
                    <th>Дата</th>
                  </tr>
                </thead>
                <tbody>
                  {questionnaires.map((record) => (
                    <tr key={record.id}>
                      <td>{record.industry}</td>
                      <td>{specName(record.specialization)}</td>
                      <td><Badge>{gradeName(record.claimedGrade)}</Badge></td>
                      <td>{new Date(record.createdAt).toLocaleString("ru-RU", {
                        day: "numeric", month: "short", hour: "2-digit", minute: "2-digit",
                      })}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <Empty
              title="Первая анкета впереди"
              text="Заполните анкету перед тестом. Её ответы сохранятся здесь и останутся доступными после перезагрузки."
              icon={<BookOpen size={25} />}
            />
          )}
        </section>
        <section className="card history-card">
          <div className="card-title">
            <h2>История результатов</h2>
            <Badge>{history.length} попыток</Badge>
          </div>
          {history.length ? (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Направление</th>
                    <th>Уровень</th>
                    <th>Результат</th>
                    <th>Статус</th>
                    <th>Дата</th>
                  </tr>
                </thead>
                <tbody>
                  {history.map((h, i) => (
                    <tr key={h.id || i}>
                      <td>{specName(h.specialization)}</td>
                      <td>{gradeName(h.grade)}</td>
                      <td>
                        <strong>{Math.round(h.score)}%</strong>
                      </td>
                      <td>
                        <Badge tone={h.passed ? "green" : "amber"}>
                          {h.passed ? "Подтверждён" : "Не пройден"}
                        </Badge>
                      </td>
                      <td>{shortDate(h.submittedAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <Empty
              title="Пока нет попыток"
              text="Пройдите первую проверку — здесь появятся результаты и история подтверждения грейда."
              icon={<BookOpen size={25} />}
            />
          )}
        </section>
      </div>
    </>
  );
}
