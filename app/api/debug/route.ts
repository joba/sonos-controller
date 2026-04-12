import { NextRequest, NextResponse } from "next/server";
import { getAccessToken } from "@/lib/spotify";
import { readConfig } from "@/lib/config";

export async function GET(request: NextRequest) {
  const playlistId = request.nextUrl.searchParams.get("playlist");
  const token = await getAccessToken();
  const config = readConfig();

  const results: Record<string, unknown> = {
    savedPlaylists: config.playlists,
  };

  if (playlistId) {
    const plRes = await fetch(`https://api.spotify.com/v1/playlists/${playlistId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const plBody = await plRes.json();
    const itemsField = plBody.items;
    const innerItems = Array.isArray(itemsField) ? itemsField : itemsField?.items;
    const firstItem = innerItems?.[0];
    results.playlistTest = {
      status: plRes.status,
      topLevelKeys: Object.keys(plBody),
      itemsType: Array.isArray(itemsField) ? "array" : typeof itemsField,
      itemsKeys: itemsField && !Array.isArray(itemsField) ? Object.keys(itemsField) : null,
      itemsLength: innerItems?.length,
      firstItemKeys: firstItem ? Object.keys(firstItem) : null,
      firstItemHasTrackWrapper: firstItem ? "track" in firstItem : null,
      firstItemTrackUri: firstItem?.track?.uri ?? firstItem?.uri ?? null,
      firstItem,
    };
  }

  return NextResponse.json(results);
}
