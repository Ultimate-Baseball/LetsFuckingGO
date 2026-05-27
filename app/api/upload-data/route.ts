/**
 * POST /api/upload-data
 * ADMIN ONLY — accepts { blobUrl: string, filename?: string } JSON body.
 *
 * The Excel file is uploaded directly from the browser to Vercel Blob
 * (bypassing the 4.5 MB serverless body limit). This endpoint receives
 * the resulting blob URL, fetches the file server-side, parses it,
 * recalculates all metrics, builds a diff, and persists to Blob storage.
 *
 * Reads happen in parallel (Excel + teams + changelog).
 * Writes happen in parallel (teams + changelog).
 * maxDuration = 60 prevents the Vercel Hobby 10s timeout.
 */

import { NextRequest, NextResponse } from 'next/server';
import { del } from '@vercel/blob';
import { parseExcelBuffer } from '@/lib/excel-parser';
import { computeTeamMetrics } from '@/lib/calculations';
import {
  readTeamsData,
  writeTeamsData,
  readChangeLog,
  writeChangeLog,
} from '@/lib/blob-store';
import type { TeamData } from '@/lib/types';

export const runtime    = 'nodejs';
export const maxDuration = 60; // Vercel Hobby max — prevents timeout on large files

const AUTH_COOKIE = 'ubt_auth_role';

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
  date:           string;
  timestamp:      string;
  filename:       string;
  teamsUpdated:   number;
  teamsChanged:   TeamDiff[];
  teamsUnchanged: number;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function isAdmin(req: NextRequest): boolean {
  const role = req.cookies.get(AUTH_COOKIE)?.value;
  if (role === 'admin') return true;
  return !!req.cookies.get('ubt_admin_auth')?.value;
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

function buildDiff(abbr: string, name: string, before: TeamSnapshot, after: TeamSnapshot): TeamDiff {
  return {
    abbr, name, before, after,
    gradeChanged: before.grade !== after.grade,
    tierChanged:  before.tier  !== after.tier,
    scoreChanged: before.score !== after.score,
  };
}

// ── Route ─────────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const headers = { 'Cache-Control': 'no-store' };

  if (!isAdmin(req)) {
    return NextResponse.json({ error: 'Unauthorized. Admin access required.' }, { status: 403, headers });
  }

  let blobUrl: string | undefined;

  try {
    const body = await req.json();
    blobUrl        = body.blobUrl  as string | undefined;
    const filename = body.filename as string | undefined;

    if (!blobUrl) {
      return NextResponse.json({ error: 'Missing blobUrl in request body.' }, { status: 400, headers });
    }

    const token    = process.env.BLOB_READ_WRITE_TOKEN ?? '';
    const safeName = (filename ?? blobUrl.split('/').pop() ?? 'upload.xlsx').replace(/[^a-zA-Z0-9._-]/g, '_');

    // ── Parallel reads: fetch Excel + load existing teams + load changelog ──
    const [fileRes, existingData, existing_log] = await Promise.all([
      fetch(blobUrl, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        cache: 'no-store',
      }),
      readTeamsData(),
      readChangeLog<ChangeLogEntry>(),
    ]);

    if (!fileRes.ok) {
      return NextResponse.json(
        { error: `Failed to fetch uploaded file from Blob (${fileRes.status}).` },
        { status: 500 }
      );
    }
    const arrayBuffer = await fileRes.arrayBuffer();

    // ── Build lookup maps ─────────────────────────────────────────────────
    const byAbbr: Record<string, TeamData> = {};
    const beforeSnapshots: Record<string, TeamSnapshot> = {};
    for (const t of Object.values(existingData) as TeamData[]) {
      if (t.abbr) {
        byAbbr[t.abbr.toUpperCase()] = t;
        beforeSnapshots[t.abbr.toUpperCase()] = snapshot(t);
      }
    }

    // ── Parse upload ───────────────────────────────────────────────────────
    const parsed = parseExcelBuffer(arrayBuffer);

    if (parsed.stats.teamsFound === 0) {
      return NextResponse.json({ error: 'No team data found in file.', warnings: parsed.warnings }, { status: 422 });
    }

    // ── Apply updates ──────────────────────────────────────────────────────
    const updatedTeams: string[] = [];
    const skippedTeams: string[] = [];

    for (const [abbr, pitchers] of Object.entries(parsed.pitchersByTeam)) {
      const team = byAbbr[abbr.toUpperCase()];
      if (!team) { skippedTeams.push(abbr); continue; }

      team.pitchers = pitchers.map((p) => {
        const existing = team.pitchers.find(ep => ep.name.toLowerCase() === p.name.toLowerCase());
        return { ...p, gameLog: p.gameLog.length > 0 ? p.gameLog : (existing?.gameLog ?? []) };
      });

      const starters = parsed.startersByTeam[abbr.toUpperCase()];
      if (starters?.length) team.starters = starters;

      const reliefIL = parsed.reliefILByTeam[abbr.toUpperCase()] ?? [];
      team.dl = reliefIL;

      team.metrics    = { ...team.metrics, ...computeTeamMetrics(pitchers, reliefIL.length) };
      team.cutoffDate = new Date().toISOString().split('T')[0];
      team.latestDate = new Date().toISOString().split('T')[0];

      updatedTeams.push(abbr);
    }

    // ── Compute diff ───────────────────────────────────────────────────────
    const diffs: TeamDiff[] = [];
    for (const abbr of updatedTeams) {
      const team = byAbbr[abbr.toUpperCase()];
      if (!team) continue;
      diffs.push(buildDiff(
        abbr,
        team.team ?? abbr,
        beforeSnapshots[abbr.toUpperCase()] ?? { grade: null, tier: null, score: null, era14d: null, whip14d: null, avgReliefIPPerGame: null },
        snapshot(team),
      ));
    }

    const changed   = diffs.filter(d => d.gradeChanged || d.tierChanged || d.scoreChanged);
    const unchanged = diffs.filter(d => !d.gradeChanged && !d.tierChanged && !d.scoreChanged);

    const entry: ChangeLogEntry = {
      date:           new Date().toISOString().split('T')[0],
      timestamp:      new Date().toISOString(),
      filename:       safeName,
      teamsUpdated:   updatedTeams.length,
      teamsChanged:   changed,
      teamsUnchanged: unchanged.length,
    };

    // ── Parallel writes: teams data + changelog ────────────────────────────
    await Promise.all([
      writeTeamsData(existingData),
      writeChangeLog([entry, ...existing_log].slice(0, 90)),
    ]);

    // ── Clean up the temporary upload blob (fire-and-forget) ──────────────
    if (blobUrl && token) {
      del(blobUrl, { token }).catch(() => {});
    }

    return NextResponse.json({
      success:      true,
      message:      `Data updated for ${updatedTeams.length} teams.`,
      updatedTeams, skippedTeams,
      warnings:     parsed.warnings,
      diff:         { changed, unchanged: unchanged.map(d => d.abbr) },
      stats: {
        ...parsed.stats,
        updatedTeams:   updatedTeams.length,
        skippedTeams:   skippedTeams.length,
        changedTeams:   changed.length,
        unchangedTeams: unchanged.length,
      },
    }, { headers });

  } catch (err: any) {
    console.error('[upload-data] Error:', err);
    const msg  = err?.message ?? String(err);
    const hint = !process.env.BLOB_READ_WRITE_TOKEN
      ? ' (BLOB_READ_WRITE_TOKEN env var is missing — connect the Blob store in Vercel dashboard and redeploy)'
      : '';
    return NextResponse.json({ error: `Upload failed: ${msg}${hint}` }, { status: 500, headers });
  }
}
