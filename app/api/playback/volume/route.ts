import { NextRequest, NextResponse } from "next/server";
import { setSonosVolume } from "@/lib/sonos";
import { readConfig } from "@/lib/config";

const MIN_VOLUME = 0;
const MAX_VOLUME = 100;

export async function POST(request: NextRequest) {
  try {
    const config = readConfig();
    if (!config.sonosDeviceIp) {
      return NextResponse.json(
        { error: "No speaker configured" },
        { status: 400 },
      );
    }

    const { volume } = await request.json();
    const requestedVolume = Math.round(Number(volume));
    if (!Number.isFinite(requestedVolume)) {
      return NextResponse.json({ error: "Invalid volume" }, { status: 400 });
    }

    const maxVolume = Math.max(
      MIN_VOLUME,
      Math.min(MAX_VOLUME, Math.round(Number(config.maxVolume))),
    );
    const boundedVolume = Math.max(
      MIN_VOLUME,
      Math.min(maxVolume, requestedVolume),
    );

    await setSonosVolume(config.sonosDeviceIp, boundedVolume);
    return NextResponse.json({
      ok: true,
      appliedVolume: boundedVolume,
      maxVolume,
    });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
