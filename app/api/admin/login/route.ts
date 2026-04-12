import { NextRequest, NextResponse } from "next/server";
import { checkPassword, SESSION_COOKIE, SESSION_TOKEN } from "@/lib/auth";

export async function POST(request: NextRequest) {
  const { password } = await request.json();

  if (!checkPassword(password)) {
    return NextResponse.json({ error: "Invalid password" }, { status: 401 });
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set(SESSION_COOKIE, SESSION_TOKEN, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30, // 30 days
  });
  return response;
}
