"use client";

import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { cn, eraTextColor, whipTextColor } from "@/lib/utils";
import { GradeBadge } from "@/components/grade-badge";
import { HealthBadge, HealthBar } from "@/components/health-badge";
import { AlertCircle, Users, TrendingUp, TrendingDown, ChevronDown, ChevronUp } from "lucide-react";
import type { TeamData } from "@/lib/types";
import { useState } from "react";

interface TeamCardProps {
  team: TeamData;
  index?: number;
  selected?: boolean;
  onSelect?: (abbr: string) => void;
  compareMode?: boolean;
}

const DIVISION_COLORS: Record<string, string> = {
  "AL East": "text-blue-400",
  "AL Central": "text-blue-300",
  "AL West": "text-blue-200",
  "NL East": "text-purple-400",
  "NL Central": "text-purple-300",
  "NL West": "text-purple-200",
};

const HEALTH_BORDER: Record<string, string> = {
  veryLow:  "border-emerald-500/40 hover:border-emerald-400/70",
  low:      "border-green-500/40 hover:border-green-400/70",
  moderate: "border-amber-500/40 hover:border-amber-400/70",
  high:     "border-orange-500/40 hover:border-orange-400/70",
  veryHigh: "border-red-500/40 hover:border-red-400/70",
};

const HEALTH_GLOW: Record<string, string> = {
  veryLow:  "shadow-emerald-500/10",
  low:      "shadow-green-500/10",
  moderate: "shadow-amber-500/10",
  high:     "shadow-orange-500/10",
  veryHigh: "shadow-red-500/10",
};

export function TeamCard({ team, index = 0, selected, onSelect, compareMode }: TeamCardProps) {
  const { metrics, abbr, division } = team;
  const { healthTier, letterGrade, era14d, whip14d, avgGP14d, avgIP14d, avgPitches14d, avgReliefIPPerGame, dlCount, pitcherCount } = metrics;
  const [ilExpanded, setIlExpanded] = useState(false);

  // Determine trend from last 2 trend points
  const trend = team.trend;
  const trendDirection =
    trend.length >= 2
      ? trend[trend.length - 1].era < trend[trend.length - 2].era
        ? "improving"
        : "declining"
      : "stable";

  const handleClick = () => {
    if (compareMode && onSelect) {
      onSelect(abbr);
    }
  };

  const handleIlToggle = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIlExpanded((v) => !v);
  };

  const CardWrapper = compareMode ? "div" : Link;
  const cardProps = compareMode ? { onClick: handleClick } : { href: `/team/${abbr.toLowerCase()}` };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.03, duration: 0.4 }}
    >
      <CardWrapper
        {...(cardProps as any)}
        className={cn(
          "block rounded-xl border-2 bg-card p-4 transition-all duration-200 cursor-pointer shadow-lg",
          HEALTH_BORDER[healthTier],
          HEALTH_GLOW[healthTier],
          selected && "ring-2 ring-primary ring-offset-2 ring-offset-background",
          compareMode && !selected && "opacity-80 hover:opacity-100"
        )}
      >
        {/* Header */}
        <div className="flex items-start justify-between mb-3">
          <div className="flex-1 min-w-0">
            <div className={cn("text-xs font-medium mb-0.5", DIVISION_COLORS[division])}>{division}</div>
            <div className="font-bold text-foreground text-sm sm:text-base leading-tight truncate">
              {team.team}
            </div>
            <div className="text-xl sm:text-2xl font-black text-muted-foreground/40 leading-none mt-0.5">
              {abbr}
            </div>
          </div>
          <div className="flex flex-col items-end gap-2 ml-2">
            <GradeBadge grade={letterGrade} size="lg" />
            <HealthBadge tier={healthTier} size="sm" />
          </div>
        </div>

        {/* Health Bar */}
        <div className="mb-3">
          <HealthBar tier={healthTier} avgPitches14d={avgPitches14d} avgIP14d={avgIP14d} avgReliefIPPerGame={avgReliefIPPerGame ?? 0} />
        </div>

        {/* Stats Row — all values from the 14-day window */}
        <div className="grid grid-cols-3 gap-2 mb-3">
          <div className="text-center bg-muted/50 rounded-lg p-2">
            <div className="text-xs text-muted-foreground mb-0.5">ERA</div>
            <div className={cn("font-bold text-sm", eraTextColor(era14d))}>
              {era14d?.toFixed(2) ?? "—"}
            </div>
          </div>
          <div className="text-center bg-muted/50 rounded-lg p-2">
            <div className="text-xs text-muted-foreground mb-0.5">WHIP</div>
            <div className={cn("font-bold text-sm", whipTextColor(whip14d))}>
              {whip14d?.toFixed(2) ?? "—"}
            </div>
          </div>
          <div className="text-center bg-muted/50 rounded-lg p-2">
            <div className="text-xs text-muted-foreground mb-0.5">Rel IP/G</div>
            <div className="font-bold text-sm text-foreground">{(avgReliefIPPerGame ?? 0).toFixed(1)}</div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <div className="flex items-center gap-1">
            <Users className="w-3 h-3" />
            <span>{pitcherCount} pitchers</span>
          </div>

          {/* IL Toggle — clickable, does not navigate */}
          {dlCount > 0 ? (
            <button
              type="button"
              onClick={handleIlToggle}
              className="flex items-center gap-1 text-orange-400 hover:text-orange-300 transition-colors rounded px-1 -mx-1 focus:outline-none focus:ring-1 focus:ring-orange-400/50"
            >
              <AlertCircle className="w-3 h-3" />
              <span>{dlCount} on IL</span>
              {ilExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            </button>
          ) : null}

          <div className={cn(
            "flex items-center gap-0.5",
            trendDirection === "improving" ? "text-emerald-400" : trendDirection === "declining" ? "text-red-400" : "text-muted-foreground"
          )}>
            {trendDirection === "improving" ? (
              <TrendingUp className="w-3 h-3" />
            ) : trendDirection === "declining" ? (
              <TrendingDown className="w-3 h-3" />
            ) : null}
            <span className="capitalize">{trendDirection}</span>
          </div>
        </div>

        {/* Expandable IL Player List */}
        <AnimatePresence>
          {ilExpanded && team.dl && team.dl.length > 0 && (
            <motion.div
              key="il-list"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              <div className="mt-3 pt-3 border-t border-orange-500/20">
                <div className="text-xs font-semibold text-orange-400/80 mb-2 flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" />
                  Injured List
                </div>
                <div className="space-y-1">
                  {team.dl.map((player, i) => (
                    <div key={i} className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className="text-muted-foreground/60 font-mono text-[10px] shrink-0">
                          {player.hand ?? "—"}
                        </span>
                        <span className="text-foreground/80 truncate">{player.name}</span>
                      </div>
                      {(player.ilType || player.injury) && (
                        <span className="text-orange-400/70 text-[10px] ml-2 shrink-0">
                          {player.ilType ?? player.injury}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {compareMode && selected && (
          <div className="mt-2 pt-2 border-t border-border/50 text-center text-xs text-primary font-medium">
            ✓ Selected for Comparison
          </div>
        )}
      </CardWrapper>
    </motion.div>
  );
}
