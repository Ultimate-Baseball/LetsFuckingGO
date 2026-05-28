/**
 * POST /api/upload-data
 * ADMIN ONLY -- processes a pre-uploaded Excel file from Vercel Blob storage.
 *
 * UPLOAD FLOW (two-step to bypass Vercel's 4.5 MB function body limit):
 *   1. Browser uploads the Excel file directly to Vercel Blob via /api/upload-token
 *      (no bytes go through a Next.js function body).
 *   2. Browser calls this endpoint with ?blobUrl=<url>&filename=<name> -- tiny request.
 *   3. This function fetches the file from the blob URL, processes it, writes results,
 *      then deletes the temp upload blob.
 *
 * SPEED OPTIMIZATIONS (Vercel Pro -- 60s function budget):
 *
 *  1. We do NOT read the existing teams blob (1.25MB) before writing.
 *     Instead, the bundled `mlb-teams.json` (ships with every deploy) is
 *     used as the structural template.  The Excel is always the source of
 *     truth for pitcher data, so no merge is needed.
 *
 *  2. Diffs use a tiny `ubt/prev-metrics.json` blob (~3KB) written after
 *     each successful upload, rather than comparing against the full dataset.
 *
 *  3. All reads are parallel; all writes are parallel.
 *
 *  4. sheetRows: 210 in excel-parser limits XLSX.read() to the rows we need,
 *     cutting parse time ~4-5x for large files.
 *
 *  5. Game logs are trimmed to 28 days before writing to keep the teams blob
 *     compact (~400KB vs ~2MB).
 */

import { NextRequest, NextResponse } from 'next/server';
import { del } from '@vercel/blob';
import { parseExcelBuffer } from '@/lib/excel-parser';
import { computeTeamMetrics } from '@/lib/calculations';
import {
  writeBlobJson,
  readBlobJson,
  BLOB_TEAMS_PATH,
  BLOB_CHANGELOG_PATH,
} from '@/lib/blob-store';
import mlbTeamsTemplate from '@/data/mlb-teams.json';
import type { TeamData } from '@/lib/types';

export const runtime     = 'nodejs';
export const maxDuration = 60; // Vercel Pro -- enforces the 60s limit (Hobby hard-caps at 10s)

const AUTH_COOKIE        = 'ubt_auth_role';
const BLOB_PREV_METRICS  = 'ubt/prev-metrics.json';

// -- Types ---------------------------------------------------------------------

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

type PrevMetricsMap = Record<string, TeamSnapshot>;

// -- Helpers -------------------------------------------------------------------

function isAdmin(req: NextRequest): boolean {
  const role = req.cookies.get(AUTH_COOKIE)?.value;
  if (role === 'admin') return true;
  return !!req.cookies.get('ubt_admin_auth')?.value;
}

function snapshot(metrics: Record<string, any>): TeamSnapshot {
  return {
    grade:              metrics.letterGrade              ?? null,
    tier:               metrics.healthTier               ?? null,
    score:              metrics.compositeScore            ?? null,
    era14d:             metrics.era14d                   ?? null,
    whip14d:            metrics.whip14d                  ?? null,
    avgReliefIPPerGame: metrics.avgReliefIPPerGame       ?? null,
  };
}

function buildDiff(
  abbr: string, name: string,
  before: TeamSnapshot, after: TeamSnapshot,
): TeamDiff {
  return {
    abbr, name, before, after,
    gradeChanged: before.grade !== after.grade,
    tierChanged:  before.tier  !== after.tier,
    scoreChanged: before.score !== after.score,
  };
}

// -- Route ---------------------------------------------------------------------

export async function POST(req: NextRequest) {
  const headers = { 'Cache-Control': 'no-store' };

  if (!isAdmin(req)) {
    return NextResponse.json({ error: 'Unauthorized. Admin access required.' }, { status: 403, headers });
  }

  try {
    // -- Fetch the Excel file from Vercel Blob (uploaded directly by the browser) --
    // The browser uploaded via /api/upload-token to bypass Vercel's 4.5MB body limit.
    const blobUrl  = req.nextUrl.searchParams.get('blobUrl');
    const filename = req.nextUrl.searchParams.get('filename') ?? 'upload.xlsx';
    const safeName = filename.replace(/[^a-zA-Z0-9._-]/g, '_');

    if (!blobUrl) {
      return NextResponse.json({ error: 'Missing blobUrl parameter.' }, { status: 400, headers });
    }

    const fileRes = await fetch(blobUrl, { cache: 'no-store' });
    if (!fileRes.ok) {
      return NextResponse.json(
        { error: `Failed to fetch uploaded file from blob storage (HTTP ${fileRes.status}).` },
        { status: 400, headers }
      );
    }
    const arrayBuffer = await fileRes.arrayBuffer();

    if (!arrayBuffer || arrayBuffer.byteLength === 0) {
      return NextResponse.json({ error: 'Empty file received from blob storage.' }, { status: 400, headers });
    }

    // -- Parallel reads: prev-metrics + changelog ---------------------------
    // We deliberately do NOT read the 1.25MB teams blob -- we use the bundled
    // mlb-teams.json as a structural template instead (saves 2-4 seconds).
    const [prevMetrics, existingLog] = await Promise.all([
      readBlobJson<PrevMetricsMap>(BLOB_PREV_METRICS),        // ~3 KB
      readBlobJson<ChangeLogEntry[]>(BLOB_CHANGELOG_PATH),    // ~50 KB
    ]);

    // -- Build lookup from bundled template (no Blob read needed) ----------
    const templateData  = mlbTeamsTemplate as Record<string, any>;
    const byAbbr: Record<string, TeamData> = {};
    for (const t of Object.values(templateData) as TeamData[]) {
      if (t.abbr) byAbbr[t.abbr.toUpperCase()] = JSON.parse(JSON.stringify(t)); // deep-clone
    }

    // -- Parse upload -------------------------------------------------------
    const parsed = parseExcelBuffer(arrayBuffer);

    if (parsed.stats.teamsFound === 0) {
      return NextResponse.json(
        { error: 'No team data found in file.', warnings: parsed.warnings },
        { status: 422 }
      );
    }

    // -- Apply updates from Excel onto template -----------------------------
    const updatedTeams: string[] = [];
    const skippedTeams: string[] = [];
    const newMetrics:   PrevMetricsMap = {};

    for (const [abbr, pitchers] of Object.entries(parsed.pitchersByTeam)) {
      const team = byAbbr[abbr.toUpperCase()];
      if (!team) { skippedTeams.push(abbr); continue; }

      team.pitchers = pitchers; // Excel is the source of truth for pitcher data

      const starters = parsed.startersByTeam[abbr.toUpperCase()];
      if (starters?.length) team.starters = starters;

      const reliefIL = parsed.reliefILByTeam[abbr.toUpperCase()] ?? [];
      team.dl = reliefIL;

      team.metrics    = { ...team.metrics, ...computeTeamMetrics(pitchers, reliefIL.length) };
      team.cutoffDate = new Date().toISOString().split('T')[0];
      team.latestDate = new Date().toISOString().split('T')[0];

      updatedTeams.push(abbr);
      newMetrics[abbr.toUpperCase()] = snapshot(team.metrics as Record<string, any>);
    }

    // -- Compute diff against prev-metrics (tiny, <4KB) --------------------
    const nullSnap: TeamSnapshot = { grade: null, tier: null, score: null, era14d: null, whip14d: null, avgReliefIPPerGame: null };
    const diffs: TeamDiff[] = updatedTeams.map(abbr => {
      const team   = byAbbr[abbr.toUpperCase()];
      const before = prevMetrics?.[abbr.toUpperCase()] ?? nullSnap;
      const after  = newMetrics[abbr.toUpperCase()] ?? nullSnap;
      return buildDiff(abbr, team?.team ?? abbr, before, after);
    });

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

    const newLog = [entry, ...(existingLog ?? [])].slice(0, 90);

    // -- Trim game logs to 28 days before writing to blob -------------------------
    // Metrics are already computed above; trimming here keeps the teams blob
    // compact (~400KB vs ~2MB) so the Vercel function finishes well inside 60s.
    const trimDate = new Date();
    trimDate.setDate(trimDate.getDate() - 28);
    const trimStr  = trimDate.toISOString().split('T')[0];
    for (const team of Object.values(byAbbr)) {
      if (Array.isArray((team as any).pitchers)) {
        (team as any).pitchers = (team as any).pitchers.map((p: any) => ({
          ...p,
          gameLog: Array.isArray(p.gameLog)
            ? p.gameLog.filter((g: any) => g.date >= trimStr)
            : [],
        }));
      }
      if (Array.isArray((team as any).starters)) {
        (team as any).starters = (team as any).starters.map((s: any) => ({
          ...s,
          gameLogs: Array.isArray(s.gameLogs)
            ? s.gameLogs.filter((g: any) => g.date >= trimStr)
            : [],
        }));
      }
    }

    // -- Reconstruct full data with original key structure + updated team objects --
    // templateData keys are full team names ("Baltimore Orioles"), byAbbr keys are "BAL".
    // We need to write the modified byAbbr objects back under their original keys.
    const updatedTeamsData: Record<string, any> = {};
    for (const [teamName, team] of Object.entries(templateData)) {
      const abbr = (team as any).abbr?.toUpperCase();
      updatedTeamsData[teamName] = (abbr && byAbbr[abbr]) ? byAbbr[abbr] : team;
    }

    // -- Parallel writes -- with 40s timeout so we fail fast rather than hitting
    //    the 60s function limit silently if Blob is slow ---------------------
    const writeDeadline = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('Blob write timed out after 40s')), 40_000)
    );
    await Promise.race([
      Promise.all([
        writeBlobJson(BLOB_TEAMS_PATH,     updatedTeamsData),  // full updated dataset
        writeBlobJson(BLOB_CHANGELOG_PATH, newLog),
        writeBlobJson(BLOB_PREV_METRICS,   newMetrics),         // tiny snapshot for next diff
      ]),
      writeDeadline,
    ]);

    // -- Clean up temp upload blob (fire-and-forget) ---------------------------
    // Processing is done; delete the raw Excel from blob storage.
    // Don't await -- cleanup failure must not affect the response.
    del(blobUrl, { token: process.env.BLOB_READ_WRITE_TOKEN ?? '' }).catch(e =>
      console.warn('[upload-data] Temp blob cleanup failed:', e?.message)
    );

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
      ? ' (BLOB_READ_WRITE_TOKEN env var is missing)'
      : '';
    return NextResponse.json({ error: `Upload failed: ${msg}${hint}` }, { status: 500, headers });
  }
}
