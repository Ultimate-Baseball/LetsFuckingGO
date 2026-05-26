// GET /api/alerts   — today's alert list (admin only)
// DELETE /api/alerts — clear today's alerts (admin only)

import { NextRequest, NextResponse } from 'next/server';
import { loadTodayAlerts } from '@/lib/mlb/monitor';
import { promises as fs } from 'fs';
import path from 'path';

export const dynamic = 'force-dynamic';

function isAdmin(req: NextRequest): boolean {
  // Reads the httpOnly role cookie set by your existing /api/auth/login
  return req.cookies.get('ubt_auth_role')?.value === 'admin';
}

export async function GET(req: NextRequest) {
  if (!isAdmin(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const alerts = await loadTodayAlerts();
  return NextResponse.json(alerts);
}

export async function DELETE(req: NextRequest) {
  if (!isAdmin(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const alertsFile = path.join(process.cwd(), 'data', 'alerts-today.json');
    await fs.writeFile(alertsFile, JSON.stringify({ date: '', alerts: [] }, null, 2));
  } catch {}
  return NextResponse.json({ cleared: true });
}
