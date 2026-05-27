/**
 * Vercel Blob helpers — persistent storage for UBT data files.
 *
 * The serverless filesystem at process.cwd() is READ-ONLY on Vercel.
 * All writes go through Blob; reads check Blob first, fall back to
 * the bundled data/*.json snapshots that ship with each deployment.
 *
 * Required env var: BLOB_READ_WRITE_TOKEN (auto-set when you connect
 * a Blob store to this project in Vercel Dashboard → Storage).
 */

import { put, head } from '@vercel/blob';
import mlbTeamsFallback  from '@/data/mlb-teams.json';
import changeLogFallback from '@/data/change-log.json';

// ─── Blob pathnames (stable, no random suffix) ────────────────────────────────
export const BLOB_TEAMS_PATH     = 'ubt/mlb-teams.json';
export const BLOB_CHANGELOG_PATH = 'ubt/change-log.json';
export const BLOB_MONITOR_STATE  = 'ubt/monitor-state.json';
export const BLOB_ALERTS_TODAY   = 'ubt/alerts-today.json';

// ─── Low-level helpers ────────────────────────────────────────────────────────

/** Write any JSON object to Blob under a stable pathname. Uses compact JSON to minimize upload size. */
export async function writeBlobJson(pathname: string, data: unknown): Promise<void> {
  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (!token) {
    throw new Error(
      'BLOB_READ_WRITE_TOKEN is not set. Connect the Blob store in Vercel Dashboard → Storage and redeploy.'
    );
  }
  // Compact JSON (no indent) reduces payload size and speeds up Blob writes
  const json = JSON.stringify(data);
  await put(pathname, json, {
    access:          'public',
    addRandomSuffix: false,
    contentType:     'application/json',
    token,
  });
}

/**
 * Read JSON from Blob by pathname.
 * Uses head() for a direct single-blob lookup — much faster than list()
 * which scans the entire store. Returns null if the blob doesn't exist yet.
 */
export async function readBlobJson<T>(pathname: string): Promise<T | null> {
  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (!token) return null;

  try {
    // head() does a direct lookup by pathname — O(1) vs list()'s O(n) prefix scan
    const blobMeta = await head(pathname, { token });
    const res = await fetch(blobMeta.url, {
      headers: { Authorization: `Bearer ${token}` },
      cache:   'no-store',
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    // BlobNotFoundError when blob doesn't exist yet — return null (use fallback)
    return null;
  }
}

// ─── Domain helpers ───────────────────────────────────────────────────────────

/** Load teams data — Blob first, bundled JSON as fallback. */
export async function readTeamsData(): Promise<Record<string, any>> {
  const blob = await readBlobJson<Record<string, any>>(BLOB_TEAMS_PATH);
  if (blob) return blob;
  return mlbTeamsFallback as unknown as Record<string, any>;
}

/** Persist updated teams data to Blob. */
export async function writeTeamsData(data: Record<string, any>): Promise<void> {
  await writeBlobJson(BLOB_TEAMS_PATH, data);
}

/** Load change log — Blob first, bundled JSON as fallback. */
export async function readChangeLog<T = unknown>(): Promise<T[]> {
  const blob = await readBlobJson<T[]>(BLOB_CHANGELOG_PATH);
  if (blob) return blob;
  // Fall back to the bundled change-log.json that ships with the deployment
  return changeLogFallback as unknown as T[];
}

/** Persist updated change log to Blob. */
export async function writeChangeLog(log: unknown[]): Promise<void> {
  await writeBlobJson(BLOB_CHANGELOG_PATH, log);
}
