"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { ChevronUp, ChevronDown, ExternalLink } from "lucide-react";
import type { Pitcher } from "@/lib/types";

interface PitcherTableProps {
  pitchers: Pitcher[];
  className?: string;
  show14d?: boolean;
}

type SortKey = "name" | "gp" | "ip" | "era" | "whip" | "pitches" | "batters" | "gp14d" | "ip14d" | "era14d" | "whip14d" | "pitches14d" | "batters14d";
type SortDir = "asc" | "desc";

function StatCell({ value, thresholds, decimals = 2 }: {
  value: number | null | undefined;
  thresholds?: [number, number];
  decimals?: number;
}) {
  if (value === null || value === undefined)
    return <td className="px-2.5 py-2.5 text-center text-muted-foreground/50 text-sm">—</td>;
  let colorClass = "text-foreground";
  if (thresholds) {
    colorClass = value <= thresholds[0] ? "text-emerald-400" : value <= thresholds[1] ? "text-amber-400" : "text-red-400";
  }
  return (
    <td className={cn("px-2.5 py-2.5 text-center font-mono text-sm font-medium", colorClass)}>
      {decimals === 0 ? Math.round(value) : value.toFixed(decimals)}
    </td>
  );
}

/** Player name — plain text or ESPN link */
function PitcherName({ name, espnUrl, subtitle }: { name: string; espnUrl?: string; subtitle?: string }) {
  if (espnUrl) {
    return (
      <a
        href={espnUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="group inline-flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        <span className="font-medium text-sm text-primary hover:text-primary/80 hover:underline underline-offset-2 transition-colors flex items-center gap-1">
          {name}
          <ExternalLink className="w-3 h-3 opacity-0 group-hover:opacity-60 transition-opacity flex-shrink-0" />
        </span>
        {subtitle && <span className="text-xs text-muted-foreground mt-0.5">{subtitle}</span>}
      </a>
    );
  }
  return (
    <div className="inline-flex flex-col">
      <span className="font-medium text-sm text-foreground">{name}</span>
      {subtitle && <span className="text-xs text-muted-foreground mt-0.5">{subtitle}</span>}
    </div>
  );
}

export function PitcherTable({ pitchers, className, show14d = false }: PitcherTableProps) {
  const [sortKey, setSortKey] = useState<SortKey>(show14d ? "gp14d" : "gp");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [viewMode, setViewMode] = useState<"season" | "14d">(show14d ? "14d" : "season");

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir(d => d === "asc" ? "desc" : "asc");
    } else {
      setSortKey(key);
      setSortDir(key === "name" ? "asc" : "desc");
    }
  };

  const sorted = [...pitchers].sort((a, b) => {
    let aVal: any = a[sortKey];
    let bVal: any = b[sortKey];
    if (aVal === null || aVal === undefined) aVal = sortDir === "asc" ? Infinity : -Infinity;
    if (bVal === null || bVal === undefined) bVal = sortDir === "asc" ? Infinity : -Infinity;
    if (typeof aVal === "string") return sortDir === "asc" ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
    return sortDir === "asc" ? aVal - bVal : bVal - aVal;
  });

  const SortIcon = ({ col }: { col: SortKey }) => {
    if (sortKey !== col) return <ChevronUp className="w-3 h-3 opacity-20 flex-shrink-0" />;
    return sortDir === "asc" ? <ChevronUp className="w-3 h-3 text-primary flex-shrink-0" /> : <ChevronDown className="w-3 h-3 text-primary flex-shrink-0" />;
  };

  const Th = ({ col, label, title }: { col: SortKey; label: string; title?: string }) => (
    <th
      className="px-2.5 py-2 text-center text-xs font-medium text-muted-foreground cursor-pointer hover:text-foreground transition-colors select-none whitespace-nowrap"
      onClick={() => handleSort(col)}
      title={title}
    >
      <div className="flex items-center justify-center gap-1">
        {label}
        <SortIcon col={col} />
      </div>
    </th>
  );

  // Totals helpers
  const avg = (arr: (number | null)[]) => {
    const vals = arr.filter(v => v !== null) as number[];
    return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
  };
  const sum = (arr: number[]) => arr.reduce((a, b) => a + b, 0);

  const is14d = viewMode === "14d";

  // Count how many pitchers have ESPN links
  const linkedCount = pitchers.filter(p => p.espnUrl).length;

  return (
    <div className={cn("space-y-2", className)}>
      {/* Toggle */}
      <div className="flex items-center justify-between">
        <div className="flex bg-muted/50 rounded-lg p-0.5 gap-0.5">
          <button
            onClick={() => { setViewMode("season"); setSortKey("gp"); }}
            className={cn(
              "px-3 py-1 rounded-md text-xs font-medium transition-colors",
              viewMode === "season" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
            )}
          >
            Full Season
          </button>
          <button
            onClick={() => { setViewMode("14d"); setSortKey("gp14d"); }}
            className={cn(
              "px-3 py-1 rounded-md text-xs font-medium transition-colors",
              viewMode === "14d" ? "bg-primary/20 text-primary shadow-sm" : "text-muted-foreground hover:text-foreground"
            )}
          >
            Last 14 Days 🔥
          </button>
        </div>
        <div className="flex items-center gap-3">
          {linkedCount > 0 && (
            <span className="text-xs text-muted-foreground/70 flex items-center gap-1">
              <ExternalLink className="w-3 h-3" />
              Names link to ESPN
            </span>
          )}
          <div className="text-xs text-muted-foreground">Click headers to sort</div>
        </div>
      </div>



      <div className="overflow-x-auto rounded-lg border border-border/50">
        <table className="w-full min-w-[640px]">
          <thead>
            <tr className="border-b border-border/50 bg-muted/30">
              <th className="px-2.5 py-2 text-left text-xs font-medium text-muted-foreground cursor-pointer hover:text-foreground select-none whitespace-nowrap" onClick={() => handleSort("name")}>
                <div className="flex items-center gap-1">Pitcher <SortIcon col="name" /></div>
              </th>
              <th className="px-2.5 py-2 text-center text-xs font-medium text-muted-foreground">H</th>
              <Th col={is14d ? "gp14d" : "gp"} label="GP" title="Games Pitched" />
              <Th col={is14d ? "ip14d" : "ip"} label="IP" title="Innings Pitched" />
              <Th col={is14d ? "pitches14d" : "pitches"} label="Pit" title="Pitches" />
              <Th col={is14d ? "batters14d" : "batters"} label="BF" title="Batters Faced" />
              <Th col={is14d ? "era14d" : "era"} label="ERA" title="Earned Run Average" />
              <Th col={is14d ? "whip14d" : "whip"} label="WHIP" title="WHIP" />
            </tr>
          </thead>
          <tbody>
            {sorted.map((p, idx) => {
              const gp = is14d ? p.gp14d : p.gp;
              const ip = is14d ? p.ip14d : p.ip;
              const pit = is14d ? p.pitches14d : p.pitches;
              const bat = is14d ? p.batters14d : p.batters;
              const era = is14d ? p.era14d : p.era;
              const whip = is14d ? p.whip14d : p.whip;

              const usageColor = is14d
                ? (gp >= 6 ? "text-red-400" : gp >= 3 ? "text-amber-400" : "text-emerald-400")
                : (gp >= 20 ? "text-red-400" : gp >= 15 ? "text-amber-400" : "text-foreground");

              const subtitle = is14d ? `Season: ${p.gp} GP · ${p.ip} IP` : undefined;

              return (
                <tr key={p.name} className={cn(
                  "border-b border-border/30 transition-colors hover:bg-muted/20",
                  idx % 2 === 0 ? "bg-transparent" : "bg-muted/10",
                  is14d && gp === 0 && "opacity-40"
                )}>
                  <td className="px-2.5 py-2.5">
                    <PitcherName name={p.name} espnUrl={p.espnUrl} subtitle={subtitle} />
                  </td>
                  <td className="px-2.5 py-2.5 text-center">
                    <span className={cn(
                      "inline-flex items-center justify-center w-5 h-5 rounded text-xs font-bold",
                      p.hand === "L" ? "bg-blue-500/20 text-blue-400" : "bg-orange-500/20 text-orange-400"
                    )}>
                      {p.hand}
                    </span>
                  </td>
                  <td className={cn("px-2.5 py-2.5 text-center font-bold text-sm", usageColor)}>
                    {gp}
                  </td>
                  <td className="px-2.5 py-2.5 text-center font-mono text-sm text-foreground">
                    {ip.toFixed(1)}
                  </td>
                  <td className="px-2.5 py-2.5 text-center font-mono text-sm text-foreground">
                    {pit || 0}
                  </td>
                  <td className="px-2.5 py-2.5 text-center font-mono text-sm text-foreground">
                    {bat || 0}
                  </td>
                  <StatCell value={era} thresholds={[3.0, 4.5]} />
                  <StatCell value={whip} thresholds={[1.1, 1.4]} />
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="border-t border-border/50 bg-muted/30">
              <td className="px-2.5 py-2 text-xs text-muted-foreground font-medium" colSpan={2}>
                {is14d ? "14-Day Totals" : "Season Totals"} ({pitchers.length} pitchers)
              </td>
              <td className="px-2.5 py-2 text-center text-xs font-bold text-foreground">
                {is14d ? sum(pitchers.map(p=>p.gp14d)) : sum(pitchers.map(p=>p.gp))}
              </td>
              <td className="px-2.5 py-2 text-center text-xs font-mono text-foreground">
                {is14d ? sum(pitchers.map(p=>p.ip14d)).toFixed(1) : sum(pitchers.map(p=>p.ip)).toFixed(1)}
              </td>
              <td className="px-2.5 py-2 text-center text-xs font-mono text-foreground">
                {is14d ? sum(pitchers.map(p=>p.pitches14d)) : sum(pitchers.map(p=>p.pitches))}
              </td>
              <td className="px-2.5 py-2 text-center text-xs font-mono text-foreground">
                {is14d ? sum(pitchers.map(p=>p.batters14d)) : sum(pitchers.map(p=>p.batters))}
              </td>
              {/* ERA avg */}
              <td className="px-2.5 py-2 text-center text-xs font-mono">
                {(() => {
                  const vals = pitchers.map(p => is14d ? p.era14d : p.era).filter(Boolean) as number[];
                  const a = avg(vals);
                  if (!a) return <span className="text-muted-foreground/50">—</span>;
                  const cls = a < 3.5 ? "text-emerald-400" : a < 4.5 ? "text-amber-400" : "text-red-400";
                  return <span className={cn("font-bold", cls)}>{a.toFixed(2)}</span>;
                })()}
              </td>
              {/* WHIP avg */}
              <td className="px-2.5 py-2 text-center text-xs font-mono">
                {(() => {
                  const vals = pitchers.map(p => is14d ? p.whip14d : p.whip).filter(Boolean) as number[];
                  const a = avg(vals);
                  if (!a) return <span className="text-muted-foreground/50">—</span>;
                  const cls = a < 1.2 ? "text-emerald-400" : a < 1.4 ? "text-amber-400" : "text-red-400";
                  return <span className={cn("font-bold", cls)}>{a.toFixed(2)}</span>;
                })()}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      {/* Column legend */}
      <div className="flex flex-wrap gap-3 text-xs text-muted-foreground pt-1">
        <span><strong className="text-foreground">GP</strong> Games Pitched</span>
        <span><strong className="text-foreground">IP</strong> Innings Pitched</span>
        <span><strong className="text-foreground">Pit</strong> Pitches Thrown</span>
        <span><strong className="text-foreground">BF</strong> Batters Faced</span>
        <span><strong className="text-foreground">ERA</strong> Earned Run Avg</span>
        <span><strong className="text-foreground">WHIP</strong> Walks+Hits/IP</span>
      </div>
    </div>
  );
}
