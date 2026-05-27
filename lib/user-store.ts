/**
 * User store — persistent user accounts for UBT.
 *
 * Stored as a single JSON blob at ubt/users.json via Vercel Blob.
 * Passwords are hashed with Node's built-in scrypt (no extra deps).
 */

import { scryptSync, randomBytes, timingSafeEqual } from 'crypto';
import { writeBlobJson, readBlobJson } from './blob-store';

export const BLOB_USERS_PATH = 'ubt/users.json';

// ─── Types ────────────────────────────────────────────────────────────────────

export type UserRole   = 'subscriber' | 'free';
export type UserStatus = 'active' | 'pending' | 'suspended';
export type UserPlan   = 'free' | 'basic' | 'premium';

export interface AppUser {
  id:           string;           // crypto.randomUUID()
  email:        string;           // unique, used to log in
  name:         string;           // display name
  passwordHash: string;           // scrypt hash
  role:         UserRole;         // free | subscriber
  status:       UserStatus;       // active | pending | suspended
  plan:         UserPlan;         // free | basic | premium
  labels:       string[];         // admin-assigned tags: 'vip', 'beta', 'trial', etc.
  notes:        string;           // admin notes (not shown to user)
  signupDate:   string;           // ISO date
  lastLogin:    string | null;    // ISO timestamp
  loginCount:   number;
}

// Safe version without passwordHash for client responses
export type SafeUser = Omit<AppUser, 'passwordHash'>;

// ─── Password helpers ─────────────────────────────────────────────────────────

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString('hex');
  const hash = scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  try {
    const [salt, hash] = stored.split(':');
    if (!salt || !hash) return false;
    const attempt = scryptSync(password, salt, 64);
    return timingSafeEqual(Buffer.from(hash, 'hex'), attempt);
  } catch {
    return false;
  }
}

// ─── Storage helpers ──────────────────────────────────────────────────────────

export async function loadUsers(): Promise<AppUser[]> {
  const data = await readBlobJson<AppUser[]>(BLOB_USERS_PATH);
  return data ?? [];
}

export async function saveUsers(users: AppUser[]): Promise<void> {
  await writeBlobJson(BLOB_USERS_PATH, users);
}

// ─── CRUD ─────────────────────────────────────────────────────────────────────

export async function findUserByEmail(email: string): Promise<AppUser | null> {
  const users = await loadUsers();
  return users.find(u => u.email.toLowerCase() === email.toLowerCase()) ?? null;
}

export async function createUser(data: {
  email: string;
  name:  string;
  password: string;
  role?:   UserRole;
  status?: UserStatus;
  plan?:   UserPlan;
}): Promise<AppUser> {
  const users = await loadUsers();

  // Enforce unique email
  if (users.some(u => u.email.toLowerCase() === data.email.toLowerCase())) {
    throw new Error('An account with that email already exists.');
  }

  const now: AppUser = {
    id:           crypto.randomUUID(),
    email:        data.email.toLowerCase().trim(),
    name:         data.name.trim(),
    passwordHash: hashPassword(data.password),
    role:         data.role   ?? 'free',
    status:       data.status ?? 'active',
    plan:         data.plan   ?? 'free',
    labels:       [],
    notes:        '',
    signupDate:   new Date().toISOString().split('T')[0],
    lastLogin:    null,
    loginCount:   0,
  };

  await saveUsers([...users, now]);
  return now;
}

export async function updateUser(
  id: string,
  updates: Partial<Pick<AppUser, 'role' | 'status' | 'plan' | 'labels' | 'notes' | 'name' | 'lastLogin' | 'loginCount'>>
): Promise<AppUser | null> {
  const users = await loadUsers();
  const idx   = users.findIndex(u => u.id === id);
  if (idx === -1) return null;

  users[idx] = { ...users[idx], ...updates };
  await saveUsers(users);
  return users[idx];
}

export async function deleteUser(id: string): Promise<boolean> {
  const users = await loadUsers();
  const filtered = users.filter(u => u.id !== id);
  if (filtered.length === users.length) return false;
  await saveUsers(filtered);
  return true;
}

/** Strip passwordHash before sending to client */
export function sanitizeUser(user: AppUser): SafeUser {
  const { passwordHash: _omit, ...safe } = user;
  return safe;
}
