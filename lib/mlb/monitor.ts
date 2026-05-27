// ============================================================
// MLB Bullpen Monitor — Core Engine
// Uses your existing UBT health calculations natively
// ============================================================

import { randomUUID } from 'crypto';
import type { BullpenAlert, MonitorState, MonitorPitcherData, AlertThresholds } from './types';
import { DEFAULT_THRESHOLDS } from './types';
import { getAllLiveGames } from './api';

// ─── Blob-based State ────────────────────────────────────────────────────────
// Vercel serverless filesystem is read-only; all writes go to Vercel Blob.

function todayET(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' });
}

export async function loadMonitorState(): Promise<MonitorState> {
  try {
    const { readBlobJson, BLOB_MONITOR_STATE } = await import('@/lib/blob-store');
    const state = await readBlobJson<MonitorState>(BLOB_MONITOR_STATE);
    if (!state) return { activePitchers: {}, lastRunAt: new Date().toISOString(), alertsSentToday: 0, date: todayET() };
    if (state.date !== todayET()) {
      return { activePitchers: {}, lastRunAt: new Date().toISOString(), alertsSentToday: 0, date: todayET() };
    }
    return state;
  } catch {
    return { activePitchers: {}, lastRunAt: new Date().toISOString(), alertsSentToday: 0, date: todayET() };
  }
}

export async function saveMonitorState(state: MonitorState): Promise<void> {
  try {
    const { writeBlobJson, BLOB_MONITOR_STATE } = await import('@/lib/blob-store');
    await writeBlobJson(BLOB_MONITOR_STATE, state);
  } catch {}
}

export async function persistAlert(alert: BullpenAlert): Promise<void> {
  try {
    const { readBlobJson, writeBlobJson, BLOB_ALERTS_TODAY } = await import('@/lib/blob-store');
    const existing = await readBlobJson<{ date: string; alerts: BullpenAlert[] }>(BLOB_ALERTS_TODAY);
    let alerts: BullpenAlert[] = [];
    if (existing?.date === todayET()) alerts = existing.alerts ?? [];
    alerts.unshift(alert);
    await writeBlobJson(BLOB_ALERTS_TODAY, { date: todayET(), alerts: alerts.slice(0, 200) });
  } catch {}
}

export async function loadTodayAlerts(): Promise<BullpenAlert[]> {
  try {
    const { readBlobJson, BLOB_ALERTS_TODAY } = await import('@/lib/blob-store');
    const data = await readBlobJson<{ date: string; alerts: BullpenAlert[] }>(BLOB_ALERTS_TODAY);
    if (!data || data.date !== todayET()) return [];
    return data.alerts ?? [];
  } catch { return []; }
}

// ─── App Data Integration ─────────────────────────────────────────────────────
// Reads directly from your data/mlb-teams.json — no HTTP needed

export async function getUBTPitcherData(): Promise<MonitorPitcherData[]> {
  try {
    const { readTeamsData } = await import('@/lib/blob-store');
    const teams: Record<string, any> = await readTeamsData();

    // Lazy-load calculation functions to avoid circular deps
    const { computePitcherHealthTier, computePitcherAvailability } = await import('@/lib/health');
    const { computeWhipGrade, computeCompositeScore, computeLetterGrade } = await import('@/lib/calculations');

    const HEALTH_NUM: Record<string, 1|2|3|4|5> = {
      veryLow: 1, low: 2, moderate: 3, high: 4, veryHigh: 5
    };
    const HEALTH_SCORE_MAP: Record<string, number> = {
      veryLow: 95, low: 75, moderate: 55, high: 30, veryHigh: 10
    };

    const result: MonitorPitcherData[] = [];

    for (const team of Object.values(teams)) {
      if (!team.pitchers?.length) continue;
      for (const pitcher of team.pitchers) {
        if (!pitcher.name) continue;

        const tier      = computePitcherHealthTier(pitcher.pitches14d ?? 0, pitcher.ip14d ?? 0, pitcher.gp14d ?? 0);
        const avail     = computePitcherAvailability(pitcher.gameLog ?? []);
        const grade     = computeWhipGrade(pitcher.whip14d ?? pitcher.whip ?? null) as 'A'|'B'|'C'|'D'|'F';
        const composite = computeCompositeScore(grade, tier);

        // Fatigue index from availability state
        let fatigueIndex: 1|2|3|4|5 = 1;
        if (avail.isUnusable)              fatigueIndex = 5;
        else if (avail.availability <= 10) fatigueIndex = 4;
        else if (avail.availability <= 50) fatigueIndex = 3;
        else if (avail.availability <= 75) fatigueIndex = 2;

        result.push({
          name:               pitcher.name,
          team:               team.team ?? '',
          teamAbbr:           team.abbr  ?? '',
          healthTier:         HEALTH_NUM[tier] ?? 3,
          healthScore:        HEALTH_SCORE_MAP[tier] ?? 55,
          effectivenessGrade: grade,
          whip:               pitcher.whip14d ?? pitcher.whip ?? 0,
          fatigueIndex,
          inningsLast14Days:  pitcher.ip14d      ?? 0,
          pitchesLast14Days:  pitcher.pitches14d ?? 0,
          consecutiveDaysUsed: avail.consecutiveStreak,
          available:          !avail.isUnusable,
          overallRating:      composite,
        });
      }
    }

    return result;
  } catch (err) {
    console.error('[MLB Monitor] Failed to load UBT pitcher data:', err);
    return [];
  }
}

/** Fuzzy name match — handles "José" vs "Jose" etc */
function findPitcher(mlbName: string, pitchers: MonitorPitcherData[]): MonitorPitcherData | null {
  const norm  = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z ]/g, '').trim();
  const target = norm(mlbName);
  const exact  = pitchers.find(p => norm(p.name) === target);
  if (exact) return exact;
  const last = target.split(' ').pop() ?? '';
  return pitchers.find(p => norm(p.name).endsWith(last)) ?? null;
}

// ─── Alert Evaluation ─────────────────────────────────────────────────────────

export function evaluateAlert(
  pitcherName: string,
  data: MonitorPitcherData | null,
  thresholds: AlertThresholds = DEFAULT_THRESHOLDS
): { shouldAlert: boolean; reasons: string[]; severity: BullpenAlert['severity'] } {
  if (!data) {
    return {
      shouldAlert: true,
      reasons:     [`${pitcherName} entered the game (not yet in UBT system)`],
      severity:    'info',
    };
  }

  const reasons: string[] = [];

  if (!data.available && thresholds.alertUnavailable)
    reasons.push(`⛔ ${data.name} marked UNAVAILABLE — pitched ${data.consecutiveDaysUsed} consecutive days`);

  if (data.healthTier >= thresholds.minHealthTier) {
    const label = ['','Elite','Low Usage','Moderate','High Usage','Critical'][data.healthTier];
    reasons.push(`🏥 Health Tier ${data.healthTier}/5 (${label}) — health score: ${data.healthScore}`);
  }

  if (data.fatigueIndex >= thresholds.minFatigue)
    reasons.push(`🔥 Fatigue Index ${data.fatigueIndex}/5 — highly fatigued pitcher entering game`);

  if (thresholds.alertGrades.includes(data.effectivenessGrade))
    reasons.push(`📉 Effectiveness Grade: ${data.effectivenessGrade} (WHIP: ${data.whip.toFixed(2)})`);

  // WHIP ≥ 1.60 — independent of grade bucket
  if (data.whip >= thresholds.minWhip && !thresholds.alertGrades.includes(data.effectivenessGrade))
    reasons.push(`⚠️ High WHIP: ${data.whip.toFixed(2)} (≥${thresholds.minWhip.toFixed(2)} threshold)`);

  if (thresholds.alertConsecutiveDays && data.consecutiveDaysUsed >= 2)
    reasons.push(`📅 Used ${data.consecutiveDaysUsed} consecutive days — fatigue penalty active`);

  let severity: BullpenAlert['severity'] = 'info';
  if (!data.available || data.healthTier >= 5 || data.fatigueIndex >= 5 || data.whip >= 1.80) severity = 'critical';
  else if (data.healthTier >= 4 || data.fatigueIndex >= 4 || data.whip >= 1.60)               severity = 'warning';

  return { shouldAlert: reasons.length > 0, reasons, severity };
}

// ─── Webhook ──────────────────────────────────────────────────────────────────

export async function sendWebhook(alert: BullpenAlert, url: string): Promise<void> {
  try {
    await fetch(url, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json', 'x-ubt-monitor-secret': process.env.MLB_MONITOR_WEBHOOK_SECRET ?? '' },
      body:    JSON.stringify(alert),
    });
  } catch (err) { console.error('[MLB Monitor] Webhook error:', err); }
}

// ─── Main Run ─────────────────────────────────────────────────────────────────

export interface MonitorRunResult {
  gamesChecked: number;
  pitcherChangesDetected: number;
  alertsSent: number;
  alerts: BullpenAlert[];
  runAt: string;
  durationMs: number;
}

export async function runMonitor(opts?: {
  thresholds?: AlertThresholds;
  dryRun?: boolean;
}): Promise<MonitorRunResult> {
  const start   = Date.now();
  const runAt   = new Date().toISOString();
  const dry     = opts?.dryRun ?? false;
  const thresh  = opts?.thresholds ?? DEFAULT_THRESHOLDS;

  const [state, liveGames, ubtPitchers] = await Promise.all([
    loadMonitorState(),
    getAllLiveGames(),
    getUBTPitcherData(),
  ]);

  const alerts: BullpenAlert[] = [];
  let changes = 0;

  for (const game of liveGames) {
    if (!game.currentPitcher) continue;
    const curId  = game.currentPitcher.mlbId;
    const prevId = state.activePitchers[game.gamePk] ?? null;
    if (curId === prevId) continue;

    changes++;
    state.activePitchers[game.gamePk] = curId;

    const appData = findPitcher(game.currentPitcher.name, ubtPitchers);
    const { shouldAlert, reasons, severity } = evaluateAlert(game.currentPitcher.name, appData, thresh);
    if (!shouldAlert) continue;

    const alert: BullpenAlert = {
      alertId:   randomUUID(),
      timestamp: new Date().toISOString(),
      type: !appData?.available ? 'CONSECUTIVE_DAY'
          : (appData?.fatigueIndex ?? 0) >= thresh.minFatigue ? 'FATIGUED_PITCHING'
          : (appData?.whip ?? 0) >= thresh.minWhip ? 'HIGH_WHIP'
          : (appData?.healthTier ?? 0) >= thresh.minHealthTier ? 'AT_RISK_PITCHING'
          : 'PITCHER_CHANGE',
      pitcher: {
        mlbId: game.currentPitcher.mlbId,
        name:  game.currentPitcher.name,
        team:  game.currentPitcher.teamName,
      },
      gameContext: {
        gamePk:     game.gamePk,
        homeTeam:   game.homeTeam.name,
        awayTeam:   game.awayTeam.name,
        homeScore:  game.homeScore,
        awayScore:  game.awayScore,
        inning:     game.inning,
        inningHalf: game.inningHalf,
        displayScore: `${game.awayTeam.name} ${game.awayScore} — ${game.homeTeam.name} ${game.homeScore}`,
      },
      appData,
      alertReasons: reasons,
      severity,
    };

    alerts.push(alert);

    if (!dry) {
      await persistAlert(alert);
      const webhookUrl = process.env.MLB_MONITOR_WEBHOOK_URL;
      if (webhookUrl) await sendWebhook(alert, webhookUrl);
    }
  }

  state.lastRunAt       = runAt;
  state.alertsSentToday = (state.alertsSentToday ?? 0) + alerts.length;
  if (!dry) await saveMonitorState(state);

  return {
    gamesChecked: liveGames.length,
    pitcherChangesDetected: changes,
    alertsSent: dry ? 0 : alerts.length,
    alerts,
    runAt,
    durationMs: Date.now() - start,
  };
}
