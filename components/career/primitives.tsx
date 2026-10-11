"use client";
import { useEffect, type ReactNode } from "react";
import {
  ArrowRight,
  Check,
  CheckCircle2,
  LoaderCircle,
  LockKeyhole,
  ShieldCheck,
  X,
} from "lucide-react";
import { initials, type Candidate } from "./types";

export function Button({
  children,
  variant = "primary",
  busy = false,
  className = "",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  children: ReactNode;
  variant?: "primary" | "secondary" | "ghost" | "danger";
  busy?: boolean;
}) {
  return (
    <button
      {...props}
      disabled={props.disabled || busy}
      className={`button ${variant} ${className}`}
    >
      {busy && <LoaderCircle size={16} className="spin" />}
      {children}
    </button>
  );
}
export function Badge({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: "neutral" | "blue" | "green" | "amber" | "red";
}) {
  return <span className={`badge ${tone}`}>{children}</span>;
}
export function Avatar({
  name,
  small = false,
}: {
  name?: string;
  small?: boolean;
}) {
  return (
    <div className={`avatar ${small ? "small" : ""}`}>{initials(name)}</div>
  );
}
export function SectionTitle({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="section-heading">
      <div>
        {eyebrow && <p className="eyebrow">{eyebrow}</p>}
        <h1>{title}</h1>
        {description && <p className="heading-description">{description}</p>}
      </div>
      {action}
    </div>
  );
}
export function Empty({
  title,
  text,
  action,
  icon = <LockKeyhole size={26} />,
}: {
  title: string;
  text: string;
  action?: ReactNode;
  icon?: ReactNode;
}) {
  return (
    <div className="empty-state">
      <div className="empty-icon">{icon}</div>
      <h3>{title}</h3>
      <p>{text}</p>
      {action}
    </div>
  );
}
export function Loading({ text = "Загружаем данные…" }: { text?: string }) {
  return (
    <div className="loading-state">
      <LoaderCircle size={26} className="spin" />
      <p>{text}</p>
    </div>
  );
}
export function Field({
  label,
  children,
  hint,
}: {
  label: string;
  children: ReactNode;
  hint?: string;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
      {hint && <small>{hint}</small>}
    </label>
  );
}
export function Toggle({
  checked,
  onChange,
  label,
  description,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  description?: string;
}) {
  return (
    <label className="toggle-row">
      <span>
        <strong>{label}</strong>
        {description && <small>{description}</small>}
      </span>
      <input
        type="checkbox"
        role="switch"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span className="switch" aria-hidden="true" />
    </label>
  );
}
export function Modal({
  title,
  children,
  onClose,
  wide = false,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
  wide?: boolean;
}) {
  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    const modal = document.querySelector<HTMLElement>(".modal");
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "Tab" && modal) {
        const items = Array.from(
          modal.querySelectorAll<HTMLElement>(
            'button:not(:disabled), input, select, textarea, a[href], [tabindex="0"]',
          ),
        );
        const first = items[0],
          last = items[items.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last?.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first?.focus();
        }
      }
    };
    document.addEventListener("keydown", handler);
    modal?.querySelector<HTMLElement>("button, input")?.focus();
    const old = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", handler);
      document.body.style.overflow = old;
      prev?.focus();
    };
  }, [onClose]);
  return (
    <div
      className="modal-overlay"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <section
        className={`modal ${wide ? "wide" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
      >
        <div className="modal-heading">
          <h2 id="modal-title">{title}</h2>
          <button
            className="icon-button"
            onClick={onClose}
            aria-label="Закрыть окно"
          >
            <X size={20} />
          </button>
        </div>
        {children}
      </section>
    </div>
  );
}
export function SkillTags({
  skills,
  verified = false,
}: {
  skills?: string[];
  verified?: boolean;
}) {
  return (
    <div className="skill-tags">
      {(skills || []).map((skill) => (
        <span className={verified ? "skill verified" : "skill"} key={skill}>
          {verified && <Check size={12} />} {skill}
        </span>
      ))}
    </div>
  );
}
export function ScoreRing({
  score,
  size = "normal",
}: {
  score: number;
  size?: "normal" | "small";
}) {
  const val = Math.max(0, Math.min(100, Math.round(score)));
  return (
    <div
      className={`score-ring ${size}`}
      style={{ "--score": `${val}%` } as React.CSSProperties}
    >
      <span>
        {val}
        <small>/100</small>
      </span>
    </div>
  );
}
export function CandidateCard({
  candidate,
  index,
  onView,
  onInvite,
}: {
  candidate: Candidate;
  index?: number;
  onView: () => void;
  onInvite: () => void;
}) {
  return (
    <article className="candidate-card">
      <div className="candidate-top">
        <div className="candidate-identity">
          <Avatar name={candidate.name} />
          <div>
            <div className="candidate-name-row">
              <button className="text-link candidate-name" onClick={onView}>
                {candidate.name}
              </button>
              {candidate.fspVerified && (
                <ShieldCheck
                  className="fsp-check"
                  size={17}
                  aria-label="Достижения ФСП подтверждены в демо-реестре"
                />
              )}
            </div>
            <p>
              {candidate.title || `${candidate.specialization} разработчик`}
            </p>
            <div className="candidate-location">
              {candidate.city || "Город не указан"}
              <span>•</span>
              {candidate.verifiedGrade ? (
                <span className="verified-inline">
                  <CheckCircle2 size={13} />
                  {candidate.verifiedGrade.charAt(0).toUpperCase() +
                    candidate.verifiedGrade.slice(1)}{" "}
                  подтверждён
                </span>
              ) : (
                "Грейд не подтверждён"
              )}
            </div>
          </div>
        </div>
        {typeof index === "number" && (
          <div className="rank-score">
            <span className="rank-label">#{index + 1} В ПОДБОРКЕ</span>
            <ScoreRing score={candidate.score || 0} />
          </div>
        )}
      </div>
      <div className="candidate-skills">
        <span className="micro-label">ПОДТВЕРЖДЕНО ТЕСТОМ</span>
        <SkillTags skills={candidate.demonstratedSkills} verified />
      </div>
      {(candidate.roles?.length > 0 || candidate.softSkills?.length > 0) && (
        <div className="candidate-declared-traits">
          {!!candidate.roles?.length && (
            <p><span>Роли:</span> {candidate.roles.join(", ")}</p>
          )}
          {!!candidate.softSkills?.length && (
            <p><span>Софт-скиллы:</span> {candidate.softSkills.join(", ")}</p>
          )}
          <small>Указаны кандидатом в резюме</small>
        </div>
      )}
      {!!candidate.reasons?.length && (
        <div className="match-reasons">
          {(candidate.reasons || []).slice(0, 3).map((reason) => (
            <p key={reason}>
              <Check size={14} />
              {reason}
            </p>
          ))}
          {(candidate.gaps || []).length > 0 && (
            <p className="gap">
              <span className="gap-dot" />
              {candidate.gaps?.[0]}
            </p>
          )}
        </div>
      )}
      <div className="candidate-footer">
        <button className="text-link muted" onClick={onView}>
          {typeof index === "number" ? "Почему подходит" : "Открыть профиль"}{" "}
          <ArrowRight size={14} />
        </button>
        <Button variant="secondary" onClick={onInvite}>
          Пригласить <ArrowRight size={15} />
        </Button>
      </div>
    </article>
  );
}
