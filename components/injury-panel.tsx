"use client";

import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import { AlertCircle, RefreshCw, ExternalLink } from "lucide-react";
import type { DLPlayer } from "@/lib/types";

interface InjuryPanelProps {
  dl: DLPlayer[];
  espnId: string;
  className?: string;
}

const LENGTH_COLOR: Record<string, string> = {
  "60 Day DL": "text-red-400 bg-red-400/10 border-red-400/30",
  "60 day DL": "text-red-400 bg-red-400/10 border-red-400/30",
  "15 Day DL": "text-amber-400 bg-amber-400/10 border-amber-400/30",
  "15 day DL": "text-amber-400 bg-amber-400/10 border-amber-400/30",
  "15": "text-amber-400 bg-amber-400/10 border-amber-400/30",
  "10": "text-yellow-400 bg-yellow-400/10 border-yellow-400/30",
};

function getLengthStyle(length: string): string {
  return LENGTH_COLOR[length] ?? "text-orange-400 bg-orange-400/10 border-orange-400/30";
}

export function InjuryPanel({ dl, espnId, className }: InjuryPanelProps) {
  const [espnData, setEspnData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [lastFetched, setLastFetched] = useState<string | null>(null);

  const fetchESPN = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/injuries?team=${espnId}`);
      if (res.ok) {
        const data = await res.json();
        setEspnData(data.injuries || []);
        setLastFetched(new Date().toLocaleTimeString());
      }
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchESPN();
  }, [espnId]);

  if (dl.length === 0 && espnData.length === 0) {
    return (
      <div className={cn("flex items-center justify-center py-8 text-muted-foreground text-sm", className)}>
        <div className="text-center">
          <div className="text-2xl mb-2">✅</div>
          <div>No active IL placements</div>
        </div>
      </div>
    );
  }

  return (
    <div className={cn("space-y-3", className)}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-orange-400" />
          <span className="text-sm font-semibold text-foreground">
            Injured List ({dl.length} from report{espnData.length > 0 ? ` + ESPN updates` : ""})
          </span>
        </div>
        <button
          onClick={fetchESPN}
          disabled={loading}
          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          <RefreshCw className={cn("w-3 h-3", loading && "animate-spin")} />
          {lastFetched ? `Updated ${lastFetched}` : "Load ESPN"}
        </button>
      </div>

      {/* Report Data */}
      <div className="space-y-2">
        {dl.map((player, idx) => (
          <div
            key={idx}
            className="rounded-lg border border-border/50 bg-muted/30 p-3"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium text-sm text-foreground">{player.name}</span>
                  {player.hand && (
                    <span className={cn(
                      "text-xs px-1.5 py-0.5 rounded border",
                      player.hand === "L" ? "bg-blue-500/10 border-blue-500/30 text-blue-400" : "bg-orange-500/10 border-orange-500/30 text-orange-400"
                    )}>
                      {player.hand}HP
                    </span>
                  )}
                  {player.length && (
                    <span className={cn("text-xs px-1.5 py-0.5 rounded border", getLengthStyle(player.length))}>
                      {player.length}
                    </span>
                  )}
                </div>
                {player.description && player.description !== 'nan' && (
                  <div className="text-xs text-muted-foreground mt-1">
                    🩺 {player.description}
                  </div>
                )}
                {player.notes && player.notes !== 'nan' && (
                  <div className="text-xs text-amber-400/80 mt-0.5">
                    ⏱ {player.notes}
                  </div>
                )}
                {player.startDate && (
                  <div className="text-xs text-muted-foreground/60 mt-0.5">
                    Started: {new Date(player.startDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* ESPN Live Data */}
      {espnData.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-xs text-muted-foreground border-t border-border/50 pt-2">
            <ExternalLink className="w-3 h-3" />
            <span>Live from ESPN</span>
          </div>
          {espnData.map((inj, idx) => (
            <div key={idx} className="rounded-lg border border-blue-500/20 bg-blue-500/5 p-3">
              <div className="font-medium text-sm text-foreground">{inj.player}</div>
              {inj.status && <div className="text-xs text-blue-400 mt-0.5">{inj.status}</div>}
              {inj.description && <div className="text-xs text-muted-foreground mt-0.5">{inj.description}</div>}
            </div>
          ))}
        </div>
      )}

      {/* ESPN link */}
      <a
        href={`https://www.espn.com/mlb/team/injuries/_/name/${espnId}`}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-1.5 text-xs text-primary hover:text-primary/80 transition-colors"
      >
        <ExternalLink className="w-3 h-3" />
        View full injury report on ESPN
      </a>
    </div>
  );
}
