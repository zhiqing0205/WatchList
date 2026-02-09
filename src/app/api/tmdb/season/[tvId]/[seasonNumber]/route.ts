import { NextResponse } from "next/server";
import { getSeasonDetails } from "@/lib/tmdb";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ tvId: string; seasonNumber: string }> }
) {
  const { tvId, seasonNumber } = await params;

  try {
    const data = await getSeasonDetails(Number(tvId), Number(seasonNumber));
    return NextResponse.json(data);
  } catch (error) {
    console.error("TMDB season error:", error);
    return NextResponse.json({ error: "Failed to fetch season details" }, { status: 500 });
  }
}
