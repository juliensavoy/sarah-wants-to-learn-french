import { NextRequest, NextResponse } from "next/server";
import { getVocabLearningWords } from "@/lib/notion";

/** Learning-status vocab regardless of next_review (for quiz when nothing is “due” yet). */
export async function GET(request: NextRequest) {
  try {
    const raw = request.nextUrl.searchParams.get("pageSize");
    const pageSize = raw ? Math.min(100, Math.max(1, parseInt(raw, 10))) : 40;
    const words = await getVocabLearningWords(pageSize);
    return NextResponse.json({ words });
  } catch (e) {
    console.error(e);
    const message =
      e instanceof Error ? e.message : "Could not load vocabulary pool";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
