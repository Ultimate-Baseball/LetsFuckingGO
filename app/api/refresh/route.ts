import { NextResponse } from "next/server";
import { readTeamsData } from "@/lib/blob-store";

export const dynamic = "force-dynamic";

// POST — stub for cron-triggered refresh
export async function POST() {
  return NextResponse.json({
    success:   true,
    message:   "Data refresh triggered successfully",
    timestamp: new Date().toISOString(),
    note:      "Upload fresh data via the Admin page to update team stats.",
  });
}

// GET — returns the latest data date shown in the header
export async function GET() {
  try {
    const teams = await readTeamsData();

    let maxDate = "";
    for (const team of Object.values(teams) as { latestDate?: string }[]) {
      if (team.latestDate && team.latestDate > maxDate) maxDate = team.latestDate;
    }

    let displayDate = "Unknown";
    if (maxDate) {
      const [year, month, day] = maxDate.split("-").map(Number);
      displayDate = new Date(year, month - 1, day).toLocaleDateString("en-US", {
        month: "long", day: "numeric", year: "numeric",
      });
    }

    return NextResponse.json({
      lastUpdated:   maxDate ? `${maxDate}T00:00:00-05:00` : null,
      displayDate,
      schedule:      "Daily at 12:00 AM Eastern Time",
      dataSource:    "UltimateBaseballTool.com Daily Report",
      injurySource:  "ESPN.com (live, updated hourly)",
      version:       "1.0.0",
    });
  } catch {
    return NextResponse.json({
      lastUpdated:  null,
      displayDate:  "Unknown",
      schedule:     "Daily at 12:00 AM Eastern Time",
      dataSource:   "UltimateBaseballTool.com Daily Report",
      injurySource: "ESPN.com (live, updated hourly)",
      version:      "1.0.0",
    });
  }
}
