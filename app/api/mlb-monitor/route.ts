// ============================================================
// GET /api/mlb-monitor
// Called every 60 seconds by cron-job.org
// Auth: Authorization: Bearer <CRON_SECRET>
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { runMonitor, loadMonitorState, saveMonitorState } from '@/lib/mlb/monitor';
import { getAllLiveGames } from '@/lib/mlb/api';
import { DEFAULT_THRESHOLDS } from '@/lib/mlb/types';

export const dynamic = 'force-dynamic';

function isAuthorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return process.env.NODE_ENV === 'development';
  return req.headers.get('authorization') === `Bearer ${secret}`;
}

function isGameHours(): boolean {
  const etHour = parseInt(
    new Date().toLocaleString('en-US', { timeZone: 'America/New_York', hour: 'numeric', hour12: false }), 10
  );
  return etHour >= 12 && etHour <= 23;
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);

  // Status check — public, no auth
  if (searchParams.get('status') === '1') {
    const [state, liveGames] = await Promise.all([loadMonitorState(), getAllLiveGames()]);
    return NextResponse.json({
      liveGamesCount: liveGames.length,
      monitorState: {
        lastRunAt:       state.lastRunAt,
        alertsSentToday: state.alertsSentToday,
        trackedGames:    Object.keys(state.activePitchers).length,
      },
      liveGames: liveGames.map(g => ({
        gamePk:         g.gamePk,
        matchup:        `${g.awayTeam.abbreviation} @ ${g.homeTeam.abbreviation}`,
        score:          `${g.awayScore}-${g.homeScore}`,
        inning:         `${g.inningHalf} ${g.inning}`,
        currentPitcher: g.currentPitcher ? `${g.currentPitcher.name} (${g.currentPitcher.teamName})` : 'None',
      })),
    });
  }

  // Dry run — auth required
  if (searchParams.get('dryRun') === '1') {
    if (!isAuthorized(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const result = await runMonitor({ dryRun: true });
    return NextResponse.json({ mode: 'dry_run', ...result });
  }

  // Reset state — auth required
  if (searchParams.get('reset') === '1') {
    if (!isAuthorized(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    await saveMonitorState({
      activePitchers: {}, lastRunAt: new Date().toISOString(), alertsSentToday: 0,
      date: new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' }),
    });
    return NextResponse.json({ reset: true });
  }

  // Normal cron run
  if (!isAuthorized(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  if (!isGameHours()) {
    return NextResponse.json({
      skipped: true, reason: 'Outside game hours (12pm–midnight ET)', checkedAt: new Date().toISOString(),
    });
  }

  try {
    const result = await runMonitor({
      thresholds: {
        ...DEFAULT_THRESHOLDS,
        minHealthTier:        parseInt(process.env.ALERT_MIN_HEALTH_TIER ?? '3', 10),
        minFatigue:           parseInt(process.env.ALERT_MIN_FATIGUE     ?? '4', 10),
        alertGrades:          (process.env.ALERT_GRADES ?? 'D,F').split(','),
        minWhip:              parseFloat(process.env.ALERT_MIN_WHIP      ?? '1.60'),
        alertConsecutiveDays: process.env.ALERT_CONSECUTIVE_DAYS !== 'false',
        alertUnavailable:     process.env.ALERT_UNAVAILABLE !== 'false',
      },
    });

    return NextResponse.json({
      success: true,
      ...result,
      alertSummary: result.alerts.map(a => ({
        pitcher:  a.pitcher.name,
        team:     a.pitcher.team,
        severity: a.severity,
        type:     a.type,
        whip:     a.appData?.whip ?? null,
        grade:    a.appData?.effectivenessGrade ?? null,
        game:     a.gameContext.displayScore,
      })),
    });
  } catch (err) {
    console.error('[MLB Monitor] Run failed:', err);
    return NextResponse.json({ success: false, error: String(err) }, { status: 500 });
  }
}
