/**
 * /api/admin/users — admin-only user management
 *
 * GET    → list all users (no passwordHash)
 * PATCH  → update a user's role / status / plan / labels / notes / name
 * DELETE → remove a user by id (query param ?id=...)
 */

import { NextRequest, NextResponse } from 'next/server';
import { loadUsers, saveUsers, deleteUser, sanitizeUser, hashPassword } from '@/lib/user-store';
import type { UserRole, UserStatus, UserPlan, AppUser } from '@/lib/user-store';

export const runtime = 'nodejs';

const AUTH_COOKIE = 'ubt_auth_role';

function isAdmin(req: NextRequest): boolean {
  const role = req.cookies.get(AUTH_COOKIE)?.value;
  if (role === 'admin') return true;
  return !!req.cookies.get('ubt_admin_auth')?.value;
}

// ── GET: list all users ───────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  if (!isAdmin(req)) {
    return NextResponse.json({ error: 'Admin access required.' }, { status: 403 });
  }

  const users = await loadUsers();
  return NextResponse.json({
    success: true,
    users:   users.map(sanitizeUser),
    stats: {
      total:      users.length,
      active:     users.filter(u => u.status === 'active').length,
      pending:    users.filter(u => u.status === 'pending').length,
      suspended:  users.filter(u => u.status === 'suspended').length,
      subscriber: users.filter(u => u.role === 'subscriber').length,
      free:       users.filter(u => u.role === 'free').length,
      premium:    users.filter(u => u.plan === 'premium').length,
    },
  }, { headers: { 'Cache-Control': 'no-store' } });
}

// ── PATCH: update user fields ─────────────────────────────────────────────────

export async function PATCH(req: NextRequest) {
  if (!isAdmin(req)) {
    return NextResponse.json({ error: 'Admin access required.' }, { status: 403 });
  }

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }

  const id = typeof body.id === 'string' ? body.id : null;
  if (!id) return NextResponse.json({ error: 'User id required.' }, { status: 400 });

  const users = await loadUsers();
  const idx   = users.findIndex(u => u.id === id);
  if (idx === -1) return NextResponse.json({ error: 'User not found.' }, { status: 404 });

  const allowed: Array<keyof AppUser> = ['role', 'status', 'plan', 'labels', 'notes', 'name'];
  const updates: Partial<AppUser> = {};

  for (const key of allowed) {
    if (key in body) {
      (updates as any)[key] = body[key];
    }
  }

  // Validate enums
  const validRoles:    UserRole[]   = ['subscriber', 'free'];
  const validStatuses: UserStatus[] = ['active', 'pending', 'suspended'];
  const validPlans:    UserPlan[]   = ['free', 'basic', 'premium'];

  if (updates.role   && !validRoles.includes(updates.role))         return NextResponse.json({ error: 'Invalid role.' },   { status: 400 });
  if (updates.status && !validStatuses.includes(updates.status))    return NextResponse.json({ error: 'Invalid status.' }, { status: 400 });
  if (updates.plan   && !validPlans.includes(updates.plan))         return NextResponse.json({ error: 'Invalid plan.' },   { status: 400 });
  if (updates.labels && !Array.isArray(updates.labels))             return NextResponse.json({ error: 'Labels must be an array.' }, { status: 400 });

  // Optional password reset by admin
  if (typeof body.newPassword === 'string' && body.newPassword.length >= 8) {
    (updates as any).passwordHash = hashPassword(body.newPassword);
  }

  users[idx] = { ...users[idx], ...updates };
  await saveUsers(users);

  return NextResponse.json({ success: true, user: sanitizeUser(users[idx]) });
}

// ── DELETE: remove user ───────────────────────────────────────────────────────

export async function DELETE(req: NextRequest) {
  if (!isAdmin(req)) {
    return NextResponse.json({ error: 'Admin access required.' }, { status: 403 });
  }

  const id = req.nextUrl.searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'User id required as ?id= query param.' }, { status: 400 });

  const ok = await deleteUser(id);
  if (!ok) return NextResponse.json({ error: 'User not found.' }, { status: 404 });

  return NextResponse.json({ success: true });
}
