/**
 * POST /api/upload-data
 * ADMIN ONLY — protected by middleware AND server-side cookie check.
 * Accepts a multipart form upload with field "file" (xlsx/xls).
 * Parses relief pitchers (rows 4-109), recalculates all metrics,
 * computes a before/after diff, and appends to the daily change log.
 *
 * Data is persisted to Vercel Blob (not the read-only serverless filesystem).
 */

import { NextRequest, NextResponse } from "next/server";
import { parseExcelBuffer } from "@/lib/excel-parser";
import { computeTeamMetrics } from "@/lib/calculations";
import {
  readTeamsData,
  writeTeamsData,
  readChangeLog,
  writeChangeLog,
} from "@/lib/blob-store";
import type { TeamData } from "@/lib/types";

export const runtime = "nodejs";

const AUTH_COOKIE = "ubt_auth_role";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface TeamSnapshot {
  grade:              string | null;
  tier:               string | null;
  score:              number | null;
  era14d:             number | null;
  whip14d:            number | null;
  avgReliefIPPerGame: number | null;
}

export interface TeamDiff {
  abbr:   string;
  name:   string;
  before: TeamSnapshot;
  after:  TeamSnapshot;
  gradeChanged:  boolean;
  tierChanged:   boolean;
  scoreChanged:  boolean;
}

export interface ChangeLogEntry {
  date:           string;   // YYYY-MM-DD
  timestamp:      string;   // ISO
  filename:       string;
  teamsUpdated:   number;
  teamsChanged:   TeamDiff[];
  teamsUnchanged: number;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function isAdmin(req: NextRequest): boolean {
  const role = req.cookies.get(AUTH_COOKIE)?.value;
  if (role === "admin") return true;
  return !!req.cookies.get("ubt_admin_auth")?.value;
}

function snapshot(team: TeamData): TeamSnapshot {
  const m = team.metrics ?? {};
  return {
    grade:              (m as any).letterGrade              ?? null,
    tier:               (m as any).healthTier               ?? null,
    score:              (m as any).compositeScore            ?? null,
    era14d:             (m as any).era14d                   ?? null,
    whip14d:            (m as any).whip14d                  ?? null,
    avgReliefIPPerGame: (m as any).avgReliefIPPerGame       ?? null,
  };
}

function buildDiff(
  abbr:   string,
  name:   string,
  before: TeamSnapshot,
  after:  TeamSnapshot
): TeamDiff {
  return {
    abbr, name, before, after,
    gradeChanged: before.grade !== after.grade,
    tierChanged:  before.tier  !== after.tier,
    scoreChanged: before.score !== after.score,
  };
}

// ── Route ─────────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const headers = {
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
  };

  if (!isAdmin(req)) {
    return NextResponse.json(
      { error: "Unauthorized. Admin access required." },
      { status: 403, headers }
    );
  }

  try {
    const formData = await req.formData();
    const file     = formData.get("file") as File | null;

    if (!file)
      return NextResponse.json({ error: "No file uploaded." }, { status: 400 });

    const ext = file.name.split(".").pop()?.toLowerCase();
    if (!["xlsx", "xls"].includes(ext ?? ""))
      return NextResponse.json({ error: "Invalid file type. Must be .xlsx or .xls" }, { status: 400 });

    if (file.size > 20 * 1024 * 1024)
      return NextResponse.json({ error: "File too large. Maximum 20MB." }, { status: 413 });

    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");

    // ── Load existing data from Blob (or bundled fallback) ──────────────────
    const existingData = await readTeamsData();

    // Build abbr-indexed lookup + snapshot BEFORE metrics
    const byAbbr: Record<string, TeamData> = {};
    const beforeSnapshots: Record<string, TeamSnapshot> = {};
    for (const t of Object.values(existingData) as TeamData[]) {
      if (t.abbr) {
        byAbbr[t.abbr.toUpperCase()] = t;
        beforeSnapshots[t.abbr.toUpperCase()] = snapshot(t);
      }
    }

    // ── Parse upload ────────────────────────────────────────────────────────
    const arrayBuffer = await file.arrayBuffer();
    const parsed      = parseExcelBuffer(arrayBuffer);

    if (parsed.stats.teamsFound === 0) {
      return NextResponse.json(
        { error: "No team data found in file.", warnings: parsed.warnings },
        { status: 422 }
      );
    }

    // ── Apply updates ───────────────────────────────────────────────────────
    const updatedTeams: string[] = [];
    const skippedTeams: string[] = [];

    for (const [abbr, pitchers] of Object.entries(parsed.pitchersByTeam)) {
      const team = byAbbr[abbr.toUpperCase()];
      if (!team) { skippedTeams.push(abbr); continue; }

      team.pitchers = pitchers.map((p) => {
        const existing = team.pitchers.find(
          (ep) => ep.name.toLowerCase() === p.name.toLowerCase()
        );
        return {
          ...p,
          gameLog: p.gameLog.length > 0 ? p.gameLog : (existing?.gameLog ?? []),
        };
      });

      const starters = parsed.startersByTeam[abbr.toUpperCase()];
      if (starters && starters.length > 0) team.starters = starters;

      const reliefILPlayers = parsed.reliefILByTeam[abbr.toUpperCase()] ?? [];
      team.dl = reliefILPlayers;

      const newMetrics = computeTeamMetrics(pitchers, reliefILPlayers.length);
      team.metrics = { ...team.metrics, ...newMetrics };

      team.cutoffDate = new Date().toISOString().split("T")[0];
      team.latestDate = new Date().toISOString().split("T")[0];

      updatedTeams.push(abbr);
    }

    // ── Compute diff ────────────────────────────────────────────────────────
    const diffs: TeamDiff[] = [];
    for (const abbr of updatedTeams) {
      const team  = byAbbr[abbr.toUpperCase()];
      if (!team) continue;
      const after = snapshot(team);
      const diff  = buildDiff(
        abbr,
        team.team ?? abbr,
        beforeSnapshots[abbr.toUpperCase()] ?? {
          grade: null, tier: null, score: null,
          era14d: null, whip14d: null, avgReliefIPPerGame: null,
        },
        after
      );
      diffs.push(diff);
    }

    const changed   = diffs.filter(d => d.gradeChanged || d.tierChanged || d.scoreChanged);
    const unchanged = diffs.filter(d => !d.gradeChanged && !d.tierChanged && !d.scoreChanged);

    // ── Persist to Blob ─────────────────────────────────────────────────────
    await writeTeamsData(existingData);

    // ── Append to change log ────────────────────────────────────────────────
    const existing_log = await readChangeLog<ChangeLogEntry>();
    const entry: ChangeLogEntry = {
      date:           new Date().toISOString().split("T")[0],
      timestamp:      new Date().toISOString(),
      filename:       safeName,
      teamsUpdated:   updatedTeams.length,
      teamsChanged:   changed,
      teamsUnchanged: unchanged.length,
    };
    const updated_log = [entry, ...existing_log].slice(0, 90);
    await writeChangeLog(updated_log);

    return NextResponse.json({
      success: true,
      message: `Data updated for ${updatedTeams.length} teams.`,
      updatedTeams,
      skippedTeams,
      warnings:  parsed.warnings,
      diff:      { changed, unchanged: unchanged.map(d => d.abbr) },
      stats: {
        ...parsed.stats,
        updatedTeams:   updatedTeams.length,
        skippedTeams:   skippedTeams.length,
        changedTeams:   changed.length,
        unchangedTeams: unchanged.length,
      },
    });
  } catch (err: any) {
    console.error("[upload-data] Error:", err);
    const msg = err?.message ?? String(err);
    const hint = !process.env.BLOB_READ_WRITE_TOKEN
      ? ' (BLOB_READ_WRITE_TOKEN env var is missing — connect the Blob store in Vercel dashboard and redeploy)'
      : '';
    return NextResponse.json(
      { error: `Upload failed: ${msg}${hint}` },
      { status: 500 }
    );
  }
}
