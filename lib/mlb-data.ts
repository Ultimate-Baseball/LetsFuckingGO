import type { TeamData } from "@/lib/types";
import mlbTeamsRaw from "@/data/mlb-teams.json";

// JSON is keyed by team name; build an abbreviation-indexed lookup
const mlbTeamsByName = mlbTeamsRaw as unknown as Record<string, TeamData>;
const mlbTeams: Record<string, TeamData> = {};
for (const team of Object.values(mlbTeamsByName)) {
  if (team.abbr) mlbTeams[team.abbr.toUpperCase()] = team;
}

export const MLB_DATA = mlbTeams;
export const TEAMS: TeamData[] = Object.values(MLB_DATA);
export function getTeam(abbr: string): TeamData | undefined {
  if (!abbr) return undefined;
  return MLB_DATA[abbr.toUpperCase()];
}
