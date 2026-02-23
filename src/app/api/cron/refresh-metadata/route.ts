import { NextResponse } from "next/server";
import { refreshAllMetadata } from "@/app/admin/_actions/media";
import { backupToWebDAV } from "@/app/admin/_actions/backup";

export const dynamic = "force-dynamic";
export const maxDuration = 300; // 5 minutes max for free tier

export async function GET(request: Request) {
  // Verify cron secret to prevent unauthorized access
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await refreshAllMetadata();

    // Auto-backup after metadata refresh (isolated — failure won't affect cron response)
    let backup: { success: boolean; message: string } | { success: false; message: string } = {
      success: false,
      message: "skipped",
    };
    try {
      backup = await backupToWebDAV();
    } catch (e) {
      backup = {
        success: false,
        message: e instanceof Error ? e.message : String(e),
      };
    }

    return NextResponse.json({
      ok: true,
      ...result,
      backup,
      timestamp: new Date().toISOString(),
    });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : String(e) },
      { status: 500 }
    );
  }
}
