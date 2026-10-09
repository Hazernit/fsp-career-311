import type { Exam } from "./types";

const PREFIX = "fsp-exam-draft:";
type Draft = { userId: string; answers: Record<string, string>; index: number };

function storage(): Storage | null {
  try {
    return typeof window === "undefined" ? null : window.sessionStorage;
  } catch {
    // Restricted browsers can still complete the test without draft storage.
    return null;
  }
}

/** Restore only choices that belong to this authenticated user's current attempt. */
export function restoreExamDraft(
  exam: Exam,
  userId: string,
): Pick<Draft, "answers" | "index"> {
  const empty = { answers: {}, index: 0 };
  try {
    const raw = storage()?.getItem(PREFIX + exam.id);
    if (!raw) return empty;
    const draft = JSON.parse(raw) as Partial<Draft>;
    if (
      draft.userId !== userId ||
      !draft.answers ||
      typeof draft.answers !== "object" ||
      Array.isArray(draft.answers)
    )
      return empty;
    const answers = Object.fromEntries(
      exam.questions.flatMap((question) => {
        const optionId = draft.answers?.[question.id];
        return typeof optionId === "string" &&
          question.options.some((option) => option.id === optionId)
          ? [[question.id, optionId]]
          : [];
      }),
    );
    const index =
      typeof draft.index === "number" &&
      Number.isInteger(draft.index) &&
      draft.index >= 0 &&
      draft.index < exam.questions.length
        ? draft.index
        : 0;
    return { answers, index };
  } catch {
    return empty;
  }
}

export function saveExamDraft(
  attemptId: string,
  userId: string,
  answers: Record<string, string>,
  index: number,
): void {
  try {
    storage()?.setItem(
      PREFIX + attemptId,
      JSON.stringify({ userId, answers, index } satisfies Draft),
    );
  } catch {
    // Storage quota or browser privacy restrictions must not interrupt the exam.
  }
}

export function removeExamDraft(attemptId: string): void {
  try {
    storage()?.removeItem(PREFIX + attemptId);
  } catch {
    /* Optional draft storage. */
  }
}

/** A different server attempt replaces drafts for this user; no result or timer is cached. */
export function pruneExamDrafts(userId: string, keepAttemptId?: string): void {
  try {
    const store = storage();
    if (!store) return;
    for (let i = store.length - 1; i >= 0; i--) {
      const key = store.key(i);
      if (!key?.startsWith(PREFIX) || key === PREFIX + keepAttemptId) continue;
      try {
        if (
          (JSON.parse(store.getItem(key) || "{}") as Partial<Draft>).userId ===
          userId
        )
          store.removeItem(key);
      } catch {
        store.removeItem(key);
      }
    }
  } catch {
    /* Optional draft storage. */
  }
}

export function clearExamDrafts(): void {
  try {
    const store = storage();
    if (!store) return;
    for (let i = store.length - 1; i >= 0; i--) {
      const key = store.key(i);
      if (key?.startsWith(PREFIX)) store.removeItem(key);
    }
  } catch {
    /* Logout remains available when browser storage is restricted. */
  }
}
