import { NextRequest, NextResponse } from "next/server";

// ── Credentials (move to env vars in production) ─────────────────────────────
const ADMIN_USERNAME = process.env.ADMIN_USERNAME || "LetsFuckingGO";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "Whatwedotoday";

// Subscriber accounts: comma-separated "user:pass" pairs in env, e.g.
// SUBSCRIBER_ACCOUNTS=john:pass1,jane:pass2
// Falls back to a single shared subscriber password if no accounts defined.
const SUBSCRIBER_PASSWORD = process.env.SUBSCRIBER_PASSWORD || "UBT-Subscriber-2025";

const AUTH_COOKIE   = "ubt_auth_role";   // "admin" | "subscriber"
const COOKIE_MAX    = 60 * 60 * 8;       // 8 hours

function getSubscriberAccounts(): Record<string, string> {
  const raw = process.env.SUBSCRIBER_ACCOUNTS || "";
  if (!raw) return {};
  const accounts: Record<string, string> = {};
  for (const pair of raw.split(",")) {
    const [u, p] = pair.split(":");
    if (u && p) accounts[u.trim()] = p.trim();
  }
  return accounts;
}

function sanitize(s: string): string {
  // Strip null bytes and control chars; limit length
  return s.replace(/[\x00-\x1f\x7f]/g, "").slice(0, 128);
}

export async function POST(req: NextRequest) {
  // Prevent caching of auth responses
  const headers = {
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
  };

  let body: { username?: unknown; password?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400, headers });
  }

  if (typeof body.username !== "string" || typeof body.password !== "string") {
    return NextResponse.json({ error: "Username and password are required." }, { status: 400, headers });
  }

  const username = sanitize(body.username);
  const password = sanitize(body.password);

  if (!username || !password) {
    return NextResponse.json({ error: "Username and password are required." }, { status: 400, headers });
  }

  // ── Admin check ──────────────────────────────────────────────────────────────
  if (username === ADMIN_USERNAME && password === ADMIN_PASSWORD) {
    const res = NextResponse.json({ success: true, role: "admin" }, { headers });
    res.cookies.set(AUTH_COOKIE, "admin", {
      httpOnly: true,
      secure:   process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge:   COOKIE_MAX,
      path:     "/",
    });
    // Non-httpOnly companion cookie so client JS can read role for UI purposes
    res.cookies.set("ubt_auth_public", "admin", {
      httpOnly: false,
      secure:   process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge:   COOKIE_MAX,
      path:     "/",
    });
    return res;
  }

  // ── Subscriber check ─────────────────────────────────────────────────────────
  const accounts = getSubscriberAccounts();
  const isSubscriber =
    (Object.keys(accounts).length > 0 && accounts[username] === password) ||
    (Object.keys(accounts).length === 0 && password === SUBSCRIBER_PASSWORD);

  if (isSubscriber) {
    const res = NextResponse.json({ success: true, role: "subscriber" }, { headers });
    res.cookies.set(AUTH_COOKIE, "subscriber", {
      httpOnly: true,
      secure:   process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge:   COOKIE_MAX,
      path:     "/",
    });
    res.cookies.set("ubt_auth_public", "subscriber", {
      httpOnly: false,
      secure:   process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge:   COOKIE_MAX,
      path:     "/",
    });
    return res;
  }

  // ── Failed ───────────────────────────────────────────────────────────────────
  // Generic message — never reveal whether username or password was wrong
  return NextResponse.json(
    { error: "Invalid username or password." },
    { status: 401, headers }
  );
}
