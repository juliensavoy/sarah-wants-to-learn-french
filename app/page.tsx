import Link from "next/link";
import { getProgress } from "@/lib/notion";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  let progress: Awaited<ReturnType<typeof getProgress>> = null;
  try {
    progress = await getProgress();
  } catch {
    progress = null;
  }

  const streak = progress?.streak ?? 0;
  const xp = progress?.xp ?? 0;
  const level = progress?.level ?? 1;

  return (
    <div className="space-y-8 sm:space-y-10">
      <div className="animate-fade-up">
        <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[var(--accent)] sm:text-sm">
          Aujourd&apos;hui
        </p>
        <h1 className="mt-2 font-[family-name:var(--font-display)] text-[1.65rem] font-semibold leading-tight text-balance text-[var(--ink)] sm:text-4xl">
          Bonjour, Sarah
        </h1>
        <p className="mt-3 max-w-md border-l-2 border-[var(--gold)] pl-4 text-sm italic leading-relaxed text-[var(--muted)] sm:text-base">
          Petit à petit, l&apos;oiseau fait son nid.
        </p>
      </div>

      <div className="grid animate-fade-up-delay grid-cols-3 gap-2 sm:gap-4">
        {(
          [
            { label: "Streak", value: String(streak), unit: "jours" as const },
            { label: "XP", value: String(xp), unit: null },
            { label: "Level", value: String(level), unit: null },
          ] as const
        ).map((card) => (
          <div
            key={card.label}
            className="card-glass flex flex-col rounded-2xl px-2 py-4 text-center ring-1 ring-[color-mix(in_oklab,var(--ink)_10%,transparent)] sm:min-h-[8.5rem] sm:rounded-3xl sm:px-3 sm:py-5"
          >
            <p className="text-[0.65rem] font-bold uppercase tracking-[0.14em] text-[var(--ink)] sm:text-xs">
              {card.label}
            </p>
            <div className="mt-3 flex min-h-[3.25rem] flex-1 flex-col items-center justify-center sm:min-h-[4rem]">
              <span className="font-[family-name:var(--font-body)] text-[1.35rem] font-extrabold leading-none tracking-tight text-[var(--ink)] tabular-nums sm:text-[1.75rem]">
                {card.value}
              </span>
              <div className="mt-1 min-h-[1.05rem]">
                {card.unit ? (
                  <span className="text-[0.7rem] font-semibold leading-tight text-[var(--muted)] sm:text-xs">
                    {card.unit}
                  </span>
                ) : null}
              </div>
            </div>
          </div>
        ))}
      </div>

      {!progress ? (
        <p className="animate-fade-up-delay-2 rounded-2xl border border-amber-200/90 bg-gradient-to-br from-amber-50 to-[#fff8f0] px-4 py-3 text-sm leading-relaxed text-amber-950 shadow-sm">
          Add a row in your Notion progress database (level, xp, streak,
          last_active) so the dashboard can sync.
        </p>
      ) : null}

      <div className="animate-fade-up-delay-2 flex flex-col gap-3 sm:gap-4">
        <Link
          href="/quiz"
          className="btn-primary flex min-h-[3.25rem] items-center justify-center rounded-2xl px-6 py-4 text-center text-base font-bold tracking-wide sm:min-h-[3.5rem] sm:rounded-3xl"
        >
          Start Quiz
        </Link>
        <Link
          href="/chat"
          className="flex min-h-[3.25rem] items-center justify-center rounded-2xl border-2 border-[color-mix(in_oklab,var(--accent)_55%,transparent)] bg-[color-mix(in_oklab,var(--paper)_70%,var(--accent-soft))] px-6 py-4 text-center text-base font-bold tracking-wide text-[var(--accent)] shadow-md transition hover:border-[var(--accent)] hover:bg-[var(--accent-soft)] active:scale-[0.99] sm:min-h-[3.5rem] sm:rounded-3xl"
        >
          Practice Chat
        </Link>
      </div>
    </div>
  );
}
