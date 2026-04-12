import { NextRequest, NextResponse } from "next/server";
import { playSonosTrack } from "@/lib/sonos";
import { readConfig } from "@/lib/config";

export async function POST(request: NextRequest) {
  try {
    const config = readConfig();
    if (!config.sonosDeviceIp) {
      return NextResponse.json({ error: "No speaker configured" }, { status: 400 });
    }
    const { uri } = await request.json();
    await playSonosTrack(config.sonosDeviceIp, uri);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
