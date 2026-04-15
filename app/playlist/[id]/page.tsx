"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Image from "next/image";

type Track = {
  item: {
    id: string;
    name: string;
    uri: string;
    duration_ms: number;
    artists: { name: string }[];
    album: { name: string; images: { url: string }[] };
  };
};

function formatMs(ms: number) {
  const s = Math.floor(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

function clampVolume(value: number, max: number) {
  return Math.max(0, Math.min(max, Math.round(value)));
}

export default function PlaylistPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [tracks, setTracks] = useState<Track[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [playingUri, setPlayingUri] = useState<string | null>(null);
  const [paused, setPaused] = useState(false);
  const [maxVolume, setMaxVolume] = useState(50);
  const [volume, setVolume] = useState(50);

  useEffect(() => {
    Promise.all([
      fetch(`/api/spotify/playlist/${id}`).then(async (r) => {
        const data = await r.json();
        if (!r.ok) throw new Error(data?.error ?? r.statusText);
        return data as Track[];
      }),
      fetch("/api/admin/config")
        .then(async (r) => {
          if (!r.ok) return null;
          return (await r.json()) as { maxVolume?: number };
        })
        .catch(() => null),
    ])
      .then(([playlistData, config]) => {
        setTracks(playlistData.filter((t) => t.item?.uri));
        const configuredMax =
          typeof config?.maxVolume === "number"
            ? clampVolume(config.maxVolume, 100)
            : 50;
        setMaxVolume(configuredMax);
        setVolume((prev) => clampVolume(prev, configuredMax));
        setLoading(false);
      })
      .catch((err) => {
        setError(String(err));
        setLoading(false);
      });
  }, [id]);

  async function playTrack(uri: string) {
    setPlayingUri(uri);
    setPaused(false);
    await fetch("/api/playback/play", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ uri }),
    });
  }

  async function togglePause() {
    if (paused) {
      await fetch("/api/playback/resume", { method: "POST" });
      setPaused(false);
    } else {
      await fetch("/api/playback/pause", { method: "POST" });
      setPaused(true);
    }
  }

  async function handleVolume(v: number) {
    const boundedVolume = clampVolume(v, maxVolume);
    setVolume(boundedVolume);
    await fetch("/api/playback/volume", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ volume: boundedVolume }),
    });
  }

  if (loading) {
    return (
      <main className="flex items-center justify-center min-h-screen">
        <p className="text-gray-400">Loading…</p>
      </main>
    );
  }

  if (error) {
    return (
      <main className="flex flex-col items-center justify-center min-h-screen gap-4 p-8 text-center">
        <p className="text-red-400 text-sm">{error}</p>
        <button
          onClick={() => router.push("/")}
          className="text-gray-400 hover:text-white text-sm"
        >
          ← Back
        </button>
      </main>
    );
  }

  const currentTrack = tracks.find((t) => t.item.uri === playingUri)?.item;

  return (
    <main className="max-w-6xl mx-auto p-4 pb-36">
      <button
        onClick={() => router.push("/")}
        className="text-gray-400 hover:text-white mb-6 block"
      >
        ← Back
      </button>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-4 gap-4">
        {tracks.map(({ item }) => (
          <button
            key={item.id}
            onClick={() => playTrack(item.uri)}
            className={`relative w-full overflow-hidden rounded-2xl text-left transition-all group ${
              playingUri === item.uri
                ? "ring-2 ring-green-500 ring-offset-2 ring-offset-black"
                : "hover:scale-[1.02]"
            }`}
          >
            <div className="relative w-full aspect-square bg-gray-800">
              {item.album.images[0] ? (
                <Image
                  src={item.album.images[0].url}
                  alt={item.album.name}
                  fill
                  className="object-cover"
                  sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, (max-width: 1280px) 33vw, 25vw"
                />
              ) : (
                <div className="w-full h-full bg-gray-700 flex items-center justify-center text-4xl">
                  🎵
                </div>
              )}

              <div className="absolute inset-0 bg-linear-to-t from-black/90 via-black/35 to-transparent" />

              <div className="absolute bottom-0 left-0 right-0 p-4">
                <p className="font-semibold truncate text-sm sm:text-base text-white">
                  {item.name}
                </p>
                <p className="text-gray-200/90 text-xs sm:text-sm truncate">
                  {item.artists.map((a) => a.name).join(", ")}
                </p>
              </div>

              <div className="absolute top-3 right-3 px-2 py-1 rounded-md bg-black/60 text-xs text-gray-200">
                {formatMs(item.duration_ms)}
              </div>

              {playingUri === item.uri && !paused && (
                <div className="absolute inset-0 bg-green-600/30 flex items-center justify-center">
                  <span className="text-white text-3xl">▶</span>
                </div>
              )}
            </div>
          </button>
        ))}
      </div>

      {playingUri && (
        <div className="fixed bottom-0 left-0 right-0 bg-gray-900 border-t border-gray-800 p-4">
          <div className="max-w-xl mx-auto flex items-center gap-4">
            <button
              onClick={togglePause}
              className="w-12 h-12 rounded-full bg-green-600 hover:bg-green-500 flex items-center justify-center text-xl transition-colors shrink-0"
            >
              {paused ? "▶" : "⏸"}
            </button>
            <div className="flex-1">
              {currentTrack && (
                <p className="text-sm font-medium truncate">
                  {currentTrack.name}
                </p>
              )}
              <div className="flex items-center gap-2 mt-1">
                <span className="text-xs text-gray-400">🔈</span>
                <input
                  type="range"
                  min={0}
                  max={maxVolume}
                  value={volume}
                  onChange={(e) => handleVolume(Number(e.target.value))}
                  className="flex-1 accent-green-500"
                />
                <span className="text-xs text-gray-400">🔊</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
