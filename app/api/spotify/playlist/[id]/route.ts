import { NextRequest, NextResponse } from "next/server";
import { getPlaylistTracks } from "@/lib/spotify";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const tracks = await getPlaylistTracks(id);
    return NextResponse.json(tracks);
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
