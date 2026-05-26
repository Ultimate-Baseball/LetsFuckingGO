import { cn } from "@/lib/utils";
import type { LetterGrade } from "@/lib/types";

interface GradeBadgeProps {
  grade: LetterGrade;
  size?: "sm" | "md" | "lg" | "xl";
  className?: string;
  showLabel?: boolean;
}

const GRADE_CONFIG: Record<LetterGrade, { color: string; bg: string; border: string; label: string; text: string }> = {
  A: { color: "text-emerald-400", bg: "bg-emerald-500/15", border: "border-emerald-500/30", label: "Excellent", text: "Elite bullpen performance" },
  B: { color: "text-cyan-400", bg: "bg-cyan-500/15", border: "border-cyan-500/30", label: "Good", text: "Above-average bullpen" },
  C: { color: "text-amber-400", bg: "bg-amber-500/15", border: "border-amber-500/30", label: "Average", text: "League-average bullpen" },
  D: { color: "text-orange-400", bg: "bg-orange-500/15", border: "border-orange-500/30", label: "Poor", text: "Below-average bullpen" },
  F: { color: "text-red-400", bg: "bg-red-500/15", border: "border-red-500/30", label: "Failing", text: "Struggling bullpen" },
};

const SIZES = {
  sm: "w-7 h-7 text-base",
  md: "w-10 h-10 text-xl",
  lg: "w-14 h-14 text-3xl",
  xl: "w-20 h-20 text-5xl",
};

export function GradeBadge({ grade, size = "md", className, showLabel = false }: GradeBadgeProps) {
  const config = GRADE_CONFIG[grade];
  return (
    <div className={cn("flex flex-col items-center gap-1", className)}>
      <div
        className={cn(
          "rounded-xl border-2 flex items-center justify-center font-bold",
          config.bg,
          config.border,
          config.color,
          SIZES[size]
        )}
        title={`${config.label} — ${config.text}`}
      >
        {grade}
      </div>
      {showLabel && (
        <span className={cn("text-xs font-medium", config.color)}>{config.label}</span>
      )}
    </div>
  );
}

export function GradeLabel({ grade }: { grade: LetterGrade }) {
  const config = GRADE_CONFIG[grade];
  return (
    <span className={cn("text-sm font-semibold", config.color)}>{config.label}</span>
  );
}

export { GRADE_CONFIG };
