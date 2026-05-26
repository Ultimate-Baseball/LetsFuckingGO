export interface GameLog {
  date: string;
  pitches: number;
  ip: number;
  er: number;
  walks: number;
  hits: number;
  batters: number;
  era?: number | null;
  whip?: number | null;
}

export interface Pitcher {
  name: string;
  hand: 'L' | 'R';
  /** ESPN player profile URL extracted from spreadsheet hyperlink */
  espnUrl?: string;
  // Season stats
  gp: number;
  ip: number;
  era: number | null;
  whip: number | null;
  pitches: number;
  batters: number;
  // 14-day stats
  gp14d: number;
  ip14d: number;
  /** Total earned runs in the 14-day window — used for team ERA: sum(er14d)*9/sum(ip14d) */
  er14d: number;
  era14d: number | null;
  whip14d: number | null;
  pitches14d: number;
  batters14d: number;
  gameLog: GameLog[];
}

export interface StarterLog {
  date: string;
  ip: number;
}

/** Starting pitcher row — used to compute avgReliefIPPerGame (9 − starter IP). */
export interface StarterEntry {
  name: string;
  hand: string;
  gameLogs: StarterLog[];
}

export interface DLPlayer {
  name: string;
  hand: string;
  injury?: string;
  ilType?: string;
  startDate?: string;
  length?: string;
  description?: string;
  notes?: string;
  /** Whether this IL entry is a relief pitcher or starting pitcher */
  pitcherType?: 'reliever' | 'starter';
}

export interface TrendPoint {
  date: string;
  gamesUsed: number;
  era: number;
  whip: number;
  pitches?: number | null;
  ip?: number | null;
  batters?: number | null;
  health: HealthTier;
  grade: LetterGrade;
}

export interface TeamMetrics {
  // 14-day (primary — drives tier/grade)
  avgGP14d: number;
  avgIP14d: number;
  avgPitches14d: number;
  avgBatters14d: number;
  era14d: number | null;
  whip14d: number | null;
  totalGP14d: number;
  totalIP14d: number;
  totalPitches14d: number;
  totalBatters14d: number;
  /**
   * Average innings the bullpen covers per team game over 14 days.
   * = mean of (total relief IP per game date) across all game dates.
   * When starter data is available: derived as 9 − avg_starter_IP_per_game.
   */
  avgReliefIPPerGame: number;
  // Season reference
  avgGP: number;
  avgERA: number | null;
  avgWHIP: number | null;
  // Meta
  dlCount: number;
  pitcherCount: number;
  healthTier: HealthTier;
  letterGrade: LetterGrade;
  /** Composite score 0–100: 60% effectiveness + 40% health */
  compositeScore?: number;
}

export interface TeamData {
  team: string;
  abbr: string;
  division: string;
  espnId: string;
  pitchers: Pitcher[];
  /** Starting pitcher entries — used for avgReliefIPPerGame calculation */
  starters?: StarterEntry[];
  dl: DLPlayer[];
  metrics: TeamMetrics;
  trend: TrendPoint[];
  summary: string;
  cutoffDate?: string;
  latestDate?: string;
}

export type HealthTier = 'veryLow' | 'low' | 'moderate' | 'high' | 'veryHigh';
export type LetterGrade = 'A' | 'B' | 'C' | 'D' | 'F';

export interface ESPNInjury {
  player: string;
  status: string;
  description: string;
  type: string;
}
