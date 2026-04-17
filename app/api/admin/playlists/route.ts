import { NextRequest, NextResponse } from "next/server";
import { readConfig, writeConfig, SavedPlaylist } from "@/lib/config";
import { getAccessToken } from "@/lib/spotify";

type PlaylistCreateBody =
  | SavedPlaylist
  | {
      playlistIdOrUrl?: string;
    };

function extractSpotifyPlaylistId(value: string): string | null {
  const input = value.trim();
  if (!input) return null;

  // Accept plain Spotify playlist IDs.
  if (/^[A-Za-z0-9]{22}$/.test(input)) {
    return input;
  }

  // Accept Spotify URLs like https://open.spotify.com/playlist/{id}?si=...
  const match = input.match(/spotify\.com\/playlist\/([A-Za-z0-9]{22})/i);
  return match?.[1] ?? null;
}

async function resolvePlaylistFromSpotify(
  playlistIdOrUrl: string,
): Promise<SavedPlaylist> {
  const id = extractSpotifyPlaylistId(playlistIdOrUrl);
  if (!id) {
    throw new Error("Enter a valid Spotify playlist URL or ID.");
  }

  const token = await getAccessToken();
  const res = await fetch(`https://api.spotify.com/v1/playlists/${id}`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) {
    if (res.status === 404) {
      throw new Error("Playlist not found.");
    }
    if (res.status === 403) {
      throw new Error("Playlist exists but is not accessible to this account.");
    }
    throw new Error(`Spotify API error ${res.status}`);
  }

  const data = await res.json();
  return {
    id: data.id,
    name: data.name,
    imageUrl: data.images?.[0]?.url ?? "",
  };
}

export async function GET() {
  const config = readConfig();
  return NextResponse.json(config.playlists);
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as PlaylistCreateBody;
    const playlist =
      "playlistIdOrUrl" in body
        ? await resolvePlaylistFromSpotify(body.playlistIdOrUrl ?? "")
        : body;

    if (!playlist?.id || !playlist?.name) {
      return NextResponse.json(
        { error: "Invalid playlist payload." },
        { status: 400 },
      );
    }

    const config = readConfig();
    if (!config.playlists.find((p) => p.id === playlist.id)) {
      config.playlists.push(playlist);
      writeConfig(config);
    }

    return NextResponse.json({ ok: true, playlist });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 400 },
    );
  }
}
