import { cn } from "@/lib/utils";
import type { HealthTier } from "@/lib/types";
import { computeTeamUsageBarPct } from "@/lib/health";

interface HealthBadgeProps {
  tier: HealthTier;
  showLabel?: boolean;
  size?: "sm" | "md" | "lg";
  className?: string;
}

const TIER_CONFIG = {
  veryLow: {
    label: "Very Low",
    sublabel: "Elite Arms",
    color: "bg-emerald-500",
    textColor: "text-emerald-400",
    borderColor: "border-emerald-500/40",
    bgLight: "bg-emerald-500/10",
    dot: "bg-emerald-400",
  },
  low: {
    label: "Low",
    sublabel: "Fresh Arms",
    color: "bg-green-500",
    textColor: "text-green-400",
    borderColor: "border-green-500/40",
    bgLight: "bg-green-500/10",
    dot: "bg-green-400",
  },
  moderate: {
    label: "Moderate",
    sublabel: "Normal Load",
    color: "bg-amber-500",
    textColor: "text-amber-400",
    borderColor: "border-amber-500/40",
    bgLight: "bg-amber-500/10",
    dot: "bg-amber-400",
  },
  high: {
    label: "High",
    sublabel: "Heavy Load",
    color: "bg-orange-500",
    textColor: "text-orange-400",
    borderColor: "border-orange-500/40",
    bgLight: "bg-orange-500/10",
    dot: "bg-orange-400",
  },
  veryHigh: {
    label: "Very High",
    sublabel: "Overworked",
    color: "bg-red-500",
    textColor: "text-red-400",
    borderColor: "border-red-500/40",
    bgLight: "bg-red-500/10",
    dot: "bg-red-400",
  },
};

export function HealthBadge({ tier, showLabel = true, size = "md", className }: HealthBadgeProps) {
  const config = TIER_CONFIG[tier];

  const sizeClasses = {
    sm: "px-2 py-0.5 text-xs gap-1",
    md: "px-2.5 py-1 text-xs gap-1.5",
    lg: "px-3 py-1.5 text-sm gap-2",
  };

  return (
    <div
      className={cn(
        "inline-flex items-center rounded-full border font-medium",
        config.bgLight,
        config.borderColor,
        config.textColor,
        sizeClasses[size],
        className
      )}
    >
      <div className={cn("rounded-full flex-shrink-0", config.dot, size === "sm" ? "w-1.5 h-1.5" : "w-2 h-2")} />
      {showLabel && <span>{config.label}</span>}
    </div>
  );
}

interface HealthBarProps {
  tier: HealthTier;
  /** avg pitches per pitcher over 14 days (primary weight: 40%) */
  avgPitches14d: number;
  /** avg innings pitched per pitcher over 14 days (primary weight: 40%) */
  avgIP14d: number;
  /**
   * Average innings the bullpen covers per game over 14 days (secondary weight: 20%).
   * Derived from starters' IP: 9 − avg_starter_IP_per_game.
   * Lower = starters going deep = lighter bullpen load.
   */
  avgReliefIPPerGame: number;
}

export function HealthBar({ tier, avgPitches14d, avgIP14d, avgReliefIPPerGame }: HealthBarProps) {
  const percentage = computeTeamUsageBarPct(avgPitches14d, avgIP14d, avgReliefIPPerGame);
  const config = TIER_CONFIG[tier];

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs">
        <span className="text-muted-foreground">Bullpen Usage</span>
        <span className={config.textColor}>
          {avgReliefIPPerGame.toFixed(1)} IP/game relief
        </span>
      </div>
      <div className="h-2 bg-muted rounded-full overflow-hidden">
        <div
          className={cn("h-full rounded-full transition-all duration-500", config.color)}
          style={{ width: `${percentage}%` }}
        />
      </div>
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>Fresh</span>
        <span>Heavy</span>
      </div>
    </div>
  );
}

export function HealthDot({ tier, size = "md" }: { tier: HealthTier; size?: "sm" | "md" | "lg" }) {
  const config = TIER_CONFIG[tier];
  const sizeMap = { sm: "w-2.5 h-2.5", md: "w-3.5 h-3.5", lg: "w-5 h-5" };
  return <div className={cn("rounded-full", config.color, sizeMap[size])} />;
}

export { TIER_CONFIG as HEALTH_TIER_CONFIG };
