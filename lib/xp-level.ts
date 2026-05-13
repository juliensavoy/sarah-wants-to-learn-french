/**
 * Single-user XP → level. Tune progression by changing {@link XP_PER_LEVEL}
 * only (lower = faster level-ups, higher = slower).
 *
 * Formula: level = max(1, 1 + floor(totalXp / XP_PER_LEVEL))
 */
export const XP_PER_LEVEL = 220;

export function levelFromTotalXp(totalXp: number): number {
  const xp = Math.max(0, Math.floor(Number(totalXp) || 0));
  return Math.max(1, 1 + Math.floor(xp / XP_PER_LEVEL));
}
