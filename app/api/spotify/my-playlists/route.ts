import { NextResponse } from "next/server";
import { getMyPlaylists } from "@/lib/spotify";

export async function GET() {
  try {
    const playlists = await getMyPlaylists();
    return NextResponse.json(playlists);
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
