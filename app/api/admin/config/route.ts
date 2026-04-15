import { NextRequest, NextResponse } from "next/server";
import { readConfig, writeConfig } from "@/lib/config";

const MIN_VOLUME = 0;
const MAX_VOLUME = 100;

export async function GET() {
  return NextResponse.json(readConfig());
}

export async function PUT(request: NextRequest) {
  const { sonosDeviceIp, sonosDeviceName, maxVolume } = await request.json();
  const config = readConfig();
  const normalizedMaxVolume = Math.max(
    MIN_VOLUME,
    Math.min(MAX_VOLUME, Math.round(Number(maxVolume ?? config.maxVolume))),
  );
  writeConfig({
    ...config,
    sonosDeviceIp,
    sonosDeviceName,
    maxVolume: normalizedMaxVolume,
  });
  return NextResponse.json({ ok: true });
}
