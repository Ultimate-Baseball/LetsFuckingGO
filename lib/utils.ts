import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
// ─── ERA / WHIP color helpers (single source of truth) ────────────────────────
// ERA:  < 2.00 → green  |  2.00–3.50 → yellow  |  > 3.50 → red
// WHIP: < 1.00 → green  |  1.00–1.50 → yellow  |  > 1.50 → red

export function eraTextColor(era: number | null | undefined): string {
  if (era == null) return "text-muted-foreground";
  if (era <= 3.50) return "text-emerald-400";   // A or B grade ERA
  if (era <= 4.50) return "text-amber-400";      // C or D grade ERA
  return "text-red-400";                          // F grade ERA
}

export function eraBgColor(era: number | null | undefined): string {
  if (era == null) return "bg-muted";
  if (era <= 3.50) return "bg-emerald-500";
  if (era <= 4.50) return "bg-amber-500";
  return "bg-red-500";
}

export function whipTextColor(whip: number | null | undefined): string {
  if (whip == null) return "text-muted-foreground";
  if (whip <= 1.15) return "text-emerald-400";   // A or B grade WHIP
  if (whip <= 1.50) return "text-amber-400";      // C or D grade WHIP
  return "text-red-400";                           // F grade WHIP
}

export function whipBgColor(whip: number | null | undefined): string {
  if (whip == null) return "bg-muted";
  if (whip <= 1.15) return "bg-emerald-500";
  if (whip <= 1.50) return "bg-amber-500";
  return "bg-red-500";
}
