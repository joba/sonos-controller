import { NextResponse } from "next/server";
import { discoverSonosDevices } from "@/lib/sonos";

export async function GET() {
  try {
    const devices = await discoverSonosDevices();
    return NextResponse.json(devices);
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

// Discovery takes ~5s — allow enough time
export const maxDuration = 30;
