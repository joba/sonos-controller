import { NextRequest, NextResponse } from "next/server";
import { setSonosVolume } from "@/lib/sonos";
import { readConfig } from "@/lib/config";

export async function POST(request: NextRequest) {
  try {
    const config = readConfig();
    if (!config.sonosDeviceIp) {
      return NextResponse.json({ error: "No speaker configured" }, { status: 400 });
    }
    const { volume } = await request.json();
    await setSonosVolume(config.sonosDeviceIp, Math.round(Number(volume)));
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
