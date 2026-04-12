import { NextRequest, NextResponse } from "next/server";
import { readConfig, writeConfig, SavedPlaylist } from "@/lib/config";

export async function GET() {
  const config = readConfig();
  return NextResponse.json(config.playlists);
}

export async function POST(request: NextRequest) {
  const playlist: SavedPlaylist = await request.json();
  const config = readConfig();
  if (!config.playlists.find((p) => p.id === playlist.id)) {
    config.playlists.push(playlist);
    writeConfig(config);
  }
  return NextResponse.json({ ok: true });
}
