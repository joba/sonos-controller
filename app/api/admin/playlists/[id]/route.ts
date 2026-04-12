import { NextRequest, NextResponse } from "next/server";
import { readConfig, writeConfig } from "@/lib/config";

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const config = readConfig();
  config.playlists = config.playlists.filter((p) => p.id !== id);
  writeConfig(config);
  return NextResponse.json({ ok: true });
}
