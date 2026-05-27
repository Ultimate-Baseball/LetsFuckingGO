/**
 * POST /api/auth/signup
 * Creates a new user account (role: free, status: active).
 * Sets the same session cookies as login so the user is immediately signed in.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createUser, sanitizeUser } from '@/lib/user-store';

export const runtime = 'nodejs';

const AUTH_COOKIE = 'ubt_auth_role';
const COOKIE_MAX  = 60 * 60 * 8; // 8 hours

function setCookies(res: NextResponse, role: string, userId: string) {
  const opts = {
    httpOnly: true,
    secure:   process.env.NODE_ENV === 'production',
    sameSite: 'strict' as const,
    maxAge:   COOKIE_MAX,
    path:     '/',
  };
  res.cookies.set(AUTH_COOKIE,        role,   opts);
  res.cookies.set('ubt_auth_user_id', userId, opts);
  res.cookies.set('ubt_auth_public',  role,   { ...opts, httpOnly: false });
}

export async function POST(req: NextRequest) {
  const headers = { 'Cache-Control': 'no-store' };

  let body: { email?: unknown; name?: unknown; password?: unknown; confirmPassword?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400, headers });
  }

  const email           = (typeof body.email    === 'string' ? body.email.trim()    : '').toLowerCase();
  const name            = typeof body.name      === 'string' ? body.name.trim()     : '';
  const password        = typeof body.password  === 'string' ? body.password        : '';
  const confirmPassword = typeof body.confirmPassword === 'string' ? body.confirmPassword : '';

  // ── Validation ────────────────────────────────────────────────────────────
  if (!email || !name || !password) {
    return NextResponse.json({ error: 'Name, email, and password are required.' }, { status: 400, headers });
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: 'Please enter a valid email address.' }, { status: 400, headers });
  }
  if (name.length < 2 || name.length > 80) {
    return NextResponse.json({ error: 'Name must be between 2 and 80 characters.' }, { status: 400, headers });
  }
  if (password.length < 8) {
    return NextResponse.json({ error: 'Password must be at least 8 characters.' }, { status: 400, headers });
  }
  if (confirmPassword && password !== confirmPassword) {
    return NextResponse.json({ error: 'Passwords do not match.' }, { status: 400, headers });
  }

  try {
    const user = await createUser({ email, name, password });
    const safe = sanitizeUser(user);

    const res = NextResponse.json({ success: true, role: user.role, user: safe }, { headers });
    setCookies(res, user.role, user.id);
    return res;

  } catch (err: any) {
    const msg = err?.message ?? 'Failed to create account.';
    // Duplicate email
    if (msg.includes('already exists')) {
      return NextResponse.json({ error: msg }, { status: 409, headers });
    }
    console.error('[signup]', err);
    return NextResponse.json({ error: 'Account creation failed. Please try again.' }, { status: 500, headers });
  }
}
