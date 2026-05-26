'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Header } from '@/components/header';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Zap, RefreshCw, Trash2, FlaskConical, ChevronDown, ChevronUp, Shield, Wifi } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { BullpenAlert, MonitorState } from '@/lib/mlb/types';

// ─── Constants ────────────────────────────────────────────────────────────────

const TYPE_LABELS: Record<BullpenAlert['type'], string> = {
  PITCHER_CHANGE:    'Pitcher In',
  AT_RISK_PITCHING:  'At-Risk',
  FATIGUED_PITCHING: 'Fatigued',
  CONSECUTIVE_DAY:   'Consecutive Day',
  HIGH_WHIP:         'High WHIP',
};

const SEVERITY_STYLES = {
  critical: { card: 'border-red-500/50 bg-red-950/20',   badge: 'bg-red-600 hover:bg-red-600',   dot: 'bg-red-500'   },
  warning:  { card: 'border-amber-500/40 bg-amber-950/20', badge: 'bg-amber-600 hover:bg-amber-600', dot: 'bg-amber-400' },
  info:     { card: 'border-border bg-card',              badge: 'bg-blue-600 hover:bg-blue-600',  dot: 'bg-blue-400'  },
};

const GRADE_STYLES: Record<string, string> = {
  A: 'bg-emerald-700 text-white', B: 'bg-green-700 text-white',
  C: 'bg-yellow-700 text-white',  D: 'bg-orange-700 text-white', F: 'bg-red-700 text-white',
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function timeAgo(iso: string): string {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60)   return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  return `${Math.floor(s / 3600)}h ago`;
}

function etTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-US', {
    hour: 'numeric', minute: '2-digit', second: '2-digit', hour12: true, timeZone: 'America/New_York',
  }) + ' ET';
}

// ─── Alert Card ───────────────────────────────────────────────────────────────

function AlertCard({ alert }: { alert: BullpenAlert }) {
  const [expanded, setExpanded] = useState(false);
  const s = SEVERITY_STYLES[alert.severity];

  return (
    <Card className={cn('border transition-all duration-200', s.card)}>
      <CardContent className="p-4">
        {/* Top row */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-2.5 min-w-0">
            <span className={cn('w-2 h-2 rounded-full mt-2 shrink-0', s.dot)} />
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2 mb-0.5">
                <span className="font-semibold text-foreground">{alert.pitcher.name}</span>
                <span className="text-xs text-muted-foreground">{alert.pitcher.team}</span>
                <Badge className={cn('text-[10px] px-1.5 py-0', s.badge)}>
                  {TYPE_LABELS[alert.type]}
                </Badge>
              </div>
              <p className="text-sm text-foreground/80">{alert.gameContext.displayScore}</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {alert.gameContext.inningHalf} {alert.gameContext.inning} inning
                &nbsp;·&nbsp;{etTime(alert.timestamp)}
                &nbsp;·&nbsp;{timeAgo(alert.timestamp)}
              </p>
            </div>
          </div>

          {/* App data badges */}
          {alert.appData && (
            <div className="shrink-0 flex flex-col items-end gap-1 text-xs">
              <div className="flex items-center gap-1.5">
                <span className="text-muted-foreground">Grade</span>
                <span className={cn('font-bold px-1.5 py-0.5 rounded text-xs', GRADE_STYLES[alert.appData.effectivenessGrade])}>
                  {alert.appData.effectivenessGrade}
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-muted-foreground">WHIP</span>
                <span className={cn('font-mono font-semibold', alert.appData.whip >= 1.60 ? 'text-red-400' : 'text-foreground')}>
                  {alert.appData.whip.toFixed(2)}
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-muted-foreground">Fatigue</span>
                <span className={cn('font-mono font-semibold', alert.appData.fatigueIndex >= 4 ? 'text-amber-400' : 'text-foreground')}>
                  {alert.appData.fatigueIndex}/5
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Alert reasons */}
        <div className="mt-3 space-y-1">
          {alert.alertReasons.slice(0, expanded ? undefined : 2).map((r, i) => (
            <p key={i} className="text-sm text-muted-foreground flex items-start gap-1.5">
              <span className="mt-0.5 opacity-40 shrink-0">›</span>
              <span>{r}</span>
            </p>
          ))}
          {alert.alertReasons.length > 2 && (
            <button
              onClick={() => setExpanded(!expanded)}
              className="flex items-center gap-1 text-xs text-primary hover:text-primary/80 mt-1 transition-colors"
            >
              {expanded ? <><ChevronUp className="w-3 h-3" /> Show less</> : <><ChevronDown className="w-3 h-3" /> +{alert.alertReasons.length - 2} more</>}
            </button>
          )}
        </div>

        {/* Health bar */}
        {alert.appData && (
          <div className="mt-3 pt-3 border-t border-border/50">
            <div className="flex justify-between text-xs text-muted-foreground mb-1">
              <span>Health Score</span>
              <span>{alert.appData.healthScore}/100 · Tier {alert.appData.healthTier}/5</span>
            </div>
            <div className="h-1.5 bg-muted rounded-full overflow-hidden">
              <div
                className={cn('h-full rounded-full transition-all', {
                  'bg-emerald-500': alert.appData.healthScore >= 70,
                  'bg-yellow-500':  alert.appData.healthScore >= 50 && alert.appData.healthScore < 70,
                  'bg-orange-500':  alert.appData.healthScore >= 30 && alert.appData.healthScore < 50,
                  'bg-red-500':     alert.appData.healthScore < 30,
                })}
                style={{ width: `${alert.appData.healthScore}%` }}
              />
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Filter Tabs ──────────────────────────────────────────────────────────────

type FilterType = 'all' | 'critical' | 'warning' | 'info';

function FilterTabs({
  current, counts, onChange
}: { current: FilterType; counts: Record<FilterType, number>; onChange: (f: FilterType) => void }) {
  const tabs: { key: FilterType; label: string }[] = [
    { key: 'all',      label: `All (${counts.all})` },
    { key: 'critical', label: `Critical (${counts.critical})` },
    { key: 'warning',  label: `Warning (${counts.warning})` },
    { key: 'info',     label: `Info (${counts.info})` },
  ];
  return (
    <div className="flex flex-wrap gap-2">
      {tabs.map(({ key, label }) => (
        <button
          key={key}
          onClick={() => onChange(key)}
          className={cn(
            'px-3 py-1.5 rounded-full text-xs font-medium transition-colors',
            current === key
              ? key === 'critical' ? 'bg-red-600 text-white'
              : key === 'warning'  ? 'bg-amber-600 text-white'
              : key === 'info'     ? 'bg-blue-600 text-white'
              : 'bg-foreground text-background'
              : 'bg-muted text-muted-foreground hover:text-foreground hover:bg-muted/80'
          )}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

interface Props {
  initialAlerts: BullpenAlert[];
  initialState:  MonitorState;
}

export default function AlertsPageClient({ initialAlerts, initialState }: Props) {
  const router = useRouter();
  const [alerts,     setAlerts]     = useState<BullpenAlert[]>(initialAlerts);
  const [state,      setState]      = useState(initialState);
  const [filter,     setFilter]     = useState<FilterType>('all');
  const [loading,    setLoading]    = useState(false);
  const [lastUpdate, setLastUpdate] = useState(new Date());
  const [liveCount,  setLiveCount]  = useState(0);

  const refresh = useCallback(async (quiet = false) => {
    if (!quiet) setLoading(true);
    try {
      const [ar, sr] = await Promise.all([
        fetch('/api/alerts'),
        fetch('/api/mlb-monitor?status=1'),
      ]);
      if (ar.ok)  setAlerts(await ar.json());
      if (sr.ok) {
        const s = await sr.json();
        setState(s.monitorState);
        setLiveCount(s.liveGamesCount ?? 0);
      }
      setLastUpdate(new Date());
    } catch {}
    if (!quiet) setLoading(false);
  }, []);

  // Auto-refresh every 30 seconds
  useEffect(() => {
    const id = setInterval(() => refresh(true), 30_000);
    return () => clearInterval(id);
  }, [refresh]);

  const handleClear = async () => {
    if (!confirm('Clear all of today\'s alerts?')) return;
    await fetch('/api/alerts', { method: 'DELETE' });
    setAlerts([]);
  };

  const handleDryRun = async () => {
    setLoading(true);
    const res  = await fetch('/api/mlb-monitor?dryRun=1', {
      headers: { Authorization: `Bearer ${prompt('Enter your CRON_SECRET:') ?? ''}` },
    });
    const data = await res.json();
    setLoading(false);
    alert(`Dry run complete:\n${data.gamesChecked ?? 0} games checked\n${data.alerts?.length ?? 0} alerts would fire\n${data.pitcherChangesDetected ?? 0} pitcher changes detected`);
  };

  const filtered = filter === 'all' ? alerts : alerts.filter(a => a.severity === filter);
  const counts: Record<FilterType, number> = {
    all:      alerts.length,
    critical: alerts.filter(a => a.severity === 'critical').length,
    warning:  alerts.filter(a => a.severity === 'warning').length,
    info:     alerts.filter(a => a.severity === 'info').length,
  };

  // Recent = last 30 min
  const recentCount = alerts.filter(a => Date.now() - new Date(a.timestamp).getTime() < 30 * 60_000).length;

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-6">

        {/* Page heading */}
        <div className="flex items-start justify-between flex-wrap gap-4 mb-6">
          <div>
            <div className="flex items-center gap-2.5">
              <Zap className="w-6 h-6 text-amber-400" />
              <h1 className="text-2xl font-bold text-foreground">Live Bullpen Alerts</h1>
              <Badge variant="outline" className="text-amber-400 border-amber-500/50 gap-1">
                <Shield className="w-3 h-3" /> Admin
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              Real-time alerts when at-risk pitchers enter live games · auto-refreshes every 30s
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-muted-foreground">
              {lastUpdate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', second: '2-digit', hour12: true })}
            </span>
            <Button variant="ghost" size="sm" onClick={() => refresh()} disabled={loading} className="h-7 text-xs gap-1.5">
              <RefreshCw className={cn('w-3.5 h-3.5', loading && 'animate-spin')} /> Refresh
            </Button>
            <Button variant="ghost" size="sm" onClick={handleDryRun} disabled={loading} className="h-7 text-xs gap-1.5 text-blue-400 hover:text-blue-300">
              <FlaskConical className="w-3.5 h-3.5" /> Dry Run
            </Button>
            {alerts.length > 0 && (
              <Button variant="ghost" size="sm" onClick={handleClear} className="h-7 text-xs gap-1.5 text-muted-foreground hover:text-red-400">
                <Trash2 className="w-3.5 h-3.5" /> Clear
              </Button>
            )}
          </div>
        </div>

        {/* Monitor status bar */}
        <Card className="mb-6 border-border/50">
          <CardContent className="p-3">
            <div className="flex flex-wrap items-center gap-4 text-xs">
              <div className="flex items-center gap-1.5">
                <span className={cn('w-2 h-2 rounded-full', liveCount > 0 ? 'bg-emerald-400 animate-pulse' : 'bg-muted')} />
                <span className={liveCount > 0 ? 'text-emerald-400 font-medium' : 'text-muted-foreground'}>
                  {liveCount > 0 ? `${liveCount} live games` : 'No games in progress'}
                </span>
              </div>
              <span className="text-muted-foreground">
                Last run: <span className="text-foreground">{state?.lastRunAt ? timeAgo(state.lastRunAt) : '—'}</span>
              </span>
              <span className="text-muted-foreground">
                Alerts today: <span className="text-foreground">{state?.alertsSentToday ?? 0}</span>
              </span>
              {recentCount > 0 && (
                <span className="text-amber-400 font-medium">{recentCount} new in last 30 min</span>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Active thresholds */}
        <Card className="mb-6 border-border/50">
          <CardHeader className="pb-2 pt-3 px-4">
            <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Active Alert Thresholds</CardTitle>
          </CardHeader>
          <CardContent className="pb-3 px-4">
            <div className="flex flex-wrap gap-2 text-xs">
              {[
                'Health Tier ≥ 3',
                'Fatigue Index ≥ 4/5',
                'Grade D or F',
                '2+ Consecutive Days',
                'Unavailable Pitchers',
              ].map(t => (
                <span key={t} className="bg-muted text-muted-foreground px-2 py-1 rounded">{t}</span>
              ))}
              <span className="bg-red-950/50 text-red-400 border border-red-500/30 px-2 py-1 rounded font-medium">
                ⚠️ WHIP ≥ 1.60
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Filter tabs */}
        <div className="mb-4">
          <FilterTabs current={filter} counts={counts} onChange={setFilter} />
        </div>

        {/* Alert list */}
        {loading && alerts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
            <RefreshCw className="w-6 h-6 animate-spin mb-3" />
            <p className="text-sm">Loading alerts…</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
            <Wifi className="w-10 h-10 mb-3 opacity-30" />
            <p className="text-base font-medium text-foreground/60">
              {alerts.length === 0 ? 'No alerts yet today' : `No ${filter} alerts`}
            </p>
            <p className="text-sm mt-1">
              {alerts.length === 0
                ? 'Alerts appear here when at-risk pitchers enter live games'
                : 'Switch filter or check back later'}
            </p>
            {alerts.length === 0 && (
              <p className="text-xs mt-3 text-muted-foreground/50">Monitor runs every 60s · 12pm–midnight ET</p>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map(alert => <AlertCard key={alert.alertId} alert={alert} />)}
          </div>
        )}
      </main>
    </div>
  );
}
