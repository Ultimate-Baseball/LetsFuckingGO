import re

with open("TeamPageClient.tsx", "r") as f:
    src = f.read()

# ── 1. Insert afiToRating + FatigueRating after FatigueBadge closing brace ──
new_components = '''
// ── AFI 1-5 rating scale ──────────────────────────────────────────────────────
// Maps the 0–2 AFI composite score onto a 1–5 fatigue level:
//   1 = Fresh (AFI < 0.40)    2 = Mild (0.40–0.79)   3 = Moderate (0.80–1.19)
//   4 = High  (1.20–1.59)     5 = Extreme (≥ 1.60)
function afiToRating(afi: number): number {
  if (afi < 0.40) return 1;
  if (afi < 0.80) return 2;
  if (afi < 1.20) return 3;
  if (afi < 1.60) return 4;
  return 5;
}

const RATING_LABELS: Record<number, string> = {
  1: "Fresh",
  2: "Mild",
  3: "Moderate",
  4: "High",
  5: "Extreme",
};

function FatigueRating({ afi }: { afi: number }) {
  const rating = afiToRating(afi);
  const filledColor =
    rating >= 4 ? "text-red-400" :
    rating >= 2 ? "text-amber-400" :
    "text-muted-foreground/35";

  return (
    <span className="inline-flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map(i => (
        <Flame
          key={i}
          className={cn(
            "w-2.5 h-2.5 transition-colors",
            i <= rating ? filledColor : "text-muted-foreground/15"
          )}
        />
      ))}
      <span className={cn(
        "text-[10px] font-semibold ml-1",
        rating >= 4 ? "text-red-400" :
        rating >= 2 ? "text-amber-400" :
        "text-muted-foreground/50"
      )}>
        {rating}/5
      </span>
      <span className="text-[10px] text-muted-foreground/40 ml-0.5">
        {RATING_LABELS[rating]}
      </span>
    </span>
  );
}

'''

# Insert right before "export default function TeamPage"
src = src.replace(
    'export default function TeamPage()',
    new_components + 'export default function TeamPage()'
)

# ── 2. Replace "AFI {details.afi.toFixed(2)}" with <FatigueRating /> ──
src = src.replace(
    'AFI {details.afi.toFixed(2)}',
    '<FatigueRating afi={details.afi} />'
)

# ── 3. Also replace the raw AFI display in the mostFatigued highlight card ──
src = src.replace(
    'AFI {mostFatigued.details.afi.toFixed(2)} · {mostFatigued.details.gp14d} GP · max {mostFatigued.details.maxStreak} consec',
    'Fatigue Level: <strong>{afiToRating(mostFatigued.details.afi)}/5</strong> ({mostFatigued.details.label}) · {mostFatigued.details.gp14d} GP · max {mostFatigued.details.maxStreak} consec days'
)

# ── 4. Update the legend thresholds to show 1-5 scale ──
old_legend_thresholds = '''                    <span className="text-emerald-400/70">AFI &lt; 0.35 = Fresh</span>
                    <span className="text-amber-400/70">0.35–0.84 = Moderate</span>
                    <span className="text-red-400/70">≥ 0.85 = High Fatigue</span>'''

new_legend_thresholds = '''                    <span className="text-emerald-400/70">1 = Fresh (AFI &lt; 0.40)</span>
                    <span className="text-amber-400/70">2 = Mild · 3 = Moderate</span>
                    <span className="text-red-400/70">4 = High · 5 = Extreme (≥ 1.60)</span>'''

src = src.replace(old_legend_thresholds, new_legend_thresholds)

# Also wrap the raw AFI text inside <span> that was inside the "AFI score" row
# The old structure had:
#   <span className="text-muted-foreground/60 text-[10px]">
#     AFI {details.afi.toFixed(2)}
#   </span>
# We already replaced the inner text; now also remove the wrapping span's old styles
# since FatigueRating is self-contained
old_wrapper = '''                            <span className="text-muted-foreground/60 text-[10px]">
                              <FatigueRating afi={details.afi} />
                            </span>'''
new_wrapper = '''                            <FatigueRating afi={details.afi} />'''
src = src.replace(old_wrapper, new_wrapper)

with open("TeamPageClient.tsx", "w") as f:
    f.write(src)

print("Done")
