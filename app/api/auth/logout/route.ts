import { NextResponse, NextRequest } from "next/server";

const COOKIE_OPTS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "strict" as const,
  maxAge: 0,
  path: "/",
};

export async function POST(req: NextRequest) {
  const redirectTo = req.nextUrl.searchParams.get("redirect") || "/login";
  const res = NextResponse.json({ success: true });

  // Clear all auth cookies
  res.cookies.set("ubt_auth_role",   "", COOKIE_OPTS);
  res.cookies.set("ubt_admin_auth",  "", COOKIE_OPTS);  // legacy
  res.cookies.set("ubt_auth_public", "", { ...COOKIE_OPTS, httpOnly: false });
  return res;
}

export async function GET() {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3001";
  const res = NextResponse.redirect(new URL("/login", appUrl));
  res.cookies.set("ubt_auth_role",   "", COOKIE_OPTS);
  res.cookies.set("ubt_admin_auth",  "", COOKIE_OPTS);
  res.cookies.set("ubt_auth_public", "", { ...COOKIE_OPTS, httpOnly: false });
  return res;
}
