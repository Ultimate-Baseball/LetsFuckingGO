export const dynamic = 'force-dynamic';

import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import AlertsPageClient from './AlertsPageClient';
import { loadTodayAlerts, loadMonitorState } from '@/lib/mlb/monitor';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Live Alerts',
  robots: { index: false }, // Admin-only — never indexed
};

export default async function AlertsPage() {
  // Server-side auth check using httpOnly cookie
  const cookieStore = await cookies();
  const role = cookieStore.get('ubt_auth_role')?.value;
  if (role !== 'admin') redirect('/login');

  // Pre-fetch data server-side for instant load
  const [alerts, state] = await Promise.all([
    loadTodayAlerts(),
    loadMonitorState(),
  ]);

  return (
    <AlertsPageClient
      initialAlerts={alerts}
      initialState={state}
    />
  );
}
