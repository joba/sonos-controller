import { readTokens, writeTokens } from "./config";

const CLIENT_ID = process.env.SPOTIFY_CLIENT_ID!;
const CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET!;

export async function getAccessToken(): Promise<string> {
  const tokens = readTokens();
  if (!tokens) throw new Error("Not authenticated with Spotify");

  // Refresh if expired (with 60s buffer)
  if (Date.now() > tokens.expiresAt - 60_000) {
    const refreshed = await refreshAccessToken(tokens.refreshToken);
    return refreshed;
  }

  return tokens.accessToken;
}

async function refreshAccessToken(refreshToken: string): Promise<string> {
  const res = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization:
        "Basic " +
        Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString("base64"),
    },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    }),
  });

  if (!res.ok) throw new Error("Failed to refresh Spotify token");

  const data = await res.json();
  writeTokens({
    accessToken: data.access_token,
    refreshToken: data.refresh_token ?? refreshToken,
    expiresAt: Date.now() + data.expires_in * 1000,
  });

  return data.access_token;
}

async function spotifyFetch(path: string, options: RequestInit = {}) {
  const token = await getAccessToken();
  const res = await fetch(`https://api.spotify.com/v1${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(options.headers ?? {}),
    },
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Spotify API error ${res.status}: ${text}`);
  }

  if (res.status === 204) return null;
  return res.json();
}

export async function getDevices() {
  const data = await spotifyFetch("/me/player/devices");
  return data?.devices ?? [];
}

export async function getMyPlaylists() {
  const items: unknown[] = [];
  let url = "/me/playlists?limit=50";

  while (url) {
    const data = await spotifyFetch(url);
    items.push(...data.items);
    // next is a full URL, strip the base
    url = data.next
      ? data.next.replace("https://api.spotify.com/v1", "")
      : null;
  }

  return items;
}

export async function getPlaylistTracks(playlistId: string) {
  // Use /playlists/{id} instead of /playlists/{id}/tracks — the tracks
  // sub-endpoint returns 403 in Spotify's current API for dev-mode apps,
  // while the playlist endpoint itself returns the first 100 tracks fine.
  const data = await spotifyFetch(`/playlists/${playlistId}`);
  // data.items may be a paging object {items:[...], total, next, ...} rather than a plain array;
  // data.tracks is the standard paging object location.
  const raw = data.items ?? data.tracks;
  return Array.isArray(raw) ? raw : (raw?.items ?? []);
}

export async function play(deviceId: string, uris: string[], offsetUri?: string) {
  const body: Record<string, unknown> = { uris };
  if (offsetUri) {
    body.offset = { uri: offsetUri };
  }
  await spotifyFetch(`/me/player/play?device_id=${deviceId}`, {
    method: "PUT",
    body: JSON.stringify(body),
  });
}

export async function pause(deviceId: string) {
  await spotifyFetch(`/me/player/pause?device_id=${deviceId}`, {
    method: "PUT",
  });
}

export async function setVolume(deviceId: string, volumePercent: number) {
  await spotifyFetch(
    `/me/player/volume?volume_percent=${volumePercent}&device_id=${deviceId}`,
    { method: "PUT" }
  );
}
