// GET /api/pitchers?format=monitor
// Returns all pitchers from UBT data in monitor format
// Used internally by the MLB monitor engine

import { NextRequest, NextResponse } from 'next/server';
import { getUBTPitcherData } from '@/lib/mlb/monitor';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  // Internal token check
  const token = req.headers.get('x-internal-token');
  if (token && token !== process.env.INTERNAL_API_TOKEN) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const pitchers = await getUBTPitcherData();
    return NextResponse.json(pitchers);
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
