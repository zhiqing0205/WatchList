import { NextResponse } from "next/server";
import { getPersonCredits } from "@/lib/tmdb";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    const data = await getPersonCredits(Number(id));
    return NextResponse.json(data);
  } catch (error) {
    console.error("TMDB person credits error:", error);
    return NextResponse.json(
      { error: "Failed to fetch person credits" },
      { status: 500 }
    );
  }
}
