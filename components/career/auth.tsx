"use client";
import { useState } from "react";
import {
  ArrowRight,
  BriefcaseBusiness,
  Code2,
  ShieldCheck,
  Sparkles,
  Users,
  CheckCircle2,
} from "lucide-react";
import { api, type Role, type User } from "./types";
import { Button, Field } from "./primitives";

export function AuthScreen({
  demoMode,
  onAuthed,
}: {
  demoMode: boolean;
  onAuthed: (user: User) => Promise<void>;
}) {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [role, setRole] = useState<Role>("candidate");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy("auth");
    setError("");
    try {
      const user = await api<User>(
        `/api/auth/${mode}`,
        mode === "register"
          ? { email, password, name, role, consentProcessing: consent }
          : { email, password },
      );
      await onAuthed(user);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка входа");
    } finally {
      setBusy("");
    }
  }
  async function demo(r: Role) {
    setBusy(r);
    setError("");
    try {
      await onAuthed(await api<User>("/api/auth/demo", { role: r }));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Демо временно недоступно");
    } finally {
      setBusy("");
    }
  }
  return (
    <main className="auth-screen">
      <header className="auth-header">
        <div className="auth-brand">
          <img
            src="/brand/fsp-blue.svg"
            alt="Федерация спортивного программирования"
          />
          <span className="brand-divider" />
          <strong>Карьера</strong>
        </div>
        <span className="auth-header-note">
          <span className="live-dot" /> Платформа подтверждённых компетенций
        </span>
      </header>
      <div className="auth-main">
        <section className="auth-story">
          <p className="eyebrow">ОТ СПОРТИВНОГО КОДА К КАРЬЕРЕ</p>
          <h1>
            Навыки говорят.
            <br />
            <span>
              Работодатель
              <br />
              приглашает.
            </span>
          </h1>
          <p className="auth-description">
            Подтвердите свой уровень и получите предложение с понятными
            условиями. Достижения ФСП — дополнительный аргумент в вашем профиле.
          </p>
          <div className="journey">
            <div>
              <span>01</span>
              <Code2 size={19} />
              <strong>Проверьте навыки</strong>
              <small>Frontend или Backend</small>
            </div>
            <div>
              <span>02</span>
              <ShieldCheck size={19} />
              <strong>Получите категорию</strong>
              <small>Подтверждённый грейд</small>
            </div>
            <div>
              <span>03</span>
              <BriefcaseBusiness size={19} />
              <strong>Выберите предложение</strong>
              <small>Зарплата известна заранее</small>
            </div>
          </div>
          <div className="auth-trust">
            <ShieldCheck size={18} />
            <p>
              Контакты открываются только компании,
              <br />
              чьё приглашение вы приняли.
            </p>
          </div>
        </section>
        <section className="auth-panel">
          <div
            className="auth-tabs"
            role="tablist"
            aria-label="Вход или регистрация"
          >
            <button
              role="tab"
              aria-selected={mode === "login"}
              className={mode === "login" ? "active" : ""}
              onClick={() => {
                setMode("login");
                setError("");
              }}
            >
              Войти
            </button>
            <button
              role="tab"
              aria-selected={mode === "register"}
              className={mode === "register" ? "active" : ""}
              onClick={() => {
                setMode("register");
                setError("");
              }}
            >
              Создать профиль
            </button>
          </div>
          <h2>{mode === "login" ? "С возвращением" : "Ваш следующий шаг"}</h2>
          <p className="muted">
            {mode === "login"
              ? "Войдите в свой личный кабинет."
              : "Выберите роль и подтвердите email."}
          </p>
          <form onSubmit={submit} className="form-stack">
            {mode === "register" && (
              <>
                <div className="role-picker">
                  <button
                    type="button"
                    className={role === "candidate" ? "selected" : ""}
                    onClick={() => setRole("candidate")}
                  >
                    <Code2 size={17} /> Кандидат
                  </button>
                  <button
                    type="button"
                    className={role === "employer" ? "selected" : ""}
                    onClick={() => setRole("employer")}
                  >
                    <BriefcaseBusiness size={17} /> Работодатель
                  </button>
                </div>
                <Field
                  label={role === "candidate" ? "Имя и фамилия" : "Ваше имя"}
                >
                  <input
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    autoComplete="name"
                    placeholder="Иван Петров"
                    maxLength={120}
                  />
                </Field>
              </>
            )}
            <Field label="Email">
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                placeholder="you@example.ru"
              />
            </Field>
            <Field
              label="Пароль"
              hint={
                mode === "register"
                  ? "Не менее 10 символов. Используйте уникальный пароль."
                  : undefined
              }
            >
              <input
                type="password"
                required
                minLength={mode === "register" ? 10 : 1}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete={
                  mode === "register" ? "new-password" : "current-password"
                }
                placeholder="Введите пароль"
              />
            </Field>
            {mode === "register" && (
              <label className="check-label">
                <input
                  type="checkbox"
                  required
                  checked={consent}
                  onChange={(e) => setConsent(e.target.checked)}
                />
                <span>
                  Согласен на обработку данных профиля для подбора работы.
                  Публикацию можно настроить отдельно.
                </span>
              </label>
            )}
            {error && (
              <p className="inline-error" role="alert">
                {error}
              </p>
            )}
            <Button
              type="submit"
              busy={busy === "auth"}
              disabled={!!busy}
              className="full"
            >
              {mode === "login" ? "Войти в кабинет" : "Создать профиль"}
              <ArrowRight size={17} />
            </Button>
          </form>
          {demoMode && (
            <div className="demo-access">
              <div className="divider-label">
                <span>или исследуйте демо</span>
              </div>
              <p>
                Два отдельных кабинета с синтетическими данными. Можно пройти
                настоящий тест и проверить весь путь.
              </p>
              <div className="demo-buttons">
                <Button
                  variant="secondary"
                  busy={busy === "candidate"}
                  disabled={!!busy}
                  onClick={() => demo("candidate")}
                >
                  <Users size={16} /> Кандидат
                </Button>
                <Button
                  variant="secondary"
                  busy={busy === "employer"}
                  disabled={!!busy}
                  onClick={() => demo("employer")}
                >
                  <BriefcaseBusiness size={16} /> Работодатель
                </Button>
              </div>
            </div>
          )}
        </section>
      </div>
      <footer className="auth-footer">
        <span>ФСП КАРЬЕРА / 2026</span>
        <p>
          <CheckCircle2 size={14} /> Решение спецтрека Федерации спортивного
          программирования
        </p>
        <span>BACKEND + FRONTEND</span>
      </footer>
    </main>
  );
}
