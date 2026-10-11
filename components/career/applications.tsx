"use client";
import { useState } from "react";
import {
  ArrowRight,
  Check,
  CheckCircle2,
  Clock3,
  Eye,
  Inbox,
  LockKeyhole,
  X,
} from "lucide-react";
import { CandidateDetail, InviteModal } from "./employer";
import { Avatar, Badge, Button, Empty, SectionTitle } from "./primitives";
import {
  api,
  money,
  shortDate,
  type Application,
  type ApplicationStatus,
  type Candidate,
  type Employer,
  type Role,
} from "./types";

const statusNames: Record<ApplicationStatus, string> = {
  sent: "Отправлен",
  viewed: "Просмотрен",
  accepted: "Принят",
  declined: "Отклонён",
};

export function Applications({
  role,
  applications,
  employer,
  refresh,
  notify,
  navigate,
}: {
  role: Role;
  applications: Application[];
  employer?: Employer;
  refresh: () => Promise<void>;
  notify: (message: string, error?: boolean) => void;
  navigate: (view: string) => void;
}) {
  const [filter, setFilter] = useState<ApplicationStatus | "all">("all");
  const [busy, setBusy] = useState("");
  const [opening, setOpening] = useState("");
  const [error, setError] = useState<{ id: string; message: string } | null>(null);
  const [detail, setDetail] = useState<Candidate | null>(null);
  const [invite, setInvite] = useState<Candidate | null>(null);
  const list = applications.filter(
    (application) => filter === "all" || application.status === filter,
  );
  const pending = applications.filter(
    (application) => application.status === "sent" || application.status === "viewed",
  ).length;

  async function updateStatus(
    application: Application,
    status: Exclude<ApplicationStatus, "sent">,
  ) {
    if (role !== "employer") return;
    setBusy(application.id);
    setError(null);
    try {
      await api<Application>(`/api/applications/${application.id}/status`, { status });
      await refresh();
      notify(`Отклик: ${statusNames[status].toLowerCase()}`);
    } catch (e) {
      const message = e instanceof Error ? e.message : "Не удалось изменить статус отклика";
      setError({ id: application.id, message });
      notify(message, true);
    } finally {
      setBusy("");
    }
  }

  async function openCandidate(application: Application) {
    if (role !== "employer") return;
    setOpening(application.id);
    setError(null);
    try {
      const candidate = await api<Candidate>(`/api/candidates/${application.candidateId}`);
      setDetail(candidate);
    } catch (e) {
      const message = e instanceof Error ? e.message : "Не удалось открыть профиль кандидата";
      setError({ id: application.id, message });
      notify(message, true);
    } finally {
      setOpening("");
    }
  }

  return (
    <>
      <SectionTitle
        eyebrow="ОТКЛИКИ НА ВАКАНСИИ"
        title={role === "candidate" ? "Ваши отклики" : "Входящие отклики"}
        description={
          role === "candidate"
            ? "Следите за ответами компаний. Изменение статуса появится здесь после обновления кабинета."
            : "Откройте профиль кандидата и сообщите решение. Статус виден обеим сторонам."
        }
      />
      <div className="invitation-stats">
        <div className="stat-item"><span>Всего откликов</span><strong>{applications.length}</strong></div>
        <div className="stat-item"><span>На рассмотрении</span><strong>{pending}</strong></div>
        <div className="stat-item">
          <span>Приняты</span>
          <strong>{applications.filter((application) => application.status === "accepted").length}</strong>
        </div>
      </div>
      <div className="list-tabs applications-tabs" aria-label="Фильтр откликов">
        {([
          ["all", "Все"],
          ["sent", "Отправлены"],
          ["viewed", "Просмотрены"],
          ["accepted", "Приняты"],
          ["declined", "Отклонены"],
        ] as const).map(([value, label]) => (
          <button
            key={value}
            className={filter === value ? "active" : ""}
            onClick={() => setFilter(value)}
          >
            {label}
          </button>
        ))}
      </div>
      {list.length ? (
        <div className="invitation-list">
          {list.map((application) => {
            const final = application.status === "accepted" || application.status === "declined";
            return (
              <article className="card invitation-card application-card" key={application.id}>
                <div className="invitation-heading">
                  <div className="candidate-identity">
                    <Avatar name={role === "candidate" ? application.company : application.candidateName} />
                    <div>
                      <h2>{role === "candidate" ? application.company : application.candidateName}</h2>
                      <p>{application.title}</p>
                      {role === "employer" && <small className="application-company">{application.company}</small>}
                    </div>
                  </div>
                  <Badge tone={application.status === "accepted" ? "green" : application.status === "viewed" ? "blue" : application.status === "sent" ? "amber" : "neutral"}>
                    {application.status === "accepted" ? <CheckCircle2 size={13} /> : application.status === "viewed" ? <Eye size={13} /> : application.status === "sent" ? <Clock3 size={13} /> : <X size={13} />}
                    {statusNames[application.status]}
                  </Badge>
                </div>
                <div className="invitation-salary">
                  {money(application.salaryFrom)}–{money(application.salaryTo)} <span>₽ / месяц</span>
                </div>
                <div className="application-dates">
                  <span>Отправлен {shortDate(application.createdAt)}</span>
                  <span>Статус обновлён {shortDate(application.updatedAt)}</span>
                </div>
                <div className="application-footer">
                  {role === "candidate" ? (
                    <p className="application-privacy"><LockKeyhole size={15} /> Отклик открывает контакты этой компании.</p>
                  ) : (
                    <>
                      <Button
                        variant="ghost"
                        busy={opening === application.id}
                        disabled={!!opening || !!busy}
                        onClick={() => openCandidate(application)}
                      >
                        Профиль и контакты <ArrowRight size={15} />
                      </Button>
                      {!final && (
                        <div className="application-actions">
                          {application.status === "sent" && (
                            <Button variant="ghost" disabled={!!busy} onClick={() => updateStatus(application, "viewed")}>
                              <Eye size={15} /> Просмотрено
                            </Button>
                          )}
                          <Button variant="ghost" disabled={!!busy} onClick={() => updateStatus(application, "declined")}>
                            <X size={15} /> Отклонить
                          </Button>
                          <Button disabled={!!busy} onClick={() => updateStatus(application, "accepted")}>
                            <Check size={15} /> Принять
                          </Button>
                        </div>
                      )}
                    </>
                  )}
                </div>
                {error?.id === application.id && <p className="inline-error" role="alert">{error.message}</p>}
              </article>
            );
          })}
        </div>
      ) : (
        <Empty
          title={filter === "all" ? "Откликов пока нет" : "Нет откликов с этим статусом"}
          text={role === "candidate" ? "Откликнитесь на подходящую вакансию. Здесь сохранятся ваш отклик и ответ работодателя." : "Опубликуйте вакансию, чтобы кандидаты могли откликнуться самостоятельно."}
          icon={<Inbox size={27} />}
          action={filter === "all" ? <Button variant="secondary" onClick={() => navigate("vacancies")}>К вакансиям <ArrowRight size={15} /></Button> : undefined}
        />
      )}
      {detail && employer && (
        <CandidateDetail
          candidate={detail}
          onClose={() => setDetail(null)}
          onInvite={() => { setInvite(detail); setDetail(null); }}
        />
      )}
      {invite && employer && (
        <InviteModal
          candidate={invite}
          profile={employer}
          onClose={() => setInvite(null)}
          onSent={async () => { setInvite(null); await refresh(); notify("Приглашение отправлено"); }}
          notify={notify}
        />
      )}
    </>
  );
}
