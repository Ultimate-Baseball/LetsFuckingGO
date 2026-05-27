/**
 * GET /api/change-log
 * ADMIN ONLY — returns the full upload change history (newest first).
 */

import { NextRequest, NextResponse } from "next/server";
import { readChangeLog } from "@/lib/blob-store";

export const runtime = "nodejs";

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
    const log = await readChangeLog();
    return NextResponse.json({ success: true, log });
  } catch {
    return NextResponse.json({ success: true, log: [] });
  }
}
