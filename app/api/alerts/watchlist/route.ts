// ============================================================
// GET /api/alerts/watchlist
// Returns all pitchers currently meeting any alert threshold.
// Auth-required (admin cookie). Refreshes with each request.
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getUBTPitcherData, evaluateAlert } from '@/lib/mlb/monitor';
import { DEFAULT_THRESHOLDS } from '@/lib/mlb/types';

export const dynamic = 'force-dynamic';

export async function GET(_req: NextRequest) {
  // Auth check
  const cookieStore = await cookies();
  const role = cookieStore.get('ubt_auth_role')?.value;
  if (role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const allPitchers = await getUBTPitcherData();

    // Evaluate every pitcher against current thresholds
    const watchlist = allPitchers
      .map(pitcher => {
        const { shouldAlert, reasons, severity } = evaluateAlert(pitcher.name, pitcher, DEFAULT_THRESHOLDS);
        return { pitcher, shouldAlert, reasons, severity };
      })
      .filter(e => e.shouldAlert)
      .sort((a, b) => {
        // Sort: critical > warning > info, then by health tier desc
        const sevOrder = { critical: 0, warning: 1, info: 2 };
        const sevDiff = sevOrder[a.severity] - sevOrder[b.severity];
        if (sevDiff !== 0) return sevDiff;
        return b.pitcher.healthTier - a.pitcher.healthTier;
      });

    return NextResponse.json({
      watchlist,
      total: watchlist.length,
      critical: watchlist.filter(e => e.severity === 'critical').length,
      warning:  watchlist.filter(e => e.severity === 'warning').length,
      info:     watchlist.filter(e => e.severity === 'info').length,
      generatedAt: new Date().toISOString(),
    });
  } catch (err) {
    console.error('[watchlist]', err);
    return NextResponse.json({ error: 'Failed to load watchlist' }, { status: 500 });
  }
}
