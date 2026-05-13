"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import type { QuizQuestion } from "@/lib/quiz-types";

type VocabWord = {
  pageId: string;
  word_fr: string;
  word_en: string;
  times_seen: number | null;
  times_correct: number | null;
};

const XP_PER_CORRECT = 12;

const NOTION_SCHEMA_HINT =
  'Notion vocab DB must include: title property named exactly "word_fr", rich text "word_en", numbers "times_seen" and "times_correct", date "next_review", and select "status" with an option named exactly "learning" (same spelling).';

async function readApiJson(res: Response): Promise<Record<string, unknown>> {
  const text = await res.text();
  try {
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    throw new Error(
      `Server returned non-JSON (HTTP ${res.status}): ${text.slice(0, 400)}`
    );
  }
}

function str(v: unknown): string | undefined {
  return typeof v === "string" ? v : undefined;
}

export default function QuizPage() {
  const started = useRef(false);
  const [phase, setPhase] = useState<
    "load" | "empty" | "quiz" | "done" | "error"
  >("load");
  const [error, setError] = useState<string | null>(null);
  const [emptyDetail, setEmptyDetail] = useState<string | null>(null);
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [index, setIndex] = useState(0);
  const [correctCount, setCorrectCount] = useState(0);
  const [finalScore, setFinalScore] = useState({ correct: 0, total: 0 });
  const [picked, setPicked] = useState<number | null>(null);
  const [locked, setLocked] = useState(false);

  const total = questions.length;
  const current = questions[index];

  const start = useCallback(async () => {
    setPhase("load");
    setError(null);
    setEmptyDetail(null);
    setQuestions([]);
    const lines: string[] = [];

    try {
      const dueRes = await fetch("/api/vocab/due?pageSize=40");
      const dueJson = await readApiJson(dueRes);
      if (!dueRes.ok) {
        throw new Error(
          str(dueJson.error) ||
            `Due vocabulary request failed (HTTP ${dueRes.status}).`
        );
      }
      let list = (dueJson.words || []) as VocabWord[];
      let valid = list.filter((w) => w.pageId && w.word_fr && w.word_en);
      lines.push(
        `Due for review: ${list.length} row(s) from Notion, ${valid.length} usable (need word_fr title + word_en rich text filled).`
      );

      if (valid.length === 0) {
        const seedRes = await fetch("/api/vocab/seed", { method: "POST" });
        const seedJson = await readApiJson(seedRes);
        if (!seedRes.ok) {
          const err = str(seedJson.error) || `HTTP ${seedRes.status}`;
          const detail = str(seedJson.detail);
          const hint = str(seedJson.hint);
          lines.push(
            `Starter deck (POST /api/vocab/seed): ${err}${detail ? ` — ${detail}` : ""}${hint ? ` — ${hint}` : ""}`
          );
        } else if (seedJson.skipped) {
          const r = String(seedJson.reason ?? "");
          lines.push(
            r === "has_usable_vocabulary"
              ? `Starter deck skipped: at least one usable row exists (learning + word_fr title + word_en rich text).`
              : `Starter deck skipped (reason: ${r || "unknown"}).`
          );
        } else if (seedJson.seeded) {
          lines.push(
            `Starter deck: reported ${String(seedJson.added)} new word(s) in Notion.`
          );
          const again = await fetch("/api/vocab/due?pageSize=40");
          const againJson = await readApiJson(again);
          if (!again.ok) {
            lines.push(
              `Re-fetch after seed failed: ${str(againJson.error) || again.statusText}`
            );
          } else {
            list = (againJson.words || []) as VocabWord[];
            valid = list.filter((w) => w.pageId && w.word_fr && w.word_en);
            lines.push(
              `After seed, due again: ${list.length} row(s), ${valid.length} usable.`
            );
          }
        }
      }

      if (valid.length === 0) {
        const poolRes = await fetch("/api/vocab/pool?pageSize=40");
        const poolJson = await readApiJson(poolRes);
        if (!poolRes.ok) {
          throw new Error(
            str(poolJson.error) ||
              `Learning pool request failed (HTTP ${poolRes.status}).`
          );
        }
        list = (poolJson.words || []) as VocabWord[];
        valid = list.filter((w) => w.pageId && w.word_fr && w.word_en);
        lines.push(
          `Learning pool (any "learning" row): ${list.length} row(s), ${valid.length} usable.`
        );
      }

      if (valid.length === 0) {
        lines.push("", NOTION_SCHEMA_HINT);
        lines.push(
          "",
          "Also check: NOTION_TOKEN and NOTION_VOCAB_DB_ID in .env.local at the project root (not only in lib/.env.local), and that the integration can access this database."
        );
        setEmptyDetail(lines.join("\n"));
        setPhase("empty");
        return;
      }

      const genRes = await fetch("/api/quiz/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ words: valid }),
      });
      const genJson = await readApiJson(genRes);
      if (!genRes.ok) {
        throw new Error(
          str(genJson.error) ||
            `Quiz generation failed (HTTP ${genRes.status}).`
        );
      }
      setQuestions(genJson.questions as QuizQuestion[]);
      setIndex(0);
      setCorrectCount(0);
      setPicked(null);
      setLocked(false);
      setPhase("quiz");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
      setPhase("error");
    }
  }, []);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    void start();
  }, [start]);

  const finishSession = useCallback(
    async (finalCorrect: number, n: number) => {
      const score = n > 0 ? Math.round((finalCorrect / n) * 100) : 0;
      const xpEarned = finalCorrect * XP_PER_CORRECT;
      await fetch("/api/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "quiz",
          score,
          xp_earned: xpEarned,
        }),
      });
      await fetch("/api/progress", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ xpEarned }),
      }).catch(() => {});
    },
    []
  );

  const onPick = async (optionIndex: number) => {
    if (!current || locked) return;
    setPicked(optionIndex);
    setLocked(true);
    const ok = optionIndex === current.correctIndex;
    const runningCorrect = correctCount + (ok ? 1 : 0);
    if (ok) setCorrectCount(runningCorrect);

    try {
      await fetch("/api/vocab/answer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pageId: current.pageId, wasCorrect: ok }),
      });
    } catch {
      /* still advance */
    }

    const nextIndex = index + 1;
    window.setTimeout(() => {
      if (nextIndex >= questions.length) {
        void (async () => {
          await finishSession(runningCorrect, questions.length);
          setFinalScore({ correct: runningCorrect, total: questions.length });
          setPhase("done");
        })();
        return;
      }
      setIndex(nextIndex);
      setPicked(null);
      setLocked(false);
    }, 650);
  };

  if (phase === "load") {
    return (
      <div className="flex flex-col items-center justify-center gap-5 py-16 sm:py-24">
        <div
          className="loader-fancy h-12 w-12 rounded-full sm:h-14 sm:w-14"
          aria-hidden
        />
        <p className="text-sm font-medium text-[var(--muted)]">
          Préparation du quiz…
        </p>
        <Link
          href="/"
          className="text-sm font-semibold text-[var(--accent)] underline decoration-[var(--gold)] decoration-2 underline-offset-4"
        >
          ← Annuler
        </Link>
      </div>
    );
  }

  if (phase === "empty") {
    return (
      <div className="space-y-5 text-left sm:space-y-6">
        <h1 className="text-center font-[family-name:var(--font-display)] text-2xl font-semibold text-[var(--ink)] sm:text-3xl">
          Vocabulaire indisponible
        </h1>
        <p className="text-center text-sm text-[var(--muted)]">
          The app could not load usable words from Notion. Details:
        </p>
        {emptyDetail ? (
          <pre className="card-glass max-h-[min(50vh,28rem)] overflow-auto whitespace-pre-wrap rounded-2xl p-4 text-left text-xs leading-relaxed text-[var(--ink)] sm:rounded-3xl sm:text-sm">
            {emptyDetail}
          </pre>
        ) : null}
        <div className="flex flex-col gap-3 pt-1">
          <button
            type="button"
            onClick={() => void start()}
            className="flex min-h-[3.25rem] w-full items-center justify-center rounded-2xl border-2 border-[color-mix(in_oklab,var(--accent)_50%,transparent)] bg-[color-mix(in_oklab,var(--paper)_85%,var(--accent-soft))] py-4 text-base font-bold text-[var(--accent)] shadow-sm transition hover:bg-[var(--accent-soft)] sm:rounded-3xl"
          >
            Retry
          </button>
          <Link
            href="/"
            className="block py-2 text-center text-sm font-semibold text-[var(--muted)]"
          >
            ← Home
          </Link>
        </div>
      </div>
    );
  }

  if (phase === "error") {
    return (
      <div className="space-y-5">
        <h1 className="font-[family-name:var(--font-display)] text-2xl font-semibold text-[var(--ink)] sm:text-3xl">
          Oups
        </h1>
        <p className="card-glass rounded-2xl border-[var(--wrong-border)] bg-[var(--wrong-bg)] px-4 py-3 text-sm leading-relaxed text-[var(--wrong-text)] whitespace-pre-wrap sm:rounded-3xl">
          {error}
        </p>
        <button
          type="button"
          onClick={() => void start()}
          className="flex min-h-[3.25rem] w-full items-center justify-center rounded-2xl border-2 border-[color-mix(in_oklab,var(--accent)_50%,transparent)] bg-[var(--accent-soft)] py-4 text-base font-bold text-[var(--accent)] sm:rounded-3xl"
        >
          Retry
        </button>
        <Link
          href="/"
          className="block text-center text-sm font-semibold text-[var(--muted)]"
        >
          ← Home
        </Link>
      </div>
    );
  }

  if (phase === "done") {
    const { correct, total: t } = finalScore;
    return (
      <div className="space-y-6 text-center sm:space-y-8">
        <p className="text-4xl" aria-hidden>
          ✧
        </p>
        <h1 className="font-[family-name:var(--font-display)] text-3xl font-semibold text-[var(--ink)] sm:text-4xl">
          Bravo !
        </h1>
        <p className="text-lg font-medium text-[var(--muted)] sm:text-xl">
          {correct} / {t} correct
        </p>
        <p className="text-sm text-[var(--muted)]">
          +{correct * XP_PER_CORRECT} XP · Session saved in Notion
        </p>
        <Link
          href="/"
          className="btn-primary inline-flex min-h-[3.25rem] items-center justify-center rounded-2xl px-10 py-3.5 text-base font-bold sm:min-h-[3.5rem] sm:rounded-3xl"
        >
          Dashboard
        </Link>
      </div>
    );
  }

  if (phase === "quiz" && current) {
    return (
      <div className="space-y-6 sm:space-y-8">
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-semibold text-[var(--muted)] sm:text-sm">
          <span>
            Question {index + 1} / {total}
          </span>
          <span className="rounded-full bg-[var(--gold-soft)] px-3 py-1 tabular-nums text-[var(--ink)] ring-1 ring-[color-mix(in_oklab,var(--gold)_40%,transparent)]">
            {correctCount} correct
          </span>
        </div>
        <p className="font-[family-name:var(--font-display)] text-lg font-medium leading-snug text-balance text-[var(--ink)] sm:text-xl">
          {current.prompt}
        </p>
        <ul className="flex flex-col gap-3 sm:gap-4">
          {current.options.map((opt, i) => {
            let cls =
              "card-glass w-full rounded-2xl border-2 border-[color-mix(in_oklab,var(--accent)_16%,transparent)] px-4 py-4 text-left text-[15px] transition min-h-[3.25rem] sm:min-h-[3.5rem] sm:rounded-3xl sm:text-base";
            if (picked !== null) {
              if (i === current.correctIndex)
                cls +=
                  " !border-[var(--success-border)] !bg-[var(--success-bg)] !text-[var(--success-text)] shadow-inner";
              else if (i === picked && picked !== current.correctIndex)
                cls +=
                  " !border-[var(--wrong-border)] !bg-[var(--wrong-bg)] !text-[var(--wrong-text)]";
              else cls += " opacity-55";
            } else
              cls +=
                " active:scale-[0.99] hover:border-[color-mix(in_oklab,var(--accent)_45%,transparent)] hover:shadow-md";
            return (
              <li key={i}>
                <button
                  type="button"
                  disabled={locked}
                  onClick={() => void onPick(i)}
                  className={cls}
                >
                  {opt}
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    );
  }

  return null;
}
