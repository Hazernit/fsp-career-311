"use client";
import { useEffect, useState } from "react";
import {
  ArrowDownToLine,
  ArrowRight,
  Award,
  Check,
  CheckCircle2,
  ChevronDown,
  Code2,
  FileCheck2,
  Filter,
  LockKeyhole,
  Plus,
  Search,
  Send,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Users,
  X,
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
  type Demand,
  type Employer,
  type Grade,
  type Meta,
  type Recommendation,
  type Specialization,
} from "./types";
import {
  Avatar,
  Badge,
  Button,
  CandidateCard,
  Empty,
  Field,
  Loading,
  Modal,
  ScoreRing,
  SectionTitle,
  SkillTags,
} from "./primitives";

type Common = {
  profile: Employer;
  meta: Meta;
  refresh: () => Promise<void>;
  notify: (message: string, error?: boolean) => void;
};
export function EmployerMatching({
  profile,
  meta,
  demands,
  selectedId,
  selectDemand,
  refresh,
  notify,
}: Common & {
  demands: Demand[];
  selectedId: string;
  selectDemand: (id: string) => void;
}) {
  const [creating, setCreating] = useState(false);
  const [matching, setMatching] = useState(false);
  const [search, setSearch] = useState("");
  const [skill, setSkill] = useState("");
  const [fspOnly, setFspOnly] = useState(false);
  const [city, setCity] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [detail, setDetail] = useState<Candidate | null>(null);
  const [inviting, setInviting] = useState<Candidate | null>(null);
  const demand = demands.find((d) => d.id === selectedId) || demands[0];
  const original = demand?.original || [];
  const filtered = original.filter((c) => {
    const text =
      `${c.name} ${c.title} ${c.city} ${(c.skills || []).join(" ")} ${(c.demonstratedSkills || []).join(" ")}`.toLowerCase();
    return (
      (!search || text.includes(search.toLowerCase())) &&
      (!fspOnly || c.fspVerified) &&
      (!skill ||
        (c.demonstratedSkills || []).some(
          (s) => s.toLowerCase() === skill.toLowerCase(),
        ) ||
        (c.skills || []).some(
          (s) => s.toLowerCase() === skill.toLowerCase(),
        )) &&
      (!city || c.city === city)
    );
  });
  const allSkills = Array.from(
    new Set(
      original.flatMap((c) => [
        ...(c.demonstratedSkills || []),
        ...(c.skills || []),
      ]),
    ),
  ).sort();
  const cities = Array.from(
    new Set(original.map((c) => c.city).filter(Boolean)),
  ).sort();
  const filterCount =
    Number(!!search) + Number(!!skill) + Number(fspOnly) + Number(!!city);
  async function match() {
    if (!demand) return;
    setMatching(true);
    try {
      await api(`/api/demands/${demand.id}/match`, {});
      await refresh();
      notify("Исходная подборка сохранена");
    } catch (e) {
      notify(
        e instanceof Error ? e.message : "Не удалось выполнить подбор",
        true,
      );
    } finally {
      setMatching(false);
    }
  }
  return (
    <>
      <SectionTitle
        eyebrow="ПОДБОР КАНДИДАТОВ"
        title="Найдите своих людей"
        description="Опишите задачу. Выбирайте по подтверждённым компетенциям."
        action={
          <Button onClick={() => setCreating(true)}>
            <Plus size={17} /> Новая потребность
          </Button>
        }
      />
      <div className="matching-layout">
        <div className="matching-main">
          {demands.length > 0 && (
            <div className="demand-selector">
              <span className="micro-label">АКТИВНАЯ ПОТРЕБНОСТЬ</span>
              <select
                aria-label="Выберите потребность"
                value={demand?.id || ""}
                onChange={(e) => {
                  selectDemand(e.target.value);
                  setSearch("");
                  setSkill("");
                  setFspOnly(false);
                  setCity("");
                }}
              >
                {demands.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.title}
                  </option>
                ))}
              </select>
              <Badge tone="blue">
                {specName(demand?.specialization)} · {gradeName(demand?.grade)}
              </Badge>
            </div>
          )}
          {demand ? (
            <>
              <div className="search-toolbar">
                <div className="search-input">
                  <Search size={18} />
                  <input
                    aria-label="Поиск в подборке"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Имя, навык или город"
                  />
                  {search && (
                    <button
                      className="icon-button"
                      aria-label="Очистить поиск"
                      onClick={() => setSearch("")}
                    >
                      <X size={15} />
                    </button>
                  )}
                </div>
                <Button
                  variant={showFilters ? "primary" : "secondary"}
                  onClick={() => setShowFilters((v) => !v)}
                >
                  <SlidersHorizontal size={16} /> Фильтры
                  {filterCount > 0 && (
                    <span className="button-count">{filterCount}</span>
                  )}
                </Button>
              </div>
              {showFilters && (
                <div className="filter-panel">
                  <Field label="Навык">
                    <select
                      value={skill}
                      onChange={(e) => setSkill(e.target.value)}
                    >
                      <option value="">Все навыки</option>
                      {allSkills.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Город">
                    <select
                      value={city}
                      onChange={(e) => setCity(e.target.value)}
                    >
                      <option value="">Все города</option>
                      {cities.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <label className="check-label">
                    <input
                      type="checkbox"
                      checked={fspOnly}
                      onChange={(e) => setFspOnly(e.target.checked)}
                    />
                    <span>С достижениями ФСП</span>
                  </label>
                </div>
              )}
              <div className="results-heading">
                <div>
                  <h2>
                    {filtered.length}{" "}
                    {filtered.length === 1
                      ? "кандидат"
                      : filtered.length > 1 && filtered.length < 5
                        ? "кандидата"
                        : "кандидатов"}
                  </h2>
                  <span>По соответствию вашей потребности</span>
                </div>
                {filterCount > 0 ? (
                  <button
                    className="text-link muted"
                    onClick={() => {
                      setSearch("");
                      setSkill("");
                      setCity("");
                      setFspOnly(false);
                    }}
                  >
                    Сбросить фильтры <X size={13} />
                  </button>
                ) : (
                  <span className="sort-label">
                    <ArrowDownToLine size={13} /> Лучшее соответствие
                  </span>
                )}
              </div>
              {matching ? (
                <Loading text="Проверяем категории и компетенции…" />
              ) : demand.original === null ? (
                <Empty
                  title="Потребность готова"
                  text="Запустите подбор: система сначала проверит категорию, затем сопоставит навыки и достижения."
                  icon={<Users size={27} />}
                  action={
                    <Button onClick={match}>
                      <Sparkles size={16} /> Подобрать кандидатов
                    </Button>
                  }
                />
              ) : filtered.length ? (
                <div className="candidate-list">
                  {filtered.map((candidate) => (
                    <CandidateCard
                      key={candidate.id}
                      candidate={candidate}
                      index={original.findIndex((c) => c.id === candidate.id)}
                      onView={() => setDetail(candidate)}
                      onInvite={() => setInviting(candidate)}
                    />
                  ))}
                </div>
              ) : (
                <Empty
                  title={
                    filterCount
                      ? "Нет совпадений с фильтрами"
                      : "В этой категории пока нет кандидатов"
                  }
                  text={
                    filterCount
                      ? "Уточните фильтры. Исходная подборка сохранена, вы можете вернуться ко всем результатам."
                      : "Попробуйте другую специализацию и уровень или проверьте обязательные требования."
                  }
                  icon={<Search size={26} />}
                  action={
                    filterCount ? (
                      <Button
                        variant="secondary"
                        onClick={() => {
                          setSearch("");
                          setSkill("");
                          setCity("");
                          setFspOnly(false);
                        }}
                      >
                        Сбросить фильтры
                      </Button>
                    ) : (
                      <Button
                        variant="secondary"
                        onClick={() => setCreating(true)}
                      >
                        Изменить потребность
                      </Button>
                    )
                  }
                />
              )}
            </>
          ) : (
            <Empty
              title="Начнём с вашей задачи"
              text="Создайте потребность: расскажите о команде, стеке и уровне специалиста. Публиковать вакансию для приглашения не обязательно."
              icon={<Users size={28} />}
              action={
                <Button onClick={() => setCreating(true)}>
                  <Plus size={16} /> Создать потребность
                </Button>
              }
            />
          )}
        </div>
        <aside className="match-sidebar">
          {demand && (
            <section className="card demand-summary">
              <span className="micro-label">ВАШ ЗАПРОС</span>
              <h2>{demand.title}</h2>
              <p>{demand.description}</p>
              <div className="category-stamp">
                <Code2 size={17} />
                <div>
                  <strong>
                    {specName(demand.specialization)} ·{" "}
                    {gradeName(demand.grade)}
                  </strong>
                  <small>Только подтверждённая категория</small>
                </div>
              </div>
              <div className="demand-skills">
                <span className="micro-label">НУЖНЫЕ КОМПЕТЕНЦИИ</span>
                <SkillTags skills={demand.skills} />
              </div>
              {demand.mustHave?.length > 0 && (
                <div className="demand-skills">
                  <span className="micro-label">ОБЯЗАТЕЛЬНЫЕ НАВЫКИ</span>
                  <SkillTags skills={demand.mustHave} />
                </div>
              )}
              {demand.salaryFrom && demand.salaryTo ? (
                <div className="demand-salary">
                  {money(demand.salaryFrom)}–{money(demand.salaryTo)} ₽
                  <small>в месяц</small>
                </div>
              ) : null}
              <button className="text-link" onClick={() => setCreating(true)}>
                Создать уточнённый запрос <ArrowRight size={14} />
              </button>
            </section>
          )}
          <section className="card matching-explainer">
            <div className="feature-icon blue">
              <ShieldCheck size={22} />
            </div>
            <h3>Почему этот порядок?</h3>
            <p>
              Сначала — подтверждённая категория. Затем — компетенции, результат
              теста и ограниченный бонус ФСП.
            </p>
            <div className="weight-row">
              <span>Требования и навыки</span>
              <span className="weight-line long" />
            </div>
            <div className="weight-row">
              <span>Результат проверки</span>
              <span className="weight-line medium" />
            </div>
            <div className="weight-row">
              <span>Достижения ФСП</span>
              <span className="weight-line short" />
            </div>
            <small>
              Балл соответствия — ориентир для сравнения, а не вероятность
              успешного найма.
            </small>
            <div className="algorithm-version">
              АЛГОРИТМ {meta.algorithmVersion}
            </div>
          </section>
          {demand?.original && (
            <div className="snapshot-note">
              <FileCheck2 size={17} />
              <p>
                Исходная подборка: <strong>{original.length}</strong>{" "}
                кандидатов.
                <br />
                Фильтры уточняют её, сохраняя порядок и исходный результат.
              </p>
            </div>
          )}
        </aside>
      </div>
      {creating && (
        <NewDemand
          onClose={() => setCreating(false)}
          onCreated={async (d) => {
            await refresh();
            selectDemand(d.id);
            setSearch("");
            setSkill("");
            setFspOnly(false);
            setCity("");
            setCreating(false);
          }}
          notify={notify}
        />
      )}{" "}
      {detail && (
        <CandidateDetail
          candidate={detail}
          onClose={() => setDetail(null)}
          onInvite={() => {
            setInviting(detail);
            setDetail(null);
          }}
        />
      )}
      {inviting && (
        <InviteModal
          candidate={inviting}
          demand={demand}
          profile={profile}
          onClose={() => setInviting(null)}
          onSent={async () => {
            setInviting(null);
            await refresh();
            notify(
              "Приглашение отправлено. Контакты откроются после принятия.",
            );
          }}
          notify={notify}
        />
      )}
    </>
  );
}

function NewDemand({
  onClose,
  onCreated,
  notify,
}: {
  onClose: () => void;
  onCreated: (d: Demand) => Promise<void>;
  notify: Common["notify"];
}) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [spec, setSpec] = useState<Specialization>("backend");
  const [grade, setGrade] = useState<Grade>("junior");
  const [skills, setSkills] = useState("");
  const [mustHave, setMustHave] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [industry, setIndustry] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      if ((from || to) && (!from || !to || Number(from) > Number(to)))
        throw new Error("Укажите корректный диапазон зарплаты от и до.");
      const demand = await api<Demand>("/api/demands", {
        title,
        description,
        specialization: spec,
        grade,
        skills: words(skills),
        mustHave: words(mustHave),
        industry,
        ...(from && to
          ? { salaryFrom: Number(from), salaryTo: Number(to) }
          : {}),
      });
      await api(`/api/demands/${demand.id}/match`, {});
      await onCreated(demand);
      notify("Потребность и исходная подборка сохранены");
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Не удалось создать потребность",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal title="Кого ищет ваша команда?" onClose={onClose} wide>
      <p className="modal-description">
        Сформулируйте задачи и требования. Мы покажем людей с подтверждённой
        категорией и объясним соответствие.
      </p>
      <form onSubmit={submit} className="form-stack">
        <Field label="Название потребности">
          <input
            required
            minLength={3}
            maxLength={160}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Backend-разработчик в продуктовую команду"
          />
        </Field>
        <Field label="Задачи и контекст команды">
          <textarea
            required
            minLength={20}
            maxLength={4000}
            rows={4}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Какие задачи будет решать специалист? Какой продукт, команда, условия работы?"
          />
        </Field>
        <div className="form-grid">
          <Field label="Специализация">
            <select
              value={spec}
              onChange={(e) => setSpec(e.target.value as Specialization)}
            >
              <option value="backend">Backend</option>
              <option value="frontend">Frontend</option>
            </select>
          </Field>
          <Field label="Подтверждённый грейд">
            <select
              value={grade}
              onChange={(e) => setGrade(e.target.value as Grade)}
            >
              <option value="junior">Junior</option>
              <option value="middle">Middle</option>
            </select>
          </Field>
        </div>
        <Field
          label="Нужные навыки"
          hint="Через запятую. Например: SQL, API, Python"
        >
          <input
            required
            value={skills}
            onChange={(e) => setSkills(e.target.value)}
            placeholder="SQL, API, Python"
            maxLength={1000}
          />
        </Field>
        <Field
          label="Обязательные навыки"
          hint="Кандидат с пробелом не получит преимущество от достижений ФСП"
        >
          <input
            value={mustHave}
            onChange={(e) => setMustHave(e.target.value)}
            placeholder="SQL"
            maxLength={1000}
          />
        </Field>
        <div className="form-grid">
          <Field label="Зарплата от, ₽ / месяц">
            <input
              type="number"
              min="1"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              placeholder="120000"
            />
          </Field>
          <Field label="Зарплата до, ₽ / месяц">
            <input
              type="number"
              min={from || "1"}
              value={to}
              onChange={(e) => setTo(e.target.value)}
              placeholder="180000"
            />
          </Field>
        </div>
        <Field label="Отрасль">
          <input
            value={industry}
            onChange={(e) => setIndustry(e.target.value)}
            placeholder="Финтех"
            maxLength={120}
          />
        </Field>
        {error && (
          <p className="inline-error" role="alert">
            {error}
          </p>
        )}
        <div className="modal-actions">
          <Button variant="secondary" type="button" onClick={onClose}>
            Отмена
          </Button>
          <Button type="submit" busy={busy}>
            <Sparkles size={16} /> Создать и подобрать
          </Button>
        </div>
      </form>
    </Modal>
  );
}

export function CandidateDetail({
  candidate,
  onClose,
  onInvite,
}: {
  candidate: Candidate;
  onClose: () => void;
  onInvite: () => void;
}) {
  const [data, setData] = useState(candidate);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  useEffect(() => {
    api<Candidate>(`/api/candidates/${candidate.id}`)
      .then((c) =>
        setData({
          ...candidate,
          ...c,
          score: candidate.score,
          reasons: candidate.reasons,
          gaps: candidate.gaps,
        }),
      )
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [candidate]);
  return (
    <Modal title="Профиль кандидата" onClose={onClose} wide>
      <div className="detail-identity">
        <Avatar name={data.name} />
        <div>
          <h2>{data.name}</h2>
          <p>{data.title}</p>
          <span className="muted">{data.city}</span>
        </div>
        {typeof data.score === "number" && <ScoreRing score={data.score} />}
      </div>
      <div className="detail-badges">
        <Badge tone="green">
          <ShieldCheck size={13} />
          {categoryName(data)}
        </Badge>
        {data.fspVerified && (
          <Badge tone="blue">
            <Award size={13} /> ФСП · демо-реестр
          </Badge>
        )}
      </div>
      {data.bio && <p className="detail-bio">{data.bio}</p>}
      <div className="detail-skills">
        <h3>Подтверждено тестом</h3>
        <SkillTags skills={data.demonstratedSkills} verified />
        <small>
          Результат проверки:{" "}
          {data.testScore != null
            ? `${Math.round(data.testScore)}%`
            : "нет результата"}
        </small>
      </div>
      <div className="detail-skills">
        <h3>Заявлено в резюме</h3>
        <SkillTags skills={data.skills} />
      </div>
      {candidate.reasons?.length ? (
        <div className="detail-reasons">
          <h3>Почему в подборке</h3>
          {candidate.reasons.map((r) => (
            <p key={r}>
              <CheckCircle2 size={15} />
              {r}
            </p>
          ))}
          {candidate.gaps?.map((g) => (
            <p key={g} className="gap">
              <span className="gap-dot" />
              {g}
            </p>
          ))}
        </div>
      ) : null}
      {data.achievements?.length > 0 && (
        <div className="detail-skills">
          <h3>Достижения ФСП</h3>
          {data.achievements.map((a, i) => (
            <p key={a.id || i} className="detail-achievement">
              <Award size={15} />
              <span>
                {a.event || a.title} · {a.result}
                {a.team ? " · командный результат" : ""}
              </span>
            </p>
          ))}
        </div>
      )}
      <div className={`contact-lock ${data.contacts ? "unlocked" : ""}`}>
        <LockKeyhole size={20} />
        <div>
          <strong>
            {data.contacts
              ? "Контакты доступны вашей компании"
              : "Контакты пока закрыты"}
          </strong>
          <p>
            {data.contacts
              ? `${data.contacts.email}${data.contacts.phone ? ` · ${data.contacts.phone}` : ""}`
              : "Откроются после принятия вашего приглашения или самостоятельного отклика."}
          </p>
        </div>
      </div>
      {loading && (
        <p className="fine-print">Проверяем доступ к актуальным контактам…</p>
      )}
      {error && <p className="inline-error">{error}</p>}
      <div className="modal-actions">
        <a
          className="button secondary"
          href={`/api/candidates/${data.id}/pdf`}
          target="_blank"
          rel="noreferrer"
        >
          <ArrowDownToLine size={16} /> PDF-профиль
        </a>
        <Button onClick={onInvite}>
          <Send size={16} /> Пригласить
        </Button>
      </div>
    </Modal>
  );
}

export function InviteModal({
  candidate,
  demand,
  profile,
  onClose,
  onSent,
  notify,
}: {
  candidate: Candidate;
  demand?: Demand;
  profile: Employer;
  onClose: () => void;
  onSent: () => Promise<void>;
  notify: Common["notify"];
}) {
  const [from, setFrom] = useState(String(demand?.salaryFrom || ""));
  const [to, setTo] = useState(String(demand?.salaryTo || ""));
  const [description, setDescription] = useState(demand?.description || "");
  const [contact, setContact] = useState(
    profile.contactMethod || "Email после принятия приглашения",
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      if (Number(from) > Number(to))
        throw new Error(
          "Верхняя граница зарплаты должна быть не меньше нижней.",
        );
      await api("/api/invitations", {
        candidateId: candidate.id,
        demandId: demand?.id,
        salaryFrom: Number(from),
        salaryTo: Number(to),
        description,
        contactMethod: contact,
      });
      await onSent();
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Не удалось отправить приглашение",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal title="Предложите познакомиться" onClose={onClose}>
      <div className="invite-recipient">
        <Avatar name={candidate.name} small />
        <div>
          <strong>{candidate.name}</strong>
          <p>{candidate.title}</p>
        </div>
      </div>
      <p className="modal-description">
        Приглашение от <strong>{profile.company || "вашей компании"}</strong>.
        Кандидат увидит условия до того, как решит поделиться контактами.
      </p>
      <form onSubmit={submit} className="form-stack">
        <div className="form-grid">
          <Field label="Зарплата от, ₽ / месяц">
            <input
              required
              type="number"
              min="1"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              placeholder="120000"
            />
          </Field>
          <Field label="Зарплата до, ₽ / месяц">
            <input
              required
              type="number"
              min={from || "1"}
              value={to}
              onChange={(e) => setTo(e.target.value)}
              placeholder="180000"
            />
          </Field>
        </div>
        <Field label="Описание предложения">
          <textarea
            required
            minLength={10}
            maxLength={4000}
            rows={4}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Задачи, команда и формат работы"
          />
        </Field>
        <Field label="Как свяжемся после принятия">
          <input
            required
            value={contact}
            onChange={(e) => setContact(e.target.value)}
            maxLength={300}
          />
        </Field>
        <div className="info-note">
          <LockKeyhole size={16} />
          <p>
            Контакты доступны только после принятия. Отказ завершает приглашение
            без раскрытия данных.
          </p>
        </div>
        {error && (
          <p className="inline-error" role="alert">
            {error}
          </p>
        )}
        <div className="modal-actions">
          <Button variant="secondary" type="button" onClick={onClose}>
            Отмена
          </Button>
          <Button busy={busy} type="submit">
            <Send size={16} /> Отправить приглашение
          </Button>
        </div>
      </form>
    </Modal>
  );
}

export function EmployerProfile({ profile, refresh, notify }: Common) {
  const [form, setForm] = useState(profile);
  const [busy, setBusy] = useState(false);
  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));
  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const saved = await api<Employer>(
        "/api/profile",
        {
          company: form.company,
          website: form.website,
          description: form.description,
          contactName: form.contactName,
          contactEmail: form.contactEmail,
          contactMethod: form.contactMethod,
        },
        "PATCH",
      );
      setForm(saved);
      await refresh();
      notify("Профиль компании сохранён");
    } catch (e) {
      notify(e instanceof Error ? e.message : "Не удалось сохранить", true);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <SectionTitle
        eyebrow="ПРОФИЛЬ РАБОТОДАТЕЛЯ"
        title="Познакомьте кандидатов с командой"
        description="Название компании и условия будут видны в каждом вашем приглашении."
      />
      <form className="card form-card employer-profile" onSubmit={save}>
        <h2>Компания и контакты</h2>
        <div className="form-grid">
          <Field label="Название компании">
            <input
              required
              minLength={2}
              maxLength={160}
              value={form.company || ""}
              onChange={(e) => set("company", e.target.value)}
            />
          </Field>
          <Field label="Сайт">
            <input
              type="url"
              value={form.website || ""}
              onChange={(e) => set("website", e.target.value)}
              placeholder="https://company.ru"
              maxLength={300}
            />
          </Field>
          <Field label="Контактное лицо">
            <input
              value={form.contactName || ""}
              onChange={(e) => set("contactName", e.target.value)}
              maxLength={120}
            />
          </Field>
          <Field label="Email для связи">
            <input
              type="email"
              value={form.contactEmail || ""}
              onChange={(e) => set("contactEmail", e.target.value)}
            />
          </Field>
        </div>
        <Field label="О команде и продукте">
          <textarea
            value={form.description || ""}
            onChange={(e) => set("description", e.target.value)}
            rows={5}
            maxLength={3000}
          />
        </Field>
        <Field label="Предпочитаемый способ связи">
          <input
            value={form.contactMethod || ""}
            onChange={(e) => set("contactMethod", e.target.value)}
            placeholder="Видеозвонок, затем встреча с командой"
            maxLength={300}
          />
        </Field>
        <Button type="submit" busy={busy}>
          Сохранить компанию <Check size={16} />
        </Button>
      </form>
    </>
  );
}
