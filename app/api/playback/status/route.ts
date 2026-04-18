import { NextResponse } from "next/server";
import { SonosDevice } from "@svrooij/sonos";
import { readConfig } from "@/lib/config";

function parseSonosClock(value: string | undefined): number | null {
  if (!value) return null;
  const parts = value.split(":").map((part) => Number(part));
  if (parts.some((part) => Number.isNaN(part))) return null;
  if (parts.length === 3) {
    const [h, m, s] = parts;
    return h * 3600 + m * 60 + s;
  }
  if (parts.length === 2) {
    const [m, s] = parts;
    return m * 60 + s;
  }
  return null;
}

export async function GET() {
  try {
    const config = readConfig();
    if (!config.sonosDeviceIp) {
      return NextResponse.json(
        { error: "No speaker configured" },
        { status: 400 },
      );
    }
    const device = new SonosDevice(config.sonosDeviceIp);
    const [transportInfo, positionInfo] = await Promise.all([
      device.AVTransportService.GetTransportInfo({ InstanceID: 0 }),
      device.AVTransportService.GetPositionInfo({ InstanceID: 0 }),
    ]);
    // Sonos stores Spotify URIs as x-sonos-spotify:spotify:track:XXX?...
    // Strip the prefix and query string to recover the original Spotify URI
    const sonosUri = positionInfo.TrackURI ?? "";
    const spotifyUri = sonosUri.startsWith("x-sonos-spotify:")
      ? sonosUri.replace("x-sonos-spotify:", "").split("?")[0]
      : null;
    const relTimeSec = parseSonosClock(positionInfo.RelTime);
    const durationSec = parseSonosClock(positionInfo.TrackDuration);
    return NextResponse.json({
      state: transportInfo.CurrentTransportState,
      spotifyUri,
      relTimeSec,
      durationSec,
    });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
