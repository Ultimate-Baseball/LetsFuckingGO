"use client";

import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine, Area, AreaChart
} from "recharts";
import { cn } from "@/lib/utils";
import type { TrendPoint } from "@/lib/types";

interface TrendChartProps {
  trend: TrendPoint[];
  className?: string;
}

const HEALTH_COLORS = {
  veryLow: "#10b981",
  low: "#22c55e",
  moderate: "#f59e0b",
  high: "#f97316",
  veryHigh: "#ef4444",
};

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0]?.payload as TrendPoint;
    return (
      <div className="bg-card border border-border rounded-lg p-3 shadow-xl text-xs">
        <div className="font-semibold text-foreground mb-1.5">
          {new Date(data.date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
        </div>
        <div className="space-y-1">
          <div className="flex justify-between gap-4">
            <span className="text-muted-foreground">ERA</span>
            <span className={cn(
              "font-bold",
              data.era < 3.5 ? "text-emerald-400" : data.era < 4.5 ? "text-amber-400" : "text-red-400"
            )}>{data.era.toFixed(2)}</span>
          </div>
          <div className="flex justify-between gap-4">
            <span className="text-muted-foreground">WHIP</span>
            <span className={cn(
              "font-bold",
              data.whip < 1.2 ? "text-emerald-400" : data.whip < 1.4 ? "text-amber-400" : "text-red-400"
            )}>{data.whip.toFixed(2)}</span>
          </div>
          {data.pitches != null && (
            <div className="flex justify-between gap-4">
              <span className="text-muted-foreground">Pitches</span>
              <span className="font-bold text-foreground">{data.pitches}</span>
            </div>
          )}
          {data.ip != null && (
            <div className="flex justify-between gap-4">
              <span className="text-muted-foreground">IP</span>
              <span className="font-bold text-foreground">{data.ip.toFixed(1)}</span>
            </div>
          )}
          {data.batters != null && (
            <div className="flex justify-between gap-4">
              <span className="text-muted-foreground">Batters Faced</span>
              <span className="font-bold text-foreground">{data.batters}</span>
            </div>
          )}
          <div className="flex justify-between gap-4">
            <span className="text-muted-foreground">Pitchers Used</span>
            <span className="font-bold text-foreground">{data.gamesUsed}</span>
          </div>
          <div className="flex justify-between gap-4">
            <span className="text-muted-foreground">Grade</span>
            <span className="font-bold text-primary">{data.grade}</span>
          </div>
        </div>
      </div>
    );
  }
  return null;
};

export function TrendChart({ trend, className }: TrendChartProps) {
  if (!trend || trend.length === 0) {
    return (
      <div className={cn("flex items-center justify-center h-40 text-muted-foreground text-sm", className)}>
        No trend data available
      </div>
    );
  }

  const chartData = trend.map((t) => ({
    ...t,
    dateLabel: new Date(t.date).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
    color: HEALTH_COLORS[t.health],
  }));

  return (
    <div className={cn("space-y-4", className)}>
      <div>
        <div className="text-sm font-semibold text-foreground mb-1">ERA Trend (Last 10 Games)</div>
        <div className="text-xs text-muted-foreground">Lower is better — tracking per-game bullpen performance</div>
      </div>
      <ResponsiveContainer width="100%" height={160}>
        <AreaChart data={chartData} margin={{ top: 5, right: 5, left: -25, bottom: 0 }}>
          <defs>
            <linearGradient id="eraGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
          <XAxis
            dataKey="dateLabel"
            tick={{ fontSize: 10, fill: "rgba(255,255,255,0.4)" }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tick={{ fontSize: 10, fill: "rgba(255,255,255,0.4)" }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip content={<CustomTooltip />} />
          <ReferenceLine y={4.5} stroke="rgba(239,68,68,0.3)" strokeDasharray="4 4" label={{ value: "4.50", fontSize: 9, fill: "rgba(239,68,68,0.5)" }} />
          <ReferenceLine y={3.5} stroke="rgba(16,185,129,0.3)" strokeDasharray="4 4" label={{ value: "3.50", fontSize: 9, fill: "rgba(16,185,129,0.5)" }} />
          <Area
            type="monotone"
            dataKey="era"
            stroke="#3b82f6"
            strokeWidth={2}
            fill="url(#eraGradient)"
            dot={(props: any) => {
              const { cx, cy, payload } = props;
              return (
                <circle
                  key={payload.date}
                  cx={cx}
                  cy={cy}
                  r={4}
                  fill={payload.color}
                  stroke="hsl(222, 47%, 9%)"
                  strokeWidth={1.5}
                />
              );
            }}
          />
        </AreaChart>
      </ResponsiveContainer>

      {/* Game-by-Game Health/Grade Pills */}
      <div>
        <div className="text-xs text-muted-foreground mb-2">Per-Game Health &amp; Grade</div>
        <div className="flex gap-1.5 flex-wrap">
          {chartData.map((point, idx) => (
            <div key={idx} className="flex flex-col items-center gap-1">
              <div
                className="w-6 h-6 rounded text-xs font-bold flex items-center justify-center"
                style={{
                  backgroundColor: point.color + "25",
                  border: `1px solid ${point.color}50`,
                  color: point.color,
                }}
              >
                {point.grade}
              </div>
              <div className="text-xs text-muted-foreground/60">{point.dateLabel.split(" ")[1]}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function CompactTrendLine({ trend }: { trend: TrendPoint[] }) {
  if (!trend || trend.length < 2) return null;

  const chartData = trend.map((t) => ({
    era: t.era,
    color: HEALTH_COLORS[t.health],
  }));

  return (
    <ResponsiveContainer width="100%" height={40}>
      <LineChart data={chartData} margin={{ top: 2, right: 2, left: 2, bottom: 2 }}>
        <Line
          type="monotone"
          dataKey="era"
          stroke="#3b82f6"
          strokeWidth={1.5}
          dot={false}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
