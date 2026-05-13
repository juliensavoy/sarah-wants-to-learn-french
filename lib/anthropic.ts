import Anthropic from "@anthropic-ai/sdk";

/**
 * Anthropic model id for chat, quiz generation, seed, vocab ingest.
 * Set `ANTHROPIC_MODEL` in `.env.local` / Vercel (e.g. `claude-sonnet-4-6` for best quality).
 * Default is Haiku — much cheaper; see https://platform.claude.com/docs/en/about-claude/models
 */
export function getClaudeModel(): string {
  const m = process.env.ANTHROPIC_MODEL?.trim();
  if (m) return m;
  return "claude-haiku-4-5";
}

export function getAnthropic() {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("Missing ANTHROPIC_API_KEY");
  return new Anthropic({ apiKey });
}
