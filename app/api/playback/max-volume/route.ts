import { NextResponse } from "next/server";
import { readConfig } from "@/lib/config";

// Public, read-only: the kids' view needs this to cap the volume slider but
// isn't authenticated as admin. Deliberately exposes nothing else from the
// admin config (device IP/name, playlists) — those stay behind the admin
// session gate.
export async function GET() {
  const config = readConfig();
  return NextResponse.json({ maxVolume: config.maxVolume });
}
