import { NextResponse } from "next/server";
import { logSession } from "@/lib/notion";

export async function POST(request: Request) {
  try {
    const { type, score, xp_earned } = await request.json();
    if (!type || typeof score !== "number" || typeof xp_earned !== "number") {
      return NextResponse.json(
        { error: "type, score (number), xp_earned (number) required" },
        { status: 400 }
      );
    }
    await logSession({ type, score, xp_earned });
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { error: "Could not log session" },
      { status: 500 }
    );
  }
}
