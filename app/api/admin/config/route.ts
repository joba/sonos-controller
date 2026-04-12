import { NextRequest, NextResponse } from "next/server";
import { readConfig, writeConfig } from "@/lib/config";

export async function GET() {
  return NextResponse.json(readConfig());
}

export async function PUT(request: NextRequest) {
  const { sonosDeviceIp, sonosDeviceName } = await request.json();
  const config = readConfig();
  writeConfig({ ...config, sonosDeviceIp, sonosDeviceName });
  return NextResponse.json({ ok: true });
}
