import { NextRequest, NextResponse } from "next/server";
import { getVocabDueForReview } from "@/lib/notion";

export async function GET(request: NextRequest) {
  try {
    const raw = request.nextUrl.searchParams.get("pageSize");
    const pageSize = raw ? Math.min(100, Math.max(1, parseInt(raw, 10))) : 30;
    const words = await getVocabDueForReview(pageSize);
    return NextResponse.json({ words });
  } catch (e) {
    console.error(e);
    const message = e instanceof Error ? e.message : "Could not load vocabulary";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
