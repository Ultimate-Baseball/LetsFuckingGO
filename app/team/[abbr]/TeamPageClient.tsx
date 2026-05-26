"use client";

import { useParams } from "next/navigation";
import Link from "next/link";
import { Header } from "@/components/header";
import { GradeBadge, GRADE_CONFIG } from "@/components/grade-badge";
import { HealthBadge, HealthBar, HEALTH_TIER_CONFIG } from "@/components/health-badge";
import { PitcherTable } from "@/components/pitcher-table";
import { TrendChart } from "@/components/trend-chart";
import { InjuryPanel } from "@/components/injury-panel";
import { getTeam } from "@/lib/mlb-data";
import {
  computePitcherHealthTier,
  computeUsageBarPct,
  computePitcherAvailability,
  computeTeamAvailabilityPenalty,
  type PitcherAvailabilityResult,
} from "@/lib/health";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import {
  ArrowLeft, AlertCircle, Activity, BarChart3, Users,
  TrendingUp, Bell, BellRing, ShieldAlert, ExternalLink,
} from "lucide-react";
import { cn, eraTextColor as eraColorFn, eraBgColor, whipTextColor as whipColorFn } from "@/lib/utils";

// ── ESPN player link helper ────────────────────────────────────────────────────
function EspnName({ name, espnUrl, className }: { name: string; espnUrl?: string; className?: string }) {
  if (espnUrl) {
    return (
      <a
        href={espnUrl}
        target="_blank"
        rel="noopener noreferrer"
        className={cn("inline-flex items-center gap-1 group", className)}
        onClick={e => e.stopPropagation()}
      >
        <span className="hover:underline underline-offset-2 transition-colors text-primary/90 hover:text-primary">{name}</span>
        <ExternalLink className="w-3 h-3 opacity-0 group-hover:opacity-50 transition-opacity flex-shrink-0" />
      </a>
    );
  }
  return <span className={className}>{name}</span>;
}


// ── Availability bar component ─────────────────────────────────────────────────
function AvailBar({ pct, isUnusable }: { pct: number; isUnusable: boolean }) {
  const color = isUnusable
    ? "bg-zinc-700"
    : pct <= 10  ? "bg-red-500"
    : pct < 75   ? "bg-amber-500"
    : "bg-emerald-500";
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
        <div className={cn("h-full rounded-full transition-all", color)} style={{ width: `${pct}%` }} />
      </div>
      <span className={cn(
        "text-[11px] font-bold w-9 text-right tabular-nums",
        isUnusable ? "text-zinc-500" : pct <= 10 ? "text-red-400" : pct < 75 ? "text-amber-400" : "text-emerald-400"
      )}>
        {isUnusable ? "—" : `${pct}%`}
      </span>
    </div>
  );
}

// ── Health pill ────────────────────────────────────────────────────────────────
function HealthPill({ health, isUnusable }: { health: number; isUnusable: boolean }) {
  if (isUnusable) return (
    <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-zinc-800 text-zinc-400 border border-zinc-600">
      UNAVAIL
    </span>
  );
  const cls = health >= 90 ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30"
    : health >= 60 ? "bg-amber-500/15 text-amber-400 border-amber-500/30"
    : "bg-red-500/15 text-red-400 border-red-500/30";
  return (
    <span className={cn("inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold border", cls)}>
      {health}%
    </span>
  );
}

export default function TeamPage() {
  const params = useParams();
  const abbr = params?.abbr as string;
  const team = getTeam(abbr);

  if (!team) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="flex flex-col items-center justify-center h-64 gap-4">
          <div className="text-4xl">⚾</div>
          <div className="text-muted-foreground">Team not found: {abbr}</div>
          <Link href="/" className="text-primary hover:underline text-sm">← Back to Dashboard</Link>
        </div>
      </div>
    );
  }

  const { metrics, pitchers, dl, trend, summary } = team;
  const {
    healthTier, letterGrade,
    era14d, whip14d, avgIP14d, avgPitches14d, avgReliefIPPerGame,
    totalGP14d, totalIP14d, totalPitches14d,
    dlCount, pitcherCount,
  } = metrics;
  const gradeConfig  = GRADE_CONFIG[letterGrade];
  const healthConfig = HEALTH_TIER_CONFIG[healthTier];

  const leftHandedCount  = pitchers.filter(p => p.hand === "L").length;
  const rightHandedCount = pitchers.filter(p => p.hand === "R").length;

  // ── Compute availability for every pitcher ──────────────────────────────────
  const pitcherAvail: Array<{ name: string; espnUrl?: string; avail: PitcherAvailabilityResult }> =
    pitchers.map(p => ({
      name: p.name,
      espnUrl: p.espnUrl,
      avail: computePitcherAvailability(p.gameLog ?? []),
    }));

  // Team availability penalty
  const teamPenalty = computeTeamAvailabilityPenalty(pitcherAvail.map(x => x.avail));

  // All alerts across all pitchers
  const allAlerts = pitcherAvail.flatMap(({ name, avail }) =>
    avail.alerts.map(a => ({ ...a, pitcherName: name }))
  );

  // Sort pitchers: unusable first, then by availability asc (most restricted at top)
  const sortedAvail = [...pitcherAvail]
    .filter(x => x.avail.daysSinceLastGame < 99)
    .sort((a, b) => {
      if (a.avail.isUnusable !== b.avail.isUnusable)
        return a.avail.isUnusable ? -1 : 1;
      return a.avail.availability - b.avail.availability;
    });

  const mostUsed = [...pitchers].sort((a, b) => b.gp14d - a.gp14d)[0];
  const bestERA  = [...pitchers].filter(p => p.era14d !== null).sort((a, b) => (a.era14d ?? 99) - (b.era14d ?? 99))[0];

  return (
    <div className="min-h-screen bg-background">
      <Header />

      {/* Team Hero */}
      <div className={cn("relative border-b border-border/50 baseball-pattern")}>
        <div className={cn(
          "absolute top-0 left-0 right-0 h-1",
          healthTier === "veryLow" ? "bg-emerald-500" :
          healthTier === "low" ? "bg-green-500" :
          healthTier === "moderate" ? "bg-amber-500" :
          healthTier === "high" ? "bg-orange-500" : "bg-red-500"
        )} />
        <div className="max-w-6xl mx-auto px-4 sm:px-6 pt-6 pb-8">
          <Link href="/" className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors mb-6">
            <ArrowLeft className="w-3.5 h-3.5" />
            All Teams
          </Link>
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <Badge variant="outline" className="text-xs">{team.division}</Badge>
                <HealthBadge tier={healthTier} />
              </div>
              <h1 className="text-3xl sm:text-4xl font-black text-foreground mb-1">{team.team}</h1>
              <div className="text-6xl font-black text-muted-foreground/20 leading-none">{team.abbr}</div>
            </div>
            <div className="flex items-center gap-6">
              <div className="text-center">
                <GradeBadge grade={letterGrade} size="xl" />
                <div className={cn("text-sm font-bold mt-2", gradeConfig.color)}>{gradeConfig.label}</div>
                <div className="text-xs text-muted-foreground">Bullpen Grade</div>
              </div>
              <div className="space-y-3">
                <div className="bg-muted/50 border border-border/50 rounded-xl p-3 text-center min-w-[80px]">
                  <div className={cn("text-2xl font-black",
                    eraColorFn(era14d))}>
                    {era14d?.toFixed(2) ?? "—"}
                  </div>
                  <div className="text-xs text-muted-foreground">ERA <span className="text-primary/60">14d</span></div>
                </div>
                <div className="bg-muted/50 border border-border/50 rounded-xl p-3 text-center">
                  <div className={cn("text-2xl font-black",
                    whipColorFn(whip14d))}>
                    {whip14d?.toFixed(2) ?? "—"}
                  </div>
                  <div className="text-xs text-muted-foreground">WHIP <span className="text-primary/60">14d</span></div>
                </div>
              </div>
            </div>
          </div>
          <div className="mt-6 bg-muted/40 border border-border/50 rounded-xl p-4">
            <div className="flex items-start gap-2">
              <div className={cn("w-1 rounded-full flex-shrink-0 mt-1 min-h-[40px]",
                gradeConfig.bg.replace("/15", "/80"))} />
              <p className="text-sm text-muted-foreground leading-relaxed">{summary}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Stats Bar */}
      <div className="border-b border-border/50 bg-muted/20">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4">
          <div className="flex items-center gap-2 mb-3 text-xs text-primary/80">
            <span className="font-semibold">📅 Last 14 Days</span>
            
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3">
            {[
              { label: "Pitchers",         value: pitcherCount,                          icon: "👤" },
              { label: "Rel IP/G", value: (avgReliefIPPerGame ?? 0).toFixed(1),  icon: "🎯" },
              { label: "ERA",         value: era14d?.toFixed(2) ?? "—",             icon: "📊" },
              { label: "WHIP",        value: whip14d?.toFixed(2) ?? "—",            icon: "📈" },
              { label: "On IL",             value: dlCount || "None",                     icon: "🩺" },
              { label: "LHP/RHP",           value: `${leftHandedCount}/${rightHandedCount}`, icon: "⚾" },
            ].map(stat => (
              <div key={stat.label} className="bg-muted/30 border border-border/50 rounded-lg p-3 text-center">
                <div className="text-lg mb-0.5">{stat.icon}</div>
                <div className="font-bold text-foreground">{stat.value}</div>
                <div className="text-xs text-muted-foreground">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Main Content Tabs */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6">
        <Tabs defaultValue="pitchers">
          <TabsList className="bg-muted/50 mb-6">
            <TabsTrigger value="pitchers" className="gap-1.5">
              <Users className="w-3.5 h-3.5" /> Pitchers
            </TabsTrigger>
            <TabsTrigger value="trend" className="gap-1.5">
              <TrendingUp className="w-3.5 h-3.5" /> Last 10 Games
            </TabsTrigger>
            <TabsTrigger value="health" className="gap-1.5">
              <Activity className="w-3.5 h-3.5" /> Health
            </TabsTrigger>
            <TabsTrigger value="availability" className="gap-1.5"><ShieldAlert className="w-3.5 h-3.5" />
              Pitcher Health</TabsTrigger>
            <TabsTrigger value="injuries" className="relative gap-1.5">
              <AlertCircle className="w-3.5 h-3.5" />
              Injuries
              {dlCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-orange-500 text-white text-xs w-4 h-4 rounded-full flex items-center justify-center">
                  {dlCount}
                </span>
              )}
            </TabsTrigger>
          </TabsList>

          {/* ── Pitchers Tab ── */}
          <TabsContent value="pitchers" className="space-y-4">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-lg font-bold text-foreground">Relief Pitchers — 2026 Season</h2>
            </div>
            <PitcherTable pitchers={pitchers} />
            {(mostUsed || bestERA) && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
                {mostUsed && (
                  <div className="bg-muted/30 border border-border/50 rounded-xl p-4">
                    <div className="text-xs text-muted-foreground mb-1">Most Used (Last 14 Days)</div>
                    <div className="font-bold text-foreground">{mostUsed.name}</div>
                    <div className="text-sm text-amber-400">{mostUsed.gp14d} appearances</div>
                    <div className="text-xs text-muted-foreground mt-1">
                      {mostUsed.ip14d?.toFixed(1)} IP · {mostUsed.era14d?.toFixed(2) ?? "—"} ERA
                    </div>
                  </div>
                )}
                {bestERA && (
                  <div className="bg-muted/30 border border-border/50 rounded-xl p-4">
                    <div className="text-xs text-muted-foreground mb-1">Best ERA — Last 14 Days</div>
                    <div className="font-bold text-foreground">{bestERA.name}</div>
                    <div className="text-sm text-emerald-400">{bestERA.era14d?.toFixed(2)} ERA</div>
                    <div className="text-xs text-muted-foreground mt-1">
                      {bestERA.gp14d} GP · {bestERA.ip14d?.toFixed(1)} IP · {bestERA.whip14d?.toFixed(2) ?? "—"} WHIP
                    </div>
                  </div>
                )}
              </div>
            )}
          </TabsContent>

          {/* ── Trend Tab ── */}
          <TabsContent value="trend" className="space-y-6">
            <div className="bg-card border border-border/50 rounded-xl p-5">
              <TrendChart trend={trend} />
            </div>
            {trend.length > 0 && (
              <div className="bg-card border border-border/50 rounded-xl overflow-hidden">
                <div className="px-4 py-3 border-b border-border/50">
                  <h3 className="font-semibold text-sm text-foreground">Game-by-Game Breakdown</h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border/50 bg-muted/30">
                        <th className="px-4 py-2 text-left text-xs text-muted-foreground">Date</th>
                        <th className="px-4 py-2 text-center text-xs text-muted-foreground">Pitchers Used</th>
                        <th className="px-4 py-2 text-center text-xs text-muted-foreground">ERA</th>
                        <th className="px-4 py-2 text-center text-xs text-muted-foreground">WHIP</th>
                        <th className="px-4 py-2 text-center text-xs text-muted-foreground">Pitches</th>
                        <th className="px-4 py-2 text-center text-xs text-muted-foreground">IP</th>
                        <th className="px-4 py-2 text-center text-xs text-muted-foreground">Health</th>
                        <th className="px-4 py-2 text-center text-xs text-muted-foreground">Grade</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[...trend].reverse().map((t, idx) => (
                        <tr key={idx} className="border-b border-border/30 hover:bg-muted/20">
                          <td className="px-4 py-2.5 text-foreground">
                            {new Date(t.date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                          </td>
                          <td className="px-4 py-2.5 text-center font-medium text-foreground">{t.gamesUsed}</td>
                          <td className={cn("px-4 py-2.5 text-center font-mono font-medium",
                            eraColorFn(t.era))}>
                            {t.era.toFixed(2)}
                          </td>
                          <td className={cn("px-4 py-2.5 text-center font-mono font-medium",
                            whipColorFn(t.whip))}>
                            {t.whip.toFixed(2)}
                          </td>
                          <td className="px-4 py-2.5 text-center text-sm text-muted-foreground">{t.pitches ?? "—"}</td>
                          <td className="px-4 py-2.5 text-center text-sm text-muted-foreground">
                            {t.ip != null ? t.ip.toFixed(1) : "—"}
                          </td>
                          <td className="px-4 py-2.5 text-center"><HealthBadge tier={t.health} size="sm" /></td>
                          <td className="px-4 py-2.5 text-center"><GradeBadge grade={t.grade} size="sm" /></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </TabsContent>

          {/* ── Health Tab ── */}
          <TabsContent value="health" className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Left — Usage */}
              <div className="bg-card border border-border/50 rounded-xl p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-foreground">Bullpen Usage Analysis</h3>
                  <span className="text-xs text-primary/70 bg-primary/10 px-2 py-0.5 rounded-full">Last 14 Days</span>
                </div>
                <HealthBar tier={healthTier} avgPitches14d={avgPitches14d} avgIP14d={avgIP14d} avgReliefIPPerGame={avgReliefIPPerGame ?? 0} />

                <div className="grid grid-cols-3 gap-2 text-center text-xs">
                  <div className="bg-muted/40 rounded-lg p-2">
                    <div className="font-bold text-foreground">{totalGP14d}</div>
                    <div className="text-muted-foreground">Total GP</div>
                  </div>
                  <div className="bg-muted/40 rounded-lg p-2">
                    <div className="font-bold text-foreground">{totalIP14d?.toFixed(1)}</div>
                    <div className="text-muted-foreground">Total IP</div>
                  </div>
                  <div className="bg-muted/40 rounded-lg p-2">
                    <div className="font-bold text-foreground">{totalPitches14d}</div>
                    <div className="text-muted-foreground">Total Pitches</div>
                  </div>
                </div>
                {/* Individual Usage Bars */}
                <div className="space-y-2.5">
                  <div className="text-xs text-muted-foreground font-medium">Individual Usage — Last 14 Days</div>
                  {[...pitchers]
                    .filter(p => p.gp14d > 0)
                    .sort((a, b) => {
                      const pA = computeUsageBarPct(a.pitches14d, a.ip14d ?? 0, a.gp14d);
                      const pB = computeUsageBarPct(b.pitches14d, b.ip14d ?? 0, b.gp14d);
                      return pB - pA;
                    })
                    .map(p => {
                      const tier = computePitcherHealthTier(p.pitches14d, p.ip14d ?? 0, p.gp14d);
                      const barColor = tier === "veryHigh" ? "bg-red-500" : tier === "high" ? "bg-orange-500" : tier === "moderate" ? "bg-amber-500" : tier === "low" ? "bg-green-500" : "bg-emerald-500";
                      const textColor = tier === "veryHigh" ? "text-red-400" : tier === "high" ? "text-orange-400" : tier === "moderate" ? "text-amber-400" : tier === "low" ? "text-green-400" : "text-emerald-400";
                      const pct = computeUsageBarPct(p.pitches14d, p.ip14d ?? 0, p.gp14d);
                      return (
                        <div key={p.name} className="space-y-1">
                          <div className="flex items-center justify-between text-xs gap-2">
                            <EspnName name={p.name} espnUrl={p.espnUrl} className="text-foreground truncate max-w-[130px] shrink-0 text-xs" />
                            <span className={cn("font-mono shrink-0", textColor)}>
                              {p.pitches14d} pit · {(p.ip14d ?? 0).toFixed(1)} IP · {p.gp14d} GP
                            </span>
                          </div>
                          <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                            <div className={cn("h-full rounded-full transition-all", barColor)} style={{ width: `${pct}%` }} />
                          </div>
                        </div>
                      );
                    })}
                  {pitchers.filter(p => p.gp14d === 0).length > 0 && (
                    <div className="text-xs text-muted-foreground/50 italic pt-1">
                      +{pitchers.filter(p => p.gp14d === 0).length} additional pitchers
                    </div>
                  )}
                </div>
              </div>
              {/* Right — Effectiveness */}
              <div className="bg-card border border-border/50 rounded-xl p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-foreground">Effectiveness Breakdown</h3>
                  <span className="text-xs text-primary/70 bg-primary/10 px-2 py-0.5 rounded-full">Last 14 Days</span>
                </div>
                <div className={cn("rounded-xl p-4 border-2 text-center", gradeConfig.bg, gradeConfig.border)}>
                  <div className={cn("text-5xl font-black", gradeConfig.color)}>{letterGrade}</div>
                  <div className={cn("font-semibold mt-1", gradeConfig.color)}>{gradeConfig.label}</div>
                </div>
                <div className="space-y-2">
                  <div className="text-xs text-muted-foreground font-medium">Individual ERA — Last 14 Days</div>
                  {[...pitchers]
                    .filter(p => p.era14d !== null && p.gp14d > 0)
                    .sort((a, b) => (a.era14d ?? 99) - (b.era14d ?? 99))
                    .map(p => {
                      const eraColor     = eraBgColor(p.era14d);
                      const eraTextColor_ = eraColorFn(p.era14d);
                      const eraPct = Math.min(((p.era14d ?? 0) / 9) * 100, 100);
                      return (
                        <div key={p.name} className="space-y-0.5">
                          <div className="flex justify-between text-xs">
                            <EspnName name={p.name} espnUrl={p.espnUrl} className="text-foreground truncate max-w-[160px] text-xs" />
                            <span className={cn("font-mono", eraTextColor_)}>
                              {p.era14d?.toFixed(2)} ERA · {p.whip14d?.toFixed(2) ?? "—"} WHIP
                            </span>
                          </div>
                          <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                            <div className={cn("h-full rounded-full", eraColor)} style={{ width: `${eraPct}%` }} />
                          </div>
                        </div>
                      );
                    })}
                  {pitchers.filter(p => p.gp14d === 0).length > 0 && (
                    <div className="text-xs text-muted-foreground/50 italic">
                      Additional pitchers not shown above.
                    </div>
                  )}
                </div>
              </div>
            </div>
          </TabsContent>

          {/* ── Pitcher Health Tab ── */}
          <TabsContent value="availability" className="space-y-4">

            {/* ── Individual pitcher health table ─────────────────────── */}
            <div className="bg-card border border-border/50 rounded-xl overflow-hidden">
              <div className="px-5 py-3 border-b border-border/50 flex items-center justify-between">
                <h3 className="font-semibold text-sm text-foreground">Pitcher Health — Today</h3>
                
              </div>
              <div className="divide-y divide-border/30">
                {sortedAvail.map(({ name, espnUrl, avail }) => {
                  const h = avail.health;
                  const unusable = avail.isUnusable;
                  let healthLabel = "Fully rested";
                  if (unusable) healthLabel = "Unavailable";
                  else if (h === 75)  healthLabel = "75% health";
                  else if (h === 50)  healthLabel = "50% health";
                  else if (avail.daysSinceLastGame < 99 && avail.lastGamePitches > 0)
                    healthLabel = `Fully rested — last app ${avail.daysSinceLastGame}d ago`;
                  return (
                    <div key={name} className={cn(
                      "px-5 py-3 grid grid-cols-[1fr_80px_140px] items-center gap-4",
                      unusable ? "opacity-55" : ""
                    )}>
                      {/* Name + label */}
                      <div>
                        <EspnName name={name} espnUrl={espnUrl} className="text-sm font-medium text-foreground" />
                        <div className="text-[11px] text-muted-foreground/60 mt-0.5 leading-snug">{healthLabel}</div>
                      </div>
                      {/* Last game pitches */}
                      <div className="text-center">
                        {avail.lastGamePitches > 0 && avail.daysSinceLastGame < 99 ? (
                          <div>
                            <div className={cn("text-sm font-bold tabular-nums",
                              avail.lastGamePitches > 30 ? "text-red-400"
                              : avail.lastGamePitches > 20 ? "text-amber-400"
                              : avail.lastGamePitches >= 10 ? "text-yellow-400"
                              : "text-muted-foreground/60")}>
                              {avail.lastGamePitches}
                            </div>
                            <div className="text-[10px] text-muted-foreground/50">pitches</div>
                          </div>
                        ) : (
                          <div className="text-xs text-muted-foreground/40">—</div>
                        )}
                      </div>
                      {/* Health bar */}
                      <AvailBar pct={h} isUnusable={unusable} />
                    </div>
                  );
                })}

                {/* Pitchers with no recent data */}
                {pitcherAvail
                  .filter(x => x.avail.daysSinceLastGame >= 99)
                  .map(({ name, espnUrl }) => (
                    <div key={name} className="px-5 py-3 grid grid-cols-[1fr_80px_140px] items-center gap-4">
                      <div>
                        <EspnName name={name} espnUrl={espnUrl} className="text-sm font-medium text-foreground" />
                        <div className="text-[11px] text-muted-foreground/50 mt-0.5">No recent appearances</div>
                      </div>
                      <div className="text-center text-xs text-muted-foreground/40">—</div>
                      <AvailBar pct={100} isUnusable={false} />
                    </div>
                  ))}
              </div>
            </div>

            {/* ── Legend ──────────────────────────────────────────────── */}
            <div className="bg-muted/20 border border-border/30 rounded-xl p-4">
              <div className="text-xs font-semibold text-muted-foreground/80 mb-2">Health Rules</div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1 text-[11px] text-muted-foreground/70">

                <span><span className="text-foreground/70 font-medium">3 rest days</span> → always resets to 100%</span>
                
              </div>
            </div>
          </TabsContent>


          {/* ── Injuries Tab ── */}
          <TabsContent value="injuries">
            <div className="bg-card border border-border/50 rounded-xl p-5">
              <InjuryPanel dl={dl} espnId={team.espnId} />
            </div>
          </TabsContent>
        </Tabs>
      </div>

      {/* Footer Nav */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 pb-8">
        <div className="flex items-center justify-between pt-4 border-t border-border/50">
          <Link href="/" className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="w-4 h-4" />
            Back to All Teams
          </Link>
          <Link href={`/compare?team=${abbr.toUpperCase()}`} className="flex items-center gap-2 text-sm text-primary hover:text-primary/80 transition-colors">
            <BarChart3 className="w-4 h-4" />
            Compare with Other Teams
          </Link>
        </div>
      </div>
    </div>
  );
}
