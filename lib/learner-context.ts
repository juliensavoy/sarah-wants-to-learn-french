import { getProgress } from "@/lib/notion";

/** Short paragraph for Claude: level / XP / streak from Notion (single-user app). */
export async function getLearnerProgressForPrompt(): Promise<string> {
  try {
    const p = await getProgress();
    if (!p) {
      return "Learner: no progress row in Notion yet — treat as a complete beginner (A1). Keep everything very simple.";
    }
    const level = p.level ?? 1;
    const xp = p.xp ?? 0;
    const streak = p.streak ?? 0;
    return [
      "Learner snapshot (one user, from Notion — use as a soft difficulty dial, not strict CEFR):",
      `- level ${level}, ${xp} XP, ${streak}-day streak.`,
      "Rough guide for you: level 1–2 → very short sentences, basic vocabulary, lots of support in English when needed; 3–5 → more French in explanations, richer distractors in quizzes, new_words can stretch slightly; 6+ → still gentle corrections but assume growing comfort with everyday French.",
      "Never mention XP, streak, or Notion to the learner unless they ask.",
    ].join("\n");
  } catch {
    return "Learner: could not read progress from Notion — default to gentle beginner difficulty.";
  }
}
