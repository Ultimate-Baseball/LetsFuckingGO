"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Users, RefreshCw, Search, ChevronDown, ChevronUp,
  Shield, Crown, UserCheck, UserX, Pencil, Trash2,
  Check, X, Tag, Plus, StickyNote, Mail,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ── Types ─────────────────────────────────────────────────────────────────────

type UserRole   = "subscriber" | "free";
type UserStatus = "active" | "pending" | "suspended";
type UserPlan   = "free" | "basic" | "premium";

interface SafeUser {
  id:          string;
  email:       string;
  name:        string;
  role:        UserRole;
  status:      UserStatus;
  plan:        UserPlan;
  labels:      string[];
  notes:       string;
  signupDate:  string;
  lastLogin:   string | null;
  loginCount:  number;
}

interface UserStats {
  total: number; active: number; pending: number; suspended: number;
  subscriber: number; free: number; premium: number;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const ROLE_OPTIONS:   UserRole[]   = ["subscriber", "free"];
const STATUS_OPTIONS: UserStatus[] = ["active", "pending", "suspended"];
const PLAN_OPTIONS:   UserPlan[]   = ["free", "basic", "premium"];

const PRESET_LABELS = ["beta", "vip", "trial", "comp", "influencer", "press", "internal", "priority"];

// ── Helpers ───────────────────────────────────────────────────────────────────

function roleColor(role: UserRole) {
  return role === "subscriber" ? "text-green-400 bg-green-500/10 border-green-500/30"
       : "text-zinc-400 bg-zinc-500/10 border-zinc-500/30";
}
function statusColor(status: UserStatus) {
  return status === "active"    ? "text-green-400  bg-green-500/10  border-green-500/30"
       : status === "pending"   ? "text-yellow-400 bg-yellow-500/10 border-yellow-500/30"
       : "text-red-400 bg-red-500/10 border-red-500/30";
}
function planColor(plan: UserPlan) {
  return plan === "premium" ? "text-amber-400  bg-amber-500/10  border-amber-500/30"
       : plan === "basic"   ? "text-blue-400   bg-blue-500/10   border-blue-500/30"
       : "text-zinc-400 bg-zinc-500/10 border-zinc-500/30";
}
function fmtDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}
function fmtRelative(iso: string | null) {
  if (!iso) return "Never";
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60)   return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs  < 24)   return `${hrs}h ago`;
  const days = Math.floor(hrs  / 24);
  if (days < 7)    return `${days}d ago`;
  return fmtDate(iso);
}

// ── Edit Modal ────────────────────────────────────────────────────────────────

function EditUserModal({
  user, onSave, onClose,
}: {
  user: SafeUser;
  onSave: (id: string, updates: Record<string, unknown>) => Promise<void>;
  onClose: () => void;
}) {
  const [role,        setRole]        = useState<UserRole>(user.role);
  const [status,      setStatus]      = useState<UserStatus>(user.status);
  const [plan,        setPlan]        = useState<UserPlan>(user.plan);
  const [labels,      setLabels]      = useState<string[]>(user.labels);
  const [notes,       setNotes]       = useState(user.notes);
  const [newLabel,    setNewLabel]    = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [saving,      setSaving]      = useState(false);
  const [error,       setError]       = useState("");

  const addLabel = (lbl: string) => {
    const clean = lbl.trim().toLowerCase().replace(/[^a-z0-9-]/g, "");
    if (clean && !labels.includes(clean)) setLabels([...labels, clean]);
    setNewLabel("");
  };
  const removeLabel = (lbl: string) => setLabels(labels.filter(l => l !== lbl));

  const handleSave = async () => {
    setSaving(true); setError("");
    try {
      const updates: Record<string, unknown> = { role, status, plan, labels, notes };
      if (newPassword.length >= 8) updates.newPassword = newPassword;
      await onSave(user.id, updates);
      onClose();
    } catch (e: any) {
      setError(e?.message ?? "Save failed.");
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-card border border-border/60 rounded-2xl w-full max-w-md shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border/50">
          <div>
            <div className="font-bold text-white">{user.name}</div>
            <div className="text-xs text-muted-foreground">{user.email}</div>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* Role + Status + Plan */}
          <div className="grid grid-cols-3 gap-3">
            {/* Role */}
            <div className="space-y-1.5">
              <label className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Role</label>
              <select
                value={role} onChange={e => setRole(e.target.value as UserRole)}
                className="w-full bg-muted/50 border border-border rounded-lg px-2 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-primary/50"
              >
                {ROLE_OPTIONS.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
            {/* Status */}
            <div className="space-y-1.5">
              <label className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Status</label>
              <select
                value={status} onChange={e => setStatus(e.target.value as UserStatus)}
                className="w-full bg-muted/50 border border-border rounded-lg px-2 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-primary/50"
              >
                {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            {/* Plan */}
            <div className="space-y-1.5">
              <label className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Plan</label>
              <select
                value={plan} onChange={e => setPlan(e.target.value as UserPlan)}
                className="w-full bg-muted/50 border border-border rounded-lg px-2 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-primary/50"
              >
                {PLAN_OPTIONS.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
          </div>

          {/* Labels */}
          <div className="space-y-2">
            <label className="text-xs text-muted-foreground font-medium uppercase tracking-wide flex items-center gap-1.5">
              <Tag className="w-3 h-3" /> Labels
            </label>
            {/* Current labels */}
            <div className="flex flex-wrap gap-1.5 min-h-[28px]">
              {labels.map(lbl => (
                <span key={lbl} className="flex items-center gap-1 bg-primary/10 border border-primary/20 text-primary text-xs px-2 py-0.5 rounded-full">
                  {lbl}
                  <button onClick={() => removeLabel(lbl)} className="hover:text-red-400 transition-colors">
                    <X className="w-2.5 h-2.5" />
                  </button>
                </span>
              ))}
              {labels.length === 0 && <span className="text-xs text-muted-foreground/50">No labels</span>}
            </div>
            {/* Preset labels */}
            <div className="flex flex-wrap gap-1">
              {PRESET_LABELS.filter(l => !labels.includes(l)).map(lbl => (
                <button key={lbl} onClick={() => addLabel(lbl)}
                  className="text-xs bg-muted/50 border border-border hover:border-primary/50 text-muted-foreground hover:text-foreground px-2 py-0.5 rounded-full transition-colors">
                  + {lbl}
                </button>
              ))}
            </div>
            {/* Custom label input */}
            <div className="flex gap-2">
              <input
                type="text" value={newLabel} onChange={e => setNewLabel(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); addLabel(newLabel); } }}
                placeholder="Custom label…"
                className="flex-1 bg-muted/50 border border-border rounded-lg px-3 py-1.5 text-sm text-white placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
              />
              <button onClick={() => addLabel(newLabel)}
                className="bg-primary/10 border border-primary/20 text-primary rounded-lg px-3 hover:bg-primary/20 transition-colors">
                <Plus className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Notes */}
          <div className="space-y-1.5">
            <label className="text-xs text-muted-foreground font-medium uppercase tracking-wide flex items-center gap-1.5">
              <StickyNote className="w-3 h-3" /> Admin Notes
            </label>
            <textarea
              value={notes} onChange={e => setNotes(e.target.value)} rows={2}
              placeholder="Internal notes (never shown to user)…"
              className="w-full bg-muted/50 border border-border rounded-lg px-3 py-2 text-sm text-white placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 resize-none"
            />
          </div>

          {/* Reset Password */}
          <div className="space-y-1.5">
            <label className="text-xs text-muted-foreground font-medium uppercase tracking-wide flex items-center gap-1.5">
              <Shield className="w-3 h-3" /> Reset Password <span className="text-muted-foreground/40">(optional)</span>
            </label>
            <input
              type="text" value={newPassword} onChange={e => setNewPassword(e.target.value)}
              placeholder="New password (min 8 chars) — leave blank to keep current"
              className="w-full bg-muted/50 border border-border rounded-lg px-3 py-2 text-sm text-white placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
          </div>

          {error && <p className="text-red-400 text-sm">{error}</p>}

          {/* Actions */}
          <div className="flex gap-2 pt-1">
            <button onClick={onClose}
              className="flex-1 py-2.5 rounded-xl border border-border text-muted-foreground hover:text-foreground text-sm font-medium transition-colors">
              Cancel
            </button>
            <button onClick={handleSave} disabled={saving}
              className="flex-1 py-2.5 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground text-sm font-bold transition-colors disabled:opacity-50">
              {saving ? "Saving…" : "Save Changes"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── User Row ──────────────────────────────────────────────────────────────────

function UserRow({
  user, onEdit, onDelete,
}: {
  user: SafeUser;
  onEdit: (u: SafeUser) => void;
  onDelete: (u: SafeUser) => void;
}) {
  return (
    <div className="flex items-center gap-3 px-4 py-3 hover:bg-muted/20 border-b border-border/30 last:border-0 transition-colors group">
      {/* Avatar */}
      <div className="w-8 h-8 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center flex-shrink-0">
        <span className="text-primary text-xs font-bold">
          {user.name.charAt(0).toUpperCase()}
        </span>
      </div>

      {/* Name + Email */}
      <div className="flex-1 min-w-0">
        <div className="font-medium text-white text-sm truncate">{user.name}</div>
        <div className="text-xs text-muted-foreground flex items-center gap-1 truncate">
          <Mail className="w-3 h-3 flex-shrink-0" />
          {user.email}
        </div>
        {/* Labels */}
        {user.labels.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-1">
            {user.labels.map(lbl => (
              <span key={lbl} className="text-[10px] bg-primary/10 text-primary/80 px-1.5 py-0.5 rounded-full border border-primary/20">
                {lbl}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Badges */}
      <div className="hidden sm:flex flex-col gap-1 items-end">
        <span className={cn("text-[10px] font-medium px-2 py-0.5 rounded-full border capitalize", roleColor(user.role))}>
          {user.role}
        </span>
        <span className={cn("text-[10px] font-medium px-2 py-0.5 rounded-full border capitalize", planColor(user.plan))}>
          {user.plan}
        </span>
      </div>

      <div className="hidden md:flex flex-col gap-1 items-end">
        <span className={cn("text-[10px] font-medium px-2 py-0.5 rounded-full border capitalize", statusColor(user.status))}>
          {user.status}
        </span>
        <span className="text-[10px] text-muted-foreground">
          {fmtRelative(user.lastLogin)}
        </span>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1 flex-shrink-0">
        <button onClick={() => onEdit(user)}
          className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg hover:bg-primary/10 text-muted-foreground hover:text-primary transition-all">
          <Pencil className="w-3.5 h-3.5" />
        </button>
        <button onClick={() => onDelete(user)}
          className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg hover:bg-red-500/10 text-muted-foreground hover:text-red-400 transition-all">
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}

// ── Main Users Tab ────────────────────────────────────────────────────────────

export default function UsersTab() {
  const [users,     setUsers]     = useState<SafeUser[]>([]);
  const [stats,     setStats]     = useState<UserStats | null>(null);
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState("");
  const [search,    setSearch]    = useState("");
  const [roleFilter,  setRoleFilter]  = useState<UserRole | "all">("all");
  const [planFilter,  setPlanFilter]  = useState<UserPlan | "all">("all");
  const [statusFilter, setStatusFilter] = useState<UserStatus | "all">("all");
  const [editUser,  setEditUser]  = useState<SafeUser | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<SafeUser | null>(null);
  const [deleting,  setDeleting]  = useState(false);

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const res  = await fetch("/api/admin/users");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to load users.");
      setUsers(data.users ?? []);
      setStats(data.stats ?? null);
    } catch (e: any) {
      setError(e?.message ?? "Failed to load users.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleSave = async (id: string, updates: Record<string, unknown>) => {
    const res  = await fetch("/api/admin/users", {
      method:  "PATCH",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ id, ...updates }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error ?? "Save failed.");
    setUsers(prev => prev.map(u => u.id === id ? data.user : u));
  };

  const handleDelete = async (user: SafeUser) => {
    setDeleting(true);
    try {
      const res  = await fetch(`/api/admin/users?id=${user.id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Delete failed.");
      setUsers(prev => prev.filter(u => u.id !== user.id));
      if (stats) setStats({ ...stats, total: stats.total - 1 });
      setDeleteConfirm(null);
    } catch (e: any) {
      alert(e?.message ?? "Delete failed.");
    } finally {
      setDeleting(false);
    }
  };

  // Filtered + searched users
  const filtered = users.filter(u => {
    if (roleFilter   !== "all" && u.role   !== roleFilter)   return false;
    if (planFilter   !== "all" && u.plan   !== planFilter)   return false;
    if (statusFilter !== "all" && u.status !== statusFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      if (!u.name.toLowerCase().includes(q) && !u.email.toLowerCase().includes(q) &&
          !u.labels.some(l => l.includes(q))) return false;
    }
    return true;
  });

  return (
    <div className="space-y-6">

      {/* Stats Row */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: "Total Users",    value: stats.total,      icon: Users,     color: "text-primary"    },
            { label: "Subscribers",    value: stats.subscriber, icon: Crown,     color: "text-green-400"  },
            { label: "Free Accounts",  value: stats.free,       icon: UserCheck, color: "text-blue-400"   },
            { label: "Suspended",      value: stats.suspended,  icon: UserX,     color: "text-red-400"    },
          ].map(({ label, value, icon: Icon, color }) => (
            <div key={label} className="bg-card border border-border/50 rounded-xl p-3 flex items-center gap-3">
              <div className={cn("p-2 rounded-lg bg-muted/50", color)}>
                <Icon className="w-4 h-4" />
              </div>
              <div>
                <div className="text-xl font-black text-white">{value}</div>
                <div className="text-xs text-muted-foreground">{label}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Filters + Search */}
      <div className="flex flex-wrap gap-2 items-center">
        {/* Search */}
        <div className="relative flex-1 min-w-[180px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
          <input
            type="text" value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search name, email, label…"
            className="w-full pl-9 pr-4 py-2 rounded-xl bg-muted/50 border border-border text-sm text-white placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
          />
        </div>

        {/* Role filter */}
        <select value={roleFilter} onChange={e => setRoleFilter(e.target.value as any)}
          className="bg-muted/50 border border-border rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-primary/50">
          <option value="all">All Roles</option>
          {ROLE_OPTIONS.map(r => <option key={r} value={r}>{r}</option>)}
        </select>

        {/* Plan filter */}
        <select value={planFilter} onChange={e => setPlanFilter(e.target.value as any)}
          className="bg-muted/50 border border-border rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-primary/50">
          <option value="all">All Plans</option>
          {PLAN_OPTIONS.map(p => <option key={p} value={p}>{p}</option>)}
        </select>

        {/* Status filter */}
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value as any)}
          className="bg-muted/50 border border-border rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-primary/50">
          <option value="all">All Status</option>
          {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
        </select>

        <button onClick={load}
          className="p-2 rounded-xl bg-muted/50 border border-border text-muted-foreground hover:text-foreground transition-colors">
          <RefreshCw className={cn("w-4 h-4", loading && "animate-spin")} />
        </button>
      </div>

      {/* User List */}
      <div className="bg-card border border-border/50 rounded-2xl overflow-hidden">
        {/* Header */}
        <div className="px-4 py-3 border-b border-border/50 flex items-center justify-between">
          <h3 className="font-semibold text-white flex items-center gap-2">
            <Users className="w-4 h-4 text-primary" />
            {filtered.length} {filtered.length === 1 ? "User" : "Users"}
            {(search || roleFilter !== "all" || planFilter !== "all" || statusFilter !== "all") &&
              <span className="text-xs text-muted-foreground font-normal">(filtered)</span>}
          </h3>
          <span className="text-xs text-muted-foreground">
            Sorted by signup date ↓
          </span>
        </div>

        {/* Body */}
        {loading ? (
          <div className="py-12 text-center text-muted-foreground text-sm">
            <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2" />
            Loading users…
          </div>
        ) : error ? (
          <div className="py-12 text-center text-red-400 text-sm">{error}</div>
        ) : filtered.length === 0 ? (
          <div className="py-12 text-center text-muted-foreground text-sm">
            {users.length === 0 ? "No users have signed up yet." : "No users match your filters."}
          </div>
        ) : (
          <div>
            {[...filtered]
              .sort((a, b) => new Date(b.signupDate).getTime() - new Date(a.signupDate).getTime())
              .map(u => (
                <UserRow
                  key={u.id}
                  user={u}
                  onEdit={setEditUser}
                  onDelete={setDeleteConfirm}
                />
              ))}
          </div>
        )}
      </div>

      {/* Column legend */}
      <div className="text-xs text-muted-foreground/50 text-right">
        Hover a row to see edit / delete actions
      </div>

      {/* Edit Modal */}
      {editUser && (
        <EditUserModal
          user={editUser}
          onSave={handleSave}
          onClose={() => setEditUser(null)}
        />
      )}

      {/* Delete Confirm */}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-card border border-border/60 rounded-2xl p-6 max-w-sm w-full shadow-2xl">
            <h3 className="font-bold text-white mb-2">Delete Account</h3>
            <p className="text-sm text-muted-foreground mb-5">
              Are you sure you want to permanently delete{" "}
              <span className="text-white font-medium">{deleteConfirm.name}</span>?
              This cannot be undone.
            </p>
            <div className="flex gap-2">
              <button onClick={() => setDeleteConfirm(null)}
                className="flex-1 py-2.5 rounded-xl border border-border text-muted-foreground hover:text-foreground text-sm font-medium transition-colors">
                Cancel
              </button>
              <button onClick={() => handleDelete(deleteConfirm)} disabled={deleting}
                className="flex-1 py-2.5 rounded-xl bg-red-500 hover:bg-red-600 text-white text-sm font-bold transition-colors disabled:opacity-50">
                {deleting ? "Deleting…" : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
