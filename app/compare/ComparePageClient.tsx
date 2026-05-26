"use client";


import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { Header } from "@/components/header";
import { TeamCard } from "@/components/team-card";
import { GradeBadge } from "@/components/grade-badge";
import { HealthBadge, HealthBar } from "@/components/health-badge";
import { PitcherTable } from "@/components/pitcher-table";
import { TrendChart } from "@/components/trend-chart";
import { TEAMS } from "@/lib/mlb-data";
import { cn } from "@/lib/utils";
import { X, GitCompare, ChevronDown, AlertCircle, ArrowRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import type { TeamData } from "@/lib/types";

const DIVISIONS = ["All", "AL East", "AL Central", "AL West", "NL East", "NL Central", "NL West"];

function TeamSelector({ onSelect, selected }: { onSelect: (team: TeamData) => void; selected: TeamData[] }) {
  const [divFilter, setDivFilter] = useState("All");
  const [search, setSearch] = useState("");

  const filtered = TEAMS.filter((t) => {
    const notSelected = !selected.find((s) => s.abbr === t.abbr);
    const matchSearch = t.team.toLowerCase().includes(search.toLowerCase()) || t.abbr.toLowerCase().includes(search.toLowerCase());
    const matchDiv = divFilter === "All" || t.division === divFilter;
    return notSelected && matchSearch && matchDiv;
  });

  return (
    <div className="space-y-3">
      <div className="flex gap-2 flex-wrap">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search teams..."
          className="flex-1 min-w-[120px] bg-muted/50 border border-border/50 rounded-lg px-3 py-1.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
        />
        <select
          value={divFilter}
          onChange={(e) => setDivFilter(e.target.value)}
          className="bg-muted/50 border border-border/50 rounded-lg px-2 py-1.5 text-sm text-foreground"
        >
          {DIVISIONS.map((d) => <option key={d} value={d}>{d}</option>)}
        </select>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-64 overflow-y-auto pr-1">
        {filtered.map((team) => (
          <button
            key={team.abbr}
            onClick={() => onSelect(team)}
            className={cn(
              "flex items-center gap-2 p-2 rounded-lg border border-border/50 hover:border-primary/40 hover:bg-primary/5 transition-colors text-left",
              team.metrics.healthTier === "veryLow" && "border-l-2 border-l-emerald-500/50",
              team.metrics.healthTier === "low" && "border-l-2 border-l-green-500/50",
              team.metrics.healthTier === "moderate" && "border-l-2 border-l-amber-500/50",
              team.metrics.healthTier === "high" && "border-l-2 border-l-orange-500/50",
              team.metrics.healthTier === "veryHigh" && "border-l-2 border-l-red-500/50",
            )}
          >
            <div className="text-sm font-bold text-foreground">{team.abbr}</div>
            <div className="flex-1 min-w-0">
              <div className="text-xs text-muted-foreground truncate">{team.team.split(" ").slice(-1)[0]}</div>
            </div>
            <GradeBadge grade={team.metrics.letterGrade} size="sm" />
          </button>
        ))}
      </div>
    </div>
  );
}

function StatCompareRow({ label, values, lowerIsBetter = true }: {
  label: string;
  values: (number | null | string)[];
  lowerIsBetter?: boolean;
}) {
  const nums = values.filter((v) => typeof v === "number" && v !== null) as number[];
  const best = lowerIsBetter ? Math.min(...nums) : Math.max(...nums);
  const worst = lowerIsBetter ? Math.max(...nums) : Math.min(...nums);

  return (
    <tr className="border-b border-border/30 hover:bg-muted/10">
      <td className="px-3 py-2.5 text-xs text-muted-foreground font-medium">{label}</td>
      {values.map((val, idx) => {
        const isBest = typeof val === "number" && val === best && nums.length > 1;
        const isWorst = typeof val === "number" && val === worst && nums.length > 1 && best !== worst;
        return (
          <td key={idx} className={cn(
            "px-3 py-2.5 text-center font-mono text-sm font-medium",
            isBest ? "text-emerald-400" : isWorst ? "text-red-400" : "text-foreground"
          )}>
            {val === null || val === undefined ? "—" :
             typeof val === "number" ? val.toFixed(2) : val}
            {isBest && <span className="ml-1 text-xs">★</span>}
          </td>
        );
      })}
    </tr>
  );
}

export default function ComparePage() {
  const [selectedTeams, setSelectedTeams] = useState<TeamData[]>([]);
  const [activeTab, setActiveTab] = useState<"overview" | "pitchers" | "trend">("overview");
  const searchParams = useSearchParams();

  // Pre-select team from URL query param (e.g. /compare?team=NYY)
  useEffect(() => {
    const teamParam = searchParams.get("team");
    if (teamParam) {
      const team = TEAMS.find((t) => t.abbr.toUpperCase() === teamParam.toUpperCase());
      if (team) {
        setSelectedTeams([team]);
      }
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const addTeam = (team: TeamData) => {
    if (selectedTeams.length < 3 && !selectedTeams.find((t) => t.abbr === team.abbr)) {
      setSelectedTeams([...selectedTeams, team]);
    }
  };

  const removeTeam = (abbr: string) => {
    setSelectedTeams(selectedTeams.filter((t) => t.abbr !== abbr));
  };

  const HEALTH_ORDER: Record<string, number> = { veryLow: 0, low: 1, moderate: 2, high: 3, veryHigh: 4 };
  const GRADE_ORDER: Record<string, number> = { A: 0, B: 1, C: 2, D: 3, F: 4 };

  const TEAM_COLORS = [
    { bg: "bg-blue-500/10", border: "border-blue-500/40", text: "text-blue-400" },
    { bg: "bg-purple-500/10", border: "border-purple-500/40", text: "text-purple-400" },
    { bg: "bg-orange-500/10", border: "border-orange-500/40", text: "text-orange-400" },
  ];

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
        {/* Page Header */}
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-1">
            <GitCompare className="w-5 h-5 text-primary" />
            <h1 className="text-2xl font-black text-foreground">Compare Teams</h1>
          </div>
          <p className="text-muted-foreground text-sm">Select up to 3 teams to compare their bullpen health and effectiveness side-by-side.</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Team Selector */}
          <div className="lg:col-span-1">
            <div className="bg-card border border-border/50 rounded-xl p-4 sticky top-20">
              <div className="flex items-center justify-between mb-3">
                <h2 className="font-semibold text-sm text-foreground">Select Teams</h2>
                <Badge variant="outline" className="text-xs">
                  {selectedTeams.length}/3 selected
                </Badge>
              </div>

              {selectedTeams.length < 3 ? (
                <TeamSelector onSelect={addTeam} selected={selectedTeams} />
              ) : (
                <div className="text-sm text-muted-foreground text-center py-4">
                  Maximum 3 teams selected.<br />Remove a team to add another.
                </div>
              )}

              {/* Selected Teams */}
              {selectedTeams.length > 0 && (
                <div className="mt-4 pt-4 border-t border-border/50 space-y-2">
                  <div className="text-xs text-muted-foreground font-medium mb-2">Selected:</div>
                  {selectedTeams.map((t, idx) => (
                    <div key={t.abbr} className={cn(
                      "flex items-center justify-between p-2 rounded-lg border",
                      TEAM_COLORS[idx].bg, TEAM_COLORS[idx].border
                    )}>
                      <div className="flex items-center gap-2">
                        <div className={cn("text-xs font-bold", TEAM_COLORS[idx].text)}>{idx + 1}</div>
                        <div className="text-sm font-medium text-foreground">{t.abbr}</div>
                        <GradeBadge grade={t.metrics.letterGrade} size="sm" />
                        <HealthBadge tier={t.metrics.healthTier} size="sm" showLabel={false} />
                      </div>
                      <button onClick={() => removeTeam(t.abbr)} className="text-muted-foreground hover:text-foreground transition-colors">
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                  {selectedTeams.length > 0 && (
                    <button onClick={() => setSelectedTeams([])} className="text-xs text-muted-foreground hover:text-red-400 transition-colors mt-2">
                      Clear all
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Comparison Area */}
          <div className="lg:col-span-2">
            {selectedTeams.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-80 text-muted-foreground bg-card border border-border/50 rounded-xl">
                <GitCompare className="w-12 h-12 mb-4 opacity-20" />
                <div className="font-semibold text-lg mb-1">Select Teams to Compare</div>
                <div className="text-sm text-center max-w-xs">Choose 2 or 3 teams from the panel to see a detailed side-by-side comparison</div>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Team Headers */}
                <div className={cn(
                  "grid gap-3",
                  selectedTeams.length === 1 ? "grid-cols-1" :
                  selectedTeams.length === 2 ? "grid-cols-2" : "grid-cols-3"
                )}>
                  {selectedTeams.map((t, idx) => (
                    <div key={t.abbr} className={cn(
                      "rounded-xl border-2 p-4 text-center",
                      TEAM_COLORS[idx].bg, TEAM_COLORS[idx].border
                    )}>
                      <div className={cn("text-xs font-bold mb-1", TEAM_COLORS[idx].text)}>{t.division}</div>
                      <div className="font-black text-foreground text-lg">{t.abbr}</div>
                      <div className="text-xs text-muted-foreground truncate">{t.team}</div>
                      <div className="flex items-center justify-center gap-2 mt-2">
                        <GradeBadge grade={t.metrics.letterGrade} size="md" />
                        <HealthBadge tier={t.metrics.healthTier} size="sm" />
                      </div>
                    </div>
                  ))}
                </div>

                {/* Comparison Tabs */}
                <div className="flex gap-2 border-b border-border/50">
                  {(["overview", "pitchers", "trend"] as const).map((tab) => (
                    <button
                      key={tab}
                      onClick={() => setActiveTab(tab)}
                      className={cn(
                        "px-3 py-2 text-sm font-medium capitalize border-b-2 transition-colors",
                        activeTab === tab
                          ? "border-primary text-primary"
                          : "border-transparent text-muted-foreground hover:text-foreground"
                      )}
                    >
                      {tab}
                    </button>
                  ))}
                </div>

                {/* Overview Comparison */}
                {activeTab === "overview" && (
                  <div className="space-y-4">
                    <div className="bg-card border border-border/50 rounded-xl overflow-hidden">
                      <table className="w-full">
                        <thead>
                          <tr className="border-b border-border/50 bg-muted/30">
                            <th className="px-3 py-2.5 text-left text-xs text-muted-foreground">Metric</th>
                            {selectedTeams.map((t, idx) => (
                              <th key={t.abbr} className={cn("px-3 py-2.5 text-center text-xs font-bold", TEAM_COLORS[idx].text)}>
                                {t.abbr}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          <tr className="border-b border-border/30">
                            <td className="px-3 py-2.5 text-xs text-muted-foreground font-medium">Overall Grade</td>
                            {selectedTeams.map((t) => (
                              <td key={t.abbr} className="px-3 py-2.5 text-center">
                                <GradeBadge grade={t.metrics.letterGrade} size="sm" />
                              </td>
                            ))}
                          </tr>
                          <tr className="border-b border-border/30">
                            <td className="px-3 py-2.5 text-xs text-muted-foreground font-medium">Health Tier</td>
                            {selectedTeams.map((t) => (
                              <td key={t.abbr} className="px-3 py-2.5 text-center">
                                <HealthBadge tier={t.metrics.healthTier} size="sm" />
                              </td>
                            ))}
                          </tr>
                          <StatCompareRow label="ERA (14d)" values={selectedTeams.map(t => t.metrics.era14d)} lowerIsBetter={true} />
                          <StatCompareRow label="WHIP (14d)" values={selectedTeams.map(t => t.metrics.whip14d)} lowerIsBetter={true} />
                          <StatCompareRow label="Relief IP / Game (14d)" values={selectedTeams.map(t => t.metrics.avgReliefIPPerGame ?? 0)} lowerIsBetter={true} />
                          <StatCompareRow label="Total IP (14d)" values={selectedTeams.map(t => t.metrics.totalIP14d)} lowerIsBetter={true} />
                          <StatCompareRow label="Total Pitches (14d)" values={selectedTeams.map(t => t.metrics.totalPitches14d)} lowerIsBetter={true} />
                          <StatCompareRow label="# of Pitchers" values={selectedTeams.map(t => t.metrics.pitcherCount)} lowerIsBetter={false} />
                          <StatCompareRow label="Players on IL" values={selectedTeams.map(t => t.metrics.dlCount)} lowerIsBetter={true} />
                        </tbody>
                      </table>
                    </div>

                    {/* Health bars side by side */}
                    <div className={cn(
                      "grid gap-3",
                      selectedTeams.length === 1 ? "grid-cols-1" :
                      selectedTeams.length === 2 ? "grid-cols-2" : "grid-cols-3"
                    )}>
                      {selectedTeams.map((t) => (
                        <div key={t.abbr} className="bg-card border border-border/50 rounded-xl p-4">
                          <div className="text-sm font-bold text-foreground mb-3">{t.abbr} Usage</div>
                          <HealthBar tier={t.metrics.healthTier} avgPitches14d={t.metrics.avgPitches14d} avgIP14d={t.metrics.avgIP14d} avgReliefIPPerGame={t.metrics.avgReliefIPPerGame ?? 0} />
                          {t.metrics.dlCount > 0 && (
                            <div className="flex items-center gap-1 mt-2 text-xs text-orange-400">
                              <AlertCircle className="w-3 h-3" />
                              {t.metrics.dlCount} on IL
                            </div>
                          )}
                        </div>
                      ))}
                    </div>

                    {/* Summaries */}
                    {selectedTeams.map((t, idx) => (
                      <div key={t.abbr} className={cn("rounded-xl border p-4", TEAM_COLORS[idx].bg, TEAM_COLORS[idx].border)}>
                        <div className={cn("text-sm font-bold mb-2", TEAM_COLORS[idx].text)}>{t.team} — Analysis</div>
                        <p className="text-xs text-muted-foreground leading-relaxed">{t.summary}</p>
                        <Link href={`/team/${t.abbr.toLowerCase()}`} className="inline-flex items-center gap-1 text-xs text-primary hover:text-primary/80 mt-2">
                          Full team page <ArrowRight className="w-3 h-3" />
                        </Link>
                      </div>
                    ))}
                  </div>
                )}

                {/* Pitchers Tab */}
                {activeTab === "pitchers" && (
                  <div className="space-y-6">
                    {selectedTeams.map((t, idx) => (
                      <div key={t.abbr} className={cn("rounded-xl border", TEAM_COLORS[idx].border)}>
                        <div className={cn("px-4 py-3 border-b flex items-center justify-between", TEAM_COLORS[idx].bg, TEAM_COLORS[idx].border)}>
                          <span className={cn("font-bold text-sm", TEAM_COLORS[idx].text)}>{t.team}</span>
                          <GradeBadge grade={t.metrics.letterGrade} size="sm" />
                        </div>
                        <PitcherTable pitchers={t.pitchers} />
                      </div>
                    ))}
                  </div>
                )}

                {/* Trend Tab */}
                {activeTab === "trend" && (
                  <div className="space-y-6">
                    {selectedTeams.map((t, idx) => (
                      <div key={t.abbr} className="bg-card border border-border/50 rounded-xl p-4">
                        <div className={cn("font-bold text-sm mb-3", TEAM_COLORS[idx].text)}>{t.team} — Last 10 Games</div>
                        <TrendChart trend={t.trend} />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
