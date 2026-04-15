import { NextResponse } from "next/server";
import { SonosDevice } from "@svrooij/sonos";
import { readConfig } from "@/lib/config";

export async function GET() {
  try {
    const config = readConfig();
    if (!config.sonosDeviceIp) {
      return NextResponse.json({ error: "No speaker configured" }, { status: 400 });
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
    return NextResponse.json({ state: transportInfo.CurrentTransportState, spotifyUri });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
