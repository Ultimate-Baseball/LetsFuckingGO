"use client";

import { useState, useMemo, useEffect, useRef } from "react";
import { computeCompositeScore, compositeRank } from "@/lib/calculations";
import { motion, AnimatePresence } from "framer-motion";
import { Header } from "@/components/header";
import { TeamCard } from "@/components/team-card";
import { TEAMS } from "@/lib/mlb-data";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Search, Filter, Activity, AlertCircle, SlidersHorizontal, X, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import type { HealthTier, LetterGrade } from "@/lib/types";

const DIVISIONS = ["All", "AL East", "AL Central", "AL West", "NL East", "NL Central", "NL West"];
const HEALTH_FILTERS: { label: string; value: HealthTier | "all" }[] = [
  { label: "All",         value: "all"      },
  { label: "🟢 Very Low", value: "veryLow"  },
  { label: "🟢 Low",      value: "low"      },
  { label: "🟡 Moderate", value: "moderate" },
  { label: "🟠 High",     value: "high"     },
  { label: "🔴 Very High",value: "veryHigh" },
];
const GRADE_FILTERS: LetterGrade[] = ["A", "B", "C", "D", "F"];

const GRADE_COLOR: Record<LetterGrade, string> = {
  A: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
  B: "bg-cyan-500/20 text-cyan-400 border-cyan-500/30",
  C: "bg-amber-500/20 text-amber-400 border-amber-500/30",
  D: "bg-orange-500/20 text-orange-400 border-orange-500/30",
  F: "bg-red-500/20 text-red-400 border-red-500/30",
};

export default function DashboardPage() {
  const [search, setSearch] = useState("");
  const [divisionFilter, setDivisionFilter] = useState("All");
  const [healthFilter, setHealthFilter] = useState<HealthTier | "all">("all");
  const [gradeFilter, setGradeFilter] = useState<LetterGrade | "all">("all");
  const [sortBy, setSortBy] = useState<"composite" | "grade" | "era" | "health" | "team">("composite");

  // Mobile filter panel state
  const [filtersOpen, setFiltersOpen] = useState(false);
  // Track scroll position to collapse/expand search bar
  const [scrolled, setScrolled] = useState(false);
  const [searchFocused, setSearchFocused] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 80);
      // Auto-close filter panel when scrolling down on mobile
      if (window.scrollY > 80 && filtersOpen) {
        setFiltersOpen(false);
      }
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, [filtersOpen]);

  const GRADE_ORDER: Record<string, number> = { A: 0, B: 1, C: 2, D: 3, F: 4 };
  const HEALTH_ORDER: Record<string, number> = { veryLow: 0, low: 1, moderate: 2, high: 3, veryHigh: 4 };

  const filtered = useMemo(() => {
    let result = TEAMS;

    if (search) {
      const q = search.toLowerCase();
      result = result.filter(
        (t) => t.team.toLowerCase().includes(q) || t.abbr.toLowerCase().includes(q)
      );
    }

    if (divisionFilter !== "All") {
      result = result.filter((t) => t.division === divisionFilter);
    }

    if (healthFilter !== "all") {
      result = result.filter((t) => t.metrics.healthTier === healthFilter);
    }

    if (gradeFilter !== "all") {
      result = result.filter((t) => t.metrics.letterGrade === gradeFilter);
    }

    return [...result].sort((a, b) => {
      switch (sortBy) {
        case "composite": {
          const aScore = a.metrics.compositeScore ?? computeCompositeScore(a.metrics.letterGrade, a.metrics.healthTier);
          const bScore = b.metrics.compositeScore ?? computeCompositeScore(b.metrics.letterGrade, b.metrics.healthTier);
          return bScore - aScore; // higher composite = better = first
        }
        case "grade":
          return GRADE_ORDER[a.metrics.letterGrade] - GRADE_ORDER[b.metrics.letterGrade];
        case "era":
          return (a.metrics.era14d ?? 99) - (b.metrics.era14d ?? 99);
        case "health":
          return HEALTH_ORDER[a.metrics.healthTier] - HEALTH_ORDER[b.metrics.healthTier];
        case "team":
          return a.team.localeCompare(b.team);
        default:
          return 0;
      }
    });
  }, [search, divisionFilter, healthFilter, gradeFilter, sortBy]);

  // Active filter count (for badge indicator)
  const activeFilterCount = [
    divisionFilter !== "All",
    healthFilter !== "all",
    gradeFilter !== "all",
  ].filter(Boolean).length;

  // Stats for hero section
  const gradeDistribution = TEAMS.reduce((acc, t) => {
    acc[t.metrics.letterGrade] = (acc[t.metrics.letterGrade] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const totalIL = TEAMS.reduce((a, t) => a + t.metrics.dlCount, 0);
  const avgLeagueERA = (
    TEAMS.reduce((a, t) => a + (t.metrics.era14d ?? 0), 0) / TEAMS.length
  ).toFixed(2);

  const clearAllFilters = () => {
    setSearch("");
    setDivisionFilter("All");
    setHealthFilter("all");
    setGradeFilter("all");
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />

      {/* Hero Banner */}
      <div className="relative baseball-pattern border-b border-border/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
          <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
            {/* Title */}
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Activity className="w-4 h-4 text-primary" />
                <span className="text-xs font-semibold text-primary uppercase tracking-wider">
                  2026 Season Live
                </span>
              </div>
              <h1 className="text-xl sm:text-3xl font-black text-foreground mb-1">
                Ultimate Baseball Tool
              </h1>
              <p className="text-muted-foreground text-xs sm:text-sm max-w-md">
                Real-time health tiers and effectiveness grades for all 30 MLB bullpens.
              </p>
            </div>

            {/* League Stats */}
            <div className="flex flex-wrap gap-2 sm:gap-3">
              <div className="bg-muted/50 border border-border/50 rounded-xl p-2.5 sm:p-3 min-w-[80px] text-center">
                <div className="text-xl sm:text-2xl font-black text-foreground">{avgLeagueERA}</div>
                <div className="text-xs text-muted-foreground">
                  League ERA
                </div>
              </div>
              <div className="bg-muted/50 border border-border/50 rounded-xl p-2.5 sm:p-3 min-w-[80px] text-center">
                <div className="flex items-center justify-center gap-1 mb-0.5">
                  <AlertCircle className="w-3.5 h-3.5 text-orange-400" />
                  <span className="text-xl sm:text-2xl font-black text-orange-400">{totalIL}</span>
                </div>
                <div className="text-xs text-muted-foreground">Total on IL</div>
              </div>
              <div className="bg-muted/50 border border-border/50 rounded-xl p-2.5 sm:p-3">
                <div className="flex gap-1.5 mb-1">
                  {(["A", "B", "C", "D", "F"] as LetterGrade[]).map((g) => (
                    <div key={g} className="text-center">
                      <div
                        className={cn(
                          "text-xs font-bold w-6 h-6 sm:w-7 sm:h-7 rounded flex items-center justify-center border",
                          GRADE_COLOR[g]
                        )}
                      >
                        {g}
                      </div>
                      <div className="text-xs text-muted-foreground mt-0.5">
                        {gradeDistribution[g] || 0}
                      </div>
                    </div>
                  ))}
                </div>
                <div className="text-xs text-muted-foreground text-center">Grades</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── STICKY FILTER BAR ─────────────────────────────────────────────────── */}
      {/* Desktop: always full; Mobile: compact strip with expand toggle */}
      <div className={cn(
        "sticky top-16 z-40 bg-background/95 backdrop-blur border-b border-border/50 transition-all duration-200",
      )}>
        {/* ── COMPACT MOBILE STRIP (visible when scrolled, mobile only) ── */}
        <div className={cn(
          "sm:hidden transition-all duration-200",
          scrolled && !searchFocused ? "block" : "hidden"
        )}>
          <div className="max-w-7xl mx-auto px-3 py-2 flex items-center gap-2">
            {/* Compact search */}
            <div
              className="flex items-center gap-1.5 flex-1 bg-muted/50 border border-border/50 rounded-lg px-2.5 py-1.5 cursor-text"
              onClick={() => {
                setScrolled(false);
                setSearchFocused(true);
                setTimeout(() => searchRef.current?.focus(), 50);
              }}
            >
              <Search className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
              <span className="text-xs text-muted-foreground truncate">
                {search || "Search teams…"}
              </span>
            </div>

            {/* Filter toggle with active count */}
            <button
              onClick={() => setFiltersOpen((v) => !v)}
              className={cn(
                "flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-medium transition-colors flex-shrink-0",
                filtersOpen || activeFilterCount > 0
                  ? "bg-primary/20 text-primary border-primary/40"
                  : "bg-muted/50 text-muted-foreground border-border/50"
              )}
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
              Filters
              {activeFilterCount > 0 && (
                <span className="bg-primary text-primary-foreground text-[10px] w-4 h-4 rounded-full flex items-center justify-center font-bold">
                  {activeFilterCount}
                </span>
              )}
              <ChevronDown className={cn("w-3 h-3 transition-transform", filtersOpen && "rotate-180")} />
            </button>

            {/* Sort compact */}
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="text-xs bg-muted/50 border border-border/50 rounded-lg px-2 py-1.5 text-foreground flex-shrink-0"
            >
              <option value="composite">Overall ★</option>
              <option value="grade">Grade</option>
              <option value="era">ERA</option>
              <option value="health">Health</option>
              <option value="team">A–Z</option>
            </select>
          </div>

          {/* Expandable filter panel (mobile, compact mode) */}
          <AnimatePresence>
            {filtersOpen && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden border-t border-border/30"
              >
                <div className="max-w-7xl mx-auto px-3 py-3 space-y-2">
                  {/* Division */}
                  <div className="flex gap-1 flex-wrap">
                    {DIVISIONS.slice(0, 4).map((d) => (
                      <button
                        key={d}
                        onClick={() => setDivisionFilter(d)}
                        className={cn(
                          "px-2 py-1 rounded-md text-xs font-medium border transition-colors",
                          divisionFilter === d
                            ? "bg-primary/20 text-primary border-primary/40"
                            : "text-muted-foreground border-border/50"
                        )}
                      >
                        {d}
                      </button>
                    ))}
                    <select
                      value={DIVISIONS.slice(4).includes(divisionFilter) ? divisionFilter : ""}
                      onChange={(e) => e.target.value && setDivisionFilter(e.target.value)}
                      className={cn(
                        "px-2 py-1 rounded-md text-xs font-medium border bg-background",
                        DIVISIONS.slice(4).includes(divisionFilter)
                          ? "text-primary border-primary/40"
                          : "text-muted-foreground border-border/50"
                      )}
                    >
                      <option value="">NL →</option>
                      {DIVISIONS.slice(4).map((d) => (
                        <option key={d} value={d}>{d}</option>
                      ))}
                    </select>
                  </div>
                  {/* Health + Grade */}
                  <div className="flex gap-3 flex-wrap">
                    <div className="flex gap-1">
                      {HEALTH_FILTERS.map((f) => (
                        <button
                          key={f.value}
                          onClick={() => setHealthFilter(f.value)}
                          className={cn(
                            "px-2 py-1 rounded-md text-xs font-medium border transition-colors",
                            healthFilter === f.value
                              ? "bg-primary/20 text-primary border-primary/40"
                              : "text-muted-foreground border-border/50"
                          )}
                        >
                          {f.label}
                        </button>
                      ))}
                    </div>
                    <div className="flex gap-1">
                      {GRADE_FILTERS.map((g) => (
                        <button
                          key={g}
                          onClick={() => setGradeFilter(gradeFilter === g ? "all" : g)}
                          className={cn(
                            "w-7 h-7 rounded text-xs font-bold border transition-colors",
                            gradeFilter === g
                              ? GRADE_COLOR[g]
                              : "text-muted-foreground border-border/50"
                          )}
                        >
                          {g}
                        </button>
                      ))}
                    </div>
                  </div>
                  {activeFilterCount > 0 && (
                    <button onClick={clearAllFilters} className="text-xs text-primary hover:underline">
                      Clear all filters
                    </button>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* ── FULL FILTER BAR (desktop always; mobile when at top or search focused) ── */}
        <div className={cn(
          "transition-all duration-200",
          // On mobile, only show when NOT in compact mode
          scrolled && !searchFocused ? "hidden sm:block" : "block"
        )}>
          <div className="max-w-7xl mx-auto px-4 sm:px-6 py-2.5 sm:py-3">
            <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
              {/* Search */}
              <div className="relative flex-1 max-w-xs">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                <Input
                  ref={searchRef}
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  onFocus={() => setSearchFocused(true)}
                  onBlur={() => setSearchFocused(false)}
                  placeholder="Search teams…"
                  className="pl-8 h-8 text-sm bg-muted/50 border-border/50"
                />
                {search && (
                  <button
                    onClick={() => setSearch("")}
                    className="absolute right-2 top-1/2 -translate-y-1/2"
                  >
                    <X className="w-3.5 h-3.5 text-muted-foreground hover:text-foreground" />
                  </button>
                )}
              </div>

              {/* Division Filter */}
              <div className="flex gap-1 flex-wrap">
                {DIVISIONS.slice(0, 4).map((d) => (
                  <button
                    key={d}
                    onClick={() => setDivisionFilter(d)}
                    className={cn(
                      "px-2.5 py-1 rounded-md text-xs font-medium transition-colors border",
                      divisionFilter === d
                        ? "bg-primary/20 text-primary border-primary/40"
                        : "text-muted-foreground border-border/50 hover:border-border hover:text-foreground"
                    )}
                  >
                    {d}
                  </button>
                ))}
                <select
                  value={DIVISIONS.slice(4).includes(divisionFilter) ? divisionFilter : ""}
                  onChange={(e) => e.target.value && setDivisionFilter(e.target.value)}
                  className={cn(
                    "px-2 py-1 rounded-md text-xs font-medium transition-colors border bg-background",
                    DIVISIONS.slice(4).includes(divisionFilter)
                      ? "text-primary border-primary/40"
                      : "text-muted-foreground border-border/50"
                  )}
                >
                  <option value="">NL →</option>
                  {DIVISIONS.slice(4).map((d) => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </select>
              </div>

              {/* Health Filter */}
              <div className="flex gap-1 flex-wrap">
                {HEALTH_FILTERS.map((f) => (
                  <button
                    key={f.value}
                    onClick={() => setHealthFilter(f.value)}
                    className={cn(
                      "px-2.5 py-1 rounded-md text-xs font-medium transition-colors border",
                      healthFilter === f.value
                        ? "bg-primary/20 text-primary border-primary/40"
                        : "text-muted-foreground border-border/50 hover:text-foreground"
                    )}
                  >
                    {f.label}
                  </button>
                ))}
              </div>

              {/* Grade Filter */}
              <div className="flex gap-1">
                {GRADE_FILTERS.map((g) => (
                  <button
                    key={g}
                    onClick={() => setGradeFilter(gradeFilter === g ? "all" : g)}
                    className={cn(
                      "w-7 h-7 rounded text-xs font-bold border transition-colors",
                      gradeFilter === g
                        ? GRADE_COLOR[g]
                        : "text-muted-foreground border-border/50 hover:text-foreground"
                    )}
                  >
                    {g}
                  </button>
                ))}
              </div>

              {/* Sort */}
              <div className="flex items-center gap-1.5 ml-auto">
                <Filter className="w-3.5 h-3.5 text-muted-foreground" />
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as any)}
                  className="text-xs bg-muted/50 border border-border/50 rounded-md px-2 py-1 text-foreground"
                >
                  <option value="composite">Sort: Overall ★</option>
                  <option value="grade">Sort: Grade</option>
                  <option value="era">Sort: ERA</option>
                  <option value="health">Sort: Health</option>
                  <option value="team">Sort: Team Name</option>
                </select>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Team Grid */}
      <div className="max-w-7xl mx-auto px-3 sm:px-6 py-4 sm:py-6">
        {filtered.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground">
            <div className="text-4xl mb-3">⚾</div>
            <div className="font-semibold">No teams match your filters</div>
            <button
              onClick={clearAllFilters}
              className="mt-2 text-sm text-primary hover:underline"
            >
              Clear all filters
            </button>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between mb-3 sm:mb-4">
              <div className="text-xs sm:text-sm text-muted-foreground">
                Showing{" "}
                <span className="text-foreground font-medium">{filtered.length}</span> of 30 teams
              </div>
              <div className="hidden sm:flex items-center gap-3 text-xs text-muted-foreground">
                <div className="flex items-center gap-1">
                  <div className="w-3 h-3 rounded-full bg-emerald-500" /> Fresh
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-3 h-3 rounded-full bg-amber-500" /> Moderate
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-3 h-3 rounded-full bg-orange-500" /> Heavy
                </div>
              </div>
            </div>
            {/* Grid: 2 cols on small mobile, 2 on sm, 3 on md, 4 on lg, 5 on xl */}
            <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2 sm:gap-3">
              {filtered.map((team, idx) => (
                <TeamCard key={team.abbr} team={team} index={idx} />
              ))}
            </div>
          </>
        )}
      </div>

      {/* Legend Footer */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 pb-8">
        <div className="bg-muted/30 border border-border/50 rounded-xl p-4">
          <div className="text-center text-muted-foreground/60 text-xs">
            Data powered by Picks2click · Auto-updates daily at 10:00 AM ET · Season: 2026
          </div>
        </div>
      </div>
    </div>
  );
}
