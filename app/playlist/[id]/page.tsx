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

export default function PlaylistPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [tracks, setTracks] = useState<Track[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [playingUri, setPlayingUri] = useState<string | null>(null);
  const [paused, setPaused] = useState(false);
  const [volume, setVolume] = useState(50);

  useEffect(() => {
    fetch(`/api/spotify/playlist/${id}`)
      .then(async (r) => {
        const data = await r.json();
        if (!r.ok) throw new Error(data?.error ?? r.statusText);
        return data;
      })
      .then((data: Track[]) => {
        setTracks(data.filter((t) => t.item?.uri));
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
    setVolume(v);
    await fetch("/api/playback/volume", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ volume: v }),
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
        <button onClick={() => router.push("/")} className="text-gray-400 hover:text-white text-sm">← Back</button>
      </main>
    );
  }

  const currentTrack = tracks.find((t) => t.item.uri === playingUri)?.item;

  return (
    <main className="max-w-xl mx-auto p-4 pb-36">
      <button
        onClick={() => router.push("/")}
        className="text-gray-400 hover:text-white mb-6 block"
      >
        ← Back
      </button>

      <div className="space-y-1">
        {tracks.map(({ item }) => (
          <button
            key={item.id}
            onClick={() => playTrack(item.uri)}
            className={`w-full flex items-center gap-3 px-3 py-3 rounded-xl transition-colors text-left ${
              playingUri === item.uri
                ? "bg-green-600/20 border border-green-600/50"
                : "bg-gray-800/60 hover:bg-gray-700"
            }`}
          >
            <div className="relative w-12 h-12 rounded-lg overflow-hidden shrink-0">
              {item.album.images[0] ? (
                <Image
                  src={item.album.images[0].url}
                  alt={item.album.name}
                  fill
                  className="object-cover"
                  sizes="48px"
                />
              ) : (
                <div className="w-full h-full bg-gray-700 flex items-center justify-center text-xl">
                  🎵
                </div>
              )}
              {playingUri === item.uri && !paused && (
                <div className="absolute inset-0 bg-green-600/40 flex items-center justify-center">
                  <span className="text-white text-lg">▶</span>
                </div>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-medium truncate text-sm">{item.name}</p>
              <p className="text-gray-400 text-xs truncate">
                {item.artists.map((a) => a.name).join(", ")}
              </p>
            </div>
            <span className="text-gray-500 text-xs shrink-0">
              {formatMs(item.duration_ms)}
            </span>
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
                  max={100}
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
