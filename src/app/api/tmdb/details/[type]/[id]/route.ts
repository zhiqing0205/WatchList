import { NextResponse } from "next/server";
import { getMediaDetails } from "@/lib/tmdb";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ type: string; id: string }> }
) {
  const { type, id } = await params;
  if (type !== "movie" && type !== "tv") {
    return NextResponse.json({ error: "Invalid type" }, { status: 400 });
  }

  try {
    const data = await getMediaDetails(type as "movie" | "tv", Number(id));
    return NextResponse.json(data);
  } catch (error) {
    console.error("TMDB details error:", error);
    return NextResponse.json({ error: "Failed to fetch details" }, { status: 500 });
  }
}
