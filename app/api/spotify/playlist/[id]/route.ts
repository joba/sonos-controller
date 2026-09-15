import { NextRequest, NextResponse } from "next/server";
import { getPlaylistTracks } from "@/lib/spotify";
import { readConfig } from "@/lib/config";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Only serve playlists an admin has curated — this endpoint is the
    // kids' browsing view, not a general Spotify lookup.
    const config = readConfig();
    if (!config.playlists.some((p) => p.id === id)) {
      return NextResponse.json({ error: "Playlist not found" }, { status: 404 });
    }

    const tracks = await getPlaylistTracks(id);
    return NextResponse.json(tracks);
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
