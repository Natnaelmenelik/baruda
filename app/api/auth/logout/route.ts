import { NextResponse } from "next/server";

const COOKIE_NAMES = [
  "token",
  "auth_token",
  "access_token",
  "refresh_token",
  "session",
  "auth-session",
  "supabase.auth.token",
];

function clearCookie(res: NextResponse, name: string) {
  res.cookies.set(name, "", {
    path: "/",
    maxAge: 0,
    expires: new Date(0),
    sameSite: "lax",
  });
}

export async function POST() {
  const res = NextResponse.json({ ok: true });

  for (const name of COOKIE_NAMES) {
    clearCookie(res, name);
  }

  return res;
}

export async function GET() {
  const res = NextResponse.redirect(new URL("/login", "http://localhost:3000"));

  for (const name of COOKIE_NAMES) {
    clearCookie(res, name);
  }

  return res;
}
