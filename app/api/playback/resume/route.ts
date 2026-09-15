import { NextRequest, NextResponse } from "next/server";
import { resumeSonos } from "@/lib/sonos";
import { readConfig } from "@/lib/config";

export async function POST(request: NextRequest) {
  try {
    const config = readConfig();
    if (!config.sonosDeviceIp) {
      return NextResponse.json({ error: "No speaker configured" }, { status: 400 });
    }
    const body = await request.json().catch(() => ({}));
    const resumeAtSec =
      typeof body?.resumeAtSec === "number" && Number.isFinite(body.resumeAtSec)
        ? body.resumeAtSec
        : undefined;
    await resumeSonos(config.sonosDeviceIp, resumeAtSec);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
