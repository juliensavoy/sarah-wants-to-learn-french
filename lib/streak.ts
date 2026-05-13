/** Next streak value after an activity today, given last_active and current streak. */
export function nextStreakAfterActivity(
  currentStreak: number,
  lastActiveIso: string | null | undefined
): number {
  if (!lastActiveIso) return Math.max(1, currentStreak || 1);
  const last = new Date(lastActiveIso);
  const now = new Date();
  const startOf = (d: Date) =>
    new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const d0 = startOf(now);
  const d1 = startOf(last);
  const diffDays = Math.round((d0 - d1) / 86400000);
  if (diffDays === 0) return Math.max(currentStreak, 1);
  if (diffDays === 1) return Math.max(currentStreak, 0) + 1;
  return 1;
}
