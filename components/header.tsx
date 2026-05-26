"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, useEffect, useCallback } from "react";
import { cn } from "@/lib/utils";
import { Activity, BarChart3, GitCompare, Menu, X, RefreshCw, Shield, LogIn, LogOut, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";

const NAV_ITEMS = [
  { href: "/",          label: "Dashboard",    icon: Activity },
  { href: "/compare",   label: "Compare",      icon: GitCompare },
  { href: "/standings", label: "Standings",    icon: BarChart3 },
];

export function Header() {
  const pathname = usePathname();
  const router   = useRouter();
  const [menuOpen,      setMenuOpen]      = useState(false);
  const [refreshing,    setRefreshing]    = useState(false);
  const [role,          setRole]          = useState<"admin" | "subscriber" | null>(null);
  const [displayDate,   setDisplayDate]   = useState<string>("Loading...");
  const [alertBadge,    setAlertBadge]    = useState(0);

  // Read auth role from cookie
  useEffect(() => {
    const match = document.cookie.match(/(?:^|;\s*)ubt_auth_public=([^;]*)/);
    const val   = match?.[1];
    if (val === "admin" || val === "subscriber") setRole(val);
    else setRole(null);
  }, [pathname]);

  // Fetch latest data date
  const fetchLatestDate = useCallback(async () => {
    try {
      const res = await fetch("/api/refresh", { cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        if (data.displayDate && data.displayDate !== "Unknown") setDisplayDate(data.displayDate);
      }
    } catch {}
  }, []);

  useEffect(() => { fetchLatestDate(); }, [fetchLatestDate]);

  useEffect(() => {
    const handler = () => fetchLatestDate();
    window.addEventListener("ubt-data-updated", handler);
    return () => window.removeEventListener("ubt-data-updated", handler);
  }, [fetchLatestDate]);

  // Fetch alert badge count for admin (recent alerts in last 30 min)
  const fetchAlertCount = useCallback(async () => {
    if (role !== "admin") return;
    try {
      const res = await fetch("/api/alerts");
      if (res.ok) {
        const alerts: any[] = await res.json();
        const cutoff = Date.now() - 30 * 60_000;
        setAlertBadge(alerts.filter(a => new Date(a.timestamp).getTime() > cutoff).length);
      }
    } catch {}
  }, [role]);

  useEffect(() => { fetchAlertCount(); }, [fetchAlertCount]);
  // Poll alert count every 60 seconds
  useEffect(() => {
    if (role !== "admin") return;
    const id = setInterval(fetchAlertCount, 60_000);
    return () => clearInterval(id);
  }, [role, fetchAlertCount]);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      sessionStorage.setItem("ubt_skip_splash", "1");
      await fetch("/api/refresh", { method: "POST" });
      window.location.reload();
    } catch {
      sessionStorage.removeItem("ubt_skip_splash");
    } finally {
      setTimeout(() => setRefreshing(false), 1500);
    }
  };

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  };

  return (
    <header className="sticky top-0 z-50 border-b border-border/50 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="flex items-center justify-between h-16">

          {/* Logo */}
          <Link href="/" className="flex items-center gap-2.5 shrink-0">
            <img src="/ubt-logo.png" alt="UBT Logo" className="w-9 h-9 rounded-full object-cover" />
            <div className="hidden sm:block">
              <div className="font-bold text-foreground text-sm leading-none">Ultimate Baseball</div>
              <div className="text-xs text-muted-foreground leading-none mt-0.5">Tool</div>
              <div className="text-[10px] text-muted-foreground/50 leading-none mt-0.5">Powered by Picks2click</div>
            </div>
          </Link>

          {/* Desktop Nav */}
          <nav className="hidden md:flex items-center gap-1">
            {NAV_ITEMS.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
                  pathname === item.href
                    ? "bg-primary/15 text-primary"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted"
                )}
              >
                <item.icon className="w-4 h-4" />
                {item.label}
              </Link>
            ))}

            {/* Alerts — admin only */}
            {role === "admin" && (
              <Link
                href="/alerts"
                className={cn(
                  "relative flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
                  pathname === "/alerts"
                    ? "bg-amber-500/15 text-amber-400"
                    : "text-amber-500/60 hover:text-amber-400 hover:bg-amber-500/10"
                )}
              >
                <Zap className="w-4 h-4" />
                Alerts
                {alertBadge > 0 && (
                  <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white leading-none">
                    {alertBadge > 9 ? "9+" : alertBadge}
                  </span>
                )}
              </Link>
            )}

            {/* Admin panel */}
            {role === "admin" && (
              <Link
                href="/admin"
                className={cn(
                  "flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
                  pathname.startsWith("/admin")
                    ? "bg-amber-500/15 text-amber-400"
                    : "text-amber-500/60 hover:text-amber-400 hover:bg-amber-500/10"
                )}
              >
                <Shield className="w-4 h-4" />
                Admin
              </Link>
            )}
          </nav>

          {/* Right Actions */}
          <div className="flex items-center gap-2">
            <div className="hidden sm:flex items-center gap-1 text-xs text-muted-foreground">
              <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
              <span>Updated: {displayDate}</span>
            </div>

            <Button
              variant="ghost" size="sm"
              onClick={handleRefresh}
              className="hidden sm:flex items-center gap-1.5 text-muted-foreground hover:text-foreground"
            >
              <RefreshCw className={cn("w-3.5 h-3.5", refreshing && "animate-spin")} />
              <span className="text-xs">Refresh</span>
            </Button>

            {role ? (
              <Button
                variant="ghost" size="sm"
                onClick={handleLogout}
                className="hidden sm:flex items-center gap-1.5 text-muted-foreground hover:text-red-400 transition-colors"
                title="Sign out"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span className="text-xs">Sign Out</span>
              </Button>
            ) : (
              <Link href="/login">
                <Button variant="ghost" size="sm" className="hidden sm:flex items-center gap-1.5 text-muted-foreground hover:text-foreground">
                  <LogIn className="w-3.5 h-3.5" />
                  <span className="text-xs">Sign In</span>
                </Button>
              </Link>
            )}

            {/* Mobile Menu Button */}
            <button
              onClick={() => setMenuOpen(!menuOpen)}
              className="md:hidden p-2 rounded-lg hover:bg-muted text-muted-foreground"
            >
              {menuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Mobile Nav */}
        {menuOpen && (
          <div className="md:hidden pb-3 border-t border-border/50 mt-0 pt-3">
            <div className="flex flex-col gap-1">
              {NAV_ITEMS.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMenuOpen(false)}
                  className={cn(
                    "flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                    pathname === item.href
                      ? "bg-primary/15 text-primary"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted"
                  )}
                >
                  <item.icon className="w-4 h-4" />
                  {item.label}
                </Link>
              ))}

              {/* Mobile: Alerts (admin only) */}
              {role === "admin" && (
                <Link
                  href="/alerts"
                  onClick={() => setMenuOpen(false)}
                  className={cn(
                    "flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                    pathname === "/alerts"
                      ? "bg-amber-500/15 text-amber-400"
                      : "text-amber-500/60 hover:text-amber-400 hover:bg-amber-500/10"
                  )}
                >
                  <span className="flex items-center gap-2"><Zap className="w-4 h-4" /> Alerts</span>
                  {alertBadge > 0 && (
                    <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white px-1">
                      {alertBadge > 9 ? "9+" : alertBadge}
                    </span>
                  )}
                </Link>
              )}

              {/* Mobile: Admin */}
              {role === "admin" && (
                <Link
                  href="/admin"
                  onClick={() => setMenuOpen(false)}
                  className={cn(
                    "flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                    pathname.startsWith("/admin")
                      ? "bg-amber-500/15 text-amber-400"
                      : "text-amber-500/60 hover:text-amber-400 hover:bg-amber-500/10"
                  )}
                >
                  <Shield className="w-4 h-4" />
                  Admin
                </Link>
              )}

              <div className="flex items-center justify-between px-3 py-2 text-xs text-muted-foreground border-t border-border/50 mt-1 pt-3">
                <div className="flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                  <span>Updated: {displayDate}</span>
                </div>
                {role ? (
                  <button onClick={handleLogout} className="flex items-center gap-1 text-muted-foreground hover:text-red-400 transition-colors">
                    <LogOut className="w-3.5 h-3.5" /> Sign Out
                  </button>
                ) : (
                  <Link href="/login" className="flex items-center gap-1 text-primary hover:text-primary/80">
                    <LogIn className="w-3.5 h-3.5" /> Sign In
                  </Link>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </header>
  );
}
