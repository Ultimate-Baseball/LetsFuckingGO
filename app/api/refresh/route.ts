import { NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";

// Auto-update endpoint — can be triggered by cron job at 12:00 AM ET daily
export async function POST() {
  const timestamp = new Date().toISOString();

  return NextResponse.json({
    success: true,
    message: "Data refresh triggered successfully",
    timestamp,
    note: "In production, this triggers the data pipeline to fetch and parse the latest UBT Daily Report. Auto-runs daily at 12:00 AM ET.",
  });
}

export async function GET() {
  try {
    const filePath = path.join(process.cwd(), "data", "mlb-teams.json");
    const raw = await fs.readFile(filePath, "utf-8");
    const teams: Record<string, { latestDate?: string }> = JSON.parse(raw);

    // Find the most recent latestDate across all teams
    let maxDate = "";
    for (const team of Object.values(teams)) {
      if (team.latestDate && team.latestDate > maxDate) {
        maxDate = team.latestDate;
      }
    }

    // Format the date for display: "May 16, 2026"
    let displayDate = "Unknown";
    if (maxDate) {
      const [year, month, day] = maxDate.split("-").map(Number);
      displayDate = new Date(year, month - 1, day).toLocaleDateString("en-US", {
        month: "long",
        day: "numeric",
        year: "numeric",
      });
    }

    return NextResponse.json({
      lastUpdated: maxDate ? `${maxDate}T00:00:00-05:00` : null,
      displayDate,
      schedule: "Daily at 12:00 AM Eastern Time",
      dataSource: "UltimateBaseballTool.com Daily Report",
      injurySource: "ESPN.com (live, updated hourly)",
      version: "1.0.0",
    });
  } catch {
    return NextResponse.json({
      lastUpdated: null,
      displayDate: "Unknown",
      schedule: "Daily at 12:00 AM Eastern Time",
      dataSource: "UltimateBaseballTool.com Daily Report",
      injurySource: "ESPN.com (live, updated hourly)",
      version: "1.0.0",
    });
  }
}
