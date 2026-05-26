"use client";

import { useState } from "react";
import { Header } from "@/components/header";
import { GradeBadge } from "@/components/grade-badge";
import { HealthBadge } from "@/components/health-badge";
import { TEAMS } from "@/lib/mlb-data";
import Link from "next/link";
import { cn, eraTextColor as eraColorFn, whipTextColor as whipColorFn } from "@/lib/utils";
import { BarChart3, TrendingUp, TrendingDown, Trophy } from "lucide-react";
import type { LetterGrade } from "@/lib/types";
import { computeCompositeScore, compositeRank } from "@/lib/calculations";

const GRADE_ORDER: Record<string, number> = { A: 0, B: 1, C: 2, D: 3, F: 4 };
const HEALTH_ORDER: Record<string, number> = { veryLow: 0, low: 1, moderate: 2, high: 3, veryHigh: 4 };

type SortKey = "composite" | "grade" | "era14d" | "whip14d" | "avgGP14d" | "team" | "health" | "dlCount";

// Letter color map for composite rank labels
const COMP_RANK_COLOR: Record<string, string> = {
  "A+": "text-emerald-300 bg-emerald-500/20 border-emerald-400/40",
  "A":  "text-emerald-400 bg-emerald-500/15 border-emerald-400/30",
  "B+": "text-cyan-300 bg-cyan-500/20 border-cyan-400/40",
  "B":  "text-cyan-400 bg-cyan-500/15 border-cyan-400/30",
  "C+": "text-amber-300 bg-amber-500/20 border-amber-400/40",
  "C":  "text-amber-400 bg-amber-500/15 border-amber-400/30",
  "D":  "text-orange-400 bg-orange-500/15 border-orange-400/30",
  "F":  "text-red-400 bg-red-500/15 border-red-400/30",
};

export default function StandingsPage() {
  const [sortKey, setSortKey] = useState<SortKey>("composite");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [leagueFilter, setLeagueFilter] = useState<"All" | "AL" | "NL">("All");

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      // Composite, ERA, WHIP default desc (higher = better for composite; lower = better for ERA/WHIP)
      setSortDir(key === "team" ? "asc" : key === "composite" ? "desc" : "asc");
    }
  };

  const teamsWithComposite = TEAMS.map((t) => ({
    ...t,
    _composite: t.metrics.compositeScore ?? computeCompositeScore(t.metrics.letterGrade, t.metrics.healthTier),
    _compRank: compositeRank(t.metrics.compositeScore ?? computeCompositeScore(t.metrics.letterGrade, t.metrics.healthTier)),
  }));

  const sorted = [...teamsWithComposite]
    .filter((t) => leagueFilter === "All" || t.division.startsWith(leagueFilter))
    .sort((a, b) => {
      let aVal: any, bVal: any;
      switch (sortKey) {
        case "composite": aVal = a._composite; bVal = b._composite; break;
        case "grade":  aVal = GRADE_ORDER[a.metrics.letterGrade]; bVal = GRADE_ORDER[b.metrics.letterGrade]; break;
        case "health": aVal = HEALTH_ORDER[a.metrics.healthTier]; bVal = HEALTH_ORDER[b.metrics.healthTier]; break;
        case "era14d": aVal = a.metrics.era14d ?? 99; bVal = b.metrics.era14d ?? 99; break;
        case "whip14d": aVal = a.metrics.whip14d ?? 99; bVal = b.metrics.whip14d ?? 99; break;
        case "avgGP14d": aVal = a.metrics.avgReliefIPPerGame ?? a.metrics.avgGP14d; bVal = b.metrics.avgReliefIPPerGame ?? b.metrics.avgGP14d; break;
        case "team":   aVal = a.team; bVal = b.team; break;
        case "dlCount": aVal = a.metrics.dlCount; bVal = b.metrics.dlCount; break;
        default:       aVal = 0; bVal = 0;
      }
      if (typeof aVal === "string")
        return sortDir === "asc" ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
      return sortDir === "asc" ? aVal - bVal : bVal - aVal;
    });

  const SortBtn = ({ col, label, title }: { col: SortKey; label: string; title?: string }) => (
    <th
      onClick={() => handleSort(col)}
      title={title}
      className="px-3 py-3 text-center text-xs font-medium text-muted-foreground cursor-pointer hover:text-foreground transition-colors select-none whitespace-nowrap"
    >
      <span className="flex items-center justify-center gap-1">
        {label}
        {sortKey === col && (sortDir === "asc" ? " ↑" : " ↓")}
      </span>
    </th>
  );

  // Grade distribution
  const gradeGroups: Record<string, typeof TEAMS> = {};
  sorted.forEach((t) => {
    const g = t.metrics.letterGrade;
    if (!gradeGroups[g]) gradeGroups[g] = [];
    gradeGroups[g].push(t);
  });

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6">
        {/* Page Header */}
        <div className="flex items-center gap-2 mb-2">
          <BarChart3 className="w-5 h-5 text-primary" />
          <div>
            <h1 className="text-2xl font-black text-foreground">Bullpen Standings</h1>
            <p className="text-muted-foreground text-sm">
              All 30 teams ranked by bullpen health and effectiveness
            </p>
          </div>
        </div>



        {/* League Filter */}
        <div className="flex gap-2 mb-4">
          {(["All", "AL", "NL"] as const).map((l) => (
            <button
              key={l}
              onClick={() => setLeagueFilter(l)}
              className={cn(
                "px-4 py-1.5 rounded-lg text-sm font-medium border transition-colors",
                leagueFilter === l
                  ? "bg-primary/20 text-primary border-primary/40"
                  : "text-muted-foreground border-border/50 hover:text-foreground"
              )}
            >
              {l === "All" ? "All 30 Teams" : l === "AL" ? "American League" : "National League"}
            </button>
          ))}
        </div>

        {/* Rankings Table */}
        <div className="bg-card border border-border/50 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border/50 bg-muted/30">
                  <th className="px-3 py-3 text-left text-xs font-medium text-muted-foreground w-10">#</th>
                  <SortBtn col="team" label="Team" />
                  <th className="px-3 py-3 text-center text-xs font-medium text-muted-foreground">Division</th>
                  <SortBtn
                    col="composite"
                    label="Overall ★"
                    title="Composite: 50% Effectiveness Grade + 50% Health Tier (0–100)"
                  />
                  <SortBtn col="grade" label="Grade" />
                  <SortBtn col="health" label="Health" />
                  <SortBtn col="era14d" label="ERA (14d)" />
                  <SortBtn col="whip14d" label="WHIP (14d)" />
                  <SortBtn col="avgGP14d" label="Rel IP/G" />
                  <SortBtn col="dlCount" label="IL" />
                  <th className="px-3 py-3 text-center text-xs font-medium text-muted-foreground">Trend</th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((team, idx) => {
                  const trend = team.trend;
                  const trendDir =
                    trend.length >= 2
                      ? trend[trend.length - 1].era < trend[trend.length - 2].era
                        ? "up"
                        : "down"
                      : null;
                  const era14d = team.metrics.era14d;
                  const whip14d = team.metrics.whip14d;
                  const compRank = team._compRank;

                  return (
                    <tr
                      key={team.abbr}
                      className="border-b border-border/30 hover:bg-muted/20 transition-colors"
                    >
                      <td className="px-3 py-2.5 text-sm text-muted-foreground font-bold w-10">
                        {idx + 1}
                      </td>
                      <td className="px-3 py-2.5">
                        <Link
                          href={`/team/${team.abbr.toLowerCase()}`}
                          className="hover:text-primary transition-colors"
                        >
                          <div className="font-bold text-foreground text-sm">{team.team}</div>
                          <div className="text-xs text-muted-foreground">{team.abbr}</div>
                        </Link>
                      </td>
                      <td className="px-3 py-2.5 text-center text-xs text-muted-foreground whitespace-nowrap">
                        {team.division}
                      </td>

                      {/* Composite Score */}
                      <td className="px-3 py-2.5 text-center">
                        <div className="flex flex-col items-center gap-0.5">
                          <span
                            className={cn(
                              "inline-flex items-center px-2 py-0.5 rounded-md border text-xs font-bold",
                              COMP_RANK_COLOR[compRank] ?? "text-muted-foreground border-border/50"
                            )}
                          >
                            {compRank}
                          </span>
                          <span className="text-[10px] text-muted-foreground font-mono">
                            {team._composite}
                          </span>
                        </div>
                      </td>

                      <td className="px-3 py-2.5 text-center">
                        <GradeBadge grade={team.metrics.letterGrade} size="sm" />
                      </td>
                      <td className="px-3 py-2.5 text-center">
                        <HealthBadge tier={team.metrics.healthTier} size="sm" />
                      </td>
                      <td
                        className={cn(
                          "px-3 py-2.5 text-center font-mono text-sm font-bold",
                          eraColorFn(era14d)
                        )}
                      >
                        {era14d?.toFixed(2) ?? "—"}
                      </td>
                      <td
                        className={cn(
                          "px-3 py-2.5 text-center font-mono text-sm font-bold",
                          whipColorFn(whip14d)
                        )}
                      >
                        {whip14d?.toFixed(2) ?? "—"}
                      </td>
                      <td className="px-3 py-2.5 text-center text-sm text-foreground font-medium">
                        {(team.metrics.avgReliefIPPerGame ?? team.metrics.avgGP14d).toFixed(1)}
                      </td>
                      <td className="px-3 py-2.5 text-center text-sm">
                        {team.metrics.dlCount > 0 ? (
                          <span className="text-orange-400 font-bold">{team.metrics.dlCount}</span>
                        ) : (
                          <span className="text-emerald-400">0</span>
                        )}
                      </td>
                      <td className="px-3 py-2.5 text-center">
                        {trendDir === "up" ? (
                          <TrendingUp className="w-4 h-4 text-emerald-400 mx-auto" />
                        ) : trendDir === "down" ? (
                          <TrendingDown className="w-4 h-4 text-red-400 mx-auto" />
                        ) : (
                          <span className="text-muted-foreground text-xs">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Grade Group Summary */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mt-6">
          {(["A", "B", "C", "D", "F"] as LetterGrade[]).map((grade) => {
            const teams = gradeGroups[grade] || [];
            return (
              <div key={grade} className="bg-card border border-border/50 rounded-xl p-3">
                <div className="flex items-center gap-2 mb-2">
                  <GradeBadge grade={grade} size="sm" />
                  <span className="text-sm font-bold text-foreground">{teams.length} teams</span>
                </div>
                <div className="space-y-0.5">
                  {teams.map((t) => (
                    <Link
                      key={t.abbr}
                      href={`/team/${t.abbr.toLowerCase()}`}
                      className="block text-xs text-muted-foreground hover:text-primary transition-colors"
                    >
                      {t.abbr}
                    </Link>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
