import { NextResponse } from "next/server";
import { getAnthropic, getClaudeModel } from "@/lib/anthropic";
import { addMissingVocabFromList } from "@/lib/notion";

function extractJsonObject(text: string): string {
  const trimmed = text.trim();
  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) {
    throw new Error("No JSON object in response");
  }
  return trimmed.slice(start, end + 1);
}

/** After a tutor reply, extract new_words and add any missing rows to Notion. */
export async function POST(request: Request) {
  try {
    const { text } = await request.json();
    if (typeof text !== "string" || !text.trim()) {
      return NextResponse.json({ error: "text required" }, { status: 400 });
    }

    const client = getAnthropic();
    const body = `You extract vocabulary for a French learning app.

Read this assistant message from a French tutor to a learner. Return ONLY valid JSON, no markdown, in this exact shape:
{"new_words":[{"word_fr":"French word or short phrase","word_en":"English gloss"}]}

Include each French word or expression the tutor clearly introduced as new material (explained, glossed, contrasted, or explicitly taught). Skip: words that only appear in fluent running text with no teaching intent, proper names, duplicates, and pure English.

If there is nothing to save, return {"new_words":[]}.

Message:
---
${text.trim().slice(0, 14000)}
---`;

    const msg = await client.messages.create({
      model: getClaudeModel(),
      max_tokens: 2048,
      messages: [{ role: "user", content: body }],
    });

    const block = msg.content.find((b) => b.type === "text");
    if (!block || block.type !== "text") {
      throw new Error("No text from model");
    }

    const parsed = JSON.parse(extractJsonObject(block.text)) as {
      new_words?: { word_fr: string; word_en: string }[];
    };
    const list = Array.isArray(parsed.new_words) ? parsed.new_words : [];
    const created = await addMissingVocabFromList(list);

    return NextResponse.json({
      ok: true,
      suggested: list.length,
      added: created.size,
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Ingest failed" },
      { status: 500 }
    );
  }
}
