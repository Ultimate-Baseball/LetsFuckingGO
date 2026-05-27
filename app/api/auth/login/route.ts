/**
 * POST /api/auth/login
 * Three-tier auth:
 *   1. Admin — env-var username + password (unchanged)
 *   2. Legacy SUBSCRIBER_ACCOUNTS env var (backward compat)
 *   3. Blob-stored user accounts (email + password)
 */

import { NextRequest, NextResponse } from 'next/server';
import { findUserByEmail, verifyPassword, updateUser } from '@/lib/user-store';

export const runtime = 'nodejs';

const ADMIN_USERNAME     = process.env.ADMIN_USERNAME     || 'LetsFuckingGO';
const ADMIN_PASSWORD     = process.env.ADMIN_PASSWORD     || 'Whatwedotoday';
const SUBSCRIBER_PASSWORD = process.env.SUBSCRIBER_PASSWORD || 'UBT-Subscriber-2025';

const AUTH_COOKIE = 'ubt_auth_role';
const COOKIE_MAX  = 60 * 60 * 8; // 8 hours

function getSubscriberAccounts(): Record<string, string> {
  const raw = process.env.SUBSCRIBER_ACCOUNTS || '';
  if (!raw) return {};
  const accounts: Record<string, string> = {};
  for (const pair of raw.split(',')) {
    const [u, p] = pair.split(':');
    if (u && p) accounts[u.trim()] = p.trim();
  }
  return accounts;
}

function sanitize(s: string): string {
  return s.replace(/[\x00-\x1f\x7f]/g, '').slice(0, 128);
}

function setCookies(res: NextResponse, role: string, userId?: string) {
  const opts = {
    httpOnly: true,
    secure:   process.env.NODE_ENV === 'production',
    sameSite: 'strict' as const,
    maxAge:   COOKIE_MAX,
    path:     '/',
  };
  res.cookies.set(AUTH_COOKIE,       role, opts);
  res.cookies.set('ubt_auth_public', role, { ...opts, httpOnly: false });
  if (userId) {
    res.cookies.set('ubt_auth_user_id', userId, opts);
  }
}

export async function POST(req: NextRequest) {
  const headers = {
    'Cache-Control':          'no-store',
    'X-Content-Type-Options': 'nosniff',
  };

  let body: { username?: unknown; password?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400, headers });
  }

  if (typeof body.username !== 'string' || typeof body.password !== 'string') {
    return NextResponse.json({ error: 'Username/email and password are required.' }, { status: 400, headers });
  }

  const rawInput = sanitize(body.username);  // email or legacy username
  const password = sanitize(body.password);

  if (!rawInput || !password) {
    return NextResponse.json({ error: 'Username/email and password are required.' }, { status: 400, headers });
  }

  // ── 1. Admin check ────────────────────────────────────────────────────────
  if (rawInput === ADMIN_USERNAME && password === ADMIN_PASSWORD) {
    const res = NextResponse.json({ success: true, role: 'admin' }, { headers });
    setCookies(res, 'admin');
    return res;
  }

  // ── 2. Legacy SUBSCRIBER_ACCOUNTS env var ─────────────────────────────────
  const accounts = getSubscriberAccounts();
  const isLegacySubscriber =
    (Object.keys(accounts).length > 0 && accounts[rawInput] === password) ||
    (Object.keys(accounts).length === 0 && password === SUBSCRIBER_PASSWORD && rawInput !== ADMIN_USERNAME);

  if (isLegacySubscriber) {
    const res = NextResponse.json({ success: true, role: 'subscriber' }, { headers });
    setCookies(res, 'subscriber');
    return res;
  }

  // ── 3. Blob-stored user accounts (email login) ────────────────────────────
  if (rawInput.includes('@')) {
    try {
      const user = await findUserByEmail(rawInput);
      if (user && verifyPassword(password, user.passwordHash)) {
        if (user.status === 'suspended') {
          return NextResponse.json(
            { error: 'Your account has been suspended. Please contact support.' },
            { status: 403, headers }
          );
        }

        // Map user role to cookie role
        const cookieRole = user.role === 'subscriber' ? 'subscriber' : 'free';

        // Update last login in background (don't await to keep login fast)
        updateUser(user.id, {
          lastLogin:  new Date().toISOString(),
          loginCount: (user.loginCount ?? 0) + 1,
        }).catch(() => {});

        const res = NextResponse.json({ success: true, role: cookieRole }, { headers });
        setCookies(res, cookieRole, user.id);
        return res;
      }
    } catch {
      // Blob read failure — fall through to generic error
    }
  }

  // ── Failed ────────────────────────────────────────────────────────────────
  return NextResponse.json(
    { error: 'Invalid username or password.' },
    { status: 401, headers }
  );
}
