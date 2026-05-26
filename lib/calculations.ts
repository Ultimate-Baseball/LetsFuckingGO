/**
 * Core bullpen calculation pipeline.
 * Called after any data upload to recalculate all health tiers and letter grades.
 */

import type { TeamData, Pitcher, StarterEntry, TeamMetrics, LetterGrade, HealthTier } from "@/lib/types";
import { computeTeamHealthTier } from "@/lib/health";

// ─── Relief IP Per Game ────────────────────────────────────────────────────────

/**
 * Compute the average innings the bullpen covers per game over the last 14 days.
 *
 * Method A — from starter data (preferred, most accurate):
 *   For each game date: reliefIP = 9 − starter_IP
 *   avgReliefIPPerGame = mean across all dates
 *
 * Method B — from reliever game logs (fallback):
 *   For each game date, sum all reliever IPs → total relief IP for that game
 *   avgReliefIPPerGame = mean across all dates
 */
export function computeAvgReliefIPPerGame(
  pitchers: Pitcher[],
  _starters?: StarterEntry[],
  windowDays = 14
): number {
  // Bullpen calculations use ONLY relief pitcher data (rows 4-109).
  // Starting pitchers are tracked separately and do not affect bullpen metrics.
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - windowDays);
  const cutoffStr = cutoff.toISOString().split("T")[0];

  // Aggregate relief pitcher IP per game date from reliever game logs
  const dateReliefIP: Record<string, number> = {};
  for (const p of pitchers) {
    for (const log of p.gameLog ?? []) {
      if (log.date >= cutoffStr) {
        dateReliefIP[log.date] = (dateReliefIP[log.date] ?? 0) + (log.ip ?? 0);
      }
    }
  }

  const dates = Object.keys(dateReliefIP);
  if (dates.length >= 1) {
    const total = dates.reduce((s, d) => s + dateReliefIP[d], 0);
    return parseFloat((total / dates.length).toFixed(2));
  }

  // Fallback: estimate from 14-day aggregate (~12 games per 14-day window)
  const totalIP14d = pitchers.reduce((s, p) => s + (p.ip14d ?? 0), 0);
  return parseFloat((totalIP14d / 12).toFixed(2));
}

// ─── Letter Grade ──────────────────────────────────────────────────────────────
// ─── Individual ERA / WHIP grades ─────────────────────────────────────────────

export function computeEraGrade(era: number | null): LetterGrade {
  const e = era ?? 99;
  if (e <  2.50) return "A";
  if (e <= 3.50) return "B";
  if (e <= 4.25) return "C";
  if (e <= 4.75) return "D";
  return "F";
}

export function computeWhipGrade(whip: number | null): LetterGrade {
  const w = whip ?? 99;
  if (w <  0.90) return "A";
  if (w <= 1.15) return "B";
  if (w <= 1.37) return "C";
  if (w <= 1.50) return "D";
  return "F";
}

// Numeric conversion helpers for weighted blending
const GRADE_TO_NUM: Record<LetterGrade, number> = { A: 4, B: 3, C: 2, D: 1, F: 0 };

function numericToGrade(n: number): LetterGrade {
  if (n >= 3.5) return "A";
  if (n >= 2.5) return "B";
  if (n >= 1.5) return "C";
  if (n >= 0.5) return "D";
  return "F";
}

export function computeLetterGrade(era14d: number | null, whip14d: number | null): LetterGrade {
  // Overall = 65% WHIP grade + 35% ERA grade
  const eraGrade  = computeEraGrade(era14d);
  const whipGrade = computeWhipGrade(whip14d);
  const combined  = GRADE_TO_NUM[whipGrade] * 0.65 + GRADE_TO_NUM[eraGrade] * 0.35;
  return numericToGrade(combined);
}

// ─── Composite Score ───────────────────────────────────────────────────────────
const GRADE_SCORE: Record<LetterGrade, number> = { A: 100, B: 80, C: 60, D: 35, F: 10 };
const HEALTH_SCORE: Record<HealthTier, number> = { veryLow: 100, low: 80, moderate: 55, high: 30, veryHigh: 10 };

export function computeCompositeScore(grade: LetterGrade, tier: HealthTier): number {
  return Math.round(GRADE_SCORE[grade] * 0.5 + HEALTH_SCORE[tier] * 0.5);
}

export function compositeRank(score: number): string {
  if (score >= 88) return "A+";
  if (score >= 76) return "A";
  if (score >= 64) return "B+";
  if (score >= 54) return "B";
  if (score >= 44) return "C+";
  if (score >= 34) return "C";
  if (score >= 22) return "D";
  return "F";
}

// ─── Team Metrics ──────────────────────────────────────────────────────────────
/**
 * Recompute all metrics for a team from raw pitcher data.
 *
 * IL players are excluded from active pitcher calculations — they are not
 * pitching, so they don't contribute to usage metrics. Their count is stored
 * in dlCount for informational display only (expandable IL section on cards).
 *
 * @param pitchers  Active (non-IL) pitchers
 * @param ilCount   Number of IL players (stored for display only, no effect on tier)
 * @param starters  Starting pitcher entries (used to derive avgReliefIPPerGame)
 */
export function computeTeamMetrics(
  pitchers: Pitcher[],
  ilCount: number,
  starters?: StarterEntry[]
): Omit<TeamMetrics, "healthTier" | "letterGrade" | "compositeScore"> & {
  healthTier: HealthTier;
  letterGrade: LetterGrade;
  compositeScore: number;
} {
  const active = pitchers.filter((p) => p.gp14d > 0);
  const n = active.length || pitchers.length || 1;

  // 14-day aggregates
  const totalGP14d = pitchers.reduce((s, p) => s + p.gp14d, 0);
  const totalIP14d = pitchers.reduce((s, p) => s + (p.ip14d ?? 0), 0);
  const totalPitches14d = pitchers.reduce((s, p) => s + p.pitches14d, 0);
  const totalBatters14d = pitchers.reduce((s, p) => s + p.batters14d, 0);

  const avgGP14d = parseFloat((totalGP14d / n).toFixed(1));
  const avgIP14d = parseFloat((totalIP14d / n).toFixed(1));
  const avgPitches14d = parseFloat((totalPitches14d / n).toFixed(1));
  const avgBatters14d = parseFloat((totalBatters14d / n).toFixed(1));

  // Team ERA = (sum of all earned runs over 14d) * 9 / (sum of all IP over 14d)
  // Team WHIP = (sum of all walks + hits over 14d) / (sum of all IP over 14d)
  let era14d: number | null = null;
  let whip14d: number | null = null;
  const totalIPForStats = pitchers.reduce((s, p) => s + (p.ip14d ?? 0), 0);
  if (totalIPForStats > 0) {
    const totalER14d = pitchers.reduce((s, p) => s + (p.er14d ?? 0), 0);
    era14d = parseFloat(((totalER14d * 9) / totalIPForStats).toFixed(2));

    // WHIP: back-calculate (walks+hits) per pitcher from whip14d * ip14d, sum, divide by total IP
    const withWhip = pitchers.filter((p) => p.whip14d !== null && (p.ip14d ?? 0) > 0);
    if (withWhip.length > 0) {
      const totalWH = withWhip.reduce((s, p) => s + (p.whip14d ?? 0) * (p.ip14d ?? 0), 0);
      const totalIPForWhip = withWhip.reduce((s, p) => s + (p.ip14d ?? 0), 0);
      whip14d = parseFloat((totalWH / totalIPForWhip).toFixed(2));
    }
  }

  // Season averages
  const withSeasonEra = pitchers.filter((p) => p.era !== null);
  const avgERA = withSeasonEra.length
    ? parseFloat((withSeasonEra.reduce((s, p) => s + (p.era ?? 0), 0) / withSeasonEra.length).toFixed(2))
    : null;
  const avgWHIP = withSeasonEra.length
    ? parseFloat((withSeasonEra.reduce((s, p) => s + (p.whip ?? 0), 0) / withSeasonEra.length).toFixed(2))
    : null;
  const avgGP = parseFloat((pitchers.reduce((s, p) => s + p.gp, 0) / (pitchers.length || 1)).toFixed(1));

  // Relief IP per game (derived from starters or aggregated from reliever logs)
  const avgReliefIPPerGame = computeAvgReliefIPPerGame(pitchers, starters);

  // Health tier: pure usage metrics only — IL players are not pitching and
  // therefore have no effect on the workload of the active bullpen arms.
  const healthTier = computeTeamHealthTier(avgPitches14d, avgIP14d, avgReliefIPPerGame);
  const letterGrade = computeLetterGrade(era14d, whip14d);
  const compositeScore = computeCompositeScore(letterGrade, healthTier);

  return {
    avgGP14d,
    avgIP14d,
    avgPitches14d,
    avgBatters14d,
    era14d,
    whip14d,
    totalGP14d,
    totalIP14d,
    totalPitches14d,
    totalBatters14d,
    avgReliefIPPerGame,
    avgGP,
    avgERA,
    avgWHIP,
    dlCount: ilCount,
    pitcherCount: pitchers.length,
    healthTier,
    letterGrade,
    compositeScore,
  };
}

// ─── Full Recalculation Pass ───────────────────────────────────────────────────
export function recalculateAll(teams: Record<string, TeamData>): Record<string, TeamData> {
  for (const team of Object.values(teams)) {
    const ilCount = team.dl?.length ?? 0;
    const newMetrics = computeTeamMetrics(team.pitchers, ilCount, team.starters);
    team.metrics = { ...team.metrics, ...newMetrics };
  }
  return teams;
}
