"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { Header } from "@/components/header";
import { cn } from "@/lib/utils";
import {
  Upload, FileSpreadsheet, CheckCircle2, XCircle, AlertTriangle,
  RefreshCw, Shield, BarChart3, Activity, ChevronDown, ChevronUp,
  TrendingUp, TrendingDown, Minus, History, Calendar, Users,
} from "lucide-react";
import UsersTab from "./UsersTab";

type UploadStatus = "idle" | "uploading" | "success" | "error";

interface TeamSnapshot {
  grade:              string | null;
  tier:               string | null;
  score:              number | null;
  era14d:             number | null;
  whip14d:            number | null;
  avgReliefIPPerGame: number | null;
}

interface TeamDiff {
  abbr:          string;
  name:          string;
  before:        TeamSnapshot;
  after:         TeamSnapshot;
  gradeChanged:  boolean;
  tierChanged:   boolean;
  scoreChanged:  boolean;
}

interface UploadResult {
  success:       boolean;
  message?:      string;
  error?:        string;
  updatedTeams?: string[];
  skippedTeams?: string[];
  warnings?:     string[];
  diff?: {
    changed:   TeamDiff[];
    unchanged: string[];
  };
  stats?: {
    totalPitcherRows: number;
    totalILRows:      number;
    teamsFound:       number;
    updatedTeams:     number;
    skippedTeams:     number;
    changedTeams:     number;
    unchangedTeams:   number;
  };
}

interface ChangeLogEntry {
  date:           string;
  timestamp:      string;
  filename:       string;
  teamsUpdated:   number;
  teamsChanged:   TeamDiff[];
  teamsUnchanged: number;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const TIER_LABEL: Record<string, string> = {
  veryLow: "Very Low", low: "Low", moderate: "Moderate",
  high: "High", veryHigh: "Very High",
};
const TIER_COLOR: Record<string, string> = {
  veryLow: "text-green-400", low: "text-green-300",
  moderate: "text-yellow-400", high: "text-orange-400", veryHigh: "text-red-400",
};
const GRADE_COLOR: Record<string, string> = {
  A: "text-green-400", B: "text-blue-400",
  C: "text-yellow-400", D: "text-orange-400", F: "text-red-400",
};

function Arrow({ before, after }: { before: number | string | null; after: number | string | null }) {
  if (before === after || before == null || after == null) return <Minus className="w-3 h-3 text-muted-foreground" />;
  const up = typeof before === "number" && typeof after === "number" ? after > before : false;
  // For grades: A > B > C > D > F (lower letter = better), so going A→F is worse (down arrow)
  return up
    ? <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
    : <TrendingDown className="w-3.5 h-3.5 text-red-400" />;
}

function ScoreArrow({ before, after }: { before: number | null; after: number | null }) {
  if (before == null || after == null || before === after) return <Minus className="w-3 h-3 text-muted-foreground inline" />;
  return after > before
    ? <TrendingUp className="w-3.5 h-3.5 text-emerald-400 inline ml-1" />
    : <TrendingDown className="w-3.5 h-3.5 text-red-400 inline ml-1" />;
}

function DiffRow({ diff }: { diff: TeamDiff }) {
  const hasChange = diff.gradeChanged || diff.tierChanged || diff.scoreChanged;
  return (
    <div className={cn(
      "grid grid-cols-[80px_1fr_1fr_1fr_1fr_1fr] gap-2 items-center py-2 px-3 rounded-lg text-xs",
      hasChange ? "bg-muted/30" : "bg-transparent opacity-60"
    )}>
      <span className="font-mono font-bold text-foreground">{diff.abbr}</span>

      {/* Grade */}
      <div className="flex items-center gap-1">
        <span className={cn("font-bold", GRADE_COLOR[diff.before.grade ?? ""] ?? "text-muted-foreground")}>
          {diff.before.grade ?? "—"}
        </span>
        <span className="text-muted-foreground/40">→</span>
        <span className={cn("font-bold", GRADE_COLOR[diff.after.grade ?? ""] ?? "text-muted-foreground")}>
          {diff.after.grade ?? "—"}
        </span>
        {diff.gradeChanged && <Arrow before={diff.before.grade} after={diff.after.grade} />}
      </div>

      {/* Tier */}
      <div className="flex items-center gap-1 flex-wrap">
        <span className={TIER_COLOR[diff.before.tier ?? ""] ?? "text-muted-foreground"}>
          {TIER_LABEL[diff.before.tier ?? ""] ?? "—"}
        </span>
        {diff.tierChanged && (
          <>
            <span className="text-muted-foreground/40">→</span>
            <span className={TIER_COLOR[diff.after.tier ?? ""] ?? "text-muted-foreground"}>
              {TIER_LABEL[diff.after.tier ?? ""] ?? "—"}
            </span>
          </>
        )}
      </div>

      {/* Score */}
      <div className="font-mono">
        <span className="text-muted-foreground">{diff.before.score ?? "—"}</span>
        {diff.scoreChanged && (
          <>
            <span className="text-muted-foreground/40 mx-1">→</span>
            <span className="text-foreground font-bold">{diff.after.score ?? "—"}</span>
            <ScoreArrow before={diff.before.score} after={diff.after.score} />
          </>
        )}
      </div>

      {/* WHIP */}
      <div className="font-mono text-muted-foreground">
        {diff.before.whip14d?.toFixed(2) ?? "—"}
        {diff.after.whip14d !== diff.before.whip14d && (
          <span className="ml-1 text-foreground">→ {diff.after.whip14d?.toFixed(2) ?? "—"}</span>
        )}
      </div>

      {/* Relief IP/G */}
      <div className="font-mono text-muted-foreground">
        {diff.before.avgReliefIPPerGame?.toFixed(2) ?? "—"}
        {diff.after.avgReliefIPPerGame !== diff.before.avgReliefIPPerGame && (
          <span className="ml-1 text-foreground">→ {diff.after.avgReliefIPPerGame?.toFixed(2) ?? "—"}</span>
        )}
      </div>
    </div>
  );
}

function DiffTable({ diffs, label }: { diffs: TeamDiff[]; label?: string }) {
  if (diffs.length === 0) return null;
  return (
    <div className="mt-3">
      {label && <div className="text-xs font-semibold text-muted-foreground mb-1 px-1">{label}</div>}
      {/* Header */}
      <div className="grid grid-cols-[80px_1fr_1fr_1fr_1fr_1fr] gap-2 px-3 py-1 text-[10px] text-muted-foreground/60 uppercase tracking-wide">
        <span>Team</span>
        <span>Grade</span>
        <span>Health Tier</span>
        <span>Score</span>
        <span>WHIP14d</span>
        <span>Rel IP/G</span>
      </div>
      <div className="space-y-0.5">
        {diffs.map(d => <DiffRow key={d.abbr} diff={d} />)}
      </div>
    </div>
  );
}

function LogEntryCard({ entry, defaultOpen = false }: { entry: ChangeLogEntry; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  const changedCount = entry.teamsChanged.length;
  const date = new Date(entry.timestamp).toLocaleString("en-US", {
    month: "short", day: "numeric", year: "numeric",
    hour: "numeric", minute: "2-digit", hour12: true,
  });

  return (
    <div className="border border-border/40 rounded-xl overflow-hidden">
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted/20 transition-colors text-left"
      >
        <div className="flex items-center gap-3">
          <Calendar className="w-4 h-4 text-muted-foreground flex-shrink-0" />
          <div>
            <div className="text-sm font-semibold text-foreground">{date}</div>
            <div className="text-xs text-muted-foreground">{entry.filename} · {entry.teamsUpdated} teams processed</div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {changedCount > 0 ? (
            <span className="px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-400 text-xs font-bold border border-amber-500/20">
              {changedCount} changed
            </span>
          ) : (
            <span className="px-2 py-0.5 rounded-full bg-muted/50 text-muted-foreground text-xs border border-border/40">
              no changes
            </span>
          )}
          {open ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
        </div>
      </button>

      {open && (
        <div className="px-4 pb-4 border-t border-border/30">
          {changedCount === 0 ? (
            <p className="text-sm text-muted-foreground mt-3">All {entry.teamsUpdated} teams had identical metrics after recalculation.</p>
          ) : (
            <>
              <DiffTable diffs={entry.teamsChanged} label={`${changedCount} team${changedCount > 1 ? "s" : ""} with metric changes`} />
              {entry.teamsUnchanged > 0 && (
                <p className="text-xs text-muted-foreground mt-2 px-1">{entry.teamsUnchanged} other teams had no metric changes.</p>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function AdminPageClient() {
  const [status,       setStatus]       = useState<UploadStatus>("idle");
  const [result,       setResult]       = useState<UploadResult | null>(null);
  const [dragOver,     setDragOver]     = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [showWarnings, setShowWarnings] = useState(false);
  const [showTeams,    setShowTeams]    = useState(false);
  const [log,          setLog]          = useState<ChangeLogEntry[]>([]);
  const [logLoading,   setLogLoading]   = useState(true);
  const [activeTab,    setActiveTab]    = useState<"upload" | "users">("upload");
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load change log on mount
  useEffect(() => {
    fetch("/api/change-log")
      .then(r => r.json())
      .then(d => { if (d.success) setLog(d.log ?? []); })
      .catch(() => {})
      .finally(() => setLogLoading(false));
  }, []);

  const handleFile = useCallback((file: File) => {
    const ext = file.name.split(".").pop()?.toLowerCase();
    if (!["xlsx", "xls"].includes(ext ?? "")) {
      setResult({ success: false, error: "Invalid file type. Please upload a .xlsx or .xls file." });
      setStatus("error");
      return;
    }
    setSelectedFile(file);
    setStatus("idle");
    setResult(null);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }, [handleFile]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  };

  const handleUpload = async () => {
    if (!selectedFile) return;
    setStatus("uploading");
    setResult(null);
    try {
      // Step 1: Get a short-lived client upload token from the server
      const tokenRes = await fetch("/api/upload-token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filename: selectedFile.name }),
      });
      if (!tokenRes.ok) {
        const e = await tokenRes.json().catch(() => ({}));
        throw new Error(e?.error ?? "Failed to get upload token");
      }
      const { clientToken, pathname } = await tokenRes.json();

      // Step 2: Upload file DIRECTLY to Blob from the browser (no 4.5 MB limit)
      const { put } = await import("@vercel/blob/client");
      const blob = await put(pathname, selectedFile, {
        access: "public",
        token:  clientToken,
      });

      // Step 3: Tell the server to process the uploaded Excel from Blob
      // 30-second client-side timeout prevents silent forever-hang on Vercel
      const uploadCtrl    = new AbortController();
      const uploadTimeout = setTimeout(() => uploadCtrl.abort(), 30_000);
      let res: Response;
      try {
        res = await fetch("/api/upload-data", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ blobUrl: blob.url, filename: selectedFile.name }),
          signal: uploadCtrl.signal,
        });
      } finally {
        clearTimeout(uploadTimeout);
      }
      let data: UploadResult;
      if (!res.ok && res.headers.get("content-type")?.includes("application/json") === false) {
        data = { success: false, error: `Server error (${res.status}). The file may be too large or the request timed out. Please try again.` };
      } else {
        data = await res.json().catch(() => ({ success: false, error: `Server error (${res.status}). Please try again.` }));
      }
      setResult(data);
      setStatus(data.success ? "success" : "error");
      if (data.success) {
        setSelectedFile(null);
        window.dispatchEvent(new CustomEvent("ubt-data-updated"));
        fetch("/api/change-log")
          .then(r => r.json())
          .then(d => { if (d.success) setLog(d.log ?? []); })
          .catch(() => {});
      }
    } catch (err: any) {
      setResult({ success: false, error: `Upload failed: ${err?.message ?? "Could not reach server"}` });
      setStatus("error");
    }
  };

  const resetForm = () => {
    setStatus("idle"); setResult(null); setSelectedFile(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const changedDiffs   = result?.diff?.changed ?? [];
  const unchangedAbbrs = result?.diff?.unchanged ?? [];

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8">

        {/* Page Header */}
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center">
            <Shield className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-black text-foreground">Data Admin</h1>
            <p className="text-muted-foreground text-sm">
              {activeTab === "upload" ? "Upload daily bullpen spreadsheet · Recalculates all health tiers & grades" : "Manage user accounts, roles, and permissions"}
            </p>
          </div>
        </div>

        {/* Tab Bar */}
        <div className="flex gap-1 bg-muted/30 border border-border/50 p-1 rounded-xl mb-6">
          {([
            { id: "upload", label: "Data Upload", icon: Upload },
            { id: "users",  label: "Users",       icon: Users  },
          ] as const).map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className={cn(
                "flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-medium transition-all",
                activeTab === id
                  ? "bg-card border border-border/60 text-white shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Icon className="w-4 h-4" />
              {label}
            </button>
          ))}
        </div>

        {/* Users Tab */}
        {activeTab === "users" && <UsersTab />}

        {/* Upload Tab */}
        {activeTab === "upload" && (
          <div>
        {/* Info Banner */}
        <div className="mb-6 bg-primary/5 border border-primary/20 rounded-xl p-4 text-sm">
          <div className="flex items-start gap-2">
            <Activity className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
            <div className="text-muted-foreground space-y-1">
              <div><span className="font-semibold text-foreground">How it works:</span> Upload your daily .xlsx spreadsheet and the app automatically re-runs all health tier and grade calculations before updating the live dashboard.</div>
              <div className="text-xs mt-2 space-y-0.5">
                <div>• <strong className="text-foreground">Rows 4–109:</strong> Relief pitchers — used in all bullpen calculations</div>
                <div>• <strong className="text-foreground">Rows 110–181:</strong> Starting pitchers — stored separately, not used in bullpen metrics</div>
                <div>• <strong className="text-orange-400">Rows 182+:</strong> Injured List players — shown on team pages only</div>
              </div>
            </div>
          </div>
        </div>

        {/* Upload Area */}
        <div
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          onClick={() => !selectedFile && fileInputRef.current?.click()}
          className={cn(
            "relative border-2 border-dashed rounded-2xl p-10 text-center transition-all duration-200 cursor-pointer",
            dragOver
              ? "border-primary bg-primary/10 scale-[1.01]"
              : selectedFile
              ? "border-emerald-500/50 bg-emerald-500/5 cursor-default"
              : "border-border/50 hover:border-border hover:bg-muted/30"
          )}
        >
          <input ref={fileInputRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={handleInputChange} />
          {selectedFile ? (
            <div className="space-y-3">
              <div className="flex items-center justify-center gap-3">
                <FileSpreadsheet className="w-10 h-10 text-emerald-400" />
                <div className="text-left">
                  <div className="font-bold text-foreground">{selectedFile.name}</div>
                  <div className="text-sm text-muted-foreground">{(selectedFile.size / 1024).toFixed(1)} KB · Ready to upload</div>
                </div>
              </div>
              <button onClick={(e) => { e.stopPropagation(); resetForm(); }} className="text-xs text-muted-foreground hover:text-foreground transition-colors underline">
                Choose a different file
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex justify-center">
                <div className={cn("w-16 h-16 rounded-2xl flex items-center justify-center transition-colors", dragOver ? "bg-primary/20" : "bg-muted/50")}>
                  <Upload className={cn("w-8 h-8", dragOver ? "text-primary" : "text-muted-foreground")} />
                </div>
              </div>
              <div>
                <div className="font-semibold text-foreground mb-1">{dragOver ? "Drop it!" : "Drag & drop your spreadsheet"}</div>
                <div className="text-sm text-muted-foreground">or <span className="text-primary font-medium">click to browse</span></div>
                <div className="text-xs text-muted-foreground mt-1">.xlsx and .xls supported</div>
              </div>
            </div>
          )}
        </div>

        {/* Upload Button */}
        {selectedFile && status !== "success" && (
          <div className="mt-4">
            <button
              onClick={handleUpload}
              disabled={status === "uploading"}
              className={cn(
                "w-full py-3 px-6 rounded-xl font-bold text-sm transition-all duration-200 flex items-center justify-center gap-2",
                status === "uploading"
                  ? "bg-primary/50 text-primary-foreground/70 cursor-not-allowed"
                  : "bg-primary text-primary-foreground hover:bg-primary/90 active:scale-[0.99]"
              )}
            >
              {status === "uploading" ? (
                <><RefreshCw className="w-4 h-4 animate-spin" />Uploading &amp; Recalculating…</>
              ) : (
                <><BarChart3 className="w-4 h-4" />Upload &amp; Recalculate All Stats</>
              )}
            </button>
          </div>
        )}

        {/* ── Result Panel ─────────────────────────────────────────────────── */}
        {result && (
          <div className={cn(
            "mt-4 rounded-xl border p-4",
            result.success ? "bg-emerald-500/10 border-emerald-500/30" : "bg-red-500/10 border-red-500/30"
          )}>
            <div className="flex items-start gap-3">
              {result.success
                ? <CheckCircle2 className="w-5 h-5 text-emerald-400 flex-shrink-0 mt-0.5" />
                : <XCircle    className="w-5 h-5 text-red-400     flex-shrink-0 mt-0.5" />}
              <div className="flex-1 min-w-0">
                <div className={cn("font-bold", result.success ? "text-emerald-400" : "text-red-400")}>
                  {result.success ? "Upload successful!" : "Upload failed"}
                </div>
                <div className="text-sm text-muted-foreground mt-0.5">{result.message ?? result.error}</div>

                {/* Stats Grid */}
                {result.success && result.stats && (
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-3">
                    {[
                      { label: "Teams Updated",   value: result.stats.updatedTeams,     color: "text-emerald-400" },
                      { label: "Pitchers Parsed",  value: result.stats.totalPitcherRows, color: "text-foreground" },
                      { label: "IL Players",       value: result.stats.totalILRows,      color: "text-orange-400" },
                      { label: "Metrics Changed",  value: result.stats.changedTeams,     color: changedDiffs.length > 0 ? "text-amber-400" : "text-muted-foreground" },
                    ].map((s) => (
                      <div key={s.label} className="bg-background/50 rounded-lg p-2 text-center">
                        <div className={cn("text-xl font-black", s.color)}>{s.value}</div>
                        <div className="text-xs text-muted-foreground">{s.label}</div>
                      </div>
                    ))}
                  </div>
                )}

                {/* ── DIFF SECTION ──────────────────────────────────────── */}
                {result.success && (
                  <div className="mt-4 border-t border-border/30 pt-4">
                    <div className="flex items-center gap-2 mb-1">
                      <TrendingUp className="w-4 h-4 text-muted-foreground" />
                      <span className="text-sm font-semibold text-foreground">Calculation Changes</span>
                    </div>

                    {changedDiffs.length === 0 ? (
                      <p className="text-sm text-muted-foreground">
                        ✓ All {result.stats?.updatedTeams} teams recalculated — no metric changes detected. Data is up to date.
                      </p>
                    ) : (
                      <>
                        <p className="text-xs text-muted-foreground mb-2">
                          {changedDiffs.length} team{changedDiffs.length !== 1 ? "s" : ""} had metric changes after recalculation.
                          {unchangedAbbrs.length > 0 && ` ${unchangedAbbrs.length} unchanged.`}
                        </p>

                        {/* Column headers */}
                        <div className="grid grid-cols-[80px_1fr_1fr_1fr_1fr_1fr] gap-2 px-3 py-1 text-[10px] text-muted-foreground/60 uppercase tracking-wide">
                          <span>Team</span><span>Grade</span><span>Health Tier</span>
                          <span>Score</span><span>WHIP14d</span><span>Rel IP/G</span>
                        </div>

                        {/* Changed teams */}
                        <div className="space-y-0.5">
                          {changedDiffs.map(d => <DiffRow key={d.abbr} diff={d} />)}
                        </div>

                        {/* Unchanged teams toggle */}
                        {unchangedAbbrs.length > 0 && (
                          <div className="mt-2">
                            <button
                              onClick={() => setShowTeams(v => !v)}
                              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                            >
                              Unchanged teams {showTeams ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                            </button>
                            {showTeams && (
                              <div className="mt-1.5 flex flex-wrap gap-1.5">
                                {unchangedAbbrs.map(a => (
                                  <span key={a} className="px-2 py-0.5 bg-muted/50 text-muted-foreground border border-border/50 rounded text-xs font-mono">{a}</span>
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                      </>
                    )}
                  </div>
                )}

                {/* Warnings */}
                {(result.warnings?.length ?? 0) > 0 && (
                  <div className="mt-3">
                    <button onClick={() => setShowWarnings(v => !v)} className="flex items-center gap-1 text-xs text-amber-400 hover:text-amber-300 font-medium">
                      <AlertTriangle className="w-3.5 h-3.5" />
                      {result.warnings!.length} warning{result.warnings!.length > 1 ? "s" : ""}
                      {showWarnings ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                    </button>
                    {showWarnings && (
                      <ul className="mt-2 space-y-1">
                        {result.warnings!.map((w, i) => (
                          <li key={i} className="text-xs text-amber-300/80 flex items-start gap-1.5">
                            <span className="text-amber-400/50 mt-0.5">•</span> {w}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Actions */}
            <div className="mt-4 flex flex-wrap gap-2">
              {result.success && (
                <a href="/" className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors">
                  View Live Dashboard →
                </a>
              )}
              <button onClick={resetForm} className="px-4 py-2 rounded-lg border border-border/50 text-sm text-muted-foreground hover:text-foreground hover:border-border transition-colors">
                {result.success ? "Upload Another File" : "Try Again"}
              </button>
            </div>
          </div>
        )}

        {/* ── CHANGE LOG HISTORY ──────────────────────────────────────────── */}
        <div className="mt-10">
          <div className="flex items-center gap-2 mb-4">
            <History className="w-5 h-5 text-muted-foreground" />
            <h2 className="text-lg font-bold text-foreground">Upload History</h2>
            {log.length > 0 && (
              <span className="text-xs text-muted-foreground bg-muted/50 px-2 py-0.5 rounded-full border border-border/40">
                {log.length} upload{log.length !== 1 ? "s" : ""}
              </span>
            )}
          </div>

          {logLoading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground py-8 justify-center">
              <RefreshCw className="w-4 h-4 animate-spin" /> Loading history…
            </div>
          ) : log.length === 0 ? (
            <div className="border border-dashed border-border/40 rounded-xl p-8 text-center">
              <History className="w-8 h-8 text-muted-foreground/40 mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">No upload history yet.</p>
              <p className="text-xs text-muted-foreground/60 mt-1">Each upload will be logged here with a full metric diff.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {log.map((entry, i) => (
                <LogEntryCard key={entry.timestamp} entry={entry} defaultOpen={i === 0 && result?.success === true} />
              ))}
            </div>
          )}
        </div>

        {/* Instructions Card */}
        <div className="mt-10 bg-card border border-border/50 rounded-xl p-5">
          <h3 className="font-bold text-foreground mb-3 text-sm">Expected Spreadsheet Format</h3>
          <div className="grid sm:grid-cols-2 gap-4 text-xs text-muted-foreground">
            <div>
              <div className="font-semibold text-foreground mb-1.5">Column Headers (auto-detected)</div>
              <div className="space-y-0.5">
                {[
                  ["Team",          "Team name or abbreviation"],
                  ["Name / Player", "Pitcher's full name"],
                  ["B/T or Hand",   "Throws: L or R"],
                  ["GP",            "Games played (season)"],
                  ["IP",            "Innings pitched (season)"],
                  ["ERA",           "Earned run average (season)"],
                  ["WHIP",          "Walks + hits per inning"],
                  ["Pitches / NP",  "Pitch count (season)"],
                  ["GP14d",         "Games played last 14 days"],
                  ["IP14d",         "Innings pitched last 14 days"],
                  ["ERA14d",        "ERA last 14 days"],
                  ["Pitches14d",    "Pitches last 14 days"],
                ].map(([col, desc]) => (
                  <div key={col} className="flex items-start gap-2">
                    <code className="bg-muted/50 px-1.5 py-0.5 rounded text-[10px] font-mono text-foreground flex-shrink-0">{col}</code>
                    <span>{desc}</span>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <div className="font-semibold text-foreground mb-1.5">Row Structure</div>
              <div className="space-y-2">
                <div className="bg-muted/30 rounded-lg p-2.5">
                  <div className="font-medium text-foreground mb-1">Rows 4–109: Relief Pitchers</div>
                  <div className="font-medium text-blue-400 mb-1 mt-1">Rows 110–181: Starting Pitchers</div>
                  <p>Starters are stored for future use but not included in any bullpen calculations.</p>
                </div>
                <div className="bg-orange-500/10 border border-orange-500/20 rounded-lg p-2.5">
                  <div className="font-medium text-orange-400 mb-1">Rows 182+: Injured List</div>
                  <p>IL players are shown on team pages but excluded from active calculations.</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        </div>
        )}
      </div>
    </div>
  );
}
