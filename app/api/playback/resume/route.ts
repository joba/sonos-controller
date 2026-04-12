import { NextResponse } from "next/server";
import { resumeSonos } from "@/lib/sonos";
import { readConfig } from "@/lib/config";

export async function POST() {
  try {
    const config = readConfig();
    if (!config.sonosDeviceIp) {
      return NextResponse.json({ error: "No speaker configured" }, { status: 400 });
    }
    await resumeSonos(config.sonosDeviceIp);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
