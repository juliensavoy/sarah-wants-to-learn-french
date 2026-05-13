import { NextResponse } from "next/server";
import { getAnthropic, getClaudeModel } from "@/lib/anthropic";
import { getLearnerProgressForPrompt } from "@/lib/learner-context";
import type { QuizQuestion } from "@/lib/quiz-types";
import {
  addMissingVocabFromList,
  getVocabPageIdByWordFr,
} from "@/lib/notion";

type RawQuizItem = {
  question: string;
  answer: string;
  word_fr: string;
  word_en: string;
  options?: string[];
  correctIndex?: number;
};

type ClaudeQuizPayload = {
  quiz?: RawQuizItem[];
  new_words?: { word_fr: string; word_en: string }[];
};

function extractJsonObject(text: string): string {
  const trimmed = text.trim();
  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) {
    throw new Error("No JSON object in response");
  }
  return trimmed.slice(start, end + 1);
}

function normFr(s: string) {
  return String(s ?? "").trim();
}

export async function POST(request: Request) {
  try {
    const { words } = await request.json();
    if (!Array.isArray(words) || words.length === 0) {
      return NextResponse.json(
        { error: "words array required" },
        { status: 400 }
      );
    }

    const client = getAnthropic();
    const vocabJson = JSON.stringify(
      words.map((w: { pageId: string; word_fr: string; word_en: string }) => ({
        pageId: w.pageId,
        word_fr: w.word_fr,
        word_en: w.word_en,
      }))
    );

    const learnerBlock = await getLearnerProgressForPrompt();

    const userPrompt = `You are building a French vocabulary quiz.

${learnerBlock}

Here is JSON of words due for review (each has pageId, word_fr, word_en):
${vocabJson}

Return a JSON object with two keys:
- quiz: array of 10 question objects { question, answer, word_fr, word_en }
  Each item MUST also include "options": an array of exactly 4 strings (the multiple-choice answers) and "correctIndex": integer 0–3 so that options[correctIndex] === answer exactly.
  Mix question styles: French→English, English→French, short fill-in style cues. Wrong options should be plausible confusions.
- new_words: array of { word_fr, word_en } for every new French word or phrase you introduce in the quiz (in questions, options, or explanations) that does NOT already appear in the input list above. Use learner-friendly headwords (e.g. infinitives for verbs if you show them that way). Match the difficulty dial above: higher level → new_words may be slightly more advanced; low level → keep new_words very basic. If you introduce nothing new outside the input deck, use an empty array.

Rules:
- Exactly 10 objects in quiz.
- word_fr / word_en on each quiz row identify the primary lexical item being tested (must match one of the input rows' word_fr for deck items, or a new headword you introduced).
- Return ONLY valid JSON, no markdown fences.`;

    const msg = await client.messages.create({
      model: getClaudeModel(),
      max_tokens: 4096,
      messages: [{ role: "user", content: userPrompt }],
    });

    const block = msg.content.find((b) => b.type === "text");
    if (!block || block.type !== "text") {
      throw new Error("No text from model");
    }

    const parsed = JSON.parse(extractJsonObject(block.text)) as ClaudeQuizPayload;
    const rawQuiz = Array.isArray(parsed.quiz) ? parsed.quiz : [];
    const newWords = Array.isArray(parsed.new_words) ? parsed.new_words : [];

    if (rawQuiz.length < 10) {
      return NextResponse.json(
        { error: "Model returned fewer than 10 quiz items; try again." },
        { status: 422 }
      );
    }

    const createdByFr = await addMissingVocabFromList(newWords);

    const pageByFr = new Map(
      words.map((w: { pageId: string; word_fr: string }) => [
        normFr(w.word_fr),
        w.pageId,
      ])
    );

    const questions: QuizQuestion[] = [];
    for (let i = 0; i < 10; i++) {
      const q = rawQuiz[i];
      const word_fr = normFr(q.word_fr);
      const word_en = String(q.word_en ?? "").trim();
      const question = String(q.question ?? "").trim();
      const options = Array.isArray(q.options)
        ? q.options.map((o) => String(o))
        : [];
      const correctIndex =
        typeof q.correctIndex === "number" ? q.correctIndex : -1;

      if (options.length !== 4 || correctIndex < 0 || correctIndex > 3) {
        return NextResponse.json(
          { error: "Each quiz item needs options[4] and correctIndex 0–3" },
          { status: 422 }
        );
      }

      const pageId =
        pageByFr.get(word_fr) ??
        createdByFr.get(word_fr) ??
        (await getVocabPageIdByWordFr(word_fr));
      if (!pageId) {
        return NextResponse.json(
          {
            error: `Could not resolve Notion page for word_fr: ${word_fr}`,
          },
          { status: 422 }
        );
      }

      questions.push({
        pageId,
        prompt: question,
        options,
        correctIndex,
        word_fr,
        word_en,
      });
    }

    return NextResponse.json({ questions });
  } catch (e) {
    console.error(e);
    const message = e instanceof Error ? e.message : "Quiz generation failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
