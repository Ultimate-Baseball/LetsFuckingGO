import type { GameLog, HealthTier } from "@/lib/types";

// ─── Team-Level Thresholds ────────────────────────────────────────────────────
const TEAM_THRESHOLDS = {
  pitches:         { low: 76,  high: 96  },
  ip:              { low: 4.5, high: 5.8 },
  reliefIPPerGame: { low: 3.0, high: 4.0 },
};
const TEAM_WEIGHTS = { pitches: 0.40, ip: 0.40, third: 0.20 };

// ─── Pitcher-Level Thresholds (equal weight, no manual %) ─────────────────────
const PITCHER_THRESHOLDS = {
  pitches: { low: 70,  high: 111 },
  ip:      { low: 4.0, high: 6.8 },
  gp:      { low: 4,   high: 7   },
};

// ─── Tier Boundaries ──────────────────────────────────────────────────────────
const TIER_SCORES = { veryLow: 0.4, low: 0.8, moderate: 1.2, high: 1.6 };

// ─── Helpers ──────────────────────────────────────────────────────────────────
function score3(val: number, low: number, high: number): 0 | 1 | 2 {
  if (val < low)  return 0;
  if (val < high) return 1;
  return 2;
}
function tierFromScore(score: number): HealthTier {
  if (score < TIER_SCORES.veryLow)  return "veryLow";
  if (score < TIER_SCORES.low)      return "low";
  if (score < TIER_SCORES.moderate) return "moderate";
  if (score < TIER_SCORES.high)     return "high";
  return "veryHigh";
}

// ─── Date helpers ─────────────────────────────────────────────────────────────
function toDateStr(d: Date): string {
  return d.toISOString().split("T")[0];
}
function addDays(dateStr: string, n: number): string {
  const d = new Date(dateStr);
  d.setUTCDate(d.getUTCDate() + n);
  return toDateStr(d);
}
function daysBetween(a: string, b: string): number {
  const msA = new Date(a).getTime();
  const msB = new Date(b).getTime();
  return Math.round((msB - msA) / 86_400_000);
}

// ─────────────────────────────────────────────────────────────────────────────
//  PITCHER AVAILABILITY INDEX
//  Rules (as specified by user, with noted interpretations):
//
//  Pitch-count health impact (day-after):
//    < 10 pitches  → no health change (100%)
//    10-20 pitches → 75% next day
//    21-30 pitches → 50% next day
//    > 30 pitches  → 0% next day (unusable)
//
//  Recovery (rest days after last appearance):
//    1 rest day    → carry pitch-count health forward
//    2 rest days   → 100% (rule 6) UNLESS last game was >50 pitches
//    3+ rest days  → always 100% (rule 11 universal override)
//    >50 pitches   → +33% per rest day (days 1=33%, 2=67%, 3=100%)
//
//  Consecutive appearance rules:
//    Streak of 2 (each ≥10 pitches) → next day: availability=10%, team penalty -12.5%
//      └─ if they PITCH on that 10% day (streak becomes 3): day after = unusable
//    Streak of 3 → notification alert
//    3 of last 4 days (≥10 pitches, non-consecutive-3) → day 5: availability=10%, team -12.5%
//      └─ if they PITCH on that 10% day (day 5): day 6 = unusable
//    3 of 4 days → notification alert
//
//  Notes / known ambiguities:
//    - Pitches 31-50: unusable next day, but 2 rest days = 100% (treated as <50)
//    - After 1 rest day for 21-30 pitch game: health stays at 50% until day 2 (100%)
//    - Team penalty capped at -50% total (4 pitchers max impact)
//    - "Track statistics" alerts store triggering game snapshot; persistent
//      history requires admin upload flow to accumulate notifications over time
// ─────────────────────────────────────────────────────────────────────────────

export interface AvailabilityAlert {
  type: "consecutive_3" | "three_of_four";
  message: string;
  triggerDate: string;
  /** Stats snapshot of the triggering game for performance tracking */
  snapshot: {
    pitches: number;
    ip: number;
    er: number;
    walks: number;
    hits: number;
    batters: number;
  };
}

export interface PitcherAvailabilityResult {
  /** 0–100: physical health/fatigue level */
  health: number;
  /** 0–100: practical availability for today's game */
  availability: number;
  /** Hard unavailable — should not pitch */
  isUnusable: boolean;
  /** Consecutive-game streak ending at last appearance (≥10-pitch games only) */
  consecutiveStreak: number;
  /** Calendar days since last appearance */
  daysSinceLastGame: number;
  /** Pitches thrown in last appearance */
  lastGamePitches: number;
  /** This pitcher's contribution to team health penalty (0 or 12.5) */
  teamPenaltyPct: number;
  /** Human-readable reason for current status */
  reason: string;
  /** Alerts for notification panel */
  alerts: AvailabilityAlert[];
}

/** Determine next-day health % based on pitch count in a single game */
function pitchCountHealth(pitches: number): number {
  if (pitches < 10)  return 100;  // no meaningful impact
  if (pitches <= 20) return 75;
  if (pitches <= 30) return 50;
  return 0;                       // >30 → unusable next day
}

export function computePitcherAvailability(
  gameLog: GameLog[],
  referenceDate?: string
): PitcherAvailabilityResult {
  const today = referenceDate ?? toDateStr(new Date());

  // Fresh / no data
  const FRESH: PitcherAvailabilityResult = {
    health: 100, availability: 100, isUnusable: false,
    consecutiveStreak: 0, daysSinceLastGame: 99,
    lastGamePitches: 0, teamPenaltyPct: 0,
    reason: "No recent appearances — fully rested",
    alerts: [],
  };

  // Filter to last 10 days, sorted ascending
  const windowStart = addDays(today, -10);
  const recent = gameLog
    .filter(g => g.date >= windowStart && g.date <= today)
    .sort((a, b) => a.date.localeCompare(b.date));

  if (recent.length === 0) return FRESH;

  const lastGame      = recent[recent.length - 1];
  const lastPitches   = lastGame.pitches;
  const daysSince     = daysBetween(lastGame.date, today);

  // Build lookup maps
  const gameByDate    = new Map(recent.map(g => [g.date, g]));

  // ── Consecutive streak ending at lastGame (≥10 pitches per game) ─────────
  let streak = 0;
  for (let i = recent.length - 1; i >= 0; i--) {
    const g = recent[i];
    if (g.pitches < 10) break;                            // <10 pitches breaks streak
    const expectedDate = addDays(lastGame.date, -(streak));
    if (g.date !== expectedDate) break;                   // gap in calendar days
    streak++;
  }

  // ── 3-of-4 days pattern (in the 4 calendar days ending at lastGame) ───────
  // Only meaningful when streak < 3 (otherwise consecutive rule takes precedence)
  let threeOfFour    = false;
  let threeOfFourDates: string[] = [];

  if (streak < 3) {
    const window4 = [0, 1, 2, 3].map(i => addDays(lastGame.date, -(3 - i)));
    const appsIn4 = window4.filter(d => {
      const g = gameByDate.get(d);
      return g && g.pitches >= 10;
    });
    if (appsIn4.length >= 3) {
      threeOfFour      = true;
      threeOfFourDates = appsIn4;
    }
  }

  // ── Alerts ────────────────────────────────────────────────────────────────
  const alerts: AvailabilityAlert[] = [];
  const snap = {
    pitches: lastGame.pitches,
    ip:      lastGame.ip,
    er:      lastGame.er,
    walks:   lastGame.walks,
    hits:    lastGame.hits,
    batters: lastGame.batters,
  };

  if (streak >= 3) {
    alerts.push({
      type: "consecutive_3",
      message: `⚠️ Pitched ${streak} consecutive days — monitor closely (last: ${lastGame.date})`,
      triggerDate: lastGame.date,
      snapshot: snap,
    });
  }

  if (threeOfFour && streak < 3) {
    alerts.push({
      type: "three_of_four",
      message: `⚠️ Pitched 3 of last 4 days — high-frequency usage (last: ${lastGame.date})`,
      triggerDate: lastGame.date,
      snapshot: snap,
    });
  }

  // ── Health & Availability ─────────────────────────────────────────────────
  let health       = 100;
  let availability = 100;
  let isUnusable   = false;
  let teamPenalty  = 0;
  let reason       = "";

  // Universal rule 11: 3+ rest days always resets to 100%
  if (daysSince >= 3) {
    return { ...FRESH, daysSinceLastGame: daysSince, lastGamePitches: lastPitches,
             consecutiveStreak: streak, alerts,
             reason: `${daysSince} days rest — fully recovered` };
  }

  if (daysSince === 2) {
    // Two rest days since last game
    if (lastPitches > 50) {
      // Extended recovery: 2 days = 67% (rule 7)
      health       = 67;
      availability = 67;
      reason       = `2 rest days after ${lastPitches} pitches — 67% health (needs 3rd day)`;
    } else {
      // Rule 6: 2 rest days = 100% for ≤50 pitches
      health       = 100;
      availability = 100;
      reason       = "2 rest days — fully recovered";
    }
    return { health, availability, isUnusable, consecutiveStreak: streak,
             daysSinceLastGame: daysSince, lastGamePitches: lastPitches,
             teamPenaltyPct: teamPenalty, reason, alerts };
  }

  // daysSince === 1: exactly 1 rest day since last game
  const baseHealth = pitchCountHealth(lastPitches);

  // Check unusable from pitch count first (>30 pitches = 0% / unusable)
  if (baseHealth === 0) {
    isUnusable   = true;
    health       = 0;
    availability = 0;
    reason       = `Unusable — threw ${lastPitches} pitches yesterday`;
    return { health, availability, isUnusable, consecutiveStreak: streak,
             daysSinceLastGame: daysSince, lastGamePitches: lastPitches,
             teamPenaltyPct: 0, reason, alerts };
  }

  health = baseHealth;

  // Consecutive streak rules
  if (streak >= 3 && lastPitches >= 10) {
    // Pitched on day 3 (10% availability day) → day 4 = unusable
    isUnusable   = true;
    health       = 0;
    availability = 0;
    reason       = `Unusable — pitched ${streak} consecutive days`;
  } else if (streak === 2 && lastPitches >= 10) {
    // 2 in a row → today (day 3) = 10% availability (health reflects pitch count)
    availability = 10;
    teamPenalty  = 12.5;
    reason       = `${health}% health — pitched back-to-back (${streak} days in a row)`;
  } else if (threeOfFour && lastPitches >= 10) {
    // 3-of-4 pattern → today (day 5) = 10% availability (health reflects pitch count)
    availability = 10;
    teamPenalty  = 12.5;
    reason       = `${health}% health — pitched 3 of last 4 days`;
  } else {
    // Normal single rest day — availability matches health
    availability = health;
    reason       = health === 100
      ? "Rested — fully available"
      : `${health}% health — threw ${lastPitches} pitches last game`;
  }

  return {
    health, availability, isUnusable,
    consecutiveStreak: streak,
    daysSinceLastGame: daysSince,
    lastGamePitches: lastPitches,
    teamPenaltyPct: teamPenalty,
    reason, alerts,
  };
}

/** Aggregate team-level health penalty from individual availability results.
 *  Capped at 50% (4 pitchers max per known issue #6). */
export function computeTeamAvailabilityPenalty(
  results: PitcherAvailabilityResult[]
): number {
  const raw = results.reduce((sum, r) => sum + r.teamPenaltyPct, 0);
  return Math.min(raw, 50);
}

// ─── Existing public API (unchanged) ─────────────────────────────────────────

export function computeTeamHealthTier(
  avgPitches14d: number,
  avgIP14d: number,
  avgReliefIPPerGame: number
): HealthTier {
  if (avgPitches14d === 0 && avgReliefIPPerGame === 0) return "veryLow";
  const ps  = score3(avgPitches14d,      TEAM_THRESHOLDS.pitches.low,         TEAM_THRESHOLDS.pitches.high);
  const is_ = score3(avgIP14d,           TEAM_THRESHOLDS.ip.low,              TEAM_THRESHOLDS.ip.high);
  const rs  = score3(avgReliefIPPerGame, TEAM_THRESHOLDS.reliefIPPerGame.low,  TEAM_THRESHOLDS.reliefIPPerGame.high);
  return tierFromScore(ps * TEAM_WEIGHTS.pitches + is_ * TEAM_WEIGHTS.ip + rs * TEAM_WEIGHTS.third);
}

export function computePitcherHealthTier(
  pitches14d: number,
  ip14d: number,
  gp14d: number
): HealthTier {
  if (pitches14d === 0 && gp14d === 0) return "veryLow";
  const ps  = score3(pitches14d, PITCHER_THRESHOLDS.pitches.low, PITCHER_THRESHOLDS.pitches.high);
  const is_ = score3(ip14d,      PITCHER_THRESHOLDS.ip.low,      PITCHER_THRESHOLDS.ip.high);
  const gs  = score3(gp14d,      PITCHER_THRESHOLDS.gp.low,      PITCHER_THRESHOLDS.gp.high);
  return tierFromScore((ps + is_ + gs) / 3);
}

export function computeTeamUsageBarPct(
  avgPitches14d: number,
  avgIP14d: number,
  avgReliefIPPerGame: number
): number {
  if (avgPitches14d === 0 && avgReliefIPPerGame === 0) return 0;
  const pNorm = Math.min((avgPitches14d / 160) * 100, 100);
  const iNorm = Math.min((avgIP14d / 12) * 100, 100);
  const rNorm = Math.min((avgReliefIPPerGame / 7) * 100, 100);
  return Math.round(pNorm * TEAM_WEIGHTS.pitches + iNorm * TEAM_WEIGHTS.ip + rNorm * TEAM_WEIGHTS.third);
}

export function computeUsageBarPct(
  pitches14d: number,
  ip14d: number,
  gp14d: number
): number {
  if (pitches14d === 0 && gp14d === 0) return 0;
  const pNorm = Math.min((pitches14d / 160) * 100, 100);
  const iNorm = Math.min((ip14d / 12) * 100, 100);
  const gNorm = Math.min((gp14d / 10) * 100, 100);
  return Math.round((pNorm + iNorm + gNorm) / 3);
}
