"use client";

import { useState, useEffect, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import Image from "next/image";
import { FaPlay, FaPause } from "react-icons/fa";

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

function isNearEnd(
  relTimeSec: number | null,
  durationSec: number | null,
  fallbackDurationSec: number | null,
) {
  if (relTimeSec === null) return false;
  const effectiveDuration = durationSec ?? fallbackDurationSec;
  if (!effectiveDuration || effectiveDuration <= 0) return false;
  return relTimeSec >= Math.max(0, effectiveDuration - 3);
}

function reachedTrackEnd(
  relTimeSec: number | null,
  durationSec: number | null,
  fallbackDurationSec: number | null,
  maxObservedRelTimeSec: number,
) {
  const effectiveDuration = durationSec ?? fallbackDurationSec;
  if (!effectiveDuration || effectiveDuration <= 0) return false;
  if (isNearEnd(relTimeSec, durationSec, fallbackDurationSec)) return true;
  return maxObservedRelTimeSec >= Math.max(0, effectiveDuration - 3);
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
  const hasSeenPlaying = useRef(false);
  const consecutiveStoppedPolls = useRef(0);
  const consecutiveEarlyStoppedPolls = useRef(0);
  const isAdvancing = useRef(false);
  const isRecovering = useRef(false);
  const resumeAttempts = useRef(0);
  const maxObservedRelTimeSec = useRef(0);

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
        const filtered = playlistData.filter((t) => t.item?.uri);
        if (filtered.length === 0 && playlistData.length === 0) {
          setError(
            "Could not load songs from this playlist. This is usually because the playlist is owned by another Spotify user — Spotify's API only allows access to tracks from playlists you own. Try creating your own copy of the playlist in Spotify and adding that instead.",
          );
          setLoading(false);
          return;
        }
        setTracks(filtered);
        const configuredMax =
          typeof config?.maxVolume === "number"
            ? clampVolume(config.maxVolume, 100)
            : 50;
        setMaxVolume(configuredMax);
        setVolume((prev) => clampVolume(prev, configuredMax));
        setLoading(false);
        // Check if a track from this playlist is already playing
        fetch("/api/playback/status")
          .then(async (r) => {
            if (!r.ok) return;
            const { state, spotifyUri } = await r.json();
            if (!spotifyUri) return;
            const match = filtered.find((t) => t.item.uri === spotifyUri);
            if (match) {
              setPlayingUri(spotifyUri);
              setPaused(state === "PAUSED_PLAYBACK");
            }
          })
          .catch(() => null);
      })
      .catch((err) => {
        setError(String(err));
        setLoading(false);
      });
  }, [id]);

  useEffect(() => {
    if (!playingUri || paused) return;

    hasSeenPlaying.current = false;
    consecutiveStoppedPolls.current = 0;
    consecutiveEarlyStoppedPolls.current = 0;
    isAdvancing.current = false;
    isRecovering.current = false;
    resumeAttempts.current = 0;
    maxObservedRelTimeSec.current = 0;

    const interval = setInterval(async () => {
      try {
        const r = await fetch("/api/playback/status");
        if (!r.ok) return;
        const { state, spotifyUri, relTimeSec, durationSec } = await r.json();
        if (
          spotifyUri === playingUri &&
          typeof relTimeSec === "number" &&
          Number.isFinite(relTimeSec)
        ) {
          maxObservedRelTimeSec.current = Math.max(
            maxObservedRelTimeSec.current,
            relTimeSec,
          );
        }

        if (state === "PLAYING") {
          hasSeenPlaying.current = true;
          consecutiveStoppedPolls.current = 0;
          consecutiveEarlyStoppedPolls.current = 0;
          isRecovering.current = false;
        } else if (state === "STOPPED" && hasSeenPlaying.current) {
          // Sonos can briefly report STOPPED during transitions; require two
          // consecutive STOPPED polls for the same track before advancing.
          if (spotifyUri !== playingUri || isAdvancing.current) return;

          const currentTrack = tracks.find((t) => t.item.uri === playingUri);
          const fallbackDurationSec = currentTrack
            ? Math.floor(currentTrack.item.duration_ms / 1000)
            : null;
          if (
            !reachedTrackEnd(
              relTimeSec,
              durationSec,
              fallbackDurationSec,
              maxObservedRelTimeSec.current,
            )
          ) {
            consecutiveStoppedPolls.current = 0;

            // If playback unexpectedly stops early, try to recover with a
            // guarded resume before giving up.
            consecutiveEarlyStoppedPolls.current += 1;
            if (
              consecutiveEarlyStoppedPolls.current >= 2 &&
              !isRecovering.current &&
              resumeAttempts.current < 2 &&
              maxObservedRelTimeSec.current >= 60
            ) {
              isRecovering.current = true;
              resumeAttempts.current += 1;
              await fetch("/api/playback/resume", { method: "POST" });
            }
            return;
          }

          consecutiveStoppedPolls.current += 1;
          consecutiveEarlyStoppedPolls.current = 0;
          if (consecutiveStoppedPolls.current < 2) return;

          const currentIndex = tracks.findIndex(
            (t) => t.item.uri === playingUri,
          );
          const next = tracks[currentIndex + 1];
          if (next) {
            isAdvancing.current = true;
            maxObservedRelTimeSec.current = 0;
            playTrack(next.item.uri);
          } else {
            setPlayingUri(null);
          }
        } else {
          consecutiveStoppedPolls.current = 0;
          consecutiveEarlyStoppedPolls.current = 0;
          isRecovering.current = false;
        }
      } catch {
        // ignore polling errors
      }
    }, 2000);

    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playingUri, paused, tracks]);

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
            className={`relative cursor-pointer w-full overflow-hidden rounded-2xl text-left transition-all group ${
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
                <p className="font-semibold truncate text-sm sm:text-base text-white uppercase">
                  {item.name}
                </p>
                <p className="text-gray-200/90 text-xs sm:text-sm truncate uppercase">
                  {item.artists.map((a) => a.name).join(", ")}
                </p>
              </div>

              <div className="absolute top-3 right-3 px-2 py-1 rounded-md bg-black/60 text-xs text-gray-200">
                {formatMs(item.duration_ms)}
              </div>

              {playingUri === item.uri && (
                <div className="absolute inset-0 bg-green-600/30 flex items-center justify-center">
                  <span className="text-white text-3xl">
                    {paused ? <FaPlay /> : <FaPause />}
                  </span>
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
              {paused ? <FaPlay /> : <FaPause />}
            </button>
            <div className="flex-1">
              {currentTrack && (
                <p className="text-sm font-medium truncate text-white">
                  {currentTrack.name} -{" "}
                  {currentTrack.artists.map((a) => a.name).join(", ")}
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
