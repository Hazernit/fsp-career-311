"use client";
import { useState } from "react";
import {
  ArrowRight,
  BriefcaseBusiness,
  CheckCircle2,
  LockKeyhole,
  Plus,
} from "lucide-react";
import {
  api,
  gradeName,
  money,
  specName,
  type Demand,
  type Role,
  type Vacancy,
} from "./types";
import {
  Badge,
  Button,
  Empty,
  Field,
  Modal,
  SectionTitle,
  SkillTags,
} from "./primitives";
export function Vacancies({
  role,
  vacancies,
  demands,
  refresh,
  notify,
}: {
  role: Role;
  vacancies: Vacancy[];
  demands: Demand[];
  refresh: () => Promise<void>;
  notify: (m: string, error?: boolean) => void;
}) {
  const [creating, setCreating] = useState(false);
  const [selected, setSelected] = useState(demands[0]?.id || "");
  const [apply, setApply] = useState<Vacancy | null>(null);
  const [busy, setBusy] = useState(false);
  async function publish() {
    setBusy(true);
    try {
      await api("/api/vacancies", { demandId: selected });
      await refresh();
      setCreating(false);
      notify("Вакансия опубликована");
    } catch (e) {
      notify(e instanceof Error ? e.message : "Не удалось опубликовать", true);
    } finally {
      setBusy(false);
    }
  }
  async function applyTo() {
    if (!apply) return;
    setBusy(true);
    try {
      await api(`/api/vacancies/${apply.id}/apply`, {});
      await refresh();
      setApply(null);
      notify("Отклик отправлен. Контакты доступны этой компании.");
    } catch (e) {
      notify(e instanceof Error ? e.message : "Не удалось откликнуться", true);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <SectionTitle
        eyebrow="ВАКАНСИИ"
        title={
          role === "candidate"
            ? "Можно сделать первый шаг"
            : "Расскажите о вашей задаче"
        }
        description={
          role === "candidate"
            ? "Самостоятельный отклик открывает ваши контакты только выбранной компании."
            : "Публикация — дополнительный путь. Адресные приглашения доступны и без вакансии."
        }
        action={
          role === "employer" ? (
            <Button
              onClick={() => setCreating(true)}
              disabled={!demands.length}
            >
              <Plus size={16} /> Опубликовать
            </Button>
          ) : undefined
        }
      />
      {vacancies.length ? (
        <div className="vacancy-list">
          {vacancies.map((v) => (
            <article className="card vacancy-card" key={v.id}>
              <div>
                <div className="vacancy-company">
                  <BriefcaseBusiness size={17} />
                  {v.company}
                </div>
                <h2>{v.title}</h2>
                <Badge tone="blue">
                  {specName(v.specialization)} · {gradeName(v.grade)}
                </Badge>
                <p>{v.description}</p>
                <SkillTags skills={v.skills} />
              </div>
              <div className="vacancy-side">
                {v.salaryFrom && v.salaryTo ? (
                  <strong>
                    {money(v.salaryFrom)}–{money(v.salaryTo)} ₽
                    <small>в месяц</small>
                  </strong>
                ) : (
                  <span className="muted">Зарплата обсуждается</span>
                )}
                {role === "candidate" &&
                  (v.applied ? (
                    <Badge tone="green">
                      <CheckCircle2 size={13} /> Вы откликнулись
                    </Badge>
                  ) : (
                    <Button variant="secondary" onClick={() => setApply(v)}>
                      Откликнуться <ArrowRight size={15} />
                    </Button>
                  ))}
              </div>
            </article>
          ))}
        </div>
      ) : (
        <Empty
          title="Витрина пока пуста"
          text={
            role === "candidate"
              ? "Новые задачи появятся здесь. Пока можно подготовить профиль и проверить навыки."
              : "Создайте потребность с зарплатой и опубликуйте её как вакансию."
          }
          icon={<BriefcaseBusiness size={26} />}
        />
      )}{" "}
      {creating && (
        <Modal
          title="Опубликовать потребность"
          onClose={() => setCreating(false)}
        >
          <p className="modal-description">
            Выберите готовую потребность. Для публикации нужен диапазон
            зарплаты.
          </p>
          <Field label="Потребность">
            <select
              value={selected}
              onChange={(e) => setSelected(e.target.value)}
            >
              {demands.map((d) => (
                <option value={d.id} key={d.id}>
                  {d.title}
                </option>
              ))}
            </select>
          </Field>
          <div className="modal-actions">
            <Button variant="secondary" onClick={() => setCreating(false)}>
              Отмена
            </Button>
            <Button busy={busy} disabled={!selected} onClick={publish}>
              Опубликовать вакансию
            </Button>
          </div>
        </Modal>
      )}{" "}
      {apply && (
        <Modal title="Откликнуться на вакансию?" onClose={() => setApply(null)}>
          <p className="modal-description">
            <strong>{apply.company}</strong> увидит ваш профиль, email и
            телефон. Отклик подтверждает согласие на передачу контактов этой
            компании.
          </p>
          <div className="info-note">
            <LockKeyhole size={16} />
            <p>Для остальных работодателей доступ к контактам не изменится.</p>
          </div>
          <div className="modal-actions">
            <Button variant="secondary" onClick={() => setApply(null)}>
              Отмена
            </Button>
            <Button busy={busy} onClick={applyTo}>
              Откликнуться и открыть контакты
            </Button>
          </div>
        </Modal>
      )}
    </>
  );
}
