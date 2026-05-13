import { NextResponse } from "next/server";
import { updateVocabAfterQuiz } from "@/lib/notion";

export async function POST(request: Request) {
  try {
    const { pageId, wasCorrect } = await request.json();
    if (!pageId || typeof wasCorrect !== "boolean") {
      return NextResponse.json(
        { error: "pageId and wasCorrect (boolean) required" },
        { status: 400 }
      );
    }
    await updateVocabAfterQuiz(pageId, wasCorrect);
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { error: "Could not update vocabulary" },
      { status: 500 }
    );
  }
}
