"use client";
import { useEffect, useState } from "react";
import { ArrowRight, Filter, Search, ShieldCheck, Users } from "lucide-react";
import { CandidateDetail, InviteModal } from "./employer";
import {
  Button,
  CandidateCard,
  Empty,
  Field,
  Loading,
  SectionTitle,
} from "./primitives";
import { api, type Candidate, type Employer } from "./types";

export function CandidateCatalog({
  profile,
  refresh,
  notify,
}: {
  profile: Employer;
  refresh: () => Promise<void>;
  notify: (text: string, error?: boolean) => void;
}) {
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [busy, setBusy] = useState(true);
  const [spec, setSpec] = useState("");
  const [grade, setGrade] = useState("");
  const [skills, setSkills] = useState("");
  const [fspOnly, setFspOnly] = useState(false);
  const [search, setSearch] = useState("");
  const [detail, setDetail] = useState<Candidate | null>(null);
  const [invite, setInvite] = useState<Candidate | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    api<Candidate[]>("/api/candidates")
      .then((data) => {
        if (active)
          setCandidates(data.map((c) => ({ ...c, score: undefined })));
      })
      .catch((e) => {
        if (active) setError(e.message);
      })
      .finally(() => {
        if (active) setBusy(false);
      });
    return () => {
      active = false;
    };
  }, []);
  async function applyFilters(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const q = new URLSearchParams();
    if (spec) q.set("specialization", spec);
    if (grade) q.set("grade", grade);
    if (skills.trim()) q.set("skills", skills.trim());
    if (fspOnly) q.set("fspOnly", "true");
    try {
      const data = await api<Candidate[]>(`/api/candidates?${q}`);
      setCandidates(data.map((c) => ({ ...c, score: undefined })));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не удалось загрузить каталог");
    } finally {
      setBusy(false);
    }
  }
  const visible = candidates.filter(
    (c) =>
      !search ||
      `${c.name} ${c.title} ${c.city}`
        .toLowerCase()
        .includes(search.toLowerCase()),
  );
  return (
    <>
      <SectionTitle
        eyebrow="КАТАЛОГ КАНДИДАТОВ"
        title="Поиск по подтверждённым категориям"
        description="Найдите специалиста по направлению, уровню, стеку и достижениям ФСП."
      />
      <form onSubmit={applyFilters} className="card catalog-filters">
        <div className="catalog-filter-grid">
          <Field label="Специализация">
            <select value={spec} onChange={(e) => setSpec(e.target.value)}>
              <option value="">Все направления</option>
              <option value="backend">Backend</option>
              <option value="frontend">Frontend</option>
            </select>
          </Field>
          <Field label="Подтверждённый грейд">
            <select value={grade} onChange={(e) => setGrade(e.target.value)}>
              <option value="">Все уровни</option>
              <option value="junior">Junior</option>
              <option value="middle">Middle</option>
            </select>
          </Field>
          <Field label="Навыки, через запятую">
            <input
              value={skills}
              onChange={(e) => setSkills(e.target.value)}
              placeholder="Python, SQL"
              maxLength={500}
            />
          </Field>
        </div>
        <div className="catalog-filter-bottom">
          <label className="check-label">
            <input
              type="checkbox"
              checked={fspOnly}
              onChange={(e) => setFspOnly(e.target.checked)}
            />
            <span>С подтверждёнными достижениями ФСП</span>
          </label>
          <Button type="submit" busy={busy} variant="secondary">
            <Filter size={15} /> Применить фильтры
          </Button>
        </div>
      </form>
      <div className="catalog-list-heading">
        <div>
          <h2>Найдено: {visible.length}</h2>
          <p>Заявленные и подтверждённые навыки показаны отдельно.</p>
        </div>
        <div className="search-input">
          <Search size={17} />
          <input
            aria-label="Поиск по имени и городу"
            placeholder="Имя или город"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>
      {error && (
        <p className="inline-error" role="alert">
          {error}
        </p>
      )}
      {busy ? (
        <Loading text="Ищем подтверждённые профили…" />
      ) : visible.length ? (
        <div className="catalog-candidates">
          {visible.map((candidate) => (
            <CandidateCard
              key={candidate.id}
              candidate={candidate}
              onView={() => setDetail(candidate)}
              onInvite={() => setInvite(candidate)}
            />
          ))}
        </div>
      ) : (
        <Empty
          title="По вашему запросу нет кандидатов"
          text="Уточните направление, грейд или набор навыков. В каталоге показаны только опубликованные профили с подтверждённой категорией."
          icon={<Search size={26} />}
        />
      )}
      <div className="info-note catalog-note">
        <ShieldCheck size={17} />
        <p>
          Каталог фильтрует профиль по требованиям. Чтобы получить баллы
          соответствия и объяснения ранжирования, создайте потребность в разделе
          «Подбор кандидатов».
        </p>
      </div>
      {detail && (
        <CandidateDetail
          candidate={detail}
          onClose={() => setDetail(null)}
          onInvite={() => {
            setInvite(detail);
            setDetail(null);
          }}
        />
      )}
      {invite && (
        <InviteModal
          candidate={invite}
          profile={profile}
          onClose={() => setInvite(null)}
          onSent={async () => {
            setInvite(null);
            await refresh();
            notify("Приглашение отправлено");
          }}
          notify={notify}
        />
      )}
    </>
  );
}
