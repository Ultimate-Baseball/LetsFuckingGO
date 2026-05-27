/**
 * Excel parser for daily bullpen data uploads.
 *
 * File format — one sheet per team (e.g. "Detroit Tigers"):
 *
 *   Row 2 : [" ", TeamName, null, "Daily Stats", date1, date2, ...]  ← dates start col E (idx 4)
 *   Row 3 : [null, "Relief Pitchers", "L/R", "Categories", "DID NOT PLAY"|"Pitching Stats", ...]
 *   Rows 4–108  : Relief pitchers, 7 rows each (up to 15 slots)
 *     +0: [index, Name,   L/R, "Pitches",   p1,  p2, ...]
 *     +1: [null,  Role,  null, "IPs",       ip1, ip2, ...]
 *     +2: [null,  null,  null, "ERA",      era1, era2, ...]
 *     +3: [null,  null,  null, "#Batters",   b1,  b2, ...]
 *     +4: [null,  null,  null, "ER",        er1, er2, ...]
 *     +5: [null,  null,  null, "Walks",      w1,  w2, ...]
 *     +6: [null,  null,  null, "Hits",       h1,  h2, ...]
 *   Row 110: "Starting Pitchers" header
 *   Rows 111–180: Starting pitchers, same 7-row block format (up to 10 slots)
 *   Row 182: "Disabled List" header
 *   Rows 183–195: Relief pitcher IL entries [null, name, L/R, startDate, ilType, description, null, notes]
 *   Rows 196–202: Starting pitcher IL entries (same format)
 */

import * as XLSX from "xlsx";
import type { Pitcher, GameLog, DLPlayer, StarterEntry } from "@/lib/types";

// ─── Sheet Name → Team Abbreviation ───────────────────────────────────────────

const SHEET_TO_ABBR: Record<string, string> = {
  "Athletics":              "OAK",
  "Baltimore Orioles":      "BAL",
  "Boston Red Sox":         "BOS",
  "Chicago White Sox":      "CWS",
  "Cleveland Guardians":    "CLE",
  "Detroit Tigers":         "DET",
  "Houston Astros":         "HOU",
  "Kansas City Royals":     "KC",
  "Los Angeles Angels":     "LAA",
  "Minnesota Twins":        "MIN",
  "New York Yankees":       "NYY",
  "Seattle Mariners":       "SEA",
  "Tampa Bay Rays":         "TB",
  "Texas Rangers":          "TEX",
  "Toronto Blue Jays":      "TOR",
  "Arizona Diamondbacks":   "ARI",
  "Atlanta Braves":         "ATL",
  "Chicago Cubs":           "CHC",
  "Cincinnati Reds":        "CIN",
  "Colorado Rockies":       "COL",
  "Los Angeles Dodgers":    "LAD",
  "Miami Marlins":          "MIA",
  "Milwaukee Brewers":      "MIL",
  "New York Mets":          "NYM",
  "Philadelphia Phillies":  "PHI",
  "Pittsburgh Pirates":     "PIT",
  "San Diego Padres":       "SD",
  "San Francisco Giants":   "SF",
  "St. Louis Cardinals":    "STL",
  "Washington Nationals":   "WSH",
};

/** Non-team sheets that should be ignored. */
const SKIP_SHEETS = new Set([
  "Ultimate Baseball Tool",
  "Team and Weather Links",
  "User Guide - Wager",
  "User Guide - Fantasy",
]);

// ─── Helpers ───────────────────────────────────────────────────────────────────

function cellStr(v: unknown): string {
  if (v == null) return "";
  return String(v).trim();
}

function cellNum(v: unknown): number {
  if (v == null || v === "" || v === " ") return 0;
  const n = parseFloat(String(v).replace(/[^0-9.-]/g, ""));
  return isNaN(n) ? 0 : n;
}

/** Convert an XLSX cell value to ISO date string "YYYY-MM-DD".
 * cellDates is disabled for speed, so dates arrive as numeric Excel serials. */
function toIsoDate(v: unknown): string | null {
  if (v == null) return null;

  // JS Date (legacy, kept for safety)
  if (v instanceof Date) {
    const y = v.getUTCFullYear();
    const m = String(v.getUTCMonth() + 1).padStart(2, "0");
    const d = String(v.getUTCDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }

  // Excel serial date number (days since 1900-01-01, with Excel leap-year bug)
  // Range roughly 2015-01-01 (42005) to 2030-12-31 (47848)
  if (typeof v === "number" && v > 42000 && v < 48000) {
    // (serial - 25569) converts from Excel epoch to Unix epoch days
    const dt = new Date(Math.round((v - 25569) * 86_400_000));
    const y  = dt.getUTCFullYear();
    const mo = String(dt.getUTCMonth() + 1).padStart(2, "0");
    const d  = String(dt.getUTCDate()).padStart(2, "0");
    return `${y}-${mo}-${d}`;
  }

  // String formats: "2026-03-25" or "2026-03-25 00:00:00"
  const s = String(v).trim();
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;

  return null;
}

/** Compute ERA from totals (null if no IP). */
function era(totalER: number, totalIP: number): number | null {
  if (totalIP <= 0) return null;
  return Math.round((totalER * 9 / totalIP) * 100) / 100;
}

/** Compute WHIP from totals (null if no IP). */
function whip(walks: number, hits: number, totalIP: number): number | null {
  if (totalIP <= 0) return null;
  return Math.round(((walks + hits) / totalIP) * 100) / 100;
}

// ─── Parse Result ──────────────────────────────────────────────────────────────

export interface ParsedUpload {
  pitchersByTeam:  Record<string, Pitcher[]>;
  startersByTeam:  Record<string, StarterEntry[]>;
  ilByTeam:        Record<string, DLPlayer[]>;
  /** Relief-pitcher-only IL entries (rows 183–195 in spreadsheet) */
  reliefILByTeam:  Record<string, DLPlayer[]>;
  warnings:        string[];
  stats: {
    totalPitcherRows: number;
    totalStarterRows: number;
    totalILRows:      number;
    teamsFound:       number;
  };
}

// ─── Main Parser ───────────────────────────────────────────────────────────────

export function parseExcelBuffer(buffer: ArrayBuffer): ParsedUpload {
  const workbook = XLSX.read(buffer, { type: "array", dense: true });  // cellDates:false for speed — dates handled as serials below

  const warnings: string[] = [];
  const pitchersByTeam:  Record<string, Pitcher[]>    = {};
  const startersByTeam:  Record<string, StarterEntry[]> = {};
  const ilByTeam:        Record<string, DLPlayer[]>    = {};
  const reliefILByTeam:  Record<string, DLPlayer[]>    = {};
  let totalPitcherRows = 0;
  let totalStarterRows = 0;
  let totalILRows      = 0;

  for (const sheetName of workbook.SheetNames) {
    if (SKIP_SHEETS.has(sheetName)) continue;

    const abbr = SHEET_TO_ABBR[sheetName];
    if (!abbr) {
      warnings.push(`Unknown sheet "${sheetName}" — skipped.`);
      continue;
    }

    const sheet = workbook.Sheets[sheetName];
    const raw: unknown[][] = XLSX.utils.sheet_to_json(sheet, {
      header: 1,
      defval: null,
      blankrows: true,   // keep blank rows so row indices stay predictable
    });

    if (raw.length < 4) {
      warnings.push(`Sheet "${sheetName}": too few rows — skipped.`);
      continue;
    }

    // ── Date header (row 2, 1-indexed = index 1) ───────────────────────────
    // Dates start at column index 4 (col E).
    const headerRow = raw[1] ?? [];
    const dateCols: { col: number; date: string }[] = [];
    for (let c = 4; c < headerRow.length; c++) {
      const iso = toIsoDate(headerRow[c]);
      if (iso) dateCols.push({ col: c, date: iso });
    }
    if (dateCols.length === 0) {
      warnings.push(`Sheet "${sheetName}": no date columns found in row 2.`);
      continue;
    }

    // Today for 14-day window
    const todayStr = new Date().toISOString().split("T")[0];
    const cutoffStr = (() => {
      const d = new Date();
      d.setDate(d.getDate() - 14);
      return d.toISOString().split("T")[0];
    })();

    // ── Parse pitcher blocks ───────────────────────────────────────────────
    // Relief pitchers: rows 4–108 (1-indexed) → indices 3–107 (0-indexed), 15 slots × 7 rows
    // Starting pitchers: rows 111–180 (1-indexed) → indices 110–179, 10 slots × 7 rows
    // DL: row 182 is header (index 181), rows 183+ are entries (indices 182+)

    function parsePitcherBlocks(
      startIdx: number,
      endIdx: number
    ): Pitcher[] {
      const result: Pitcher[] = [];
      let i = startIdx;

      while (i <= endIdx && i < raw.length) {
        const row = raw[i] ?? [];
        const cat = cellStr(row[3]).toLowerCase();

        if (cat !== "pitches") {
          i++;
          continue;
        }

        // This is the first row of a pitcher block
        const name = cellStr(row[1]);
        if (!name || name === " ") {
          i++;
          continue;
        }

        const hand = (cellStr(row[2]).charAt(0).toUpperCase() || "R") as "L" | "R";

        // Extract ESPN player URL from the hyperlink on the name cell (col B = index 1)
        const nameCellAddr = XLSX.utils.encode_cell({ r: i, c: 1 });
        const nameCellObj  = sheet[nameCellAddr] as { l?: { Target?: string } } | undefined;
        const espnUrl      = nameCellObj?.l?.Target ?? undefined;

        // Gather all 7 data rows (some may be missing if sheet is short)
        const pitchRow   = row;
        const ipRow      = raw[i + 1] ?? [];
        const eraRow     = raw[i + 2] ?? [];
        const battersRow = raw[i + 3] ?? [];
        const erRow      = raw[i + 4] ?? [];
        const walksRow   = raw[i + 5] ?? [];
        const hitsRow    = raw[i + 6] ?? [];

        // Build per-date game log entries where pitches > 0
        const gameLog: GameLog[] = [];
        for (const { col, date } of dateCols) {
          const pitches = cellNum(pitchRow[col]);
          if (pitches <= 0) continue;

          const ipVal      = cellNum(ipRow[col]);
          const erVal      = cellNum(erRow[col]);
          const walksVal   = cellNum(walksRow[col]);
          const hitsVal    = cellNum(hitsRow[col]);
          const battersVal = cellNum(battersRow[col]);
          const eraVal     = cellNum(eraRow[col]);

          gameLog.push({
            date,
            pitches,
            ip:      ipVal,
            er:      erVal,
            walks:   walksVal,
            hits:    hitsVal,
            batters: battersVal,
            era:     eraVal > 0 ? eraVal : null,
          });
        }

        // Sort game log ascending by date
        gameLog.sort((a, b) => a.date.localeCompare(b.date));

        // Aggregate season totals
        let gpSeason = gameLog.length;
        let ipSeason = 0, erSeason = 0, walksSeason = 0, hitsSeason = 0, pitchesSeason = 0, battersSeason = 0;
        for (const g of gameLog) {
          ipSeason      += g.ip;
          erSeason      += g.er;
          walksSeason   += g.walks;
          hitsSeason    += g.hits;
          pitchesSeason += g.pitches;
          battersSeason += g.batters;
        }

        // Aggregate 14-day totals
        const recent = gameLog.filter(g => g.date >= cutoffStr && g.date <= todayStr);
        let gp14d = recent.length;
        let ip14d = 0, er14d = 0, walks14d = 0, hits14d = 0, pitches14d = 0, batters14d = 0;
        for (const g of recent) {
          ip14d      += g.ip;
          er14d      += g.er;
          walks14d   += g.walks;
          hits14d    += g.hits;
          pitches14d += g.pitches;
          batters14d += g.batters;
        }

        result.push({
          name,
          hand: hand === "L" ? "L" : "R",
          ...(espnUrl ? { espnUrl } : {}),
          gp:          gpSeason,
          ip:          Math.round(ipSeason * 10) / 10,
          era:         era(erSeason, ipSeason),
          whip:        whip(walksSeason, hitsSeason, ipSeason),
          pitches:     pitchesSeason,
          batters:     battersSeason,
          gp14d,
          ip14d:       Math.round(ip14d * 10) / 10,
          er14d,
          era14d:      era(er14d, ip14d),
          whip14d:     whip(walks14d, hits14d, ip14d),
          pitches14d,
          batters14d,
          gameLog,
        } as Pitcher);

        i += 7; // advance past this pitcher's 7 rows
      }

      return result;
    }

    function parseStarterBlocks(startIdx: number, endIdx: number): StarterEntry[] {
      const result: StarterEntry[] = [];
      let i = startIdx;

      while (i <= endIdx && i < raw.length) {
        const row = raw[i] ?? [];
        const cat = cellStr(row[3]).toLowerCase();
        if (cat !== "pitches") { i++; continue; }

        const name = cellStr(row[1]);
        if (!name || name === " ") { i++; continue; }

        const hand = (cellStr(row[2]).charAt(0).toUpperCase() || "R");
        const ipRow = raw[i + 1] ?? [];

        const gameLogs: { date: string; ip: number }[] = [];
        for (const { col, date } of dateCols) {
          const ipVal = cellNum(ipRow[col]);
          if (ipVal > 0) gameLogs.push({ date, ip: ipVal });
        }
        gameLogs.sort((a, b) => a.date.localeCompare(b.date));

        result.push({ name, hand, gameLogs });
        i += 7;
      }

      return result;
    }

    // Relief pitchers: rows 4–108 (1-indexed) = indices 3–107
    const relievers = parsePitcherBlocks(3, 108) as Pitcher[];
    const validRelievers = relievers.filter(p => p.name && p.name.trim() !== "");
    pitchersByTeam[abbr] = validRelievers;
    totalPitcherRows += validRelievers.length;

    // Starting pitchers: rows 111–180 (1-indexed) = indices 110–179
    const starters = parseStarterBlocks(110, 179);
    const validStarters = starters.filter(p => p.name && p.name.trim() !== "");
    startersByTeam[abbr] = validStarters;
    totalStarterRows += validStarters.length;

    // IL: header at row 182 (index 181)
    // Relief pitcher IL: rows 183–195 (1-indexed) = indices 182–194
    // Starting pitcher IL: rows 196–202 (1-indexed) = indices 195–201
    function parseILRows(startIdx: number, endIdx: number, pitcherType: 'reliever' | 'starter'): DLPlayer[] {
      const entries: DLPlayer[] = [];
      for (let i = startIdx; i <= endIdx && i < raw.length; i++) {
        const row = raw[i] ?? [];
        const name = cellStr(row[1]);
        if (!name || name === " " || name.toLowerCase().includes("disabled")) continue;
        if (name.toLowerCase() === "l/r") continue;

        const startDateRaw = row[3];
        const startDateIso = toIsoDate(startDateRaw);

        entries.push({
          name,
          hand:        (cellStr(row[2]).charAt(0).toUpperCase() || "R"),
          ilType:      cellStr(row[4]) || undefined,
          description: cellStr(row[5]) || undefined,
          startDate:   (startDateIso ?? cellStr(row[3])) || undefined,
          notes:       cellStr(row[7]) || undefined,
          pitcherType,
        });
      }
      return entries;
    }

    const reliefIL  = parseILRows(182, 194, 'reliever');   // rows 183–195 (1-indexed)
    const starterIL = parseILRows(195, 201, 'starter');     // rows 196–202 (1-indexed)
    const ilList    = [...reliefIL, ...starterIL];

    ilByTeam[abbr]       = ilList;
    reliefILByTeam[abbr] = reliefIL;
    totalILRows += ilList.length;
  }

  return {
    pitchersByTeam,
    startersByTeam,
    ilByTeam,
    reliefILByTeam,
    warnings,
    stats: {
      totalPitcherRows,
      totalStarterRows,
      totalILRows,
      teamsFound: Object.keys(pitchersByTeam).length,
    },
  };
}
