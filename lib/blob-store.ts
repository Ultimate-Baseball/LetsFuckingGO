/**
 * Vercel Blob helpers — persistent storage for UBT data files.
 *
 * The serverless filesystem at process.cwd() is READ-ONLY on Vercel.
 * All writes go through Blob; reads check Blob first, fall back to
 * the bundled data/mlb-teams.json that ships with each deployment.
 *
 * Required env var: BLOB_READ_WRITE_TOKEN (auto-set when you connect
 * a Blob store to this project in Vercel Dashboard → Storage).
 */

import { put, list } from '@vercel/blob';
import mlbTeamsFallback from '@/data/mlb-teams.json';

// ─── Blob pathnames (stable, no random suffix) ────────────────────────────────
export const BLOB_TEAMS_PATH     = 'ubt/mlb-teams.json';
export const BLOB_CHANGELOG_PATH = 'ubt/change-log.json';
export const BLOB_MONITOR_STATE  = 'ubt/monitor-state.json';
export const BLOB_ALERTS_TODAY   = 'ubt/alerts-today.json';

// ─── Low-level helpers ────────────────────────────────────────────────────────

/** Write any JSON object to Blob under a stable pathname. */
export async function writeBlobJson(pathname: string, data: unknown): Promise<void> {
  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (!token) throw new Error('BLOB_READ_WRITE_TOKEN is not set. Connect the Blob store in Vercel Dashboard → Storage and redeploy.');

  const json = JSON.stringify(data, null, 2);
  await put(pathname, json, {
    access:          'public',
    addRandomSuffix: false,
    contentType:     'application/json',
    token,
  });
}

/**
 * Read JSON from Blob by pathname.
 * Uses list() to look up the URL, then fetches with the token
 * (handles both public and private stores).
 * Returns null if the blob doesn't exist yet.
 */
export async function readBlobJson<T>(pathname: string): Promise<T | null> {
  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (!token) return null;

  try {
    const { blobs } = await list({ prefix: pathname, token });
    const blob = blobs.find(b => b.pathname === pathname);
    if (!blob) return null;

    // Include token in Authorization header for private stores
    const res = await fetch(blob.url, {
      headers: { Authorization: `Bearer ${token}` },
      cache:   'no-store',
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

// ─── Domain helpers ───────────────────────────────────────────────────────────

/** Load teams data — Blob first, bundled JSON as fallback. */
export async function readTeamsData(): Promise<Record<string, any>> {
  const blob = await readBlobJson<Record<string, any>>(BLOB_TEAMS_PATH);
  if (blob) return blob;
  // Fallback to the bundled snapshot that ships with each deployment
  return mlbTeamsFallback as unknown as Record<string, any>;
}

/** Persist updated teams data to Blob. */
export async function writeTeamsData(data: Record<string, any>): Promise<void> {
  await writeBlobJson(BLOB_TEAMS_PATH, data);
}

/** Load change log — Blob first, empty array as fallback. */
export async function readChangeLog<T = unknown>(): Promise<T[]> {
  return (await readBlobJson<T[]>(BLOB_CHANGELOG_PATH)) ?? [];
}

/** Persist updated change log to Blob. */
export async function writeChangeLog(log: unknown[]): Promise<void> {
  await writeBlobJson(BLOB_CHANGELOG_PATH, log);
}
