import { NextResponse } from "next/server";
import { getAnthropic, CLAUDE_MODEL } from "@/lib/anthropic";
import {
  addVocabWord,
  hasUsableVocabForQuiz,
  vocabWordExists,
} from "@/lib/notion";

function extractJsonObject(text: string): string {
  const trimmed = text.trim();
  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) {
    throw new Error("No JSON object in response");
  }
  return trimmed.slice(start, end + 1);
}

/** Fills the vocab DB with a beginner deck when nothing is usable in the app yet (Claude + Notion). Idempotent per word_fr. */
export async function POST() {
  try {
    if (await hasUsableVocabForQuiz()) {
      return NextResponse.json({
        skipped: true,
        reason: "has_usable_vocabulary",
      });
    }

    const client = getAnthropic();
    const prompt = `You are preparing a starter French vocabulary list for an English-speaking beginner (CEFR A1–low A2).

Return ONLY valid JSON, no markdown fences, in this exact shape:
{"words":[{"word_fr":"French word or short phrase","word_en":"English gloss"}, ...]}

Requirements:
- Exactly 36 entries in "words".
- word_fr: common classroom French (single words or very short phrases like "s'il vous plaît").
- word_en: short, clear gloss.
- Cover: greetings & politeness, question words, numbers 1–10, days/time words, être/avoir/aller/faire/aimer (infinitives or high-frequency forms), articles, family, food, colors, places, useful classroom phrases.
- No duplicate word_fr; no proper names as the main headword.

Return ONLY the JSON object.`;

    const msg = await client.messages.create({
      model: CLAUDE_MODEL,
      max_tokens: 4096,
      messages: [{ role: "user", content: prompt }],
    });

    const block = msg.content.find((b) => b.type === "text");
    if (!block || block.type !== "text") {
      throw new Error("No text from model");
    }

    const parsed = JSON.parse(extractJsonObject(block.text)) as {
      words?: { word_fr: string; word_en: string }[];
    };
    const list = Array.isArray(parsed.words) ? parsed.words : [];
    let added = 0;

    for (const raw of list) {
      const word_fr = String(raw.word_fr ?? "").trim();
      const word_en = String(raw.word_en ?? "").trim();
      if (!word_fr || !word_en) continue;
      if (await vocabWordExists(word_fr)) continue;
      try {
        await addVocabWord({ word_fr, word_en, dueImmediately: true });
        added += 1;
      } catch (err) {
        const detail = err instanceof Error ? err.message : String(err);
        return NextResponse.json(
          {
            error: `Saving starter word "${word_fr}" to Notion failed.`,
            detail,
            addedPartial: added,
          },
          { status: 422 }
        );
      }
    }

    if (added === 0) {
      return NextResponse.json(
        {
          error:
            "Seed produced no new rows (empty list from model, or every row was skipped).",
          hint:
            "If your vocab DB uses different property types or the select option is not named exactly \"learning\", Notion will reject creates.",
        },
        { status: 422 }
      );
    }

    return NextResponse.json({ seeded: true, added });
  } catch (e) {
    console.error(e);
    const message = e instanceof Error ? e.message : "Seed failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
