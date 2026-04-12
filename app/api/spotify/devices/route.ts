import { NextResponse } from "next/server";
import { getDevices } from "@/lib/spotify";

export async function GET() {
  try {
    const devices = await getDevices();
    return NextResponse.json(devices);
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
