// ============================================================
// MLB Stats API Client — free, no auth required
// ============================================================

import type { LiveGameState, LivePitcher } from './types';

const MLB_BASE = 'https://statsapi.mlb.com/api';

export async function getTodaysGames() {
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' });
  const url   = `${MLB_BASE}/v1/schedule?sportId=1&date=${today}&gameType=R&hydrate=team`;
  const res   = await fetch(url, { next: { revalidate: 55 } });
  if (!res.ok) throw new Error(`MLB schedule ${res.status}`);
  const data  = await res.json();
  return (data.dates ?? []).flatMap((d: any) =>
    (d.games ?? []).map((g: any) => ({
      gamePk: g.gamePk as number,
      status: g.status?.abstractGameState as string,
    }))
  );
}

export async function getLiveGameState(gamePk: number): Promise<LiveGameState | null> {
  try {
    const res  = await fetch(`${MLB_BASE}/v1.1/game/${gamePk}/feed/live`, { next: { revalidate: 55 } });
    if (!res.ok) return null;
    const data = await res.json();
    const gd   = data.gameData;
    const ls   = data.liveData?.linescore;
    if (!gd || !ls) return null;

    const pitcher: LivePitcher | null = ls.defense?.pitcher
      ? { mlbId: ls.defense.pitcher.id, name: ls.defense.pitcher.fullName,
          teamName: ls.defense.team?.name ?? '', teamId: ls.defense.team?.id ?? 0 }
      : null;

    return {
      gamePk,
      status: gd.status?.abstractGameState as LiveGameState['status'],
      homeTeam: { id: gd.teams.home.id, name: gd.teams.home.name, abbreviation: gd.teams.home.abbreviation ?? '' },
      awayTeam: { id: gd.teams.away.id, name: gd.teams.away.name, abbreviation: gd.teams.away.abbreviation ?? '' },
      homeScore: ls.teams?.home?.runs ?? 0,
      awayScore: ls.teams?.away?.runs ?? 0,
      inning: ls.currentInning ?? 0,
      inningHalf: (ls.inningHalf ?? '') as LiveGameState['inningHalf'],
      currentPitcher: pitcher,
      lastUpdated: new Date().toISOString(),
    };
  } catch { return null; }
}

export async function getAllLiveGames(): Promise<LiveGameState[]> {
  const schedule  = await getTodaysGames();
  const liveGames = schedule.filter((g: any) => g.status === 'Live');
  if (!liveGames.length) return [];
  const results   = await Promise.allSettled(liveGames.map((g: any) => getLiveGameState(g.gamePk)));
  return results
    .filter((r): r is PromiseFulfilledResult<LiveGameState> => r.status === 'fulfilled' && r.value !== null)
    .map(r => r.value);
}
