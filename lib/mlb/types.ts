// ============================================================
// MLB Real-Time Monitor — Types
// Extends the existing UBT types with live-game monitoring
// ============================================================

export interface LiveGameState {
  gamePk: number;
  status: 'Live' | 'Final' | 'Preview' | 'Postponed';
  homeTeam: { id: number; name: string; abbreviation: string };
  awayTeam: { id: number; name: string; abbreviation: string };
  homeScore: number;
  awayScore: number;
  inning: number;
  inningHalf: 'Top' | 'Bottom' | '';
  currentPitcher: LivePitcher | null;
  lastUpdated: string;
}

export interface LivePitcher {
  mlbId: number;
  name: string;
  teamName: string;
  teamId: number;
}

/** Your app's health/grade data mapped to monitor format */
export interface MonitorPitcherData {
  name: string;
  team: string;
  teamAbbr: string;
  healthTier: 1 | 2 | 3 | 4 | 5;   // 1=Elite(veryLow usage), 5=Critical(veryHigh usage)
  healthScore: number;               // 0-100
  effectivenessGrade: 'A' | 'B' | 'C' | 'D' | 'F';
  whip: number;
  fatigueIndex: 1 | 2 | 3 | 4 | 5;  // 5 = most fatigued/unavailable
  inningsLast14Days: number;
  pitchesLast14Days: number;
  consecutiveDaysUsed: number;
  available: boolean;
  overallRating: number;             // 0-100 composite
}

export interface MonitorState {
  activePitchers: Record<number, number | null>;  // gamePk → current pitcher mlbId
  lastRunAt: string;
  alertsSentToday: number;
  date: string;                                    // ET date — resets state daily
}

export interface BullpenAlert {
  alertId: string;
  timestamp: string;
  type: 'PITCHER_CHANGE' | 'AT_RISK_PITCHING' | 'FATIGUED_PITCHING' | 'CONSECUTIVE_DAY' | 'HIGH_WHIP';
  pitcher: { mlbId: number; name: string; team: string };
  gameContext: {
    gamePk: number;
    homeTeam: string;
    awayTeam: string;
    homeScore: number;
    awayScore: number;
    inning: number;
    inningHalf: string;
    displayScore: string;
  };
  appData: MonitorPitcherData | null;
  alertReasons: string[];
  severity: 'info' | 'warning' | 'critical';
}

export interface AlertThresholds {
  minHealthTier: number;   // 1-5, alert when tier >= this
  minFatigue: number;      // 1-5, alert when fatigueIndex >= this
  alertGrades: string[];   // grades that trigger alerts
  minWhip: number;         // alert when WHIP >= this
  alertConsecutiveDays: boolean;
  alertUnavailable: boolean;
}

export const DEFAULT_THRESHOLDS: AlertThresholds = {
  minHealthTier: 3,
  minFatigue: 4,
  alertGrades: ['D', 'F'],
  minWhip: 1.60,
  alertConsecutiveDays: true,
  alertUnavailable: true,
};
