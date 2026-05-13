// lib/notion.js
const NOTION_TOKEN = process.env.NOTION_TOKEN;
const BASE_URL = "https://api.notion.com/v1";

const headers = {
  "Authorization": `Bearer ${NOTION_TOKEN}`,
  "Content-Type": "application/json",
  "Notion-Version": "2022-06-28",
};

/** Parse Notion JSON and throw a clear Error on API failure. */
async function readNotionJson(res, context = "") {
  if (!process.env.NOTION_TOKEN?.trim()) {
    throw new Error(
      `${context ? `${context} — ` : ""}NOTION_TOKEN is missing. Add it to .env.local at the project root (Next.js does not load lib/.env.local).`
    );
  }
  let data;
  try {
    data = await res.json();
  } catch {
    data = {};
  }
  const prefix = context ? `${context} — ` : "";
  if (!res.ok) {
    const msg =
      data?.message ||
      data?.code ||
      res.statusText;
    throw new Error(`${prefix}Notion HTTP ${res.status}: ${msg}`);
  }
  if (data?.object === "error") {
    const msg =
      [data.message, data.code].filter(Boolean).join(" — ") ||
      "Unknown Notion error";
    throw new Error(`${prefix}${msg}`);
  }
  return data;
}

// ─── USER PROGRESS ───────────────────────────────────────────

export async function getProgress() {
  const res = await fetch(
    `${BASE_URL}/databases/${process.env.NOTION_PROGRESS_DB_ID}/query`,
    { method: "POST", headers, body: JSON.stringify({}) }
  );
  const data = await readNotionJson(res, "Progress DB query");
  const page = data.results[0];
  if (!page) return null;

  return {
    pageId: page.id,
    level: page.properties.level.number,
    xp: page.properties.xp.number,
    streak: page.properties.streak.number,
    last_active: page.properties.last_active.date?.start,
  };
}

export async function updateProgress(pageId, { level, xp, streak }) {
  const res = await fetch(`${BASE_URL}/pages/${pageId}`, {
    method: "PATCH",
    headers,
    body: JSON.stringify({
      properties: {
        level: { number: level },
        xp: { number: xp },
        streak: { number: streak },
        last_active: { date: { start: new Date().toISOString() } },
      },
    }),
  });
  await readNotionJson(res, "updateProgress");
}

// ─── VOCABULARY ──────────────────────────────────────────────

export async function getVocabDueForReview(pageSize = 10) {
  const today = new Date().toISOString();
  const res = await fetch(
    `${BASE_URL}/databases/${process.env.NOTION_VOCAB_DB_ID}/query`,
    {
      method: "POST",
      headers,
      body: JSON.stringify({
        filter: {
          and: [
            { property: "status", select: { equals: "learning" } },
            { property: "next_review", date: { on_or_before: today } },
          ],
        },
        page_size: Math.min(Math.max(pageSize, 1), 100),
      }),
    }
  );
  const data = await readNotionJson(res, "Vocab due query");
  return data.results.map((p) => ({
    pageId: p.id,
    word_fr: p.properties.word_fr.title[0]?.plain_text,
    word_en: p.properties.word_en.rich_text[0]?.plain_text,
    times_seen: p.properties.times_seen.number,
    times_correct: p.properties.times_correct.number,
  }));
}

/** True if the vocab database has zero pages (unfiltered). */
export async function isVocabDatabaseEmpty() {
  const res = await fetch(
    `${BASE_URL}/databases/${process.env.NOTION_VOCAB_DB_ID}/query`,
    {
      method: "POST",
      headers,
      body: JSON.stringify({ page_size: 1 }),
    }
  );
  const data = await readNotionJson(res, "Vocab empty check");
  return !data.results?.length;
}

export function isUsableVocabRow(w) {
  return Boolean(w?.pageId && w.word_fr && w.word_en);
}

/**
 * True if at least one row is usable in the quiz (learning + title + gloss),
 * either due for review or in the learning pool.
 */
export async function hasUsableVocabForQuiz() {
  const due = await getVocabDueForReview(100);
  if (due.some(isUsableVocabRow)) return true;
  const pool = await getVocabLearningWords(100);
  return pool.some(isUsableVocabRow);
}

/** Any rows in "learning" (ignores next_review) — for quiz when nothing is due yet. */
export async function getVocabLearningWords(pageSize = 40) {
  const res = await fetch(
    `${BASE_URL}/databases/${process.env.NOTION_VOCAB_DB_ID}/query`,
    {
      method: "POST",
      headers,
      body: JSON.stringify({
        filter: { property: "status", select: { equals: "learning" } },
        page_size: Math.min(Math.max(pageSize, 1), 100),
      }),
    }
  );
  const data = await readNotionJson(res, "Vocab learning pool query");
  return data.results.map((p) => ({
    pageId: p.id,
    word_fr: p.properties.word_fr.title[0]?.plain_text,
    word_en: p.properties.word_en.rich_text[0]?.plain_text,
    times_seen: p.properties.times_seen.number,
    times_correct: p.properties.times_correct.number,
  }));
}

export async function vocabWordExists(word_fr) {
  const res = await fetch(
    `${BASE_URL}/databases/${process.env.NOTION_VOCAB_DB_ID}/query`,
    {
      method: "POST",
      headers,
      body: JSON.stringify({
        filter: {
          property: "word_fr",
          title: { equals: word_fr },
        },
      }),
    }
  );
  const data = await readNotionJson(res, "vocabWordExists");
  return data.results.length > 0;
}

/** First matching vocab page id for this French title, or null. */
export async function getVocabPageIdByWordFr(word_fr) {
  const res = await fetch(
    `${BASE_URL}/databases/${process.env.NOTION_VOCAB_DB_ID}/query`,
    {
      method: "POST",
      headers,
      body: JSON.stringify({
        filter: {
          property: "word_fr",
          title: { equals: word_fr },
        },
        page_size: 1,
      }),
    }
  );
  const data = await readNotionJson(res, "getVocabPageIdByWordFr");
  return data.results[0]?.id ?? null;
}

export async function addVocabWord({ word_fr, word_en, dueImmediately = false }) {
  const nextReview = dueImmediately
    ? new Date()
    : (() => {
        const d = new Date();
        d.setDate(d.getDate() + 1);
        return d;
      })();

  const res = await fetch(`${BASE_URL}/pages`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      parent: { database_id: process.env.NOTION_VOCAB_DB_ID },
      properties: {
        word_fr: { title: [{ text: { content: word_fr } }] },
        word_en: { rich_text: [{ text: { content: word_en } }] },
        times_seen: { number: 0 },
        times_correct: { number: 0 },
        next_review: { date: { start: nextReview.toISOString() } },
        status: { select: { name: "learning" } },
      },
    }),
  });
  const data = await readNotionJson(res, `addVocabWord("${word_fr}")`);
  if (!data.id) {
    throw new Error(`addVocabWord("${word_fr}") — Notion returned no page id`);
  }
  return data.id;
}

/**
 * Adds each { word_fr, word_en } if not already in the vocab DB.
 * Returns map of word_fr → new page id for rows created in this call.
 * @param {{ dueImmediately?: boolean }} [opts] — if dueImmediately, new rows are due for review now (starter deck).
 */
export async function addMissingVocabFromList(entries, opts = {}) {
  const dueImmediately = Boolean(opts.dueImmediately);
  const created = new Map();
  if (!Array.isArray(entries)) return created;
  for (const raw of entries) {
    const word_fr = String(raw.word_fr ?? "").trim();
    const word_en = String(raw.word_en ?? "").trim();
    if (!word_fr || !word_en) continue;
    if (await vocabWordExists(word_fr)) continue;
    const id = await addVocabWord({ word_fr, word_en, dueImmediately });
    created.set(word_fr, id);
  }
  return created;
}

export async function updateVocabAfterQuiz(pageId, wasCorrect) {
  // Simple spaced repetition: correct = +3 days, wrong = +1 day
  const next = new Date();
  next.setDate(next.getDate() + (wasCorrect ? 3 : 1));

  const pageRes = await fetch(`${BASE_URL}/pages/${pageId}`, { headers });
  const word = await readNotionJson(pageRes, "updateVocabAfterQuiz (read page)");
  const seen = (word.properties.times_seen.number ?? 0) + 1;
  const correct = (word.properties.times_correct.number ?? 0) + (wasCorrect ? 1 : 0);
  const accuracy = correct / seen;

  const patchRes = await fetch(`${BASE_URL}/pages/${pageId}`, {
    method: "PATCH",
    headers,
    body: JSON.stringify({
      properties: {
        times_seen: { number: seen },
        times_correct: { number: correct },
        next_review: { date: { start: next.toISOString() } },
        status: { select: { name: accuracy >= 0.8 && seen >= 5 ? "mastered" : "learning" } },
      },
    }),
  });
  await readNotionJson(patchRes, "updateVocabAfterQuiz (patch)");
}

// ─── SESSIONS ────────────────────────────────────────────────

export async function logSession({ type, score, xp_earned }) {
  const today = new Date();
  const res = await fetch(`${BASE_URL}/pages`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      parent: { database_id: process.env.NOTION_SESSIONS_DB_ID },
      properties: {
        Name: { title: [{ text: { content: `Session ${today.toLocaleDateString("fr-FR")}` } }] },
        date: { date: { start: today.toISOString() } },
        type: { select: { name: type } },
        score: { number: score },
        xp_earned: { number: xp_earned },
      },
    }),
  });
  await readNotionJson(res, "logSession");
}