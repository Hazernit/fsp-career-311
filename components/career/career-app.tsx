"use client";
import { useCallback, useEffect, useState } from "react";
import {
  ArrowRight,
  Award,
  Bell,
  BookOpen,
  BriefcaseBusiness,
  CheckCircle2,
  Code2,
  FileCheck2,
  HelpCircle,
  LayoutDashboard,
  LoaderCircle,
  LogOut,
  Mail,
  Menu,
  RefreshCw,
  Settings2,
  ShieldCheck,
  Sparkles,
  Users,
  X,
} from "lucide-react";
import { AuthScreen } from "./auth";
import { Applications } from "./applications";
import { clearExamDrafts } from "./exam-draft";
import { CandidateCatalog } from "./catalog";
import {
  CandidateAchievements,
  CandidateOverview,
  CandidateProfile,
  CandidateTest,
} from "./candidate";
import { EmployerMatching, EmployerProfile } from "./employer";
import { Invitations } from "./invitations";
import {
  Avatar,
  Badge,
  Button,
  Empty,
  Loading,
  SectionTitle,
} from "./primitives";
import { Vacancies } from "./vacancies";
import {
  api,
  type Application,
  type Candidate,
  type Demand,
  type Employer,
  type Invitation,
  type Meta,
  type Profile,
  type User,
  type Vacancy,
} from "./types";
const defaultMeta: Meta = {
  demoMode: false,
  categories: [],
  registryExamples: [],
  algorithmVersion: "—",
};

export default function CareerApp() {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [meta, setMeta] = useState<Meta>(defaultMeta);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [demands, setDemands] = useState<Demand[]>([]);
  const [vacancies, setVacancies] = useState<Vacancy[]>([]);
  const [applications, setApplications] = useState<Application[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [view, setView] = useState("overview");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [toast, setToast] = useState<{
    message: string;
    error: boolean;
  } | null>(null);
  const [mobileNav, setMobileNav] = useState(false);
  const [confirmation, setConfirmation] = useState<{
    demoMode: boolean;
    confirmationUrl?: string;
  } | null>(null);
  const [confirmBusy, setConfirmBusy] = useState(false);
  const notify = useCallback(
    (message: string, isError = false) => setToast({ message, error: isError }),
    [],
  );
  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(null), toast.error ? 8000 : 5000);
    return () => clearTimeout(id);
  }, [toast]);
  const loadWorkspace = useCallback(async (current: User) => {
    if (!current.emailVerified) {
      setProfile(null);
      setConfirmation(await api("/api/auth/confirmation"));
      return;
    }
    const [p, i, d, v, a] = await Promise.all([
      api<Profile>("/api/profile"),
      api<Invitation[]>("/api/invitations"),
      current.role === "employer"
        ? api<Demand[]>("/api/demands")
        : Promise.resolve([] as Demand[]),
      api<Vacancy[]>("/api/vacancies"),
      api<Application[]>("/api/applications"),
    ]);
    setProfile(p);
    setInvitations(i);
    setDemands(d);
    setVacancies(v);
    setApplications(a);
    setSelectedId((old) =>
      d.some((x) => x.id === old) ? old : d[0]?.id || "",
    );
  }, []);
  const refresh = useCallback(async () => {
    if (user) await loadWorkspace(user);
  }, [user, loadWorkspace]);
  const initialize = useCallback(
    () =>
      Promise.all([
        api<Meta>("/api/meta"),
        api<{ user: User | null }>("/api/session"),
      ])
        .then(async ([m, s]) => {
          setError("");
          setMeta(m);
          let u = s.user;
          const params = new URLSearchParams(window.location.search);
          const token = params.get("verify") || params.get("token");
          if (token) {
            try {
              u = await api<User>("/api/auth/verify", { token });
              notify("Email подтверждён");
            } catch (e) {
              setError(
                e instanceof Error ? e.message : "Не удалось подтвердить email",
              );
            } finally {
              window.history.replaceState({}, "", window.location.pathname);
            }
          }
          setUser(u);
          if (u) {
            setView(u.role === "candidate" ? "overview" : "matching");
            await loadWorkspace(u);
          }
        })
        .catch((e) =>
          setError(
            e instanceof Error ? e.message : "Не удалось загрузить кабинет",
          ),
        )
        .finally(() => setLoading(false)),
    [loadWorkspace, notify],
  );
  useEffect(() => {
    initialize();
  }, [initialize]);
  async function onAuthed(u: User) {
    setUser(u);
    setView(u.role === "candidate" ? "overview" : "matching");
    setLoading(true);
    setError(u.mailError || "");
    try {
      await loadWorkspace(u);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не удалось загрузить профиль");
    } finally {
      setLoading(false);
    }
  }
  async function switchDemo() {
    setLoading(true);
    try {
      await onAuthed(
        await api<User>("/api/auth/demo", {
          role: user?.role === "candidate" ? "employer" : "candidate",
        }),
      );
    } catch (e) {
      notify(
        e instanceof Error ? e.message : "Не удалось переключить кабинет",
        true,
      );
    } finally {
      setLoading(false);
    }
  }
  async function logout() {
    try {
      await api("/api/auth/logout", {});
      clearExamDrafts();
      setUser(null);
      setProfile(null);
      setInvitations([]);
      setDemands([]);
      setVacancies([]);
      setApplications([]);
      setMobileNav(false);
    } catch (e) {
      notify(e instanceof Error ? e.message : "Не удалось выйти", true);
    }
  }
  async function verifyDemo() {
    if (!confirmation?.confirmationUrl) return;
    setConfirmBusy(true);
    try {
      const url = new URL(confirmation.confirmationUrl, window.location.origin);
      const token =
        url.searchParams.get("verify") || url.searchParams.get("token");
      if (!token) throw new Error("В ссылке нет кода подтверждения");
      const u = await api<User>("/api/auth/verify", { token });
      await onAuthed(u);
      notify("Email подтверждён в демо-режиме");
    } catch (e) {
      notify(
        e instanceof Error ? e.message : "Не удалось подтвердить email",
        true,
      );
    } finally {
      setConfirmBusy(false);
    }
  }
  async function resendEmail() {
    setConfirmBusy(true);
    try {
      const response = await api<{
        sent: boolean;
        demoMode?: boolean;
        emailVerified?: boolean;
      }>("/api/auth/resend", {});
      if (response.emailVerified) {
        const session = await api<{ user: User | null }>("/api/session");
        if (session.user) await onAuthed(session.user);
        notify("Email уже подтверждён");
      } else {
        setConfirmation(await api("/api/auth/confirmation"));
        setError("");
        notify(
          response.demoMode
            ? "Новое демо-письмо готово. Можно подтвердить email."
            : "Письмо отправлено повторно",
        );
      }
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Не удалось отправить письмо. Попробуйте позже.",
      );
    } finally {
      setConfirmBusy(false);
    }
  }
  const navigate = (next: string) => {
    setView(next);
    setMobileNav(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  if (loading)
    return (
      <div className="app-loading">
        <img src="/brand/fsp-blue.svg" alt="ФСП" />
        <Loading text="Готовим ваш кабинет…" />
      </div>
    );
  if (!user)
    return (
      <>
        <AuthScreen demoMode={meta.demoMode} onAuthed={onAuthed} />
        {error && (
          <div className="global-error" role="alert">
            <span>{error}</span>
            <Button variant="secondary" onClick={initialize}>
              Повторить
            </Button>
          </div>
        )}
        {toast && <Toast value={toast} onClose={() => setToast(null)} />}
      </>
    );
  if (!user.emailVerified)
    return (
      <div className="verification-screen">
        <img src="/brand/fsp-blue.svg" alt="ФСП" />
        <section className="card verification-card">
          <div className="feature-icon blue">
            <Mail size={27} />
          </div>
          <p className="eyebrow">ЕЩЁ ОДИН ШАГ</p>
          <h1>Подтвердите email</h1>
          <p>
            Мы подготовили ссылку для <strong>{user.email}</strong>.
            Подтверждение защищает доступ к профилю и приглашениям.
          </p>
          {confirmation?.demoMode ? (
            <div className="demo-confirmation">
              <Badge tone="amber">Демонстрационная почта</Badge>
              <p>
                На этом стенде доставка писем заменена вашим личным почтовым
                просмотром. Ссылка доступна только в вашей сессии.
              </p>
              {!confirmation.confirmationUrl && (
                <p>Ссылка недоступна или истекла. Запросите новое письмо.</p>
              )}
              <Button
                busy={confirmBusy}
                disabled={!confirmation.confirmationUrl}
                onClick={verifyDemo}
              >
                Открыть письмо и подтвердить <ArrowRight size={16} />
              </Button>
            </div>
          ) : (
            <div className="info-note">
              <Mail size={18} />
              <p>
                Перейдите по ссылке из письма. Проверьте папку «Спам», если
                письма ещё нет.
              </p>
            </div>
          )}
          <Button
            variant="secondary"
            busy={confirmBusy}
            onClick={resendEmail}
            className="full"
          >
            <RefreshCw size={15} /> Отправить письмо повторно
          </Button>
          <Button variant="ghost" onClick={logout}>
            Выйти из аккаунта
          </Button>
          {error && (
            <p className="inline-error" role="alert">
              {error}
            </p>
          )}
        </section>
        {toast && <Toast value={toast} onClose={() => setToast(null)} />}
      </div>
    );
  const candidate = user.role === "candidate";
  const pending = invitations.filter((i) => i.status === "pending").length;
  const nav = candidate
    ? [
        { id: "overview", label: "Мой кабинет", icon: LayoutDashboard },
        { id: "profile", label: "Профиль и резюме", icon: Users },
        { id: "test", label: "Проверка навыков", icon: FileCheck2 },
        { id: "achievements", label: "Достижения ФСП", icon: Award },
        { id: "invitations", label: "Приглашения", icon: Mail },
        { id: "vacancies", label: "Вакансии", icon: BriefcaseBusiness },
        { id: "applications", label: "Отклики", icon: BookOpen },
      ]
    : [
        { id: "matching", label: "Подбор кандидатов", icon: Users },
        { id: "catalog", label: "Каталог кандидатов", icon: SearchIcon },
        { id: "invitations", label: "Приглашения", icon: SendIcon },
        { id: "vacancies", label: "Вакансии", icon: BriefcaseBusiness },
        { id: "applications", label: "Отклики", icon: BookOpen },
        { id: "company", label: "Профиль компании", icon: Settings2 },
      ];
  const label = nav.find((n) => n.id === view)?.label || "Как это работает";
  const profileName = candidate
    ? (profile as Candidate)?.name
    : (profile as Employer)?.company;
  const shared = {
    user,
    profile: profile as Candidate,
    meta,
    invitations,
    navigate,
    refresh,
    notify,
  };
  return (
    <div className="app-shell">
      <aside className={`sidebar ${mobileNav ? "open" : ""}`}>
        <div className="sidebar-brand">
          <img
            src="/brand/fsp-white.svg"
            alt="Федерация спортивного программирования"
          />
          <span>КАРЬЕРА</span>
          <button
            className="mobile-close icon-button"
            aria-label="Закрыть меню"
            onClick={() => setMobileNav(false)}
          >
            <X size={20} />
          </button>
        </div>
        <div className="workspace-label">
          {candidate ? "КАБИНЕТ КАНДИДАТА" : "КАБИНЕТ РАБОТОДАТЕЛЯ"}
        </div>
        <nav aria-label="Главное меню">
          {nav.map((n) => (
            <button
              key={n.id}
              className={`nav-item ${view === n.id ? "active" : ""}`}
              onClick={() => navigate(n.id)}
            >
              <n.icon size={19} />
              <span>{n.label}</span>
              {n.id === "invitations" && pending > 0 && <b>{pending}</b>}
            </button>
          ))}
        </nav>
        <div className="sidebar-note">
          <ShieldCheck size={22} />
          <strong>
            {candidate
              ? "Ваши навыки — ваш аргумент"
              : "Компетенции выше обещаний"}
          </strong>
          <p>
            {candidate
              ? "Подтвердите грейд, чтобы стать частью подборки."
              : "Рекомендации основаны на результатах проверки."}
          </p>
        </div>
        <div className="sidebar-bottom">
          {meta.demoMode && (
            <button className="nav-item demo-switch" onClick={switchDemo}>
              <RefreshCw size={16} />
              <span>{candidate ? "Демо: работодатель" : "Демо: кандидат"}</span>
            </button>
          )}
          <button
            className={`nav-item ${view === "about" ? "active" : ""}`}
            onClick={() => navigate("about")}
          >
            <HelpCircle size={18} />
            <span>Как это работает</span>
          </button>
          <div className="sidebar-account">
            <Avatar name={profileName || user.email} small />
            <div>
              <strong>{profileName || user.email}</strong>
              <small>{candidate ? "Кандидат" : "Работодатель"}</small>
            </div>
            <button
              className="icon-button"
              aria-label="Выйти из аккаунта"
              onClick={logout}
            >
              <LogOut size={18} />
            </button>
          </div>
        </div>
      </aside>
      {mobileNav && (
        <button
          className="mobile-backdrop"
          onClick={() => setMobileNav(false)}
          aria-label="Закрыть меню"
        />
      )}
      <div className="workspace">
        <header className="workspace-header">
          <div className="breadcrumbs">
            <button
              className="mobile-menu icon-button"
              aria-label="Открыть меню"
              onClick={() => setMobileNav(true)}
            >
              <Menu size={22} />
            </button>
            <span>ФСП Карьера</span>
            <span className="breadcrumb-slash">/</span>
            <strong>{label}</strong>
          </div>
          <div className="header-right">
            {meta.demoMode && (
              <span className="demo-pill">
                <span /> Демо-стенд
              </span>
            )}
            <button
              className="header-notifications icon-button"
              onClick={() => navigate("invitations")}
              aria-label="Открыть приглашения"
            >
              <Bell size={19} />
              {pending > 0 && <span />}
            </button>
            <Avatar name={profileName || user.email} small />
          </div>
        </header>
        <main className="workspace-content">
          {error && (
            <div className="page-error" role="alert">
              {error}
              <Button variant="ghost" onClick={refresh}>
                Повторить <RefreshCw size={15} />
              </Button>
            </div>
          )}
          {!profile ? (
            <Empty
              title="Профиль не загрузился"
              text="Повторите загрузку кабинета. Ваши сохранённые данные останутся в аккаунте."
              action={
                <Button
                  onClick={async () => {
                    setError("");
                    try {
                      await refresh();
                    } catch (e) {
                      setError(
                        e instanceof Error ? e.message : "Ошибка загрузки",
                      );
                    }
                  }}
                >
                  Повторить загрузку
                </Button>
              }
            />
          ) : view === "about" ? (
            <About role={user.role} navigate={navigate} />
          ) : candidate && view === "overview" ? (
            <CandidateOverview {...shared} />
          ) : candidate && view === "profile" ? (
            <CandidateProfile {...shared} />
          ) : candidate && view === "test" ? (
            <CandidateTest {...shared} />
          ) : candidate && view === "achievements" ? (
            <CandidateAchievements {...shared} />
          ) : !candidate && view === "catalog" ? (
            <CandidateCatalog
              profile={profile as Employer}
              refresh={refresh}
              notify={notify}
            />
          ) : view === "invitations" ? (
            <Invitations
              role={user.role}
              invitations={invitations}
              refresh={refresh}
              notify={notify}
            />
          ) : view === "vacancies" ? (
            <Vacancies
              role={user.role}
              vacancies={vacancies}
              demands={demands}
              refresh={refresh}
              notify={notify}
            />
          ) : view === "applications" ? (
            <Applications
              role={user.role}
              applications={applications}
              employer={candidate ? undefined : (profile as Employer)}
              refresh={refresh}
              notify={notify}
              navigate={navigate}
            />
          ) : !candidate && view === "company" ? (
            <EmployerProfile
              profile={profile as Employer}
              meta={meta}
              refresh={refresh}
              notify={notify}
            />
          ) : !candidate ? (
            <EmployerMatching
              profile={profile as Employer}
              meta={meta}
              demands={demands}
              selectedId={selectedId}
              selectDemand={setSelectedId}
              refresh={refresh}
              notify={notify}
            />
          ) : null}
          <footer className="workspace-footer">
            <span>ФСП КАРЬЕРА</span>
            <span>Подтверждённые навыки. Осмысленный выбор.</span>
            <button onClick={() => navigate("about")}>
              О платформе <ArrowRight size={12} />
            </button>
          </footer>
        </main>
      </div>
      {toast && <Toast value={toast} onClose={() => setToast(null)} />}
    </div>
  );
}
function SearchIcon(props: { size?: number }) {
  return <Users {...props} />;
}
function SendIcon(props: { size?: number }) {
  return <Mail {...props} />;
}
function Toast({
  value,
  onClose,
}: {
  value: { message: string; error: boolean };
  onClose: () => void;
}) {
  return (
    <div
      className={`toast ${value.error ? "error" : ""}`}
      role={value.error ? "alert" : "status"}
    >
      {value.error ? <HelpCircle size={19} /> : <CheckCircle2 size={19} />}
      <span>{value.message}</span>
      <button
        className="icon-button"
        aria-label="Закрыть уведомление"
        onClick={onClose}
      >
        <X size={17} />
      </button>
    </div>
  );
}
function About({
  role,
  navigate,
}: {
  role: string;
  navigate: (view: string) => void;
}) {
  return (
    <>
      <SectionTitle
        eyebrow="ПРИНЦИПЫ ПЛАТФОРМЫ"
        title="От доказательств к предложению"
        description="Прозрачные правила для кандидатов и работодателей."
      />
      <div className="about-grid">
        {[
          {
            icon: FileCheck2,
            title: "Категория подтверждается тестом",
            text: "Для MVP доступны Backend на Python и Frontend на JavaScript/TypeScript: Junior и Middle. Тест состоит из 12 вопросов, проходит за 10 минут и проверяется по эталонам. Нужны 75% в целом и не менее 50% по каждой компетенции.",
          },
          {
            icon: Users,
            title: "Подбор под реальную потребность",
            text: "Алгоритм сначала проверяет специализацию и грейд, затем обязательные подтверждённые навыки. Ранжирует по соответствию компетенций, проверке и ограниченному бонусу ФСП. Балл от 0 до 100 служит для сравнения и не является вероятностью найма.",
          },
          {
            icon: Award,
            title: "Достижения усиливают профиль",
            text: "Демо-адаптер ФСП принимает только известные ID с кодом подтверждения. Синтетические достижения явно отмечены. Они не заменяют первичный тест и не позволяют обойти обязательные требования.",
          },
          {
            icon: ShieldCheck,
            title: "Контакты — по вашему решению",
            text: "Email и телефон закрыты на сервере и в PDF. Только принятие приглашения или самостоятельный отклик открывают их конкретной компании. Принятие предложения одной компании не раскрывает контакты всем.",
          },
        ].map((p, i) => (
          <section className="card about-card" key={p.title}>
            <div className="about-card-top">
              <div className="feature-icon blue">
                <p.icon size={25} />
              </div>
              <span className="mono">0{i + 1}</span>
            </div>
            <h2>{p.title}</h2>
            <p>{p.text}</p>
          </section>
        ))}
      </div>
      <div className="about-cta">
        <div>
          <h2>Попробуйте свой сценарий</h2>
          <p>
            {role === "candidate"
              ? "Заполните профиль, проверьте навыки и выберите предложение."
              : "Опишите потребность и пригласите подходящего кандидата."}
          </p>
        </div>
        <Button
          onClick={() => navigate(role === "candidate" ? "test" : "matching")}
        >
          {role === "candidate" ? "К проверке навыков" : "К подбору"}
          <ArrowRight size={16} />
        </Button>
      </div>
      <p className="demo-footnote">
        Хакатонный прототип. Проверка вариантов и качество подбора измеряются на
        синтетических данных; это не подтверждает эффективность найма на
        реальном рынке.
      </p>
    </>
  );
}
