import { NextResponse } from "next/server";
import { getProgress, updateProgress } from "@/lib/notion";
import { levelFromTotalXp } from "@/lib/xp-level";
import { nextStreakAfterActivity } from "@/lib/streak";

export async function GET() {
  try {
    const progress = await getProgress();
    return NextResponse.json({ progress });
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { error: "Could not load progress" },
      { status: 500 }
    );
  }
}

/** Apply XP after an activity (e.g. quiz). Requires an existing progress row in Notion. */
export async function PATCH(request: Request) {
  try {
    const body = await request.json();
    const xpEarned = Number(body.xpEarned) || 0;
    const progress = await getProgress();
    if (!progress?.pageId) {
      return NextResponse.json(
        { error: "No progress page in Notion" },
        { status: 400 }
      );
    }
    const xp = (progress.xp ?? 0) + xpEarned;
    const level = levelFromTotalXp(xp);
    const streak = nextStreakAfterActivity(
      progress.streak ?? 0,
      progress.last_active
    );
    await updateProgress(progress.pageId, { level, xp, streak });
    return NextResponse.json({ level, xp, streak });
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { error: "Could not update progress" },
      { status: 500 }
    );
  }
}
