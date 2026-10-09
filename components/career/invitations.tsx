"use client";
import { useState } from "react";
import {
  ArrowRight,
  Check,
  CheckCircle2,
  Clock3,
  Inbox,
  LockKeyhole,
  Mail,
  Send,
  X,
} from "lucide-react";
import { api, money, shortDate, type Invitation, type Role } from "./types";
import {
  Avatar,
  Badge,
  Button,
  Empty,
  Modal,
  SectionTitle,
} from "./primitives";

export function Invitations({
  role,
  invitations,
  refresh,
  notify,
}: {
  role: Role;
  invitations: Invitation[];
  refresh: () => Promise<void>;
  notify: (text: string, error?: boolean) => void;
}) {
  const [filter, setFilter] = useState("all");
  const [busy, setBusy] = useState("");
  const [confirm, setConfirm] = useState<{
    invitation: Invitation;
    decision: "accepted" | "declined";
  } | null>(null);
  const list = invitations.filter(
    (i) => filter === "all" || i.status === filter,
  );
  const pending = invitations.filter((i) => i.status === "pending").length;
  async function respond() {
    if (!confirm) return;
    const { id } = confirm.invitation;
    setBusy(id);
    try {
      await api(`/api/invitations/${id}/respond`, {
        decision: confirm.decision,
      });
      await refresh();
      notify(
        confirm.decision === "accepted"
          ? "Приглашение принято. Ваши контакты доступны этой компании."
          : "Приглашение отклонено. Контакты остались закрыты.",
      );
      setConfirm(null);
    } catch (e) {
      notify(
        e instanceof Error ? e.message : "Не удалось изменить статус",
        true,
      );
    } finally {
      setBusy("");
    }
  }
  return (
    <>
      <SectionTitle
        eyebrow={role === "candidate" ? "ПРЕДЛОЖЕНИЯ ДЛЯ ВАС" : "ПРИГЛАШЕНИЯ"}
        title={
          role === "candidate"
            ? "Условия известны заранее"
            : "От первого предложения к разговору"
        }
        description={
          role === "candidate"
            ? "Вы выбираете, с кем начать общение и кому открыть контакты."
            : "Следите за ответами кандидатов. После принятия контакты появятся здесь."
        }
      />
      <div className="invitation-stats">
        <div className="stat-item">
          <span>Всего приглашений</span>
          <strong>{invitations.length}</strong>
        </div>
        <div className="stat-item">
          <span>Ожидают ответа</span>
          <strong>{pending}</strong>
        </div>
        <div className="stat-item">
          <span>Приняты</span>
          <strong>
            {invitations.filter((i) => i.status === "accepted").length}
          </strong>
        </div>
      </div>
      <div className="list-tabs" aria-label="Фильтр приглашений">
        {[
          ["all", "Все"],
          ["pending", "Ожидают"],
          ["accepted", "Приняты"],
          ["declined", "Отклонены"],
        ].map(([v, label]) => (
          <button
            key={v}
            className={filter === v ? "active" : ""}
            onClick={() => setFilter(v)}
          >
            {label}
            {v === "pending" && pending > 0 && <span>{pending}</span>}
          </button>
        ))}
      </div>
      {list.length ? (
        <div className="invitation-list">
          {list.map((inv) => (
            <article className="card invitation-card" key={inv.id}>
              <div className="invitation-heading">
                <div className="candidate-identity">
                  <Avatar
                    name={
                      role === "candidate" ? inv.company : inv.candidateName
                    }
                  />
                  <div>
                    <h2>
                      {role === "candidate" ? inv.company : inv.candidateName}
                    </h2>
                    <p>{inv.title || "Приглашение познакомиться"}</p>
                  </div>
                </div>
                <Badge
                  tone={
                    inv.status === "accepted"
                      ? "green"
                      : inv.status === "declined"
                        ? "neutral"
                        : "amber"
                  }
                >
                  {inv.status === "accepted" ? (
                    <>
                      <CheckCircle2 size={13} /> Принято
                    </>
                  ) : inv.status === "declined" ? (
                    "Отклонено"
                  ) : (
                    <>
                      <Clock3 size={13} /> Ожидает ответа
                    </>
                  )}
                </Badge>
              </div>
              <div className="invitation-salary">
                {money(inv.salaryFrom)}–{money(inv.salaryTo)}{" "}
                <span>₽ / месяц</span>
              </div>
              <p className="invitation-description">{inv.description}</p>
              <div className="invitation-meta">
                <span>
                  <Mail size={14} />
                  {inv.contactMethod}
                </span>
                <span>{shortDate(inv.createdAt)}</span>
              </div>
              {inv.status === "accepted" ? (
                <div className="contact-lock unlocked">
                  <CheckCircle2 size={19} />
                  <div>
                    <strong>
                      {role === "candidate"
                        ? "Ваши контакты открыты этой компании"
                        : "Контакты кандидата"}
                    </strong>
                    <p>
                      {role === "candidate"
                        ? "Вы можете начать общение выбранным способом."
                        : inv.contacts
                          ? `${inv.contacts.email}${inv.contacts.phone ? ` · ${inv.contacts.phone}` : ""}`
                          : "Контакты появятся после обновления."}
                    </p>
                  </div>
                </div>
              ) : (
                <div className="invitation-footer">
                  <span>
                    <LockKeyhole size={14} /> Контакты закрыты
                  </span>
                  {role === "candidate" && inv.status === "pending" && (
                    <div>
                      <Button
                        variant="ghost"
                        disabled={busy === inv.id}
                        onClick={() =>
                          setConfirm({ invitation: inv, decision: "declined" })
                        }
                      >
                        <X size={15} /> Отклонить
                      </Button>
                      <Button
                        disabled={busy === inv.id}
                        onClick={() =>
                          setConfirm({ invitation: inv, decision: "accepted" })
                        }
                      >
                        <Check size={15} /> Принять приглашение
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </article>
          ))}
        </div>
      ) : (
        <Empty
          title={
            filter === "all"
              ? "Приглашений пока нет"
              : "Нет приглашений с этим статусом"
          }
          text={
            role === "candidate"
              ? "Опубликуйте профиль и подтвердите грейд, чтобы работодатели могли пригласить вас."
              : "Выберите кандидата в подборке и предложите ему условия с диапазоном зарплаты."
          }
          icon={<Inbox size={27} />}
        />
      )}{" "}
      {confirm && (
        <Modal
          title={
            confirm.decision === "accepted"
              ? "Начать общение с компанией?"
              : "Отклонить приглашение?"
          }
          onClose={() => setConfirm(null)}
        >
          <p className="modal-description">
            {confirm.decision === "accepted" ? (
              <>
                <strong>{confirm.invitation.company}</strong> получит ваш email
                и телефон. Остальные компании продолжат видеть закрытые
                контакты.
              </>
            ) : (
              <>
                Приглашение от <strong>{confirm.invitation.company}</strong>{" "}
                будет завершено. Ваши контакты останутся закрытыми.
              </>
            )}
          </p>
          <div className="modal-actions">
            <Button variant="secondary" onClick={() => setConfirm(null)}>
              Вернуться
            </Button>
            <Button
              variant={confirm.decision === "accepted" ? "primary" : "danger"}
              busy={!!busy}
              onClick={respond}
            >
              {confirm.decision === "accepted"
                ? "Принять и открыть контакты"
                : "Отклонить"}
            </Button>
          </div>
        </Modal>
      )}
    </>
  );
}
