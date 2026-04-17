"use client";

import { useState, useEffect } from "react";
import Image from "next/image";

type SonosDevice = { name: string; ip: string };
type SpotifyPlaylist = { id: string; name: string; images: { url: string }[] };
type SavedPlaylist = { id: string; name: string; imageUrl: string };

export default function AdminPage() {
  const [sonosDevices, setSonosDevices] = useState<SonosDevice[]>([]);
  const [selectedIp, setSelectedIp] = useState<string>("");
  const [selectedName, setSelectedName] = useState<string>("");
  const [maxVolume, setMaxVolume] = useState<number>(50);
  const [savedPlaylists, setSavedPlaylists] = useState<SavedPlaylist[]>([]);
  const [myPlaylists, setMyPlaylists] = useState<SpotifyPlaylist[]>([]);
  const [loadingMyPlaylists, setLoadingMyPlaylists] = useState(false);
  const [myPlaylistsError, setMyPlaylistsError] = useState("");
  const [manualPlaylistInput, setManualPlaylistInput] = useState("");
  const [addingManualPlaylist, setAddingManualPlaylist] = useState(false);
  const [manualPlaylistError, setManualPlaylistError] = useState("");
  const [showAddPlaylist, setShowAddPlaylist] = useState(false);
  const [spotifyLinked, setSpotifyLinked] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [scanError, setScanError] = useState("");
  const [status, setStatus] = useState("");

  useEffect(() => {
    loadConfig();
  }, []);

  async function loadConfig() {
    const [configRes, playlistsRes] = await Promise.all([
      fetch("/api/admin/config"),
      fetch("/api/admin/playlists"),
    ]);
    const config = await configRes.json();
    const playlists = await playlistsRes.json();
    setSelectedIp(config.sonosDeviceIp ?? "");
    setSelectedName(config.sonosDeviceName ?? "");
    setMaxVolume(typeof config.maxVolume === "number" ? config.maxVolume : 50);
    setSavedPlaylists(playlists);

    // Check Spotify is linked
    const devRes = await fetch("/api/spotify/devices");
    if (!devRes.ok) setSpotifyLinked(false);
  }

  async function scanForSpeakers() {
    setScanning(true);
    setScanError("");
    setSonosDevices([]);
    const res = await fetch("/api/sonos/devices");
    setScanning(false);
    if (res.ok) {
      const devices: SonosDevice[] = await res.json();
      setSonosDevices(devices);
      if (devices.length === 0) {
        setScanError(
          "No Sonos speakers found. Make sure you're on the same Wi-Fi network.",
        );
      }
    } else {
      const err = await res.json().catch(() => ({}));
      setScanError(`Scan failed: ${err?.error ?? res.statusText}`);
    }
  }

  async function saveDevice(device: SonosDevice) {
    setSelectedIp(device.ip);
    setSelectedName(device.name);
    await fetch("/api/admin/config", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sonosDeviceIp: device.ip,
        sonosDeviceName: device.name,
        maxVolume,
      }),
    });
    setStatus(`Speaker "${device.name}" saved!`);
    setTimeout(() => setStatus(""), 2000);
  }

  async function saveMaxVolume() {
    await fetch("/api/admin/config", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sonosDeviceIp: selectedIp || null,
        sonosDeviceName: selectedName || null,
        maxVolume,
      }),
    });
    setStatus(`Max volume set to ${maxVolume}`);
    setTimeout(() => setStatus(""), 2000);
  }

  async function loadMyPlaylists() {
    setLoadingMyPlaylists(true);
    setMyPlaylistsError("");

    const res = await fetch(`/api/spotify/my-playlists?ts=${Date.now()}`, {
      cache: "no-store",
    });

    if (res.ok) {
      setMyPlaylists(await res.json());
    } else {
      const err = await res.json().catch(() => ({}));
      setMyPlaylistsError(err?.error ?? "Could not load playlists.");
    }

    setLoadingMyPlaylists(false);
  }

  async function openAddPlaylist() {
    setShowAddPlaylist(true);
    await loadMyPlaylists();
  }

  async function addPlaylist(pl: SpotifyPlaylist) {
    const payload: SavedPlaylist = {
      id: pl.id,
      name: pl.name,
      imageUrl: pl.images[0]?.url ?? "",
    };
    await fetch("/api/admin/playlists", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    setSavedPlaylists((prev) =>
      prev.find((p) => p.id === pl.id) ? prev : [...prev, payload],
    );
    setShowAddPlaylist(false);
  }

  async function addPlaylistByUrlOrId() {
    const value = manualPlaylistInput.trim();
    if (!value) {
      setManualPlaylistError("Paste a Spotify playlist URL or ID.");
      return;
    }

    setAddingManualPlaylist(true);
    setManualPlaylistError("");

    const res = await fetch("/api/admin/playlists", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ playlistIdOrUrl: value }),
    });

    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      setManualPlaylistError(body?.error ?? "Could not add playlist.");
      setAddingManualPlaylist(false);
      return;
    }

    const playlist = body?.playlist as SavedPlaylist | undefined;
    if (playlist?.id) {
      setSavedPlaylists((prev) =>
        prev.find((p) => p.id === playlist.id) ? prev : [...prev, playlist],
      );
      setManualPlaylistInput("");
      setShowAddPlaylist(false);
    }

    setAddingManualPlaylist(false);
  }

  async function removePlaylist(id: string) {
    await fetch(`/api/admin/playlists/${id}`, { method: "DELETE" });
    setSavedPlaylists((prev) => prev.filter((p) => p.id !== id));
  }

  return (
    <main className="max-w-xl mx-auto p-6 space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Admin</h1>
        <a href="/" className="text-sm text-gray-400 hover:text-white">
          ← Kids view
        </a>
      </div>

      {status && <p className="text-green-400 text-sm">{status}</p>}

      {/* Spotify connection */}
      <section>
        <h2 className="text-lg font-semibold mb-3">Spotify</h2>
        {spotifyLinked ? (
          <p className="text-green-400 text-sm">✓ Connected</p>
        ) : (
          <a
            href="/api/auth/spotify"
            className="inline-block px-4 py-2 rounded-xl bg-green-600 hover:bg-green-500 font-semibold text-sm transition-colors"
          >
            Connect Spotify
          </a>
        )}
      </section>

      {/* Sonos speaker selection */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold">
            Speaker
            {selectedName && (
              <span className="ml-2 text-sm font-normal text-green-400">
                ({selectedName})
              </span>
            )}
          </h2>
          <button
            onClick={scanForSpeakers}
            disabled={scanning}
            className="px-3 py-1.5 rounded-xl bg-gray-700 hover:bg-gray-600 text-sm transition-colors disabled:opacity-50"
          >
            {scanning ? "Scanning…" : "Scan"}
          </button>
        </div>

        {scanning && (
          <p className="text-gray-400 text-sm">
            Scanning your network for Sonos speakers (takes ~5s)…
          </p>
        )}
        {scanError && <p className="text-yellow-400 text-sm">{scanError}</p>}

        {sonosDevices.length > 0 && (
          <div className="space-y-2">
            {sonosDevices.map((d) => (
              <button
                key={d.ip}
                onClick={() => saveDevice(d)}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border transition-colors text-left ${
                  selectedIp === d.ip
                    ? "border-green-500 bg-green-500/10"
                    : "border-gray-700 bg-gray-800 hover:bg-gray-700"
                }`}
              >
                <span className="text-xl">🔊</span>
                <div>
                  <p className="font-medium">{d.name}</p>
                  <p className="text-xs text-gray-400">{d.ip}</p>
                </div>
                {selectedIp === d.ip && (
                  <span className="ml-auto text-green-400 text-sm">
                    Selected
                  </span>
                )}
              </button>
            ))}
          </div>
        )}

        {!scanning && sonosDevices.length === 0 && !scanError && (
          <p className="text-gray-500 text-sm">
            Click Scan to find Sonos speakers on your network.
          </p>
        )}
      </section>

      <section>
        <h2 className="text-lg font-semibold mb-3">Max volume</h2>
        <div className="rounded-xl bg-gray-800 p-4 space-y-3">
          <div className="flex items-center gap-3">
            <input
              type="range"
              min={0}
              max={100}
              value={maxVolume}
              onChange={(e) => setMaxVolume(Number(e.target.value))}
              className="flex-1 accent-green-500"
            />
            <span className="w-12 text-right text-sm font-semibold">
              {maxVolume}
            </span>
          </div>
          <button
            onClick={saveMaxVolume}
            className="px-3 py-1.5 rounded-xl bg-gray-700 hover:bg-gray-600 text-sm transition-colors"
          >
            Save max volume
          </button>
          <p className="text-xs text-gray-400">
            Playback volume will never go above this value.
          </p>
        </div>
      </section>

      {/* Saved playlists */}
      {spotifyLinked && (
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold">Playlists for kids</h2>
            <button
              onClick={openAddPlaylist}
              className="px-3 py-1.5 rounded-xl bg-gray-700 hover:bg-gray-600 text-sm transition-colors"
            >
              + Add
            </button>
          </div>

          {savedPlaylists.length === 0 ? (
            <p className="text-gray-400 text-sm">No playlists added yet.</p>
          ) : (
            <div className="space-y-2">
              {savedPlaylists.map((pl) => (
                <div
                  key={pl.id}
                  className="flex items-center gap-3 px-4 py-3 rounded-xl bg-gray-800"
                >
                  <div className="relative w-10 h-10 rounded-lg overflow-hidden shrink-0">
                    {pl.imageUrl ? (
                      <Image
                        src={pl.imageUrl}
                        alt={pl.name}
                        fill
                        className="object-cover"
                        sizes="40px"
                      />
                    ) : (
                      <div className="w-full h-full bg-gray-700 flex items-center justify-center text-lg">
                        🎵
                      </div>
                    )}
                  </div>
                  <p className="flex-1 font-medium text-sm">{pl.name}</p>
                  <button
                    onClick={() => removePlaylist(pl.id)}
                    className="text-gray-500 hover:text-red-400 transition-colors text-sm px-2"
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {/* Add playlist modal */}
      {showAddPlaylist && (
        <div className="fixed inset-0 bg-black/70 flex items-end sm:items-center justify-center p-4 z-50">
          <div className="w-full max-w-md bg-gray-900 rounded-2xl p-5 max-h-[70vh] flex flex-col">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-lg">Your Playlists</h3>
              <div className="flex items-center gap-3">
                <button
                  onClick={loadMyPlaylists}
                  disabled={loadingMyPlaylists}
                  className="text-xs px-2 py-1 rounded-lg bg-gray-800 hover:bg-gray-700 disabled:opacity-50"
                >
                  {loadingMyPlaylists ? "Refreshing..." : "Refresh"}
                </button>
                <button
                  onClick={() => setShowAddPlaylist(false)}
                  className="text-gray-400 hover:text-white text-xl"
                >
                  ✕
                </button>
              </div>
            </div>
            <div className="overflow-y-auto space-y-2">
              <div className="space-y-2 rounded-xl border border-gray-800 bg-gray-950/60 p-3 mb-3">
                <p className="text-xs text-gray-300">
                  Add by Spotify URL or playlist ID
                </p>
                <div className="flex gap-2">
                  <input
                    value={manualPlaylistInput}
                    onChange={(e) => setManualPlaylistInput(e.target.value)}
                    placeholder="https://open.spotify.com/playlist/..."
                    className="flex-1 rounded-lg bg-gray-800 border border-gray-700 px-3 py-2 text-sm outline-none focus:border-green-500"
                  />
                  <button
                    onClick={addPlaylistByUrlOrId}
                    disabled={addingManualPlaylist}
                    className="px-3 py-2 rounded-lg bg-green-700 hover:bg-green-600 disabled:opacity-50 text-sm font-semibold"
                  >
                    {addingManualPlaylist ? "Adding..." : "Add"}
                  </button>
                </div>
                {manualPlaylistError && (
                  <p className="text-xs text-red-400">{manualPlaylistError}</p>
                )}
              </div>

              {loadingMyPlaylists && myPlaylists.length === 0 ? (
                <p className="text-gray-400 text-sm text-center py-8">
                  Loading…
                </p>
              ) : myPlaylistsError ? (
                <p className="text-red-400 text-sm text-center py-8">
                  {myPlaylistsError}
                </p>
              ) : myPlaylists.length === 0 ? (
                <p className="text-gray-400 text-sm text-center py-8">
                  No playlists found.
                </p>
              ) : (
                myPlaylists.map((pl) => (
                  <button
                    key={pl.id}
                    onClick={() => addPlaylist(pl)}
                    className="w-full flex items-center gap-3 px-4 py-3 rounded-xl bg-gray-800 hover:bg-gray-700 transition-colors text-left"
                  >
                    <div className="relative w-10 h-10 rounded-lg overflow-hidden shrink-0">
                      {pl.images[0] ? (
                        <Image
                          src={pl.images[0].url}
                          alt={pl.name}
                          fill
                          className="object-cover"
                          sizes="40px"
                        />
                      ) : (
                        <div className="w-full h-full bg-gray-700 flex items-center justify-center">
                          🎵
                        </div>
                      )}
                    </div>
                    <p className="font-medium text-sm">{pl.name}</p>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
