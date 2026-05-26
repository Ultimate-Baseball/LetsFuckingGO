/**
 * GET /api/change-log
 * ADMIN ONLY — returns the full upload change history (newest first).
 */

import { NextRequest, NextResponse } from "next/server";
import { readFile } from "fs/promises";
import path from "path";

export const runtime = "nodejs";

const LOG_PATH    = path.join(process.cwd(), "data", "change-log.json");
const AUTH_COOKIE = "ubt_auth_role";

function isAdmin(req: NextRequest): boolean {
  const role = req.cookies.get(AUTH_COOKIE)?.value;
  if (role === "admin") return true;
  return !!req.cookies.get("ubt_admin_auth")?.value;
}

export async function GET(req: NextRequest) {
  if (!isAdmin(req)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 403 });
  }

  try {
    const raw = await readFile(LOG_PATH, "utf-8");
    const log = JSON.parse(raw);
    return NextResponse.json({ success: true, log });
  } catch {
    // File doesn't exist yet — return empty log
    return NextResponse.json({ success: true, log: [] });
  }
}
