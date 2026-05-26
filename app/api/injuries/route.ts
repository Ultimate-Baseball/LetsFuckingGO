import { NextResponse } from "next/server";

interface ESPNInjury {
  player: string;
  status: string;
  description: string;
  type: string;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const teamId = searchParams.get("team");

  if (!teamId) {
    return NextResponse.json({ error: "Team ID required" }, { status: 400 });
  }

  try {
    // ESPN public API for team injuries
    const res = await fetch(
      `https://site.web.api.espn.com/apis/v2/sports/baseball/mlb/injuries?team=${teamId}`,
      {
        headers: {
          "Accept": "application/json",
          "User-Agent": "Mozilla/5.0 (compatible; MLBBullpenTracker/1.0)",
        },
        next: { revalidate: 3600 }, // Cache for 1 hour
      }
    );

    if (!res.ok) {
      // Try alternative ESPN endpoint
      const altRes = await fetch(
        `https://sports.core.api.espn.com/v2/sports/baseball/leagues/mlb/teams/${getESPNTeamId(teamId)}/injuries?limit=40`,
        { next: { revalidate: 3600 } }
      );

      if (!altRes.ok) {
        return NextResponse.json({ injuries: [], source: "no-data" });
      }

      const altData = await altRes.json();
      return NextResponse.json({
        injuries: parseESPNInjuries(altData),
        source: "espn-core",
      });
    }

    const data = await res.json();
    return NextResponse.json({
      injuries: parseESPNInjuries(data),
      source: "espn-web",
    });
  } catch (error) {
    // Return empty rather than error to not break the UI
    return NextResponse.json({ injuries: [], source: "error", message: String(error) });
  }
}

function parseESPNInjuries(data: any): ESPNInjury[] {
  try {
    const injuries: ESPNInjury[] = [];

    // Handle different ESPN API response formats
    const items = data?.injuries || data?.items || data?.athletes || [];

    for (const item of items) {
      const athlete = item?.athlete || item;
      const status = item?.status || item?.type?.description || "";
      const desc = item?.detail || item?.injuries?.[0]?.details?.detail || item?.shortComment || "";

      if (athlete?.displayName) {
        injuries.push({
          player: athlete.displayName,
          status: status,
          description: desc,
          type: item?.type?.displayName || item?.type || "Injury",
        });
      }
    }

    return injuries;
  } catch {
    return [];
  }
}

// ESPN team ID mapping
function getESPNTeamId(abbr: string): string {
  const map: Record<string, string> = {
    oak: "9", bal: "1", bos: "2", chw: "4", cle: "5",
    det: "6", hou: "18", kc: "7", laa: "3", min: "9",
    nyy: "10", sea: "12", tb: "30", tex: "13", tor: "14",
    ari: "29", atl: "15", chc: "16", cin: "17", col: "27",
    lad: "19", mia: "28", mil: "8", nym: "21", phi: "22",
    pit: "23", sd: "25", sf: "26", stl: "24", wsh: "20",
  };
  return map[abbr.toLowerCase()] || "1";
}
